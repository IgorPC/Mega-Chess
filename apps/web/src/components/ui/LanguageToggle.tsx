import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';

const LANGUAGES = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
] as const;

interface LanguageToggleProps {
  /** Compact single-line variant for use inside a dropdown menu. */
  inline?: boolean;
}

export function LanguageToggle({ inline }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuthStore();

  const handleChange = useCallback((code: 'pt' | 'en') => {
    if (code === i18n.language) return;
    i18n.changeLanguage(code);
    if (user) {
      updateUser({ locale: code });
      api.patch('/users/me', { locale: code }).catch(() => {});
    }
  }, [i18n, user, updateUser]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: inline ? '10px 16px' : 0,
    }}>
      {LANGUAGES.map(({ code, label }) => {
        const active = i18n.language === code;
        return (
          <button
            key={code}
            onClick={() => handleChange(code)}
            aria-pressed={active}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, fontWeight: 700,
              letterSpacing: '0.02em',
              color: active ? '#fff' : 'var(--color-text-muted)',
              background: active ? 'var(--color-primary)' : 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
