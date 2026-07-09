import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

const DUEL_LABELS: Record<DuelType, string> = {
  DUEL_FLASH: 'Flash (3+2)',
  DUEL_GIANT: 'Gigante (10+0)',
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
          Convidar amigo — {DUEL_LABELS[duelType]}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Aposta: <strong style={{ color: 'var(--color-primary)' }}>{entryFee} CC</strong> cada ·
          Prêmio: <strong style={{ color: 'var(--color-primary)' }}>{duelPrize(entryFee)} CC</strong>
        </p>
        {loading ? (
          <p style={muteCenter}>Carregando...</p>
        ) : friends.length === 0 ? (
          <p style={muteCenter}>Nenhum amigo online no momento.</p>
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
                  <span style={{ fontSize: 12, color: 'var(--color-success)' }}>✓ Enviado</span>
                ) : (
                  <Button size="sm" loading={inviting === f.id} onClick={() => invite(f.id)}>Convidar</Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Button fullWidth variant="ghost" style={{ marginTop: 20 }} onClick={onClose}>Cancelar</Button>
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

function queueLabel(count: number) {
  if (count <= 2) return 'Baixa';
  if (count <= 8) return 'Média';
  return 'Alta';
}

function DuelPanel() {
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
      setError('Você precisa ter ao menos 18 anos e informar sua data de nascimento no perfil para participar de duelos.');
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
      setError(e?.message ?? 'Erro ao entrar na fila.');
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
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Procurando adversário...</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 4 }}>
          {DUEL_LABELS[duelType]} · {entryFee} CC por jogador
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 24 }}>
          Prêmio: <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{duelPrize(entryFee)} CC</span> (90% do pote)
        </p>
        <Button variant="danger" onClick={leaveQueue}>Cancelar busca</Button>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Type selector */}
      <Card style={{ padding: 20 }}>
        <SectionLabel>Modalidade</SectionLabel>
        <div style={{ display: 'flex', gap: 10 }}>
          {(['DUEL_FLASH', 'DUEL_GIANT'] as DuelType[]).map(t => {
            const typeCount = DUEL_FEES.reduce((sum, fee) => sum + (duelSizes[`${t}:${fee}`] ?? 0), 0);
            return (
              <button key={t} onClick={() => setDuelType(t)} style={{
                flex: 1, padding: '14px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `2px solid ${duelType === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: duelType === t ? 'var(--color-primary-dim)' : 'var(--color-surface)',
                transition: 'all var(--transition)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{DUEL_ICONS[t]}</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{DUEL_LABELS[t]}</div>
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
        <SectionLabel>Aposta por jogador</SectionLabel>
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
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3 }}>CC</div>
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
          <span style={{ color: 'var(--color-text-muted)' }}>Prêmio ao vencedor (90%)</span>
          <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{duelPrize(entryFee)} CC</span>
        </div>
      </Card>

      {/* Rules for duel */}
      <Card style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
          <span>ℹ️</span>
          <span>10% de rake · Desempate por material → tempo restante → dupla eliminação · Análise antifraude pós-partida</span>
        </div>
      </Card>

      {/* Financial risk warning */}
      <Card style={{ padding: '14px 18px', border: '1px solid var(--color-danger)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--color-danger)' }}>Duelos envolvem risco financeiro real.</strong> A aposta de{' '}
            <strong>{entryFee} CC</strong> é debitada da sua carteira ao formar a partida e{' '}
            <strong>não é reembolsável em caso de derrota</strong>. A Plataforma retém 10% do pote (rake) mesmo do
            vencedor. Jogue apenas com valores que você pode perder e nunca compartilhe sua conta com terceiros.
          </div>
        </div>
      </Card>

      {!isEligible && (
        <Card style={{ padding: '14px 18px', border: '1px solid var(--color-danger)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--color-danger)' }}>Duelos exigem confirmação de maioridade.</strong>{' '}
              {user?.birthDate
                ? 'Você precisa ter ao menos 18 anos para participar de duelos.'
                : <>Informe sua data de nascimento em <a href="/profile/me" style={{ color: 'var(--color-primary)' }}>Editar Perfil</a> para liberar os duelos.</>}
            </div>
          </div>
        </Card>
      )}

      {error && <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button fullWidth loading={loading} disabled={!isEligible} onClick={joinQueue}>♟ Buscar adversário</Button>
        <Button fullWidth variant="outline" disabled={!isEligible} onClick={() => setShowInvite(true)}>👥 Convidar amigo</Button>
      </div>

      {showInvite && (
        <InviteModal duelType={duelType} entryFee={entryFee} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}

// ─── Coming Soon Panel ────────────────────────────────────────────────────────

function TournamentsComingSoonPanel() {
  return (
    <Card style={{ padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🏆</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Torneios em breve</h2>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 380, margin: '0 auto 24px', lineHeight: 1.7 }}>
        Estamos finalizando o módulo de torneios da comunidade — eliminação simples, até 64 jogadores,
        prêmios automáticos e muito mais. Fique de olho!
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 18px', borderRadius: 'var(--radius-full)',
        background: 'var(--color-primary-dim)',
        border: '1px solid var(--color-primary)',
        fontSize: 13, color: 'var(--color-primary)', fontWeight: 600,
      }}>
        Em desenvolvimento
      </div>
      <div style={{
        marginTop: 32, padding: '14px 18px',
        background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)',
        fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.7, textAlign: 'left',
      }}>
        <strong style={{ color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>O que está por vir</strong>
        Torneios públicos e privados · Eliminação simples com 3º lugar · Taxa de entrada em Chess Coins ·
        Pote de prêmios automático · Chaveamento em tempo real · Análise antifraude pós-torneio
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
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState<'duel' | 'tournament'>('duel');

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, marginBottom: 6 }}>Competições</h1>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>
        Duelos 1v1 ou torneios de até 64 jogadores criados pela comunidade.
      </p>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 4,
      }}>
        <button onClick={() => setTab('duel')} style={tabStyle(tab === 'duel')}>
          ⚡ Duelo 1v1
        </button>
        <button onClick={() => setTab('tournament')} style={tabStyle(tab === 'tournament')}>
          🏆 Torneios
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
