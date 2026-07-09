import React from 'react';

export function MaintenancePage({ message }: { message?: string }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🔧</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
        Plataforma em manutenção
      </h1>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
        {message ?? 'Estamos realizando melhorias. Voltaremos em breve!'}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 28, padding: '10px 24px',
          background: 'var(--color-primary)', color: '#fff',
          borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
