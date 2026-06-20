import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'success' | 'muted';
}

export function Badge({ children, variant = 'primary' }: BadgeProps) {
  const colors = {
    primary: { bg: 'var(--color-primary-dim)', color: '#8B99FF' },
    danger:  { bg: 'var(--color-danger-dim)',  color: '#D47B79' },
    success: { bg: 'var(--color-success-dim)', color: '#6FCF74' },
    muted:   { bg: 'var(--color-surface-2)',   color: 'var(--color-text-muted)' },
  }[variant];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 'var(--radius-full)',
      fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
      background: colors.bg, color: colors.color,
    }}>
      {children}
    </span>
  );
}
