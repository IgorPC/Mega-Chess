import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ReportMatchModal } from '../components/ui/ReportMatchModal';
import { useAuthStore } from '../store/auth.store';

const REPORT_WINDOW_HOURS = 72;

interface MatchPlayer {
  id: string;
  nickname: string;
  name: string;
  avatarUrl?: string;
  rating: number;
}

interface Match {
  id: string;
  result?: string;
  finishedAt?: string;
  whitePlayer: MatchPlayer;
  blackPlayer: MatchPlayer | null;
  whitePlayerId?: string;
  isOffline?: boolean;
  aiDifficulty?: string | null;
}

interface HistoryData {
  matches: Match[];
  total: number;
  page: number;
  totalPages: number;
}

interface Stats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  offline: { wins: number; losses: number; draws: number; total: number };
}

const WHITE_WINS_RESULTS = new Set(['WHITE_WINS', 'FORFEIT_BLACK', 'TIMEOUT_BLACK']);
const BLACK_WINS_RESULTS = new Set(['BLACK_WINS', 'FORFEIT_WHITE', 'TIMEOUT_WHITE']);

// Raw shape returned by GET /tournaments/history/me
interface TournamentMatchHistoryItem {
  id: string;
  matchId: string;
  phase: string;
  tournament: {
    id: string;
    type: string;
    status: string;
    entryFeeCc: number;
    name: string | null;
    finishedAt?: string;
  };
  match: {
    id: string;
    result?: string;
    finishedAt?: string;
    whitePlayerId: string;
    whitePlayer: { id: string; nickname: string; rating: number; avatarUrl?: string };
    blackPlayer: { id: string; nickname: string; rating: number; avatarUrl?: string } | null;
  };
}

const DUEL_TYPES = new Set(['DUEL_FLASH', 'DUEL_GIANT']);

function TournamentHistoryTab({ isMobile }: { isMobile: boolean }) {
  const { t, i18n } = useTranslation('history');
  const { user } = useAuthStore();
  const [data, setData] = useState<{ items: TournamentMatchHistoryItem[]; total: number; page: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reportingItem, setReportingItem] = useState<TournamentMatchHistoryItem | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get<typeof data>(`/tournaments/history/me?page=${page}&limit=20`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('loading')}</div>;

  if (!data || data.items.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
        <p style={{ color: 'var(--color-text-muted)' }}>{t('no_duels_yet')}</p>
        <Link to="/tournaments">
          <Button style={{ marginTop: 16 }}>{t('see_competitions')}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {data.items.map((item, i) => {
          const { tournament, match } = item;
          const isDuel = DUEL_TYPES.has(tournament.type);
          const isWhite = match?.whitePlayerId === user?.id;
          const opponent = isWhite ? match?.blackPlayer : match?.whitePlayer;
          const r = match?.result;
          let resultLabel = '—';
          let resultVariant: 'success' | 'danger' | 'muted' = 'muted';
          if (r === 'DRAW') { resultLabel = t('draw'); }
          else if (r) {
            const iWin = isWhite
              ? WHITE_WINS_RESULTS.has(r)
              : BLACK_WINS_RESULTS.has(r);
            resultLabel = iWin ? t('victory') : t('defeat');
            resultVariant = iWin ? 'success' : 'danger';
          }

          const finishedAt = match?.finishedAt ?? tournament.finishedAt;
          const date = finishedAt ? new Date(finishedAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'pt-BR') : '—';
          const canReport = isDuel && match?.result && finishedAt &&
            (Date.now() - new Date(finishedAt).getTime()) / (1000 * 60 * 60) <= REPORT_WINDOW_HOURS;

          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14,
              padding: isMobile ? '12px 14px' : '14px 20px',
              borderBottom: i < data.items.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}>
              <Badge variant={resultVariant}>{isMobile ? resultLabel.slice(0, 3) : resultLabel}</Badge>
              <Avatar src={opponent?.avatarUrl} name={opponent?.nickname ?? '?'} size={isMobile ? 30 : 34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opponent?.nickname ?? '?'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {t(`tournament_type.${tournament.type}`, { defaultValue: tournament.type })}
                  {' · '}{date}
                  {opponent?.rating ? ` · ${opponent.rating} ELO` : ''}
                </div>
              </div>
              {canReport && (
                <button
                  onClick={e => { e.stopPropagation(); setReportingItem(item); }}
                  title={t('report_cheating')}
                  style={{
                    background: 'transparent', color: 'var(--color-text-muted)',
                    fontSize: 13, cursor: 'pointer', padding: '2px 4px',
                    borderRadius: 4, lineHeight: 1, flexShrink: 0,
                    transition: 'color var(--transition)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                >
                  🚩
                </button>
              )}
            </div>
          );
        })}
      </Card>

      {data.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('previous')}</Button>
          <span style={{ padding: '8px 12px', fontSize: 14, color: 'var(--color-text-muted)' }}>{page} / {data.totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>{t('next')}</Button>
        </div>
      )}

      {reportingItem && (
        <ReportMatchModal
          matchId={reportingItem.matchId}
          opponentNickname={
            (reportingItem.match?.whitePlayerId === user?.id
              ? reportingItem.match?.blackPlayer?.nickname
              : reportingItem.match?.whitePlayer?.nickname) ?? '?'
          }
          finishedAt={reportingItem.match?.finishedAt ?? new Date().toISOString()}
          onClose={() => setReportingItem(null)}
        />
      )}
    </>
  );
}

