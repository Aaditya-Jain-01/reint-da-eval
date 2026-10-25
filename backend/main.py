import os
from typing import Optional
import pandas as pd
import numpy as np
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="UK Wind Day-Ahead Procurement API",
    description="Quantitative decision portal evaluating Elexon wind forecasts for day-ahead purchasing (January 2026)",
    version="1.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
ACTUALS_PATH = os.path.join(DATA_DIR, "actuals_jan2026.json")
FORECASTS_PATH = os.path.join(DATA_DIR, "forecasts_jan2026.json")

# In-memory dataframe cache loaded at startup
actuals_df = pd.DataFrame()
forecasts_df = pd.DataFrame()

@app.on_event("startup")
def load_datasets():
    global actuals_df, forecasts_df
    if not os.path.exists(ACTUALS_PATH) or not os.path.exists(FORECASTS_PATH):
        raise RuntimeError("Dataset files not found in backend/data. Please run fetch_data.py first.")
    
    print("Loading January 2026 datasets into memory...")
    actuals_df = pd.read_json(ACTUALS_PATH)
    actuals_df["startTime"] = pd.to_datetime(actuals_df["startTime"], utc=True)
    actuals_df = actuals_df.sort_values("startTime").reset_index(drop=True)

    forecasts_df = pd.read_json(FORECASTS_PATH)
    forecasts_df["startTime"] = pd.to_datetime(forecasts_df["startTime"], utc=True)
    forecasts_df["publishTime"] = pd.to_datetime(forecasts_df["publishTime"], utc=True)
    forecasts_df = forecasts_df.sort_values("publishTime").reset_index(drop=True)
    print(f"Loaded {len(actuals_df)} actuals and {len(forecasts_df)} forecast snapshots.")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "actual_records": len(actuals_df),
        "forecast_records": len(forecasts_df)
    }

@app.get("/api/day-ahead-data")
def get_day_ahead_data(
    target_date: str = Query("2026-01-15", pattern=r"^\d{4}-\d{2}-\d{2}$", description="Delivery day YYYY-MM-DD"),
    cutoff_hour: int = Query(12, ge=6, le=18, description="Auction gate closure hour on D-1 (e.g. 12 for 12:00 GMT)"),
    demand_mw: float = Query(15000.0, ge=1000.0, le=50000.0, description="Simulated utility consumer demand (MW)")
):
    """
    Returns time series comparing the latest available forecast at D-1 cutoff
    against delivered actuals and calculated thermal procurement requirements.
    """
    try:
        delivery_start = pd.Timestamp(f"{target_date} 00:00:00", tz="UTC")
        delivery_end = pd.Timestamp(f"{target_date} 23:59:59", tz="UTC")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format.")

    # Day D-1 Cutoff Time
    cutoff_time = (delivery_start - pd.Timedelta(days=1)).replace(hour=cutoff_hour, minute=0, second=0)

    # 1. Filter delivered actuals for the delivery day
    day_actuals = actuals_df[
        (actuals_df["startTime"] >= delivery_start) & (actuals_df["startTime"] <= delivery_end)
    ].copy()

    if day_actuals.empty:
        raise HTTPException(status_code=404, detail=f"No actual wind records found for {target_date}")

    # 2. Filter WINDFOR forecasts targeting delivery day and published before cutoff
    valid_forecasts = forecasts_df[
        (forecasts_df["startTime"] >= delivery_start) &
        (forecasts_df["startTime"] <= delivery_end) &
        (forecasts_df["publishTime"] <= cutoff_time)
    ].copy()

    # 3. For each settlement period, take the latest forecast available prior to cutoff
    if not valid_forecasts.empty:
        latest_da_forecast = (
            valid_forecasts.sort_values("publishTime")
            .groupby("startTime")
            .last()
            .reset_index()
        )
    else:
        # Fallback if no forecast was published prior to that cutoff: pick earliest known forecast
        earliest_forecasts = forecasts_df[
            (forecasts_df["startTime"] >= delivery_start) & (forecasts_df["startTime"] <= delivery_end)
        ]
        latest_da_forecast = (
            earliest_forecasts.sort_values("publishTime")
            .groupby("startTime")
            .first()
            .reset_index()
        )

    # 4. Merge datasets on startTime
    merged = pd.merge(
        day_actuals,
        latest_da_forecast[["startTime", "generation", "publishTime"]],
        on="startTime",
        how="inner",
        suffixes=("_actual", "_forecast")
    ).sort_values("startTime")

    if merged.empty:
        raise HTTPException(status_code=404, detail="Unable to align actuals and forecasts for selected date.")

    # 5. Build time series records
    timeseries = []
    for _, row in merged.iterrows():
        act = float(row["generation_actual"])
        fc = float(row["generation_forecast"])
        err = round(fc - act, 1)  # Positive = over-forecast; Negative = under-forecast
        thermal_needed = round(max(0.0, demand_mw - fc), 1)

        timeseries.append({
            "startTime": row["startTime"].strftime("%H:%M"),
            "actual_mw": round(act, 1),
            "forecast_mw": round(fc, 1),
            "error_mw": err,
            "thermal_needed_mw": thermal_needed,
            "publishTime": row["publishTime"].strftime("%Y-%m-%d %H:%M") if pd.notnull(row["publishTime"]) else None
        })

    # 6. Compute quantitative accuracy metrics
    act_vals = merged["generation_actual"].to_numpy()
    fc_vals = merged["generation_forecast"].to_numpy()
    errors = fc_vals - act_vals

    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    bias = float(np.mean(errors))
    total_act = float(np.sum(act_vals))
    wape = float((np.sum(np.abs(errors)) / total_act) * 100.0) if total_act > 0 else 0.0

    return {
        "date": target_date,
        "cutoff_applied": cutoff_time.strftime("%Y-%m-%d %H:%M UTC"),
        "metrics": {
            "mae_mw": round(mae, 1),
            "rmse_mw": round(rmse, 1),
            "bias_mw": round(bias, 1),
            "wape_percent": round(wape, 2),
            "avg_actual_mw": round(float(np.mean(act_vals)), 1),
            "avg_forecast_mw": round(float(np.mean(fc_vals)), 1)
        },
        "timeseries": timeseries
    }

