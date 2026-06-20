import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../store/auth.store';

type Period = 'day' | 'week' | 'month';

export function RankingPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>('week');
  const [players, setPlayers] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<{ position: number; rating: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get<any[]>(`/ranking?period=${period}`),
      api.get<any>('/ranking/me'),
    ]).then(([p, r]) => {
      setPlayers(p);
      setMyRank(r);
    }).finally(() => setLoading(false));
  }, [period]);

  const tabs: { key: Period; label: string }[] = [
    { key: 'day', label: 'Hoje' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
  ];

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>Ranking</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 6 }}>Top 100 jogadores</p>
      </div>

      {/* My rank */}
      {myRank && (
        <Card style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary)', minWidth: 60, textAlign: 'center' }}>
            #{myRank.position}
          </div>
          <Avatar src={user?.avatarUrl} name={user?.nickname} size={40} />
          <div>
            <div style={{ fontWeight: 600 }}>{user?.nickname}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sua posição no ranking</div>
          </div>
          <div style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 20, color: 'var(--color-primary)' }}>
            {myRank.rating} ELO
          </div>
        </Card>
      )}

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setPeriod(t.key)} style={{
            padding: '7px 20px', borderRadius: 'var(--radius-sm)',
            fontSize: 14, fontWeight: 500,
            background: period === t.key ? 'var(--color-surface-2)' : 'transparent',
            color: period === t.key ? 'var(--color-text)' : 'var(--color-text-muted)',
            transition: 'all var(--transition)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
        ) : players.map((p, i) => (
          <Link key={p.id} to={`/profile/${p.nickname}`} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '14px 20px',
            borderBottom: i < players.length - 1 ? '1px solid var(--color-border)' : 'none',
            transition: 'background var(--transition)',
            background: i === 0 ? 'rgba(255,215,0,0.04)' : 'transparent',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = i === 0 ? 'rgba(255,215,0,0.04)' : 'transparent')}
          >
            <div style={{
              width: 32, textAlign: 'center', fontWeight: 700, fontSize: 15,
              color: i < 3 ? medalColors[i] : 'var(--color-text-muted)',
            }}>
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
            </div>
            <Avatar src={p.avatarUrl} name={p.nickname} size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nickname}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{p.name}</div>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 16 }}>
              {p.periodRating || p.rating}
            </div>
          </Link>
        ))}
      </Card>
    </div>
  );
}
