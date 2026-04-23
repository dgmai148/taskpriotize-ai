import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectApi, taskApi, aiApi, userApi, commentApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ShapChart from '../components/ShapChart';
import DependencyGraph from '../components/DependencyGraph';
import TaskModal from '../components/TaskModal';
import OverrideModal from '../components/OverrideModal';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';

export default function ProjectPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiRunning, setAiRunning] = useState(false);
  const [expandedTask, setExpandedTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(null);
  const [showDepGraph, setShowDepGraph] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [animatedScores, setAnimatedScores] = useState({});
  // Comments
  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  // Bulk selection
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  // Project editing
  const [showEditProject, setShowEditProject] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', description: '', status: '' });
  // Filter & sort
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      const [proj, taskList, userList] = await Promise.all([
        projectApi.get(id),
        taskApi.list({ project_id: id }),
        userApi.list(),
      ]);
      setProject(proj);
      setTasks(taskList);
      setUsers(userList);
    } catch (err) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Load comments for expanded task
  const loadComments = useCallback(async (taskId) => {
    if (comments[taskId]) return;
    setLoadingComments(prev => ({ ...prev, [taskId]: true }));
    try {
      const data = await commentApi.list(taskId);
      setComments(prev => ({ ...prev, [taskId]: data }));
    } catch {
      // silently fail
    } finally {
      setLoadingComments(prev => ({ ...prev, [taskId]: false }));
    }
  }, [comments]);

  const handleToggleExpand = (taskId) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      loadComments(taskId);
    }
  };

  // Post comment
  const handlePostComment = async (taskId) => {
    const content = (commentInputs[taskId] || '').trim();
    if (!content) return;
    try {
      const newComment = await commentApi.create(taskId, content);
      setComments(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), newComment] }));
      setCommentInputs(prev => ({ ...prev, [taskId]: '' }));
    } catch (err) {
      toast.error('Failed to post comment');
    }
  };

  const handleDeleteComment = async (taskId, commentId) => {
    try {
      await commentApi.delete(taskId, commentId);
      setComments(prev => ({ ...prev, [taskId]: (prev[taskId] || []).filter(c => c.id !== commentId) }));
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  // AI
  const handleAiPrioritize = async () => {
    setAiRunning(true);
    try {
      const result = await aiApi.prioritize(id);
      toast.success(`${result.updated} tasks prioritized`);
      const updatedTasks = await taskApi.list({ project_id: id });
      const newAnimated = {};
      updatedTasks.forEach(t => { newAnimated[t.id] = true; });
      setAnimatedScores(newAnimated);
      setTimeout(() => setAnimatedScores({}), 1500);
      setTasks(updatedTasks);
    } catch (err) {
      toast.error('AI prioritization failed. Make sure the ML service is running.');
    } finally {
      setAiRunning(false);
    }
  };

  // Dependency graph
  const handleShowGraph = async () => {
    try {
      const data = await taskApi.dependencyGraph(id);
      setGraphData(data);
      setShowDepGraph(true);
    } catch {
      toast.error('Failed to load dependency graph');
    }
  };

  // Create task
  const handleCreateTask = async (taskData) => {
    await taskApi.create({ ...taskData, project_id: id });
    toast.success('Task created');
    setShowCreateModal(false);
    loadTasks();
  };

  // Edit task
  const handleEditTask = async (taskData) => {
    await taskApi.update(editingTask.id, taskData);
    toast.success('Task updated');
    setEditingTask(null);
    loadTasks();
  };

  // Status change
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskApi.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch {
      toast.error('Failed to update status');
    }
  };

  // Delete task
  const handleDelete = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await taskApi.delete(taskId);
      toast.success('Task deleted');
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setSelectedTasks(prev => { const n = new Set(prev); n.delete(taskId); return n; });
    } catch {
      toast.error('Failed to delete task');
    }
  };

  // Bulk actions
  const toggleSelect = (taskId) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedTasks.size === 0) return;
    const taskIds = Array.from(selectedTasks);
    try {
      if (bulkAction === 'delete') {
        if (!window.confirm(`Delete ${taskIds.length} tasks?`)) return;
        await Promise.all(taskIds.map(id => taskApi.delete(id)));
        toast.success(`${taskIds.length} tasks deleted`);
      } else if (bulkAction === 'assign') {
        await taskApi.bulkUpdate({ task_ids: taskIds, assignee_id: bulkAssignee || null });
        toast.success(`${taskIds.length} tasks reassigned`);
      } else {
        await taskApi.bulkUpdate({ task_ids: taskIds, status: bulkAction });
        toast.success(`${taskIds.length} tasks updated`);
      }
      setSelectedTasks(new Set());
      setBulkAction('');
      loadTasks();
    } catch (err) {
      toast.error('Bulk action failed: ' + err.message);
    }
  };

  // Override
  const handleOverride = async (taskId, newScore, reason) => {
    try {
      await taskApi.overridePriority({ task_id: taskId, new_score: newScore, reason });
      toast.success('Priority overridden');
      setShowOverrideModal(null);
      loadTasks();
    } catch (err) {
      toast.error('Failed to override: ' + err.message);
    }
  };

  // Project edit
  const handleEditProject = async (e) => {
    e.preventDefault();
    try {
      await projectApi.update(id, projectForm);
      toast.success('Project updated');
      setShowEditProject(false);
      setProject(prev => ({ ...prev, ...projectForm }));
    } catch (err) {
      toast.error('Failed to update project: ' + err.message);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
    try {
      await projectApi.delete(id);
      toast.success('Project deleted');
      navigate('/');
    } catch (err) {
      toast.error('Failed to delete project: ' + err.message);
    }
  };

  function getScoreClass(score) {
    if (score >= 75) return 'score-critical';
    if (score >= 50) return 'score-high';
    if (score >= 25) return 'score-medium';
    return 'score-low';
  }

  if (loading) return <div className="text-center fade-in" style={{ padding: 40 }}><div className="loading-pulse">Loading project...</div></div>;
  if (!project) return <EmptyState title="Project not found" description="This project may have been deleted." />;

  // Filtering
  const filteredTasks = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.manual_priority !== filterPriority) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(t.title || '').toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const statusCounts = {
    open: tasks.filter(t => t.status === 'open').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  };

  const canManage = user.role === 'pm' || user.role === 'admin';

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="dashboard-header-row mb-lg">
        <div>
          <h1>{project.name}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {project.description}
            {project.status && <span className="badge" style={{ marginLeft: 8 }}>{project.status}</span>}
          </p>
        </div>
        <div className="header-actions">
          {canManage && (
            <button className="btn btn-secondary btn-sm" onClick={() => {
              setProjectForm({ name: project.name, description: project.description || '', status: project.status || 'active' });
              setShowEditProject(true);
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit Project
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/board/${id}`)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            Board
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleShowGraph}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><line x1="7.5" y1="10.5" x2="16.5" y2="6.5"/><line x1="7.5" y1="13.5" x2="16.5" y2="17.5"/></svg>
            Deps
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleAiPrioritize} disabled={aiRunning}>
            {aiRunning ? <><span className="spinner" /> Analyzing...</> : 'AI Prioritize'}
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div className="stats-grid mb-md">
        {Object.entries(statusCounts).map(([status, count]) => (
          <StatCard key={status} value={count}
            label={<span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>}
          />
        ))}
      </div>

      {/* Filter bar */}
      <div className="card filter-bar mb-md">
        <div className="filter-bar-inner">
          <input className="form-input" type="text" placeholder="Search tasks..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: 240 }} />
          <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 150 }}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
          </select>
          <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ maxWidth: 150 }}>
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>+ New Task</button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedTasks.size > 0 && (
        <div className="card bulk-actions-bar mb-md">
          <span className="bulk-count">{selectedTasks.size} selected</span>
          <select className="form-select" value={bulkAction} onChange={e => setBulkAction(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">Choose action...</option>
            <option value="open">Set Open</option>
            <option value="in_progress">Set In Progress</option>
            <option value="review">Set Review</option>
            <option value="done">Set Done</option>
            <option value="blocked">Set Blocked</option>
            <option value="assign">Reassign</option>
            <option value="delete">Delete</option>
          </select>
          {bulkAction === 'assign' && (
            <select className="form-select" value={bulkAssignee} onChange={e => setBulkAssignee(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleBulkAction} disabled={!bulkAction}>Apply</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTasks(new Set())}>Clear</button>
        </div>
      )}

      {/* Task list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="task-row task-row-header">
          <div><input type="checkbox" checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0} onChange={toggleSelectAll} /></div>
          <div>Score</div>
          <div>Task</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Assignee</div>
          <div>Actions</div>
        </div>

        {filteredTasks.map(task => {
          const taskComments = comments[task.id] || [];
          return (
            <React.Fragment key={task.id}>
              <div className={`task-row ${expandedTask === task.id ? 'task-row-expanded' : ''}`}
                style={{ gridTemplateColumns: '40px 56px 1fr 100px 90px 100px 80px' }}>
                <div onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedTasks.has(task.id)} onChange={() => toggleSelect(task.id)} />
                </div>
                <div className={`score-circle ${getScoreClass(task.ai_priority_score)} ${animatedScores[task.id] ? 'score-animate' : ''}`}
                  onClick={() => handleToggleExpand(task.id)} style={{ cursor: 'pointer' }}>
                  {Math.round(task.ai_priority_score)}
                </div>
                <div onClick={() => handleToggleExpand(task.id)} style={{ cursor: 'pointer' }}>
                  <div className="task-title">
                    {task.title}
                    {task.is_overridden && <span className="badge badge-overridden" style={{ marginLeft: 8 }}>Overridden</span>}
                  </div>
                  <div className="task-subtitle">
                    {task.story_points} pts
                    {task.due_date && <> &middot; Due {new Date(task.due_date).toLocaleDateString()}</>}
                    {task.tags && task.tags.length > 0 && <> &middot; {task.tags.join(', ')}</>}
                  </div>
                </div>
                <div>
                  <select className="form-select" style={{ fontSize: 12, padding: '4px 6px' }}
                    value={task.status} onClick={e => e.stopPropagation()}
                    onChange={e => handleStatusChange(task.id, e.target.value)}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
                <div><span className={`badge badge-${task.manual_priority}`}>{task.manual_priority}</span></div>
                <div className="task-subtitle">{task.assignee_name || '\u2014'}</div>
                <div className="task-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" title="Edit" onClick={() => setEditingTask(task)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button className="btn-icon" title="Delete" onClick={() => handleDelete(task.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedTask === task.id && (
                <div className="task-detail">
                  <p>{task.description || 'No description.'}</p>

                  <div className="flex-center gap-sm mb-md">
                    {canManage && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowOverrideModal(task)}>Override Priority</button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingTask(task)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit Task
                    </button>
                  </div>

                  {task.ai_explanation && (
                    <div className="mb-md">
                      <h4 className="mb-sm">AI Explanation (SHAP)</h4>
                      <ShapChart explanation={typeof task.ai_explanation === 'string' ? JSON.parse(task.ai_explanation) : task.ai_explanation} />
                    </div>
                  )}

                  {task.dependencies && task.dependencies.length > 0 && task.dependencies[0] !== null && (
                    <div className="mb-md">
                      <h4 className="mb-sm">Dependencies</h4>
                      <div className="tag-cloud">
                        {task.dependencies.map(dep => dep && (
                          <span key={dep.id} className="tag-pill">{dep.title}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments */}
                  <div className="mt-md">
                    <h4 className="mb-sm">Comments ({taskComments.length})</h4>
                    {loadingComments[task.id] ? (
                      <div className="task-subtitle loading-pulse">Loading comments...</div>
                    ) : (
                      <>
                        {taskComments.map(comment => (
                          <div key={comment.id} className="comment-item">
                            <div className="flex-between">
                              <span className="comment-author">{comment.author_name || comment.user_name || 'User'}</span>
                              <div className="flex-center gap-sm">
                                <span className="comment-time">{comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}</span>
                                <button className="btn-icon" onClick={() => handleDeleteComment(task.id, comment.id)} title="Delete">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                            </div>
                            <div className="comment-content">{comment.content}</div>
                          </div>
                        ))}
                        <div className="flex-center gap-sm mt-md">
                          <input className="form-input" type="text" placeholder="Write a comment..."
                            style={{ flex: 1 }} value={commentInputs[task.id] || ''}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setCommentInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handlePostComment(task.id); }}
                          />
                          <button className="btn btn-primary btn-sm"
                            disabled={!(commentInputs[task.id] || '').trim()}
                            onClick={() => handlePostComment(task.id)}>Post</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {filteredTasks.length === 0 && (
          <EmptyState
            title={tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
            description={tasks.length === 0 ? 'Create your first task to get started!' : 'Try adjusting your filters.'}
            actionLabel={tasks.length === 0 ? '+ New Task' : undefined}
            onAction={tasks.length === 0 ? () => setShowCreateModal(true) : undefined}
          />
        )}
      </div>

      {/* Dependency graph modal */}
      {showDepGraph && graphData && (
        <div className="modal-overlay" onClick={() => setShowDepGraph(false)}>
          <div className="modal" style={{ width: 800, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-md">
              <h2>Dependency Graph</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDepGraph(false)}>Close</button>
            </div>
            <DependencyGraph nodes={graphData.nodes} edges={graphData.edges} highlightId={expandedTask} />
          </div>
        </div>
      )}

      {/* Create task modal */}
      {showCreateModal && (
        <TaskModal users={users} tasks={tasks} onSave={handleCreateTask} onClose={() => setShowCreateModal(false)} />
      )}

      {/* Edit task modal */}
      {editingTask && (
        <TaskModal users={users} tasks={tasks} task={editingTask} onSave={handleEditTask} onClose={() => setEditingTask(null)} />
      )}

      {/* Override modal */}
      {showOverrideModal && (
        <OverrideModal task={showOverrideModal} onSave={handleOverride} onClose={() => setShowOverrideModal(null)} />
      )}

      {/* Edit project modal */}
      {showEditProject && (
        <div className="modal-overlay" onClick={() => setShowEditProject(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Project</h2>
            <form onSubmit={handleEditProject}>
              <div className="form-group">
                <label>Name</label>
                <input className="form-input" value={projectForm.name}
                  onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-textarea" value={projectForm.description}
                  onChange={e => setProjectForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="form-select" value={projectForm.status}
                  onChange={e => setProjectForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="archived">Archived</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className="modal-actions">
                {user.role === 'admin' && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteProject} style={{ marginRight: 'auto' }}>Delete Project</button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProject(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
