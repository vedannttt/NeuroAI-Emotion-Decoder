import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="text-xs mb-1" style={{ color: '#64748b' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-xs font-semibold capitalize" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(0) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrendChart({ data, title = 'Emotion Trends', height = 200 }) {
  const isEmpty = !data || data.length === 0;

  const chartData = isEmpty
    ? [{ label: 'No data', confidence: 0 }]
    : data.map((item, i) => ({
        label: item.label || `Session ${i + 1}`,
        confidence: typeof item.confidence === 'number' ? item.confidence : 70,
        emotion: item.emotion || 'neutral',
      }));

  return (
    <div className="glass-card rounded-2xl p-5" style={{ minHeight: height + 80 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Session-over-session</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#8b5cf6' }} />
          <span className="text-xs" style={{ color: '#64748b' }}>Confidence</span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center" style={{ height, color: '#475569' }}>
          <div className="text-center">
            <div className="text-3xl mb-2">📈</div>
            <p className="text-xs">No trend data yet</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="confidenceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="confidence"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#confidenceGrad)"
              dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#a78bfa', strokeWidth: 0 }}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
