import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const STRESS_COLORS = {
  Low: '#10b981',
  Medium: '#f59e0b',
  High: '#ef4444',
  'Moderately Severe': '#f97316',
  Severe: '#ef4444',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="text-xs mb-1" style={{ color: '#64748b' }}>{label}</p>
        <p className="text-xs font-semibold" style={{ color: payload[0]?.color || '#f59e0b' }}>
          Stress: {payload[0]?.value}%
        </p>
      </div>
    );
  }
  return null;
};

function stressToNum(level) {
  if (!level) return 0;
  const map = { Low: 20, low: 20, Minimal: 10, Medium: 55, medium: 55, Moderate: 55, High: 85, high: 85, 'Moderately Severe': 75, Severe: 95, Critical: 100 };
  return map[level] ?? 50;
}

export default function StressTimeline({ data, title = 'Stress Timeline', height = 180 }) {
  const isEmpty = !data || data.length === 0;
  const chartData = isEmpty
    ? []
    : data.map((item, i) => ({
        label: item.label || `S${i + 1}`,
        stress: stressToNum(item.stress_level || item.value),
        level: item.stress_level || 'Medium',
      }));

  const latest = chartData[chartData.length - 1];
  const latestColor = latest ? (STRESS_COLORS[latest.level] || '#f59e0b') : '#64748b';

  return (
    <div className="glass-card rounded-2xl p-5" style={{ minHeight: height + 80 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Stress over sessions</p>
        </div>
        {latest && (
          <span className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: `${latestColor}20`, color: latestColor, border: `1px solid ${latestColor}40` }}>
            {latest.level}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center" style={{ height, color: '#475569' }}>
          <div className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <p className="text-xs">No stress data yet</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="stressGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="stress"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#stressGrad)"
              dot={{ fill: '#f59e0b', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#fbbf24', strokeWidth: 0 }}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
