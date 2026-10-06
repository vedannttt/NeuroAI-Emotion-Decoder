import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['6am', '9am', '12pm', '3pm', '6pm', '9pm'];

const EMOTION_HUE = {
  joy: 48, happiness: 48, happy: 48,
  sadness: 220, sad: 220,
  anger: 0, angry: 0, frustrated: 10,
  fear: 270, fearful: 270,
  disgust: 150,
  surprise: 190,
  neutral: 0,
  calm: 140,
  excited: 30,
};

function getColor(emotion, intensity) {
  if (!emotion || intensity === 0) return 'rgba(255,255,255,0.04)';
  const hue = EMOTION_HUE[emotion?.toLowerCase()] ?? 260;
  const sat = 70;
  const light = 40 + intensity * 20;
  return `hsla(${hue}, ${sat}%, ${light}%, ${0.2 + intensity * 0.7})`;
}

export default function WeeklyHeatmap({ data, title = 'Weekly Emotion Map' }) {
  const grid = useMemo(() => {
    // Build 7x6 grid (days x time slots)
    const base = Array.from({ length: 7 }, (_, d) =>
      Array.from({ length: 6 }, (_, h) => ({
        day: d,
        hour: h,
        emotion: null,
        intensity: 0,
        label: '',
      }))
    );

    if (data && data.length) {
      data.forEach((item, i) => {
        const dayIdx = i % 7;
        const hourIdx = Math.floor(i / 7) % 6;
        if (base[dayIdx] && base[dayIdx][hourIdx]) {
          base[dayIdx][hourIdx] = {
            day: dayIdx,
            hour: hourIdx,
            emotion: item.emotion || 'neutral',
            intensity: Math.min(1, (item.confidence || 50) / 100),
            label: `${item.emotion || ''} (${item.confidence || 0}%)`,
          };
        }
      });
    }
    return base;
  }, [data]);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Emotional intensity across the week</p>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 320 }}>
          {/* Day headers */}
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}>
            <div />
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium" style={{ color: '#64748b' }}>{d}</div>
            ))}
          </div>

          {/* Rows */}
          {HOURS.map((hour, h) => (
            <div key={hour} className="grid gap-1 mb-1" style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}>
              <div className="text-xs flex items-center" style={{ color: '#64748b', fontSize: 9 }}>{hour}</div>
              {grid.map((dayCol, d) => {
                const cell = dayCol[h];
                return (
                  <motion.div
                    key={d}
                    className="heatmap-cell relative group"
                    style={{
                      height: 22,
                      borderRadius: 4,
                      background: getColor(cell.emotion, cell.intensity),
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                    whileHover={{ scale: 1.2, zIndex: 10 }}
                    transition={{ duration: 0.15 }}
                    title={cell.label || 'No data'}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        {[['joy','#facc15'], ['sadness','#60a5fa'], ['anger','#f87171'], ['calm','#4ade80'], ['fear','#a78bfa'], ['neutral','#64748b']].map(([emotion, color]) => (
          <div key={emotion} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color, opacity: 0.8 }} />
            <span className="text-xs capitalize" style={{ color: '#64748b' }}>{emotion}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
