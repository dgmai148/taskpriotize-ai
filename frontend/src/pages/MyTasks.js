import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { taskApi, commentApi, userApi } from '../api/client';
import ShapChart from '../components/ShapChart';
import EmptyState from '../components/EmptyState';
import TaskModal from '../components/TaskModal';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SORT_OPTIONS = [
  { value: 'score', label: 'AI Score' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
];

const PRIORITY_WEIGHT = { critical: 4, high: 3, medium: 2, low: 1 };

function getScoreClass(score) {
  if (score >= 75) return 'score-critical';
  if (score >= 50) return 'score-high';
  if (score >= 25) return 'score-medium';
  return 'score-low';
}

function isOverdue(dueDateStr) {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [comments, setComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [loadingComments, setLoadingComments] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('score');

  const loadTasks = useCallback(async () => {
    try {
      const [data, userList] = await Promise.all([
        taskApi.list({ my_tasks: 'true' }),
        userApi.list(),
      ]);
      setTasks(data);
      setUsers(userList);
    } catch (err) {
      toast.error('Failed to load tasks: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const loadComments = useCallback(async (taskId) => {
    if (comments[taskId]) return;
    setLoadingComments(prev => ({ ...prev, [taskId]: true }));
    try {
      const data = await commentApi.list(taskId);
      setComments(prev => ({ ...prev, [taskId]: data }));
    } catch {
      toast.error('Failed to load comments');
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

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskApi.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleEditTask = async (taskData) => {
    await taskApi.update(editingTask.id, taskData);
    toast.success('Task updated');
    setEditingTask(null);
    loadTasks();
  };

  const handlePostComment = async (taskId) => {
    const content = (commentInputs[taskId] || '').trim();
    if (!content) return;
    setSubmittingComment(prev => ({ ...prev, [taskId]: true }));
    try {
      const newComment = await commentApi.create(taskId, content);
      setComments(prev => ({ ...prev, [taskId]: [...(prev[taskId] || []), newComment] }));
      setCommentInputs(prev => ({ ...prev, [taskId]: '' }));
    } catch (err) {
      toast.error('Failed to post comment: ' + err.message);
    } finally {
      setSubmittingComment(prev => ({ ...prev, [taskId]: false }));
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

  // Filtering & Sorting
  const filtered = tasks.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.manual_priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(t.title || '').toLowerCase().includes(q) && !(t.project_name || '').toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return (b.ai_priority_score || 0) - (a.ai_priority_score || 0);
    if (sortBy === 'due_date') {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (sortBy === 'priority') return (PRIORITY_WEIGHT[b.manual_priority] || 0) - (PRIORITY_WEIGHT[a.manual_priority] || 0);
    return 0;
  });

  if (loading) return <div className="text-center loading-pulse" style={{ padding: 40 }}>Loading your tasks...</div>;

  return (
    <div className="fade-in">
      <div className="dashboard-header">
        <h1>My Tasks</h1>
        <p>{tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you</p>
      </div>

      {/* Filter bar */}
      <div className="card filter-bar mb-md">
        <div className="filter-bar-inner">
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 160 }}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="form-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ maxWidth: 160 }}>
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input className="form-input" type="text" placeholder="Search tasks..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} style={{ maxWidth: 220 }} />
          <div style={{ marginLeft: 'auto' }} className="flex-center gap-sm">
            <span className="text-sm">Sort by:</span>
            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ maxWidth: 130 }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="task-row task-row-header" style={{ gridTemplateColumns: '56px 1fr 130px 110px 90px 110px 50px' }}>
          <div>Score</div>
          <div>Task</div>
          <div>Project</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Due Date</div>
          <div></div>
        </div>

        {sorted.map(task => {
          const overdue = isOverdue(task.due_date) && task.status !== 'done';
          const expanded = expandedTask === task.id;
          const taskComments = comments[task.id] || [];
          const explanation = task.ai_explanation
            ? (typeof task.ai_explanation === 'string' ? JSON.parse(task.ai_explanation) : task.ai_explanation)
            : null;

          return (
            <React.Fragment key={task.id}>
              <div className={`task-row ${expanded ? 'task-row-expanded' : ''}`}
                onClick={() => handleToggleExpand(task.id)}
                style={{ gridTemplateColumns: '56px 1fr 130px 110px 90px 110px 50px' }}>
                <div className={`score-circle ${getScoreClass(task.ai_priority_score)}`}>
                  {Math.round(task.ai_priority_score || 0)}
                </div>
                <div>
                  <div className="task-title">
                    {task.title}
                    {overdue && <span className="badge badge-blocked" style={{ marginLeft: 8 }}>Overdue</span>}
                  </div>
                  {task.description && <div className="task-subtitle text-truncate" style={{ maxWidth: 350 }}>{task.description}</div>}
                </div>
                <div className="task-subtitle">{task.project_name || '\u2014'}</div>
                <div>
                  <select className="form-select" style={{ fontSize: 12, padding: '4px 6px' }}
                    value={task.status} onClick={e => e.stopPropagation()}
                    onChange={e => handleStatusChange(task.id, e.target.value)}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div><span className={`badge badge-${task.manual_priority}`}>{task.manual_priority}</span></div>
                <div style={{ fontSize: 12, color: overdue ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: overdue ? 600 : 400 }}>
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : '\u2014'}
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <button className="btn-icon" title="Edit" onClick={() => setEditingTask(task)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="task-detail">
                  <div className="mb-md">
                    <h4 className="mb-sm" style={{ fontSize: 13, fontWeight: 600 }}>Description</h4>
                    <p style={{ margin: 0 }}>{task.description || 'No description provided.'}</p>
                  </div>

                  <div className="flex-center gap-md mb-md" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {task.story_points != null && <span>Story Points: <strong>{task.story_points}</strong></span>}
                    {task.assignee_name && <span>Assignee: <strong>{task.assignee_name}</strong></span>}
                    {task.is_overridden && <span className="badge badge-overridden">Overridden</span>}
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingTask(task)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  </div>

                  {explanation && (
                    <div className="mb-md">
                      <h4 className="mb-sm" style={{ fontSize: 13, fontWeight: 600 }}>AI Explanation (SHAP)</h4>
                      <ShapChart explanation={explanation} />
                    </div>
                  )}

                  {/* Comments */}
                  <div className="mt-md">
                    <h4 className="mb-sm" style={{ fontSize: 13, fontWeight: 600 }}>Comments ({taskComments.length})</h4>
                    {loadingComments[task.id] ? (
                      <div className="task-subtitle loading-pulse">Loading comments...</div>
                    ) : (
                      <>
                        {taskComments.length === 0 && <div className="task-subtitle mb-sm">No comments yet.</div>}
                        {taskComments.map(comment => (
                          <div key={comment.id} className="comment-item">
                            <div className="flex-between">
                              <span className="comment-author">{comment.author_name || comment.user_name || 'User'}</span>
                              <div className="flex-center gap-sm">
                                <span className="comment-time">{comment.created_at ? new Date(comment.created_at).toLocaleString() : ''}</span>
                                <button className="btn-icon" onClick={() => handleDeleteComment(task.id, comment.id)} title="Delete" style={{ padding: 2 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </div>
                            </div>
                            <div className="comment-content">{comment.content}</div>
                          </div>
                        ))}
                        <div className="flex-center gap-sm" style={{ marginTop: 8 }}>
                          <input className="form-input" type="text" placeholder="Write a comment..." style={{ flex: 1 }}
                            value={commentInputs[task.id] || ''} onClick={e => e.stopPropagation()}
                            onChange={e => setCommentInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); handlePostComment(task.id); } }}
                          />
                          <button className="btn btn-primary btn-sm"
                            disabled={submittingComment[task.id] || !(commentInputs[task.id] || '').trim()}
                            onClick={e => { e.stopPropagation(); handlePostComment(task.id); }}>
                            {submittingComment[task.id] ? 'Posting...' : 'Post'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {sorted.length === 0 && (
          <EmptyState
            title={tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
            description={tasks.length === 0 ? 'No tasks assigned to you yet.' : 'No tasks match your current filters.'}
          />
        )}
      </div>

      {/* Summary footer */}
      {sorted.length > 0 && (
        <div className="flex-center gap-md mt-md" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>Showing {sorted.length} of {tasks.length} tasks</span>
          <span>|</span>
          <span style={{ color: 'var(--danger)' }}>{sorted.filter(t => isOverdue(t.due_date) && t.status !== 'done').length} overdue</span>
          <span>|</span>
          <span style={{ color: 'var(--success)' }}>{sorted.filter(t => t.status === 'done').length} completed</span>
        </div>
      )}

      {/* Edit task modal */}
      {editingTask && (
        <TaskModal users={users} tasks={tasks} task={editingTask} onSave={handleEditTask} onClose={() => setEditingTask(null)} />
      )}
    </div>
  );
}
