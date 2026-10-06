import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSun, FiMoon, FiSearch, FiPlus, FiChevronDown,
  FiHome, FiActivity, FiMic, FiBarChart2, FiLayers, FiFileText, FiSettings
} from 'react-icons/fi';

const SEARCH_PAGES = [
  { label: 'Dashboard', path: '/dashboard', keywords: ['dashboard', 'home', 'overview', 'main'], icon: FiHome, color: '#60a5fa' },
  { label: 'Text Emotion Analysis', path: '/analyze', keywords: ['text', 'goemotions', 'writing', 'sentence'], icon: FiActivity, color: '#a78bfa' },
  { label: 'Voice Emotion Analysis', path: '/voice', keywords: ['voice', 'audio', 'speech', 'crema', 'recording', 'mic'], icon: FiMic, color: '#34d399' },
  { label: 'PHQ-9 Assessment', path: '/phq9', keywords: ['phq', 'phq9', 'depression', 'assessment', 'questionnaire'], icon: FiBarChart2, color: '#fb923c' },
  { label: 'Fusion Workspace', path: '/fusion', keywords: ['fusion', 'multimodal', 'all', 'combine', 'holistic'], icon: FiLayers, color: '#f472b6' },
  { label: 'Analysis Reports', path: '/reports', keywords: ['reports', 'history', 'logs', 'past'], icon: FiFileText, color: '#818cf8' },
  { label: 'Account Settings', path: '/settings', keywords: ['settings', 'account', 'profile', 'name', 'edit'], icon: FiSettings, color: '#94a3b8' },
];

export default function TopBar({ title, subtitle, profile, theme, onToggleTheme, onOpenSettings }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [results, setResults] = useState([]);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const containerRef = useRef(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Live search filtering
  useEffect(() => {
    if (!searchVal.trim()) {
      setResults([]);
      return;
    }
    const q = searchVal.toLowerCase().trim();
    const filtered = SEARCH_PAGES.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.keywords.some(k => k.includes(q))
    );
    setResults(filtered);
  }, [searchVal]);

  // Click outside to close search suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        if (!searchVal) setSearchOpen(false);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchVal]);

  const handleSelectPage = (path) => {
    navigate(path);
    setSearchVal('');
    setResults([]);
    setSearchOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (results.length > 0) {
        handleSelectPage(results[0].path);
      } else if (searchVal.trim()) {
        const q = searchVal.toLowerCase().trim();
        const matched = SEARCH_PAGES.find(p => p.keywords.some(k => k.includes(q)));
        if (matched) handleSelectPage(matched.path);
      }
    }
  };

  const addRipple = (e) => {
    const btn = e.currentTarget;
    const circle = document.createElement('span');
    const diameter = Math.max(btn.clientWidth, btn.clientHeight);
    const radius = diameter / 2;
    const rect = btn.getBoundingClientRect();
    circle.style.cssText = `
      width: ${diameter}px; height: ${diameter}px;
      left: ${e.clientX - rect.left - radius}px;
      top: ${e.clientY - rect.top - radius}px;
    `;
    circle.classList.add('ripple-effect');
    const old = btn.querySelector('.ripple-effect');
    if (old) old.remove();
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 700);
  };

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center justify-between px-6"
      style={{
        left: 'var(--sidebar-width, 240px)',
        height: 68,
        background: 'var(--surface-topbar)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(20px)',
        transition: 'left 0.25s ease, background 0.3s ease',
      }}
    >
      {/* Left: Title */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent-purple)', marginBottom: 2 }}>
          {greeting}, {profile?.full_name?.split(' ')[0] || 'User'} 👋
        </p>
        <h1
          className="font-display font-bold leading-none"
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
          }}
        >
          {title}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Functional Search Bar */}
        <div ref={containerRef} className="relative">
          <motion.div
            animate={{ width: searchOpen ? 240 : 40 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="relative overflow-hidden"
            style={{ height: 36 }}
          >
            <button
              type="button"
              onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 100); }}
              className="absolute left-0 top-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all"
              style={{ background: 'var(--surface-soft)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              title="Search pages (text, voice, phq9, fusion...)"
            >
              <FiSearch size={16} />
            </button>
            {searchOpen && (
              <input
                ref={searchRef}
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search text, voice, fusion..."
                className="absolute inset-0 pl-9 pr-3 text-xs rounded-xl outline-none"
                style={{
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--border-active)',
                  color: 'var(--text-primary)',
                  width: '100%',
                }}
              />
            )}
          </motion.div>

          {/* Instant Search Suggestions Dropdown */}
          <AnimatePresence>
            {searchOpen && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute right-0 top-11 w-64 rounded-xl shadow-2xl overflow-hidden z-50 p-2"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-active)',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)', fontSize: 10 }}>
                  Quick Navigation
                </p>
                {results.map(({ label, path, icon: Icon, color }) => (
                  <button
                    key={path}
                    onClick={() => handleSelectPage(path)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <span className="flex-1 truncate">{label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Light / Dark Mode Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="relative flex items-center justify-center rounded-xl transition-all"
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

        {/* Profile Pill & Settings Trigger */}
        <div
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
          style={{
            background: 'var(--surface-soft)',
            border: '1px solid var(--border-subtle)',
          }}
          title="Click to edit account name in Settings"
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white' }}
          >
            {(profile?.full_name || 'U')[0].toUpperCase()}
          </div>
          <span className="text-xs font-medium hidden sm:block" style={{ color: 'var(--text-primary)' }}>
            {profile?.full_name?.split(' ')[0] || 'User'}
          </span>
          <FiChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
        </div>

        {/* New Analysis Button */}
        <NavLink
          to="/fusion"
          onClick={addRipple}
          className="ripple-btn glow-btn flex items-center gap-2 px-4 rounded-xl text-sm font-semibold text-white"
          style={{ height: 36, textDecoration: 'none', minWidth: 130 }}
        >
          <FiPlus size={15} />
          <span className="hidden sm:block">New Analysis</span>
          <span className="sm:hidden">New</span>
        </NavLink>
      </div>
    </header>
  );
}
