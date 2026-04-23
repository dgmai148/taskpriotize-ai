import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi, projectApi, aiApi, taskApi } from '../api/client';
import toast from 'react-hot-toast';
import StatCard from '../components/StatCard';
import MiniBarChart from '../components/MiniBarChart';
import ProgressRing from '../components/ProgressRing';
import QuickActions from '../components/QuickActions';
import CalendarGrid from '../components/CalendarGrid';
import AvatarGroup from '../components/AvatarGroup';
import HealthBadge from '../components/HealthBadge';
import EmptyState from '../components/EmptyState';

export default function PMDashboard() {
  const [projects, setProjects] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState(null);
  const [projectHealth, setProjectHealth] = useState([]);
  const [priorityDist, setPriorityDist] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [quickTaskForm, setQuickTaskForm] = useState({
    title: '', project_id: '', priority: 'medium', assigned_to: '', due_date: ''
  });
  const [aiRunning, setAiRunning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [projs, wl, ov, tr, ph, pd, allTasks] = await Promise.all([
        projectApi.list(),
        analyticsApi.teamWorkload(),
        analyticsApi.overview(),
        analyticsApi.trends(),
        analyticsApi.projectHealth(),
        analyticsApi.priorityDistribution(),
        taskApi.list({}),
      ]);
      setProjects(projs);
      setWorkload(wl);
      setOverview(ov);
      setTrends(tr);
      setProjectHealth(ph);
      setPriorityDist(pd);
      setTasks(Array.isArray(allTasks) ? allTasks : allTasks.tasks || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    try {
      await projectApi.create(newProject);
      toast.success('Project created');
      setShowCreateProject(false);
      setNewProject({ name: '', description: '' });
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleQuickTaskSubmit = async (e) => {
    e.preventDefault();
    if (!quickTaskForm.title.trim()) return;
    try {
      const payload = { ...quickTaskForm };
      if (!payload.project_id) delete payload.project_id;
      if (!payload.assigned_to) delete payload.assigned_to;
      if (!payload.due_date) delete payload.due_date;
      await taskApi.create(payload);
      toast.success('Task created');
      setShowQuickTask(false);
      setQuickTaskForm({ title: '', project_id: '', priority: 'medium', assigned_to: '', due_date: '' });
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRunAI = async (projectId, projectName) => {
    if (aiRunning) return;
    setAiRunning(true);
    try {
      toast.loading('Running AI prioritization...', { id: 'ai' });
      const result = await aiApi.prioritize(projectId);
      toast.success(`${result.updated} tasks prioritized in ${projectName}`, { id: 'ai' });
      loadData();
    } catch (err) {
      toast.error('AI failed: ' + err.message, { id: 'ai' });
    } finally {
      setAiRunning(false);
    }
  };

  const handleUnblock = async (taskId) => {
    try {
      await taskApi.update(taskId, { status: 'in_progress' });
      toast.success('Task unblocked');
      loadData();
    } catch (err) {
      toast.error('Failed to unblock: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="loading-skeleton">
        <div className="skeleton-header" />
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="card stat-card skeleton-card" />)}
        </div>
        <div className="grid-2">
          <div className="card skeleton-card" style={{ height: 200 }} />
          <div className="card skeleton-card" style={{ height: 200 }} />
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Priority color map
  const priorityColors = {
    critical: 'var(--danger)',
    high: '#f97316',
    medium: 'var(--warning)',
    low: 'var(--success)',
    none: 'var(--text-secondary)',
  };

  // Velocity calculation from last 14 days
  const last14 = trends && trends.days ? trends.days.slice(-14) : [];
  const avgVelocity = last14.length > 0
    ? (last14.reduce((sum, d) => sum + (d.completed || 0), 0) / last14.length).toFixed(1)
    : 0;

  // Priority distribution data
  const distItems = priorityDist && priorityDist.distribution ? priorityDist.distribution : [];
  const maxPriorityCount = Math.max(...distItems.map(d => parseInt(d.count) || 0), 1);

  // Risk calculations
  const blockedCount = overview ? parseInt(overview.tasks.blocked) || 0 : 0;
  const overdueCount = overview ? parseInt(overview.tasks.overdue) || 0 : 0;
  const highPriorityCount = overview
    ? (parseInt(overview.tasks.critical) || 0) + (parseInt(overview.tasks.high_priority) || 0)
    : 0;

  // Calendar deadlines
  const deadlines = tasks
    .filter(t => t.due_date)
    .map(t => ({
      date: t.due_date,
      overdue: t.due_date < today && t.status !== 'done',
    }));

  // Project name lookup
  const projectNameMap = {};
  projects.forEach(p => { projectNameMap[p.id] = p.name; });

  // Overdue tasks for urgent panel
  const overdueTasks = tasks
    .filter(t => t.due_date && t.due_date < today && t.status !== 'done')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  // Blocked tasks for unblocking queue
  const blockedTasks = tasks.filter(t => t.status === 'blocked');

  // Task Assignment Matrix: cross-reference assignees x projects
  const assignmentMatrix = (() => {
    const userMap = {};
    workload.forEach(u => { userMap[u.id] = u.name; });
    const matrix = {};
    const projectIdSet = new Set();
    tasks.forEach(t => {
      if (!t.assigned_to || !t.project_id) return;
      projectIdSet.add(t.project_id);
      if (!matrix[t.assigned_to]) matrix[t.assigned_to] = {};
      matrix[t.assigned_to][t.project_id] = (matrix[t.assigned_to][t.project_id] || 0) + 1;
    });
    return {
      users: Object.keys(matrix).map(uid => ({
        id: uid,
        name: userMap[uid] || `User #${uid}`,
        projects: matrix[uid],
        total: Object.values(matrix[uid]).reduce((s, v) => s + v, 0),
      })).sort((a, b) => b.total - a.total),
      projectIds: Array.from(projectIdSet),
    };
  })();

  // AI Score Insights: average ai_score per project
  const aiScoresByProject = (() => {
    const scores = {};
    tasks.forEach(t => {
      if (t.project_id && t.ai_score != null && t.ai_score !== '') {
        if (!scores[t.project_id]) scores[t.project_id] = { sum: 0, count: 0 };
        scores[t.project_id].sum += parseFloat(t.ai_score) || 0;
        scores[t.project_id].count += 1;
      }
    });
    return Object.entries(scores).map(([pid, s]) => ({
      projectId: pid,
      projectName: projectNameMap[pid] || `Project #${pid}`,
      avgScore: s.count > 0 ? Math.round((s.sum / s.count) * 10) / 10 : 0,
      taskCount: s.count,
    })).sort((a, b) => a.avgScore - b.avgScore);
  })();
  const maxAiScore = Math.max(...aiScoresByProject.map(p => p.avgScore), 1);

  return (
    <div>
      {/* 1. Dashboard Header Row */}
      <div className="dashboard-header-row">
        <div>
          <h1>PM Dashboard</h1>
          <p className="subtitle">Project management &amp; team oversight</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateProject(true)}>+ New Project</button>
          <button className="btn btn-secondary" onClick={() => setShowQuickTask(v => !v)}>+ Quick Task</button>
        </div>
      </div>

      {/* 2. Stats Grid */}
      {overview && (
        <div className="stats-grid">
          <StatCard
            label="Projects"
            value={overview.projects.total}
            color="var(--primary)"
          />
          <StatCard
            label="Open Tasks"
            value={overview.tasks.open}
            color="var(--warning)"
            sub={`${overview.tasks.in_progress} in progress`}
          />
          <StatCard
            label="Overdue"
            value={overview.tasks.overdue}
            color="var(--danger)"
          />
          <StatCard
            label="Completed"
            value={overview.tasks.done}
            color="var(--success)"
          />
        </div>
      )}

      {/* Overdue Tasks Urgent Panel */}
      {overdueTasks.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="card-header">
            <h2 style={{ color: 'var(--danger)' }}>Overdue Tasks ({overdueTasks.length})</h2>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>
                {overdueTasks.slice(0, 15).map(t => {
                  const daysOver = Math.floor((new Date(today) - new Date(t.due_date)) / (1000 * 60 * 60 * 24));
                  const assignee = workload.find(u => u.id === t.assigned_to);
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="link" onClick={() => navigate(`/tasks/${t.id}`)}>
                          {t.title}
                        </span>
                      </td>
                      <td>
                        {t.project_id && projectNameMap[t.project_id]
                          ? <span className="badge badge-open">{projectNameMap[t.project_id]}</span>
                          : <span className="text-secondary">--</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : t.priority === 'medium' ? 'medium' : 'open'}`}>
                          {t.priority || 'none'}
                        </span>
                      </td>
                      <td>{t.due_date}</td>
                      <td>
                        <span className="text-danger" style={{ fontWeight: 600 }}>
                          {daysOver}d overdue
                        </span>
                      </td>
                      <td>
                        {assignee ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="avatar avatar-sm" style={{ background: assignee.avatar_color || '#4f46e5', width: 24, height: 24, fontSize: 10 }}>
                              {assignee.name.split(' ').map(x => x[0]).join('').slice(0, 2)}
                            </div>
                            {assignee.name}
                          </div>
                        ) : <span className="text-secondary">Unassigned</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Quick Task Creation (collapsible) */}
      {showQuickTask && (
        <div className="card quick-task-form">
          <form onSubmit={handleQuickTaskSubmit}>
            <div className="form-row-2">
              <div className="form-group" style={{ flex: 2 }}>
                <input
                  className="form-input"
                  placeholder="Task title..."
                  value={quickTaskForm.title}
                  onChange={e => setQuickTaskForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <select
                  className="form-input"
                  value={quickTaskForm.project_id}
                  onChange={e => setQuickTaskForm(f => ({ ...f, project_id: e.target.value }))}
                >
                  <option value="">No project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <select
                  className="form-input"
                  value={quickTaskForm.priority}
                  onChange={e => setQuickTaskForm(f => ({ ...f, priority: e.target.value }))}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="form-group">
                <select
                  className="form-input"
                  value={quickTaskForm.assigned_to}
                  onChange={e => setQuickTaskForm(f => ({ ...f, assigned_to: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {workload.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <input
                  className="form-input"
                  type="date"
                  value={quickTaskForm.due_date}
                  onChange={e => setQuickTaskForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowQuickTask(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Task</button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Risk Assessment Panel */}
      {overview && (
        <div className="card">
          <div className="card-header">
            <h2>Risk Assessment</h2>
          </div>
          <div className="risk-grid">
            <div className={`risk-item ${blockedCount === 0 ? 'risk-ok' : blockedCount <= 3 ? 'risk-warn' : 'risk-danger'}`}>
              <div className="risk-value">{blockedCount}</div>
              <div className="risk-label">Blocked Tasks</div>
            </div>
            <div className={`risk-item ${overdueCount === 0 ? 'risk-ok' : overdueCount <= 5 ? 'risk-warn' : 'risk-danger'}`}>
              <div className="risk-value">{overdueCount}</div>
              <div className="risk-label">Overdue Tasks</div>
            </div>
            <div className={`risk-item ${highPriorityCount === 0 ? 'risk-ok' : highPriorityCount <= 5 ? 'risk-warn' : 'risk-danger'}`}>
              <div className="risk-value">{highPriorityCount}</div>
              <div className="risk-label">High Priority</div>
            </div>
          </div>
        </div>
      )}

      {/* Unblocking Queue */}
      {blockedTasks.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="card-header">
            <h2>Unblocking Queue ({blockedTasks.length})</h2>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blockedTasks.map(t => {
                  const assignee = workload.find(u => u.id === t.assigned_to);
                  return (
                    <tr key={t.id}>
                      <td>
                        <span className="link" onClick={() => navigate(`/tasks/${t.id}`)}>
                          {t.title}
                        </span>
                      </td>
                      <td>
                        {t.project_id && projectNameMap[t.project_id]
                          ? <span className="badge badge-open">{projectNameMap[t.project_id]}</span>
                          : <span className="text-secondary">--</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'high' : t.priority === 'medium' ? 'medium' : 'open'}`}>
                          {t.priority || 'none'}
                        </span>
                      </td>
                      <td>
                        {assignee ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="avatar avatar-sm" style={{ background: assignee.avatar_color || '#4f46e5', width: 24, height: 24, fontSize: 10 }}>
                              {assignee.name.split(' ').map(x => x[0]).join('').slice(0, 2)}
                            </div>
                            {assignee.name}
                          </div>
                        ) : <span className="text-secondary">Unassigned</span>}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleUnblock(t.id)}
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Velocity & Priority Distribution */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2>Velocity (Last 14 Days)</h2>
          </div>
          {last14.length > 0 ? (
            <>
              <MiniBarChart
                data={last14.map(d => ({ label: d.date, value: d.completed || 0 }))}
                color="var(--success)"
                height={120}
              />
              <div className="chart-summary">Avg: {avgVelocity} tasks/day</div>
            </>
          ) : (
            <EmptyState title="No trend data" description="Complete tasks to see velocity" />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Priority Distribution</h2>
          </div>
          {distItems.length > 0 ? (
            <div className="priority-bars">
              {distItems.map(d => {
                const pct = Math.round((parseInt(d.count) / maxPriorityCount) * 100);
                const label = d.manual_priority || 'none';
                return (
                  <div key={label} className="priority-bar-row">
                    <span className="priority-label">{label}</span>
                    <div className="priority-bar-track">
                      <div
                        className="priority-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: priorityColors[label] || 'var(--primary)',
                        }}
                      />
                    </div>
                    <span className="priority-count">{d.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No priority data" />
          )}
        </div>
      </div>

      {/* 6. Team Workload */}
      <div className="card">
        <div className="card-header">
          <h2>Team Workload</h2>
          <AvatarGroup users={workload} max={8} />
        </div>
        {workload.filter(w => w.total_tasks > 0).length > 0 ? (
          <div className="workload-list">
            {workload.filter(w => w.total_tasks > 0).map(w => {
              const progress = w.total_tasks > 0
                ? Math.round((w.completed_tasks / w.total_tasks) * 100) : 0;
              const barColor = parseInt(w.overdue_tasks) > 0
                ? 'var(--danger)'
                : parseInt(w.active_tasks) > 8
                  ? 'var(--warning)'
                  : 'var(--success)';
              return (
                <div key={w.id} className="workload-row">
                  <div
                    className="avatar avatar-sm"
                    style={{ background: w.avatar_color || '#4f46e5' }}
                  >
                    {w.name.split(' ').map(x => x[0]).join('').slice(0, 2)}
                  </div>
                  <div className="workload-info">
                    <div className="workload-name">
                      {w.name}
                      <span className={`badge badge-${w.role === 'pm' ? 'medium' : w.role === 'admin' ? 'critical' : 'open'}`}>
                        {w.role}
                      </span>
                    </div>
                    <div className="workload-stats">
                      {parseInt(w.active_tasks) === 0 && (
                        <span className="idle-indicator">Idle</span>
                      )}
                      <span>{w.active_tasks} active</span>
                      <span>{w.completed_tasks} completed</span>
                      {parseInt(w.overdue_tasks) > 0 && (
                        <span className="text-danger">{w.overdue_tasks} overdue</span>
                      )}
                    </div>
                  </div>
                  <div className="workload-bar">
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${progress}%`, background: barColor }}
                      />
                    </div>
                    <span className="workload-pct">{progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No assigned tasks" description="Assign tasks to team members to see workload" />
        )}
      </div>

      {/* Task Assignment Matrix */}
      {assignmentMatrix.users.length > 0 && assignmentMatrix.projectIds.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Task Assignment Matrix</h2>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team Member</th>
                  {assignmentMatrix.projectIds.map(pid => (
                    <th key={pid} style={{ textAlign: 'center' }}>
                      {projectNameMap[pid] || `#${pid}`}
                    </th>
                  ))}
                  <th style={{ textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {assignmentMatrix.users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm" style={{
                          background: (workload.find(w => w.id === parseInt(u.id)) || {}).avatar_color || '#4f46e5',
                          width: 24, height: 24, fontSize: 10,
                        }}>
                          {u.name.split(' ').map(x => x[0]).join('').slice(0, 2)}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    {assignmentMatrix.projectIds.map(pid => {
                      const count = u.projects[pid] || 0;
                      return (
                        <td key={pid} style={{ textAlign: 'center' }}>
                          {count > 0 ? (
                            <span className={`badge ${count >= 8 ? 'badge-critical' : count >= 5 ? 'badge-medium' : 'badge-open'}`}>
                              {count}
                            </span>
                          ) : (
                            <span className="text-secondary">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{u.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Project Comparison Table */}
      <div className="card">
        <div className="card-header">
          <h2>Project Health Overview</h2>
        </div>
        {projectHealth.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Tasks</th>
                  <th>Done</th>
                  <th>Overdue</th>
                  <th>Health</th>
                  <th>Progress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projectHealth.map(p => {
                  const progress = p.task_count > 0
                    ? Math.round((p.done_count / p.task_count) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <span
                          className="link"
                          onClick={() => navigate(`/projects/${p.id}`)}
                        >
                          {p.name}
                        </span>
                      </td>
                      <td>{p.task_count}</td>
                      <td>{p.done_count}</td>
                      <td>{parseInt(p.overdue_count) > 0
                        ? <span className="text-danger">{p.overdue_count}</span>
                        : p.overdue_count || 0}
                      </td>
                      <td><HealthBadge health={p.health || 'green'} /></td>
                      <td>
                        <ProgressRing value={progress} size={36} strokeWidth={3} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => navigate(`/board/${p.id}`)}
                          >
                            Board
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleRunAI(p.id, p.name)}
                            disabled={aiRunning}
                          >
                            AI
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No projects"
            description="Create a project to see health overview"
            actionLabel="+ New Project"
            onAction={() => setShowCreateProject(true)}
          />
        )}
      </div>

      {/* AI Score Insights */}
      {aiScoresByProject.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>AI Score Insights</h2>
            <span className="text-secondary" style={{ fontSize: 13 }}>Average AI priority score per project</span>
          </div>
          <div className="priority-bars">
            {aiScoresByProject.map(p => {
              const pct = Math.round((p.avgScore / maxAiScore) * 100);
              const needsAttention = p.avgScore < 40;
              const barColor = needsAttention ? 'var(--danger)' : p.avgScore < 60 ? 'var(--warning)' : 'var(--success)';
              return (
                <div key={p.projectId} className="priority-bar-row">
                  <span className="priority-label" style={{ minWidth: 120 }}>
                    <span className="link" onClick={() => navigate(`/projects/${p.projectId}`)}>
                      {p.projectName}
                    </span>
                  </span>
                  <div className="priority-bar-track">
                    <div
                      className="priority-bar-fill"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <span className="priority-count" style={{ minWidth: 60, textAlign: 'right' }}>
                    {p.avgScore}
                    {needsAttention && (
                      <span style={{ color: 'var(--danger)', marginLeft: 4, fontSize: 11 }} title="Low score - needs attention">
                        !!
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="chart-summary" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            {aiScoresByProject.filter(p => p.avgScore < 40).length > 0 && (
              <span style={{ color: 'var(--danger)' }}>
                {aiScoresByProject.filter(p => p.avgScore < 40).length} project(s) with low AI scores need attention
              </span>
            )}
          </div>
        </div>
      )}

      {/* 8. Deadline Calendar */}
      <div className="card">
        <div className="card-header">
          <h2>Deadline Calendar</h2>
        </div>
        <CalendarGrid deadlines={deadlines} />
      </div>

      {/* 9. Create Project Modal */}
      {showCreateProject && (
        <div className="modal-overlay" onClick={() => setShowCreateProject(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Project</h2>
            <form onSubmit={handleCreateProject}>
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  className="form-input"
                  value={newProject.name}
                  onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-textarea"
                  value={newProject.description}
                  onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateProject(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
