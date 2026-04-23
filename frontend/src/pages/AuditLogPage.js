import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { auditApi } from '../api/client';

const ENTITY_FILTER_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'user', label: 'User' },
  { value: 'task', label: 'Task' },
  { value: 'project', label: 'Project' },
];

const PAGE_SIZE = 25;

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function relativeTime(dateStr) {
  if (!dateStr) return '—';
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

function formatDetails(details) {
  if (!details) return '—';
  let obj = details;
  if (typeof details === 'string') {
    try {
      obj = JSON.parse(details);
    } catch {
      return details;
    }
  }
  if (typeof obj !== 'object' || obj === null) return String(obj);

  const entries = Object.entries(obj);
  if (entries.length === 0) return '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ fontSize: 12, lineHeight: 1.4 }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
            {key.replace(/_/g, ' ')}:
          </span>{' '}
          <span style={{ color: 'var(--text)' }}>
            {typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getActionBadgeStyle(action) {
  const a = (action || '').toLowerCase();
  if (a.includes('create') || a.includes('add')) {
    return { background: 'var(--success-bg)', color: '#15803d' };
  }
  if (a.includes('delete') || a.includes('remove') || a.includes('deactivate')) {
    return { background: 'var(--danger-bg)', color: '#b91c1c' };
  }
  if (a.includes('update') || a.includes('edit') || a.includes('change')) {
    return { background: 'var(--warning-bg)', color: '#92400e' };
  }
  if (a.includes('login') || a.includes('auth')) {
    return { background: '#dbeafe', color: '#1e40af' };
  }
  return { background: 'var(--bg)', color: 'var(--text-secondary)' };
}

function getEntityBadgeStyle(entityType) {
  const e = (entityType || '').toLowerCase();
  if (e === 'user') return { background: 'var(--critical-bg)', color: '#6d28d9' };
  if (e === 'task') return { background: 'var(--warning-bg)', color: '#92400e' };
  if (e === 'project') return { background: '#dbeafe', color: '#1e40af' };
  return { background: 'var(--bg)', color: 'var(--text-secondary)' };
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [entityFilter, setEntityFilter] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const fetchLogs = useCallback(async (pageNum, entityType, append = false) => {
    const setLoadFn = append ? setLoadingMore : setLoading;
    setLoadFn(true);
    try {
      const params = { limit: PAGE_SIZE, offset: (pageNum - 1) * PAGE_SIZE };
      if (entityType) params.entity_type = entityType;
      const data = await auditApi.list(params);
      const results = Array.isArray(data) ? data : (data.logs || data.data || []);
      if (append) {
        setLogs(prev => [...prev, ...results]);
      } else {
        setLogs(results);
      }
      setHasMore(results.length >= PAGE_SIZE);
    } catch (err) {
      toast.error('Failed to load audit logs: ' + err.message);
    } finally {
      setLoadFn(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchLogs(1, entityFilter, false);
  }, [entityFilter, fetchLogs]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, entityFilter, true);
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading audit logs...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Audit Log</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Track all actions and changes across the system
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, padding: 12 }}>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <select
          className="form-select"
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
          style={{ width: 200 }}
        >
          {ENTITY_FILTER_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {logs.length} entr{logs.length !== 1 ? 'ies' : 'y'} shown
        </div>
      </div>

      {/* Audit log table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: '18%' }}>User</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: '14%' }}>Action</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: '12%' }}>Entity</th>
              <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Details</th>
              <th style={{ textAlign: 'right', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: '14%' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: log.user_avatar_color || '#4f46e5',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(log.user_name)}
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>
                      {log.user_name || 'System'}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    className="badge"
                    style={getActionBadgeStyle(log.action)}
                  >
                    {log.action}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span
                    className="badge"
                    style={getEntityBadgeStyle(log.entity_type)}
                  >
                    {log.entity_type}
                  </span>
                  {log.entity_id && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 4 }}>
                      #{log.entity_id}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {formatDetails(log.details)}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span
                    style={{ fontSize: 13, color: 'var(--text-secondary)' }}
                    title={log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  >
                    {relativeTime(log.created_at)}
                  </span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No audit log entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {hasMore && logs.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            className="btn btn-secondary"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <><span className="spinner" style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: 'var(--text)' }} /> Loading more...</>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}

      {!hasMore && logs.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
          All entries loaded
        </div>
      )}
    </div>
  );
}
