import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useGameStore } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';
import { getGameSocket } from '../lib/socket';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';

export function GamePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuthStore();
  const {
    myColor, fen, currentTurn, timerSeconds, status, result, resultReason,
    whitePlayer, blackPlayer, chatMessages,
    setFen, setTimer, setResult, addChatMessage, reset,
  } = useGameStore();
  const navigate = useNavigate();
  const [chatInput, setChatInput] = useState('');
  const [game] = useState(() => new Chess());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getGameSocket();
    socket.emit('join_game', { matchId });

    socket.on('game_state', (data: any) => {
      game.load(data.match.fen);
    });

    socket.on('move_broadcast', (data: any) => {
      game.load(data.fen);
      setFen(data.fen, data.pgn, data.moves, data.turn);
    });

    socket.on('timer_update', (data: any) => setTimer(data.seconds));

    socket.on('game_over', (data: any) => setResult(data.result, data.reason));

    socket.on('chat_message', (msg: any) => addChatMessage(msg));

    return () => {
      socket.off('game_state');
      socket.off('move_broadcast');
      socket.off('timer_update');
      socket.off('game_over');
      socket.off('chat_message');
    };
  }, [matchId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const onDrop = (sourceSquare: string, targetSquare: string, piece: string) => {
    if (myColor !== currentTurn) return false;
    if (status !== 'playing') return false;

    try {
      const move = game.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (!move) return false;

      const socket = getGameSocket();
      const newFen = game.fen();
      const newPgn = game.pgn();

      socket.emit('move', { matchId, from: sourceSquare, to: targetSquare, fen: newFen, pgn: newPgn, moves: [] });

      if (game.isGameOver()) {
        let res = 'DRAW';
        if (game.isCheckmate()) res = currentTurn === 'white' ? 'BLACK_WINS' : 'WHITE_WINS';
        socket.emit('game_over_client', { matchId, result: res });
      }

      return true;
    } catch { return false; }
  };

  const handleForfeit = () => {
    const socket = getGameSocket();
    socket.emit('forfeit', { matchId });
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const socket = getGameSocket();
    socket.emit('chat_message', { matchId, content: chatInput.trim() });
    setChatInput('');
  };

  const opponent = myColor === 'white' ? blackPlayer : whitePlayer;
  const me = myColor === 'white' ? whitePlayer : blackPlayer;
  const isMyTurn = myColor === currentTurn;
  const timerPct = (timerSeconds / 60) * 100;
  const timerColor = timerSeconds <= 15 ? 'var(--color-danger)' : timerSeconds <= 30 ? '#F5A623' : 'var(--color-primary)';

  const getMyOutcome = (): 'win' | 'loss' | 'draw' => {
    if (!result || !myColor) return 'loss';
    if (result === 'DRAW') return 'draw';
    const iWin = myColor === 'white'
      ? ['WHITE_WINS', 'FORFEIT_BLACK', 'TIMEOUT_BLACK']
      : ['BLACK_WINS', 'FORFEIT_WHITE', 'TIMEOUT_WHITE'];
    return iWin.includes(result) ? 'win' : 'loss';
  };

  const reasonLabel: Record<string, string> = {
    checkmate: 'Xeque-mate',
    forfeit: 'Desistência',
    timeout: 'Tempo esgotado',
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      gap: 24,
    }}>
      {/* Board column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        {/* Opponent info */}
        <PlayerBar player={opponent} isActive={!isMyTurn} timerSeconds={!isMyTurn ? timerSeconds : 60} timerColor={timerColor} timerPct={!isMyTurn ? timerPct : 100} />

        {/* Board */}
        <div style={{
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-glow), var(--shadow-card)',
          border: '2px solid var(--color-border)',
        }}>
          <Chessboard
            id="main-board"
            position={fen}
            onPieceDrop={onDrop}
            boardOrientation={myColor === 'black' ? 'black' : 'white'}
            boardWidth={Math.min(480, window.innerWidth - 400)}
            customBoardStyle={{ borderRadius: 0 }}
            customDarkSquareStyle={{ backgroundColor: '#373855' }}
            customLightSquareStyle={{ backgroundColor: '#1E1D2E' }}
            customDropSquareStyle={{ boxShadow: 'inset 0 0 0 3px var(--color-primary)' }}
            arePiecesDraggable={isMyTurn && status === 'playing'}
          />
        </div>

        {/* My info */}
        <PlayerBar player={me} isActive={isMyTurn} timerSeconds={isMyTurn ? timerSeconds : 60} timerColor={timerColor} timerPct={isMyTurn ? timerPct : 100} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="danger" size="sm" onClick={handleForfeit} disabled={status !== 'playing'}>
            ⚑ Desistir
          </Button>
        </div>
      </div>

      {/* Chat & info column */}
      <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'stretch' }}>
        {/* Status / Result */}
        {status === 'finished' && result && (
          <Card style={{ textAlign: 'center', padding: 20, background: 'var(--color-surface-2)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>
              {getMyOutcome() === 'win' ? '🏆' : getMyOutcome() === 'draw' ? '🤝' : '😞'}
            </div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {getMyOutcome() === 'win' ? 'Vitória!' : getMyOutcome() === 'draw' ? 'Empate' : 'Derrota'}
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 4 }}>
              {reasonLabel[resultReason ?? ''] ?? resultReason}
            </div>
            <Button fullWidth style={{ marginTop: 16 }} onClick={() => { reset(); navigate('/lobby'); }}>
              Voltar ao lobby
            </Button>
          </Card>
        )}

        {/* Chat */}
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, minHeight: 0 }}>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Chat da partida</h3>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, maxHeight: 340 }}>
            {chatMessages.length === 0 && (
              <p style={{ color: 'var(--color-text-dim)', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
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
                  background: msg.sender.nickname === user?.nickname ? 'var(--color-primary-dim)' : 'var(--color-surface-2)',
                  fontSize: 13,
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendChat} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Mensagem..."
              maxLength={200}
              style={{
                flex: 1, background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text)', padding: '8px 12px', fontSize: 13,
              }}
            />
            <Button type="submit" size="sm">→</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function PlayerBar({ player, isActive, timerSeconds, timerColor, timerPct }: {
  player: any; isActive: boolean; timerSeconds: number; timerColor: string; timerPct: number;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', padding: '10px 16px',
      background: isActive ? 'var(--color-surface)' : 'var(--color-surface-3)',
      borderRadius: 'var(--radius-sm)',
      border: `1.5px solid ${isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
      transition: 'all var(--transition)',
    }}>
      <Avatar src={player?.avatarUrl} name={player?.nickname || '?'} size={36} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{player?.nickname || '...'}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>ELO {player?.rating}</div>
      </div>
      {/* Timer */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 20, color: isActive ? timerColor : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}
        </div>
        <div style={{ width: 60, height: 3, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', marginTop: 3 }}>
          <div style={{ width: `${timerPct}%`, height: '100%', background: timerColor, transition: 'width 1s linear, background var(--transition)' }} />
        </div>
      </div>
    </div>
  );
}