export function HistoryPage() {
  const { t, i18n } = useTranslation('history');
  const { user } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const [activeTab, setActiveTab] = useState<'matches' | 'tournaments'>('matches');
  const [data, setData] = useState<HistoryData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState('');
  const [reportingMatch, setReportingMatch] = useState<Match | null>(null);

  useEffect(() => {
    api.get<Stats>('/users/me/stats').then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    // First load: full spinner. Subsequent pages: keep data visible, dim it.
    if (!data) {
      setLoading(true);
    } else {
      setPaging(true);
    }
    setError('');
    api.get<HistoryData>(`/users/me/history?page=${page}&limit=20`)
      .then(d => { setData(d); setLoading(false); setPaging(false); })
      .catch(() => {
        setError(t('load_error'));
        setLoading(false);
        setPaging(false);
      });
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const getResult = (match: Match) => {
    const isWhite = match.whitePlayerId === user?.id || match.whitePlayer?.id === user?.id;
    const r = match.result;
    if (!r) return { label: t('in_progress'), variant: 'muted' as const };
    if (r === 'DRAW') return { label: t('draw'), variant: 'muted' as const };
    if ((isWhite && WHITE_WINS_RESULTS.has(r)) || (!isWhite && BLACK_WINS_RESULTS.has(r)))
      return { label: t('victory'), variant: 'success' as const };
    return { label: t('defeat'), variant: 'danger' as const };
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, marginBottom: 16 }}>
        {t('title')}
      </h1>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', padding: 4 }}>
        <button
          onClick={() => setActiveTab('matches')}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-sm)',
            fontSize: 13, fontWeight: 500,
            background: activeTab === 'matches' ? 'var(--color-surface-2)' : 'transparent',
            color: activeTab === 'matches' ? 'var(--color-text)' : 'var(--color-text-muted)',
            transition: 'all var(--transition)', cursor: 'pointer',
          }}
        >
          {t('tab_matches')}
        </button>
        <button
          onClick={() => setActiveTab('tournaments')}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-sm)',
            fontSize: 13, fontWeight: 500,
            background: activeTab === 'tournaments' ? 'var(--color-surface-2)' : 'transparent',
            color: activeTab === 'tournaments' ? 'var(--color-text)' : 'var(--color-text-muted)',
            transition: 'all var(--transition)', cursor: 'pointer',
          }}
        >
          {t('tab_tournaments')}
        </button>
      </div>

      {activeTab === 'tournaments' && <TournamentHistoryTab isMobile={isMobile} />}

      {activeTab === 'matches' && stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 8 : 12, marginBottom: 24 }}>
          <StatChip label={t('online')} wins={stats.wins} losses={stats.losses} draws={stats.draws} total={stats.total} color="var(--color-primary)" />
          <StatChip label={t('offline')} wins={stats.offline.wins} losses={stats.offline.losses} draws={stats.offline.draws} total={stats.offline.total} color="var(--color-text-muted)" />
        </div>
      )}

      {activeTab === 'matches' && error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(177,86,83,0.1)', border: '1px solid var(--color-danger)',
          borderRadius: 'var(--radius-sm)', fontSize: 14, color: 'var(--color-danger)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
        }}>
          {error}
          <Button size="sm" variant="ghost" onClick={() => { setError(''); setPage(p => p); }}>
            {t('retry')}
          </Button>
        </div>
      )}

      {activeTab === 'matches' && (loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          {t('loading')}
        </div>
      ) : !data || data.matches.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>♟</div>
          <p style={{ color: 'var(--color-text-muted)' }}>{t('no_matches')}</p>
          <Link to="/lobby" style={{ display: 'inline-block', marginTop: 16 }}>
            <Button>{t('play_now')}</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card style={{ padding: 0, overflow: 'hidden', opacity: paging ? 0.5 : 1, transition: 'opacity 150ms ease' }}>
            {data.matches.map((match, i) => {
              const result = getResult(match);
              const isWhite = match.whitePlayer?.nickname === user?.nickname;
              const opponent = isWhite ? match.blackPlayer : match.whitePlayer;
              const date = match.finishedAt
                ? new Date(match.finishedAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'pt-BR')
                : '—';

              return (
                <div key={match.id} style={{
                  display: 'flex', alignItems: 'center',
                  gap: isMobile ? 10 : 14,
                  padding: isMobile ? '12px 14px' : '14px 20px',
                  borderBottom: i < data.matches.length - 1 ? '1px solid var(--color-border)' : 'none',
                  background: match.isOffline ? 'rgba(139, 140, 167, 0.04)' : undefined,
                }}>
                  <Badge variant={result.variant}>{isMobile ? result.label.slice(0, 3) : result.label}</Badge>
                  <div style={{ fontSize: isMobile ? 14 : 18, flexShrink: 0 }}>
                    {isWhite ? '♔' : '♚'}
                  </div>
                  {match.isOffline ? (
                    <div style={{
                      width: isMobile ? 30 : 34, height: isMobile ? 30 : 34,
                      borderRadius: '50%', background: 'var(--color-surface-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isMobile ? 14 : 16, flexShrink: 0,
                    }}>🤖</div>
                  ) : (
                    <Avatar src={opponent?.avatarUrl} name={opponent?.nickname} size={isMobile ? 30 : 34} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {match.isOffline ? t('computer') : opponent?.nickname}
                      </span>
                      {match.isOffline && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px',
                          borderRadius: 99, background: 'rgba(139,140,167,0.2)',
                          color: 'var(--color-text-muted)', letterSpacing: '0.05em',
                          flexShrink: 0,
                        }}>
                          {t('offline').toUpperCase()}{match.aiDifficulty ? ` · ${t(`difficulty.${match.aiDifficulty}`, { defaultValue: match.aiDifficulty })}` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {date}{!isMobile && !match.isOffline && ` · ${isWhite ? t('white') : t('black')}`}
                    </div>
                  </div>
                  {!match.isOffline && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'right' }}>
                        {opponent?.rating} ELO
                      </div>
                      {match.result && match.finishedAt && (() => {
                        const ageHours = (Date.now() - new Date(match.finishedAt).getTime()) / (1000 * 60 * 60);
                        return ageHours <= REPORT_WINDOW_HOURS ? (
                          <button
                            onClick={e => { e.stopPropagation(); setReportingMatch(match); }}
                            title={t('report_cheating')}
                            style={{
                              background: 'transparent', color: 'var(--color-text-muted)',
                              fontSize: 13, cursor: 'pointer', padding: '2px 4px',
                              borderRadius: 4, lineHeight: 1,
                              transition: 'color var(--transition)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
                          >
                            🚩
                          </button>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          {data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
              <Button size="sm" variant="ghost" disabled={page === 1 || paging} onClick={() => setPage(p => p - 1)}>
                {isMobile ? '←' : t('previous')}
              </Button>
              <span style={{ padding: '8px 12px', fontSize: 14, color: 'var(--color-text-muted)' }}>
                {page} / {data.totalPages}
              </span>
              <Button size="sm" variant="ghost" disabled={page === data.totalPages || paging} onClick={() => setPage(p => p + 1)}>
                {isMobile ? '→' : t('next')}
              </Button>
            </div>
          )}
        </>
      ))}
      {reportingMatch && (() => {
        const isWhite = reportingMatch.whitePlayer?.nickname === user?.nickname;
        const opponent = isWhite ? reportingMatch.blackPlayer : reportingMatch.whitePlayer;
        return (
          <ReportMatchModal
            matchId={reportingMatch.id}
            opponentNickname={opponent?.nickname ?? '?'}
            finishedAt={reportingMatch.finishedAt ?? new Date().toISOString()}
            onClose={() => setReportingMatch(null)}
          />
        );
      })()}
    </div>
  );
}

function StatChip({ label, wins, losses, draws, total, color }: {
  label: string; wins: number; losses: number; draws: number; total: number; color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px',
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)', fontSize: 13,
    }}>
      <span style={{ fontWeight: 600, color, fontSize: 11, letterSpacing: '0.05em' }}>{label.toUpperCase()}</span>
      <span style={{ color: 'var(--color-text-muted)' }}>{total}p</span>
      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{wins}V</span>
      <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{losses}D</span>
      {draws > 0 && <span style={{ color: 'var(--color-text-muted)' }}>{draws}E</span>}
    </div>
  );
}
