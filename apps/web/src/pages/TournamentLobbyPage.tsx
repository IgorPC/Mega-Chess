import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useGameStore } from '../store/game.store';
import { getTournamentSocket } from '../lib/tournament-socket';
import { getGameSocket } from '../lib/socket';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { TournamentBracket, type TournamentBracketData } from '../components/tournaments/TournamentBracket';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  rating?: number;
  status: 'REGISTERED' | 'ACTIVE' | 'ELIMINATED' | 'CHAMPION' | 'SECOND' | 'THIRD' | 'KICKED' | 'LEFT';
  hasEntryDebited: boolean;
  bracketPosition: number | null;
}

interface TournamentDetail {
  id: string;
  name: string;
  type: string;
  status: 'REGISTERING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';
  entryFeeCc: number;
  creationFeeCc: number;
  prizePoolCc: number;
  rakeCc: number;
  maxPlayers: number;
  timeControl: string;
  isPrivate: boolean;
  isFlexible: boolean;
  creatorId: string;
  bracketData: TournamentBracketData | null;
  participants: Participant[];
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  aiFraudStatus: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'TIMEOUT' | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcPrizes(maxPlayers: number, entryFee: number) {
  const total     = maxPlayers * entryFee;
  const rake      = Math.floor(total * 0.1);
  const prizePool = total - rake;
  if (maxPlayers <= 4) {
    const first  = Math.floor(prizePool * 0.6);
    const second = prizePool - first;
    return { total, prizePool, first, second, third: 0, rake, hasThird: false };
  }
  const first     = Math.floor(prizePool * 0.5);
  const second    = Math.floor(prizePool * 0.35);
  const third     = Math.floor(prizePool * 0.15);
  const extraRake = prizePool - first - second - third;
  return { total, prizePool, first, second, third, rake: rake + extraRake, hasThird: true };
}

function formatTC(tc: string): string {
  const m: Record<string, string> = {
    '1+0': '1+0 Bullet', '3+2': '3+2 Blitz', '5+0': '5+0 Blitz',
    '5+3': '5+3 Blitz', '10+0': '10+0 Rápido', '15+10': '15+10 Rápido', '30+0': '30+0 Clássico',
  };
  return m[tc] ?? tc;
}

function statusLabel(s: TournamentDetail['status']) {
  return {
    REGISTERING: { text: 'Inscrições abertas', color: 'var(--color-primary)' },
    IN_PROGRESS: { text: 'Em andamento', color: '#22c55e' },
    FINISHED:    { text: 'Finalizado', color: 'var(--color-text-muted)' },
    CANCELLED:   { text: 'Cancelado', color: 'var(--color-danger)' },
  }[s] ?? { text: s, color: 'var(--color-text-muted)' };
}

function participantStatusIcon(s: Participant['status']): string {
  return {
    REGISTERED:  '⏳',
    ACTIVE:      '⚔️',
    ELIMINATED:  '❌',
    CHAMPION:    '🏆',
    SECOND:      '🥈',
    THIRD:       '🥉',
    KICKED:      '🚫',
    LEFT:        '🚪',
  }[s] ?? '⏳';
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: highlight ? 'var(--color-primary)' : 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

// ─── Rules accordion ──────────────────────────────────────────────────────────

function RulesSection() {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '14px 18px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font)', fontWeight: 600, fontSize: 14, color: 'var(--color-text)',
        }}
      >
        <span>📋 Regras e informações</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12, transition: 'transform var(--transition)', transform: open ? 'rotate(180deg)' : 'none' }}>
          ▼
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RuleBlock icon="🏆" title="Formato">
            Eliminação simples — perdeu, saiu. Com <strong>8 ou mais jogadores</strong>, há disputa de 3º lugar entre os dois semifinalistas eliminados (1º/2º/3º recebem 50%/35%/15% do pote). Com <strong>4 jogadores</strong>, não há 3º lugar — o pote é dividido 60% para o 1º e 40% para o 2º. Intervalo mínimo de 30 segundos entre partidas do mesmo jogador.
          </RuleBlock>
          <RuleBlock icon="◈" title="Débito de entrada">
            A taxa de entrada <strong>não é cobrada no momento da inscrição</strong>. O débito ocorre atomicamente quando o torneio inicia (todos os slots preenchidos ou o criador inicia no modo flexível).
          </RuleBlock>
          <RuleBlock icon="📊" title="Distribuição de prêmios">
            90% do total arrecadado forma o pote. Distribuição: <strong>1º lugar 50%</strong>, <strong>2º lugar 35%</strong>, <strong>3º lugar 15%</strong>. Todos os valores são inteiros (sem centavos) — arredondamento vai para o rake.
          </RuleBlock>
          <RuleBlock icon="⚖️" title="Desempate em empates">
            Quando uma partida termina em empate, o desempate segue a ordem:
            <ol style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.8 }}>
              <li><strong>Material no tabuleiro</strong> — quem tem mais peças (P=1, N/B=3, T=5, D=9) vence.</li>
              <li><strong>Tempo restante no relógio</strong> — quem tem mais tempo vence.</li>
              <li><strong>Dupla eliminação</strong> — ambos são eliminados; os dois adversários avançam.</li>
            </ol>
          </RuleBlock>
          <RuleBlock icon="🤖" title="Análise antifraude (IA)">
            Após o torneio finalizar, o DeepSeek analisa todas as partidas em busca de padrões suspeitos (acordos, abandono intencional, etc.). SLA de 60 minutos — se não responder a tempo, os prêmios são liberados automaticamente. Resultados FLAGGED podem bloquear saques temporariamente.
          </RuleBlock>
          <RuleBlock icon="⏰" title="Torneio estagnado">
            Se o torneio permanecer em inscrições por <strong>24 horas</strong>, todos os participantes são notificados. Após <strong>48 horas</strong>, o torneio é cancelado automaticamente. A taxa de criação paga pelo criador não é reembolsada em nenhum caso.
          </RuleBlock>
          <RuleBlock icon="🔒" title="Privacidade">
            Torneios privados exigem senha para inscrição. O criador pode convidar jogadores diretamente pelo nickname ou lista de amigos — jogadores convidados não precisam digitar senha.
          </RuleBlock>
        </div>
      )}
    </Card>
  );
}

