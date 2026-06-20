import React from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  online?: boolean;
}

export function Avatar({ src, name = '?', size = 40, online }: AvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {src ? (
        <img
          src={src}
          alt={name}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: 'var(--color-primary-dim)',
          border: '2px solid var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.35, fontWeight: 700, color: 'var(--color-primary)',
        }}>
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28,
          borderRadius: '50%',
          background: online ? 'var(--color-success)' : 'var(--color-text-dim)',
          border: '2px solid var(--color-bg)',
        }} />
      )}
    </div>
  );
}
