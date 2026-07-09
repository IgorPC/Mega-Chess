import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Button } from './Button';
import { Badge } from './Badge';

type ReportStatus = 'ANALYZING' | 'COMPLETED' | 'UNDER_REVIEW' | 'RESOLVED';
type ReportVerdict = 'CLEAN' | 'SUSPICIOUS' | 'CHEATING';

interface Report {
  id: string;
  status: ReportStatus;
  aiVerdict: ReportVerdict | null;
  aiConfidence: string | null;
  aiExplanation: string | null;
  createdAt: string;
}

interface Props {
  matchId: string;
  opponentNickname: string;
  finishedAt: string;
  onClose: () => void;
}

const VERDICT_VARIANT: Record<ReportVerdict, 'success' | 'warning' | 'danger'> = {
  CLEAN: 'success',
  SUSPICIOUS: 'warning',
  CHEATING: 'danger',
};

const MAX_AGE_HOURS = 72;

export function ReportMatchModal({ matchId, opponentNickname, finishedAt, onClose }: Props) {
  const { t } = useTranslation('common');
  const [phase, setPhase] = useState<'loading' | 'form' | 'existing' | 'done' | 'expired'>('loading');
  const [existing, setExisting] = useState<Report | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [appealNote, setAppealNote] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealDone, setAppealDone] = useState(false);

  const ageHours = (Date.now() - new Date(finishedAt).getTime()) / (1000 * 60 * 60);

  useEffect(() => {
    if (ageHours > MAX_AGE_HOURS) { setPhase('expired'); return; }
    api.get<Report>(`/matches/${matchId}/report`)
      .then(r => { setExisting(r); setPhase('existing'); })
      .catch(err => {
        // 404 = not yet reported
        if (err.message?.includes('não encontrada')) setPhase('form');
        else setPhase('form');
      });
  }, [matchId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const r = await api.post<{ reportId: string; status: string }>(
        `/matches/${matchId}/report`,
        note.trim() ? { note: note.trim() } : {},
      );
      setExisting({ id: r.reportId, status: 'ANALYZING', aiVerdict: null, aiConfidence: null, aiExplanation: null, createdAt: new Date().toISOString() });
      setPhase('done');
    } catch (err: any) {
      setError(err.message ?? t('report_modal.generic_error'));
      setSubmitting(false);
    }
  };

  const submitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealNote.trim()) return;
    setAppealSubmitting(true);
    try {
      await api.post(`/matches/${matchId}/report/appeal`, { note: appealNote.trim() });
      setAppealDone(true);
    } catch (err: any) {
      setError(err.message ?? t('report_modal.appeal_error'));
    } finally {
      setAppealSubmitting(false);
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
        padding: 28, width: '100%', maxWidth: 460,
        border: '1px solid var(--color-border)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{t('report_modal.title')}</h2>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--color-text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          {t('report_modal.opponent')} <strong style={{ color: 'var(--color-text)' }}>@{opponentNickname}</strong>
        </div>

        {/* ── Loading ── */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
            {t('report_modal.checking')}
          </div>
        )}

        {/* ── Expired ── */}
        {phase === 'expired' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏱</div>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              {t('report_modal.expired_message', { hours: MAX_AGE_HOURS })}
            </p>
            <Button style={{ marginTop: 16 }} onClick={onClose}>{t('report_modal.close')}</Button>
          </div>
        )}

        {/* ── Form ── */}
        {phase === 'form' && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
              {t('report_modal.form_description')}
            </p>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                {t('report_modal.note_label')}
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={t('report_modal.note_placeholder')}
                maxLength={1000}
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text)', fontSize: 13, resize: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            {error && (
              <div style={{ fontSize: 13, color: 'var(--color-danger)', padding: '8px 12px', background: 'rgba(177,86,83,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>{t('report_modal.cancel')}</Button>
              <Button type="submit" disabled={submitting}>{submitting ? t('report_modal.sending') : t('report_modal.report')}</Button>
            </div>
          </form>
        )}

        {/* ── Submitted (just sent) ── */}
        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>{t('report_modal.report_sent_title')}</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              {t('report_modal.report_sent_description')}
            </p>
            <Button style={{ marginTop: 20 }} onClick={onClose}>{t('report_modal.close')}</Button>
          </div>
        )}

        {/* ── Existing report ── */}
        {phase === 'existing' && existing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{t('report_modal.analysis_status')}</span>
                {existing.status === 'ANALYZING' ? (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t('report_modal.analyzing')}</span>
                ) : existing.aiVerdict ? (
                  <Badge variant={VERDICT_VARIANT[existing.aiVerdict]}>
                    {t(`report_modal.verdict.${existing.aiVerdict}`)}
                  </Badge>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t('report_modal.under_review')}</span>
                )}
              </div>

              {existing.aiExplanation && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
                  {existing.aiExplanation}
                </p>
              )}

              {existing.aiConfidence && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  {t('report_modal.confidence', { percent: Math.round(parseFloat(existing.aiConfidence) * 100) })}
                </div>
              )}
            </div>

            {/* Appeal — only when verdict is CLEAN and within 48h */}
            {existing.aiVerdict === 'CLEAN' && existing.status === 'COMPLETED' && !appealDone && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  {t('report_modal.appeal_prompt')}
                </p>
                <form onSubmit={submitAppeal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea
                    value={appealNote}
                    onChange={e => setAppealNote(e.target.value)}
                    placeholder={t('report_modal.appeal_placeholder')}
                    maxLength={2000}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                      color: 'var(--color-text)', fontSize: 13, resize: 'none', boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                  {error && <div style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</div>}
                  <Button type="submit" variant="ghost" disabled={appealSubmitting || !appealNote.trim()}>
                    {appealSubmitting ? t('report_modal.sending') : t('report_modal.appeal_submit')}
                  </Button>
                </form>
              </div>
            )}

            {appealDone && (
              <div style={{
                padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(76,175,80,0.1)', border: '1px solid var(--color-success)',
                fontSize: 13, color: 'var(--color-success)',
              }}>
                {t('report_modal.appeal_sent')}
              </div>
            )}

            <Button variant="ghost" onClick={onClose}>{t('report_modal.close')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
