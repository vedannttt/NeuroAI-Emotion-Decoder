/**
 * NeuroAI — Doctor Clinical Workspace
 * Full-featured psychologist dashboard with role-based access.
 * Routes: /dr-dashboard (overview), /dr-dashboard/patients, /dr-dashboard/patients/:id,
 *         /dr-dashboard/appointments, /dr-dashboard/copilot, /dr-dashboard/alerts
 */
import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useNavigate, useParams, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers, FiCalendar, FiBell, FiMessageSquare, FiHome, FiLogOut,
  FiSearch, FiAlertTriangle, FiChevronRight, FiCheck, FiX, FiEdit3,
  FiSave, FiRefreshCw, FiSend, FiChevronDown, FiChevronUp, FiActivity,
  FiClock, FiFileText, FiPlus, FiArrowLeft, FiTrendingUp, FiTrendingDown,
  FiMinus, FiShield, FiUser, FiHeart, FiInfo, FiMoon, FiSun
} from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { API } from './api.js';
import { C } from './context.jsx';

// ─── API helpers ─────────────────────────────────────────────────────────────
async function drReq(path, token, opts = {}) {
  const r = await fetch(API + path, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const d = await r.json().catch(() => ({ detail: 'Invalid response' }));
  if (!r.ok) throw new Error(d.detail || 'Request failed');
  return d;
}

// ─── Status helpers ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ok:               { label: 'Stable',         color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: '🟢' },
  needs_attention:  { label: 'Needs Attention', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  dot: '🟠' },
  critical:         { label: 'Critical',        color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   dot: '🔴' },
};
const TREND_CONFIG = {
  improving:    { icon: FiTrendingUp,   color: '#10b981', label: '↑ Improving' },
  deteriorating:{ icon: FiTrendingDown, color: '#ef4444', label: '↓ Deteriorating' },
  stable:       { icon: FiMinus,        color: '#94a3b8', label: '→ Stable' },
};
const SEVERITY_COLORS = {
  info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444',
};

