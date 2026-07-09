import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useBreakpoint } from '../hooks/useBreakpoint';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'CLOSED';
type SenderType = 'USER' | 'ADMIN';

interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  fileSizeKb: number;
}

interface Message {
  id: string;
  senderType: SenderType;
  content: string;
  createdAt: string;
  attachments: Attachment[];
}

interface Ticket {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: string;
  createdAt: string;
  messages: Message[];
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_USER: 'Aguardando você',
  CLOSED: 'Fechado',
};

const STATUS_VARIANT: Record<TicketStatus, 'success' | 'warning' | 'muted' | 'danger'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'success',
  WAITING_USER: 'danger',
  CLOSED: 'muted',
};

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
const MAX_SIZE_MB = 10;

function isSafeFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_TYPES.includes(file.type) && ALLOWED_EXTENSIONS.includes(ext);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function AttachmentChip({ attachment, ticketId, messageId }: {
  attachment: Attachment; ticketId: string; messageId: string;
}) {
  const isImage = attachment.mimeType.startsWith('image/');
  const icon = isImage ? '🖼' : '📄';
  const href = `/api/v1/support/tickets/${ticketId}/attachments/${attachment.id}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)',
        fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none',
        transition: 'background var(--transition)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
    >
      {icon} {attachment.originalName}
      <span style={{ opacity: 0.5 }}>({attachment.fileSizeKb}kb)</span>
    </a>
  );
}

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingMessageIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    if (!ticketId) return;
    api.get<Ticket>(`/support/tickets/${ticketId}`)
      .then(t => { setTicket(t); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (ticket) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages.length]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !ticketId) return;
    setSending(true);
    setSendError('');
    try {
      await api.post(`/support/tickets/${ticketId}/messages`, { content: reply.trim() });
      setReply('');
      load();
    } catch (err: any) {
      setSendError(err.message ?? 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (messageId: string, file: File) => {
    if (!isSafeFile(file)) {
      alert('Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou PDF.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Arquivo muito grande. Limite: ${MAX_SIZE_MB}MB.`);
      return;
    }
    setUploadingFor(messageId);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.upload(`/support/tickets/${ticketId}/messages/${messageId}/attachments`, form);
      load();
    } catch (err: any) {
      alert(err.message ?? 'Erro no upload');
    } finally {
      setUploadingFor(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--color-text-muted)' }}>
        Carregando...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Ticket não encontrado.</p>
        <Button onClick={() => navigate('/support')}>Voltar ao suporte</Button>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const lastUserMessage = [...ticket.messages].reverse().find(m => m.senderType === 'USER');

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 24px' }}>
      {/* Header */}
      <button
        onClick={() => navigate('/support')}
        style={{
          background: 'transparent', color: 'var(--color-text-muted)',
          fontSize: 13, marginBottom: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        ← Voltar
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, marginBottom: 6 }}>
            {ticket.title}
          </h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Aberto em {formatDate(ticket.createdAt)}
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
      </div>

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {ticket.messages.map(msg => {
          const isAdmin = msg.senderType === 'ADMIN';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: isAdmin ? 'flex-start' : 'flex-end',
              }}
            >
              <div style={{
                maxWidth: '85%', padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: isAdmin ? 'var(--color-surface-2)' : 'var(--color-primary)',
                border: isAdmin ? '1px solid var(--color-border)' : 'none',
              }}>
                <div style={{ fontSize: 11, color: isAdmin ? 'var(--color-text-muted)' : 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  {isAdmin ? '🎧 Suporte' : 'Você'} · {formatDate(msg.createdAt)}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
                {msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {msg.attachments.map(att => (
                      <AttachmentChip key={att.id} attachment={att} ticketId={ticket.id} messageId={msg.id} />
                    ))}
                  </div>
                )}
              </div>
              {/* Upload attachment to last user message */}
              {!isAdmin && msg.id === lastUserMessage?.id && !isClosed && (
                <button
                  onClick={() => {
                    if (fileRef.current) {
                      pendingMessageIdRef.current = msg.id;
                      fileRef.current.click();
                    }
                  }}
                  style={{
                    marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)',
                    background: 'transparent', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {uploadingFor === msg.id ? 'Enviando...' : '📎 Anexar arquivo'}
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply form */}
      {isClosed ? (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            Este ticket está encerrado.
          </p>
          <Button style={{ marginTop: 12 }} onClick={() => navigate('/support')}>
            Abrir novo ticket
          </Button>
        </Card>
      ) : (
        <form onSubmit={sendReply} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Escreva sua resposta..."
            rows={4}
            maxLength={5000}
            style={{
              width: '100%', padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', fontSize: 14, resize: 'vertical',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          {sendError && (
            <div style={{ fontSize: 13, color: 'var(--color-danger)' }}>{sendError}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" disabled={sending || !reply.trim()}>
              {sending ? 'Enviando...' : 'Responder'}
            </Button>
          </div>
        </form>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          const msgId = pendingMessageIdRef.current;
          pendingMessageIdRef.current = null;
          if (file && msgId) handleFileUpload(msgId, file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
