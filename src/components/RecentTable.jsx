import React from 'react';
import { motion } from 'framer-motion';
import { FiActivity, FiMic, FiBarChart2, FiLayers, FiClock, FiExternalLink } from 'react-icons/fi';
import { NavLink } from 'react-router-dom';

const TYPE_CONFIG = {
  text: { icon: FiActivity, label: 'Text', color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  voice: { icon: FiMic, label: 'Voice', color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  phq9: { icon: FiBarChart2, label: 'PHQ-9', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  fusion: { icon: FiLayers, label: 'Fusion', color: '#f472b6', bg: 'rgba(244,114,182,0.12)' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getEmotion(row) {
  const r = row.result || {};
  return r.overall_emotion || r.emotion || r.severity || '—';
}

function getConfidence(row) {
  const r = row.result || {};
  const c = r.overall_confidence || r.confidence;
  return c ? `${Math.round(c)}%` : null;
}

export default function RecentTable({ history = [] }) {
  const rows = history.slice(0, 8);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>Recent Analyses</h3>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{history.length} total records</p>
        </div>
        <NavLink
          to="/reports"
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: '#a78bfa' }}
        >
          View all <FiExternalLink size={12} />
        </NavLink>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-12" style={{ color: '#475569' }}>
          <div className="text-center">
            <FiClock size={32} className="mx-auto mb-3" style={{ color: '#334155' }} />
            <p className="text-sm font-medium" style={{ color: '#64748b' }}>No analyses yet</p>
            <p className="text-xs mt-1" style={{ color: '#475569' }}>Run your first analysis to see results here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const cfg = TYPE_CONFIG[row.report_type] || TYPE_CONFIG.text;
            const Icon = cfg.icon;
            const emotion = getEmotion(row);
            const conf = getConfidence(row);

            return (
              <motion.div
                key={row.id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-default"
                style={{ background: 'rgba(255,255,255,0.03)' }}
                whileHover={{ background: 'rgba(255,255,255,0.06)' }}
              >
                {/* Type icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg }}
                >
                  <Icon size={14} style={{ color: cfg.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="text-xs capitalize truncate" style={{ color: '#e2e8f0' }}>{emotion}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                    {timeAgo(row.created_at)}
                  </p>
                </div>

                {/* Confidence */}
                {conf && (
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#a78bfa' }}>
                    {conf}
                  </span>
                )}

                {/* Status dot */}
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10b981' }} />
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
