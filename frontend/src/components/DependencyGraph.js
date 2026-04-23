import React, { useMemo } from 'react';

/**
 * SVG dependency graph using a simple layered layout (topological sort).
 * Nodes are task title badges, edges are arrows.
 */
export default function DependencyGraph({ nodes, edges, highlightId }) {
  const layout = useMemo(() => computeLayout(nodes, edges), [nodes, edges]);

  if (!nodes || nodes.length === 0) {
    return <div style={{ padding: 20, color: 'var(--text-secondary)', textAlign: 'center' }}>No tasks to display.</div>;
  }

  const { positions, width, height } = layout;

  return (
    <div className="dep-graph" style={{ overflow: 'auto' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, idx) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;
          return (
            <line
              key={idx}
              x1={from.x + 80} y1={from.y + 20}
              x2={to.x} y2={to.y + 20}
              stroke="#94a3b8" strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;
          const isHighlighted = node.id === highlightId;
          const score = parseFloat(node.ai_priority_score) || 0;

          return (
            <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width="160" height="40" rx="6"
                fill={isHighlighted ? '#4f46e5' : '#fff'}
                stroke={isHighlighted ? '#4f46e5' : '#e2e8f0'}
                strokeWidth={isHighlighted ? 2 : 1}
              />
              <text x="8" y="16" fontSize="11" fontWeight="600"
                fill={isHighlighted ? '#fff' : '#1a202c'}>
                {truncate(node.title, 20)}
              </text>
              <text x="8" y="30" fontSize="10"
                fill={isHighlighted ? '#c7d2fe' : '#94a3b8'}>
                Score: {Math.round(score)} &middot; {node.status}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function computeLayout(nodes, edges) {
  if (!nodes || nodes.length === 0) return { positions: {}, width: 200, height: 100 };

  // Build adjacency for topological sort
  const incoming = {};
  const outgoing = {};
  nodes.forEach(n => { incoming[n.id] = []; outgoing[n.id] = []; });
  edges.forEach(e => {
    if (incoming[e.to]) incoming[e.to].push(e.from);
    if (outgoing[e.from]) outgoing[e.from].push(e.to);
  });

  // Assign layers using longest-path method
  const layers = {};
  const visited = new Set();

  function getLayer(id) {
    if (layers[id] !== undefined) return layers[id];
    if (visited.has(id)) return 0;
    visited.add(id);

    const deps = incoming[id] || [];
    if (deps.length === 0) {
      layers[id] = 0;
    } else {
      layers[id] = Math.max(...deps.map(d => getLayer(d))) + 1;
    }
    return layers[id];
  }

  nodes.forEach(n => getLayer(n.id));

  // Group by layer
  const layerGroups = {};
  let maxLayer = 0;
  nodes.forEach(n => {
    const layer = layers[n.id] || 0;
    if (!layerGroups[layer]) layerGroups[layer] = [];
    layerGroups[layer].push(n.id);
    maxLayer = Math.max(maxLayer, layer);
  });

  // Position nodes
  const NODE_W = 160;
  const NODE_H = 40;
  const H_GAP = 60;
  const V_GAP = 20;
  const positions = {};

  for (let layer = 0; layer <= maxLayer; layer++) {
    const group = layerGroups[layer] || [];
    group.forEach((id, idx) => {
      positions[id] = {
        x: layer * (NODE_W + H_GAP) + 20,
        y: idx * (NODE_H + V_GAP) + 20,
      };
    });
  }

  const width = (maxLayer + 1) * (NODE_W + H_GAP) + 40;
  const maxPerLayer = Math.max(...Object.values(layerGroups).map(g => g.length));
  const height = maxPerLayer * (NODE_H + V_GAP) + 40;

  return { positions, width: Math.max(width, 400), height: Math.max(height, 200) };
}
