import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { taskApi, projectApi, aiApi, userApi } from '../api/client';
import TaskModal from '../components/TaskModal';

const COLUMNS = [
  { key: 'open', label: 'Open', color: '#3b82f6', bg: '#dbeafe' },
  { key: 'in_progress', label: 'In Progress', color: '#d97706', bg: '#fef3c7' },
  { key: 'review', label: 'Review', color: '#7c3aed', bg: '#f3e8ff' },
  { key: 'blocked', label: 'Blocked', color: '#dc2626', bg: '#fee2e2' },
  { key: 'done', label: 'Done', color: '#16a34a', bg: '#dcfce7' },
];

function getScoreColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 25) return '#f59e0b';
  return '#3b82f6';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name) {
  if (!name) return '#94a3b8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#4f46e5', '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#be185d'];
  return colors[Math.abs(hash) % colors.length];
}

export default function KanbanBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiRunning, setAiRunning] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [proj, taskList, userList] = await Promise.all([
        projectApi.get(projectId),
        taskApi.list({ project_id: projectId }),
        userApi.list(),
      ]);
      setProject(proj);
      setTasks(taskList);
      setUsers(userList);
    } catch (err) {
      toast.error('Failed to load board: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskApi.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleAiPrioritize = async () => {
    setAiRunning(true);
    try {
      const result = await aiApi.prioritize(projectId);
      toast.success(`${result.updated} tasks prioritized by AI`);
      const updatedTasks = await taskApi.list({ project_id: projectId });
      setTasks(updatedTasks);
    } catch {
      toast.error('AI prioritization failed. Make sure the ML service is running.');
    } finally {
      setAiRunning(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    await taskApi.create({ ...taskData, project_id: projectId });
    toast.success('Task created');
    setShowCreateModal(false);
    loadData();
  };

  const handleEditTask = async (taskData) => {
    await taskApi.update(editingTask.id, taskData);
    toast.success('Task updated');
    setEditingTask(null);
    loadData();
  };

  if (loading) return <div className="text-center loading-pulse" style={{ padding: 40 }}>Loading board...</div>;

  const grouped = {};
  COLUMNS.forEach(col => { grouped[col.key] = []; });
  tasks.forEach(task => {
    const status = task.status || 'open';
    (grouped[status] || grouped['open']).push(task);
  });
  Object.keys(grouped).forEach(key => {
    grouped[key].sort((a, b) => (b.ai_priority_score || 0) - (a.ai_priority_score || 0));
  });

  return (
    <div className="fade-in">
      {/* Board header */}
      <div className="dashboard-header-row mb-lg">
        <div className="dashboard-header">
          <h1>{project?.name || 'Project Board'}</h1>
          <p>Kanban Board — {tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${projectId}`)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            List View
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateModal(true)}>+ New Task</button>
          <button className="btn btn-primary btn-sm" onClick={handleAiPrioritize} disabled={aiRunning}>
            {aiRunning ? <><span className="spinner" /> Analyzing...</> : 'AI Prioritize'}
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="kanban-board">
        {COLUMNS.map(col => {
          const columnTasks = grouped[col.key] || [];
          return (
            <div key={col.key} className="kanban-column">
              <div className="kanban-column-header" style={{ borderBottomColor: col.color }}>
                <div className="flex-center gap-sm">
                  <span className="health-dot" style={{ background: col.color }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{col.label}</span>
                </div>
                <span className="kanban-count" style={{ background: col.bg, color: col.color }}>{columnTasks.length}</span>
              </div>

              <div className="kanban-cards">
                {columnTasks.map(task => {
                  const overdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
                  return (
                    <div key={task.id} className="kanban-card card-hover">
                      <div className="flex-between mb-sm">
                        <div className="kanban-card-title">{task.title}</div>
                        <div className="kanban-score" style={{ background: getScoreColor(task.ai_priority_score) }}>
                          {Math.round(task.ai_priority_score || 0)}
                        </div>
                      </div>

                      <div className="mb-sm">
                        <span className={`badge badge-${task.manual_priority}`}>{task.manual_priority}</span>
                        {overdue && <span className="badge badge-blocked" style={{ marginLeft: 6 }}>Overdue</span>}
                      </div>

                      <div className="flex-between mb-sm">
                        <div className="flex-center gap-sm">
                          <div className="avatar avatar-sm" style={{ background: getAvatarColor(task.assignee_name) }}>
                            {getInitials(task.assignee_name)}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{task.assignee_name || 'Unassigned'}</span>
                        </div>
                        {task.due_date && (
                          <span style={{ fontSize: 11, color: overdue ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: overdue ? 600 : 400 }}>
                            {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="kanban-card-actions">
                        <select className="form-select kanban-status-select" value={task.status}
                          style={{ background: col.bg, borderColor: `${col.color}30`, color: col.color }}
                          onChange={e => handleStatusChange(task.id, e.target.value)}>
                          {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <button className="btn-icon" title="Edit task" onClick={() => setEditingTask(task)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {columnTasks.length === 0 && (
                  <div className="kanban-empty">No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create task modal */}
      {showCreateModal && (
        <TaskModal users={users} tasks={tasks} onSave={handleCreateTask} onClose={() => setShowCreateModal(false)} />
      )}

      {/* Edit task modal */}
      {editingTask && (
        <TaskModal users={users} tasks={tasks} task={editingTask} onSave={handleEditTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
  );
}
