import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export function Card({ children, glow, style, ...props }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 24,
        boxShadow: glow ? 'var(--shadow-glow), var(--shadow-card)' : 'var(--shadow-card)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
