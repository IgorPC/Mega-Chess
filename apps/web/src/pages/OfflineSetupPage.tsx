import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { AIDifficulty } from '../lib/chessAI';

interface DifficultyOption {
  value: AIDifficulty;
  labelKey: string;
  descriptionKey: string;
  icon: string;
  color: string;
}

const DIFFICULTIES: DifficultyOption[] = [
  {
    value: 'easy',
    labelKey: 'setup.difficulty_easy',
    descriptionKey: 'setup.difficulty_easy_description',
    icon: '🌱',
    color: '#4CAF50',
  },
  {
    value: 'medium',
    labelKey: 'setup.difficulty_medium',
    descriptionKey: 'setup.difficulty_medium_description',
    icon: '⚔️',
    color: '#F5A623',
  },
  {
    value: 'hard',
    labelKey: 'setup.difficulty_hard',
    descriptionKey: 'setup.difficulty_hard_description',
    icon: '🔥',
    color: 'var(--color-danger)',
  },
];

export function OfflineSetupPage() {
  const { t } = useTranslation('game');
  const navigate = useNavigate();
  const [selected, setSelected] = useState<AIDifficulty>('medium');

  return (
    <div style={{
      maxWidth: 560,
      margin: '0 auto',
      padding: '40px 24px',
    }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
          {t('setup.title')}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          {t('setup.subtitle')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {DIFFICULTIES.map(d => (
          <button
            key={d.value}
            onClick={() => setSelected(d.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '18px 20px',
              background: selected === d.value ? 'var(--color-surface)' : 'transparent',
              border: `2px solid ${selected === d.value ? d.color : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all var(--transition)',
              width: '100%',
              color: 'var(--color-text)',
            }}
          >
            <span style={{ fontSize: 32, flexShrink: 0 }}>{d.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 700,
                fontSize: 16,
                color: selected === d.value ? d.color : 'var(--color-text)',
                marginBottom: 4,
              }}>
                {t(d.labelKey)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                {t(d.descriptionKey)}
              </div>
            </div>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: `2px solid ${selected === d.value ? d.color : 'var(--color-border)'}`,
              background: selected === d.value ? d.color : 'transparent',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected === d.value && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
              )}
            </div>
          </button>
        ))}
      </div>

      <Card style={{ padding: '14px 18px', marginBottom: 24, background: 'rgba(61, 74, 235, 0.08)', border: '1px solid rgba(61, 74, 235, 0.3)' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-text)' }}>{t('setup.plays_white')}</strong>{' '}
          {t('setup.recorded_no_elo')}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="ghost" fullWidth onClick={() => navigate('/lobby')}>
          {t('setup.back')}
        </Button>
        <Button
          fullWidth
          size="lg"
          onClick={() => navigate(`/play/offline/game?difficulty=${selected}`)}
        >
          {t('setup.play_as', { difficulty: t(DIFFICULTIES.find(d => d.value === selected)!.labelKey) })}
        </Button>
      </div>
    </div>
  );
}
