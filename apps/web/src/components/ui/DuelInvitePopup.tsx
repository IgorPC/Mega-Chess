import React, { useEffect, useState } from 'react';
import { useSocialStore, DuelInvite } from '../../store/social.store';
import { api } from '../../lib/api';

const DUEL_LABELS: Record<string, string> = {
  DUEL_FLASH: 'Flash (3+2)',
  DUEL_GIANT: 'Gigante (10+0)',
};

function duelPrize(fee: number) {
  return Math.floor(fee * 2 * 0.9);
}

function InviteCard({ invite }: { invite: DuelInvite }) {
  const { removeDuelInvite } = useSocialStore();
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const remaining = Math.max(0, Math.floor((new Date(invite.expiresAt).getTime() - Date.now()) / 1000));
    return remaining;
  });

  useEffect(() => {
    if (secondsLeft <= 0) {
      removeDuelInvite(invite.tournamentId);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          removeDuelInvite(invite.tournamentId);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [invite.tournamentId, secondsLeft]);

  const accept = async () => {
    setLoading('accept');
    try {
      await api.post(`/tournaments/duel/${invite.tournamentId}/accept`, {});
      if (invite.notificationId) {
        api.patch(`/notifications/${invite.notificationId}/read`).catch(() => {});
      }
      removeDuelInvite(invite.tournamentId);
      // Navigation handled by match_found WebSocket event in SocialSocketManager
    } catch {
      setLoading(null);
    }
  };

  const decline = async () => {
    setLoading('decline');
    try {
      await api.post(`/tournaments/duel/${invite.tournamentId}/decline`, {});
      if (invite.notificationId) {
        api.patch(`/notifications/${invite.notificationId}/read`).catch(() => {});
      }
    } finally {
      removeDuelInvite(invite.tournamentId);
    }
  };

  const pct = Math.max(0, secondsLeft / 60);

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-primary)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 18px',
      minWidth: 280,
      maxWidth: 340,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      animation: 'slideIn 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--color-primary)', textTransform: 'uppercase',
        }}>
          ⚔️ Duelo Ranqueado
        </div>
        <div style={{
          fontSize: 11, color: secondsLeft <= 10 ? 'var(--color-danger)' : 'var(--color-text-muted)',
          fontWeight: secondsLeft <= 10 ? 700 : 400,
        }}>
          {secondsLeft}s
        </div>
      </div>

      {/* Countdown bar */}
      <div style={{
        height: 3, background: 'var(--color-border)', borderRadius: 2, marginBottom: 12,
      }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`,
          background: secondsLeft <= 10 ? 'var(--color-danger)' : 'var(--color-primary)',
          borderRadius: 2, transition: 'width 1s linear',
        }} />
      </div>

      {/* Inviter */}
      <div style={{ fontSize: 14, marginBottom: 6 }}>
        <strong style={{ color: 'var(--color-text)' }}>@{invite.inviterNickname}</strong>
        <span style={{ color: 'var(--color-text-muted)' }}> te desafiou</span>
      </div>

      {/* Details */}
      <div style={{
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 12px',
        marginBottom: 14,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Modalidade</span>
          <span style={{ fontWeight: 600 }}>{DUEL_LABELS[invite.type] ?? invite.type}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Aposta</span>
          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>◈ {invite.entryFee} CC cada</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Prêmio</span>
          <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>◈ {duelPrize(invite.entryFee)} CC</span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={loading !== null}
          onClick={accept}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-primary)', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading === 'accept' ? '...' : 'Aceitar'}
        </button>
        <button
          disabled={loading !== null}
          onClick={decline}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)',
            background: 'transparent', color: 'var(--color-text-muted)',
            fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            border: '1px solid var(--color-border)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading === 'decline' ? '...' : 'Recusar'}
        </button>
      </div>
    </div>
  );
}

export function DuelInvitePopup() {
  const duelInvites = useSocialStore(s => s.duelInvites);
  if (duelInvites.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        pointerEvents: 'none',
      }}>
        {duelInvites.map(inv => (
          <div key={inv.tournamentId} style={{ pointerEvents: 'auto' }}>
            <InviteCard invite={inv} />
          </div>
        ))}
      </div>
    </>
  );
}
