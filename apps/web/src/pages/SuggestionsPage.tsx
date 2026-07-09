import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
  title: z.string().min(10, 'validation:suggestion_title_min').max(100, 'validation:suggestion_title_max'),
  description: z.string().min(30, 'validation:suggestion_description_min').max(1000, 'validation:suggestion_description_max'),
});
type SuggestionForm = z.infer<typeof suggestionSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_KEY: Partial<Record<SuggestionStatus, string>> = {
  OPEN: 'status.open',
  COMPLETED: 'status.completed',
  REJECTED: 'status.rejected',
};

const STATUS_VARIANT: Partial<Record<SuggestionStatus, 'success' | 'warning' | 'muted' | 'danger'>> = {
  OPEN: 'warning',
  COMPLETED: 'success',
  REJECTED: 'danger',
};

function timeAgo(dateStr: string, t: TFunction): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('just_now');
  if (mins < 60) return t('minutes_ago', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('hours_ago', { count: hours });
  return t('days_ago', { count: Math.floor(hours / 24) });
}

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateSuggestionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation('suggestions');
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
      setServerError(err.message ?? t('create_modal.generic_error'));
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
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{t('create_modal.title')}</h2>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Input
              label={t('create_modal.title_label', { count: titleValue.length })}
              placeholder={t('create_modal.title_placeholder')}
              maxLength={100}
              error={errors.title?.message ? t(errors.title.message) : undefined}
              {...register('title')}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
              {t('create_modal.description_label', { count: descValue.length })}
            </label>
            <textarea
              placeholder={t('create_modal.description_placeholder')}
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
              <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t(errors.description.message as string)}</span>
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
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>{t('create_modal.cancel')}</Button>
            <Button type="submit" loading={isSubmitting}>{t('create_modal.submit')}</Button>
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
  const { t } = useTranslation('suggestions');
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
            title={isAuthor ? t('card.cannot_vote_own') : !canVote ? t('card.vote_limit_reached') : suggestion.myVote ? t('card.remove_vote') : t('card.vote')}
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
                {STATUS_KEY[suggestion.status] ? t(STATUS_KEY[suggestion.status]!) : suggestion.status}
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
              <strong style={{ color: 'var(--color-primary)' }}>{t('card.team_note')}</strong> {suggestion.adminNote}
            </div>
          )}

          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {t('card.by')} <strong style={{ color: 'var(--color-text)' }}>{suggestion.authorNickname}</strong> · {timeAgo(suggestion.createdAt, t)}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SuggestionsPage() {
  const { t } = useTranslation('suggestions');
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
        ? t('already_voted')
        : t('vote_error');
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
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: 0 }}>{t('title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {t('vote_favorites')} · {t('votes_remaining', { count: votesRemaining })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button id='reload-button' variant="outline" onClick={load} disabled={loading} title={t('refresh')}>
            {loading ? '…' : '↻'}
          </Button>
          <Button onClick={() => setShowCreate(true)}>{t('new_suggestion')}</Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 0 }}>
        {(['OPEN', 'COMPLETED'] as const).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => handleTabChange(tabKey)}
            style={{
              padding: '8px 18px', fontSize: 14, fontWeight: 600,
              color: tab === tabKey ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: tab === tabKey ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -1, transition: 'all var(--transition)',
            }}
          >
            {tabKey === 'OPEN' ? t('tab_open') : t('tab_completed')}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
          {t('loading')}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💡</div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
            {tab === 'OPEN' ? t('no_open') : t('no_completed')}
          </p>
          {tab === 'OPEN' && (
            <Button onClick={() => setShowCreate(true)}>{t('send_suggestion')}</Button>
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
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('previous')}</Button>
              <span style={{ padding: '8px 12px', fontSize: 14, color: 'var(--color-text-muted)' }}>{page} / {data.totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>{t('next')}</Button>
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
