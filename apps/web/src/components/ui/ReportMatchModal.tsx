import React, { useEffect, useState } from 'react';
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

const VERDICT_LABEL: Record<ReportVerdict, string> = {
  CLEAN: '✓ Limpo',
  SUSPICIOUS: '⚠ Suspeito',
  CHEATING: '🚫 Trapaça detectada',
};

const VERDICT_VARIANT: Record<ReportVerdict, 'success' | 'warning' | 'danger'> = {
  CLEAN: 'success',
  SUSPICIOUS: 'warning',
  CHEATING: 'danger',
};

const MAX_AGE_HOURS = 72;

export function ReportMatchModal({ matchId, opponentNickname, finishedAt, onClose }: Props) {
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
      setError(err.message ?? 'Erro ao enviar denúncia');
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
      setError(err.message ?? 'Erro ao enviar apelação');
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
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Denunciar partida</h2>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--color-text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Oponente: <strong style={{ color: 'var(--color-text)' }}>@{opponentNickname}</strong>
        </div>

        {/* ── Loading ── */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
            Verificando...
          </div>
        )}

        {/* ── Expired ── */}
        {phase === 'expired' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏱</div>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              O prazo de {MAX_AGE_HOURS}h para denúncias desta partida expirou.
            </p>
            <Button style={{ marginTop: 16 }} onClick={onClose}>Fechar</Button>
          </div>
        )}

        {/* ── Form ── */}
        {phase === 'form' && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-muted)' }}>
              A partida será analisada automaticamente. Você receberá uma notificação com o resultado em alguns instantes.
            </p>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>
                Observação (opcional)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Descreva o comportamento suspeito que observou..."
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
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Enviando...' : 'Denunciar'}</Button>
            </div>
          </form>
        )}

        {/* ── Submitted (just sent) ── */}
        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Denúncia enviada!</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              A análise foi iniciada. Você receberá uma notificação com o resultado.
            </p>
            <Button style={{ marginTop: 20 }} onClick={onClose}>Fechar</Button>
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
                <span style={{ fontSize: 13, fontWeight: 600 }}>Status da análise</span>
                {existing.status === 'ANALYZING' ? (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>⏳ Analisando...</span>
                ) : existing.aiVerdict ? (
                  <Badge variant={VERDICT_VARIANT[existing.aiVerdict]}>
                    {VERDICT_LABEL[existing.aiVerdict]}
                  </Badge>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Em revisão manual</span>
                )}
              </div>

              {existing.aiExplanation && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
                  {existing.aiExplanation}
                </p>
              )}

              {existing.aiConfidence && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  Confiança: {Math.round(parseFloat(existing.aiConfidence) * 100)}%
                </div>
              )}
            </div>

            {/* Appeal — only when verdict is CLEAN and within 48h */}
            {existing.aiVerdict === 'CLEAN' && existing.status === 'COMPLETED' && !appealDone && (
              <div>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                  Discorda do resultado? Você pode apelar e um administrador revisará manualmente.
                </p>
                <form onSubmit={submitAppeal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <textarea
                    value={appealNote}
                    onChange={e => setAppealNote(e.target.value)}
                    placeholder="Explique por que acredita que houve trapaça..."
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
                    {appealSubmitting ? 'Enviando...' : 'Apelar para revisão humana'}
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
                ✓ Apelação enviada. Um administrador revisará em breve.
              </div>
            )}

            <Button variant="ghost" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
