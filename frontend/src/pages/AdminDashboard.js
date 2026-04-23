import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi, projectApi, auditApi } from '../api/client';
import StatCard from '../components/StatCard';
import MiniBarChart from '../components/MiniBarChart';
import ProgressRing from '../components/ProgressRing';
import QuickActions from '../components/QuickActions';
import ActivityFeed from '../components/ActivityFeed';
import HealthBadge from '../components/HealthBadge';
import EmptyState from '../components/EmptyState';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const trendsRef = useRef(null);
  const [overview, setOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [recentAudit, setRecentAudit] = useState([]);
  const [trends, setTrends] = useState(null);
  const [priorityDist, setPriorityDist] = useState(null);
  const [projectHealth, setProjectHealth] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.overview(),
      projectApi.list(),
      auditApi.list({ limit: 10 }),
      analyticsApi.trends(),
      analyticsApi.priorityDistribution(),
      analyticsApi.projectHealth(),
      analyticsApi.userActivity().catch(() => []),
      analyticsApi.teamWorkload().catch(() => []),
    ])
      .then(([ov, pr, au, tr, pd, ph, ua, tw]) => {
        setOverview(ov);
        setProjects(Array.isArray(pr) ? pr : []);
        const auditList = Array.isArray(au) ? au : au?.logs || au?.data || [];
        setRecentAudit(auditList);
        setTrends(tr);
        setPriorityDist(pd);
        setProjectHealth(Array.isArray(ph) ? ph : []);
        setUserActivity(Array.isArray(ua) ? ua : []);
        setTeamWorkload(Array.isArray(tw) ? tw : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="stats-grid">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
    );
  }

  const o = overview || { users: {}, projects: {}, tasks: {} };
  const days = trends?.days || [];
  const distribution = priorityDist?.distribution || [];

  const priorityColorMap = {
    critical: '#7c3aed',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#3b82f6',
  };

  const totalPriorityCount =
    distribution.reduce((sum, d) => sum + (parseInt(d.count) || 0), 0) || 1;
  const totalCreated = days.reduce((s, d) => s + (parseInt(d.created) || 0), 0);
  const totalCompleted = days.reduce(
    (s, d) => s + (parseInt(d.completed) || 0),
    0
  );
  const maxCompleted = Math.max(...days.map((d) => parseInt(d.completed) || 0), 1);

  /* --- Derived data for new sections --- */
  const totalTasks = parseInt(o.tasks?.total) || 0;
  const doneTasks = parseInt(o.tasks?.done) || 0;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const adminCount = parseInt(o.users?.admins) || 0;
  const pmCount = parseInt(o.users?.pms) || parseInt(o.users?.project_managers) || 0;
  const devCount = parseInt(o.users?.devs) || parseInt(o.users?.developers) || 0;
  const totalUsers = parseInt(o.users?.total) || 1;
  const roleBreakdown = [
    { label: 'Admins', count: adminCount, color: 'var(--critical)' },
    { label: 'PMs', count: pmCount, color: 'var(--warning)' },
    { label: 'Devs', count: devCount, color: 'var(--primary)' },
  ];

  const topPerformers = [...teamWorkload]
    .map((m) => ({
      id: m.user_id || m.assignee_id,
      name: m.name || m.assignee_name || 'Unknown',
      completed: parseInt(m.done || m.completed) || 0,
      total: parseInt(m.total || m.task_count) || 0,
      color: m.avatar_color || '#4f46e5',
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const d = Math.floor(hrs / 24);
    return `${d}d ago`;
  };

  const quickActions = [
    {
      label: 'Manage Users',
      onClick: () => navigate('/users'),
      bg: 'var(--primary-light)',
      color: 'var(--primary)',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      label: 'Audit Log',
      onClick: () => navigate('/audit-log'),
      bg: 'var(--success-bg)',
      color: 'var(--success)',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      label: 'View Reports',
      onClick: () => {
        if (trendsRef.current) {
          trendsRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      },
      bg: 'var(--warning-bg)',
      color: 'var(--warning)',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* 1. Dashboard Header */}
      <div className="dashboard-header-row">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <p>System overview &amp; management</p>
        </div>
      </div>

      {/* 2. Stat Cards */}
      <div className="stats-grid">
        <StatCard
          label="Total Users"
          value={o.users?.total ?? 0}
          color="var(--primary)"
          sub={`${o.users?.active ?? 0} active`}
        />
        <StatCard
          label="Projects"
          value={o.projects?.total ?? 0}
          color="var(--success)"
          sub={`${o.projects?.active ?? 0} active`}
        />
        <StatCard
          label="Total Tasks"
          value={o.tasks?.total ?? 0}
          color="var(--warning)"
          sub={`${o.tasks?.overdue ?? 0} overdue`}
        />
        <StatCard
          label="Avg AI Score"
          value={`${parseFloat(o.tasks?.avg_ai_score || 0).toFixed(1)}`}
          color="var(--critical)"
          sub="across all tasks"
        />
      </div>

      {/* 2b. Task Completion Rate Ring + System Summary */}
      <div className="grid-2">
        {/* Left: Task Completion Rate Ring */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="card-header" style={{ width: '100%' }}>
            <h3>Task Completion Rate</h3>
          </div>
          <ProgressRing
            value={completionRate}
            size={120}
            strokeWidth={10}
            color={completionRate >= 70 ? 'var(--success)' : completionRate >= 40 ? 'var(--warning)' : 'var(--danger)'}
            label={`${completionRate}%`}
          />
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text)' }}>{doneTasks}</strong> of <strong style={{ color: 'var(--text)' }}>{totalTasks}</strong> tasks completed
            </span>
          </div>
        </div>

        {/* Right: System Summary Card */}
        <div className="card">
          <div className="card-header">
            <h3>System Summary</h3>
            <span className="badge badge-done">System Online</span>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--font-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 10 }}>Users by Role</div>
            {roleBreakdown.map((r) => {
              const pct = totalUsers > 0 ? Math.round((r.count / totalUsers) * 100) : 0;
              return (
                <div className="bar-horizontal" key={r.label}>
                  <div className="bar-header">
                    <span className="bar-label">{r.label}</span>
                    <span className="bar-value">{r.count}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: r.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--success)' }}>{o.users?.active ?? 0}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Active</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--text-secondary)' }}>{Math.max(0, (o.users?.total ?? 0) - (o.users?.active ?? 0))}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Inactive</div>
            </div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 'var(--weight-bold)', color: 'var(--primary)' }}>{o.users?.total ?? 0}</div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <QuickActions actions={quickActions} />
      </div>

      {/* 4. Trend + Priority Distribution */}
      <div className="grid-2" ref={trendsRef}>
        {/* Left: Task Completion Trend */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Task Completion Trend</h3>
              <p className="card-subtitle">Last 30 days</p>
            </div>
          </div>
          {days.length > 0 ? (
            <>
              <MiniBarChart
                data={days.map((d, i) => {
                  const val = parseInt(d.completed) || 0;
                  return {
                    value: val,
                    label: `${i + 1}`,
                    color:
                      val >= maxCompleted * 0.75
                        ? 'var(--success)'
                        : val >= maxCompleted * 0.4
                        ? 'var(--warning)'
                        : 'var(--primary)',
                  };
                })}
                height={120}
                tall
              />
              <div className="chart-summary">
                {totalCreated} created &middot; {totalCompleted} completed this month
              </div>
            </>
          ) : (
            <EmptyState
              title="No trend data"
              description="Trends appear as tasks are created and completed"
            />
          )}
        </div>

        {/* Right: Priority Distribution */}
        <div className="card">
          <div className="card-header">
            <h3>Priority Distribution</h3>
          </div>
          {distribution.length > 0 ? (
            <div className="priority-bars">
              {['critical', 'high', 'medium', 'low'].map((level) => {
                const entry = distribution.find(
                  (d) => d.manual_priority === level
                ) || { count: 0, active_count: 0 };
                const count = parseInt(entry.count) || 0;
                const pct = ((count / totalPriorityCount) * 100).toFixed(0);
                return (
                  <div className="bar-horizontal" key={level}>
                    <div className="bar-header">
                      <span className="bar-label">
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </span>
                      <span className="bar-value">{count}</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: priorityColorMap[level],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No priority data" />
          )}
        </div>
      </div>

      {/* 5. Task Status Breakdown */}
      <div className="card">
        <div className="card-header">
          <h3>Task Status Overview</h3>
        </div>
        <div className="status-badges-grid">
          {[
            ['open', o.tasks?.open],
            ['in_progress', o.tasks?.in_progress],
            ['review', o.tasks?.review],
            ['done', o.tasks?.done],
            ['blocked', o.tasks?.blocked],
          ].map(([status, count]) => (
            <div key={status} className="status-badge-item">
              <div className="status-count">{count ?? 0}</div>
              <span className={`badge badge-${status}`}>
                {status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
        <div className="status-extra-row">
          <div className="status-extra-item">
            <strong className="text-critical">{o.tasks?.critical ?? 0}</strong>
            <span className="text-sm">critical tasks</span>
          </div>
          <div className="status-extra-item">
            <strong className="text-warning">{o.tasks?.high_priority ?? 0}</strong>
            <span className="text-sm">high priority</span>
          </div>
          <div className="status-extra-item">
            <strong>{o.recent_activity_count ?? 0}</strong>
            <span className="text-sm">activity this week</span>
          </div>
        </div>
      </div>

      {/* 6. Project Health Summary */}
      <div className="card">
        <div className="card-header">
          <h3>Project Health</h3>
        </div>
        {projectHealth.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create a project to see health metrics here."
          />
        ) : (
          <div className="project-health-list">
            {projectHealth.map((ph) => {
              const taskCount = parseInt(ph.task_count) || 0;
              const doneCount = parseInt(ph.done_count) || 0;
              const overdueCount = parseInt(ph.overdue_count) || 0;
              const completion =
                taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
              return (
                <div
                  key={ph.id}
                  className="project-health-row"
                  onClick={() => navigate(`/projects/${ph.id}`)}
                >
                  <div className="ph-name">{ph.name}</div>
                  <HealthBadge health={ph.health} />
                  <ProgressRing
                    value={completion}
                    size={36}
                    strokeWidth={3}
                    color={
                      ph.health === 'green'
                        ? 'var(--success)'
                        : ph.health === 'yellow'
                        ? 'var(--warning)'
                        : 'var(--critical)'
                    }
                  />
                  <span className="ph-meta">
                    {taskCount} task{taskCount !== 1 ? 's' : ''}
                  </span>
                  {overdueCount > 0 && (
                    <span className="ph-overdue">
                      {overdueCount} overdue
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. User Activity Feed + Projects */}
      <div className="grid-2">
        {/* Left: User Activity Feed */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <ActivityFeed
            items={userActivity}
            emptyMessage="No recent activity to show"
          />
        </div>

        {/* Right: Projects */}
        <div className="card">
          <div className="card-header">
            <h3>All Projects</h3>
          </div>
          {projects.length === 0 ? (
            <EmptyState title="No projects" />
          ) : (
            <>
              <div className="project-list">
                {projects.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className="project-row"
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div className="project-row-left">
                      <div className="project-row-name">{p.name}</div>
                      <div className="project-row-owner">{p.owner_name}</div>
                    </div>
                    <div className="project-row-right">
                      <div className="project-row-tasks">
                        <strong>{p.task_count ?? 0}</strong> tasks
                      </div>
                      <div className="project-row-done">
                        {p.done_count ?? 0} done
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {projects.length > 8 && (
                <div className="card-footer">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => navigate('/projects')}
                  >
                    View All
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 8. AI Performance */}
      <div className="card card-sm">
        <div className="card-header">
          <h3>AI Performance</h3>
        </div>
        <div className="ai-perf-content">
          <ProgressRing
            value={parseFloat(o.tasks?.avg_ai_score || 0)}
            size={80}
            strokeWidth={6}
            color="var(--primary)"
            label={`${parseFloat(o.tasks?.avg_ai_score || 0).toFixed(1)}`}
          />
          <div className="ai-perf-stats">
            <div className="ai-perf-stat">
              <span className="ai-perf-value">{o.tasks?.total ?? 0}</span>
              <span className="ai-perf-label">Tasks scored</span>
            </div>
            <div className="ai-perf-stat">
              <span className="ai-perf-value">
                {parseFloat(o.tasks?.avg_ai_score || 0).toFixed(1)}
              </span>
              <span className="ai-perf-label">Avg score</span>
            </div>
            <div className="ai-perf-stat">
              <span className="ai-perf-value">{o.tasks?.done ?? 0}</span>
              <span className="ai-perf-label">Completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* 9. Recent Audit Log Table */}
      <div className="card">
        <div className="card-header">
          <h3>Recent Audit Log</h3>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/audit-log')}>
            View All
          </button>
        </div>
        {recentAudit.length === 0 ? (
          <EmptyState title="No audit entries" description="Actions will be logged here as users interact with the system." />
        ) : (
          <div className="report-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.slice(0, 10).map((entry, idx) => (
                  <tr key={entry.id || idx}>
                    <td style={{ whiteSpace: 'nowrap' }}>{timeAgo(entry.created_at || entry.timestamp)}</td>
                    <td>
                      <div className="flex-center gap-sm">
                        <div className="avatar avatar-sm" style={{ background: 'var(--primary)' }}>
                          {(entry.user_name || entry.username || '?')[0].toUpperCase()}
                        </div>
                        <span>{entry.user_name || entry.username || 'System'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        (entry.action || '').toLowerCase().includes('delete') ? 'badge-blocked'
                        : (entry.action || '').toLowerCase().includes('create') ? 'badge-done'
                        : (entry.action || '').toLowerCase().includes('update') ? 'badge-in_progress'
                        : 'badge-open'
                      }`}>
                        {entry.action || 'unknown'}
                      </span>
                    </td>
                    <td>{entry.entity_type || entry.entity || entry.resource || '-'}</td>
                    <td className="text-truncate" style={{ maxWidth: 220 }}>
                      {entry.details || entry.description || entry.entity_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 10. Top Performing Users + Project Timeline */}
      <div className="grid-2">
        {/* Left: Top Performing Users */}
        <div className="card">
          <div className="card-header">
            <h3>Top Performing Users</h3>
          </div>
          {topPerformers.length === 0 ? (
            <EmptyState title="No workload data" description="Assign tasks to team members to see top performers." />
          ) : (
            <div>
              {topPerformers.map((user, rank) => {
                const pct = user.total > 0 ? Math.round((user.completed / user.total) * 100) : 0;
                return (
                  <div className="workload-row" key={user.id || rank}>
                    <div style={{ fontSize: 'var(--font-lg)', fontWeight: 'var(--weight-bold)', color: rank === 0 ? 'var(--warning)' : 'var(--text-secondary)', minWidth: 28, textAlign: 'center' }}>
                      {rank + 1}
                    </div>
                    <div className="avatar avatar-md" style={{ background: user.color }}>
                      {user.name[0].toUpperCase()}
                    </div>
                    <div className="workload-info">
                      <div className="workload-name">{user.name}</div>
                      <div className="workload-meta">{user.completed} completed of {user.total}</div>
                    </div>
                    <div style={{ width: 100 }}>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--primary)' }} />
                      </div>
                    </div>
                    <div className="workload-pct">{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Project Timeline */}
        <div className="card">
          <div className="card-header">
            <h3>Project Timeline</h3>
          </div>
          {projects.length === 0 ? (
            <EmptyState title="No projects" description="Create a project to see the timeline." />
          ) : (
            <div>
              {projects.slice(0, 8).map((p) => {
                const taskCount = parseInt(p.task_count) || 0;
                const doneCount = parseInt(p.done_count) || 0;
                const pct = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
                const barColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--primary)' : pct >= 20 ? 'var(--warning)' : 'var(--danger)';
                return (
                  <div
                    key={p.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div style={{ minWidth: 120, flex: '0 0 auto' }}>
                      <div style={{ fontSize: 'var(--font-sm)', fontWeight: 'var(--weight-semibold)' }} className="text-truncate">{p.name}</div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{doneCount}/{taskCount} tasks</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="progress-bar" style={{ height: 10, borderRadius: 5 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: barColor, borderRadius: 5 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 'var(--weight-bold)', minWidth: 40, textAlign: 'right', color: barColor }}>{pct}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
