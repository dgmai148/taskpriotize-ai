import React, { useState, useEffect } from 'react';
import { analyticsApi, projectApi } from '../api/client';
import StatCard from '../components/StatCard';
import MiniBarChart from '../components/MiniBarChart';
import ProgressRing from '../components/ProgressRing';
import EmptyState from '../components/EmptyState';

export default function ReportsPage() {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [priorityDist, setPriorityDist] = useState(null);
  const [projectHealth, setProjectHealth] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectAnalytics, setProjectAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    Promise.all([
      analyticsApi.overview(),
      analyticsApi.trends(),
      analyticsApi.priorityDistribution(),
      analyticsApi.projectHealth(),
      projectApi.list(),
      analyticsApi.teamWorkload(),
    ]).then(([ov, tr, pd, ph, pr, tw]) => {
      setOverview(ov);
      setTrends(tr);
      setPriorityDist(pd);
      setProjectHealth(Array.isArray(ph) ? ph : []);
      setProjects(Array.isArray(pr) ? pr : []);
      setTeamWorkload(Array.isArray(tw) ? tw : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProject) {
      analyticsApi.project(selectedProject).then(setProjectAnalytics).catch(() => setProjectAnalytics(null));
    } else {
      setProjectAnalytics(null);
    }
  }, [selectedProject]);

  if (loading) return <div className="text-center loading-pulse" style={{ padding: 60 }}>Loading reports...</div>;

  const trendData = trends?.daily || trends || [];
  const completionRate = overview ? ((overview.tasks_done || 0) / Math.max(overview.total_tasks || 1, 1) * 100).toFixed(1) : 0;
  const priorityColors = { critical: 'var(--critical)', high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--info)' };
  const priorityData = priorityDist ? (Array.isArray(priorityDist) ? priorityDist.map(p => ({ priority: p.manual_priority || p.priority, count: p.count || 0 })) : Object.entries(priorityDist).map(([k, v]) => ({ priority: k, count: typeof v === 'number' ? v : (v?.count || 0) }))) : [];
  const totalPriorityTasks = priorityData.reduce((s, p) => s + (p.count || 0), 0);

  return (
    <div className="fade-in">
      <div className="dashboard-header-row mb-lg">
        <div className="dashboard-header">
          <h1>Reports & Analytics</h1>
          <p>Comprehensive insights across all projects and teams</p>
        </div>
        <div className="header-actions">
          <div className="tab-bar">
            {['overview', 'projects', 'team', 'trends'].map(tab => (
              <button key={tab} className={`tab-btn ${activeTab === tab ? 'tab-active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="stats-grid mb-lg">
            <StatCard label="Total Projects" value={overview?.total_projects || 0} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>} color="var(--primary)" />
            <StatCard label="Total Tasks" value={overview?.total_tasks || 0} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>} color="var(--info)" />
            <StatCard label="Completed" value={overview?.tasks_done || 0} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>} color="var(--success)" />
            <StatCard label="Completion Rate" value={`${completionRate}%`} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>} color="var(--critical)" />
            <StatCard label="Active Users" value={overview?.total_users || 0} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>} color="var(--warning)" />
            <StatCard label="Overdue" value={overview?.tasks_overdue || projectHealth.reduce((s, p) => s + (p.overdue_count || 0), 0)} icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} color="var(--danger)" />
          </div>

          <div className="grid-2 mb-lg">
            <div className="card">
              <div className="card-header"><h2>30-Day Task Trends</h2></div>
              {trendData.length > 0 ? (
                <>
                  <MiniBarChart data={trendData.map(d => ({ label: '', value: d.completed || d.completed_count || 0, color: 'var(--primary)' }))} height={120} />
                  <div className="chart-summary">Daily completed tasks over the last 30 days</div>
                </>
              ) : <EmptyState title="No trend data" description="Trends appear once tasks are completed over time." />}
            </div>

            <div className="card">
              <div className="card-header"><h2>Priority Distribution</h2></div>
              {priorityData.length > 0 ? (
                <div className="priority-breakdown">
                  {priorityData.map(p => (
                    <div key={p.priority} className="priority-breakdown-row">
                      <div className="priority-breakdown-label">
                        <span className="priority-dot" style={{ background: priorityColors[p.priority] || 'var(--text-secondary)' }} />
                        <span className="text-capitalize">{p.priority}</span>
                      </div>
                      <div className="priority-breakdown-bar">
                        <div className="priority-breakdown-fill" style={{ width: `${(p.count / totalPriorityTasks) * 100}%`, background: priorityColors[p.priority] || 'var(--text-secondary)' }} />
                      </div>
                      <span className="priority-breakdown-count">{p.count}</span>
                      <span className="priority-breakdown-pct">{((p.count / totalPriorityTasks) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No data" description="Create tasks with different priorities to see distribution." />}
            </div>
          </div>

          <div className="card mb-lg">
            <div className="card-header"><h2>Project Health Overview</h2></div>
            {projectHealth.length > 0 ? (
              <div className="report-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Health</th>
                      <th>Total Tasks</th>
                      <th>Completed</th>
                      <th>Overdue</th>
                      <th>Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectHealth.map(p => {
                      const total = p.total_tasks || 0;
                      const done = p.done_tasks || p.completed_count || 0;
                      const overdue = p.overdue_count || 0;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <tr key={p.project_id || p.id}>
                          <td><strong>{p.project_name || p.name}</strong></td>
                          <td><span className={`health-badge health-${p.health || 'green'}`}><span className={`health-dot health-${p.health || 'green'}`} /> {p.health || 'Good'}</span></td>
                          <td>{total}</td>
                          <td>{done}</td>
                          <td className={overdue > 0 ? 'text-danger' : ''}>{overdue}</td>
                          <td>
                            <div className="flex-center gap-sm">
                              <ProgressRing size={28} strokeWidth={3} progress={pct} color={pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)'} />
                              <span className="text-sm">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState title="No projects" description="Create projects to see health status." />}
          </div>
        </>
      )}

      {activeTab === 'projects' && (
        <>
          <div className="card mb-lg">
            <div className="card-header">
              <h2>Project Drill-Down</h2>
              <select className="form-select" style={{ maxWidth: 250 }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                <option value="">Select a project...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {projectAnalytics ? (
              <div>
                {(() => {
                  const sd = {};
                  let totalTasks = 0;
                  if (Array.isArray(projectAnalytics.status_distribution)) {
                    projectAnalytics.status_distribution.forEach(s => { sd[s.status] = parseInt(s.count) || 0; totalTasks += parseInt(s.count) || 0; });
                  } else if (projectAnalytics.status_distribution) {
                    Object.entries(projectAnalytics.status_distribution).forEach(([k, v]) => { sd[k] = parseInt(v) || 0; totalTasks += parseInt(v) || 0; });
                  }
                  return (
                    <div className="stats-grid mb-md">
                      <StatCard label="Total" value={totalTasks} color="var(--primary)" />
                      <StatCard label="In Progress" value={sd.in_progress || 0} color="var(--warning)" />
                      <StatCard label="Done" value={sd.done || 0} color="var(--success)" />
                      <StatCard label="Blocked" value={sd.blocked || 0} color="var(--danger)" />
                    </div>
                  );
                })()}
                {projectAnalytics.top_scored && projectAnalytics.top_scored.length > 0 && (
                  <>
                    <h3 className="section-title">Top AI-Scored Tasks</h3>
                    <div className="report-table">
                      <table className="data-table">
                        <thead><tr><th>Score</th><th>Task</th><th>Priority</th><th>Status</th></tr></thead>
                        <tbody>
                          {projectAnalytics.top_scored.slice(0, 10).map(t => (
                            <tr key={t.id}>
                              <td><span className="score-pill">{Math.round(t.ai_priority_score || 0)}</span></td>
                              <td>{t.title}</td>
                              <td><span className={`badge badge-${t.manual_priority}`}>{t.manual_priority}</span></td>
                              <td><span className={`badge badge-${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : <EmptyState title="Select a project" description="Choose a project above to see detailed analytics." />}
          </div>
        </>
      )}

      {activeTab === 'team' && (
        <div className="card mb-lg">
          <div className="card-header"><h2>Team Workload Distribution</h2></div>
          {teamWorkload.length > 0 ? (
            <div className="report-table">
              <table className="data-table">
                <thead><tr><th>Team Member</th><th>Assigned</th><th>In Progress</th><th>Completed</th><th>Workload</th></tr></thead>
                <tbody>
                  {teamWorkload.map(m => {
                    const total = m.total || m.task_count || 0;
                    const inProgress = m.in_progress || 0;
                    const done = m.done || m.completed || 0;
                    const load = total > 0 ? Math.min(100, Math.round((inProgress / Math.max(total, 1)) * 100)) : 0;
                    return (
                      <tr key={m.user_id || m.assignee_id}>
                        <td>
                          <div className="flex-center gap-sm">
                            <div className="avatar avatar-sm" style={{ background: m.avatar_color || '#4f46e5' }}>{(m.name || m.assignee_name || '?')[0].toUpperCase()}</div>
                            <strong>{m.name || m.assignee_name}</strong>
                          </div>
                        </td>
                        <td>{total}</td>
                        <td>{inProgress}</td>
                        <td>{done}</td>
                        <td>
                          <div className="workload-visual">
                            <div className="progress-bar" style={{ width: 100 }}>
                              <div className="progress-fill" style={{ width: `${load}%`, background: load > 80 ? 'var(--danger)' : load > 50 ? 'var(--warning)' : 'var(--success)' }} />
                            </div>
                            <span className="workload-label">{load}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No workload data" description="Assign tasks to team members to see workload distribution." />}
        </div>
      )}

      {activeTab === 'trends' && (
        <>
          <div className="grid-2 mb-lg">
            <div className="card">
              <div className="card-header"><h2>Tasks Created (30 days)</h2></div>
              {trendData.length > 0 ? (
                <MiniBarChart data={trendData.map(d => ({ label: '', value: d.created || d.created_count || 0, color: 'var(--info)' }))} height={140} />
              ) : <EmptyState title="No data" />}
            </div>
            <div className="card">
              <div className="card-header"><h2>Tasks Completed (30 days)</h2></div>
              {trendData.length > 0 ? (
                <MiniBarChart data={trendData.map(d => ({ label: '', value: d.completed || d.completed_count || 0, color: 'var(--success)' }))} height={140} />
              ) : <EmptyState title="No data" />}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h2>Daily Breakdown</h2></div>
            <div className="report-table">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Created</th><th>Completed</th><th>Net Change</th></tr></thead>
                <tbody>
                  {trendData.slice(-14).reverse().map((d, i) => {
                    const created = d.created || d.created_count || 0;
                    const completed = d.completed || d.completed_count || 0;
                    const net = created - completed;
                    return (
                      <tr key={i}>
                        <td>{d.date ? new Date(d.date).toLocaleDateString() : `Day ${i + 1}`}</td>
                        <td>{created}</td>
                        <td>{completed}</td>
                        <td className={net > 0 ? 'text-warning' : net < 0 ? 'text-danger' : ''}>{net > 0 ? '+' : ''}{net}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
