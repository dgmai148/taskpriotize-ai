import React from 'react';

export default function EmptyState({ title = 'No data', description, actionLabel, onAction, icon }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {icon || (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" />
          </svg>
        )}
      </div>
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {actionLabel && onAction && (
        <button className="btn btn-primary btn-sm" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}
