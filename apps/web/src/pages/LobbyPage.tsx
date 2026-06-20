import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useGameStore } from '../store/game.store';
import { getGameSocket } from '../lib/socket';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';

export function LobbyPage() {
  const { user } = useAuthStore();
  const { setMatch, setStatus } = useGameStore();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>('/friends').then(setFriends).catch(() => {});
    api.get<any[]>('/notifications').then(setNotifications).catch(() => {});

    const socket = getGameSocket();
    socket.emit('join_social');

    socket.on('match_found', (data: any) => {
      setMatch(data.matchId, data.color, data.match.whitePlayer, data.match.blackPlayer);
      navigate(`/game/${data.matchId}`);
    });

    socket.on('challenge_received', (data: any) => {
      setNotifications(prev => [...prev, { type: 'GAME_CHALLENGE', payload: data, id: Date.now() }]);
    });

    return () => {
      socket.off('match_found');
      socket.off('challenge_received');
    };
  }, []);

  const handleSearch = async () => {
    if (searching) {
      await api.delete('/matchmaking/queue');
      setSearching(false);
    } else {
      setSearching(true);
      await api.post('/matchmaking/queue');
    }
  };

  const acceptChallenge = async (challengerId: string) => {
    await api.post('/matchmaking/challenge/accept', { challengerId });
  };

  const challenges = notifications.filter(n => n.type === 'GAME_CHALLENGE');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Main - Matchmaking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Welcome */}
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Bom jogo, <span style={{ color: 'var(--color-primary)' }}>{user?.nickname}</span>!
            </h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 6 }}>
              Pronto para uma partida? ELO atual: <strong style={{ color: '#fff' }}>{user?.rating}</strong>
            </p>
          </div>

          {/* Find match */}
          <Card glow={searching} style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>♚</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
              {searching ? 'Buscando oponente...' : 'Encontrar Partida'}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 28, fontSize: 14 }}>
              {searching
                ? 'Aguarde enquanto encontramos um adversário de nível similar'
                : 'Será pareado com jogadores de ELO próximo ao seu'}
            </p>
            <Button
              onClick={handleSearch}
              variant={searching ? 'danger' : 'primary'}
              size="lg"
              style={{ minWidth: 200 }}
            >
              {searching ? (
                <>
                  <PulseIcon /> Cancelar busca
                </>
              ) : 'Jogar agora'}
            </Button>
          </Card>

          {/* Challenges */}
          {challenges.length > 0 && (
            <Card>
              <h3 style={{ fontWeight: 600, marginBottom: 16 }}>Desafios recebidos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {challenges.map((c: any) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <span style={{ fontSize: 14 }}>
                      Desafio de <strong>{c.payload?.challengerId}</strong>{' '}
                      <Badge variant="muted">ELO {c.payload?.challengerRating}</Badge>
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" onClick={() => acceptChallenge(c.payload.challengerId)}>Aceitar</Button>
                      <Button size="sm" variant="ghost">Recusar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar - Friends */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <h3 style={{ fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Amigos
              <Badge variant="muted">{friends.filter((f: any) => f.isOnline).length} online</Badge>
            </h3>
            {friends.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
                Nenhum amigo ainda
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {friends.slice(0, 12).map((f: any) => (
                  <FriendRow key={f.id} friend={f} onChallenge={() =>
                    api.post('/matchmaking/challenge', { challengedId: f.id })
                  } />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function FriendRow({ friend, onChallenge }: { friend: any; onChallenge: () => void }) {
  const [hover, setHover] = useState(false);
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
      {hover && friend.isOnline && (
        <Button size="sm" onClick={onChallenge} style={{ fontSize: 11, padding: '4px 8px' }}>
          Desafiar
        </Button>
      )}
    </div>
  );
}

function PulseIcon() {
  return (
    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </span>
  );
}
