import React from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="text-xs font-semibold capitalize" style={{ color: '#f1f5f9' }}>
          {payload[0].payload.subject}
        </p>
        <p className="text-xs" style={{ color: '#a78bfa' }}>
          Score: {payload[0].value.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

export default function RadarEmotionChart({ data, title = 'Emotion Radar' }) {
  const isEmpty = !data || data.length === 0;

  const chartData = isEmpty
    ? [
        { subject: 'Joy', A: 0 },
        { subject: 'Sadness', A: 0 },
        { subject: 'Anger', A: 0 },
        { subject: 'Fear', A: 0 },
        { subject: 'Surprise', A: 0 },
        { subject: 'Disgust', A: 0 },
      ]
    : data.map(item => ({
        subject: (item.emotion || item.name || 'Unknown'),
        A: parseFloat((item.confidence || item.value || 0).toFixed(1)),
      })).slice(0, 8);

  return (
    <div className="glass-card rounded-2xl p-5 h-full" style={{ minHeight: 260 }}>
      <div className="mb-4">
        <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Emotion intensity map</p>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-40" style={{ color: '#475569' }}>
          <div className="text-center">
            <div className="text-3xl mb-2">🕸️</div>
            <p className="text-xs">Run analysis to see radar</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: '#64748b', fontSize: 10 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: '#475569', fontSize: 9 }}
              axisLine={false}
            />
            <Radar
              name="Emotion"
              dataKey="A"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.2}
              dot={{ fill: '#a78bfa', r: 3 }}
              animationBegin={0}
              animationDuration={800}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
