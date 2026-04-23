import React from 'react';

/**
 * Horizontal bar chart showing SHAP feature contributions.
 * Bars go left (negative/red) or right (positive/green) from center.
 */
export default function ShapChart({ explanation }) {
  if (!explanation || !Array.isArray(explanation) || explanation.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No AI explanation available.</div>;
  }

  // Find max absolute SHAP value for scaling
  const maxAbs = Math.max(...explanation.map(e => Math.abs(e.shap_value)), 0.01);

  return (
    <div className="shap-chart">
      {explanation.map((item, idx) => {
        const pct = Math.min((Math.abs(item.shap_value) / maxAbs) * 45, 45); // max 45% of bar width
        const isPositive = item.shap_value > 0;

        return (
          <div key={idx} className="shap-bar-row">
            <div className="shap-label">{item.label}</div>
            <div className="shap-bar-container">
              <div className="shap-center" />
              <div
                className={`shap-bar ${isPositive ? 'positive' : 'negative'}`}
                style={{
                  width: `${pct}%`,
                  ...(isPositive ? { left: '50%' } : { right: '50%', left: 'auto' }),
                }}
              />
            </div>
            <div className="shap-value" style={{ color: isPositive ? '#16a34a' : '#dc2626' }}>
              {isPositive ? '+' : ''}{item.shap_value.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
