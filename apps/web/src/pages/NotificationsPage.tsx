import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useSocialStore } from '../store/social.store';

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

type ActionState = 'idle' | 'loading' | 'done';

const TYPE_ICONS: Record<string, string> = {
  FRIEND_REQUEST: '👤',
  FRIEND_ACCEPTED: '🤝',
  GAME_CHALLENGE: '⚔️',
  DUEL_INVITE: '⚔️',
  GAME_STARTED: '♟️',
  MESSAGE_RECEIVED: '💬',
  MATCH_REPORT_RESULT: '🔍',
  ADMIN_MESSAGE: '📢',
  MAINTENANCE_ALERT: '🔧',
  ACCOUNT_SUSPENDED: '🚫',
};

const DUEL_LABELS: Record<string, string> = {
  DUEL_FLASH: 'Flash (3+2)',
  DUEL_GIANT: 'Gigante (10+0)',
};

function duelPrize(fee: number) {
  return Math.floor(fee * 2 * 0.9);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

// ─── Notification row variants ────────────────────────────────────────────────

function FriendRequestRow({ n, onDone }: { n: Notification; onDone: (id: string) => void }) {
  const [state, setState] = useState<ActionState>('idle');
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null);
  const requestId = n.payload.requestId as string;
  const fromNickname = n.payload.fromNickname as string;

  const respond = async (accept: boolean) => {
    setState('loading');
    try {
      await api.patch(`/friends/request/${requestId}/${accept ? 'accept' : 'decline'}`);
      setResult(accept ? 'accepted' : 'declined');
      setState('done');
      setTimeout(() => onDone(n.id), 1500);
    } catch {
      setState('idle');
    }
  };

  return (
    <NotifShell n={n}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>Solicitação de amizade</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
        <strong style={{ color: 'var(--color-text)' }}>@{fromNickname}</strong> quer ser seu amigo
      </div>
      {state === 'done' ? (
        <div style={{ fontSize: 13, marginTop: 8, color: result === 'accepted' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
          {result === 'accepted' ? '✓ Amizade aceita!' : 'Solicitação recusada'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Button size="sm" onClick={() => respond(true)} disabled={state === 'loading'}>Aceitar</Button>
          <Button size="sm" variant="ghost" onClick={() => respond(false)} disabled={state === 'loading'}>Recusar</Button>
        </div>
      )}
    </NotifShell>
  );
}

function DuelInviteRow({ n, onDone }: { n: Notification; onDone: (id: string) => void }) {
  const [state, setState] = useState<ActionState>('idle');
  const [result, setResult] = useState<'accepted' | 'declined' | null>(null);
  const tournamentId = n.payload.tournamentId as string;
  const inviterNickname = n.payload.inviterNickname as string;
  const type = n.payload.type as string;
  const entryFee = n.payload.entryFee as number;
  const expiresAt = n.payload.expiresAt as string;
  const isExpired = expiresAt && new Date(expiresAt).getTime() < Date.now();

  const respond = async (accept: boolean) => {
    setState('loading');
    try {
      if (accept) {
        await api.post(`/tournaments/duel/${tournamentId}/accept`, {});
        await api.patch(`/notifications/${n.id}/read`);
        setResult('accepted');
        setState('done');
        // Navigation handled by match_found WebSocket event in SocialSocketManager
      } else {
        await api.post(`/tournaments/duel/${tournamentId}/decline`, {});
        await api.patch(`/notifications/${n.id}/read`);
        setResult('declined');
        setState('done');
        setTimeout(() => onDone(n.id), 1500);
      }
    } catch {
      setState('idle');
    }
  };

  return (
    <NotifShell n={n}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Convite de Duelo Ranqueado</div>
        {isExpired && (
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-surface-2)', padding: '1px 6px', borderRadius: 4 }}>
            Expirado
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
        <strong style={{ color: 'var(--color-text)' }}>@{inviterNickname}</strong>
        {' '}te desafiou
      </div>
      <div style={{
        display: 'flex', gap: 12, marginTop: 6, fontSize: 12,
        color: 'var(--color-text-muted)',
      }}>
        <span>⚡ {DUEL_LABELS[type] ?? type}</span>
        <span>◈ {entryFee} CC · Prêmio: <strong style={{ color: 'var(--color-primary)' }}>{duelPrize(entryFee)} CC</strong></span>
      </div>
      {state === 'done' ? (
        <div style={{ fontSize: 13, marginTop: 8, color: result === 'accepted' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
          {result === 'accepted' ? '♟ Partida iniciando...' : 'Convite recusado'}
        </div>
      ) : isExpired ? (
        <div style={{ fontSize: 12, marginTop: 8, color: 'var(--color-text-muted)' }}>
          Este convite expirou
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Button size="sm" onClick={() => respond(true)} disabled={state === 'loading'}>Aceitar</Button>
          <Button size="sm" variant="ghost" onClick={() => respond(false)} disabled={state === 'loading'}>Recusar</Button>
        </div>
      )}
    </NotifShell>
  );
}

function ChallengeRow({ n, onDone }: { n: Notification; onDone: (id: string) => void }) {
  const navigate = useNavigate();
  const { removeChallenge } = useSocialStore();
  const [state, setState] = useState<ActionState>('idle');
  const [result, setResult] = useState<'accepted' | 'denied' | null>(null);
  const challengerId = n.payload.challengerId as string;
  const challengerNickname = n.payload.challengerNickname as string;
  const challengerRating = n.payload.challengerRating as number;

  const respond = async (accept: boolean) => {
    setState('loading');
    try {
      if (accept) {
        await api.post('/matchmaking/challenge/accept', { challengerId });
        removeChallenge(challengerId);
        setResult('accepted');
        setState('done');
        setTimeout(() => onDone(n.id), 800);
      } else {
        await api.post('/matchmaking/challenge/deny', { challengerId });
        removeChallenge(challengerId);
        setResult('denied');
        setState('done');
        setTimeout(() => onDone(n.id), 1500);
      }
    } catch {
      setState('idle');
    }
  };

  return (
    <NotifShell n={n}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>Desafio de partida</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
        <strong style={{ color: 'var(--color-text)' }}>@{challengerNickname}</strong>
        {' '}te desafiou · ELO {challengerRating}
      </div>
      {state === 'done' ? (
        <div style={{ fontSize: 13, marginTop: 8, color: result === 'accepted' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
          {result === 'accepted' ? '♟ Partida iniciando...' : 'Desafio recusado'}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Button size="sm" onClick={() => respond(true)} disabled={state === 'loading'}>Aceitar</Button>
          <Button size="sm" variant="ghost" onClick={() => respond(false)} disabled={state === 'loading'}>Recusar</Button>
        </div>
      )}
    </NotifShell>
  );
}

function MessageRow({ n }: { n: Notification }) {
  const navigate = useNavigate();
  const senderId = n.payload.senderId as string;
  const senderNickname = n.payload.senderNickname as string;
  const preview = n.payload.preview as string | undefined;

  return (
    <button
      onClick={() => navigate('/friends', { state: { openFriendId: senderId } })}
      style={{ width: '100%', textAlign: 'left', background: 'transparent' }}
    >
      <NotifShell n={n} clickable>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Nova mensagem</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
          <strong style={{ color: 'var(--color-text)' }}>@{senderNickname ?? 'alguém'}</strong>
          {preview ? `: ${preview}` : ' enviou uma mensagem'}
        </div>
      </NotifShell>
    </button>
  );
}

function MatchReportResultRow({ n }: { n: Notification }) {
  const navigate = useNavigate();
  const verdict = n.payload.verdict as string | undefined;
  const matchId = n.payload.matchId as string | undefined;
  const explanation = n.payload.explanation as string | undefined;

  const VERDICT_COLORS: Record<string, string> = {
    CLEAN: 'var(--color-success)',
    SUSPICIOUS: '#e6a817',
    CHEATING: 'var(--color-danger)',
  };
  const VERDICT_LABELS: Record<string, string> = {
    CLEAN: '✓ Limpo',
    SUSPICIOUS: '⚠ Suspeito',
    CHEATING: '🚫 Trapaça detectada',
  };

  const inner = (
    <NotifShell n={n} clickable={!!matchId}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>Resultado da análise</div>
      {verdict && (
        <div style={{ fontSize: 13, fontWeight: 600, color: VERDICT_COLORS[verdict] ?? 'var(--color-text)', marginTop: 4 }}>
          {VERDICT_LABELS[verdict] ?? verdict}
        </div>
      )}
      {explanation && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
          {explanation}
        </div>
      )}
    </NotifShell>
  );

  if (matchId) {
    return (
      <button onClick={() => navigate('/history')} style={{ width: '100%', textAlign: 'left', background: 'transparent' }}>
        {inner}
      </button>
    );
  }
  return inner;
}

function AccountSuspendedRow({ n }: { n: Notification }) {
  const message = n.payload.message as string | undefined;
  return (
    <NotifShell n={n}>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-danger)' }}>Conta suspensa</div>
      {message && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>{message}</div>
      )}
    </NotifShell>
  );
}

function GenericRow({ n, onClick }: { n: Notification; onClick?: () => void }) {
  const labels: Record<string, string> = {
    FRIEND_ACCEPTED: 'Amizade aceita',
    GAME_STARTED: 'Partida iniciada',
    ADMIN_MESSAGE: 'Mensagem da administração',
    MAINTENANCE_ALERT: 'Aviso de manutenção',
  };
  const payload = n.payload as Record<string, string>;

  const inner = (
    <NotifShell n={n} clickable={!!onClick}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{labels[n.type] ?? n.type}</div>
      {payload.message && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>{payload.message}</div>
      )}
    </NotifShell>
  );

  if (onClick) {
    return <button onClick={onClick} style={{ width: '100%', textAlign: 'left', background: 'transparent' }}>{inner}</button>;
  }
  return inner;
}

// ─── Shell wrapper ─────────────────────────────────────────────────────────────

function NotifShell({ n, children, clickable }: { n: Notification; children: React.ReactNode; clickable?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '14px 16px', borderRadius: 'var(--radius-md)',
      background: n.readAt ? 'var(--color-surface)' : 'var(--color-surface-2)',
      border: `1px solid ${n.readAt ? 'var(--color-border)' : 'var(--color-primary)'}`,
      cursor: clickable ? 'pointer' : 'default',
      opacity: n.readAt ? 0.75 : 1,
      transition: 'opacity var(--transition)',
    }}>
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
        {TYPE_ICONS[n.type] ?? '🔔'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{timeAgo(n.createdAt)}</span>
          {!n.readAt && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)' }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const { isMobile } = useBreakpoint();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get<Notification[]>('/notifications')
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = useCallback(async () => {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })));
  }, []);

  // Called when an action resolves the notification (accept/deny); remove from list
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const renderRow = (n: Notification) => {
    switch (n.type) {
      case 'FRIEND_REQUEST':
        return <FriendRequestRow key={n.id} n={n} onDone={dismissNotification} />;
      case 'GAME_CHALLENGE':
        return <ChallengeRow key={n.id} n={n} onDone={dismissNotification} />;
      case 'DUEL_INVITE':
        return <DuelInviteRow key={n.id} n={n} onDone={dismissNotification} />;
      case 'MESSAGE_RECEIVED':
        return <MessageRow key={n.id} n={n} />;
      case 'GAME_STARTED': {
        const matchId = n.payload.matchId as string | undefined;
        return <GenericRow key={n.id} n={n} onClick={matchId ? () => navigate(`/game/${matchId}`) : undefined} />;
      }
      case 'MATCH_REPORT_RESULT':
        return <MatchReportResultRow key={n.id} n={n} />;
      case 'ACCOUNT_SUSPENDED':
        return <AccountSuspendedRow key={n.id} n={n} />;
      default:
        return <GenericRow key={n.id} n={n} />;
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Notificações
          </h1>
          {unreadCount > 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
              {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead}>
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
          Carregando...
        </div>
      ) : notifications.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Nenhuma notificação ainda
          </p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map(renderRow)}
        </div>
      )}
    </div>
  );
}
