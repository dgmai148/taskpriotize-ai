import React from 'react';

export default function MiniBarChart({ data = [], height = 64, maxValue, showLabels, color = 'var(--primary)', tall }) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  return (
    <div className={`mini-bar-chart${tall ? ' tall' : ''}`} style={{ height }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="bar"
          style={{
            height: `${Math.max((d.value / max) * 100, 2)}%`,
            background: d.color || color,
          }}
          title={`${d.label || ''}: ${d.value}`}
        >
          <div className="bar-tooltip">{d.value}</div>
          {showLabels && <div className="bar-label">{d.label}</div>}
        </div>
      ))}
    </div>
  );
}
