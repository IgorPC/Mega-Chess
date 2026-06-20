import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/auth.store';

export function ProfilePage() {
  const { nickname } = useParams<{ nickname: string }>();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [rank, setRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nickname) return;
    setLoading(true);
    Promise.all([
      api.get<any>(`/users/${nickname}`),
      api.get<any>(`/users/${nickname}/stats`),
    ]).then(([p, s]) => {
      setProfile(p);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [nickname]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;
  if (!profile) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>Perfil não encontrado</div>;

  const winRate = stats?.total ? Math.round((stats.wins / stats.total) * 100) : 0;
  const isOwn = user?.nickname === nickname;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <Card glow style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar src={profile.avatarUrl} name={profile.nickname} size={96} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 26, fontWeight: 700 }}>{profile.name}</h1>
              <Badge variant="muted">@{profile.nickname}</Badge>
            </div>
            {profile.bio && (
              <p style={{ color: 'var(--color-text-muted)', marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
                {profile.bio}
              </p>
            )}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
              <StatPill label="ELO" value={profile.rating} highlight />
              {rank && <StatPill label="Rank" value={`#${rank.position}`} />}
              <StatPill label="Vitórias" value={stats?.wins || 0} />
              <StatPill label="Derrotas" value={stats?.losses || 0} />
              <StatPill label="Win Rate" value={`${winRate}%`} />
            </div>
          </div>
          {isOwn && (
            <Link to="/profile/me">
              <Button variant="ghost" size="sm">Editar perfil</Button>
            </Link>
          )}
        </div>

        {/* Win rate bar */}
        {stats?.total > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
              <span>{stats.wins}V</span>
              <span>{stats.draws}E</span>
              <span>{stats.losses}D</span>
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ flex: stats.wins, background: 'var(--color-success)' }} />
              <div style={{ flex: stats.draws, background: 'var(--color-surface-2)' }} />
              <div style={{ flex: stats.losses, background: 'var(--color-danger)' }} />
            </div>
          </div>
        )}
      </Card>

      {/* Reviews */}
      {profile.reviewsReceived?.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <h2 style={{ fontWeight: 600, marginBottom: 16 }}>Avaliações</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {profile.reviewsReceived.map((r: any, i: number) => (
              <div key={i} style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Avatar src={r.reviewer.avatarUrl} name={r.reviewer.nickname} size={28} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.reviewer.nickname}</span>
                  <span style={{ color: '#FFD700', fontSize: 13 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                {r.comment && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{r.comment}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatPill({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 16px', borderRadius: 'var(--radius-sm)',
      background: highlight ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
      minWidth: 60,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: highlight ? 'var(--color-primary)' : 'var(--color-text)' }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  );
}
