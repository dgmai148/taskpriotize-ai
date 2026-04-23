import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { notificationApi } from '../api/client';

function relativeTime(dateStr) {
  if (!dateStr) return '\u2014';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getDateGroup(dateStr) {
  if (!dateStr) return 'Older';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // "Today" = same calendar day
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return 'Today';
  }

  if (diffDays < 7) return 'This Week';
  return 'Older';
}

const TYPE_CONFIG = {
  assignment: {
    label: 'Assignment',
    color: '#2563eb',
    bg: '#dbeafe',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <polyline points="17 11 19 13 23 9" />
      </svg>
    ),
  },
  override: {
    label: 'Override',
    color: '#d97706',
    bg: 'var(--warning-bg)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  mention: {
    label: 'Mention',
    color: '#9333ea',
    bg: 'var(--critical-bg)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
      </svg>
    ),
  },
  system: {
    label: 'System',
    color: '#64748b',
    bg: 'var(--bg)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  info: {
    label: 'Info',
    color: '#0891b2',
    bg: '#cffafe',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.info;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await notificationApi.list();
      const list = Array.isArray(data) ? data : (data.notifications || data.data || []);
      setNotifications(list);
    } catch (err) {
      toast.error('Failed to load notifications: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  );

  const groupedNotifications = useMemo(() => {
    const groups = { Today: [], 'This Week': [], Older: [] };
    notifications.forEach(n => {
      const group = getDateGroup(n.created_at);
      groups[group].push(n);
    });
    return groups;
  }, [notifications]);

  async function handleMarkRead(notification) {
    if (notification.is_read) return;
    try {
      await notificationApi.markRead(notification.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      toast.error('Failed to mark as read: ' + err.message);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setMarkingAllRead(true);
    try {
      await notificationApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read: ' + err.message);
    } finally {
      setMarkingAllRead(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading notifications...</div>;
  }

  const GROUP_ORDER = ['Today', 'This Week', 'Older'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Notifications
            {unreadCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 10,
                  background: 'var(--primary)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 12,
                  padding: '2px 10px',
                  verticalAlign: 'middle',
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Stay up to date with your project activity
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleMarkAllRead}
          disabled={markingAllRead || unreadCount === 0}
        >
          {markingAllRead ? (
            <><span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'var(--text)' }} /> Marking...</>
          ) : (
            <>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
              >
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Mark All as Read
            </>
          )}
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <svg
            width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="var(--border)" strokeWidth="1.5"
            style={{ marginBottom: 16 }}
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>No notifications</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            You are all caught up. New notifications will appear here.
          </p>
        </div>
      ) : (
        GROUP_ORDER.map(groupName => {
          const items = groupedNotifications[groupName];
          if (items.length === 0) return null;

          return (
            <div key={groupName} style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                  paddingLeft: 4,
                }}
              >
                {groupName}
                <span style={{ fontWeight: 400, marginLeft: 6 }}>
                  ({items.length})
                </span>
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {items.map((notification, idx) => {
                  const typeConfig = getTypeConfig(notification.type);
                  const isUnread = !notification.is_read;

                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleMarkRead(notification)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        padding: '14px 16px',
                        borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                        background: isUnread ? 'var(--primary-light)' : 'var(--surface)',
                        cursor: isUnread ? 'pointer' : 'default',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Unread dot */}
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: isUnread ? 'var(--primary)' : 'transparent',
                          flexShrink: 0,
                          marginTop: 8,
                        }}
                      />

                      {/* Type icon */}
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: '50%',
                          background: typeConfig.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {typeConfig.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span
                            className="badge"
                            style={{
                              background: typeConfig.bg,
                              color: typeConfig.color,
                              fontSize: 10,
                              padding: '1px 6px',
                            }}
                          >
                            {typeConfig.label}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: isUnread ? 600 : 400,
                            color: 'var(--text)',
                            margin: '4px 0 0 0',
                            lineHeight: 1.5,
                          }}
                        >
                          {notification.message}
                        </p>
                      </div>

                      {/* Timestamp */}
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                        title={notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
                      >
                        {relativeTime(notification.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Summary footer */}
      {notifications.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''} total
          {unreadCount > 0 && ` \u00B7 ${unreadCount} unread`}
        </div>
      )}
    </div>
  );
}