// ─── Dr Sidebar ───────────────────────────────────────────────────────────────
function DrSidebar({ profile, unreadAlerts, onLogout, theme, onToggleTheme }) {
  const nav = [
    { path: '/dr-dashboard',              icon: FiHome,        label: 'Overview'     },
    { path: '/dr-dashboard/patients',     icon: FiUsers,       label: 'Patients'     },
    { path: '/dr-dashboard/appointments', icon: FiCalendar,    label: 'Appointments' },
    { path: '/dr-dashboard/alerts',       icon: FiBell,        label: 'Alerts', badge: unreadAlerts },
    { path: '/dr-dashboard/copilot',      icon: FiMessageSquare, label: 'Copilot'   },
  ];

  return (
    <div className="fixed left-0 top-0 h-full flex flex-col z-40"
      style={{
        width: 230, background: 'var(--surface-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(20px)',
      }}>
      {/* Brand */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <FiHeart size={14} color="white" />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              neuro<span style={{ color: '#8b5cf6' }}>AI</span>
            </div>
            <div className="text-xs" style={{ color: '#6366f1', fontWeight: 600 }}>Clinical Workspace</div>
          </div>
        </div>
      </div>

      {/* Doctor profile */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
            {(profile?.full_name || 'D').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              Dr. {profile?.full_name || 'Doctor'}
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {profile?.doctor_id || 'Psychologist'}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Online</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dr-dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${isActive ? 'active-nav' : ''}`
            }
            style={({ isActive }) => ({
              background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
              color: isActive ? '#818cf8' : 'var(--text-muted)',
              border: isActive ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
            })}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: '#ef4444', color: 'white', minWidth: 18, textAlign: 'center' }}>
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Disclaimer */}
      <div className="px-4 py-3 mx-3 mb-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div className="flex items-start gap-2">
          <FiShield size={12} style={{ color: '#818cf8', flexShrink: 0, marginTop: 2 }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            AI outputs are decision-support tools. Always apply clinical judgment.
          </p>
        </div>
      </div>

      {/* Theme toggle */}
      <div className="px-3 pb-2">
        <button onClick={onToggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'var(--text-muted)', background: 'var(--surface-soft)' }}>
          {theme === 'light' ? <FiMoon size={16} /> : <FiSun size={16} />}
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>

      {/* Logout */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'var(--text-muted)', background: 'var(--surface-soft)' }}>
          <FiLogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Dr Top Bar ───────────────────────────────────────────────────────────────
function DrTopBar({ title, subtitle, theme, onToggleTheme }) {
  return (
    <div className="fixed top-0 right-0 flex items-center px-6 z-30"
      style={{
        left: 230, height: 64,
        background: 'var(--surface-topbar)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(20px)',
      }}>
      <div className="flex-1">
        <h1 className="text-base font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center justify-center rounded-xl transition-all"
          style={{
            width: 36, height: 36,
            background: 'var(--surface-soft)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-purple)',
          }}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? <FiMoon size={17} /> : <FiSun size={17} />}
        </button>
        <div className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
          🔒 Secure Clinical Session
        </div>
      </div>
    </div>
  );
}

// ─── Dr Shell ────────────────────────────────────────────────────────────────
function DrShell({ title, subtitle, children, token, profile, onLogout, theme, onToggleTheme }) {
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    drReq('/doctor/alerts?unread_only=true', token)
      .then(d => setUnreadAlerts(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <DrSidebar profile={profile} unreadAlerts={unreadAlerts} onLogout={onLogout} theme={theme} onToggleTheme={onToggleTheme} />
      <div style={{ marginLeft: 230, paddingTop: 64 }}>
        <DrTopBar title={title} subtitle={subtitle} theme={theme} onToggleTheme={onToggleTheme} />
        <main style={{ padding: 'clamp(20px,3vw,36px)', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ size = 28 }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: '2px solid transparent',
        borderTopColor: '#6366f1', borderRightColor: '#8b5cf6',
      }}
    />
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub, loading }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      className="glass-card rounded-2xl p-5"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, color }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="text-2xl font-bold mb-0.5" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
        {loading ? '—' : value}
      </div>
      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{sub}</div>}
    </motion.div>
  );
}

// ─── Patient Row ─────────────────────────────────────────────────────────────
function PatientRow({ patient, onClick }) {
  const sc = STATUS_CONFIG[patient.status] || STATUS_CONFIG.ok;
  const tc = TREND_CONFIG[patient.trend] || TREND_CONFIG.stable;

  return (
    <motion.div
      whileHover={{ x: 2, scale: 1.005 }}
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all"
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        marginBottom: 8,
      }}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
        {patient.full_name.charAt(0).toUpperCase()}
      </div>

      {/* Name & ID */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {patient.full_name}
        </div>
        <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          ID #{patient.id.toString().padStart(4, '0')} · {patient.total_analyses} analyses
        </div>
      </div>

      {/* Status */}
      <div className="px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
        style={{ background: sc.bg, color: sc.color }}>
        {sc.dot} {sc.label}
      </div>

      {/* Trend */}
      <div className="flex items-center gap-1 text-xs font-medium flex-shrink-0" style={{ color: tc.color }}>
        <tc.icon size={13} />
        {tc.label}
      </div>

      {/* PHQ */}
      <div className="text-center flex-shrink-0" style={{ minWidth: 60 }}>
        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {patient.latest_phq_score ?? '—'}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>PHQ-9</div>
      </div>

      {/* Last checkin */}
      <div className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: 80 }}>
        {patient.last_checkin
          ? new Date(patient.last_checkin).toLocaleDateString()
          : 'Never'
        }
      </div>

      {/* Alert badge */}
      {patient.unread_alerts > 0 && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: '#ef4444', color: 'white' }}>
          {patient.unread_alerts}
        </div>
      )}

      <FiChevronRight size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
    </motion.div>
  );
}

// ─── Overview Page ────────────────────────────────────────────────────────────
function DrOverview({ token, profile }) {
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, al, ap] = await Promise.all([
        drReq('/doctor/stats', token),
        drReq('/doctor/patients', token),
        drReq('/doctor/alerts?unread_only=true', token),
        drReq('/doctor/appointments?upcoming_only=true', token),
      ]);
      setStats(s); setPatients(p); setAlerts(al); setAppointments(ap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const attention = patients.filter(p => p.status !== 'ok');

  return (
    <div>
      {/* Welcome */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#818cf8' }}>
            Clinical Dashboard
          </p>
          <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, Dr. {(profile?.full_name || '').split(' ')[0]} 👋
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {stats
              ? `${stats.needs_attention + stats.critical} patient(s) need your attention today. ${stats.todays_appointments} appointment(s) scheduled.`
              : 'Loading your clinical summary…'}
          </p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <StatCard label="Total Patients"      value={stats?.total_patients}    icon={FiUsers}     color="#6366f1" loading={loading} />
        <StatCard label="Needs Attention"     value={stats?.needs_attention}   icon={FiAlertTriangle} color="#f59e0b" loading={loading} />
        <StatCard label="Critical"            value={stats?.critical}          icon={FiShield}    color="#ef4444" loading={loading} />
        <StatCard label="Today's Appts"       value={stats?.todays_appointments} icon={FiCalendar} color="#10b981" loading={loading} />
        <StatCard label="Unread Alerts"       value={stats?.unread_alerts}     icon={FiBell}      color="#f59e0b" loading={loading} />
        <StatCard label="Session Notes"       value={stats?.total_notes}       icon={FiFileText}  color="#06b6d4" loading={loading} />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        {/* Patients needing attention */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              Requires Attention
            </h3>
            <button onClick={() => navigate('/dr-dashboard/patients')}
              className="text-xs" style={{ color: '#818cf8' }}>View All →</button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : attention.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All patients are stable</p>
            </div>
          ) : (
            attention.slice(0, 5).map(p => (
              <PatientRow key={p.id} patient={p} onClick={() => navigate(`/dr-dashboard/patients/${p.id}`)} />
            ))
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Today's Appointments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                Today's Appointments
              </h3>
              <button onClick={() => navigate('/dr-dashboard/appointments')}
                className="text-xs" style={{ color: '#818cf8' }}>View All →</button>
            </div>
            <div className="glass-card rounded-2xl p-4">
              {appointments.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No upcoming appointments
                </p>
              ) : (
                appointments.slice(0, 3).map(a => (
                  <motion.div
                    key={a.id}
                    whileHover={{ x: 2 }}
                    className="flex items-center gap-3 py-2.5 border-b last:border-0 cursor-pointer transition-all"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>
                      <FiCalendar size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {a.patient_name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{a.appointment_type}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Recent Alerts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                Recent Alerts
              </h3>
              <button onClick={() => navigate('/dr-dashboard/alerts')}
                className="text-xs" style={{ color: '#818cf8' }}>View All →</button>
            </div>
            <div className="glass-card rounded-2xl p-4">
              {alerts.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No unread alerts
                </p>
              ) : (
                alerts.slice(0, 4).map(a => (
                  <motion.div
                    key={a.id}
                    whileHover={{ x: 2 }}
                    className="flex items-start gap-3 py-2.5 border-b last:border-0 cursor-pointer transition-all"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: SEVERITY_COLORS[a.severity] || '#3b82f6' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {a.patient_name}
                      </div>
                      <div className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {a.message.length > 80 ? a.message.slice(0, 80) + '…' : a.message}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Patient List Page ────────────────────────────────────────────────────────
function PatientList({ token }) {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    drReq(`/doctor/patients${q}`, token)
      .then(setPatients).catch(console.error)
      .finally(() => setLoading(false));
  }, [token, search]);

  const filtered = filter === 'all' ? patients : patients.filter(p => p.status === filter);

  return (
    <div>
      {/* Controls */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 relative">
          <FiSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patients by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>
        {['all', 'ok', 'needs_attention', 'critical'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: filter === f ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
              color: filter === f ? '#818cf8' : 'var(--text-muted)',
              border: `1px solid ${filter === f ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
            }}>
            {f === 'all' ? 'All' : f === 'ok' ? '🟢 Stable' : f === 'needs_attention' ? '🟠 Attention' : '🔴 Critical'}
          </button>
        ))}
      </div>

      {/* Column headers */}
      <div className="flex gap-4 px-4 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
        <div style={{ width: 40 }}></div>
        <div className="flex-1">Patient</div>
        <div style={{ width: 130 }}>Status</div>
        <div style={{ width: 120 }}>Trend</div>
        <div style={{ width: 60 }}>PHQ-9</div>
        <div style={{ width: 80 }}>Last Seen</div>
        <div style={{ width: 32 }}></div>
        <div style={{ width: 20 }}></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No patients found</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {search ? 'Try a different search term' : 'Patients appear here once they register and submit analyses'}
          </p>
        </div>
      ) : (
        filtered.map(p => (
          <PatientRow key={p.id} patient={p} onClick={() => navigate(`/dr-dashboard/patients/${p.id}`)} />
        ))
      )}
    </div>
  );
}

