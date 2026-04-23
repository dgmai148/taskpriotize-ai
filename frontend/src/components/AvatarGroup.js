import React from 'react';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AvatarGroup({ users = [], max = 5, size = 'md' }) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="avatar-group">
      {visible.map((u, i) => (
        <div
          key={u.id || i}
          className={`avatar avatar-${size}`}
          style={{ background: u.avatar_color || '#4f46e5' }}
          title={u.name}
        >
          {getInitials(u.name)}
        </div>
      ))}
      {remaining > 0 && (
        <div className={`avatar avatar-${size} avatar-more`} title={`+${remaining} more`}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
