import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { api } from '../lib/api';
import { getBestMove, type AIDifficulty } from '../lib/chessAI';
import { useSound } from '../hooks/useSound';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
};

const DIFFICULTY_COLORS: Record<AIDifficulty, string> = {
  easy: '#4CAF50',
  medium: '#F5A623',
  hard: 'var(--color-danger)',
};

const AI_THINK_MS: Record<AIDifficulty, number> = {
  easy: 2000,
  medium: 2200,
  hard: 2500,
};

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Xeque-mate',
  stalemate: 'Afogamento',
  threefold: 'Repetição tripla',
  insufficient: 'Material insuficiente',
  fifty_moves: 'Regra dos 50 lances',
  forfeit: 'Desistência',
  draw: 'Empate',
};

const PROMOTION_PIECES = [
  { piece: 'q', label: 'Rainha', symbol: '♕' },
  { piece: 'r', label: 'Torre',  symbol: '♖' },
  { piece: 'b', label: 'Bispo',  symbol: '♗' },
  { piece: 'n', label: 'Cavalo', symbol: '♘' },
];

type GameStatus = 'playing' | 'finished';

interface GameResult {
  outcome: 'win' | 'loss' | 'draw';
  reason: string;
  matchResult: string;
}

function needsPromotion(game: Chess, from: string, to: string): boolean {
  const piece = game.get(from as any);
  if (!piece || piece.type !== 'p') return false;
  return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
}

