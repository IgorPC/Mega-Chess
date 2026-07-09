import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useBreakpoint } from '../hooks/useBreakpoint';

// ── Types ─────────────────────────────────────────────────────────────────────

type SuggestionStatus = 'OPEN' | 'HIDDEN' | 'COMPLETED' | 'REJECTED';

interface Suggestion {
  id: string;
  title: string;
  description: string;
  status: SuggestionStatus;
  authorId: string;
  authorNickname: string;
  voteCount: number;
  adminNote: string | null;
  myVote: boolean;
  createdAt: string;
}

interface PaginatedSuggestions {
  items: Suggestion[];
  total: number;
  page: number;
  totalPages: number;
  votesRemaining: number;
}

// ── Zod schema ─────────────────────────────────────────────────────────────────

const suggestionSchema = z.object({
  title: z.string().min(10, 'Mínimo 10 caracteres').max(100, 'Máximo 100 caracteres'),
  description: z.string().min(30, 'Mínimo 30 caracteres').max(1000, 'Máximo 1000 caracteres'),
});
type SuggestionForm = z.infer<typeof suggestionSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Partial<Record<SuggestionStatus, string>> = {
  OPEN: 'Aberta',
  COMPLETED: 'Concluída',
  REJECTED: 'Rejeitada',
};

