import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { supportTicketSchema, type SupportTicketSchema } from '../lib/schemas';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'CLOSED';
type TicketCategory = 'PAYMENT' | 'MATCH' | 'ACCOUNT' | 'TECHNICAL' | 'OTHER';

interface Ticket {
  id: string;
  title: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
}

interface PaginatedTickets {
  items: Ticket[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_KEYS: Record<TicketStatus, string> = {
  OPEN: 'status.open',
  IN_PROGRESS: 'status.in_progress',
  WAITING_USER: 'status.waiting_user',
  CLOSED: 'status.closed',
};

const STATUS_VARIANT: Record<TicketStatus, 'success' | 'warning' | 'muted' | 'danger'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'success',
  WAITING_USER: 'danger',
  CLOSED: 'muted',
};

const CATEGORY_KEYS: Record<TicketCategory, string> = {
  PAYMENT: 'category.payment',
  MATCH: 'category.match',
  ACCOUNT: 'category.account',
  TECHNICAL: 'category.technical',
  OTHER: 'category.other',
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

// ─── Create ticket modal ──────────────────────────────────────────────────────

function CreateTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation('support');
  const [category, setCategory] = useState<TicketCategory>('TECHNICAL');
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<SupportTicketSchema>({
    resolver: zodResolver(supportTicketSchema),
  });

  const descriptionValue = watch('description') ?? '';

  const onSubmit = async (data: SupportTicketSchema) => {
    setServerError('');
    try {
      await api.post('/support/tickets', { category, title: data.title.trim(), description: data.description.trim() });
      onCreated();
    } catch (err: any) {
      setServerError(err.message ?? t('create_modal.generic_error'));
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        padding: 28, width: '100%', maxWidth: 500,
        border: '1px solid var(--color-border)',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{t('create_modal.title')}</h2>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
              {t('create_modal.category_label')}
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as TicketCategory)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontSize: 14,
              }}
            >
              {(Object.keys(CATEGORY_KEYS) as TicketCategory[]).map(k => (
                <option key={k} value={k}>{t(CATEGORY_KEYS[k])}</option>
              ))}
            </select>
          </div>

          <Input
            label={t('create_modal.title_label')}
            placeholder={t('create_modal.title_placeholder')}
            maxLength={100}
            error={errors.title?.message ? t(errors.title.message) : undefined}
            {...register('title')}
          />

          <div>
            <label style={{ fontSize: 13, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
              {t('create_modal.description_label')}
            </label>
            <textarea
              placeholder={t('create_modal.description_placeholder')}
              maxLength={2000}
              rows={5}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface-2)',
                border: `1px solid ${errors.description ? 'var(--color-danger)' : 'var(--color-border)'}`,
                color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              {...register('description')}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {errors.description
                ? <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{t(errors.description.message as string)}</span>
                : <span />}
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{descriptionValue.length}/2000</span>
            </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SupportPage() {
  const { t } = useTranslation('support');
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [data, setData] = useState<PaginatedTickets | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<PaginatedTickets>(`/support/tickets?page=${page}&limit=20`)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = () => {
    setShowCreate(false);
    setPage(1);
    load();
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700 }}>{t('title')}</h1>
        <Button onClick={() => setShowCreate(true)}>{t('new_ticket')}</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
          {t('loading')}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎧</div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 20 }}>
            {t('no_tickets')}
          </p>
          <Button onClick={() => setShowCreate(true)}>{t('open_ticket')}</Button>
        </Card>
      ) : (
        <>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {data.items.map((ticket, i) => (
              <button
                key={ticket.id}
                onClick={() => navigate(`/support/${ticket.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                  padding: isMobile ? '12px 14px' : '14px 20px', background: 'transparent',
                  borderBottom: i < data.items.length - 1 ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer', transition: 'background var(--transition)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ticket.title}</span>
                    {ticket.status === 'WAITING_USER' && (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 99,
                        background: 'rgba(177,86,83,0.2)', color: 'var(--color-danger)',
                        fontWeight: 700, letterSpacing: '0.05em',
                      }}>
                        {t('response_needed')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 3 }}>
                    {t(CATEGORY_KEYS[ticket.category])} · {t('updated_ago', { time: timeAgo(ticket.updatedAt, t) })}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[ticket.status]}>
                  {t(STATUS_KEYS[ticket.status])}
                </Badge>
              </button>
            ))}
          </Card>

          {data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t('previous')}</Button>
              <span style={{ padding: '8px 12px', fontSize: 14, color: 'var(--color-text-muted)' }}>{t('page_of', { page, total: data.totalPages })}</span>
              <Button size="sm" variant="ghost" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>{t('next')}</Button>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
    </div>
  );
}
