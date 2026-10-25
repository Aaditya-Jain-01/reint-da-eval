import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Zap, TrendingUp, AlertCircle, BarChart3, ShieldAlert, Cpu } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dispatch'); // 'dispatch' or 'evaluation'
  const [date, setDate] = useState('2026-01-15');
  const [cutoff, setCutoff] = useState(12);
  const [demand, setDemand] = useState(15000);

  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // Fetch Daily Procurement Data
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/day-ahead-data?target_date=${date}&cutoff_hour=${cutoff}&demand_mw=${demand}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load settlement data for this date');
        return res.json();
      })
      .then(data => {
        setDailyData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [date, cutoff, demand]);

  // Fetch Monthly Quantitative Evaluation Metrics
  useEffect(() => {
    fetch(`${API_BASE}/api/monthly-metrics?cutoff_hour=${cutoff}`)
      .then(res => res.json())
      .then(data => setMonthlyData(data))
      .catch(err => console.error(err));
  }, [cutoff]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white">Gridbricks</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  UK Day-Ahead Decision Desk
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Elexon BMRS Wind Actuals (FUELHH) vs Forecasts (WINDFOR) • January 2026
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-1 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'dispatch' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Day-Ahead Procurement
            </button>
            <button
              onClick={() => setActiveTab('evaluation')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'evaluation' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Accuracy & Risk Evaluation
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Controls Toolbar */}
        <section className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Target Delivery Day</label>
              <input
                type="date"
                min="2026-01-01"
                max="2026-01-31"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>D-1 Decision Gate</span>
                <span className="text-emerald-400 font-semibold">{cutoff}:00 GMT</span>
              </div>
              <input
                type="range"
                min="8"
                max="16"
                value={cutoff}
                onChange={e => setCutoff(Number(e.target.value))}
                className="w-36 accent-emerald-500 cursor-pointer"
              />
            </div>

            {activeTab === 'dispatch' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Consumer Demand Baseline</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="500"
                    min="5000"
                    max="35000"
                    value={demand}
                    onChange={e => setDemand(Number(e.target.value))}
                    className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-400">MW</span>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span>Temporal Lookahead Filter Active: <strong>publishTime ≤ {cutoff}:00 (D-1)</strong></span>
          </div>
        </section>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: Day-Ahead Procurement View */}
        {activeTab === 'dispatch' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            {dailyData?.metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">MAE (Mean Error)</div>
                  <div className="text-2xl font-bold text-white mt-1">{dailyData.metrics.mae_mw} <span className="text-xs font-normal text-slate-400">MW</span></div>
                  <div className="text-xs text-slate-500 mt-1">Average settlement variance</div>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">RMSE (Peak Volatility)</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">{dailyData.metrics.rmse_mw} <span className="text-xs font-normal text-slate-400">MW</span></div>
                  <div className="text-xs text-slate-500 mt-1">Penalizes extreme deviations</div>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">Systemic Forecast Bias</div>
                  <div className={`text-2xl font-bold mt-1 ${dailyData.metrics.bias_mw > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {dailyData.metrics.bias_mw > 0 ? `+${dailyData.metrics.bias_mw}` : dailyData.metrics.bias_mw} <span className="text-xs font-normal text-slate-400">MW</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {dailyData.metrics.bias_mw > 0 ? 'Over-forecasted (Short Imbalance Risk)' : 'Under-forecasted (Surplus Buffer)'}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">WAPE Accuracy</div>
                  <div className="text-2xl font-bold text-sky-400 mt-1">{dailyData.metrics.wape_percent}%</div>
                  <div className="text-xs text-slate-500 mt-1">Weighted relative to total wind</div>
                </div>
              </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Actual vs Forecast Chart */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Day-Ahead Forecast vs Delivered Wind Actuals
                  </h3>
                  <span className="text-xs text-slate-500">48 Settlement Periods (30m)</span>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyData?.timeseries || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="startTime" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" unit=" MW" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="forecast_mw" name="DA Wind Forecast (WINDFOR)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="actual_mw" name="Delivered Wind Actuals (FUELHH)" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Thermal Procurement Needed */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Thermal Power Purchase Gap (Demand - Wind)
                  </h3>
                  <span className="text-xs text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded">Actionable Bid Volume</span>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyData?.timeseries || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="startTime" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" unit=" MW" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Area type="monotone" dataKey="thermal_needed_mw" name="Day-Ahead Thermal Required (MW)" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Quantitative Error & Risk Evaluation */}
        {activeTab === 'evaluation' && (
          <div className="space-y-6">
            {/* Monthly Summary Cards */}
            {monthlyData?.overall_metrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">January 2026 MAE</div>
                  <div className="text-2xl font-bold text-white mt-1">{monthlyData.overall_metrics.mae_mw} MW</div>
                  <div className="text-xs text-slate-500 mt-1">Across 1,488 settlement intervals</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">January 2026 RMSE</div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">{monthlyData.overall_metrics.rmse_mw} MW</div>
                  <div className="text-xs text-slate-500 mt-1">System imbalance tail-risk metric</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">Monthly Mean Bias Error</div>
                  <div className={`text-2xl font-bold mt-1 ${monthlyData.overall_metrics.bias_mw > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {monthlyData.overall_metrics.bias_mw > 0 ? `+${monthlyData.overall_metrics.bias_mw}` : monthlyData.overall_metrics.bias_mw} MW
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Structural directional skew</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <div className="text-xs text-slate-400">Monthly WAPE</div>
                  <div className="text-2xl font-bold text-sky-400 mt-1">{monthlyData.overall_metrics.wape_percent}%</div>
                  <div className="text-xs text-slate-500 mt-1">Normalized error percentage</div>
                </div>
              </div>
            )}

            {/* Hourly Error Profile Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-200">
                  Diurnal Error Profile: MAE & Systemic Bias by Hour of the Day
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Highlights which trading windows suffer from systematic forecast degradation to calibrate reserve buffers.
                </p>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData?.hourly_breakdown || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="hour" stroke="#64748b" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" unit=" MW" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="mae_mw" name="Hourly MAE (MW)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="bias_mw" name="Hourly Bias (MW)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        Gridbricks Technical Assessment Prototype • Powered by Elexon BMRS Stream Datasets
      </footer>
    </div>
  );
}