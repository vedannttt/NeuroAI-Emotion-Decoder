import React from 'react';
import { motion } from 'framer-motion';
import { FiZap, FiAlertTriangle, FiInfo, FiHeart } from 'react-icons/fi';

const INSIGHT_ICONS = {
  warning: FiAlertTriangle,
  tip: FiZap,
  info: FiInfo,
  positive: FiHeart,
};

const INSIGHT_COLORS = {
  warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', icon: '#fbbf24', text: '#fde68a' },
  tip: { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', icon: '#a78bfa', text: '#c4b5fd' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', icon: '#60a5fa', text: '#bfdbfe' },
  positive: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', icon: '#34d399', text: '#a7f3d0' },
};

function generateInsights(latest) {
  if (!latest) {
    return [
      { type: 'info', title: 'No analysis yet', body: 'Complete your first Text, Voice, PHQ-9, or Fusion analysis to receive AI-powered insights.' },
    ];
  }

  const insights = [];
  const emotion = latest.overall_emotion || latest.emotion || '';
  const stress = latest.stress_level || '';
  const phqSeverity = latest.phq_severity || latest.severity || '';
  const confidence = latest.overall_confidence || latest.confidence || 0;
  const risk = typeof latest.suicide_risk === 'object'
    ? latest.suicide_risk?.risk_level
    : (latest.suicide_risk || 'Low');

  if (emotion) {
    insights.push({
      type: emotion.toLowerCase().includes('sad') || emotion.toLowerCase().includes('fear') ? 'warning' : 'positive',
      title: `Primary Emotion: ${emotion}`,
      body: `Your dominant emotional state is ${emotion.toLowerCase()}. ${confidence > 80 ? 'The model detected this with high confidence.' : 'Consider completing a full Fusion analysis for more accuracy.'}`,
    });
  }

  if (stress === 'High' || stress === 'Critical') {
    insights.push({
      type: 'warning',
      title: 'Elevated Stress Detected',
      body: 'Your current stress indicators suggest elevated tension. Consider mindfulness exercises or speaking with a mental health professional.',
    });
  } else if (stress === 'Low') {
    insights.push({
      type: 'positive',
      title: 'Low Stress Level',
      body: 'Your stress indicators look healthy! Keep up your current wellness routines.',
    });
  }

  if (phqSeverity && phqSeverity !== 'Minimal') {
    insights.push({
      type: phqSeverity === 'Severe' || phqSeverity === 'Moderately Severe' ? 'warning' : 'tip',
      title: `PHQ-9: ${phqSeverity}`,
      body: `Your PHQ-9 score indicates ${phqSeverity.toLowerCase()} symptoms. ${phqSeverity === 'Severe' ? 'We strongly recommend consulting a healthcare provider.' : 'Regular monitoring and self-care strategies are advisable.'}`,
    });
  }

  if (risk && risk !== 'Low' && risk !== 'low') {
    insights.push({
      type: 'warning',
      title: 'Safety Monitoring Active',
      body: 'Safety indicators have been noted. Please reach out to a mental health professional or call a crisis line if you need immediate support.',
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'positive',
      title: 'You are doing well',
      body: 'Your latest analysis results indicate stable emotional health. Keep monitoring regularly for best outcomes.',
    });
  }

  return insights;
}

export default function InsightsPanel({ latest }) {
  const insights = generateInsights(latest);

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}
        >
          <FiZap size={15} style={{ color: '#a78bfa' }} />
        </div>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>AI Insights</h3>
          <p className="text-xs" style={{ color: '#64748b' }}>Auto-generated observations</p>
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight, i) => {
          const c = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.info;
          const Icon = INSIGHT_ICONS[insight.type] || FiInfo;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="flex gap-3 p-3 rounded-xl"
              style={{ background: c.bg, border: `1px solid ${c.border}` }}
            >
              <Icon size={15} style={{ color: c.icon, flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: c.text }}>{insight.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(148,163,184,0.8)' }}>{insight.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
