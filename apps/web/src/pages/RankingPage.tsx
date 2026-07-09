import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/auth.store';

type Period = 'day' | 'week' | 'month';

interface RankPlayer {
  id: string;
  nickname: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  periodRating?: number;
}

const PERIOD_TABS: { key: Period; labelKey: string }[] = [
  { key: 'day', labelKey: 'ranking.today' },
  { key: 'week', labelKey: 'ranking.week' },
  { key: 'month', labelKey: 'ranking.month' },
];

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_ICONS = ['🥇', '🥈', '🥉'];

export function RankingPage() {
  const { t } = useTranslation('ranking');
  const { user } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const [period, setPeriod] = useState<Period>('week');
  const [players, setPlayers] = useState<RankPlayer[]>([]);
  const [myRank, setMyRank] = useState<{ position: number; rating: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // First load: full spinner. Period switch: dim existing list, no spinner.
    if (!players.length) {
      setLoading(true);
    } else {
      setSwitching(true);
    }
    setError('');

    Promise.all([
      api.get<RankPlayer[]>(`/ranking?period=${period}`),
      api.get<{ position: number; rating: number }>('/ranking/me'),
    ]).then(([p, r]) => {
      setPlayers(p);
      setMyRank(r);
    }).catch(() => {
      setError(t('load_error'));
    }).finally(() => {
      setLoading(false);
      setSwitching(false);
    });
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: '-0.03em' }}>{t('title')}</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 4, fontSize: 14 }}>{t('top_100')}</p>
      </div>

      {myRank && (
        <Card style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, padding: isMobile ? '12px 16px' : '16px 20px' }}>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: 'var(--color-primary)', minWidth: 50, textAlign: 'center' }}>
            #{myRank.position}
          </div>
          <Avatar src={user?.avatarUrl} name={user?.nickname} size={isMobile ? 34 : 40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.nickname}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t('your_position')}</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: isMobile ? 16 : 20, color: 'var(--color-primary)', flexShrink: 0 }}>
            {myRank.rating} ELO
          </div>
        </Card>
      )}

      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)',
        padding: 4, width: isMobile ? '100%' : 'fit-content',
      }}>
        {PERIOD_TABS.map(tab => (
          <button key={tab.key} onClick={() => setPeriod(tab.key)} disabled={switching} style={{
            flex: isMobile ? 1 : undefined,
            padding: '7px 20px', borderRadius: 'var(--radius-sm)',
            fontSize: 14, fontWeight: 500,
            background: period === tab.key ? 'var(--color-surface-2)' : 'transparent',
            color: period === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
            transition: 'all var(--transition)',
            opacity: switching ? 0.6 : 1,
          }}>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(177,86,83,0.1)', border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--color-danger)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          {error}
          <Button size="sm" variant="ghost" onClick={() => setPeriod(p => p)}>{t('retry')}</Button>
        </div>
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            {t('loading')}
          </div>
        ) : players.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
              {t('empty')}
            </p>
          </div>
        ) : (
          <div style={{
            maxHeight: isMobile ? 580 : 660,
            overflowY: 'auto',
            opacity: switching ? 0.5 : 1,
            transition: 'opacity 150ms ease',
          }}>
            {players.map((p, i) => (
              <RankRow key={p.id} player={p} index={i} total={players.length} isMobile={isMobile} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const RankRow = React.memo(function RankRow({ player, index, total, isMobile }: {
  player: RankPlayer;
  index: number;
  total: number;
  isMobile: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const baseBackground = index === 0 ? 'rgba(255,215,0,0.04)' : 'transparent';

  return (
    <Link
      to={`/profile/${player.nickname}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14,
        padding: isMobile ? '12px 14px' : '14px 20px',
        borderBottom: index < total - 1 ? '1px solid var(--color-border)' : 'none',
        background: hovered ? 'var(--color-surface-2)' : baseBackground,
        transition: 'background var(--transition)',
      }}
    >
      <div style={{
        width: 28, textAlign: 'center', fontWeight: 700,
        fontSize: isMobile ? 13 : 15,
        color: index < 3 ? MEDAL_COLORS[index] : 'var(--color-text-muted)',
        flexShrink: 0,
      }}>
        {index < 3 ? MEDAL_ICONS[index] : index + 1}
      </div>
      <Avatar src={player.avatarUrl} name={player.nickname} size={isMobile ? 32 : 38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.nickname}
        </div>
        {!isMobile && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{player.name}</div>
        )}
      </div>
      <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: isMobile ? 14 : 16, flexShrink: 0 }}>
        {player.periodRating ?? player.rating}
      </div>
    </Link>
  );
});
