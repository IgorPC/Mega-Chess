import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary', size = 'md', loading, fullWidth, children, disabled, style, ...props
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--font)', fontWeight: 500, borderRadius: 'var(--radius-sm)',
    transition: 'all var(--transition)', cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.6 : 1, border: '1.5px solid transparent',
    width: fullWidth ? '100%' : undefined,
    ...(size === 'sm' ? { padding: '6px 14px', fontSize: 13 } :
        size === 'lg' ? { padding: '14px 28px', fontSize: 16 } :
                        { padding: '10px 20px', fontSize: 14 }),
    ...(variant === 'primary' ? {
      background: 'var(--color-primary)', color: '#fff',
    } : variant === 'danger' ? {
      background: 'var(--color-danger)', color: '#fff',
    } : variant === 'outline' ? {
      background: 'transparent', color: 'var(--color-primary)',
      borderColor: 'var(--color-primary)',
    } : {
      background: 'var(--color-surface-2)', color: 'var(--color-text)',
    }),
    ...style,
  };

  return (
    <button style={base} disabled={disabled || loading} {...props}>
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} /> : children}
    </button>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}