const STATUS_VARIANT: Partial<Record<SuggestionStatus, 'success' | 'warning' | 'muted' | 'danger'>> = {
  OPEN: 'warning',
  COMPLETED: 'success',
  REJECTED: 'danger',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  return `${Math.floor(hours / 24)}d atrás`;
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateSuggestionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<SuggestionForm>({
    resolver: zodResolver(suggestionSchema),
  });
  const descValue = watch('description') ?? '';
  const titleValue = watch('title') ?? '';

  const onSubmit = async (data: SuggestionForm) => {
    setServerError('');
    try {
      await api.post('/suggestions', { title: data.title.trim(), description: data.description.trim() });
      onCreated();
    } catch (err: any) {
      setServerError(err.message ?? 'Erro ao criar sugestão');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
          padding: 28, width: '100%', maxWidth: 520,
          border: '1px solid var(--color-border)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Nova sugestão de melhoria</h2>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Input
              label={`Título (${titleValue.length}/100)`}
              placeholder="Resumo da sua sugestão"
              maxLength={100}
              error={errors.title?.message}
              {...register('title')}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
              Descrição ({descValue.length}/1000)
            </label>
            <textarea
              placeholder="Descreva sua sugestão com detalhes..."
              maxLength={1000}
              rows={6}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface-2)',
                border: `1px solid ${errors.description ? 'var(--color-danger)' : 'var(--color-border)'}`,
                color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              {...register('description')}
            />
            {errors.description && (
              <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.description.message}</span>
            )}
          </div>

          {serverError && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(177,86,83,0.1)', border: '1px solid var(--color-danger)',
              fontSize: 13, color: 'var(--color-danger)',
            }}>
              {serverError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Enviar sugestão</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Suggestion card ───────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  currentUserId,
  votesRemaining,
  onVoteToggle,
  isVoting,
  feedback,
}: {
  suggestion: Suggestion;
  currentUserId: string;
  votesRemaining: number;
  onVoteToggle: (id: string, hasVote: boolean) => void;
  isVoting: boolean;
  feedback?: string;
}) {
  const isAuthor = suggestion.authorId === currentUserId;
  const canVote = !isAuthor && (suggestion.myVote || votesRemaining > 0) && suggestion.status === 'OPEN' && !isVoting;

  return (
    <Card style={{ padding: '16px 20px', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Vote button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => onVoteToggle(suggestion.id, suggestion.myVote)}
            disabled={!canVote}
            style={{
              width: 40, height: 40, borderRadius: 'var(--radius-sm)',
              background: suggestion.myVote ? 'var(--color-primary)' : 'var(--color-surface-2)',
              border: `1px solid ${suggestion.myVote ? 'var(--color-primary)' : 'var(--color-border)'}`,
              color: suggestion.myVote ? '#fff' : 'var(--color-text-muted)',
              cursor: canVote ? 'pointer' : 'not-allowed',
              opacity: canVote ? 1 : 0.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, transition: 'all var(--transition)',
            }}
            title={isAuthor ? 'Não é possível votar na própria sugestão' : !canVote ? 'Limite de votos atingido' : suggestion.myVote ? 'Remover voto' : 'Votar'}
          >
            ▲
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{suggestion.voteCount}</span>
          {feedback && (
            <span style={{
              fontSize: 10, color: 'var(--color-danger)', textAlign: 'center',
              maxWidth: 70, lineHeight: 1.3,
            }}>
              {feedback}
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, flex: 1 }}>{suggestion.title}</h3>
            {suggestion.status !== 'OPEN' && (
              <Badge variant={STATUS_VARIANT[suggestion.status] ?? 'muted'}>
                {STATUS_LABEL[suggestion.status] ?? suggestion.status}
              </Badge>
            )}
          </div>

          <p style={{
            fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 8px',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {suggestion.description}
          </p>

          {suggestion.adminNote && (
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(61,74,235,0.08)', border: '1px solid rgba(61,74,235,0.2)',
              fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8,
            }}>
              <strong style={{ color: 'var(--color-primary)' }}>Nota da equipe:</strong> {suggestion.adminNote}
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            por <strong style={{ color: 'var(--color-text)' }}>{suggestion.authorNickname}</strong> · {timeAgo(suggestion.createdAt)}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SuggestionsPage() {
  const { user } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const [tab, setTab] = useState<'OPEN' | 'COMPLETED'>('OPEN');
  const [data, setData] = useState<PaginatedSuggestions | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [voteFeedback, setVoteFeedback] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<PaginatedSuggestions>(`/suggestions?page=${page}&limit=20&status=${tab}`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, tab]);

  useEffect(() => { load(); }, [load]);

  const handleTabChange = (newTab: 'OPEN' | 'COMPLETED') => {
    setTab(newTab);
    setPage(1);
  };

  const handleVoteToggle = async (id: string, hasVote: boolean) => {
    if (votingId) return;
    setVotingId(id);
    setVoteFeedback(null);
    try {
      if (hasVote) {
        await api.delete(`/suggestions/${id}/vote`);
      } else {
        await api.post(`/suggestions/${id}/vote`, {});
      }
    } catch (err) {
      // 409 = user already voted on this suggestion (e.g. double-click race, stale UI)
      const message = err instanceof ApiError && err.status === 409
        ? 'Você já votou nesta sugestão.'
        : 'Não foi possível registrar seu voto. Tente novamente.';
      setVoteFeedback({ id, message });
      setTimeout(() => setVoteFeedback(f => (f?.id === id ? null : f)), 4000);
    } finally {
      setVotingId(null);
      load();
    }
  };

  const handleCreated = () => {
    setShowCreate(false);
    setPage(1);
    load();
  };

  const votesRemaining = data?.votesRemaining ?? 10;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: 0 }}>Sugestões de melhoria</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            Vote nas suas favoritas · {votesRemaining} voto{votesRemaining !== 1 ? 's' : ''} restante{votesRemaining !== 1 ? 's' : ''} esta semana
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button id='reload-button' variant="outline" onClick={load} disabled={loading} title="Atualizar lista">
            {loading ? '…' : '↻'}
          </Button>
          <Button onClick={() => setShowCreate(true)}>+ Nova sugestão</Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {(['OPEN', 'COMPLETED'] as const).map(t => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            style={{
              padding: '8px 18px', fontSize: 14, fontWeight: 600,
              color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, transition: 'all var(--transition)',
            }}
          >
            {t === 'OPEN' ? 'Abertas' : 'Concluídas'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
          Carregando...
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💡</div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
            {tab === 'OPEN' ? 'Nenhuma sugestão aberta ainda' : 'Nenhuma sugestão concluída'}
          </p>
          {tab === 'OPEN' && (
            <Button onClick={() => setShowCreate(true)}>Enviar sugestão</Button>
          )}
        </Card>
      ) : (
        <>
          {data.items.map(s => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              currentUserId={user?.id ?? ''}
              votesRemaining={votesRemaining}
              onVoteToggle={handleVoteToggle}
              isVoting={votingId === s.id}
              feedback={voteFeedback?.id === s.id ? voteFeedback.message : undefined}
            />
          ))}

          {data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</Button>
              <span style={{ padding: '8px 12px', fontSize: 14, color: 'var(--color-text-muted)' }}>{page} / {data.totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</Button>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateSuggestionModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
