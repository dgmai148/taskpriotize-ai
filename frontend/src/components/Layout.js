import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationApi, taskApi, projectApi } from '../api/client';

const ICONS = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  projects: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  tasks: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  audit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  bell: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  profile: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  board: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  analytics: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
};

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function GlobalSearch({ navigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ tasks: [], projects: [] });
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const ref = useRef(null);
  const timerRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults({ tasks: [], projects: [] }); return; }
    setSearching(true);
    try {
      const [tasks, projects] = await Promise.all([
        taskApi.list({ search: q }).catch(() => []),
        projectApi.list().catch(() => []),
      ]);
      const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(q.toLowerCase())
      );
      setResults({ tasks: tasks.slice(0, 8), projects: filteredProjects.slice(0, 5) });
    } catch {
      setResults({ tasks: [], projects: [] });
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const goTo = (path) => { navigate(path); setOpen(false); setQuery(''); };
  const hasResults = results.tasks.length > 0 || results.projects.length > 0;

  return (
    <div className="global-search" ref={ref}>
      <div className="global-search-input">
        {ICONS.search}
        <input type="text" placeholder="Search tasks & projects..." value={query} onChange={handleChange}
          onFocus={() => query && setOpen(true)} />
        {query && <button className="btn-icon" onClick={() => { setQuery(''); setResults({ tasks: [], projects: [] }); }} style={{ padding: 2 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>}
      </div>
      {open && query.trim() && (
        <div className="search-dropdown">
          {searching && <div className="search-loading">Searching...</div>}
          {!searching && !hasResults && <div className="search-empty">No results found</div>}
          {results.projects.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Projects</div>
              {results.projects.map(p => (
                <div key={p.id} className="search-result-item" onClick={() => goTo(`/projects/${p.id}`)}>
                  {ICONS.projects}
                  <div>
                    <div className="search-result-title">{p.name}</div>
                    {p.description && <div className="search-result-sub">{p.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {results.tasks.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Tasks</div>
              {results.tasks.map(t => (
                <div key={t.id} className="search-result-item" onClick={() => goTo(`/projects/${t.project_id}`)}>
                  {ICONS.tasks}
                  <div>
                    <div className="search-result-title">{t.title}</div>
                    <div className="search-result-sub">
                      <span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span>
                      {t.project_name && <span> in {t.project_name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let interval;
    const fetchCount = () => {
      notificationApi.unreadCount().then(d => setUnreadCount(d.count)).catch(() => {});
    };
    fetchCount();
    interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const navItems = [];
  navItems.push({ to: '/', icon: ICONS.dashboard, label: 'Dashboard', end: true });

  if (user.role === 'pm' || user.role === 'developer') {
    navItems.push({ to: '/my-tasks', icon: ICONS.tasks, label: 'My Tasks' });
  }

  navItems.push({ to: '/calendar', icon: ICONS.calendar, label: 'Calendar' });

  if (user.role === 'pm' || user.role === 'admin') {
    navItems.push({ section: 'INSIGHTS' });
    navItems.push({ to: '/reports', icon: ICONS.analytics, label: 'Reports' });
    navItems.push({ to: '/team', icon: ICONS.users, label: 'Team Overview' });
  }

  if (user.role === 'admin') {
    navItems.push({ section: 'MANAGEMENT' });
    navItems.push({ to: '/my-tasks', icon: ICONS.tasks, label: 'All Tasks' });
    navItems.push({ to: '/users', icon: ICONS.users, label: 'User Management' });
    navItems.push({ to: '/audit-log', icon: ICONS.audit, label: 'Audit Log' });
  }

  navItems.push({ section: 'ACCOUNT' });
  navItems.push({ to: '/notifications', icon: ICONS.bell, label: 'Notifications', badge: unreadCount });
  navItems.push({ to: '/profile', icon: ICONS.profile, label: 'Profile' });

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h1>TaskPrio AI</h1>
        <div className="subtitle">Smart Task Prioritization</div>
        <GlobalSearch navigate={navigate} />
        <nav>
          {navItems.map((item, i) =>
            item.section ? (
              <div key={item.section} className="nav-section-label">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => isActive ? 'active' : ''}>
                {item.icon}
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </NavLink>
            )
          )}
        </nav>
        <div className="user-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar avatar-md" style={{ background: user.avatar_color || '#4f46e5' }}>
              {getInitials(user.name)}
            </div>
            <div>
              <div className="name">{user.name}</div>
              <div className="role">{user.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-sm sidebar-logout">Sign Out</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
