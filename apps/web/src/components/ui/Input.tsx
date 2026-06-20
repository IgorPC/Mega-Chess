import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, style, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={{
          background: 'var(--color-surface-3)',
          border: `1.5px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text)',
          padding: '10px 14px',
          fontSize: 14,
          transition: 'border-color var(--transition)',
          width: '100%',
          ...style,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--color-danger)' : 'var(--color-border)'; }}
        {...props}
      />
      {error && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</span>}
    </div>
  );
}
