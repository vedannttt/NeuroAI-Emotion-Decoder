import React from 'react';

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CircularProgress({ value = 0, size = 90, color = '#8b5cf6', trackColor = 'rgba(255,255,255,0.08)', label, sublabel }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 90 90" className="-rotate-90" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx="45" cy="45" r={RADIUS}
            fill="none"
            stroke={trackColor}
            strokeWidth="6"
          />
          {/* Progress */}
          <circle
            cx="45" cy="45" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        {/* Center value */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <span className="font-bold text-sm leading-none" style={{ color: '#f1f5f9' }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      {label && (
        <div className="text-center">
          <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</p>
          {sublabel && <p className="text-xs" style={{ color: '#64748b', fontSize: 10 }}>{sublabel}</p>}
        </div>
      )}
    </div>
  );
}
