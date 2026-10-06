import React from 'react';
import { motion } from 'framer-motion';
import { FiActivity, FiMic, FiBarChart2, FiLayers, FiCpu, FiArrowRight, FiCheck, FiLoader } from 'react-icons/fi';

const STEPS = [
  { key: 'text', icon: FiActivity, label: 'Text Analysis', color: '#a78bfa', desc: 'GoEmotions model' },
  { key: 'voice', icon: FiMic, label: 'Voice Analysis', color: '#34d399', desc: 'CREMA-D model' },
  { key: 'phq', icon: FiBarChart2, label: 'PHQ-9', color: '#fb923c', desc: 'Severity scoring' },
  { key: 'fusion', icon: FiCpu, label: 'Fusion AI', color: '#f472b6', desc: 'Multi-agent fusion' },
  { key: 'result', icon: FiLayers, label: 'Final Result', color: '#60a5fa', desc: 'Holistic report' },
];

function StepNode({ step, status, value, index }) {
  const Icon = step.icon;
  const isDone = status === 'done';
  const isActive = status === 'active';
  const isPending = status === 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="flex flex-col items-center gap-2 flex-1 min-w-0"
    >
      {/* Node circle */}
      <motion.div
        className="relative flex items-center justify-center rounded-2xl"
        style={{
          width: 52, height: 52,
          background: isDone
            ? `rgba(16,185,129,0.15)`
            : isActive
            ? `rgba(${step.color === '#a78bfa' ? '139,92,246' : step.color === '#34d399' ? '16,185,129' : step.color === '#fb923c' ? '251,146,60' : step.color === '#f472b6' ? '244,114,182' : '59,130,246'},0.2)`
            : 'rgba(255,255,255,0.04)',
          border: `1.5px solid ${isDone ? '#10b981' : isActive ? step.color : 'rgba(255,255,255,0.1)'}`,
          boxShadow: isActive ? `0 0 20px ${step.color}40` : isDone ? '0 0 12px rgba(16,185,129,0.3)' : 'none',
        }}
        animate={isActive ? { boxShadow: [`0 0 10px ${step.color}30`, `0 0 25px ${step.color}60`, `0 0 10px ${step.color}30`] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {isDone ? (
          <FiCheck size={20} style={{ color: '#10b981' }} />
        ) : isActive ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <FiLoader size={18} style={{ color: step.color }} />
          </motion.div>
        ) : (
          <Icon size={20} style={{ color: isPending ? '#475569' : step.color }} />
        )}
      </motion.div>

      {/* Label */}
      <div className="text-center min-w-0 w-full">
        <p className="text-xs font-semibold truncate" style={{ color: isDone ? '#10b981' : isActive ? step.color : '#64748b' }}>
          {step.label}
        </p>
        <p className="text-xs" style={{ color: '#475569', fontSize: 9 }}>{step.desc}</p>
        {value && isDone && (
          <p className="text-xs mt-0.5 font-medium truncate" style={{ color: '#f1f5f9', fontSize: 10 }}>
            {value}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default function FusionPipeline({ textResult, voiceResult, phqResult, fusionResult, busy }) {
  // Determine status of each step
  const getStatus = (key) => {
    if (busy && key === 'fusion') return 'active';
    if (busy) return key === 'result' ? 'pending' : 'done';
    if (!textResult && !voiceResult && !phqResult && !fusionResult) return 'pending';

    switch (key) {
      case 'text': return textResult ? 'done' : 'pending';
      case 'voice': return voiceResult ? 'done' : 'pending';
      case 'phq': return phqResult ? 'done' : 'pending';
      case 'fusion': return fusionResult ? 'done' : 'pending';
      case 'result': return fusionResult ? 'done' : 'pending';
      default: return 'pending';
    }
  };

  const getValue = (key) => {
    switch (key) {
      case 'text': return textResult ? `${textResult.emotion} (${textResult.confidence}%)` : null;
      case 'voice': return voiceResult ? `${voiceResult.emotion} (${voiceResult.confidence}%)` : null;
      case 'phq': return phqResult ? `${phqResult.severity} (${phqResult.total_score}/27)` : null;
      case 'fusion': return fusionResult ? fusionResult.overall_emotion : null;
      case 'result': return fusionResult ? `${fusionResult.overall_confidence}% confidence` : null;
      default: return null;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-5">
        <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>
          Fusion AI Pipeline
        </h3>
        <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
          Multi-modal signal integration
        </p>
      </div>

      <div className="flex items-start gap-1">
        {STEPS.map((step, i) => (
          <React.Fragment key={step.key}>
            <StepNode
              step={step}
              status={getStatus(step.key)}
              value={getValue(step.key)}
              index={i}
            />
            {i < STEPS.length - 1 && (
              <div className="flex-shrink-0 flex items-start pt-6">
                <motion.div
                  className="pipeline-connector"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: getStatus(STEPS[i + 1].key) !== 'pending' || busy ? 1 : 0.3 }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                  style={{ transformOrigin: 'left' }}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
