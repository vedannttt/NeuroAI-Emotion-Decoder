import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiHome, FiActivity, FiMic, FiBarChart2, FiLayers,
  FiFileText, FiSettings, FiLogOut, FiChevronLeft,
  FiChevronRight, FiHeart, FiZap
} from 'react-icons/fi';

const navItems = [
  { icon: FiHome, label: 'Dashboard', to: '/dashboard', color: '#60a5fa' },
  { icon: FiActivity, label: 'Text Analysis', to: '/analyze', color: '#a78bfa' },
  { icon: FiMic, label: 'Voice Analysis', to: '/voice', color: '#34d399' },
  { icon: FiBarChart2, label: 'PHQ-9', to: '/phq9', color: '#fb923c' },
  { icon: FiLayers, label: 'Fusion', to: '/fusion', color: '#f472b6' },
  { icon: FiFileText, label: 'Reports', to: '/reports', color: '#818cf8' },
  { icon: FiSettings, label: 'Settings', to: '/settings', color: '#94a3b8' },
];

export default function Sidebar({ profile, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const navigate = useNavigate();

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const sidebarVariants = {
    expanded: { width: 240 },
    collapsed: { width: 72 },
  };

  return (
    <motion.aside
      variants={sidebarVariants}
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-y-0 left-0 z-40 flex flex-col"
      style={{
        background: 'var(--surface-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Top: Brand */}
      <div className="flex items-center justify-between gap-2 px-4 py-5" style={{ minHeight: 68 }}>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="brand min-w-0"
            >
              <div className="brand-icon">
                <FiHeart size={16} />
              </div>
              <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                neuro<span style={{ color: 'var(--accent-purple)' }}>AI</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="brand-icon mx-auto">
            <FiHeart size={16} />
          </div>
        )}

        <button
          onClick={toggleCollapse}
          className="sidebar-toggle flex items-center justify-center transition-all duration-200"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          type="button"
        >
          {collapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-1">
        {/* Section label */}
        {!collapsed && (
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
            Navigation
          </p>
        )}
        {navItems.map(({ icon: Icon, label, to, color }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={collapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                <span
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
                  style={{ color: isActive ? color : undefined }}
                >
                  <Icon size={18} />
                </span>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && !collapsed && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Profile + Logout */}
      <div className="px-3 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        {/* Profile Card */}
        {!collapsed && profile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'var(--surface-soft)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white' }}
            >
              {(profile.full_name || 'U')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {profile.full_name || 'User'}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                {profile.email || ''}
              </p>
            </div>
          </motion.div>
        )}
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="sidebar-link w-full"
          title={collapsed ? 'Sign out' : undefined}
          style={{ color: 'rgba(248,113,113,0.8)' }}
        >
          <FiLogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </motion.aside>
  );
}
