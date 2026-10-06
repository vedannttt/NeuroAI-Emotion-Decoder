import React from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { FiActivity, FiMic, FiBarChart2, FiLayers, FiArrowRight } from 'react-icons/fi';

const ACTIONS = [
  {
    icon: FiActivity,
    title: 'Text Analysis',
    description: 'Analyze written emotions with GoEmotions model',
    to: '/analyze',
    color: '#a78bfa',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.2)',
    gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.08))',
  },
  {
    icon: FiMic,
    title: 'Voice Analysis',
    description: 'Upload or record audio for CREMA-D model',
    to: '/voice',
    color: '#34d399',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.2)',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.08))',
  },
  {
    icon: FiBarChart2,
    title: 'PHQ-9 Assessment',
    description: 'Standardized mental health questionnaire',
    to: '/phq9',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.12)',
    border: 'rgba(251,146,60,0.2)',
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(245,158,11,0.08))',
  },
  {
    icon: FiLayers,
    title: 'Fusion Analysis',
    description: 'Combine all signals for a holistic report',
    to: '/fusion',
    color: '#f472b6',
    bg: 'rgba(244,114,182,0.12)',
    border: 'rgba(244,114,182,0.2)',
    gradient: 'linear-gradient(135deg, rgba(244,114,182,0.15), rgba(139,92,246,0.08))',
    featured: true,
  },
];

export default function QuickActions() {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>Quick Actions</h3>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Start a new analysis instantly</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.to}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <NavLink
                to={action.to}
                className="block p-4 rounded-xl transition-all group"
                style={{
                  background: action.gradient,
                  border: `1px solid ${action.border}`,
                  textDecoration: 'none',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {action.featured && (
                  <div
                    className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ background: 'rgba(244,114,182,0.3)', color: '#f9a8d4', fontSize: 9 }}
                  >
                    RECOMMENDED
                  </div>
                )}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: action.bg, border: `1px solid ${action.border}` }}
                >
                  <Icon size={16} style={{ color: action.color }} />
                </div>
                <p className="text-xs font-semibold mb-1" style={{ color: '#f1f5f9' }}>{action.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: '#64748b', fontSize: 10 }}>{action.description}</p>
                <div
                  className="flex items-center gap-1 mt-2 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: action.color }}
                >
                  Start <FiArrowRight size={11} />
                </div>
              </NavLink>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
