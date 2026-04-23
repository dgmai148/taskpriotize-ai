import React from 'react';

export default function ProgressRing({ value = 0, size = 48, strokeWidth = 4, color = 'var(--primary)', label }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
        <circle
          className="ring-fill"
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-label" style={{ fontSize: size < 40 ? '10px' : size < 60 ? '12px' : '14px' }}>
        {label !== undefined ? label : `${Math.round(value)}%`}
      </div>
    </div>
  );
}