// ─── Pre-Session Brief ────────────────────────────────────────────────────────
function PreSessionBrief({ patientId, token }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    drReq(`/doctor/patients/${patientId}/brief`, token)
      .then(setBrief).catch(console.error)
      .finally(() => setLoading(false));
  }, [patientId, token]);

  const tc = brief ? (TREND_CONFIG[brief.emotion_trend] || TREND_CONFIG.stable) : TREND_CONFIG.stable;

  return (
    <div className="glass-card rounded-2xl overflow-hidden mb-5"
      style={{ border: '1px solid rgba(99,102,241,0.25)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4"
        style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.06))' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
          <FiActivity size={15} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            AI Pre-Session Brief
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {brief ? `Last ${brief.period_days} days · ${brief.total_sessions} sessions` : 'Loading…'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {brief && (
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{
                background: brief.risk_level === 'High' ? 'rgba(239,68,68,0.12)' : brief.risk_level === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                color: brief.risk_level === 'High' ? '#ef4444' : brief.risk_level === 'Medium' ? '#f59e0b' : '#10b981',
              }}>
              Risk: {brief.risk_level}
            </span>
          )}
          {open ? <FiChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <FiChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : brief ? (
              <div className="p-5">
                {/* Summary */}
                <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-subtle)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{brief.summary}</p>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Emotion', value: brief.emotion_trend, color: tc.color },
                    { label: 'Stress', value: brief.stress_trend, color: brief.stress_trend === 'deteriorating' ? '#ef4444' : '#10b981' },
                    { label: 'PHQ-9', value: brief.phq9_current_score ?? '—', color: 'var(--text-primary)', sub: brief.phq9_change?.split(' ')[0] },
                    { label: 'Risk', value: brief.risk_level, color: brief.risk_level === 'High' ? '#ef4444' : brief.risk_level === 'Medium' ? '#f59e0b' : '#10b981' },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-xl text-center"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="text-base font-bold capitalize" style={{ color: m.color, fontFamily: 'Space Grotesk' }}>{m.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                      {m.sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{m.sub}</div>}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Important changes */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                      Important Changes
                    </div>
                    <div className="space-y-1.5">
                      {brief.important_changes.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }}>•</span>
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Suggested topics */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>
                      Suggested Topics
                    </div>
                    <div className="space-y-1.5">
                      {brief.suggested_topics.map((t, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span className="mt-0.5 flex-shrink-0" style={{ color: '#818cf8' }}>→</span>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data available for this patient yet.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SOAP Editor ──────────────────────────────────────────────────────────────
function SOAPEditor({ patientId, patientName, token }) {
  const [soap, setSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [isDraft, setIsDraft] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    drReq('/doctor/notes', token)
      .then(all => setNotes(all.filter(n => n.patient_id === patientId)))
      .catch(console.error);
  }, [patientId, token, saved]);

  const autofill = async () => {
    const brief = await drReq(`/doctor/patients/${patientId}/brief`, token);
    setSoap({
      subjective: `Patient presents for ${brief.total_sessions > 0 ? 'follow-up' : 'initial'} session. ${brief.summary}`,
      objective: `PHQ-9 Score: ${brief.phq9_current_score ?? 'Not assessed'}. Emotion trend: ${brief.emotion_trend}. Stress trend: ${brief.stress_trend}. Risk level: ${brief.risk_level}.`,
      assessment: `${brief.important_changes.join('. ')}.`,
      plan: `${brief.suggested_topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}`,
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await drReq('/doctor/notes', token, {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, ...soap, is_draft: isDraft }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setSoap({ subjective: '', objective: '', assessment: '', plan: '' });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: 'subjective',  label: 'S — Subjective',  hint: "Patient's own words, reported symptoms, concerns" },
    { key: 'objective',   label: 'O — Objective',   hint: 'Observable data, PHQ-9, emotion metrics, vitals' },
    { key: 'assessment',  label: 'A — Assessment',  hint: 'Clinical interpretation, diagnosis, formulation' },
    { key: 'plan',        label: 'P — Plan',        hint: 'Treatment plan, homework, next session goals' },
  ];

  return (
    <div className="glass-card rounded-2xl overflow-hidden mb-5"
      style={{ border: '1px solid var(--border-subtle)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4"
        style={{ background: 'var(--surface-soft)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>
          <FiEdit3 size={15} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Session Notes (SOAP)
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {notes.length} saved note(s) · AI-assisted drafting
          </div>
        </div>
        {open ? <FiChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <FiChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="p-5">
              {/* Actions bar */}
              <div className="flex gap-2 mb-4">
                <button onClick={autofill}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <FiActivity size={13} /> AI Autofill from Patient Data
                </button>
                <button onClick={() => setShowHistory(h => !h)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  <FiClock size={13} /> History ({notes.length})
                </button>
              </div>

              {/* History panel */}
              {showHistory && notes.length > 0 && (
                <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
                  {notes.map(n => (
                    <div key={n.id} className="p-3 rounded-xl"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {new Date(n.session_date || n.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: n.is_draft ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: n.is_draft ? '#f59e0b' : '#10b981' }}>
                          {n.is_draft ? 'Draft' : 'Final'}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {(n.content?.subjective || '').slice(0, 100)}…
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* SOAP fields */}
              <div className="space-y-3">
                {fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {f.label}
                    </label>
                    <textarea
                      value={soap[f.key]}
                      onChange={e => setSoap({ ...soap, [f.key]: e.target.value })}
                      placeholder={f.hint}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl text-xs resize-none"
                      style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)', outline: 'none', lineHeight: 1.6,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Save controls */}
              <div className="flex items-center gap-3 mt-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={isDraft} onChange={e => setIsDraft(e.target.checked)} />
                  Save as Draft
                </label>
                <div className="flex-1" />
                {saved && (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: '#10b981' }}>
                    <FiCheck size={13} /> Saved!
                  </div>
                )}
                <button onClick={save} disabled={saving || !Object.values(soap).some(v => v.trim())}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white',
                    opacity: saving ? 0.7 : 1,
                  }}>
                  <FiSave size={13} />
                  {saving ? 'Saving…' : isDraft ? 'Save Draft' : 'Approve & Save'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Copilot Chat (inline on patient page) ────────────────────────────────────
function CopilotChat({ patientId, token, embedded = false }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your clinical copilot. Ask me anything about this patient — e.g. 'What changed since last session?', 'Show PHQ-9 history', or 'Prepare today\\'s summary'." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await drReq('/doctor/copilot', token, {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, question: q }),
      });
      setMessages(m => [...m, { role: 'assistant', text: res.answer, confidence: res.confidence }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQ = [
    'What changed since last session?',
    'Show PHQ-9 history',
    "Prepare today's summary",
    'Stress levels recently?',
  ];

  if (embedded) {
    return (
      <div className="glass-card rounded-2xl overflow-hidden mb-5"
        style={{ border: '1px solid var(--border-subtle)' }}>
        <button onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-3 px-5 py-4"
          style={{ background: 'var(--surface-soft)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>
            <FiMessageSquare size={15} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
              Doctor Copilot
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>AI assistant for patient-specific queries</div>
          </div>
          {open ? <FiChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <FiChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
        </button>
        <AnimatePresence>
          {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}><ChatBody /></motion.div>}
        </AnimatePresence>
      </div>
    );
  }

  return <div className="h-full flex flex-col"><ChatBody /></div>;

  function ChatBody() {
    return (
      <div className="flex flex-col" style={{ maxHeight: 480 }}>
        {/* Quick questions */}
        <div className="px-4 pt-3 pb-2 flex gap-2 flex-wrap border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {quickQ.map(q => (
            <button key={q} onClick={() => { setInput(q); }}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: 320 }}>
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed"
                style={{
                  background: m.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'var(--bg-card)',
                  color: m.role === 'user' ? 'white' : 'var(--text-secondary)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#818cf8' }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about this patient…"
            className="flex-1 px-3 py-2 rounded-xl text-xs"
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <button onClick={send} disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', opacity: loading ? 0.6 : 1 }}>
            <FiSend size={14} />
          </button>
        </div>
      </div>
    );
  }
}

// ─── Patient Detail Page ──────────────────────────────────────────────────────
function PatientDetail({ token }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const patientId = parseInt(id);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [apptForm, setApptForm] = useState({ scheduled_at: '', appointment_type: 'consultation', notes: '' });
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    drReq(`/doctor/patients/${patientId}`, token)
      .then(setPatient).catch(console.error)
      .finally(() => setLoading(false));
  }, [patientId, token]);

  const scheduleAppt = async () => {
    setScheduling(true);
    try {
      await drReq('/doctor/appointments', token, {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, ...apptForm }),
      });
      setScheduleOpen(false);
      const updated = await drReq(`/doctor/patients/${patientId}`, token);
      setPatient(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setScheduling(false);
    }
  };

  // Build PHQ trend data
  const phqHistory = (patient?.history || [])
    .filter(r => r.report_type === 'phq9' || r.report_type === 'fusion')
    .slice(0, 10).reverse()
    .map((r, i) => ({
      label: `S${i + 1}`,
      score: r.result?.total_score ?? r.result?.phq_score ?? r.result?.score ?? null,
      date: new Date(r.created_at).toLocaleDateString(),
    })).filter(d => d.score !== null);

  // Emotion frequency
  const emotionFreq = {};
  (patient?.history || []).slice(0, 20).forEach(r => {
    const e = r.result?.overall_emotion || r.result?.emotion;
    if (e) emotionFreq[e] = (emotionFreq[e] || 0) + 1;
  });
  const emotionChartData = Object.entries(emotionFreq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([e, c]) => ({ name: e, count: c }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32"><Spinner size={36} /></div>
    );
  }

  if (!patient) {
    return (
      <div className="glass-card rounded-2xl p-16 text-center">
        <p className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Patient not found</p>
        <button onClick={() => navigate('/dr-dashboard/patients')}
          className="text-sm" style={{ color: '#818cf8' }}>← Back to Patients</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/dr-dashboard/patients')}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          <FiArrowLeft size={16} />
        </button>
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
          {patient.full_name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            {patient.full_name}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Patient ID #{patientId.toString().padStart(4, '0')} · {patient.email} · {patient.history.length} total analyses
          </p>
        </div>
        <button onClick={() => setScheduleOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
          <FiPlus size={15} /> Schedule
        </button>
      </div>

      {/* AI Pre-Session Brief */}
      <PreSessionBrief patientId={patientId} token={token} />

      {/* Charts row */}
      {(phqHistory.length > 0 || emotionChartData.length > 0) && (
        <div className="grid gap-5 mb-5" style={{ gridTemplateColumns: phqHistory.length > 0 && emotionChartData.length > 0 ? '1fr 1fr' : '1fr' }}>
          {phqHistory.length > 0 && (
            <div className="glass-card rounded-2xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                PHQ-9 Score Trend
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={phqHistory}>
                  <defs>
                    <linearGradient id="phqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 27]} tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fill="url(#phqGrad)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                {[{ label: '0-4 Minimal', col: '#10b981' }, { label: '10-14 Moderate', col: '#f59e0b' }, { label: '20+ Severe', col: '#ef4444' }].map(b => (
                  <span key={b.label} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: b.col }}></span>{b.label}</span>
                ))}
              </div>
            </div>
          )}
          {emotionChartData.length > 0 && (
            <div className="glass-card rounded-2xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-bold mb-4" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                Emotion Frequency (Last 20 Sessions)
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={emotionChartData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* SOAP Notes */}
      <SOAPEditor patientId={patientId} patientName={patient.full_name} token={token} />

      {/* Copilot */}
      <CopilotChat patientId={patientId} token={token} embedded />

      {/* Appointments */}
      {patient.appointments.length > 0 && (
        <div className="glass-card rounded-2xl p-5 mb-5" style={{ border: '1px solid var(--border-subtle)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Appointment History
          </h3>
          <div className="space-y-2">
            {patient.appointments.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0"
                style={{ borderColor: 'var(--border-subtle)' }}>
                <FiCalendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(a.scheduled_at).toLocaleString()} · {a.appointment_type}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: a.status === 'completed' ? 'rgba(16,185,129,0.12)' : a.status === 'missed' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                    color: a.status === 'completed' ? '#10b981' : a.status === 'missed' ? '#ef4444' : '#818cf8',
                  }}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent analysis history */}
      {patient.history.length > 0 && (
        <div className="glass-card rounded-2xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
          <h3 className="text-sm font-bold mb-3" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Recent Check-ins
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {patient.history.slice(0, 15).map(h => (
              <div key={h.id} className="flex items-center gap-3 py-2 border-b last:border-0"
                style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="px-2 py-0.5 rounded-md text-xs font-semibold uppercase"
                  style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)', minWidth: 50, textAlign: 'center' }}>
                  {h.report_type}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {h.result?.overall_emotion || h.result?.emotion || h.result?.severity || '—'}
                    {h.result?.stress_level ? ` · ${h.result.stress_level} stress` : ''}
                    {h.result?.total_score !== undefined ? ` · PHQ: ${h.result.total_score}` : ''}
                  </div>
                </div>
                <div className="text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
                  {new Date(h.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      <AnimatePresence>
        {scheduleOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card rounded-2xl p-6 w-full max-w-md relative">
              <button onClick={() => setScheduleOpen(false)} className="absolute right-4 top-4 p-1.5 rounded-lg"
                style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)' }}>
                <FiX size={16} />
              </button>
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                Schedule Appointment
              </h3>
              <div className="space-y-4">
                <label className="input">
                  <span>Date & Time</span>
                  <input type="datetime-local" value={apptForm.scheduled_at}
                    onChange={e => setApptForm({ ...apptForm, scheduled_at: e.target.value })} />
                </label>
                <label className="input">
                  <span>Type</span>
                  <select value={apptForm.appointment_type}
                    onChange={e => setApptForm({ ...apptForm, appointment_type: e.target.value })}
                    style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    <option value="consultation">Consultation</option>
                    <option value="phq9_checkin">PHQ-9 Check-in</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="crisis">Crisis Session</option>
                  </select>
                </label>
                <label className="input">
                  <span>Notes (optional)</span>
                  <input type="text" value={apptForm.notes}
                    onChange={e => setApptForm({ ...apptForm, notes: e.target.value })}
                    placeholder="Session notes or agenda…" />
                </label>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setScheduleOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                  Cancel
                </button>
                <button onClick={scheduleAppt} disabled={scheduling || !apptForm.scheduled_at}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', opacity: scheduling ? 0.7 : 1 }}>
                  {scheduling ? 'Scheduling…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Appointments Page ────────────────────────────────────────────────────────
function AppointmentsPage({ token }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    drReq('/doctor/appointments', token)
      .then(setAppointments).catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    try {
      await drReq(`/doctor/appointments/${id}`, token, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      load();
    } catch (e) { console.error(e); } finally { setUpdating(null); }
  };

  const grouped = {
    scheduled: appointments.filter(a => a.status === 'scheduled'),
    completed: appointments.filter(a => a.status === 'completed'),
    missed: appointments.filter(a => a.status === 'missed' || a.status === 'cancelled'),
  };

  const typeColors = { consultation: '#6366f1', phq9_checkin: '#06b6d4', follow_up: '#10b981', crisis: '#ef4444' };

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-8">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2"
                style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                <span className={`w-2 h-2 rounded-full`}
                  style={{ background: group === 'scheduled' ? '#6366f1' : group === 'completed' ? '#10b981' : '#ef4444' }} />
                {group.charAt(0).toUpperCase() + group.slice(1)} ({items.length})
              </h3>
              {items.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No {group} appointments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(a => (
                    <div key={a.id} className="glass-card rounded-2xl p-4 flex items-center gap-4"
                      style={{ border: '1px solid var(--border-subtle)' }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${typeColors[a.appointment_type] || '#6366f1'}18`, color: typeColors[a.appointment_type] || '#6366f1' }}>
                        <FiCalendar size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {a.patient_name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(a.scheduled_at).toLocaleString()} · {a.appointment_type.replace('_', ' ')}
                          {a.notes && ` · ${a.notes}`}
                        </div>
                      </div>
                      {group === 'scheduled' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(a.id, 'completed')}
                            disabled={updating === a.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                            <FiCheck size={12} /> Done
                          </button>
                          <button onClick={() => updateStatus(a.id, 'missed')}
                            disabled={updating === a.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <FiX size={12} /> Missed
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Alerts Page ──────────────────────────────────────────────────────────────
function AlertsPage({ token }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    drReq('/doctor/alerts', token)
      .then(setAlerts).catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const markSeen = async (id) => {
    await drReq(`/doctor/alerts/${id}/seen`, token, { method: 'POST' });
    load();
  };

  const markAllSeen = async () => {
    setMarkingAll(true);
    await drReq('/doctor/alerts/mark-all-seen', token, { method: 'POST' });
    load();
    setMarkingAll(false);
  };

  const unread = alerts.filter(a => !a.seen);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold" style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
            Patient Alerts
          </h2>
          {unread.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              {unread.length} unread
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button onClick={markAllSeen} disabled={markingAll}
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
            <FiCheck size={13} /> {markingAll ? 'Marking…' : 'Mark All Read'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : alerts.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No alerts</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>You're all caught up! Alerts appear when patients submit analyses.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(a => (
            <motion.div key={a.id} layout
              className="glass-card rounded-2xl p-4 flex items-start gap-4"
              style={{
                border: `1px solid ${a.seen ? 'var(--border-subtle)' : `${SEVERITY_COLORS[a.severity]}40`}`,
                opacity: a.seen ? 0.75 : 1,
              }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${SEVERITY_COLORS[a.severity]}18`,
                  color: SEVERITY_COLORS[a.severity],
                }}>
                {a.severity === 'critical' ? <FiAlertTriangle size={16} /> : a.severity === 'warning' ? <FiInfo size={16} /> : <FiBell size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {a.patient_name}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: `${SEVERITY_COLORS[a.severity]}18`, color: SEVERITY_COLORS[a.severity] }}>
                    {a.severity}
                  </span>
                  {!a.seen && (
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3b82f6' }} />
                  )}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.message}</p>
                <div className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button onClick={() => navigate(`/dr-dashboard/patients/${a.patient_id}`)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                  Review
                </button>
                {!a.seen && (
                  <button onClick={() => markSeen(a.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'var(--surface-soft)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                    Mark Read
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Full Copilot Page ────────────────────────────────────────────────────────
function CopilotPage({ token }) {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    drReq('/doctor/patients', token)
      .then(setPatients).catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="flex gap-5 h-full">
      {/* Patient selector */}
      <div className="w-64 flex-shrink-0">
        <div className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--text-faint)' }}>
          Select Patient
        </div>
        {loading ? <Spinner size={20} /> : (
          <div className="space-y-1.5">
            {patients.map(p => (
              <button key={p.id} onClick={() => setSelected(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: selected?.id === p.id ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                  border: `1px solid ${selected?.id === p.id ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                  color: selected?.id === p.id ? '#818cf8' : 'var(--text-primary)',
                }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
                  {p.full_name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{p.full_name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-faint)' }}>#{p.id.toString().padStart(4,'0')}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 glass-card rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="text-4xl mb-3">🤖</div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Doctor Copilot</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a patient to start asking questions</p>
          </div>
        ) : (
          <div>
            <div className="px-5 py-4 border-b flex items-center gap-3"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-soft)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }}>
                {selected.full_name.charAt(0)}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.full_name}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>#{selected.id.toString().padStart(4,'0')}</div>
              </div>
            </div>
            <CopilotChat patientId={selected.id} token={token} embedded={false} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Doctor Dashboard Export ─────────────────────────────────────────────
export default function DoctorDashboard({ token, profile, onLogout }) {
  const { theme, toggleTheme } = useContext(C);
  const pageProps = { token, profile };

  const pages = {
    overview:     { title: 'Clinical Overview',   subtitle: `${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` },
    patients:     { title: 'Patient Management',  subtitle: 'All registered patients' },
    appointments: { title: 'Appointments',         subtitle: 'Session scheduling & follow-ups' },
    alerts:       { title: 'Patient Alerts',       subtitle: 'Real-time check-in notifications' },
    copilot:      { title: 'Doctor Copilot',       subtitle: 'AI assistant for patient-specific queries' },
    patientDetail:{ title: 'Patient Detail',       subtitle: 'Full clinical workspace' },
  };

  const shellProps = { token, profile, onLogout, theme, onToggleTheme: toggleTheme };

  return (
    <Routes>
      <Route path="/" element={
        <DrShell {...pages.overview} {...shellProps}>
          <DrOverview {...pageProps} />
        </DrShell>
      } />
      <Route path="/patients" element={
        <DrShell {...pages.patients} {...shellProps}>
          <PatientList {...pageProps} />
        </DrShell>
      } />
      <Route path="/patients/:id" element={
        <DrShell {...pages.patientDetail} {...shellProps}>
          <PatientDetail {...pageProps} />
        </DrShell>
      } />
      <Route path="/appointments" element={
        <DrShell {...pages.appointments} {...shellProps}>
          <AppointmentsPage {...pageProps} />
        </DrShell>
      } />
      <Route path="/alerts" element={
        <DrShell {...pages.alerts} {...shellProps}>
          <AlertsPage {...pageProps} />
        </DrShell>
      } />
      <Route path="/copilot" element={
        <DrShell {...pages.copilot} {...shellProps}>
          <CopilotPage {...pageProps} />
        </DrShell>
      } />
      <Route path="*" element={<Navigate to="/dr-dashboard" replace />} />
    </Routes>
  );
}
