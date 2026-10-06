import React from 'react';
import { motion } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter.jsx';

const colorMap = {
  blue: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', icon: '#60a5fa', glow: '0 0 20px rgba(59,130,246,0.2)' },
  purple: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', icon: '#a78bfa', glow: '0 0 20px rgba(139,92,246,0.2)' },
  cyan: { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.25)', icon: '#22d3ee', glow: '0 0 20px rgba(6,182,212,0.2)' },
  green: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', icon: '#34d399', glow: '0 0 20px rgba(16,185,129,0.2)' },
  red: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', icon: '#f87171', glow: '0 0 20px rgba(239,68,68,0.2)' },
  amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: '#fbbf24', glow: '0 0 20px rgba(245,158,11,0.2)' },
  pink: { bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.25)', icon: '#f472b6', glow: '0 0 20px rgba(244,114,182,0.2)' },
};

export default function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'purple',
  trend,
  trendUp,
  badge,
  badgeColor,
  index = 0,
}) {
  const c = colorMap[color] || colorMap.purple;
  const isNumeric = value && !isNaN(parseFloat(String(value).replace('%', ''))) && !String(value).match(/[a-zA-Z]{2,}/);
  const numVal = isNumeric ? parseFloat(String(value).replace('%', '')) : null;
  const hasPct = String(value).includes('%');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.4, 0, 0.2, 1] }}
      className="metric-card relative group"
      style={{ borderRadius: 16 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-300"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}
      />

      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: c.glow }}
          >
            <Icon size={18} style={{ color: c.icon }} />
          </div>
          {badge && (
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                background: badgeColor === 'green' ? 'rgba(16,185,129,0.15)' :
                             badgeColor === 'red' ? 'rgba(239,68,68,0.15)' :
                             badgeColor === 'amber' ? 'rgba(245,158,11,0.15)' :
                             'rgba(255,255,255,0.08)',
                color: badgeColor === 'green' ? '#34d399' :
                       badgeColor === 'red' ? '#f87171' :
                       badgeColor === 'amber' ? '#fbbf24' :
                       '#94a3b8',
                border: `1px solid ${
                  badgeColor === 'green' ? 'rgba(16,185,129,0.25)' :
                  badgeColor === 'red' ? 'rgba(239,68,68,0.25)' :
                  badgeColor === 'amber' ? 'rgba(245,158,11,0.25)' :
                  'rgba(255,255,255,0.1)'
                }`,
              }}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <p className="text-2xl font-bold leading-none" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#f1f5f9' }}>
            {isNumeric && numVal !== null ? (
              <AnimatedCounter value={numVal} suffix={hasPct ? '%' : ''} />
            ) : (
              <span>{value || '—'}</span>
            )}
          </p>
        </div>

        {/* Label */}
        <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#64748b', letterSpacing: '0.05em' }}>
          {label}
        </p>

        {/* Sub + Trend */}
        <div className="flex items-center justify-between">
          {sub && <p className="text-xs" style={{ color: '#475569' }}>{sub}</p>}
          {trend && (
            <span
              className="text-xs font-medium"
              style={{ color: trendUp ? '#34d399' : '#f87171' }}
            >
              {trendUp ? '↑' : '↓'} {trend}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
