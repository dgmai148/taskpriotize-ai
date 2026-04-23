import React from 'react';

function relativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getDotClass(type, action) {
  if (type === 'comment') return 'activity-comment';
  if (action?.includes('status')) return 'activity-status';
  if (action?.includes('assign')) return 'activity-assign';
  if (action?.includes('override')) return 'activity-override';
  return '';
}

function formatAction(item) {
  if (item.type === 'comment') {
    return <><strong>{item.user_name}</strong> commented on <strong>{item.task_title}</strong>: "{item.content?.slice(0, 80)}{item.content?.length > 80 ? '...' : ''}"</>;
  }
  if (item.action?.includes('status')) {
    return <><strong>{item.user_name}</strong> changed <strong>{item.task_title}</strong> from {item.old_value} to <span className={`badge badge-${item.new_value}`}>{item.new_value}</span></>;
  }
  if (item.action?.includes('assign')) {
    return <><strong>{item.user_name}</strong> reassigned <strong>{item.task_title}</strong></>;
  }
  if (item.action?.includes('override')) {
    return <><strong>{item.user_name}</strong> overrode priority on <strong>{item.task_title}</strong></>;
  }
  return <><strong>{item.user_name}</strong> {item.action} on <strong>{item.task_title}</strong></>;
}

export default function ActivityFeed({ items = [], emptyMessage = 'No recent activity' }) {
  if (items.length === 0) {
    return <div className="empty-state"><div className="empty-title">{emptyMessage}</div></div>;
  }

  return (
    <div className="activity-feed">
      {items.map((item, i) => (
        <div key={item.id || i} className="activity-item">
          <div className={`activity-dot ${getDotClass(item.type, item.action)}`} />
          <div style={{ flex: 1 }}>
            <div className="activity-content">{formatAction(item)}</div>
            <div className="activity-time">{relativeTime(item.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
