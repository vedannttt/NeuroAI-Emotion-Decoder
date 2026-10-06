import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiUser, FiCheck, FiX, FiShield, FiLock, FiEye, FiEyeOff, FiFileText, FiCalendar } from 'react-icons/fi';
import FusionPage from './FusionPage.jsx';
import { TextPage, VoicePage, PhqPage } from './AnalysisPages.jsx';
import { API } from './api.js';
import DoctorDashboard from './DoctorDashboard.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import MetricCard from './components/MetricCard.jsx';
import EmotionDonut from './components/EmotionDonut.jsx';
import TrendChart from './components/TrendChart.jsx';
import StressTimeline from './components/StressTimeline.jsx';
import WeeklyHeatmap from './components/WeeklyHeatmap.jsx';
import RadarEmotionChart from './components/RadarEmotionChart.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import RecentTable from './components/RecentTable.jsx';
import QuickActions from './components/QuickActions.jsx';
import Particles from './components/Particles.jsx';
import {
  FiActivity, FiMic, FiBarChart2, FiLayers, FiTrendingUp
} from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import './styles/globals.css';
import { C, useC } from './context.jsx';

async function req(path, t) {
  try {
    const r = await fetch(API + path, { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json().catch(() => ({ detail: 'Invalid JSON response' }));
    if (!r.ok) throw new Error(d.detail || 'Request failed');
    return d;
  } catch (err) {
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      throw new Error('Unable to connect to server');
    }
    throw err;
  }
}

/* ─── Context Provider ─── */
function Provider({ children }) {
  const [t, setT] = useState(() => {
    const saved = localStorage.getItem('neuroai_access');
    return saved && saved !== 'undefined' && saved !== 'null' ? saved : null;
  });
  const [p, setP] = useState(null);
  const [l, setL] = useState(!!t);
  const [theme, setTheme] = useState(() => localStorage.getItem('neuroai_theme') || 'dark');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('neuroai_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const out = () => {
    localStorage.removeItem('neuroai_access');
    localStorage.removeItem('neuroai_refresh');
    setT(null); setP(null); setL(false);
  };

  useEffect(() => {
    if (!t) { setL(false); return; }
    setL(true);
    req('/auth/me', t).then(setP).catch(out).finally(() => setL(false));
  }, [t]);

  const updateProfile = async (newName) => {
    if (!newName.trim()) throw new Error('Account name cannot be empty');
    const r = await fetch(API + '/auth/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${t}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ full_name: newName.trim() })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.detail || 'Failed to update account name');
    setP(d);
    return d;
  };

  const login = async (path, b) => {
    try {
      const r = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      });
      const d = await r.json().catch(() => ({ detail: 'Invalid response from server' }));
      if (!r.ok) throw new Error(d.detail || 'Authentication failed');
      localStorage.setItem('neuroai_access', d.access_token);
      if (d.refresh_token) localStorage.setItem('neuroai_refresh', d.refresh_token);
      setT(d.access_token);
    } catch (err) {
      if (err.name === 'TypeError' || err.message.includes('fetch')) {
        throw new Error('Unable to connect to backend server. Please verify backend is running on http://127.0.0.1:8000');
      }
      throw err;
    }
  };

  return (
    <C.Provider value={{ t, p, l, theme, toggleTheme, updateProfile, out, login, settingsOpen, setSettingsOpen }}>
      {children}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </C.Provider>
  );
}

/* ─── Brand ─── */
function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon"><FiHeart size={16} /></div>
      <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 20, letterSpacing: -0.5 }}>
        neuro<span>AI</span>
      </span>
    </div>
  );
}

