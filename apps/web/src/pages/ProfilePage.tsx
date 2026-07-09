import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/auth.store';

interface Profile {
  id: string;
  name: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  rating: number;
  avgRating: number | null;
  reviewCount: number;
}

interface Stats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  reviewer: { nickname: string; avatarUrl?: string };
}

interface ReviewsPage {
  data: Review[];
  total: number;
  page: number;
  totalPages: number;
  avgRating: number | null;
  reviewCount: number;
}

interface ReferralData {
  referrals: { nickname: string; isEligible: boolean; totalEarned: number }[];
  totalEarned: number;
}

interface ReferralCodeData {
  referralCode: string | null;
  link: string | null;
}

export function ProfilePage() {
  const { nickname } = useParams<{ nickname: string }>();
  const { user } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<ReviewsPage | null>(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [referralCode, setReferralCode] = useState<ReferralCodeData | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralsEnabled, setReferralsEnabled] = useState(true);

  useEffect(() => {
    if (!nickname) return;
    setLoading(true);
    Promise.all([
      api.get<Profile>(`/users/${nickname}`),
      api.get<Stats>(`/users/${nickname}/stats`),
    ]).then(([p, s]) => {
      setProfile(p);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [nickname]);

  useEffect(() => {
    if (!nickname) return;
    api.get<ReviewsPage>(`/users/${nickname}/reviews?page=${reviewPage}&limit=5`)
      .then(setReviews)
      .catch(() => {});
  }, [nickname, reviewPage]);

  const isOwn = user?.nickname === nickname;

  const loadReferrals = useCallback(() => {
    if (!isOwn) return;
    Promise.all([
      api.get<{ features?: { referralsEnabled?: boolean } }>('/config/public').catch(() => null),
      api.get<ReferralData>('/referrals/me').catch(() => null),
      api.get<ReferralCodeData>('/referrals/my-code').catch(() => null),
    ]).then(([cfg, rd, rc]) => {
      if (cfg?.features?.referralsEnabled === false) {
        setReferralsEnabled(false);
        return;
      }
      if (rd) setReferralData(rd);
      if (rc) setReferralCode(rc);
    });
  }, [isOwn]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>;
  }
  if (!profile) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>Perfil não encontrado</div>;
  }

  const winRate = stats?.total ? Math.round((stats.wins / stats.total) * 100) : 0;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      {/* Header card */}
      <Card glow style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: isMobile ? 16 : 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar src={profile.avatarUrl} name={profile.nickname} size={isMobile ? 72 : 96} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700 }}>{profile.name}</h1>
              <Badge variant="muted">@{profile.nickname}</Badge>
            </div>
            {profile.bio && (
              <p style={{ color: 'var(--color-text-muted)', marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
                {profile.bio}
              </p>
            )}
            <div style={{
              display: 'flex', gap: isMobile ? 8 : 12, marginTop: 14,
              flexWrap: 'wrap',
            }}>
              <StatPill label="ELO" value={profile.rating} highlight />
              <StatPill label="Vitórias" value={stats?.wins ?? 0} />
              <StatPill label="Derrotas" value={stats?.losses ?? 0} />
              <StatPill label="Win Rate" value={`${winRate}%`} />
            </div>
          </div>
          {isOwn && (
            <Link to="/profile/me">
              <Button variant="ghost" size="sm">Editar</Button>
            </Link>
          )}
        </div>

        {/* Win/loss bar */}
        {stats && stats.total > 0 && (
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
      {(reviews && (reviews.total > 0 || profile.reviewCount > 0)) && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontWeight: 600 }}>Avaliações</h2>
            {(reviews?.avgRating ?? profile.avgRating) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#FFD700', fontSize: 18 }}>
                  {'★'.repeat(Math.round(reviews?.avgRating ?? profile.avgRating ?? 0))}{'☆'.repeat(5 - Math.round(reviews?.avgRating ?? profile.avgRating ?? 0))}
                </span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>
                  {(reviews?.avgRating ?? profile.avgRating ?? 0).toFixed(1)}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                  ({reviews?.reviewCount ?? profile.reviewCount} avaliações)
                </span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviews?.data.map((r) => (
              <div key={r.id} style={{ padding: '12px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <Avatar src={r.reviewer.avatarUrl} name={r.reviewer.nickname} size={28} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{r.reviewer.nickname}</span>
                  <span style={{ color: '#FFD700', fontSize: 13, letterSpacing: 1 }}>
                    {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                {r.comment && (
                  <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{r.comment}</p>
                )}
              </div>
            ))}
          </div>
          {reviews && reviews.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <Button size="sm" variant="ghost" disabled={reviewPage <= 1} onClick={() => setReviewPage(p => p - 1)}>
                ← Anterior
              </Button>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {reviewPage}/{reviews.totalPages}
              </span>
              <Button size="sm" variant="ghost" disabled={reviewPage >= reviews.totalPages} onClick={() => setReviewPage(p => p + 1)}>
                Próximo →
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Referrals (own profile only, feature flag) */}
      {isOwn && referralsEnabled && referralCode && (
        <Card>
          <h2 style={{ fontWeight: 600, marginBottom: 16 }}>Indicações</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Referral code + copy */}
            <div style={{ padding: '14px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>Seu código de indicação</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--color-primary)' }}>
                  {referralCode.referralCode ?? '—'}
                </span>
                {referralCode.link && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(referralCode.link!);
                      setReferralCopied(true);
                      setTimeout(() => setReferralCopied(false), 2000);
                    }}
                  >
                    {referralCopied ? '✓ Copiado!' : 'Copiar link'}
                  </Button>
                )}
              </div>
              {referralCode.link && (
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, wordBreak: 'break-all' }}>
                  {referralCode.link}
                </p>
              )}
            </div>

            {/* Stats */}
            {referralData && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ padding: '10px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', minWidth: 100 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{referralData.referrals.length}<span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>/10</span></div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Indicados</div>
                </div>
                <div style={{ padding: '10px 16px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', minWidth: 100 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>◈ {referralData.totalEarned.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>CC ganhos</div>
                </div>
              </div>
            )}

            {/* List of referrals */}
            {referralData && referralData.referrals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Indicados</p>
                {referralData.referrals.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: 13 }}>@{r.nickname}</span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {r.totalEarned > 0 && <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>+◈ {r.totalEarned.toFixed(2)}</span>}
                      <span style={{ fontSize: 11, color: r.isEligible ? 'var(--color-success, #4CAF50)' : 'var(--color-text-muted)', padding: '2px 8px', background: r.isEligible ? 'rgba(76,175,80,0.12)' : 'transparent', borderRadius: 4 }}>
                        {r.isEligible ? 'Elegível' : 'Não elegível'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              Ganhe 50% da taxa de saque de cada indicado. Limite: 10 indicados por conta.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

const StatPill = React.memo(function StatPill({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 14px', borderRadius: 'var(--radius-sm)',
      background: highlight ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
      minWidth: 56,
    }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: highlight ? 'var(--color-primary)' : 'var(--color-text)' }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  );
});
