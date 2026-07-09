import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useGameStore } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useSound } from '../hooks/useSound';
import { getGameSocket } from '../lib/socket';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';

interface Player {
  id: string;
  nickname: string;
  avatarUrl?: string;
  rating: number;
}

interface WsGameState { match: { fen: string; pgn: string; moves: string[]; currentTurn: 'white' | 'black' } }
interface WsMoveBroadcast { fen: string; pgn: string; moves: string[]; turn: 'white' | 'black' }
interface WsTimerUpdate { seconds: number }
interface WsClockUpdate { whiteClock: number; blackClock: number; turn: 'white' | 'black' }
interface WsGameOver { result: string; reason: string }

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Xeque-mate',
  forfeit: 'Desistência',
  timeout: 'Tempo esgotado',
  stalemate: 'Afogamento',
  threefold: 'Repetição tripla',
  insufficient: 'Material insuficiente',
  fifty_moves: 'Regra dos 50 lances',
  draw: 'Empate',
};

const PROMOTION_PIECES = [
  { piece: 'q', label: 'Rainha', symbolW: '♕', symbolB: '♛' },
  { piece: 'r', label: 'Torre',  symbolW: '♖', symbolB: '♜' },
  { piece: 'b', label: 'Bispo',  symbolW: '♗', symbolB: '♝' },
  { piece: 'n', label: 'Cavalo', symbolW: '♘', symbolB: '♞' },
];

function needsPromotion(game: Chess, from: string, to: string): boolean {
  const piece = game.get(from as any);
  if (!piece || piece.type !== 'p') return false;
  return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
}

// ─── Forfeit confirmation modal ───────────────────────────────────────────────

const ForfeitModal = React.memo(function ForfeitModal({
  onConfirm, onCancel,
}: { onConfirm: () => void; onCancel: () => void }) {
  return (
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
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚑</div>
        <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Desistir da partida?</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
          Ao desistir você perde a partida e seu oponente recebe os pontos de ELO.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" fullWidth onClick={onCancel}>Cancelar</Button>
          <Button variant="danger" fullWidth onClick={onConfirm}>Sim, desistir</Button>
        </div>
      </div>
    </div>
  );
});

// ─── Game overlay (victory / defeat) ─────────────────────────────────────────

const GameOverlay = React.memo(function GameOverlay({
  outcome,
}: { outcome: 'win' | 'loss' | 'draw' }) {
  if (outcome === 'draw') return null;
  const isWin = outcome === 'win';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none',
      background: isWin
        ? 'rgba(76, 175, 80, 0.12)'
        : 'rgba(177, 86, 83, 0.12)',
      animation: 'fadeIn 600ms ease',
      border: `3px solid ${isWin ? 'var(--color-success)' : 'var(--color-danger)'}`,
    }} />
  );
});

