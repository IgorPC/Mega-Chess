import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useGameStore } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';

// Parses "YYYY-MM-DD" parts directly — `new Date(birthDate)` treats date-only
// strings as UTC midnight, which can shift the local calendar day by one in
// negative-offset timezones (e.g. Brazil) and cause an off-by-one age.
function calculateAge(birthDate: string): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = (today.getMonth() + 1) - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return age;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type DuelType = 'DUEL_FLASH' | 'DUEL_GIANT';
type DuelEntryFee = 6 | 10 | 20;

interface Friend {
  id: string;
  nickname: string;
  avatarUrl?: string;
  rating: number;
  isOnline: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DUEL_FEES: DuelEntryFee[] = [6, 10, 20];

const DUEL_LABEL_KEYS: Record<DuelType, string> = {
  DUEL_FLASH: 'duel_labels.DUEL_FLASH',
  DUEL_GIANT: 'duel_labels.DUEL_GIANT',
};

const DUEL_ICONS: Record<DuelType, string> = {
  DUEL_FLASH: '⚡',
  DUEL_GIANT: '🏔',
};

function duelPrize(fee: DuelEntryFee) {
  return Math.floor(fee * 2 * 0.9);
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({
  duelType, entryFee, onClose,
}: { duelType: DuelType; entryFee: DuelEntryFee; onClose: () => void }) {
  const { t } = useTranslation('tournaments');
  const [friends,  setFriends]  = useState<Friend[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited,  setInvited]  = useState<string | null>(null);

  useEffect(() => {
    api.get<Friend[]>('/friends')
      .then(f => { setFriends(f.filter(fr => fr.isOnline)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const invite = useCallback(async (friendId: string) => {
    setInviting(friendId);
    try {
      await api.post('/tournaments/duel/invite', { friendId, type: duelType, entryFee });
      setInvited(friendId);
    } catch { /* ignore */ } finally { setInviting(null); }
  }, [duelType, entryFee]);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
          {t('invite_modal.title', { duelType: t(DUEL_LABEL_KEYS[duelType]) })}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          {t('invite_modal.stake')} <strong style={{ color: 'var(--color-primary)' }}>{entryFee} CC</strong> {t('invite_modal.each')}
          {' '}{t('invite_modal.prize')} <strong style={{ color: 'var(--color-primary)' }}>{duelPrize(entryFee)} CC</strong>
        </p>
        {loading ? (
          <p style={muteCenter}>{t('invite_modal.loading')}</p>
        ) : friends.length === 0 ? (
          <p style={muteCenter}>{t('invite_modal.no_friends_online')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {friends.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <Avatar src={f.avatarUrl} name={f.nickname} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{f.nickname}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{f.rating} ELO</div>
                </div>
                {invited === f.id ? (
                  <span style={{ fontSize: 12, color: 'var(--color-success)' }}>{t('invite_modal.sent')}</span>
                ) : (
                  <Button size="sm" loading={inviting === f.id} onClick={() => invite(f.id)}>{t('invite_modal.invite')}</Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Button fullWidth variant="ghost" style={{ marginTop: 20 }} onClick={onClose}>{t('invite_modal.cancel')}</Button>
      </div>
    </div>
  );
}

// ─── Duel Panel ───────────────────────────────────────────────────────────────

function queueColor(count: number) {
  if (count <= 2) return '#ef4444';
  if (count <= 8) return '#eab308';
  return '#22c55e';
}

function DuelPanel() {
  const { t } = useTranslation('tournaments');
  const queueLabel = (count: number) => {
    if (count <= 2) return t('queue_low');
    if (count <= 8) return t('queue_medium');
    return t('queue_high');
  };
  const [duelType,  setDuelType]  = useState<DuelType>('DUEL_FLASH');
  const [entryFee,  setEntryFee]  = useState<DuelEntryFee>(6);
  const [inQueue,   setInQueue]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [showInvite,setShowInvite]= useState(false);
  const [error,     setError]     = useState('');
  const [duelSizes, setDuelSizes] = useState<Record<string, number>>({});
  const navigate = useNavigate();
  const { setMatch } = useGameStore();
  const user = useAuthStore(s => s.user);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isEligible = !!user?.birthDate && calculateAge(user.birthDate) >= 18;

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const navigateToMatch = useCallback((matchId: string, color: 'white' | 'black') => {
    stopPolling();
    setInQueue(false);
    // setMatch may already have been called by SocialSocketManager; safe to skip if so
    navigate(`/game/${matchId}`);
  }, [navigate, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await api.get<{ matchId: string; color: 'white' | 'black' } | null>('/matchmaking/active-match');
        if (result?.matchId) navigateToMatch(result.matchId, result.color);
      } catch { /* ignore */ }
    }, 5_000);
  }, [navigateToMatch, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    const fetchSizes = () =>
      api.get<{ duel: Record<string, number> }>('/matchmaking/sizes')
        .then(d => setDuelSizes(d.duel))
        .catch(() => {});
    fetchSizes();
    const interval = setInterval(fetchSizes, 10_000);
    return () => clearInterval(interval);
  }, []);

  const joinQueue = useCallback(async () => {
    setError('');
    if (!isEligible) {
      setError(t('duel_panel.age_requirement_error'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ status: string; matchId?: string }>('/matchmaking/duel/queue', { type: duelType, entryFee });
      if (res.matchId) {
        // Matched immediately — navigate directly (WebSocket may also fire)
        navigateToMatch(res.matchId, 'white');
        return;
      }
      setInQueue(true);
      startPolling();
    } catch (e: any) {
      setError(e?.message ?? t('duel_panel.queue_join_error'));
    } finally { setLoading(false); }
  }, [duelType, entryFee, navigateToMatch, startPolling, isEligible]);

  const leaveQueue = useCallback(async () => {
    stopPolling();
    try { await api.delete('/matchmaking/duel/queue'); } catch { /* ignore */ }
    setInQueue(false);
  }, [stopPolling]);

  if (inQueue) {
    return (
      <Card style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 16, animation: 'spin 2s linear infinite', display: 'inline-block' }}>♛</div>
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{t('duel_panel.searching_opponent')}</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 4 }}>
          {t(DUEL_LABEL_KEYS[duelType])} · {entryFee} CC {t('duel_panel.per_player')}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 24 }}>
          {t('invite_modal.prize')} <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{duelPrize(entryFee)} CC</span> {t('duel_panel.prize_pct')}
        </p>
        <Button variant="danger" onClick={leaveQueue}>{t('duel_panel.cancel_search')}</Button>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Type selector */}
      <Card style={{ padding: 20 }}>
        <SectionLabel>{t('duel_panel.mode')}</SectionLabel>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['DUEL_FLASH', 'DUEL_GIANT'] as DuelType[]).map(dt => {
            const typeCount = DUEL_FEES.reduce((sum, fee) => sum + (duelSizes[`${dt}:${fee}`] ?? 0), 0);
            return (
              <button key={dt} onClick={() => setDuelType(dt)} style={{
                flex: 1, padding: '14px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `2px solid ${duelType === dt ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: duelType === dt ? 'var(--color-primary-dim)' : 'var(--color-surface)',
                transition: 'all var(--transition)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{DUEL_ICONS[dt]}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t(DUEL_LABEL_KEYS[dt])}</div>
                <div style={{ fontSize: 11, marginTop: 5, color: queueColor(typeCount) }}>
                  ● {queueLabel(typeCount)}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Fee selector */}
      <Card style={{ padding: 20 }}>
        <SectionLabel>{t('duel_panel.stake_per_player')}</SectionLabel>
        <div style={{ display: 'flex', gap: 10 }}>
          {DUEL_FEES.map(fee => {
            const feeCount = duelSizes[`${duelType}:${fee}`] ?? 0;
            return (
              <button key={fee} onClick={() => setEntryFee(fee)} style={{
                flex: 1, padding: '14px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `2px solid ${entryFee === fee ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: entryFee === fee ? 'var(--color-primary-dim)' : 'var(--color-surface)',
                transition: 'all var(--transition)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  <span style={{ color: 'var(--color-primary)' }}>◈</span> {fee}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>{t('duel_panel.cc')}</div>
                <div style={{ fontSize: 10, marginTop: 5, color: queueColor(feeCount) }}>
                  ● {queueLabel(feeCount)}
                </div>
              </button>
            );
          })}
        </div>
        <div style={{
          marginTop: 14, padding: '10px 14px', background: 'var(--color-surface-2)',
          borderRadius: 'var(--radius-sm)', fontSize: 13,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: 'var(--color-text-muted)' }}>{t('duel_panel.winner_prize')}</span>
          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{duelPrize(entryFee)} CC</span>
        </div>
      </Card>

      {/* Rules for duel */}
      <Card style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span>ℹ️</span>
          <span>{t('duel_panel.rules')}</span>
        </div>
      </Card>

      {/* Financial risk warning */}
      <Card style={{ padding: '14px 18px', border: '1px solid var(--color-danger)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-danger)' }}>{t('duel_panel.risk_warning_title')}</strong>{' '}
            {t('duel_panel.risk_warning_body', { fee: entryFee })}
          </div>
        </div>
      </Card>

      {!isEligible && (
        <Card style={{ padding: '14px 18px', border: '1px solid var(--color-danger)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--color-danger)' }}>{t('duel_panel.age_gate_title')}</strong>{' '}
              {user?.birthDate
                ? t('duel_panel.age_gate_body_has_birthdate')
                : <>{t('duel_panel.age_gate_body_no_birthdate_pre')} <a href="/profile/me" style={{ color: 'var(--color-primary)' }}>{t('duel_panel.age_gate_body_no_birthdate_link')}</a> {t('duel_panel.age_gate_body_no_birthdate_post')}</>}
            </div>
          </div>
        </Card>
      )}

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button fullWidth loading={loading} disabled={!isEligible} onClick={joinQueue}>{t('duel_panel.find_opponent')}</Button>
        <Button fullWidth variant="outline" disabled={!isEligible} onClick={() => setShowInvite(true)}>{t('duel_panel.invite_friend')}</Button>
      </div>

      {showInvite && (
        <InviteModal duelType={duelType} entryFee={entryFee} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

// ─── Coming Soon Panel ────────────────────────────────────────────────────────

function TournamentsComingSoonPanel() {
  const { t } = useTranslation('tournaments');
  return (
    <Card style={{ padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🏆</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>{t('coming_soon.title')}</h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 380, margin: '0 auto 24px', lineHeight: 1.7 }}>
        {t('coming_soon.description')}
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 18px', borderRadius: 'var(--radius-full)',
        background: 'var(--color-primary-dim)',
        border: '1px solid var(--color-primary)',
        fontSize: 13, color: 'var(--color-primary)', fontWeight: 600,
      }}>
        {t('coming_soon.badge')}
      </div>
      <div style={{
        marginTop: 32, padding: '14px 18px',
        background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
        fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7, textAlign: 'left',
      }}>
        <strong style={{ color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>{t('coming_soon.whats_coming_title')}</strong>
        {t('coming_soon.whats_coming_body')}
      </div>
    </Card>
  );
}

// ─── Section label helper ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </p>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TournamentsPage() {
  const { t } = useTranslation('tournaments');
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState<'duel' | 'tournament'>('duel');

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, marginBottom: 6 }}>{t('title')}</h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        {t('subtitle')}
      </p>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 4,
      }}>
        <button onClick={() => setTab('duel')} style={tabStyle(tab === 'duel')}>
          {t('tab_duel')}
        </button>
        <button onClick={() => setTab('tournament')} style={tabStyle(tab === 'tournament')}>
          {t('tab_tournaments')}
        </button>
      </div>

      {tab === 'duel' ? <DuelPanel /> : <TournamentsComingSoonPanel />}
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-sm)',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--transition)',
    background: active ? 'var(--color-surface-2)' : 'transparent',
    color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
  };
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
};

const modalStyle: React.CSSProperties = {
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)', padding: '28px',
  maxWidth: 400, width: '90%', boxShadow: 'var(--shadow-card)',
};

const muteCenter: React.CSSProperties = {
  color: 'var(--color-text-muted)', textAlign: 'center', padding: 20,
};
