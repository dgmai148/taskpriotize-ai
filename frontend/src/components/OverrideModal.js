import React, { useState } from 'react';

export default function OverrideModal({ task, onSave, onClose }) {
  const [newScore, setNewScore] = useState(Math.round(task.ai_priority_score || 50));
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(task.id, newScore, reason);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <h2>Override Priority</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Override the AI-calculated priority for: <strong>{task.title}</strong>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Current AI Score: {Math.round(task.ai_priority_score || 0)}%</label>
          </div>
          <div className="form-group">
            <label>New Priority Score (0-100)</label>
            <input className="form-input" type="number" min="0" max="100"
              value={newScore} onChange={e => setNewScore(parseInt(e.target.value) || 0)} required />
            <input type="range" min="0" max="100" value={newScore}
              onChange={e => setNewScore(parseInt(e.target.value))}
              style={{ width: '100%', marginTop: 8 }} />
          </div>
          <div className="form-group">
            <label>Reason for Override</label>
            <textarea className="form-textarea" value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this priority needs adjustment..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Override Priority</button>
          </div>
        </form>
      </div>
    </div>
  );
}