/* ─── Settings Modal ─── */
function SettingsModal({ isOpen, onClose }) {
  const { p, updateProfile } = useC();
  const [name, setName] = useState(p?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (p?.full_name) setName(p.full_name);
  }, [p]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      await updateProfile(name);
      setSuccess('Account name updated successfully!');
      setTimeout(() => { setSuccess(''); onClose(); }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card rounded-2xl p-6 w-full max-w-md relative"
      >
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 rounded-lg" style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)' }}>
          <FiX size={16} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
            <FiUser size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>Account Settings</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Edit or update your account details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="input">
            <span>Account Full Name</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Enter full name"
            />
          </label>
          <label className="input">
            <span>Email Address (Read Only)</span>
            <input
              value={p?.email || ''}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </label>

          {error && <p className="error">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-xs font-semibold p-3 rounded-lg bg-green-500/15 text-green-400 border border-green-500/25">
              <FiCheck size={14} />
              <span>{success}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="primary"
              style={{ width: 'auto', padding: '10px 20px', marginTop: 0 }}
            >
              {loading ? 'Saving…' : 'Update Account Name'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ─── Auth Pages ─── */
function Login({ signup }) {
  const { t, p, login } = useC();
  const n = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'doctor' ? 'doctor' : 'patient');
  const [f, setF] = useState({ full_name: '', email: '', password: '', doctor_id: '' });
  const [e, setE] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (t) return <Navigate to={p?.role === 'doctor' ? '/dr-dashboard' : '/dashboard'} replace />;

  const isDoctor = mode === 'doctor';

  const field = (label, key, type = 'text') => {
    const inputType = (key === 'password') ? (showPassword ? 'text' : 'password') : type;
    return (
      <label className="input" key={key}>
        <span>{label}</span>
        <div style={{ position: 'relative' }}>
          <input
            required
            type={inputType}
            value={f[key]}
            onChange={x => setF({ ...f, [key]: x.target.value })}
            style={key === 'password' ? { paddingRight: 40 } : {}}
          />
          {key === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
              }}
            >
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          )}
        </div>
      </label>
    );
  };

  return (
    <main className="auth-page" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div style={{
          position: 'absolute', width: '40vw', height: '40vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent)',
          top: '-10vw', left: '-10vw', filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', width: '30vw', height: '30vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.1), transparent)',
          bottom: '-8vw', right: '-8vw', filter: 'blur(40px)',
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{
          display: 'inline-flex', padding: 4, borderRadius: 12, gap: 4,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {['patient', 'doctor'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                background: mode === m ? 'rgba(139,92,246,0.25)' : 'transparent',
                color: mode === m ? '#e2e8f0' : 'var(--text-muted)',
                transition: 'all 0.2s ease',
              }}
            >
              {m === 'patient' ? 'Patient' : 'Doctor'}
            </button>
          ))}
        </div>
      </div>

      <motion.form
        className="auth-card"
        style={{ position: 'relative', zIndex: 1 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onSubmit={async x => {
          x.preventDefault();
          setE(''); setLoading(true);
          try {
            if (isDoctor) {
              if (signup) {
                await login('/auth/doctor-register', {
                  full_name: f.full_name,
                  email: f.email,
                  password: f.password,
                  doctor_id: f.doctor_id,
                });
              } else {
                await login('/auth/doctor-login', {
                  email: f.email,
                  password: f.password,
                  doctor_id: f.doctor_id,
                });
              }
            } else {
              await login(
                signup ? '/auth/register' : '/auth/login',
                signup ? f : { email: f.email, password: f.password }
              );
            }
            n('/dashboard');
          } catch (z) {
            setE(z.message);
          } finally {
            setLoading(false);
          }
        }}
      >
        {isDoctor ? (
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <FiShield size={18} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18 }}>
                neuro<span style={{ color: '#818cf8' }}>AI</span> Clinical
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                PSYCHOLOGIST PORTAL
              </div>
            </div>
          </div>
        ) : (
          <Brand />
        )}

        {isDoctor && (
          <div className="px-3 py-2 rounded-xl mb-4 flex items-center gap-2"
            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <FiLock size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Restricted access. Verified psychologists only.
            </p>
          </div>
        )}

        <h1 style={{ marginTop: isDoctor ? 8 : 20, marginBottom: 6 }}>
          {isDoctor ? (signup ? 'Register as Psychologist' : 'Doctor Sign In') : (signup ? 'Create your account' : 'Welcome back')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
          {isDoctor ? (signup ? 'Create your secure clinical account' : 'Access your clinical dashboard') : (signup ? 'Start your NeuroAI journey today' : 'Sign in to your NeuroAI dashboard')}
        </p>

        {signup && field(isDoctor ? 'Full Name' : 'Full name', 'full_name')}
        {field('Email address', 'email', 'email')}
        {field('Password', 'password', 'password')}
        {isDoctor && (signup || true) && (
          <label className="input">
            <span>Doctor / License ID</span>
            <input
              required
              type="text"
              value={f.doctor_id}
              placeholder={signup ? 'e.g. DR-2024-001 or LIC-12345' : 'Enter your Doctor ID'}
              onChange={x => setF({ ...f, doctor_id: x.target.value })}
            />
          </label>
        )}

        {e && <p className="error">{e}</p>}
        <button className="primary" type="submit" disabled={loading}
          style={isDoctor ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' } : {}}>
          {loading ? 'Please wait…' : isDoctor ? (signup ? 'Create Clinical Account' : 'Sign In to Dashboard') : (signup ? 'Create account' : 'Sign in')}
        </button>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          {isDoctor ? (signup ? 'Already registered? ' : "New psychologist? ") : (signup ? 'Already have an account? ' : "Don't have an account? ")}
          <a href={isDoctor ? (signup ? '/login?mode=patient' : '/login?mode=patient') : (signup ? '/login' : '/signup')} style={{ color: isDoctor ? '#818cf8' : 'var(--accent-purple)' }}>
            {isDoctor ? (signup ? 'Sign in' : 'Register here') : (signup ? 'Sign in' : 'Create one')}
          </a>
        </p>

        {isDoctor && (
          <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--text-faint)' }}>
            <a href="/login">← Patient login</a>
          </p>
        )}
      </motion.form>
    </main>
  );
}

