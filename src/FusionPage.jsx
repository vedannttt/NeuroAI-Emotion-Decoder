import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiActivity, FiBarChart2, FiCpu, FiCheck, FiMic, FiTrash2,
  FiUploadCloud, FiPlay, FiSquare, FiAlertTriangle, FiRefreshCw,
  FiChevronRight, FiClock, FiZap, FiShield, FiLayers
} from 'react-icons/fi';
import { API } from './api.js';
import FusionPipeline from './components/FusionPipeline.jsx';
import CircularProgress from './components/CircularProgress.jsx';

const PHQ_QUESTIONS = [
  'Little interest or pleasure in doing things?',
  'Feeling down, depressed, or hopeless?',
  'Trouble falling or staying asleep, or sleeping too much?',
  'Feeling tired or having little energy?',
  'Poor appetite or overeating?',
  'Feeling bad about yourself — or that you are a failure?',
  'Trouble concentrating on things?',
  'Moving or speaking so slowly that others could notice, or being restless?',
  'Thoughts that you would be better off dead, or hurting yourself?',
];

const PHQ_OPTIONS = ['Not at all', 'Several days', 'More than half', 'Nearly every day'];

async function call(path, token, { body, form } = {}) {
  const h = { Authorization: `Bearer ${token}` };
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(API + path, {
    method: 'POST', headers: h,
    body: body ? JSON.stringify(body) : form,
  });
  const d = await r.json().catch(() => ({ detail: 'Invalid response' }));
  if (!r.ok) { const e = new Error(d.detail || 'Request failed'); e.status = r.status; throw e; }
  return d;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─── Section card wrapper ─── */
function ModuleCard({ children, title, icon: Icon, iconColor, badge, badgeColor, connected, className = '' }) {
  const badgeBg = badgeColor === 'green' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)';
  const badgeClr = badgeColor === 'green' ? '#34d399' : '#64748b';
  const badgeBdr = badgeColor === 'green' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.1)';

  return (
    <div
      className={`glass-card rounded-2xl flex flex-col ${className}`}
      style={{ padding: 20, gap: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}35` }}
          >
            <Icon size={17} style={{ color: iconColor }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>
              {title}
            </h3>
          </div>
        </div>
        {badge && (
          <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: badgeBg, color: badgeClr, border: `1px solid ${badgeBdr}` }}>
            {connected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── Voice waveform animation ─── */
function RecordingWave({ bars = 16 }) {
  return (
    <div className="flex items-center gap-0.5 justify-center" style={{ height: 32 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{ animationDelay: `${i * 0.05}s`, animationDuration: `${0.6 + Math.random() * 0.4}s` }}
        />
      ))}
    </div>
  );
}

function recordingExtension(mimeType = '') {
  const type = mimeType.toLowerCase();
  if (type.includes('webm')) return 'webm';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('mpeg')) return 'mp3';
  if (type.includes('wav')) return 'wav';
  return 'webm';
}

/* ─── Result card ─── */
function ResultCard({ label, value, color = '#8b5cf6', icon: Icon }) {
  return (
    <div
      className="p-4 rounded-xl"
      style={{ background: `${color}12`, border: `1px solid ${color}25` }}
    >
      {Icon && <Icon size={16} style={{ color, marginBottom: 8 }} />}
      <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>{label}</p>
      <p className="text-sm font-bold capitalize" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>
        {value || '—'}
      </p>
    </div>
  );
}

/* ─── Main Fusion Page ─── */
export default function FusionPage({ token, onUnauth }) {
  // Text state
  const [text, setText] = useState('');
  // Voice state
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  // PHQ-9 state
  const [answers, setAnswers] = useState(Array(9).fill(null));
  // Fusion state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [textResult, setTextResult] = useState(null);
  const [voiceResult, setVoiceResult] = useState(null);
  const [phqResult, setPhqResult] = useState(null);
  // History
  const [history, setHistory] = useState([]);

  const phqComplete = !answers.includes(null);
  const phqScore = answers.reduce((s, x) => s + (x ?? 0), 0);
  const phqSeverity = phqScore < 5 ? 'Minimal' : phqScore < 10 ? 'Mild' : phqScore < 15 ? 'Moderate' : phqScore < 20 ? 'Moderately Severe' : 'Severe';

  // Load history
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/reports/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(rows => { if (Array.isArray(rows)) setHistory(rows.filter(r => r.report_type === 'fusion').slice(0, 5)); })
      .catch(() => {});
  }, [token, report]);

  /* ─── File handling ─── */
  const chooseFile = (f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['wav', 'mp3', 'm4a', 'webm', 'ogg'].includes(ext)) {
      setError('Please choose a WAV, MP3, M4A, or WebM audio file.');
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setError('');
  };

  /* ─── Live recording ─── */
  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      clearInterval(timerRef.current);
      setRecording(false);
      setRecordingTime(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chooseFile(new File([blob], `voice-recording.${recordingExtension(mimeType)}`, { type: mimeType }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone permission and try again.');
    }
  };

  const clearVoice = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl('');
  };

  /* ─── Run Fusion ─── */
  const run = async () => {
    if (!phqComplete) { setError('Please answer all 9 PHQ-9 questions before running.'); return; }
    setBusy(true);
    setError('');
    setReport(null);
    setTextResult(null);
    setVoiceResult(null);
    setPhqResult(null);
    try {
      // Step 1: Text analysis
      let tRes = null;
      if (text.trim()) {
        tRes = await call('/text/analyze', token, { body: { text } });
        setTextResult(tRes);
      }

      // Step 2: Voice analysis (if file present)
      let vRes = null;
      if (file) {
        const fd = new FormData();
        fd.append('audio', file);
        vRes = await call('/voice/analyze', token, { form: fd });
        setVoiceResult(vRes);
      }

      // Step 3: PHQ-9
      const pRes = await call('/phq9/analyze', token, { body: { answers } });
      setPhqResult(pRes);

      // Step 4: Fusion
      const fusionBody = {
        text: text || 'No text provided',
        phq_answers: answers,
        ...(vRes ? { voice_emotion: vRes.emotion, voice_confidence: vRes.confidence / 100 } : {}),
      };
      const fusionResult = await call('/fusion/analyze', token, { body: fusionBody });
      setReport({ ...fusionResult, textResult: tRes, voiceResult: vRes, phqResult: pRes });
    } catch (e) {
      if (e.status === 401) onUnauth?.();
      else setError(e.message || 'Analysis failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setText('');
    setAnswers(Array(9).fill(null));
    clearVoice();
    setReport(null);
    setTextResult(null);
    setVoiceResult(null);
    setPhqResult(null);
    setError('');
  };

  const suicideRisk = typeof report?.suicide_risk === 'object'
    ? report.suicide_risk?.risk_level
    : report?.suicide_risk;

  return (
    <div
      className="min-h-screen neural-grid-bg"
      style={{ padding: 'clamp(16px, 3vw, 32px)', background: 'rgba(2,4,14,0.5)' }}
    >
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #8b5cf6, #3b82f6)' }} />
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
            Multi-modal AI Analysis
          </p>
        </div>
        <p className="text-sm" style={{ color: '#64748b' }}>
          Integrate Text · Voice · PHQ-9 — for a deeper, smarter analysis
        </p>
      </div>

      {/* Top text input */}
      <div className="glass-card rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FiActivity size={14} style={{ color: '#a78bfa' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#a78bfa' }}>
            Text Intelligence
          </span>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe how you are feeling today… (optional — PHQ-9 is required)"
          maxLength={5000}
          className="w-full rounded-xl outline-none resize-none text-sm"
          style={{
            minHeight: 100,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 14px',
            color: '#e2e8f0',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs" style={{ color: '#475569' }}>{text.length}/5000</span>
          {text && (
            <button onClick={() => setText('')} className="text-xs" style={{ color: '#a78bfa', background: 'none', border: 'none', padding: '2px 0' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Three Module Cards */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

        {/* Text Analysis Module */}
        <ModuleCard
          title="Text Analysis"
          icon={FiActivity}
          iconColor="#a78bfa"
          badge={text.trim() ? 'Ready' : 'Optional'}
          badgeColor={text.trim() ? 'green' : 'neutral'}
          connected={!!textResult}
        >
          <p className="text-xs mb-3" style={{ color: '#64748b' }}>
            GoEmotions model analyzes written text for emotional content and safety signals.
          </p>
          {textResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl mt-2"
              style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              <p className="text-xs font-semibold capitalize mb-1" style={{ color: '#c4b5fd' }}>
                {textResult.emotion}
              </p>
              <p className="text-xs" style={{ color: '#64748b' }}>{Math.round(textResult.confidence)}% confidence</p>
            </motion.div>
          )}
          {!textResult && (
            <div className="text-center py-4">
              <FiActivity size={22} style={{ color: '#334155', margin: '0 auto 6px' }} />
              <p className="text-xs" style={{ color: '#475569' }}>Result appears after running fusion</p>
            </div>
          )}
        </ModuleCard>

        {/* Voice Analysis Module */}
        <ModuleCard
          title="Voice Analysis"
          icon={FiMic}
          iconColor="#34d399"
          badge={file ? 'Audio Ready' : 'Optional'}
          badgeColor={file ? 'green' : 'neutral'}
          connected={!!voiceResult}
        >
          <p className="text-xs mb-3" style={{ color: '#64748b' }}>
            CREMA-D model detects emotion from voice recordings.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); chooseFile(e.dataTransfer.files[0]); }}
            className="rounded-xl flex flex-col items-center justify-center gap-2 py-4 transition-all"
            style={{
              border: `1.5px dashed ${drag ? 'rgba(52,211,153,0.6)' : file ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}`,
              background: drag ? 'rgba(52,211,153,0.05)' : file ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
            }}
          >
            <FiUploadCloud size={22} style={{ color: file ? '#34d399' : '#475569' }} />
            <p className="text-xs font-medium" style={{ color: file ? '#34d399' : '#64748b' }}>
              {file ? file.name : 'Drop audio file here'}
            </p>
            <label className="text-xs px-3 py-1 rounded-lg cursor-pointer transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              Browse file
              <input type="file" accept=".wav,.mp3,.m4a,.webm,audio/*" className="hidden"
                onChange={e => chooseFile(e.target.files[0])} />
            </label>
          </div>

          {/* Recording controls */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={toggleRecord}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium flex-1 justify-center transition-all"
              style={{
                background: recording ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.1)',
                border: `1px solid ${recording ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.25)'}`,
                color: recording ? '#f87171' : '#34d399',
                animation: recording ? 'recordingPulse 1.5s ease-in-out infinite' : 'none',
              }}
            >
              {recording ? <><FiSquare size={13} /> Stop ({recordingTime}s)</> : <><FiMic size={13} /> Live Record</>}
            </button>
            {file && (
              <button
                onClick={clearVoice}
                className="p-2 rounded-xl transition-all"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
                title="Remove audio"
              >
                <FiTrash2 size={14} />
              </button>
            )}
          </div>

          {/* Waveform + audio player */}
          {recording && <RecordingWave />}
          {audioUrl && !recording && (
            <audio controls src={audioUrl} className="w-full mt-2" style={{ height: 32, borderRadius: 8 }} />
          )}

          {/* Voice result */}
          {voiceResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl mt-2"
              style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}
            >
              <p className="text-xs font-semibold capitalize mb-1" style={{ color: '#6ee7b7' }}>{voiceResult.emotion}</p>
              <p className="text-xs" style={{ color: '#64748b' }}>{Math.round(voiceResult.confidence)}% confidence · {voiceResult.processing_time_ms}ms</p>
            </motion.div>
          )}
        </ModuleCard>

        {/* PHQ-9 Module */}
        <ModuleCard
          title="PHQ-9 Assessment"
          icon={FiBarChart2}
          iconColor="#fb923c"
          badge={phqComplete ? `Score: ${phqScore}/27` : `${answers.filter(a => a !== null).length}/9 done`}
          badgeColor={phqComplete ? 'green' : 'neutral'}
          connected={!!phqResult}
        >
          <p className="text-xs mb-3" style={{ color: '#64748b' }}>
            Standardized depression screening. Answer all 9 questions.
          </p>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {PHQ_QUESTIONS.map((q, i) => (
              <div key={i} className="pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-medium mb-2 leading-relaxed" style={{ color: '#e2e8f0' }}>
                  <span style={{ color: '#fb923c', marginRight: 4 }}>{i + 1}.</span>{q}
                </p>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {PHQ_OPTIONS.map((opt, n) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers(prev => prev.map((v, j) => j === i ? n : v))}
                      className={`phq-option ${answers[i] === n ? 'selected' : ''}`}
                    >
                      <span className="block">{opt}</span>
                      <span className="block text-center font-bold mt-0.5" style={{ fontSize: 9, color: '#64748b' }}>{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* PHQ score ring */}
          <div className="flex items-center gap-4 mt-4 p-3 rounded-xl"
            style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
            <CircularProgress
              value={phqComplete ? (phqScore / 27) * 100 : 0}
              size={60}
              color="#fb923c"
              trackColor="rgba(251,146,60,0.15)"
            />
            <div>
              <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#64748b' }}>PHQ-9 Score</p>
              <p className="text-sm font-bold" style={{ color: '#fed7aa', fontFamily: 'Space Grotesk' }}>
                {phqComplete ? `${phqScore}/27 — ${phqSeverity}` : 'Complete all questions'}
              </p>
            </div>
          </div>

          {phqResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-3 rounded-xl mt-2"
              style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }}
            >
              <p className="text-xs font-semibold" style={{ color: '#fed7aa' }}>
                {phqResult.severity} — {phqResult.total_score}/27
              </p>
            </motion.div>
          )}
        </ModuleCard>
      </div>

      {/* Pipeline Visualization */}
      {(report || busy || textResult || voiceResult || phqResult) && (
        <div className="mb-5">
          <FusionPipeline
            textResult={textResult}
            voiceResult={voiceResult}
            phqResult={phqResult}
            fusionResult={report}
            busy={busy}
          />
        </div>
      )}

      {/* Run Button + Error */}
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          onClick={run}
          disabled={!phqComplete || busy}
          className="glow-btn flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm"
          whileHover={{ scale: phqComplete && !busy ? 1.01 : 1 }}
          whileTap={{ scale: phqComplete && !busy ? 0.99 : 1 }}
          style={{ fontSize: 15, letterSpacing: 0.3 }}
        >
          <FiCpu size={18} />
          {busy ? 'NeuroAI is thinking…' : 'Run Fusion Analysis'}
          {!busy && <FiChevronRight size={16} />}
        </motion.button>

        {(report || textResult) && (
          <button
            onClick={resetAll}
            className="flex items-center gap-2 px-4 py-4 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8',
            }}
          >
            <FiRefreshCw size={15} />
            <span className="hidden sm:block">Clear All</span>
          </button>
        )}
      </div>

      {!phqComplete && (
        <p className="text-xs mb-4 text-center" style={{ color: '#64748b' }}>
          ⓘ Complete all 9 PHQ-9 questions to enable Fusion Analysis
        </p>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl mb-5"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <FiAlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1" style={{ color: '#f87171' }}>Analysis Error</p>
              <p className="text-xs" style={{ color: 'rgba(248,113,113,0.8)' }}>{error}</p>
            </div>
            <button onClick={run} disabled={busy || !phqComplete}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
              <FiRefreshCw size={12} /> Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="glass-card rounded-2xl p-8 mb-5 text-center"
          >
            <motion.div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}
              animate={{ boxShadow: ['0 0 10px rgba(139,92,246,0.2)', '0 0 30px rgba(139,92,246,0.5)', '0 0 10px rgba(139,92,246,0.2)'] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                <FiCpu size={28} style={{ color: '#a78bfa' }} />
              </motion.div>
            </motion.div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#a78bfa' }}>ANALYZING MULTI-MODAL SIGNALS</p>
            <h3 className="text-xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk', color: '#f1f5f9' }}>
              NeuroAI is thinking…
            </h3>
            <p className="text-sm" style={{ color: '#64748b' }}>Text · Voice · PHQ-9 · Safety intelligence</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fusion Result */}
      <AnimatePresence>
        {report && !busy && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-4"
          >
            {/* Result header */}
            <div
              className="glass-card rounded-2xl p-6 relative overflow-hidden"
              style={{ border: '1px solid rgba(139,92,246,0.25)' }}
            >
              <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(139,92,246,0.3), transparent 70%)' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <FiZap size={14} style={{ color: '#a78bfa' }} />
                  <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a78bfa' }}>
                    LIVE AI FUSION REPORT
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-1 capitalize" style={{ fontFamily: 'Space Grotesk', color: '#f1f5f9', letterSpacing: -1 }}>
                  {report.overall_emotion || report.emotion || 'Analysis Complete'}
                </h2>
                <p className="text-sm" style={{ color: '#64748b' }}>
                  Fused from {[textResult && 'Text', voiceResult && 'Voice', 'PHQ-9'].filter(Boolean).join(' · ')} signals
                </p>
              </div>
            </div>

            {/* Result cards grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
              <ResultCard label="Overall State" value={report.stress_level} color="#f59e0b" icon={FiZap} />
              <ResultCard label="Primary Emotion" value={report.overall_emotion} color="#8b5cf6" icon={FiActivity} />
              <ResultCard label="Voice Emotion" value={report.voice_emotion || 'Not provided'} color="#34d399" icon={FiMic} />
              <ResultCard label="Suicide Risk" value={suicideRisk} color={suicideRisk === 'High' ? '#ef4444' : '#10b981'} icon={FiShield} />
              <ResultCard label="PHQ Severity" value={report.phq_severity} color="#fb923c" icon={FiBarChart2} />
              <ResultCard label="Confidence" value={`${Math.round(report.overall_confidence)}%`} color="#60a5fa" icon={FiLayers} />
            </div>

            {/* Confidence circles */}
            <div
              className="glass-card rounded-2xl p-5"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>
                Confidence Indicators
              </h3>
              <div className="flex items-start gap-6 flex-wrap">
                <CircularProgress
                  value={report.overall_confidence || 0}
                  color="#8b5cf6"
                  label="Overall"
                  sublabel="Fusion confidence"
                />
                <CircularProgress
                  value={textResult?.confidence || 0}
                  color="#a78bfa"
                  label="Text"
                  sublabel="GoEmotions"
                />
                {voiceResult && (
                  <CircularProgress
                    value={voiceResult.confidence || 0}
                    color="#34d399"
                    label="Voice"
                    sublabel="CREMA-D"
                  />
                )}
                <CircularProgress
                  value={report.stress_level === 'High' ? 85 : report.stress_level === 'Medium' ? 55 : 25}
                  color="#f59e0b"
                  label="Stress"
                  sublabel="Signal level"
                />
              </div>
            </div>

            {/* Explainability */}
            {report.explainability?.contributions?.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>
                  Explainable AI — Agent Contributions
                </h3>
                <div className="space-y-4">
                  {report.explainability.contributions.map((c, i) => (
                    <motion.div
                      key={c.agent}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium capitalize" style={{ color: '#e2e8f0' }}>
                          {c.agent.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-bold" style={{ color: '#a78bfa' }}>{c.weight_percent}%</span>
                      </div>
                      <div className="contrib-bar">
                        <motion.div
                          className="contrib-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${c.weight_percent}%` }}
                          transition={{ duration: 1, delay: i * 0.1, ease: 'easeOut' }}
                        />
                      </div>
                      {c.reason && (
                        <p className="text-xs mt-1" style={{ color: '#475569' }}>{c.reason}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations?.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>
                  AI Recommendations
                </h3>
                <div className="space-y-3">
                  {report.recommendations.map((rec, i) => {
                    const isUrgent = rec.priority === 'urgent';
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="p-4 rounded-xl"
                        style={{
                          background: isUrgent ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                          borderLeft: `3px solid ${isUrgent ? '#ef4444' : '#8b5cf6'}`,
                        }}
                      >
                        {isUrgent && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <FiAlertTriangle size={11} style={{ color: '#f87171' }} />
                            <span className="text-xs font-semibold" style={{ color: '#f87171' }}>URGENT</span>
                          </div>
                        )}
                        <p className="text-xs font-semibold mb-1" style={{ color: '#f1f5f9' }}>{rec.title}</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#64748b' }}>{rec.message}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Analyses History */}
      {history.length > 0 && (
        <div className="glass-card rounded-2xl p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>
              Recent Fusion Analyses
            </h3>
            <FiClock size={14} style={{ color: '#64748b' }} />
          </div>
          <div className="space-y-2">
            {history.map((row, i) => {
              const r = row.result || {};
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10b981' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium capitalize truncate" style={{ color: '#e2e8f0' }}>
                      {r.overall_emotion || r.emotion || 'Fusion Analysis'}
                    </p>
                    <p className="text-xs" style={{ color: '#475569' }}>
                      {r.stress_level || ''} {r.phq_severity ? `· PHQ: ${r.phq_severity}` : ''}
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>
                    {timeAgo(row.created_at)}
                  </span>
                  <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#a78bfa' }}>
                    {r.overall_confidence ? `${Math.round(r.overall_confidence)}%` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
