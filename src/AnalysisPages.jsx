import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertCircle, FiMic, FiUploadCloud, FiSquare,
  FiTrash2, FiActivity, FiBarChart2, FiShield, FiCheck, FiVolume2
} from 'react-icons/fi';
import { API } from './api.js';
import CircularProgress from './components/CircularProgress.jsx';

async function call(path, t, { body, form } = {}) {
  const h = { Authorization: `Bearer ${t}` };
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(API + path, {
    method: 'POST', headers: h,
    body: body ? JSON.stringify(body) : form,
  });
  const d = await r.json().catch(() => ({ detail: 'Invalid response' }));
  if (!r.ok) throw new Error(d.detail || 'Request failed');
  return d;
}

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

// The backend rejects clips under 0.6s, but accuracy needs real prosody, so the
// UI nudges the user toward a longer, more useful recording.
const MIN_RECORD_SECONDS = 3;


/* ─── Shared wrappers ─── */
function PageCard({ children, className = '' }) {
  return (
    <div className={`glass-card rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

function ErrBox({ e }) {
  if (!e) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl mt-4"
      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      <FiAlertCircle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
      <p className="text-xs" style={{ color: '#fca5a5' }}>{e}</p>
    </motion.div>
  );
}

function EmotionBar({ emotion, confidence }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs capitalize w-20 flex-shrink-0" style={{ color: '#94a3b8' }}>{emotion}</p>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${confidence}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
        />
      </div>
      <p className="text-xs w-10 text-right flex-shrink-0" style={{ color: '#64748b' }}>{confidence.toFixed(0)}%</p>
    </div>
  );
}

/* ─── TEXT PAGE ─── */
export function TextPage({ token }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const r = await call('/text/analyze', token, { body: { text } });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', alignItems: 'start' }}>
      {/* Input */}
      <PageCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <FiActivity size={17} style={{ color: '#a78bfa' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>Text Emotion Analysis</h3>
            <p className="text-xs" style={{ color: '#64748b' }}>Powered by GoEmotions + safety model</p>
          </div>
        </div>

        <label className="input">
          <span>Describe how you are feeling</span>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write what is on your mind…"
            rows={6}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#e2e8f0',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(139,92,246,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
        </label>
        <div className="flex items-center justify-between mt-1 mb-3">
          <span className="text-xs" style={{ color: '#475569' }}>{text.length} characters</span>
          {text && <button onClick={() => { setText(''); setResult(null); }} className="text-xs" style={{ color: '#a78bfa', background: 'none', border: 'none' }}>Clear</button>}
        </div>

        <button
          className="primary"
          disabled={!text.trim() || loading}
          onClick={analyze}
        >
          {loading ? 'Analyzing…' : 'Analyze Text'}
        </button>
        <ErrBox e={error} />
      </PageCard>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
          >
            <PageCard>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#a78bfa' }}>GOEM0TIONS + SAFETY</p>
              <h2 className="text-3xl font-bold mb-1 capitalize" style={{ fontFamily: 'Space Grotesk', color: '#f1f5f9', letterSpacing: -1 }}>
                {result.emotion}
              </h2>
              <p className="text-sm mb-4" style={{ color: '#8b5cf6' }}>{result.confidence.toFixed(1)}% confidence</p>

              {/* Safety risk */}
              <div className="p-3 rounded-xl mb-4"
                style={{
                  background: result.suicide_risk?.risk_level === 'High' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  border: `1px solid ${result.suicide_risk?.risk_level === 'High' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                }}>
                <div className="flex items-center gap-2">
                  <FiShield size={14} style={{ color: result.suicide_risk?.risk_level === 'High' ? '#f87171' : '#34d399' }} />
                  <p className="text-xs font-semibold" style={{ color: '#f1f5f9' }}>Safety Status</p>
                </div>
                <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                  {result.suicide_risk?.risk_level || 'Low'} risk · {result.suicide_risk?.confidence?.toFixed(0) || 0}% confidence
                </p>
              </div>

              {/* Top emotions */}
              {result.top_emotions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748b' }}>Emotion Breakdown</p>
                  <div className="space-y-2.5">
                    {result.top_emotions.slice(0, 6).map(e => (
                      <EmotionBar key={e.emotion} emotion={e.emotion} confidence={e.confidence} />
                    ))}
                  </div>
                </div>
              )}
            </PageCard>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PageCard>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <FiActivity size={24} style={{ color: '#475569' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: '#64748b' }}>Ready for analysis</p>
                <p className="text-xs" style={{ color: '#475569' }}>Enter text and click Analyze to receive a real model prediction.</p>
              </div>
            </PageCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Waveform bars ─── */
function WaveformBars({ bars = 20 }) {
  return (
    <div className="flex items-center justify-center gap-0.5" style={{ height: 36 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            animationDelay: `${i * 0.06}s`,
            animationDuration: `${0.5 + Math.random() * 0.5}s`,
          }}
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

async function blobToWav(blob, targetRate = 22050) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioCtx();
  let audioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioContext.close();
  }

  // Downmix to mono, then resample to the sample rate the CREMA-D model expects.
  const frames = Math.max(1, Math.round(audioBuffer.duration * targetRate));
  const offline = new OfflineAudioContext(1, frames, targetRate);
  const source = offline.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/* ─── VOICE PAGE ─── */
export function VoicePage({ token }) {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recordingTimerRef = useRef(null);

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
    setResult(null);
  };

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setFile(null);
    setAudioUrl('');
    setResult(null);
  };

  /* Live recording */
  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      clearInterval(timerRef.current);
      setRecording(false);
      return;
    }
    try {
      // Ask for an unprocessed mono stream at the model's native rate. Without
      // these constraints browsers hand back a processed 48 kHz stereo stream
      // that the CREMA-D feature extractor was never calibrated for.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const levels = new Uint8Array(analyser.fftSize);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setLevel(0);
        try { await ctx.close(); } catch { /* context already closed */ }
        const mimeType = recorder.mimeType || 'audio/webm';
        const rawBlob = new Blob(chunksRef.current, { type: mimeType });
        if (rawBlob.size < 1000) {
          setError('Recording was empty. Check your microphone permission and input level, then try again.');
          setRecording(false);
          setRecordingTime(0);
          return;
        }
        try {
          const wavBlob = await blobToWav(rawBlob);
          const wavFile = new File([wavBlob], 'live-recording.wav', { type: 'audio/wav' });
          chooseFile(wavFile);
          const seconds = Math.max(1, Math.round(wavBlob.size / (2 * 22050)));
          if (seconds < MIN_RECORD_SECONDS) {
            setError(`Recording was only ${seconds}s. Speak for at least ${MIN_RECORD_SECONDS} seconds so the model has enough audio to work with.`);
          }
        } catch (wavErr) {
          setError('Failed to process live recording. Please try again or upload an audio file.');
        }
        setRecording(false);
        setRecordingTime(0);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingTime(0);
      setError('');
      // Poll the live input level so the user can see the mic is actually picking
      // up their voice; a silent bar here is the usual cause of a bad result.
      timerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(levels);
        let peak = 0;
        for (let i = 0; i < levels.length; i++) peak = Math.max(peak, Math.abs(levels[i] - 128));
        setLevel(Math.min(100, (peak / 128) * 100));
      }, 100);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone permission in your browser and try again.');
    }
  };

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(recordingTimerRef.current);
    recorderRef.current?.stream?.getTracks().forEach(t => t.stop());
  }, []);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('audio', file);
      const r = await call('/voice/analyze', token, { form: fd });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', alignItems: 'start' }}>
      {/* Input */}
      <PageCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <FiMic size={17} style={{ color: '#34d399' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>Voice Emotion Analysis</h3>
            <p className="text-xs" style={{ color: '#64748b' }}>CREMA-D audio classification model</p>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); chooseFile(e.dataTransfer.files[0]); }}
          className="rounded-xl flex flex-col items-center justify-center gap-3 py-8 transition-all mb-4"
          style={{
            border: `2px dashed ${drag ? 'rgba(52,211,153,0.6)' : file ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.12)'}`,
            background: drag ? 'rgba(52,211,153,0.06)' : file ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
          }}
        >
          <FiUploadCloud size={28} style={{ color: file ? '#34d399' : '#475569' }} />
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: file ? '#34d399' : '#94a3b8' }}>
              {file ? file.name : 'Drop your audio file here'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>WAV · MP3 · M4A · WebM</p>
          </div>
          <label className="px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' }}>
            Browse file
            <input type="file" accept="audio/*,.wav,.mp3,.m4a,.webm" className="hidden"
              onChange={e => chooseFile(e.target.files?.[0])} />
          </label>
        </div>

        {/* Live record + clear row */}
        <div className="flex items-center gap-3 mb-4">
          {/* Live record button */}
          <motion.button
            onClick={toggleRecord}
            whileTap={{ scale: 0.97 }}
            className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: recording
                ? 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.1))'
                : 'rgba(52,211,153,0.1)',
              border: `1.5px solid ${recording ? 'rgba(239,68,68,0.4)' : 'rgba(52,211,153,0.3)'}`,
              color: recording ? '#f87171' : '#34d399',
              boxShadow: recording ? '0 0 15px rgba(239,68,68,0.2)' : '0 0 10px rgba(52,211,153,0.1)',
            }}
          >
            {recording ? (
              <>
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <FiSquare size={16} />
                </motion.div>
                <span>Stop Recording ({recordingTime}s)</span>
              </>
            ) : (
              <>
                <FiMic size={16} />
                <span>Live Record</span>
              </>
            )}
          </motion.button>

          {file && (
            <button
              onClick={clearAudio}
              className="p-3 rounded-xl transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              title="Remove audio"
            >
              <FiTrash2 size={16} />
            </button>
          )}
        </div>

        {/* Live waveform */}
        <AnimatePresence>
          {recording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-xs font-medium mb-2 text-center" style={{ color: '#f87171' }}>
                  Recording — {recordingTime}s {recordingTime < MIN_RECORD_SECONDS && `(keep going, ${MIN_RECORD_SECONDS - recordingTime}s more)`}
                </p>

                {/* Live input level, so a silent microphone is visible immediately */}
                <div className="flex items-center gap-2 mb-2">
                  <FiVolume2 size={14} style={{ color: level > 4 ? '#34d399' : '#64748b', flexShrink: 0 }} />
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      style={{
                        width: `${level}%`,
                        height: '100%',
                        background: level < 4
                          ? 'linear-gradient(90deg, #f87171, #fb923c)'
                          : 'linear-gradient(90deg, #34d399, #22d3ee)',
                        transition: 'width 0.1s linear',
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums" style={{ color: level < 4 ? '#f87171' : '#34d399', minWidth: 62, textAlign: 'right' }}>
                    {level < 4 ? 'No voice' : 'Hearing you'}
                  </span>
                </div>

                <WaveformBars />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audio player */}
        {audioUrl && !recording && (
          <div className="mb-4">
            <p className="text-xs mb-1.5" style={{ color: '#64748b' }}>Preview</p>
            <audio
              controls
              src={audioUrl}
              className="w-full"
              style={{ height: 36, borderRadius: 8 }}
            />
          </div>
        )}

        <button
          className="primary"
          disabled={!file || loading}
          onClick={analyze}
        >
          <FiMic size={16} />
          {loading ? 'Analyzing voice…' : 'Analyze Voice'}
        </button>
        <ErrBox e={error} />
      </PageCard>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <PageCard>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#34d399' }}>CREMA-D MODEL</p>
              <h2 className="text-3xl font-bold mb-1 capitalize" style={{ fontFamily: 'Space Grotesk', color: '#f1f5f9', letterSpacing: -1 }}>
                {result.emotion}
              </h2>
              <p className="text-sm mb-6" style={{ color: '#34d399' }}>{Number(result.confidence || 0).toFixed(1)}% confidence</p>

              {/* Circular progress */}
              <div className="flex items-center gap-6 mb-6">
                <CircularProgress
                  value={Number(result.confidence || 0)}
                  color="#34d399"
                  size={90}
                  label="Confidence"
                  sublabel="CREMA-D"
                />
                <div>
                  <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#64748b' }}>Processing time</p>
                  <p className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk', color: '#f1f5f9' }}>
                    {result.processing_time_ms}ms
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#64748b' }}>Real-time inference</p>
                </div>
              </div>

              {result.top_emotions?.length > 1 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#64748b' }}>Emotion Breakdown</p>
                  <div className="space-y-2.5">
                    {result.top_emotions.map(e => (
                      <EmotionBar key={e.emotion} emotion={e.emotion} confidence={e.confidence} />
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <div className="flex items-center gap-2">
                  <FiCheck size={14} style={{ color: '#34d399' }} />
                  <p className="text-xs font-medium" style={{ color: '#6ee7b7' }}>Analysis complete</p>
                </div>
                <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                  Audio classified using the CREMA-D trained model. Run Fusion for a holistic report.
                </p>
              </div>

              {result.low_confidence && (
                <div className="p-3 rounded-xl mt-3"
                  style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <FiAlertCircle size={14} style={{ color: '#fb923c' }} />
                    <p className="text-xs font-medium" style={{ color: '#fdba74' }}>Low confidence result</p>
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                    The model was not confident about this clip. Speak clearly for about
                    {' '}{MIN_RECORD_SECONDS}–5 seconds, closer to the microphone, in a quiet
                    room, then analyse again. This recording is not a reliable read of your mood.
                  </p>
                </div>
              )}

              {result.duration_seconds != null && (
                <p className="text-xs mt-3" style={{ color: '#475569' }}>
                  Analysed {result.duration_seconds}s of audio
                  {result.voiced_ratio != null && ` · ${Math.round(result.voiced_ratio * 100)}% voiced`}
                </p>
              )}
            </PageCard>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <PageCard>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <FiUploadCloud size={24} style={{ color: '#475569' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: '#64748b' }}>Ready for voice analysis</p>
                <p className="text-xs" style={{ color: '#475569' }}>
                  Upload an audio file or use Live Record to capture your voice. The CREMA-D model will detect your emotion.
                </p>
              </div>
            </PageCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── PHQ-9 PAGE ─── */
export function PhqPage({ token }) {
  const [answers, setAnswers] = useState(Array(9).fill(null));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const complete = !answers.includes(null);
  const score = answers.reduce((s, x) => s + (x ?? 0), 0);
  const severity = score < 5 ? 'Minimal' : score < 10 ? 'Mild' : score < 15 ? 'Moderate' : score < 20 ? 'Moderately Severe' : 'Severe';

  const severityColor = {
    Minimal: '#10b981', Mild: '#34d399',
    Moderate: '#f59e0b', 'Moderately Severe': '#f97316', Severe: '#ef4444',
  }[result?.severity || severity] || '#64748b';

  const analyze = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await call('/phq9/analyze', token, { body: { answers } });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setAnswers(Array(9).fill(null)); setResult(null); };

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', alignItems: 'start' }}>
      <PageCard>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.25)' }}>
            <FiBarChart2 size={17} style={{ color: '#fb923c' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9', fontFamily: 'Space Grotesk' }}>PHQ-9 Assessment</h3>
            <p className="text-xs" style={{ color: '#64748b' }}>Patient Health Questionnaire — 9 questions</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}>
              {answers.filter(a => a !== null).length}/9 answered
            </span>
          </div>
        </div>

        <div className="space-y-5">
          {PHQ_QUESTIONS.map((q, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="pb-5"
              style={{ borderBottom: i < 8 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              <div className="flex items-start gap-2 mb-3">
                <span
                  className="text-xs font-bold flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: answers[i] !== null ? 'rgba(251,146,60,0.2)' : 'rgba(255,255,255,0.06)',
                    color: answers[i] !== null ? '#fb923c' : '#475569',
                    fontSize: 10,
                  }}
                >
                  {answers[i] !== null ? <FiCheck size={10} /> : i + 1}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: '#e2e8f0' }}>{q}</p>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', paddingLeft: 28 }}>
                {PHQ_OPTIONS.map((opt, n) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers(prev => prev.map((v, j) => j === i ? n : v))}
                    className={`phq-option ${answers[i] === n ? 'selected' : ''}`}
                  >
                    <span className="block text-xs leading-tight">{opt}</span>
                    <span className="block text-center font-bold mt-1" style={{ fontSize: 10, color: answers[i] === n ? '#a78bfa' : '#64748b' }}>
                      {n}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Live score */}
        <div className="flex items-center justify-between mt-5 p-4 rounded-xl"
          style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.15)' }}>
          <div>
            <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#64748b' }}>Live Score</p>
            <p className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk', color: '#fed7aa' }}>
              {score}/27
            </p>
            <p className="text-xs" style={{ color: severityColor }}>{complete ? severity : 'Answer all to calculate'}</p>
          </div>
          <CircularProgress
            value={complete ? (score / 27) * 100 : (answers.filter(a => a !== null).length / 9) * 100}
            color="#fb923c"
            size={70}
            trackColor="rgba(251,146,60,0.15)"
          />
        </div>

        <div className="flex gap-3 mt-4">
          <button className="primary flex-1" disabled={!complete || loading} onClick={analyze}>
            {loading ? 'Calculating…' : 'Calculate PHQ-9 Score'}
          </button>
          <button onClick={reset} className="px-4 py-2 rounded-xl text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
            Reset
          </button>
        </div>
        <ErrBox e={error} />
      </PageCard>

      {/* Result */}
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <PageCard>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: severityColor }}>PHQ-9 RESULT</p>
              <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk', color: '#f1f5f9', letterSpacing: -1 }}>
                {result.severity}
              </h2>
              <p className="text-sm mb-6" style={{ color: '#64748b' }}>Score: {result.total_score}/27</p>

              <div className="flex justify-center mb-6">
                <CircularProgress
                  value={(result.total_score / 27) * 100}
                  color={severityColor}
                  size={110}
                  label={result.severity}
                  sublabel={`${result.total_score}/27 points`}
                />
              </div>

              <div className="space-y-2">
                {[
                  ['Minimal', '0–4'],
                  ['Mild', '5–9'],
                  ['Moderate', '10–14'],
                  ['Moderately Severe', '15–19'],
                  ['Severe', '20–27'],
                ].map(([label, range]) => (
                  <div key={label} className="flex items-center justify-between p-2.5 rounded-lg"
                    style={{
                      background: result.severity === label ? `${severityColor}15` : 'transparent',
                      border: `1px solid ${result.severity === label ? `${severityColor}30` : 'rgba(255,255,255,0.05)'}`,
                    }}>
                    <span className="text-xs font-medium" style={{ color: result.severity === label ? severityColor : '#64748b' }}>
                      {label}
                    </span>
                    <span className="text-xs" style={{ color: '#475569' }}>{range}</span>
                    {result.severity === label && <FiCheck size={12} style={{ color: severityColor }} />}
                  </div>
                ))}
              </div>
            </PageCard>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <PageCard>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.15)' }}>
                  <FiBarChart2 size={24} style={{ color: '#475569' }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: '#64748b' }}>Answer all 9 questions</p>
                <p className="text-xs" style={{ color: '#475569' }}>
                  Complete the questionnaire to calculate your PHQ-9 score and depression severity level.
                </p>
              </div>
            </PageCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