export function GamePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuthStore();
  const {
    myColor, fen, currentTurn, timerSeconds: legacyTimerSeconds, whiteClock, blackClock,
    status, result, resultReason,
    whitePlayer, blackPlayer, chatMessages,
    setMatch, setFen, setTimer, setChessClock, setResult, addChatMessage, reset,
  } = useGameStore();
  const navigate = useNavigate();
  const { isMobile, isTablet, width } = useBreakpoint();
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(!isMobile);
  const [game] = useState(() => new Chess());
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [invalidMove, setInvalidMove] = useState(false);
  const [inCheck, setInCheck] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [tournamentRedirect, setTournamentRedirect] = useState<{ tournamentId: string; countdown: number; isDuel: boolean } | null>(null);
  const tournamentCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const invalidMoveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { play, muted, toggleMute } = useSound();

  // Move highlights
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [checkmateSquares, setCheckmateSquares] = useState<Record<string, React.CSSProperties>>({});

  // Promotion
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [promotionChoice, setPromotionChoice] = useState('q');

  const safeWidth = typeof window !== 'undefined' ? window.innerWidth : width;
  const boardWidth = isMobile
    ? Math.max(260, Math.min(safeWidth - 32, 460))
    : isTablet
    ? Math.min(400, width - 380)
    : Math.min(480, width - 380);

  const computeCheckmateHighlights = useCallback((chess: import('chess.js').Chess) => {
    const loser = chess.turn();
    let kingSquare = '';
    for (const row of chess.board()) {
      for (const piece of row) {
        if (piece && piece.type === 'k' && piece.color === loser) kingSquare = piece.square;
      }
    }
    if (!kingSquare) return;

    const files = ['a','b','c','d','e','f','g','h'];
    const fileIdx = files.indexOf(kingSquare[0]);
    const rank = parseInt(kingSquare[1]);
    const highlights: Record<string, React.CSSProperties> = {
      [kingSquare]: { backgroundColor: 'rgba(255, 200, 0, 0.65)' },
    };
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const f = fileIdx + df;
        const r = rank + dr;
        if (f >= 0 && f < 8 && r >= 1 && r <= 8) {
          highlights[`${files[f]}${r}`] = { backgroundColor: 'rgba(180, 30, 30, 0.45)' };
        }
      }
    }
    setCheckmateSquares(highlights);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setOptionSquares({});
  }, []);

  useEffect(() => {
    const socket = getGameSocket();
    socket.emit('join_game', { matchId });

    socket.on('game_state', (data: WsGameState) => {
      // Authoritative resync — e.g. when the user leaves and returns to an
      // in-progress match, this carries whatever moves happened meanwhile.
      game.load(data.match.fen);
      setFen(data.match.fen, data.match.pgn, data.match.moves, data.match.currentTurn);
      setInCheck(game.inCheck());
      clearSelection();
      play('gameStart');
    });
    socket.on('move_broadcast', (data: WsMoveBroadcast) => {
      game.load(data.fen);
      setFen(data.fen, data.pgn, data.moves, data.turn);
      const isCapture = (data.moves[data.moves.length - 1] ?? '').includes('x');
      play(isCapture ? 'capture' : 'move');
      if (game.inCheck()) play('check');
      setInCheck(game.inCheck());
      clearSelection();
      if (game.isCheckmate()) computeCheckmateHighlights(game);
    });
    socket.on('move_rejected', (data: { fen: string; turn: 'white' | 'black' }) => {
      // Server refused an illegal/desynced move — reload the authoritative state.
      game.load(data.fen);
      setFen(data.fen, game.pgn(), [], data.turn);
      setInCheck(game.inCheck());
      clearSelection();
      triggerInvalidMove();
    });
    socket.on('timer_update', (data: WsTimerUpdate) => setTimer(data.seconds));
    socket.on('clock_update', (data: WsClockUpdate) => setChessClock(data.whiteClock, data.blackClock));
    socket.on('game_over', (data: WsGameOver) => { setResult(data.result, data.reason); });
    socket.on('chat_message', (msg: any) => addChatMessage(msg));
    socket.on('tournament_match_over', (data: { tournamentId: string; isDuel?: boolean }) => {
      setTournamentRedirect({ tournamentId: data.tournamentId, countdown: 8, isDuel: data.isDuel ?? false });
    });

    return () => {
      socket.emit('leave_game', { matchId });
      socket.off('game_state');
      socket.off('move_broadcast');
      socket.off('move_rejected');
      socket.off('timer_update');
      socket.off('clock_update');
      socket.off('game_over');
      socket.off('chat_message');
      socket.off('tournament_match_over');
    };
  }, [matchId]);

  // Recovery: if we arrived without match_found (e.g. via polling fallback), store is empty.
  // Fetch active match data from API and populate the store.
  useEffect(() => {
    if (myColor) return; // store already populated
    api.get<{ matchId: string; color: 'white' | 'black'; whitePlayer: any; blackPlayer: any } | null>('/matchmaking/active-match')
      .then(data => {
        if (data?.matchId && data.whitePlayer && data.blackPlayer) {
          setMatch(data.matchId, data.color, data.whitePlayer, data.blackPlayer);
        }
      })
      .catch(() => {});
  }, [matchId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (status !== 'finished' || !result) return;
    const outcome = (() => {
      if (result === 'DRAW') return 'draw';
      const winResults = myColor === 'white'
        ? ['WHITE_WINS', 'FORFEIT_BLACK', 'TIMEOUT_BLACK']
        : ['BLACK_WINS', 'FORFEIT_WHITE', 'TIMEOUT_WHITE'];
      return winResults.includes(result) ? 'victory' : 'defeat';
    })();
    if (outcome !== 'draw') play(outcome as 'victory' | 'defeat');
  }, [status, result]);

  useEffect(() => {
    return () => { if (invalidMoveTimerRef.current) clearTimeout(invalidMoveTimerRef.current); };
  }, []);

  useEffect(() => {
    return () => { if (tournamentCountdownRef.current) clearInterval(tournamentCountdownRef.current); };
  }, []);

  const triggerInvalidMove = useCallback(() => {
    setInvalidMove(true);
    if (invalidMoveTimerRef.current) clearTimeout(invalidMoveTimerRef.current);
    invalidMoveTimerRef.current = setTimeout(() => setInvalidMove(false), 600);
  }, []);

  const applyMove = useCallback((from: string, to: string, promotion: string) => {
    try {
      const move = game.move({ from, to, promotion } as any);
      if (!move) { triggerInvalidMove(); return false; }

      const socket = getGameSocket();
      setInCheck(game.inCheck());
      clearSelection();
      // Server is authoritative: it validates the move, updates the clock, and
      // decides game-over. We only send the intended move; the board is
      // reconciled from the `move_broadcast` / `move_rejected` events.
      socket.emit('move', { matchId, from, to, promotion });

      // Optimistic local highlight only — the server confirms the result.
      if (game.isCheckmate()) computeCheckmateHighlights(game);
      return true;
    } catch {
      triggerInvalidMove();
      return false;
    }
  }, [game, matchId, currentTurn, triggerInvalidMove, clearSelection]);

  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (myColor !== currentTurn || status !== 'playing') {
      triggerInvalidMove();
      return false;
    }

    if (needsPromotion(game, sourceSquare, targetSquare)) {
      const legal = (game.moves({ verbose: true } as any) as any[]).some(
        (m: any) => m.from === sourceSquare && m.to === targetSquare,
      );
      if (!legal) { triggerInvalidMove(); return false; }
      setPromotionChoice('q');
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      clearSelection();
      return false;
    }

    return applyMove(sourceSquare, targetSquare, 'q');
  }, [myColor, currentTurn, status, game, applyMove, triggerInvalidMove, clearSelection]);

  const confirmPromotion = useCallback(() => {
    if (!pendingPromotion) return;
    setPendingPromotion(null);
    applyMove(pendingPromotion.from, pendingPromotion.to, promotionChoice);
  }, [pendingPromotion, promotionChoice, applyMove]);

  const onSquareClick = useCallback((square: string) => {
    if (myColor !== currentTurn || status !== 'playing' || pendingPromotion) return;

    const myColorCode = myColor === 'white' ? 'w' : 'b';

    // Clicking a highlighted target — execute the move
    if (selectedSquare && optionSquares[square]) {
      onDrop(selectedSquare, square);
      return;
    }

    // Select own piece and show legal moves
    const piece = game.get(square as any);
    if (!piece || piece.color !== myColorCode) { clearSelection(); return; }

    const moves = (game.moves({ square: square as any, verbose: true } as any) as any[]);
    if (moves.length === 0) { clearSelection(); return; }

    const styles: Record<string, React.CSSProperties> = {
      [square]: { backgroundColor: 'rgba(80, 200, 100, 0.45)' },
    };
    moves.forEach((m: any) => {
      const isCapture = m.flags.includes('c') || m.flags.includes('e');
      styles[m.to] = isCapture
        ? { backgroundColor: 'rgba(255, 210, 80, 0.4)' }
        : { backgroundColor: 'rgba(100, 220, 120, 0.3)' };
    });

    setSelectedSquare(square);
    setOptionSquares(styles);
  }, [myColor, currentTurn, status, pendingPromotion, game, selectedSquare, optionSquares, onDrop, clearSelection]);

  const handleForfeit = useCallback(() => {
    setShowForfeitModal(true);
  }, []);

  const confirmForfeit = useCallback(() => {
    setShowForfeitModal(false);
    getGameSocket().emit('forfeit', { matchId });
  }, [matchId]);

  const sendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    getGameSocket().emit('chat_message', { matchId, content: trimmed });
    setChatInput('');
  }, [chatInput, matchId]);

  const opponent = myColor === 'white' ? blackPlayer : whitePlayer;
  const me = myColor === 'white' ? whitePlayer : blackPlayer;
  const isMyTurn = myColor === currentTurn;
  const isChessClock = whiteClock !== null && blackClock !== null;

  const myClockMs = isChessClock
    ? (myColor === 'white' ? whiteClock! : blackClock!)
    : legacyTimerSeconds * 1000;
  const opponentClockMs = isChessClock
    ? (myColor === 'white' ? blackClock! : whiteClock!)
    : 60_000;

  const myClockSec = Math.ceil(myClockMs / 1000);
  const opponentClockSec = Math.ceil(opponentClockMs / 1000);
  const myMaxSec = isChessClock ? Math.ceil(myClockMs / 1000) + 1 : 60;
  const oppMaxSec = isChessClock ? Math.ceil(opponentClockMs / 1000) + 1 : 60;

  const clockColor = (secs: number, active: boolean) =>
    active && secs <= 30 ? (secs <= 10 ? 'var(--color-danger)' : '#F5A623') : 'var(--color-primary)';

  const getMyOutcome = (): 'win' | 'loss' | 'draw' => {
    if (!result || !myColor) return 'loss';
    if (result === 'DRAW') return 'draw';
    const iWin = myColor === 'white'
      ? ['WHITE_WINS', 'FORFEIT_BLACK', 'TIMEOUT_BLACK']
      : ['BLACK_WINS', 'FORFEIT_WHITE', 'TIMEOUT_WHITE'];
    return iWin.includes(result) ? 'win' : 'loss';
  };

  const myOutcome = getMyOutcome();

  const boardBorderColor = invalidMove
    ? 'var(--color-danger)'
    : inCheck && isMyTurn
    ? '#F5A623'
    : 'var(--color-border)';

  // Promotion piece symbol based on player color
  const promoSymbol = (piece: typeof PROMOTION_PIECES[number]) =>
    myColor === 'black' ? piece.symbolB : piece.symbolW;

  const boardSection = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {status === 'playing' && (
        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%', maxWidth: boardWidth,
            padding: '6px 10px', textAlign: 'center',
            background: 'transparent', border: 'none',
            color: 'var(--color-text-muted)', fontSize: 12,
            textDecoration: 'underline', cursor: 'pointer',
          }}
        >
          ↻ Clique aqui caso o jogo não inicie ou algo esteja errado com a partida
        </button>
      )}
      <PlayerBar
        player={opponent as Player}
        isActive={!isMyTurn}
        timerSeconds={!isMyTurn ? opponentClockSec : oppMaxSec}
        timerColor={clockColor(opponentClockSec, !isMyTurn)}
        timerPct={!isMyTurn ? (opponentClockSec / oppMaxSec) * 100 : 100}
        boardWidth={boardWidth}
        inCheck={inCheck && !isMyTurn}
      />

      {inCheck && isMyTurn && status === 'playing' && (
        <div style={{
          width: '100%', maxWidth: boardWidth,
          padding: '8px 14px',
          background: 'rgba(245, 166, 35, 0.15)',
          border: '1px solid #F5A623',
          borderRadius: 'var(--radius-sm)',
          color: '#F5A623',
          fontWeight: 600, fontSize: 13, textAlign: 'center',
          animation: 'pulse 1s infinite',
        }}>
          ⚠ Você está em xeque!
        </div>
      )}

      <div style={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: invalidMove
          ? '0 0 0 3px var(--color-danger), var(--shadow-card)'
          : inCheck && isMyTurn
          ? '0 0 0 3px #F5A623, var(--shadow-card)'
          : 'var(--shadow-glow), var(--shadow-card)',
        border: `2px solid ${boardBorderColor}`,
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
      }}>
        <Chessboard
          id="main-board"
          position={fen}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          boardOrientation={myColor === 'black' ? 'black' : 'white'}
          boardWidth={boardWidth}
          customBoardStyle={{ borderRadius: 0 }}
          customDarkSquareStyle={{ backgroundColor: '#373855' }}
          customLightSquareStyle={{ backgroundColor: '#1E1D2E' }}
          customDropSquareStyle={{ boxShadow: 'inset 0 0 0 3px var(--color-primary)' }}
          customSquareStyles={{ ...optionSquares, ...checkmateSquares }}
          arePiecesDraggable={isMyTurn && status === 'playing'}
          onPromotionCheck={() => false}
        />
      </div>

      <PlayerBar
        player={me as Player}
        isActive={isMyTurn}
        timerSeconds={isMyTurn ? myClockSec : myMaxSec}
        timerColor={clockColor(myClockSec, isMyTurn)}
        timerPct={isMyTurn ? (myClockSec / myMaxSec) * 100 : 100}
        boardWidth={boardWidth}
        inCheck={inCheck && isMyTurn}
      />

      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: boardWidth }}>
        <Button
          variant="danger" size="sm"
          onClick={handleForfeit}
          disabled={status !== 'playing'}
          style={{ flex: 1 }}
        >
          ⚑ Desistir
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={toggleMute}
          title={muted ? 'Ativar sons' : 'Silenciar sons'}
          style={{ minWidth: 40 }}
        >
          {muted ? '🔇' : '🔊'}
        </Button>
        {isMobile && (
          <Button
            variant="ghost" size="sm"
            onClick={() => setChatOpen(o => !o)}
            style={{ flex: 1 }}
          >
            {chatOpen ? 'Fechar chat' : `💬 Chat${chatMessages.length > 0 ? ` (${chatMessages.length})` : ''}`}
          </Button>
        )}
      </div>
    </div>
  );

  const chatSection = (
    <Card style={{
      display: 'flex', flexDirection: 'column',
      width: isMobile ? '100%' : 280,
      flex: isMobile ? undefined : 1,
      minHeight: 0,
      overflow: 'hidden',
      padding: 16,
    }}>
      <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, flexShrink: 0 }}>Chat da partida</h3>
      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: isMobile ? 80 : 0,
        maxHeight: isMobile ? 200 : undefined,
      }}>
        {chatMessages.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            Sem mensagens ainda
          </p>
        )}
        {chatMessages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', gap: 8, alignItems: 'flex-start',
            flexDirection: msg.sender.nickname === user?.nickname ? 'row-reverse' : 'row',
          }}>
            <Avatar src={msg.sender.avatarUrl} name={msg.sender.nickname} size={24} />
            <div style={{
              maxWidth: '75%', padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: msg.sender.nickname === user?.nickname
                ? 'var(--color-primary-dim)'
                : 'var(--color-surface-2)',
              fontSize: 13,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendChat} style={{ display: 'flex', gap: 8, marginTop: 10, flexShrink: 0 }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Mensagem..."
          maxLength={200}
          style={{
            flex: 1, background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text)', padding: '8px 12px', fontSize: 13,
          }}
        />
        <Button type="submit" size="sm">→</Button>
      </form>
    </Card>
  );

  const resultCard = status === 'finished' && result && (
    <Card style={{
      textAlign: 'center', padding: 20,
      background: myOutcome === 'win'
        ? 'rgba(76, 175, 80, 0.1)'
        : myOutcome === 'loss'
        ? 'rgba(177, 86, 83, 0.1)'
        : 'var(--color-surface-2)',
      border: `1px solid ${
        myOutcome === 'win' ? 'var(--color-success)'
        : myOutcome === 'loss' ? 'var(--color-danger)'
        : 'var(--color-border)'
      }`,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>
        {myOutcome === 'win' ? '🏆' : myOutcome === 'draw' ? '🤝' : '😞'}
      </div>
      <div style={{
        fontWeight: 700, fontSize: 20,
        color: myOutcome === 'win'
          ? 'var(--color-success)'
          : myOutcome === 'loss' ? 'var(--color-danger)'
          : 'var(--color-text)',
      }}>
        {myOutcome === 'win' ? 'Vitória!' : myOutcome === 'draw' ? 'Empate' : 'Derrota'}
      </div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>
        {REASON_LABELS[resultReason ?? ''] ?? resultReason}
      </div>
      {/* Review prompt — only for non-draw online games */}
      {myOutcome !== 'draw' && matchId && !reviewDone && (() => {
        const opponent = myColor === 'white' ? blackPlayer : whitePlayer;
        if (!opponent) return null;
        const submitReview = async () => {
          if (reviewRating === 0) return;
          setReviewSubmitting(true);
          try {
            await api.post('/reviews', {
              matchId,
              reviewedId: opponent.id,
              rating: reviewRating,
              comment: reviewComment.trim() || undefined,
            });
            setReviewDone(true);
          } catch {
            // silent — window may have passed
            setReviewDone(true);
          } finally {
            setReviewSubmitting(false);
          }
        };
        return (
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Avaliar @{opponent.nickname}
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setReviewRating(n)}
                  style={{
                    fontSize: 24, background: 'none', border: 'none', cursor: 'pointer',
                    color: n <= reviewRating ? '#FFD700' : 'var(--color-text-muted)',
                    transition: 'color 0.15s',
                  }}
                >★</button>
              ))}
            </div>
            <textarea
              placeholder="Comentário opcional..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={2}
              style={{
                width: '100%', resize: 'vertical', boxSizing: 'border-box',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
                padding: '6px 10px', fontSize: 13, marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="sm" variant="ghost" fullWidth onClick={() => setReviewDone(true)}>Pular</Button>
              <Button size="sm" fullWidth disabled={reviewRating === 0 || reviewSubmitting} onClick={submitReview}>
                {reviewSubmitting ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </div>
        );
      })()}
      {reviewDone && myOutcome !== 'draw' && (
        <p style={{ fontSize: 12, color: 'var(--color-success, #4CAF50)', marginTop: 10, textAlign: 'center' }}>
          ✓ Avaliação registrada
        </p>
      )}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tournamentRedirect && (
          <Button fullWidth onClick={() => {
            reset();
            navigate(tournamentRedirect.isDuel ? '/history' : `/tournaments/${tournamentRedirect.tournamentId}`);
          }}>
            {tournamentRedirect.isDuel ? 'Ver histórico' : 'Ir para o chaveamento'}
          </Button>
        )}
        <Button fullWidth variant={tournamentRedirect ? 'ghost' : 'primary'} onClick={() => { reset(); navigate('/lobby'); }}>
          Voltar ao lobby
        </Button>
      </div>
    </Card>
  );

  return (
    <>
      {status === 'finished' && result && <GameOverlay outcome={myOutcome} />}

      {/* Promotion modal */}
      {pendingPromotion && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '28px 32px',
            maxWidth: 380, width: '90%', textAlign: 'center',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>♟ Promover peão</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 4 }}>
              Escolha a peça para promoção
            </div>
            {/* Timer */}
            <div style={{
              fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              color: myClockSec <= 10 ? 'var(--color-danger)' : myClockSec <= 30 ? '#F5A623' : 'var(--color-primary)',
              marginBottom: 20,
            }}>
              {String(Math.floor(myClockSec / 60)).padStart(2, '0')}:{String(myClockSec % 60).padStart(2, '0')}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              {PROMOTION_PIECES.map(p => (
                <button
                  key={p.piece}
                  onClick={() => setPromotionChoice(p.piece)}
                  style={{
                    width: 68, height: 68,
                    border: `2px solid ${promotionChoice === p.piece ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: promotionChoice === p.piece ? 'rgba(61,74,235,0.15)' : 'var(--color-surface-2)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4,
                    transition: 'all 150ms ease',
                  }}
                >
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{promoSymbol(p)}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{p.label}</span>
                </button>
              ))}
            </div>
            <Button fullWidth onClick={confirmPromotion}>Confirmar promoção</Button>
          </div>
        </div>
      )}

      {showForfeitModal && (
        <ForfeitModal onConfirm={confirmForfeit} onCancel={() => setShowForfeitModal(false)} />
      )}

      {isMobile ? (
        <div style={{
          padding: '16px 16px 32px',
          display: 'flex', flexDirection: 'column', gap: 14,
          width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box',
        }}>
          {boardSection}
          {resultCard}
          {chatOpen && chatSection}
        </div>
      ) : (
        <div style={{
          height: 'calc(100vh - var(--navbar-height))',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', gap: 24,
        }}>
          {boardSection}
          <div style={{
            width: 280, flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 12,
            height: '100%', overflow: 'hidden',
          }}>
            {resultCard}
            {chatSection}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Player bar ───────────────────────────────────────────────────────────────

const PlayerBar = React.memo(function PlayerBar({ player, isActive, timerSeconds, timerColor, timerPct, boardWidth, inCheck }: {
  player: Player | null | undefined;
  isActive: boolean;
  timerSeconds: number;
  timerColor: string;
  timerPct: number;
  boardWidth: number;
  inCheck?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', maxWidth: boardWidth,
      padding: '10px 16px',
      background: isActive ? 'var(--color-surface)' : 'var(--color-surface-3)',
      borderRadius: 'var(--radius-sm)',
      border: `1.5px solid ${
        inCheck ? '#F5A623'
        : isActive ? 'var(--color-primary)'
        : 'var(--color-border)'
      }`,
      transition: 'all var(--transition)',
    }}>
      <Avatar src={player?.avatarUrl} name={player?.nickname || '?'} size={36} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          {player?.nickname || '...'}
          {inCheck && (
            <span style={{ fontSize: 11, color: '#F5A623', fontWeight: 700, letterSpacing: '0.02em' }}>
              XEQUE
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>ELO {player?.rating}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontWeight: 700, fontSize: 20,
          color: isActive ? timerColor : 'var(--color-text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
        </div>
        <div style={{ width: 56, height: 3, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
          <div style={{ width: `${timerPct}%`, height: '100%', background: timerColor, transition: 'width 1s linear, background var(--transition)' }} />
        </div>
      </div>
    </div>
  );
});
