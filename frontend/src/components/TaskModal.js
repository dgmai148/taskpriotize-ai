import React, { useState } from 'react';

export default function TaskModal({ users = [], tasks = [], task, onSave, onClose }) {
  const isEdit = !!task;

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    manual_priority: task?.manual_priority || 'medium',
    story_points: task?.story_points ?? 3,
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    assignee_id: task?.assignee_id || '',
    tags: task?.tags ? (Array.isArray(task.tags) ? task.tags.join(', ') : task.tags) : '',
    dependencies: task?.dependencies?.filter(d => d)?.map(d => d.id || d) || [],
  });

  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        story_points: parseInt(form.story_points) || 0,
        assignee_id: form.assignee_id || null,
        due_date: form.due_date || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      };
      await onSave(payload);
    } catch {
      setSaving(false);
    }
  };

  const toggleDep = (taskId) => {
    setForm(prev => ({
      ...prev,
      dependencies: prev.dependencies.includes(taskId)
        ? prev.dependencies.filter(d => d !== taskId)
        : [...prev.dependencies, taskId],
    }));
  };

  // Filter out current task from dependency list
  const availableTasks = tasks.filter(t => t.id !== task?.id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit Task' : 'Create Task'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input className="form-input" value={form.title}
              onChange={e => set('title', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-textarea" value={form.description}
              onChange={e => set('description', e.target.value)} rows={3} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Priority</label>
              <select className="form-select" value={form.manual_priority}
                onChange={e => set('manual_priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="form-group">
              <label>Story Points</label>
              <select className="form-select" value={form.story_points}
                onChange={e => set('story_points', e.target.value)}>
                {[1, 2, 3, 5, 8, 13].map(sp => <option key={sp} value={sp}>{sp}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input className="form-input" type="date" value={form.due_date}
                onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Assignee</label>
            <select className="form-select" value={form.assignee_id}
              onChange={e => set('assignee_id', e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input className="form-input" value={form.tags} placeholder="e.g. frontend, bug, urgent"
              onChange={e => set('tags', e.target.value)} />
          </div>
          {availableTasks.length > 0 && (
            <div className="form-group">
              <label>Dependencies (select tasks this depends on)</label>
              <div className="dep-list-container">
                {availableTasks.map(t => (
                  <label key={t.id} className="dep-list-item">
                    <input type="checkbox" checked={form.dependencies.includes(t.id)}
                      onChange={() => toggleDep(t.id)} />
                    <span className="text-truncate">{t.title}</span>
                    <span className={`badge badge-${t.status}`} style={{ marginLeft: 'auto' }}>{t.status.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
