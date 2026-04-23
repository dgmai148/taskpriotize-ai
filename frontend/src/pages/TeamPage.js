import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, analyticsApi } from '../api/client';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';

export default function TeamPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      userApi.list(),
      analyticsApi.teamWorkload(),
    ]).then(([u, w]) => {
      setUsers(Array.isArray(u) ? u : []);
      setWorkload(Array.isArray(w) ? w : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center loading-pulse" style={{ padding: 60 }}>Loading team...</div>;

  // Merge workload data into users
  const workloadMap = {};
  workload.forEach(w => { workloadMap[w.user_id || w.assignee_id] = w; });

  const filteredUsers = users.filter(u => {
    if (filter && u.role !== filter) return false;
    if (search && !(u.name || '').toLowerCase().includes(search.toLowerCase()) && !(u.email || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const roleGroups = { admin: [], pm: [], developer: [] };
  filteredUsers.forEach(u => { if (roleGroups[u.role]) roleGroups[u.role].push(u); });

  const totalActive = users.filter(u => u.is_active !== false).length;
  const admins = users.filter(u => u.role === 'admin').length;
  const pms = users.filter(u => u.role === 'pm').length;
  const devs = users.filter(u => u.role === 'developer').length;

  return (
    <div className="fade-in">
      <div className="dashboard-header-row mb-lg">
        <div className="dashboard-header">
          <h1>Team Overview</h1>
          <p>Manage team members and monitor workload</p>
        </div>
      </div>

      <div className="stats-grid mb-lg">
        <StatCard label="Total Members" value={totalActive} color="var(--primary)" />
        <StatCard label="Admins" value={admins} color="var(--critical)" />
        <StatCard label="Project Managers" value={pms} color="var(--info)" />
        <StatCard label="Developers" value={devs} color="var(--success)" />
      </div>

      {/* Filter bar */}
      <div className="card filter-bar mb-md">
        <div className="filter-bar-inner">
          <input className="form-input" type="text" placeholder="Search members..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
          <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="pm">Project Manager</option>
            <option value="developer">Developer</option>
          </select>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState title="No team members found" description="Try adjusting your search or filter." />
      ) : (
        <div className="team-grid">
          {filteredUsers.map(u => {
            const w = workloadMap[u.id] || {};
            const tasks = w.total || w.task_count || 0;
            const inProgress = w.in_progress || 0;
            const done = w.done || w.completed || 0;
            const load = tasks > 0 ? Math.min(100, Math.round(((tasks - done) / Math.max(tasks, 1)) * 100)) : 0;
            const roleColor = u.role === 'admin' ? '#7c3aed' : u.role === 'pm' ? '#2563eb' : '#059669';

            return (
              <div key={u.id} className="team-card card card-hover">
                <div className="team-card-header">
                  <div className="avatar avatar-lg" style={{ background: u.avatar_color || roleColor }}>
                    {(u.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="team-card-info">
                    <div className="team-card-name">{u.name}</div>
                    <div className="team-card-email">{u.email}</div>
                    <span className={`badge badge-${u.role === 'admin' ? 'critical' : u.role === 'pm' ? 'open' : 'done'}`}>{u.role}</span>
                  </div>
                  {u.is_active === false && <span className="badge badge-blocked">Inactive</span>}
                </div>

                <div className="team-card-stats">
                  <div className="team-stat">
                    <span className="team-stat-value">{tasks}</span>
                    <span className="team-stat-label">Tasks</span>
                  </div>
                  <div className="team-stat">
                    <span className="team-stat-value">{inProgress}</span>
                    <span className="team-stat-label">Active</span>
                  </div>
                  <div className="team-stat">
                    <span className="team-stat-value">{done}</span>
                    <span className="team-stat-label">Done</span>
                  </div>
                </div>

                <div className="team-card-workload">
                  <div className="flex-between mb-sm">
                    <span className="text-sm">Workload</span>
                    <span className="text-sm" style={{ fontWeight: 600, color: load > 80 ? 'var(--danger)' : load > 50 ? 'var(--warning)' : 'var(--success)' }}>{load}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${load}%`, background: load > 80 ? 'var(--danger)' : load > 50 ? 'var(--warning)' : 'var(--success)' }} />
                  </div>
                </div>

                {u.created_at && (
                  <div className="team-card-footer">
                    Joined {new Date(u.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