function RuleBlock({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 14px', background: 'var(--color-surface-2)',
      borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.6,
    }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{icon} {title}</p>
      <div style={{ color: 'var(--color-text-muted)' }}>{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TournamentLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const { setMatch } = useGameStore();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,      setError]      = useState('');
  const [pwdInput,   setPwdInput]   = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [nickname,   setNickname]   = useState('');
  const [inviteMsg,  setInviteMsg]  = useState('');
  const [section,    setSection]    = useState<'info' | 'bracket'>('info');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isParticipantRegistering, setIsParticipantRegistering] = useState(false);

  const tournSocketRef = useRef(getTournamentSocket());
  const gameSocketRef  = useRef(getGameSocket());
  const isParticipantRegisteringRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.get<TournamentDetail>(`/tournaments/${id}`);
      setTournament(data);
    } catch { setError('Torneio não encontrado.'); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!tournament || !user) { setIsParticipantRegistering(false); isParticipantRegisteringRef.current = false; return; }
    const part = tournament.participants.find(p => p.userId === user.id);
    const creator = tournament.creatorId === user.id;
    const inactive = ['KICKED', 'LEFT'].includes(part?.status ?? '');
    const val = !!part && !inactive && tournament.status === 'REGISTERING' && !creator;
    setIsParticipantRegistering(val);
    isParticipantRegisteringRef.current = val;
  }, [tournament, user]);

  // Auto-remove on unmount (back button, in-app navigation)
  useEffect(() => {
    return () => {
      if (isParticipantRegisteringRef.current && id) {
        api.delete(`/tournaments/${id}/leave`).catch(() => {});
      }
    };
  }, [id]);

  useEffect(() => {
    if (!isParticipantRegistering) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isParticipantRegistering]);

  const [nextRoundCountdown, setNextRoundCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Socket: join tournament room + listen for bracket/status updates
  useEffect(() => {
    if (!id) return;
    const sock = tournSocketRef.current;

    const joinRoom = () => sock.emit('join_tournament_room', { tournamentId: id });
    // Re-join on every (re)connect so the socket room survives reconnects
    sock.on('connect', joinRoom);
    if (sock.connected) joinRoom();

    const onTournamentState = (data: { tournament: TournamentDetail }) => {
      setTournament(data.tournament);
      if (data.tournament.bracketData) setSection('bracket');
    };

    const onBracketUpdate = (data: { bracket: TournamentBracketData }) => {
      setTournament(prev => prev ? { ...prev, bracketData: data.bracket, status: 'IN_PROGRESS' } : prev);
      setSection('bracket');
    };

    const onRoomUpdate = (data: { participants?: Participant[]; type?: string }) => {
      if (data?.participants) {
        setTournament(prev => prev ? { ...prev, participants: data.participants! } : prev);
      } else {
        load();
      }
    };
    const onStarted = () => { load(); setSection('bracket'); };
    const onCancelled = () => setTournament(prev => prev ? { ...prev, status: 'CANCELLED' } : prev);
    const onFinished = (data?: { tournament?: TournamentDetail }) => {
      if (data?.tournament) {
        setTournament(data.tournament);
      } else {
        load();
      }
      setSection('bracket');
      setNextRoundCountdown(null);
    };

    const onNextRoundCountdown = (data: { seconds: number }) => {
      setNextRoundCountdown(data.seconds);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setNextRoundCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };

    sock.on('tournament_state', onTournamentState);
    sock.on('bracket_update', onBracketUpdate);
    sock.on('room_update', onRoomUpdate);
    sock.on('tournament_started', onStarted);
    sock.on('tournament_cancelled', onCancelled);
    sock.on('tournament_finished', onFinished);
    sock.on('next_round_countdown', onNextRoundCountdown);

    return () => {
      sock.off('connect', joinRoom);
      sock.emit('leave_tournament_room', { tournamentId: id });
      sock.off('tournament_state', onTournamentState);
      sock.off('bracket_update', onBracketUpdate);
      sock.off('room_update', onRoomUpdate);
      sock.off('tournament_started', onStarted);
      sock.off('tournament_cancelled', onCancelled);
      sock.off('tournament_finished', onFinished);
      sock.off('next_round_countdown', onNextRoundCountdown);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [id, load, navigate]);

  const doAction = useCallback(async (action: () => Promise<void>) => {
    setError('');
    setActionLoading(true);
    try {
      await action();
    } catch (e: any) {
      setError(e?.message ?? 'Ocorreu um erro.');
    } finally {
      await load();
      setActionLoading(false);
    }
  }, [load]);

  const join = () => doAction(() =>
    api.post(`/tournaments/${id}/join`, { password: pwdInput || undefined }),
  );

  const leave = () => doAction(() =>
    api.delete(`/tournaments/${id}/leave`),
  );

  const leaveWithConfirm = () => setShowLeaveModal(true);

  const confirmLeave = async () => {
    setShowLeaveModal(false);
    await doAction(() => api.delete(`/tournaments/${id}/leave`));
  };

  const cancelLeave = () => setShowLeaveModal(false);

  const start = () => doAction(() =>
    api.post(`/tournaments/${id}/start`, {}),
  );

  const cancel = () => doAction(() =>
    api.delete(`/tournaments/${id}`),
  );

  const kick = (userId: string) => doAction(() =>
    api.post(`/tournaments/${id}/kick`, { userId }),
  );

  const inviteByNickname = async () => {
    if (!nickname.trim()) return;
    setInviteMsg('');
    try {
      await api.post(`/tournaments/${id}/invite/nickname`, { nickname: nickname.trim() });
      setInviteMsg(`✓ Convite enviado para ${nickname}`);
      setNickname('');
    } catch (e: any) { setInviteMsg(e?.message ?? 'Erro ao convidar.'); }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ fontSize: 36, animation: 'spin 2s linear infinite' }}>♜</div>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Carregando torneio...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Torneio não encontrado</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>{error}</p>
        <Button onClick={() => navigate('/tournaments')}>← Voltar para torneios</Button>
      </div>
    );
  }

  const t = tournament;
  const prizes   = calcPrizes(t.maxPlayers, t.entryFeeCc);
  const myPart    = t.participants.find(p => p.userId === user?.id);
  const isCreator = t.creatorId === user?.id;
  const INACTIVE_STATUSES: Participant['status'][] = ['KICKED', 'LEFT'];
  const isActiveParticipant = !!myPart && !INACTIVE_STATUSES.includes(myPart.status);
  const count    = t.participants.filter(p => !['KICKED', 'LEFT'].includes(p.status)).length;
  const isFull    = count >= t.maxPlayers;
  const canJoin   = !isActiveParticipant && !isCreator && t.status === 'REGISTERING' && !isFull;
  const canLeave  = isActiveParticipant && !isCreator && t.status === 'REGISTERING';
  const canStart  = isCreator && t.status === 'REGISTERING' && (isFull || t.isFlexible) && count >= 4;
  const canCancel = isCreator && t.status === 'REGISTERING';
  const sl = statusLabel(t.status);
  const pct = Math.min(100, (count / t.maxPlayers) * 100);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '16px 14px' : '36px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          animation: 'fadeIn 150ms ease',
        }}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '28px 32px',
            maxWidth: 360, width: '90%', textAlign: 'center',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚪</div>
            <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Sair do torneio?</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              Você será removido da lista de participantes. A taxa de entrada <strong>não será cobrada</strong> pois o torneio ainda não iniciou.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" fullWidth onClick={cancelLeave}>Cancelar</Button>
              <Button variant="danger" fullWidth loading={actionLoading} onClick={confirmLeave}>Sair do torneio</Button>
            </div>
          </div>
        </div>
      )}

      {/* Next round countdown banner */}
      {nextRoundCountdown !== null && (
        <div style={{
          padding: '14px 20px', background: 'rgba(108,99,255,0.12)',
          border: '1px solid var(--color-primary)', borderRadius: 'var(--radius-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          animation: 'fadeIn 300ms ease',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>⚔️ Próxima partida em breve</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Prepare-se — o jogo começa automaticamente
            </div>
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, color: 'var(--color-primary)',
            minWidth: 52, textAlign: 'center',
          }}>
            {nextRoundCountdown}s
          </div>
        </div>
      )}

      {/* Back */}
      <button onClick={() => navigate('/tournaments')} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)',
        fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font)',
        alignSelf: 'flex-start',
      }}>
        ← Voltar
      </button>

      {/* Header card */}
      <Card glow={t.status === 'IN_PROGRESS'} style={{ padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, margin: 0 }}>{t.name}</h1>
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'rgba(108,99,255,0.12)', color: sl.color, fontWeight: 600 }}>
                {sl.text}
              </span>
              {t.isPrivate && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(255,160,0,0.1)', color: '#f0a800' }}>
                  🔒 Privado
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {formatTC(t.timeControl)} · Eliminação simples · Máx {t.maxPlayers} jogadores
            </div>
          </div>
          {t.aiFraudStatus === 'PENDING' && t.status === 'FINISHED' && (
            <div style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(255,160,0,0.1)', borderRadius: 'var(--radius-sm)', color: '#f0a800' }}>
              🤖 Análise antifraude em andamento...
            </div>
          )}
          {t.aiFraudStatus === 'FLAGGED' && (
            <div style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)' }}>
              ⚠️ Resultado em análise — prêmios retidos
            </div>
          )}
        </div>

        {/* Filling progress */}
        {t.status === 'REGISTERING' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: isFull ? 'var(--color-primary)' : 'var(--color-primary)',
                transition: 'width 400ms ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 5 }}>
              <span>{count} de {t.maxPlayers} inscritos</span>
              <span>{isFull ? '⚡ Pronto para iniciar' : `${t.maxPlayers - count} vagas restantes`}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Tabs (only when bracket available) */}
      {t.bracketData && (
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 4 }}>
          <button onClick={() => setSection('info')} style={tabStyle(section === 'info')}>📋 Informações</button>
          <button onClick={() => setSection('bracket')} style={tabStyle(section === 'bracket')}>🏆 Chaveamento</button>
        </div>
      )}

      {section === 'bracket' && t.bracketData ? (
        /* ── Bracket view ── */
        <Card style={{ padding: 20, overflowX: 'auto' }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Chaveamento</h2>
          <TournamentBracket
            bracket={t.bracketData}
            participants={t.participants.map(p => ({ userId: p.userId, nickname: p.nickname }))}
          />
        </Card>
      ) : (
        /* ── Info view ── */
        <>
          {/* Fee + Prize info */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
            {/* Prizes */}
            <Card style={{ padding: 18 }}>
              <p style={sectionLabelStyle}>Distribuição de prêmios</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                  <span>🏆 1º lugar {prizes.hasThird ? '(50%)' : '(60%)'}</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{prizes.first} CC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>🥈 2º lugar {prizes.hasThird ? '(35%)' : '(40%)'}</span>
                  <span style={{ fontWeight: 600 }}>{prizes.second} CC</span>
                </div>
                {prizes.hasThird && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>🥉 3º lugar (15%)</span>
                    <span style={{ fontWeight: 600 }}>{prizes.third} CC</span>
                  </div>
                )}
                {!prizes.hasThird && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', padding: '4px 8px', background: 'rgba(108,99,255,0.06)', borderRadius: 4 }}>
                    Torneio de 4 jogadores — sem disputa de 3º lugar
                  </div>
                )}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <span>Pote total</span><span>{prizes.total} CC</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                    <span>Taxa plataforma (10%)</span><span>{prizes.rake} CC</span>
                  </div>
                </div>
                {t.status !== 'REGISTERING' && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {t.status === 'FINISHED' ? '✓ Prêmios distribuídos' : 'Valores finais distribuídos após o término'}
                  </p>
                )}
                {t.status === 'REGISTERING' && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    Valores calculados com {t.maxPlayers} jogadores. Debitados apenas ao iniciar.
                  </p>
                )}
              </div>
            </Card>

            {/* Details */}
            <Card style={{ padding: 18 }}>
              <p style={sectionLabelStyle}>Detalhes</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InfoRow label="Taxa de entrada" value={`${t.entryFeeCc} CC`} highlight />
                <InfoRow label="Controle de tempo" value={formatTC(t.timeControl)} />
                <InfoRow label="Máx. jogadores" value={t.maxPlayers} />
                <InfoRow label="Rodadas" value={Math.log2(t.maxPlayers)} />
                <InfoRow label="Tipo" value={t.isPrivate ? '🔒 Privado' : '🌐 Público'} />
                {t.isFlexible && <InfoRow label="Modo flexível" value="✓ Início com menos jogadores" />}
              </div>
            </Card>
          </div>

          {/* Rules */}
          <RulesSection />

          {/* Participants */}
          <Card style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={sectionLabelStyle}>Participantes ({count}/{t.maxPlayers})</p>
            </div>
            {t.participants.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                Nenhum inscrito ainda. Seja o primeiro!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {t.participants
                  .filter(p => !['KICKED', 'LEFT'].includes(p.status))
                  .map((p, i) => {
                    const isMe = p.userId === user?.id;
                    const canKick = isCreator && !isMe && t.status === 'REGISTERING' && p.status === 'REGISTERED';
                    return (
                      <div key={p.userId} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                        background: isMe ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                        border: isMe ? '1px solid var(--color-primary)' : '1px solid transparent',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 20, textAlign: 'right' }}>
                          {i + 1}
                        </span>
                        <Avatar src={p.avatarUrl} name={p.nickname} size={32} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {p.nickname}
                            {isMe && <span style={{ fontSize: 11, color: 'var(--color-primary)' }}>você</span>}
                            {p.userId === t.creatorId && <span style={{ fontSize: 11, color: '#f0a800' }}>criador</span>}
                          </div>
                          {p.rating && (
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.rating} ELO</div>
                          )}
                        </div>
                        <span style={{ fontSize: 16 }} title={p.status}>{participantStatusIcon(p.status)}</span>
                        {canKick && (
                          <Button size="sm" variant="danger" loading={actionLoading} onClick={() => kick(p.userId)}>
                            Expulsar
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>

          {/* Invite by nickname (creator only) */}
          {isCreator && t.status === 'REGISTERING' && (
            <Card style={{ padding: 18 }}>
              <p style={sectionLabelStyle}>Convidar por nickname</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="Nickname do jogador"
                  onKeyDown={e => e.key === 'Enter' && inviteByNickname()}
                  style={{
                    flex: 1, padding: '9px 14px', fontSize: 13,
                    background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font)',
                  }}
                />
                <Button size="sm" onClick={inviteByNickname} disabled={!nickname.trim()}>Convidar</Button>
              </div>
              {inviteMsg && (
                <p style={{ fontSize: 12, marginTop: 6, color: inviteMsg.startsWith('✓') ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {inviteMsg}
                </p>
              )}
            </Card>
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--color-danger)' }}>
          {error}
        </div>
      )}

      {/* Action bar */}
      {t.status !== 'FINISHED' && t.status !== 'CANCELLED' && (
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {canJoin && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {t.isPrivate && !myPart && (
                  <input
                    type="password" placeholder="Senha do torneio" value={pwdInput}
                    onChange={e => setPwdInput(e.target.value)}
                    style={{
                      padding: '9px 14px', fontSize: 13,
                      background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font)',
                    }}
                  />
                )}
                <Button fullWidth loading={actionLoading} onClick={join}>
                  ◈ Participar · {t.entryFeeCc} CC (cobrado ao iniciar)
                </Button>
              </div>
            )}
            {canLeave && (
              <Button variant="outline" loading={actionLoading} onClick={leaveWithConfirm}>
                Sair do torneio
              </Button>
            )}
            {canStart && (
              <Button loading={actionLoading} onClick={start}>
                ⚡ Iniciar torneio ({count} jogadores)
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" loading={actionLoading} onClick={cancel}>
                Cancelar torneio
              </Button>
            )}
            {t.status === 'IN_PROGRESS' && myPart && myPart.status === 'ACTIVE' && (
              <div style={{ flex: 1, padding: '12px 16px', background: 'var(--color-primary-dim)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                ⚔️ Torneio em andamento — aguarde sua próxima partida.
              </div>
            )}
            {t.status === 'IN_PROGRESS' && myPart && myPart.status === 'ELIMINATED' && (
              <div style={{ flex: 1, padding: '12px 16px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--color-text-muted)' }}>
                ❌ Você foi eliminado — acompanhe o chaveamento ao vivo.
              </div>
            )}
            {t.status === 'IN_PROGRESS' && myPart && ['CHAMPION', 'SECOND', 'THIRD'].includes(myPart.status) && (
              <div style={{ flex: 1, padding: '12px 16px', background: 'rgba(76,175,80,0.08)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                {myPart.status === 'CHAMPION' ? '🏆 Parabéns! Você é o campeão!' : myPart.status === 'SECOND' ? '🥈 Ótima performance — 2º lugar!' : '🥉 3º lugar conquistado!'}
              </div>
            )}
          </div>

          {/* Warning: cancel doesn't refund creation fee */}
          {canCancel && (
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
              ⚠️ Cancelar não reembolsa a taxa de criação ({t.creationFeeCc} CC).
              Jogadores inscritos não são cobrados.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '10px 8px', borderRadius: 'var(--radius-sm)',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all var(--transition)',
    background: active ? 'var(--color-surface-2)' : 'transparent',
    color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
    fontFamily: 'var(--font)', border: 'none',
  };
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
  color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 12,
};
