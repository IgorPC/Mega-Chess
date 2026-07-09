import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth.store';
import { useGameStore } from '../store/game.store';
import { useSocialStore } from '../store/social.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { getGameSocket } from '../lib/socket';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';

interface Friend {
  id: string;
  nickname: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
  rating: number;
}

function queueColor(count: number) {
  if (count <= 2) return '#ef4444';
  if (count <= 8) return '#eab308';
  return '#22c55e';
}

export function LobbyPage() {
  const { t } = useTranslation('lobby');
  const queueLabel = (count: number) => {
    if (count <= 2) return t('queue_low');
    if (count <= 8) return t('queue_medium');
    return t('queue_high');
  };
  const { user } = useAuthStore();
  const { setMatch } = useGameStore();
  const { challenges, removeChallenge, onlineIds, setOnlineFriends, outgoingChallenges, setPendingChallenge, clearOutgoingChallenge } = useSocialStore();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [searching, setSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [casualCount, setCasualCount] = useState<number | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await api.get<{ matchId: string; color: 'white' | 'black' } | null>('/matchmaking/active-match');
        if (result?.matchId) {
          stopPolling();
          setSearching(false);
          navigate(`/game/${result.matchId}`);
        }
      } catch { /* ignore */ }
    }, 5_000);
  }, [navigate, stopPolling]);

  useEffect(() => {
    const fetchSizes = () =>
      api.get<{ casual: number }>('/matchmaking/sizes')
        .then(d => setCasualCount(d.casual))
        .catch(() => {});
    fetchSizes();
    const interval = setInterval(fetchSizes, 10_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    api.get<{ matchId: string } | null>('/matchmaking/active-match')
      .then(data => setActiveMatchId(data?.matchId ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Friend[]>('/friends').then(data => {
      setFriends(data);
      // Seed store with DB-based online status as fallback for missed socket events
      const dbOnlineIds = data.filter(f => f.isOnline).map(f => f.id);
      if (dbOnlineIds.length > 0) {
        setOnlineFriends([...new Set([...useSocialStore.getState().onlineIds, ...dbOnlineIds])]);
      }
    }).catch(() => {});

    const socket = getGameSocket();

    interface WsMatchFound {
      matchId: string;
      color: 'white' | 'black';
      match: { whitePlayer: { id: string; nickname: string; rating: number }; blackPlayer: { id: string; nickname: string; rating: number } };
    }
    const onMatchFound = (data: WsMatchFound) => {
      setMatch(data.matchId, data.color, data.match.whitePlayer, data.match.blackPlayer);
      navigate(`/game/${data.matchId}`);
    };
    socket.on('match_found', onMatchFound);

    return () => { socket.off('match_found', onMatchFound); };
  }, []);

  const handleSearch = useCallback(async () => {
    setSearchError('');
    setSearchLoading(true);
    if (searching) {
      stopPolling();
      try {
        await api.delete('/matchmaking/queue');
        setSearching(false);
      } catch {
        setSearchError(t('cancel_search_error'));
      }
    } else {
      try {
        const res = await api.post<{ status: string; matchId?: string }>('/matchmaking/queue');
        if (res.matchId) {
          navigate(`/game/${res.matchId}`);
          return;
        }
        setSearching(true);
        startPolling();
      } catch {
        setSearchError(t('start_search_error'));
      }
    }
    setSearchLoading(false);
  }, [searching, navigate, startPolling, stopPolling]);

  const acceptChallenge = useCallback(async (challengerId: string) => {
    removeChallenge(challengerId);
    try {
      await api.post('/matchmaking/challenge/accept', { challengerId });
    } catch {
      // Challenge expired or failed — already removed from UI, nothing more to do
    }
  }, [removeChallenge]);

  const denyChallenge = useCallback((challengerId: string) => {
    removeChallenge(challengerId);
  }, [removeChallenge]);

  const friendsWithStatus = friends.map(f => ({
    ...f,
    // Socket store takes precedence; fall back to DB isOnline if socket hasn't updated yet
    isOnline: onlineIds.includes(f.id) || (onlineIds.length === 0 && !!f.isOnline),
  }));

  const onlineCount = friendsWithStatus.filter(f => f.isOnline).length;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
        gap: 20,
      }}>
        {/* Main — Matchmaking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
              {t('greeting', { nickname: user?.nickname })}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 6, fontSize: 14 }}>
              {t('ready_prompt')}{' '}
              <strong style={{ color: '#fff' }}>{user?.rating}</strong>
            </p>
            {activeMatchId && (
              <Button
                size="sm"
                variant="primary"
                style={{ marginTop: 12 }}
                onClick={() => navigate(`/game/${activeMatchId}`)}
              >
                {t('back_to_match')}
              </Button>
            )}
          </div>

          {/* Find match */}
          <Card glow={searching} style={{ textAlign: 'center', padding: isMobile ? 32 : 48 }}>
            <div style={{ fontSize: isMobile ? 48 : 64, marginBottom: 12 }}>♚</div>
            <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 600, marginBottom: 8 }}>
              {searching ? t('searching') : t('find_match')}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: 14 }}>
              {searching ? t('searching_description') : t('find_match_description')}
            </p>
            {searchError && (
              <p style={{ fontSize: 13, color: 'var(--color-danger)', marginBottom: 12 }}>
                {searchError}
              </p>
            )}
            <Button
              onClick={handleSearch}
              variant={searching ? 'danger' : 'primary'}
              size="lg"
              disabled={searchLoading}
              style={{ minWidth: isMobile ? '100%' : 200 }}
            >
              {searchLoading
                ? t('please_wait')
                : searching
                ? <><PulseIcon /> {t('cancel_search')}</>
                : t('play_now')}
            </Button>
            {casualCount !== null && (
              <div style={{ marginTop: 12, fontSize: 13, color: queueColor(casualCount) }}>
                ● {t('activity', { level: queueLabel(casualCount) })}
              </div>
            )}
          </Card>

          {/* Play vs AI */}
          <Card style={{ padding: isMobile ? '20px 20px' : '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--color-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, flexShrink: 0,
              }}>🤖</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{t('play_vs_ai')}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {t('practice_offline')}
                </div>
              </div>
              <Button
                variant="ghost" size="sm"
                onClick={() => navigate('/play/offline')}
                style={{ flexShrink: 0 }}
              >
                {t('play')}
              </Button>
            </div>
          </Card>

          {/* Pending challenges */}
          {challenges.length > 0 && (
            <Card>
              <h3 style={{ fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                {t('challenges_received')}
                <Badge variant="danger">{challenges.length}</Badge>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {challenges.map(c => (
                  <ChallengeRow
                    key={c.challengerId}
                    challenge={c}
                    onAccept={() => acceptChallenge(c.challengerId)}
                    onDeny={() => denyChallenge(c.challengerId)}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar — Friends */}
        <Card>
          <h3 style={{ fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {t('friends')}
            <Badge variant={onlineCount > 0 ? 'success' : 'muted'}>{t('online_count', { count: onlineCount })}</Badge>
          </h3>
          {friends.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
              {t('no_friends')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {friendsWithStatus.slice(0, 12).map(f => (
                <FriendRow
                  key={f.id}
                  friend={f}
                  outgoing={outgoingChallenges[f.id]}
                  onChallenge={async () => {
                    setPendingChallenge(f.id);
                    try {
                      await api.post('/matchmaking/challenge', { challengedId: f.id });
                    } catch {
                      clearOutgoingChallenge(f.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChallengeRow({ challenge, onAccept, onDeny }: {
  challenge: { challengerId: string; challengerNickname: string; challengerRating: number; expiresAt: number };
  onAccept: () => void;
  onDeny: () => void;
}) {
  const { t } = useTranslation('lobby');
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.round((challenge.expiresAt - Date.now()) / 1000)),
  );
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 8,
      padding: '12px 16px',
      background: 'var(--color-surface-2)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{challenge.challengerNickname}</span>
          {' '}
          <Badge variant="muted">ELO {challenge.challengerRating}</Badge>
        </div>
        <span style={{ fontSize: 12, color: remaining <= 10 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
          {remaining}s
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          size="sm"
          disabled={accepting}
          onClick={async () => { setAccepting(true); await onAccept(); }}
        >
          {accepting ? '...' : t('accept')}
        </Button>
        <Button size="sm" variant="ghost" disabled={accepting} onClick={onDeny}>{t('decline')}</Button>
      </div>
    </div>
  );
}

function FriendRow({ friend, outgoing, onChallenge }: {
  friend: Friend;
  outgoing?: { status: 'pending' | 'rejected'; cooldownUntil: number };
  onChallenge: () => void;
}) {
  const { t } = useTranslation('lobby');
  const [hover, setHover] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (outgoing?.status === 'rejected') {
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((outgoing.cooldownUntil - Date.now()) / 1000));
        setCooldown(remaining);
        if (remaining === 0 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    } else {
      setCooldown(0);
    }
  }, [outgoing]);

  const challengeBtn = () => {
    if (!friend.isOnline) return null;
    if (outgoing?.status === 'pending') {
      return (
        <Button size="sm" disabled style={{ fontSize: 11, padding: '4px 8px', opacity: 0.6 }}>
          {t('waiting')}
        </Button>
      );
    }
    if (outgoing?.status === 'rejected' && cooldown > 0) {
      return (
        <Button size="sm" disabled style={{ fontSize: 11, padding: '4px 8px', opacity: 0.5 }}>
          {cooldown}s
        </Button>
      );
    }
    if (hover) {
      return (
        <Button size="sm" onClick={onChallenge} style={{ fontSize: 11, padding: '4px 8px' }}>
          {t('challenge')}
        </Button>
      );
    }
    return null;
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 'var(--radius-sm)',
        background: hover ? 'var(--color-surface-2)' : 'transparent',
        transition: 'background var(--transition)',
      }}
    >
      <Avatar src={friend.avatarUrl} name={friend.nickname} size={34} online={friend.isOnline} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {friend.nickname}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>ELO {friend.rating}</div>
      </div>
      {challengeBtn()}
    </div>
  );
}

function PulseIcon() {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: '#fff',
      animation: 'pulse 1s infinite',
    }} />
  );
}
