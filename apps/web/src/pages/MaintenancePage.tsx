import React from 'react';
import { useTranslation } from 'react-i18next';

export function MaintenancePage({ message }: { message?: string }) {
  const { t } = useTranslation('maintenance');
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🔧</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
        {t('title')}
      </h1>
      <p style={{ fontSize: 15, color: 'var(--color-text-muted)', maxWidth: 400, lineHeight: 1.6 }}>
        {message ?? t('default_message')}
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
        {t('retry')}
      </button>
    </div>
  );
}
