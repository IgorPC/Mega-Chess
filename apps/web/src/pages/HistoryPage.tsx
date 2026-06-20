import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/auth.store';

export function HistoryPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>({ matches: [], total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/users/me/history?page=${page}&limit=20`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [page]);

  const getResult = (match: any) => {
    const isWhite = match.whitePlayer.id === user?.id || match.whitePlayerId === user?.id;
    const r = match.result;
    if (!r) return { label: 'Em andamento', variant: 'muted' as const };
    if (r === 'DRAW') return { label: 'Empate', variant: 'muted' as const };
    if ((isWhite && r === 'WHITE_WINS') || (!isWhite && r === 'BLACK_WINS')) return { label: 'Vitória', variant: 'success' as const };
    return { label: 'Derrota', variant: 'danger' as const };
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Histórico de Partidas</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 28 }}>{data.total} partidas jogadas</p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>Carregando...</div>
      ) : data.matches.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>♟</div>
          <p style={{ color: 'var(--color-text-muted)' }}>Nenhuma partida jogada ainda</p>
          <Link to="/lobby" style={{ display: 'inline-block', marginTop: 16 }}>
            <Button>Jogar agora</Button>
          </Link>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {data.matches.map((match: any, i: number) => {
              const result = getResult(match);
              const isWhite = match.whitePlayer?.nickname === user?.nickname;
              const opponent = isWhite ? match.blackPlayer : match.whitePlayer;
              const date = match.finishedAt ? new Date(match.finishedAt).toLocaleDateString('pt-BR') : '—';

              return (
                <div key={match.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  borderBottom: i < data.matches.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}>
                  <Badge variant={result.variant}>{result.label}</Badge>
                  <div style={{ fontSize: 18 }}>{isWhite ? '♔' : '♚'}</div>
                  <Avatar src={opponent?.avatarUrl} name={opponent?.nickname} size={34} />
                  <div style={{ flex: 1 }}>
                    <Link to={`/profile/${opponent?.nickname}`} style={{ fontWeight: 600, fontSize: 14 }}>
                      {opponent?.nickname}
                    </Link>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {date} · {isWhite ? 'Brancas' : 'Pretas'}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'right' }}>
                    <div>{opponent?.rating} ELO</div>
                  </div>
                </div>
              );
            })}
          </Card>

          {data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</Button>
              <span style={{ padding: '8px 16px', fontSize: 14, color: 'var(--color-text-muted)' }}>
                {page} / {data.totalPages}
              </span>
              <Button size="sm" variant="ghost" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