/* ─── Guard (patient routes) ─── */
function Guard({ children }) {
  const { t, l, p } = useC();
  if (l) return (
    <div className="loading-screen">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-transparent"
        style={{ borderTopColor: '#8b5cf6', borderRightColor: '#3b82f6' }}
      />
    </div>
  );
  if (!t) return <Navigate to="/login" replace />;
  // Doctors should not access patient routes
  if (p?.role === 'doctor') return <Navigate to="/dr-dashboard" replace />;
  return children;
}

/* ─── DrGuard (doctor-only routes) ─── */
function DrGuard({ children }) {
  const { t, l, p } = useC();
  if (l) return (
    <div className="loading-screen">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-transparent"
        style={{ borderTopColor: '#6366f1', borderRightColor: '#8b5cf6' }}
      />
    </div>
  );
  if (!t) return <Navigate to="/login" replace />;
  if (p && p.role !== 'doctor') return <Navigate to="/dashboard" replace />;
  return children;
}

/* ─── Shell (App Frame) ─── */
function Shell({ title, subtitle, children, fullPage = false }) {
  const { p, theme, toggleTheme, out, setSettingsOpen } = useC();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setCollapsed(localStorage.getItem('sidebar_collapsed') === 'true');
    });
    return () => observer.disconnect();
  }, []);

  const sidebarW = collapsed ? 72 : 240;

  return (
    <div className="shell">
      <Sidebar profile={p} onLogout={out} />

      <div
        style={{
          marginLeft: sidebarW,
          width: `calc(100% - ${sidebarW}px)`,
          minHeight: '100vh',
          paddingTop: 68,
          transition: 'margin-left 0.25s ease, width 0.25s ease',
          '--sidebar-width': `${sidebarW}px`,
        }}
      >
        <TopBar
          title={title}
          subtitle={subtitle}
          profile={p}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main
          className="relative"
          style={{
            padding: fullPage ? 0 : 'clamp(20px, 4vw, 40px)',
            minHeight: 'calc(100vh - 68px)',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/* ─── Patient Notifications & Appointments ─── */
function PatientNotifications({ token }) {
  const [notes, setNotes] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [n, a] = await Promise.all([
        req('/patient/my-session-notes', token).catch(() => []),
        req('/patient/my-appointments', token).catch(() => []),
      ]);
      setNotes(Array.isArray(n) ? n : []);
      setAppointments(Array.isArray(a) ? a : []);
    } catch {
      setNotes([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const handleReschedule = async (apptId) => {
    if (!newDate) return;
    setRescheduling(apptId);
    try {
      await req(`/patient/appointments/${apptId}/request-reschedule`, token, {
        method: 'POST',
        body: JSON.stringify({ scheduled_at: newDate, patient_message: message }),
      });
      await load();
      setNewDate('');
      setMessage('');
    } catch (e) {
      alert(e.message || 'Failed to request reschedule');
    } finally {
      setRescheduling(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-center py-8">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 rounded-full border-2 border-transparent"
            style={{ borderTopColor: '#8b5cf6', borderRightColor: '#3b82f6' }} />
        </div>
      </div>
    );
  }

  const upcomingAppointments = appointments.filter(a => a.status === 'scheduled' || a.status === 'reschedule_requested');

  return (
    <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {/* Session Notes */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-5"
        style={{ border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)' }}>
            <FiFileText size={15} style={{ color: '#a78bfa' }} />
          </div>
          <h3 className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Session Notes
          </h3>
          {notes.length > 0 && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
              {notes.length}
            </span>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No session notes yet. Your doctor will add notes after sessions.
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {notes.slice(0, 5).map((note, i) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ scale: 1.01 }}
                    className="p-3 rounded-xl cursor-pointer"
                    style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-subtle)' }}
                  >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Dr. {note.doctor_name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    {note.session_date ? new Date(note.session_date).toLocaleDateString() : 'No date'}
                  </span>
                </div>
                {note.content?.subjective && (
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                    <strong>S:</strong> {note.content.subjective.slice(0, 100)}{note.content.subjective.length > 100 ? '…' : ''}
                  </p>
                )}
                {note.content?.plan && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <strong>P:</strong> {note.content.plan.slice(0, 100)}{note.content.plan.length > 100 ? '…' : ''}
                  </p>
                )}
                {note.is_draft && (
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full mt-2"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                    Draft
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Appointments */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-5"
        style={{ border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <FiCalendar size={15} style={{ color: '#34d399' }} />
          </div>
          <h3 className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Appointments
          </h3>
          {upcomingAppointments.length > 0 && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
              {upcomingAppointments.length} upcoming
            </span>
          )}
        </div>
        {upcomingAppointments.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No upcoming appointments.
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {upcomingAppointments.map((appt, i) => (
              <motion.div
                key={appt.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="p-3 rounded-xl"
                style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Dr. {appt.doctor_name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: appt.status === 'scheduled' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: appt.status === 'scheduled' ? '#10b981' : '#f59e0b',
                      border: `1px solid ${appt.status === 'scheduled' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    }}>
                    {appt.status === 'reschedule_requested' ? 'Reschedule Pending' : appt.status}
                  </span>
                </div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  {new Date(appt.scheduled_at).toLocaleString()} · {appt.appointment_type}
                </p>
                {appt.notes && (
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{appt.notes}</p>
                )}
                {appt.status === 'scheduled' && (
                  <div className="mt-2 p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)' }}>
                    <p className="text-xs mb-1 font-medium" style={{ color: '#60a5fa' }}>Need to reschedule?</p>
                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full mb-2 px-2 py-1.5 rounded-lg text-xs"
                      style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                    />
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Reason for rescheduling..."
                      rows={2}
                      className="w-full mb-2 px-2 py-1.5 rounded-lg text-xs"
                      style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'vertical' }}
                    />
                    <button
                      onClick={() => handleReschedule(appt.id)}
                      disabled={rescheduling === appt.id || !newDate}
                      className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        color: 'white',
                        opacity: rescheduling === appt.id || !newDate ? 0.6 : 1,
                      }}
                    >
                      {rescheduling === appt.id ? 'Submitting…' : 'Request Reschedule'}
                    </button>
                  </div>
                )}
                {appt.patient_message && appt.status === 'reschedule_requested' && (
                  <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <strong>Your message:</strong> {appt.patient_message}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard() {
  const { t, p } = useC();
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!t) return;
    req('/reports/history', t)
      .then(rows => {
        if (Array.isArray(rows)) {
          setHistory(rows);
          const fusionRow = rows.find(x => x.report_type === 'fusion');
          setLatest(fusionRow?.result || rows[0]?.result || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [t]);

  const getMetric = (key, fallback = '—') => {
    if (!latest) return fallback;
    const val = latest[key];
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val?.risk_level || val?.level || JSON.stringify(val);
    return String(val);
  };

  const confidenceNum = latest?.overall_confidence || latest?.confidence || 0;

  const trendData = history.slice(0, 10).reverse().map((row, i) => ({
    label: `S${i + 1}`,
    confidence: row.result?.overall_confidence || row.result?.confidence || 0,
    emotion: row.result?.overall_emotion || row.result?.emotion || 'neutral',
  }));

  const stressData = history.slice(0, 10).reverse().map((row, i) => ({
    label: `S${i + 1}`,
    stress_level: row.result?.stress_level || 'Low',
  }));

  const emotionData = latest?.top_emotions ||
    (latest?.overall_emotion ? [{ emotion: latest.overall_emotion, confidence: confidenceNum }] : []);

  const radarData = latest?.top_emotions?.slice(0, 6) || [];

  const metrics = [
    {
      icon: FiActivity, label: 'Current Emotion', color: 'purple',
      value: getMetric('overall_emotion') || getMetric('emotion'),
      badge: getMetric('overall_emotion') !== '—' ? 'Live' : null, badgeColor: 'info',
    },
    {
      icon: FiMic, label: 'Voice Emotion', color: 'green',
      value: getMetric('voice_emotion'),
      sub: 'CREMA-D model',
    },
    {
      icon: FiActivity, label: 'Text Emotion', color: 'blue',
      value: getMetric('overall_emotion') || getMetric('emotion'),
      sub: 'GoEmotions model',
    },
    {
      icon: FiTrendingUp, label: 'Stress Level', color: 'amber',
      value: getMetric('stress_level'),
      badge: latest?.stress_level === 'High' ? 'High' : latest?.stress_level === 'Low' ? 'Low' : null,
      badgeColor: latest?.stress_level === 'High' ? 'danger' : 'success',
    },
    {
      icon: FiBarChart2, label: 'PHQ-9 Severity', color: 'pink',
      value: getMetric('phq_severity') || getMetric('severity'),
      sub: 'Depression screen',
    },
    {
      icon: FiShield, label: 'Safety Status', color: 'red',
      value: typeof latest?.suicide_risk === 'object'
        ? latest.suicide_risk?.risk_level
        : (getMetric('suicide_risk')),
      badge: 'Monitored', badgeColor: 'success',
    },
    {
      icon: FiLayers, label: 'Overall Confidence', color: 'cyan',
      value: confidenceNum ? `${Math.round(confidenceNum)}%` : '—',
      trend: confidenceNum > 75 ? 'High accuracy' : null,
      trendUp: true,
    },
  ];

  if (loading) {
    return (
      <Shell title="Dashboard">
        <div className="flex items-center justify-center py-32">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 rounded-full border-2 border-transparent"
            style={{ borderTopColor: '#8b5cf6', borderRightColor: '#3b82f6' }}
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Dashboard" subtitle={`${history.length} analyses completed`}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6 mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))',
          border: '1px solid var(--border-active)',
        }}
      >
        <Particles count={15} />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-purple)' }}>
            NeuroAI Intelligence Platform
          </p>
          <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Welcome back, {p?.full_name || 'User'} 👋
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {history.length > 0
              ? `Showing results from your most recent ${latest ? 'fusion' : ''} analysis. Run a new analysis to update.`
              : 'Start by completing a Text, Voice, PHQ-9, or Fusion analysis to see your personalized dashboard.'}
          </p>
        </div>
      </motion.div>

      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {metrics.map((m, i) => (
          <MetricCard key={m.label} {...m} index={i} />
        ))}
      </div>

      {/* Doctor Session Notes & Appointments */}
      <PatientNotifications token={t} />

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <EmotionDonut data={emotionData} />
        <TrendChart data={trendData} />
        <RadarEmotionChart data={radarData} />
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <StressTimeline data={stressData} />
        <InsightsPanel latest={latest} />
      </div>

      <div className="mb-4">
        <WeeklyHeatmap data={history.slice(0, 42).map(r => ({
          emotion: r.result?.overall_emotion || r.result?.emotion || 'neutral',
          confidence: r.result?.overall_confidence || r.result?.confidence || 50,
        }))} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <RecentTable history={history} />
        <QuickActions />
      </div>
    </Shell>
  );
}

/* ─── Analysis Pages Shell ─── */
function Single({ type }) {
  const { t } = useC();
  const Cpt = type === 'text' ? TextPage : type === 'voice' ? VoicePage : PhqPage;
  const title = type === 'text' ? 'Text Analysis' : type === 'voice' ? 'Voice Analysis' : 'PHQ-9 Assessment';
  const subtitle = type === 'text' ? 'GoEmotions + safety model'
    : type === 'voice' ? 'CREMA-D audio emotion model'
    : 'Depression severity questionnaire';
  return (
    <Shell title={title} subtitle={subtitle}>
      <Cpt token={t} />
    </Shell>
  );
}

/* ─── Fusion Page Shell ─── */
function Fusion() {
  const { t, out } = useC();
  return (
    <Shell title="Fusion Workspace" subtitle="Integrate all signals for a holistic analysis" fullPage>
      <FusionPage token={t} onUnauth={out} />
    </Shell>
  );
}

/* ─── Reports ─── */
const REPORT_THEME = {
  text:   { label: 'Text',   color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.2)' },
  voice:  { label: 'Voice',  color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)' },
  phq9:   { label: 'PHQ-9',  color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.2)' },
  fusion: { label: 'Fusion', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.2)' },
};

const REPORT_ICON = { text: FiActivity, voice: FiMic, phq9: FiBarChart2, fusion: FiLayers };

/* Result lines for the expandable detail panel, per analysis type. */
function reportDetail(row) {
  const r = row.result || {};
  const lines = [];
  if (row.report_type === 'phq9') {
    lines.push(['Total score', `${r.phq_score ?? r.total_score ?? r.score ?? '—'} / 27`]);
    lines.push(['Severity', r.severity || '—']);
  } else {
    lines.push(['Emotion', r.label || r.emotion || '—']);
    if (typeof r.confidence === 'number') lines.push(['Confidence', `${r.confidence.toFixed(1)}%`]);
  }
  if (r.stress_level) lines.push(['Stress level', r.stress_level]);
  if (r.suicide_risk) lines.push(['Safety risk', String(r.suicide_risk)]);
  if (r.risk_level) lines.push(['Risk level', r.risk_level]);
  if (typeof r.processing_time_ms === 'number') lines.push(['Processing time', `${Math.round(r.processing_time_ms)} ms`]);
  if (Array.isArray(r.top_emotions) && r.top_emotions.length > 1) {
    lines.push(['Runners-up', r.top_emotions.slice(1, 4)
      .map(e => `${e.emotion} ${Number(e.confidence || 0).toFixed(0)}%`).join(' · ')]);
  }
  return lines;
}

function Reports() {
  const { t } = useC();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!t) return;
    setError('');
    req('/reports/history', t)
      .then(rows => { if (Array.isArray(rows)) setHistory(rows); })
      .catch(e => setError(e.message || 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, [t]);

  const countOf = type => history.filter(r => r.report_type === type).length;
  const fusionReports = history.filter(r => r.report_type === 'fusion');
  const phqReports = history.filter(r => r.report_type === 'phq9');

  // Only chart series that actually hold numbers, so recharts never gets an
  // all-null dataset and renders an empty axis.
  const emotionTrend = history.slice(0, 20).reverse()
    .filter(r => typeof (r.result?.confidence) === 'number')
    .map((row, i) => ({ session: `S${i + 1}`, confidence: row.result.confidence }));

  const phqTrend = phqReports.slice(0, 10).reverse()
    .map((row, i) => ({ session: `P${i + 1}`, score: Number(row.result?.phq_score ?? row.result?.total_score ?? row.result?.score ?? 0) }));

  const emotionDistribution = {};
  history.forEach(r => {
    const emo = (r.result?.emotion || 'unknown').toLowerCase();
    emotionDistribution[emo] = (emotionDistribution[emo] || 0) + 1;
  });
  const emotionPieData = Object.entries(emotionDistribution).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <Shell title="Reports" subtitle="Full analysis history">
        <div className="flex items-center justify-center py-32">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 rounded-full border-2 border-transparent"
            style={{ borderTopColor: '#8b5cf6', borderRightColor: '#3b82f6' }} />
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell title="Reports" subtitle="Full analysis history">
        <div className="glass-card rounded-2xl p-8 text-center" style={{ border: '1px solid var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--accent-red)' }}>{error}</p>
          <button onClick={() => window.location.reload()} className="primary mt-4" style={{ maxWidth: 200, margin: '16px auto 0' }}>
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Reports" subtitle="Full analysis history">
      {history.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass-card rounded-2xl p-12 text-center"
          style={{ border: '1px solid var(--border-subtle)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}>
            <FiFileText size={28} style={{ color: '#475569' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: '#64748b' }}>No reports yet</p>
          <p className="text-xs" style={{ color: '#475569' }}>Complete an analysis to see your reports here.</p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {[
              { label: 'Total Analyses', value: history.length, icon: FiActivity, color: '#8b5cf6' },
              { label: 'Fusion Reports', value: countOf('fusion'), icon: FiLayers, color: '#60a5fa' },
              { label: 'PHQ-9 Screenings', value: countOf('phq9'), icon: FiBarChart2, color: '#fb923c' },
              { label: 'Voice Analyses', value: countOf('voice'), icon: FiMic, color: '#34d399' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-2xl p-4"
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${stat.color}18`, color: stat.color }}>
                    <stat.icon size={18} />
                  </div>
                  <div>
                    <div className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                      {stat.value}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {/* Confidence Trend */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-card rounded-2xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                Confidence Trend
              </h3>
              {emotionTrend.length > 0 ? (
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={emotionTrend}>
                      <defs>
                        <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 10 }}
                        labelStyle={{ color: 'var(--text-primary)' }}
                      />
                      <Area type="monotone" dataKey="confidence" stroke="#8b5cf6" fillOpacity={1} fill="url(#confGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No data available</p>
              )}
            </motion.div>

            {/* Emotion Distribution */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="glass-card rounded-2xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                Emotion Distribution
              </h3>
              {emotionPieData.length > 0 ? (
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={emotionPieData}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 10 }}
                        labelStyle={{ color: 'var(--text-primary)' }}
                      />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No data available</p>
              )}
            </motion.div>
          </div>

          {/* PHQ-9 Trend */}
          {phqTrend.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="glass-card rounded-2xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                PHQ-9 Score History
              </h3>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={phqTrend}>
                    <XAxis dataKey="session" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 27]} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-active)', borderRadius: 10 }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#fb923c" strokeWidth={2} dot={{ r: 4, fill: '#fb923c' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* Recent History Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="glass-card rounded-2xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-bold mb-4" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              Recent Analysis History
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Type</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Result</th>
                    <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                    <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--text-muted)' }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 20).map((row, i) => {
                    const theme = REPORT_THEME[row.report_type] || REPORT_THEME.text;
                    const open = selected?.id === row.id;
                    return (
                      <React.Fragment key={row.id}>
                        <motion.tr
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          whileHover={{ backgroundColor: 'var(--surface-soft)' }}
                          className="transition-colors cursor-pointer"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                          onClick={() => setSelected(open ? null : row)}
                        >
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full"
                              style={{
                                background: theme.bg, color: theme.color,
                                border: `1px solid ${theme.border}`,
                              }}>
                              {theme.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                            {row.result?.label || row.result?.emotion || '—'}
                            {typeof row.result?.confidence === 'number' && (
                              <span className="ml-2 font-normal" style={{ color: 'var(--text-muted)' }}>
                                {row.result.confidence.toFixed(0)}%
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right" style={{ color: theme.color }}>
                            {open ? 'Hide' : 'View'}
                          </td>
                        </motion.tr>
                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.tr
                              key={`detail-${row.id}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <td colSpan={4} style={{ background: 'var(--surface-soft)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div className="py-3 px-3 space-y-1.5">
                                  {reportDetail(row).map(([k, v]) => (
                                    <div key={k} className="flex gap-3 text-xs">
                                      <span style={{ color: 'var(--text-muted)', minWidth: 130 }}>{k}</span>
                                      <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}
    </Shell>
  );
}

/* ─── Settings Component ─── */
function Settings() {
  const { p, updateProfile } = useC();
  const [name, setName] = useState(p?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (p?.full_name) setName(p.full_name);
  }, [p]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      await updateProfile(name);
      setSuccess('Account name updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell title="Settings" subtitle="Account & preferences">
      <div className="glass-card rounded-2xl p-8" style={{ maxWidth: 520 }}>
        <h3 className="font-bold text-lg mb-1" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
          Account Details
        </h3>
        <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
          Update your profile name to customize your experience.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="input">
            <span>Account Full Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </label>

          <label className="input">
            <span>Email Address</span>
            <input
              type="email"
              value={p?.email || ''}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </label>

          {error && <p className="error">{error}</p>}
          {success && (
            <div className="flex items-center gap-2 text-xs font-semibold p-3 rounded-lg bg-green-500/15 text-green-400 border border-green-500/25">
              <FiCheck size={14} />
              <span>{success}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !name.trim()} className="primary">
            {loading ? 'Saving…' : 'Update Account Name'}
          </button>
        </form>
      </div>
    </Shell>
  );
}

/* ─── Router ─── */
function App() {
  const { t, p, out } = useC();

  return (
    <Routes>
      {/* ── Auth ─────────────────────────────── */}
      <Route path="/login"  element={<Login />} />
      <Route path="/signup" element={<Login signup />} />

      {/* ── Patient Protected Routes ─────────── */}
      <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
      <Route path="/analyze"   element={<Guard><Single type="text" /></Guard>} />
      <Route path="/voice"     element={<Guard><Single type="voice" /></Guard>} />
      <Route path="/phq9"      element={<Guard><Single type="phq" /></Guard>} />
      <Route path="/fusion"    element={<Guard><Fusion /></Guard>} />
      <Route path="/reports"   element={<Guard><Reports /></Guard>} />
      <Route path="/settings"  element={<Guard><Settings /></Guard>} />

      {/* ── Doctor Protected Routes ───────────── */}
      <Route path="/dr-dashboard/*" element={
        <DrGuard>
          <DoctorDashboard token={t} profile={p} onLogout={out} />
        </DrGuard>
      } />

      {/* ── Redirects ─────────────────────────── */}
      <Route path="/" element={<Navigate to={t && p?.role === 'doctor' ? '/dr-dashboard' : '/dashboard'} replace />} />
      <Route path="*" element={<Navigate to={t && p?.role === 'doctor' ? '/dr-dashboard' : '/dashboard'} replace />} />
    </Routes>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<BrowserRouter><Provider><App /></Provider></BrowserRouter>);
}
