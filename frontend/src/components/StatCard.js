import React from 'react';

export default function StatCard({ label, value, icon, color, trend, trendLabel, sub, onClick }) {
  return (
    <div className="card stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {icon && (
        <div className="stat-icon" style={{ background: color || 'var(--primary)' }}>
          {icon}
        </div>
      )}
      <div className="stat-value" style={{ color: color || 'var(--primary)' }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {trend !== undefined && trend !== null && (
        <div className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}{trendLabel || ''}
        </div>
      )}
    </div>
  );
}