export function OfflineGamePage() {
  const [searchParams] = useSearchParams();
  const VALID_DIFFICULTIES: AIDifficulty[] = ['easy', 'medium', 'hard'];
  const rawDiff = searchParams.get('difficulty') ?? 'medium';
  const difficulty: AIDifficulty = VALID_DIFFICULTIES.includes(rawDiff as AIDifficulty)
    ? (rawDiff as AIDifficulty)
    : 'medium';
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { isMobile, isTablet, width } = useBreakpoint();

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [status, setStatus] = useState<GameStatus>('playing');
  const [result, setResult] = useState<GameResult | null>(null);
  const [inCheck, setInCheck] = useState(false);
  const [invalidMove, setInvalidMove] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [moveCount, setMoveCount] = useState(0);

  // Move highlights
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});

  // Promotion
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [promotionChoice, setPromotionChoice] = useState('q');

  const { play, muted, toggleMute } = useSound();
  const invalidMoveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false);

  const safeWidth = typeof window !== 'undefined' ? window.innerWidth : width;
  const boardWidth = isMobile
    ? Math.max(260, Math.min(safeWidth - 32, 460))
    : isTablet
    ? Math.min(400, width - 380)
    : Math.min(480, width - 380);

  const triggerInvalidMove = useCallback(() => {
    setInvalidMove(true);
    if (invalidMoveTimer.current) clearTimeout(invalidMoveTimer.current);
    invalidMoveTimer.current = setTimeout(() => setInvalidMove(false), 600);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setOptionSquares({});
  }, []);

  const resolveResult = useCallback((game: Chess, forfeited = false): GameResult => {
    if (forfeited) return { outcome: 'loss', reason: 'forfeit', matchResult: 'BLACK_WINS' };
    if (game.isCheckmate()) {
      const loser = game.turn();
      return loser === 'w'
        ? { outcome: 'loss', reason: 'checkmate', matchResult: 'BLACK_WINS' }
        : { outcome: 'win', reason: 'checkmate', matchResult: 'WHITE_WINS' };
    }
    if (game.isStalemate()) return { outcome: 'draw', reason: 'stalemate', matchResult: 'DRAW' };
    if (game.isThreefoldRepetition()) return { outcome: 'draw', reason: 'threefold', matchResult: 'DRAW' };
    if (game.isInsufficientMaterial()) return { outcome: 'draw', reason: 'insufficient', matchResult: 'DRAW' };
    if (game.isDraw()) return { outcome: 'draw', reason: 'fifty_moves', matchResult: 'DRAW' };
    return { outcome: 'draw', reason: 'draw', matchResult: 'DRAW' };
  }, []);

  const saveMatch = useCallback(async (r: GameResult) => {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      await api.post('/matches/offline', {
        result: r.matchResult,
        difficulty,
        pgn: gameRef.current.pgn(),
        moves: gameRef.current.history(),
      });
    } catch {
      setSaveFailed(true);
    }
  }, [difficulty]);

  const finishGame = useCallback((r: GameResult) => {
    setResult(r);
    setStatus('finished');
    clearSelection();
    saveMatch(r);
    if (r.outcome === 'win') play('victory');
    else if (r.outcome === 'loss') play('defeat');
  }, [saveMatch, clearSelection, play]);

  const triggerAiMove = useCallback(() => {
    const game = gameRef.current;
    if (game.isGameOver() || game.turn() !== 'b') return;

    setAiThinking(true);
    const thinkTime = AI_THINK_MS[difficulty];

    setTimeout(() => {
      const move = getBestMove(game.fen(), difficulty);
      if (!move) {
        setAiThinking(false);
        if (game.isGameOver()) finishGame(resolveResult(game));
        return;
      }
      try {
        const m = game.move(move);
        setFen(game.fen());
        setInCheck(game.inCheck());
        setMoveCount(game.history().length);
        setAiThinking(false);
        const isCapture = m?.captured != null;
        play(isCapture ? 'capture' : 'move');
        if (game.inCheck()) play('check');
        if (game.isGameOver()) finishGame(resolveResult(game));
      } catch {
        setAiThinking(false);
      }
    }, thinkTime);
  }, [difficulty, finishGame, resolveResult, play]);

  const applyMove = useCallback((from: string, to: string, promotion: string) => {
    const game = gameRef.current;
    try {
      const move = game.move({ from, to, promotion } as any);
      if (!move) { triggerInvalidMove(); return false; }

      setFen(game.fen());
      setInCheck(game.inCheck());
      setMoveCount(game.history().length);
      clearSelection();

      const isCapture = move.captured != null;
      play(isCapture ? 'capture' : 'move');
      if (game.inCheck()) play('check');

      if (game.isGameOver()) {
        finishGame(resolveResult(game));
        return true;
      }
      triggerAiMove();
      return true;
    } catch {
      triggerInvalidMove();
      return false;
    }
  }, [triggerInvalidMove, clearSelection, finishGame, resolveResult, triggerAiMove, play]);

  const onDrop = useCallback((from: string, to: string) => {
    const game = gameRef.current;
    if (status !== 'playing' || game.turn() !== 'w' || aiThinking) {
      triggerInvalidMove();
      return false;
    }

    if (needsPromotion(game, from, to)) {
      const legal = (game.moves({ verbose: true } as any) as any[]).some(
        (m: any) => m.from === from && m.to === to,
      );
      if (!legal) { triggerInvalidMove(); return false; }
      setPromotionChoice('q');
      setPendingPromotion({ from, to });
      clearSelection();
      return false;
    }

    return applyMove(from, to, 'q');
  }, [status, aiThinking, triggerInvalidMove, applyMove, clearSelection]);

  const confirmPromotion = useCallback(() => {
    if (!pendingPromotion) return;
    setPendingPromotion(null);
    applyMove(pendingPromotion.from, pendingPromotion.to, promotionChoice);
  }, [pendingPromotion, promotionChoice, applyMove]);

  const onSquareClick = useCallback((square: string) => {
    if (status !== 'playing' || gameRef.current.turn() !== 'w' || aiThinking || pendingPromotion) return;

    // Clicking a highlighted target — execute the move
    if (selectedSquare && optionSquares[square]) {
      onDrop(selectedSquare, square);
      return;
    }

    // Select own piece and show legal moves
    const piece = gameRef.current.get(square as any);
    if (!piece || piece.color !== 'w') { clearSelection(); return; }

    const moves = (gameRef.current.moves({ square: square as any, verbose: true } as any) as any[]);
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
  }, [status, aiThinking, pendingPromotion, selectedSquare, optionSquares, onDrop, clearSelection]);

  const confirmForfeit = useCallback(() => {
    setShowForfeitModal(false);
    finishGame(resolveResult(gameRef.current, true));
  }, [finishGame, resolveResult]);

  const restart = useCallback(() => {
    gameRef.current = new Chess();
    savedRef.current = false;
    setFen(gameRef.current.fen());
    setStatus('playing');
    setResult(null);
    setInCheck(false);
    setInvalidMove(false);
    setAiThinking(false);
    setSaveFailed(false);
    setMoveCount(0);
    clearSelection();
    setPendingPromotion(null);
  }, [clearSelection]);

  useEffect(() => {
    play('gameStart');
    return () => { if (invalidMoveTimer.current) clearTimeout(invalidMoveTimer.current); };
  }, []);

  const isMyTurn = status === 'playing' && gameRef.current.turn() === 'w' && !aiThinking;
  const boardBorderColor = invalidMove
    ? 'var(--color-danger)'
    : inCheck && isMyTurn ? '#F5A623' : 'var(--color-border)';
  const diffColor = DIFFICULTY_COLORS[difficulty];

  const aiBar = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', maxWidth: boardWidth,
      padding: '10px 16px',
      background: !isMyTurn && status === 'playing' ? 'var(--color-surface)' : 'var(--color-surface-3)',
      borderRadius: 'var(--radius-sm)',
      border: `1.5px solid ${!isMyTurn && status === 'playing' ? diffColor : 'var(--color-border)'}`,
      transition: 'all var(--transition)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--color-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0,
      }}>
        🤖
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          Computador
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px',
            borderRadius: 99, background: diffColor + '22',
            color: diffColor, letterSpacing: '0.05em',
          }}>
            {DIFFICULTY_LABELS[difficulty].toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          {aiThinking ? 'Pensando...' : 'Peças pretas'}
        </div>
      </div>
      {aiThinking && (
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%', background: diffColor,
              animation: `pulse 1s ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      )}
    </div>
  );

  const playerBar = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', maxWidth: boardWidth,
      padding: '10px 16px',
      background: isMyTurn ? 'var(--color-surface)' : 'var(--color-surface-3)',
      borderRadius: 'var(--radius-sm)',
      border: `1.5px solid ${
        inCheck && isMyTurn ? '#F5A623'
        : isMyTurn ? 'var(--color-primary)'
        : 'var(--color-border)'
      }`,
      transition: 'all var(--transition)',
    }}>
      <Avatar src={user?.avatarUrl} name={user?.nickname ?? '?'} size={36} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          {user?.nickname}
          {inCheck && isMyTurn && (
            <span style={{ fontSize: 11, color: '#F5A623', fontWeight: 700 }}>XEQUE</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Peças brancas · ELO {user?.rating}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        {isMyTurn ? 'Seu turno' : ''}
      </div>
    </div>
  );

  const boardSection = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {aiBar}

      {inCheck && isMyTurn && status === 'playing' && (
        <div style={{
          width: '100%', maxWidth: boardWidth,
          padding: '8px 14px',
          background: 'rgba(245, 166, 35, 0.15)',
          border: '1px solid #F5A623',
          borderRadius: 'var(--radius-sm)',
          color: '#F5A623', fontWeight: 600, fontSize: 13, textAlign: 'center',
          animation: 'pulse 1s infinite',
        }}>
          ⚠ Você está em xeque!
        </div>
      )}

      <div style={{
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        boxShadow: invalidMove
          ? '0 0 0 3px var(--color-danger), var(--shadow-card)'
          : inCheck && isMyTurn
          ? '0 0 0 3px #F5A623, var(--shadow-card)'
          : 'var(--shadow-glow), var(--shadow-card)',
        border: `2px solid ${boardBorderColor}`,
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
        opacity: aiThinking ? 0.92 : 1,
      }}>
        <Chessboard
          id="offline-board"
          position={fen}
          onPieceDrop={onDrop}
          onSquareClick={onSquareClick}
          boardOrientation="white"
          boardWidth={boardWidth}
          customBoardStyle={{ borderRadius: 0 }}
          customDarkSquareStyle={{ backgroundColor: '#373855' }}
          customLightSquareStyle={{ backgroundColor: '#1E1D2E' }}
          customDropSquareStyle={{ boxShadow: 'inset 0 0 0 3px var(--color-primary)' }}
          customSquareStyles={optionSquares}
          arePiecesDraggable={isMyTurn}
        />
      </div>

      {playerBar}

      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: boardWidth }}>
        <Button
          variant="danger" size="sm"
          onClick={() => setShowForfeitModal(true)}
          disabled={status !== 'playing' || aiThinking}
          style={{ flex: 1 }}
        >
          ⚑ Desistir
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={toggleMute}
          style={{ width: 40, padding: 0, flexShrink: 0 }}
          title={muted ? 'Ativar sons' : 'Mutar sons'}
        >
          {muted ? '🔇' : '🔊'}
        </Button>
      </div>
    </div>
  );

  const resultCard = status === 'finished' && result && (
    <Card style={{
      textAlign: 'center', padding: 20,
      background: result.outcome === 'win'
        ? 'rgba(76, 175, 80, 0.1)'
        : result.outcome === 'loss'
        ? 'rgba(177, 86, 83, 0.1)'
        : 'var(--color-surface-2)',
      border: `1px solid ${
        result.outcome === 'win' ? 'var(--color-success)'
        : result.outcome === 'loss' ? 'var(--color-danger)'
        : 'var(--color-border)'
      }`,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>
        {result.outcome === 'win' ? '🏆' : result.outcome === 'draw' ? '🤝' : '😞'}
      </div>
      <div style={{
        fontWeight: 700, fontSize: 20,
        color: result.outcome === 'win'
          ? 'var(--color-success)'
          : result.outcome === 'loss' ? 'var(--color-danger)'
          : 'var(--color-text)',
      }}>
        {result.outcome === 'win' ? 'Vitória!' : result.outcome === 'draw' ? 'Empate' : 'Derrota'}
      </div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>
        {REASON_LABELS[result.reason] ?? result.reason} · vs Computador ({DIFFICULTY_LABELS[difficulty]})
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6 }}>
        ELO não alterado
      </div>
      {saveFailed && (
        <div style={{
          marginTop: 10, padding: '8px 12px', fontSize: 12,
          background: 'rgba(177,86,83,0.1)', border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-sm)', color: 'var(--color-danger)',
        }}>
          ⚠ Não foi possível salvar a partida no histórico.
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Button variant="ghost" fullWidth onClick={restart}>Jogar de novo</Button>
        <Button fullWidth onClick={() => navigate('/lobby')}>Voltar ao lobby</Button>
      </div>
    </Card>
  );

  return (
    <>
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
            maxWidth: 360, width: '90%', textAlign: 'center',
            boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>♟ Promover peão</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 20 }}>
              Escolha a peça para promoção
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              {PROMOTION_PIECES.map(({ piece, label, symbol }) => (
                <button
                  key={piece}
                  onClick={() => setPromotionChoice(piece)}
                  style={{
                    width: 68, height: 68,
                    border: `2px solid ${promotionChoice === piece ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: promotionChoice === piece ? 'var(--color-primary-dim, rgba(61,74,235,0.15))' : 'var(--color-surface-2)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 4,
                    transition: 'all 150ms ease',
                  }}
                >
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{symbol}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{label}</span>
                </button>
              ))}
            </div>
            <Button fullWidth onClick={confirmPromotion}>Confirmar promoção</Button>
          </div>
        </div>
      )}

      {/* Forfeit modal */}
      {showForfeitModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }}>
          <Card style={{ maxWidth: 360, width: '90%', textAlign: 'center', padding: '28px 32px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚑</div>
            <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Desistir da partida?</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              A partida será registrada como derrota no histórico.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" fullWidth onClick={() => setShowForfeitModal(false)}>Cancelar</Button>
              <Button variant="danger" fullWidth onClick={confirmForfeit}>Sim, desistir</Button>
            </div>
          </Card>
        </div>
      )}

      {isMobile ? (
        <div style={{
          padding: '16px 16px 32px',
          display: 'flex', flexDirection: 'column', gap: 14,
          width: '100%', maxWidth: '100vw', overflowX: 'hidden', boxSizing: 'border-box',
        }}>
          {boardSection}
          {resultCard}
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
            {resultCard || (
              <Card style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Partida Offline</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Dificuldade</span>
                    <span style={{ color: diffColor, fontWeight: 600 }}>{DIFFICULTY_LABELS[difficulty]}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>ELO</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>Não afetado</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Lances</span>
                    <span>{Math.floor(moveCount / 2)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
