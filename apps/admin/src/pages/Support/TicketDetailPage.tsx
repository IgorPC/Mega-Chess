import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box, Card, CardContent, Grid, Typography, Avatar, Chip,
  TextField, Button, Select, MenuItem, FormControl, InputLabel,
  Alert, CircularProgress, Snackbar, Divider, IconButton, Tooltip,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import LockIcon from '@mui/icons-material/Lock'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusChip } from '../../components/ui/StatusChip'
import { adminApi } from '../../lib/admin-api'
import { useAdminAuth } from '../../store/admin-auth.store'
import type { SupportTicket, TicketMessage } from '../../types'

function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR') }

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { admin } = useAdminAuth()

  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [snack, setSnack] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [t, m] = await Promise.all([
        adminApi.support.get(id),
        adminApi.support.messages(id),
      ])
      setTicket(t)
      setMessages(m)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendReply = async () => {
    if (!id || !reply.trim()) return
    setSending(true)
    try {
      await adminApi.support.reply(id, reply, isInternal)
      setReply('')
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setSending(false) }
  }

  const updateStatus = async (status: string) => {
    if (!id) return
    try {
      await adminApi.support.updateStatus(id, status)
      setSnack('Status atualizado.')
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
  }

  const assignSelf = async () => {
    if (!id || !admin) return
    try {
      await adminApi.support.assign(id, admin.id)
      setSnack('Ticket atribuído a você.')
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
  }

  const getAiSummary = async () => {
    if (!id) return
    setAiLoading(true)
    try {
      const res = await adminApi.support.aiSummary(id)
      setAiSummary(res.summary)
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro ao gerar resumo') }
    finally { setAiLoading(false) }
  }

  if (loading) return <Box display="flex" justifyContent="center" pt={6}><CircularProgress /></Box>
  if (!ticket) return <Alert severity="error">Ticket não encontrado.</Alert>

  return (
    <Box>
      <PageHeader
        title={`Ticket #${id?.slice(-8)}`}
        crumbs={[{ label: 'Suporte', to: '/support' }, { label: ticket.title }]}
      />

      <Grid container spacing={2}>
        {/* Chat col */}
        <Grid item xs={12} md={8}>
          <Card sx={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
            <CardContent sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {messages.map((msg) => {
                const isAdmin = msg.senderRole !== 'USER'
                const isNote = msg.isInternal
                return (
                  <Box
                    key={msg.id}
                    display="flex"
                    flexDirection={isAdmin ? 'row-reverse' : 'row'}
                    gap={1}
                    alignItems="flex-start"
                  >
                    <Avatar sx={{ width: 30, height: 30, fontSize: 12, bgcolor: isAdmin ? 'primary.main' : 'action.selected' }}>
                      {msg.senderName.charAt(0)}
                    </Avatar>
                    <Box maxWidth="75%">
                      <Box
                        sx={{
                          px: 1.5, py: 1,
                          borderRadius: 2,
                          bgcolor: isNote ? 'warning.dark' : isAdmin ? 'primary.dark' : 'action.hover',
                          opacity: isNote ? 0.9 : 1,
                          border: isNote ? '1px dashed' : 'none',
                          borderColor: 'warning.main',
                        }}
                      >
                        {isNote && (
                          <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                            <LockIcon sx={{ fontSize: 12 }} />
                            <Typography variant="caption" fontWeight={600}>Nota interna</Typography>
                          </Box>
                        )}
                        <Typography variant="body2" whiteSpace="pre-wrap">{msg.content}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.25} textAlign={isAdmin ? 'right' : 'left'}>
                        {msg.senderName} · {fmtDate(msg.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
              <div ref={bottomRef} />
            </CardContent>

            <Divider />
            <Box p={2} display="flex" flexDirection="column" gap={1.5}>
              <Box display="flex" alignItems="center" gap={1}>
                <Button
                  size="small"
                  variant={isInternal ? 'contained' : 'outlined'}
                  color="warning"
                  startIcon={<LockIcon />}
                  onClick={() => setIsInternal((v) => !v)}
                >
                  {isInternal ? 'Nota interna' : 'Resposta pública'}
                </Button>
              </Box>
              <Box display="flex" gap={1}>
                <TextField
                  multiline
                  rows={3}
                  fullWidth
                  placeholder={isInternal ? 'Nota interna (só visível para a equipe)...' : 'Resposta ao usuário...'}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.ctrlKey && e.key === 'Enter') { void sendReply() } }}
                />
                <Box display="flex" flexDirection="column" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={sendReply}
                    disabled={!reply.trim() || sending || ticket.status === 'CLOSED'}
                    startIcon={sending ? <CircularProgress size={14} /> : <SendIcon />}
                    sx={{ height: 40 }}
                  >
                    Enviar
                  </Button>
                </Box>
              </Box>
            </Box>
          </Card>
        </Grid>

        {/* Control panel col */}
        <Grid item xs={12} md={4}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" mb={1.5}>Detalhes do Ticket</Typography>
                <Box display="flex" flexDirection="column" gap={1}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <StatusChip status={ticket.status} />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Categoria</Typography>
                    <Chip label={ticket.category} size="small" variant="outlined" />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Usuário</Typography>
                    <Typography variant="body2">{ticket.userNickname}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Atendente</Typography>
                    <Typography variant="body2">{ticket.assignedToName ?? '—'}</Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Criado em</Typography>
                    <Typography variant="caption">{fmtDate(ticket.createdAt)}</Typography>
                  </Box>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>Alterar status</InputLabel>
                  <Select
                    value={ticket.status}
                    label="Alterar status"
                    onChange={(e) => updateStatus(e.target.value)}
                    disabled={ticket.status === 'CLOSED'}
                  >
                    <MenuItem value="OPEN">Aberto</MenuItem>
                    <MenuItem value="IN_PROGRESS">Em andamento</MenuItem>
                    <MenuItem value="WAITING_USER">Aguardando usuário</MenuItem>
                    <MenuItem value="CLOSED">Fechado</MenuItem>
                  </Select>
                </FormControl>

                {!ticket.assignedToId && (
                  <Button variant="outlined" fullWidth size="small" onClick={assignSelf}>
                    Atribuir a mim
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* AI Summary */}
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SmartToyIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2">Resumo IA</Typography>
                  </Box>
                  <Button size="small" onClick={getAiSummary} disabled={aiLoading}>
                    {aiLoading ? <CircularProgress size={14} /> : 'Gerar'}
                  </Button>
                </Box>
                {aiSummary ? (
                  <Typography variant="body2" color="text.secondary" whiteSpace="pre-wrap">{aiSummary}</Typography>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    Clique em "Gerar" para obter um resumo do ticket via DeepSeek AI.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
