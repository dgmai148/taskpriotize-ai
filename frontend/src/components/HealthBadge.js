import React from 'react';

const LABELS = { green: 'Healthy', yellow: 'At Risk', red: 'Critical' };

export default function HealthBadge({ health = 'green', label }) {
  return (
    <span className={`health-badge health-${health}`}>
      <span className={`health-dot health-${health}`} />
      {label || LABELS[health] || health}
    </span>
  );
}
