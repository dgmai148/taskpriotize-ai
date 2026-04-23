import React from 'react';

export default function QuickActions({ actions = [] }) {
  return (
    <div className="quick-actions">
      {actions.map((action, i) => (
        <div key={i} className="quick-action" onClick={action.onClick}>
          <div className="qa-icon" style={{ background: action.bg || 'var(--primary-light)', color: action.color || 'var(--primary)' }}>
            {action.icon}
          </div>
          <span className="qa-label">{action.label}</span>
        </div>
      ))}
    </div>
  );
}
