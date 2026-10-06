import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const EMOTION_COLORS = {
  joy: '#fbbf24',
  happiness: '#fbbf24',
  happy: '#fbbf24',
  sadness: '#60a5fa',
  sad: '#60a5fa',
  anger: '#f87171',
  angry: '#f87171',
  fear: '#a78bfa',
  fearful: '#a78bfa',
  disgust: '#34d399',
  surprise: '#22d3ee',
  neutral: '#94a3b8',
  calm: '#4ade80',
  excited: '#fb923c',
  frustrated: '#ef4444',
};

const DEFAULT_COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0];
    return (
      <div className="chart-tooltip">
        <p className="font-semibold capitalize" style={{ color: '#f1f5f9', marginBottom: 2 }}>{name}</p>
        <p style={{ color: '#94a3b8' }}>{value.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

const CustomLabel = ({ cx, cy, value }) => (
  <>
    <text x={cx} y={cy - 8} textAnchor="middle" fill="#f1f5f9"
      style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 700 }}>
      {value}%
    </text>
    <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b"
      style={{ fontSize: 10, letterSpacing: '0.1em' }}>
      DOMINANT
    </text>
  </>
);

export default function EmotionDonut({ data, title = 'Emotion Distribution' }) {
  const chartData = useMemo(() => {
    if (!data || !data.length) {
      return [
        { name: 'No Data', value: 100 },
      ];
    }
    return data.map(item => ({
      name: item.emotion || item.name || 'Unknown',
      value: parseFloat((item.confidence || item.value || 0).toFixed(1)),
    })).sort((a, b) => b.value - a.value).slice(0, 7);
  }, [data]);

  const topEmotion = chartData[0];
  const isEmpty = !data || !data.length;

  const getColor = (name, idx) => {
    const key = name?.toLowerCase();
    return EMOTION_COLORS[key] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
  };

  return (
    <div className="glass-card rounded-2xl p-5 h-full" style={{ minHeight: 280 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Multi-model analysis</p>
        </div>
        {!isEmpty && topEmotion && (
          <span className="status-badge info capitalize">{topEmotion.name}</span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-40" style={{ color: '#475569' }}>
          <div className="text-center">
            <div className="text-3xl mb-2">🧠</div>
            <p className="text-xs">Run an analysis to see emotion distribution</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
            >
              {chartData.map((entry, idx) => (
                <Cell
                  key={entry.name}
                  fill={getColor(entry.name, idx)}
                  opacity={0.9}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'capitalize' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