@app.get("/api/monthly-metrics")
def get_monthly_metrics(cutoff_hour: int = Query(12, ge=6, le=18)):
    """
    Evaluates forecast performance across all of January 2026,
    including an hourly error breakdown to identify recurring risk windows.
    """
    jan_start = pd.Timestamp("2026-01-01 00:00:00", tz="UTC")
    jan_end = pd.Timestamp("2026-01-31 23:59:59", tz="UTC")

    # Filter actuals
    jan_actuals = actuals_df[(actuals_df["startTime"] >= jan_start) & (actuals_df["startTime"] <= jan_end)].copy()

    # Filter forecasts published by D-1 cutoff
    forecasts_filtered = forecasts_df[
        (forecasts_df["startTime"] >= jan_start) & (forecasts_df["startTime"] <= jan_end)
    ].copy()

    # Assign cutoff timestamp per row based on its delivery date
    forecasts_filtered["cutoff"] = forecasts_filtered["startTime"].dt.floor("D") - pd.Timedelta(days=1) + pd.Timedelta(hours=cutoff_hour)
    valid_fc = forecasts_filtered[forecasts_filtered["publishTime"] <= forecasts_filtered["cutoff"]].copy()

    if valid_fc.empty:
        valid_fc = forecasts_filtered.copy()

    latest_per_period = (
        valid_fc.sort_values("publishTime")
        .groupby("startTime")
        .last()
        .reset_index()
    )

    merged = pd.merge(
        jan_actuals,
        latest_per_period[["startTime", "generation"]],
        on="startTime",
        suffixes=("_actual", "_forecast")
    )

    merged["error"] = merged["generation_forecast"] - merged["generation_actual"]
    merged["abs_error"] = merged["error"].abs()
    merged["hour"] = merged["startTime"].dt.hour

    # Group by settlement hour (0 to 23)
    hourly_breakdown = []
    for h, group in merged.groupby("hour"):
        h_mae = float(group["abs_error"].mean())
        h_bias = float(group["error"].mean())
        hourly_breakdown.append({
            "hour": f"{h:02d}:00",
            "mae_mw": round(h_mae, 1),
            "bias_mw": round(h_bias, 1)
        })

    total_actual = float(merged["generation_actual"].sum())
    total_abs_err = float(merged["abs_error"].sum())

    return {
        "month": "January 2026",
        "total_periods_evaluated": len(merged),
        "overall_metrics": {
            "mae_mw": round(float(merged["abs_error"].mean()), 1),
            "rmse_mw": round(float(np.sqrt((merged["error"] ** 2).mean())), 1),
            "bias_mw": round(float(merged["error"].mean()), 1),
            "wape_percent": round((total_abs_err / total_actual) * 100.0, 2) if total_actual > 0 else 0.0
        },
        "hourly_breakdown": hourly_breakdown
    }