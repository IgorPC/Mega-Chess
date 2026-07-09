import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Avatar, Grid, Tab, Tabs,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Alert, Snackbar,
  Chip, Divider, CircularProgress, FormControlLabel, Checkbox,
} from '@mui/material'
import BlockIcon from '@mui/icons-material/Block'
import LogoutIcon from '@mui/icons-material/Logout'
import MessageIcon from '@mui/icons-material/Message'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusChip } from '../../components/ui/StatusChip'
import { adminApi } from '../../lib/admin-api'
import { useAdminAuth } from '../../store/admin-auth.store'
import type { Player, WalletTransaction, SupportTicket, UserActivityLog } from '../../types'

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR')
}

function TabPanel({ value, index, children }: { value: number; index: number; children: React.ReactNode }) {
  return value === index ? <Box pt={2}>{children}</Box> : null
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAdminAuth()

  const [player, setPlayer] = useState<(Player & { walletBalance: string }) | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [activity, setActivity] = useState<UserActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)

  // Dialogs
  const [msgOpen, setMsgOpen] = useState(false)
  const [msgTitle, setMsgTitle] = useState('')
  const [msgContent, setMsgContent] = useState('')
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendDuration, setSuspendDuration] = useState('24h')
  const [suspendNotify, setSuspendNotify] = useState(true)
  const [eloOpen, setEloOpen] = useState(false)
  const [newElo, setNewElo] = useState('')
  const [eloReason, setEloReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [snack, setSnack] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, tx, tk, act] = await Promise.all([
        adminApi.users.get(id),
        adminApi.users.transactions(id).then((r) => r.data),
        adminApi.users.tickets(id),
        adminApi.users.activity(id).then((r) => r.data),
      ])
      setPlayer(p)
      setTransactions(tx)
      setTickets(tk)
      setActivity(act)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])

  const sendMessage = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.users.sendMessage(id, msgTitle, msgContent)
      setMsgOpen(false); setMsgTitle(''); setMsgContent('')
      setSnack('Mensagem enviada com sucesso!')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  const suspend = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.users.suspend(id, suspendReason, suspendDuration, suspendNotify)
      setSuspendOpen(false)
      setSnack('Conta suspensa.')
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  const forceLogout = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.users.forceLogout(id)
      setSnack('Logout forçado com sucesso.')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  const adjustElo = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.users.adjustElo(id, parseInt(newElo), eloReason)
      setEloOpen(false)
      setSnack('ELO ajustado.')
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  if (loading) return <Box display="flex" justifyContent="center" pt={6}><CircularProgress /></Box>
  if (!player) return <Alert severity="error">Usuário não encontrado.</Alert>

  const isBanned = player.bannedUntil && new Date(player.bannedUntil) > new Date()

  return (
    <Box>
      <PageHeader
        title={player.nickname}
        crumbs={[{ label: 'Usuários', to: '/users' }, { label: player.nickname }]}
      />

      {/* Header Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Avatar src={player.avatarUrl ?? undefined} sx={{ width: 72, height: 72, fontSize: 28 }}>
                {player.nickname.charAt(0).toUpperCase()}
              </Avatar>
            </Grid>
            <Grid item flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Typography variant="h6">{player.name}</Typography>
                <StatusChip status={isBanned ? (new Date(player.bannedUntil!).getFullYear() > 2100 ? 'BANNED' : 'SUSPENDED') : 'ACTIVE'} />
                {player.isOnline && <Chip label="Online" color="success" size="small" />}
              </Box>
              <Typography color="text.secondary" variant="body2">{player.email}</Typography>
              <Typography color="text.secondary" variant="caption">
                ELO {player.rating} · Cadastro: {fmtDate(player.createdAt)} · Último login: {fmtDate(player.lastLoginAt)}
              </Typography>
            </Grid>
            <Grid item>
              <Typography variant="h5" fontWeight={700} color="primary.main">${player.walletBalance} CC</Typography>
              <Typography variant="caption" color="text.secondary">Saldo atual</Typography>
            </Grid>
            <Grid item>
              <Box display="flex" flexDirection="column" gap={1}>
                {hasRole('SUPORTE') && (
                  <Button size="small" startIcon={<MessageIcon />} variant="outlined" onClick={() => setMsgOpen(true)}>
                    Mensagem
                  </Button>
                )}
                {hasRole('OPERADOR') && (
                  <Button size="small" startIcon={<LogoutIcon />} variant="outlined" color="warning" onClick={forceLogout}>
                    Forçar Logout
                  </Button>
                )}
                {hasRole('OPERADOR') && (
                  <Button size="small" startIcon={<BlockIcon />} variant="outlined" color="error" onClick={() => setSuspendOpen(true)}>
                    {isBanned ? 'Gerenciar Suspensão' : 'Suspender'}
                  </Button>
                )}
                {hasRole('ADMIN') && (
                  <Button size="small" startIcon={<AutoFixHighIcon />} variant="outlined" onClick={() => { setNewElo(String(player.rating)); setEloOpen(true) }}>
                    Ajustar ELO
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
          <Tab label="Dados Gerais" />
          <Tab label="Transações" />
          <Tab label="Suporte" />
          <Tab label="Atividade" />
        </Tabs>

        <CardContent>
          {/* Dados Gerais */}
          <TabPanel value={tab} index={0}>
            <Grid container spacing={2}>
              {[
                { label: 'CPF', value: hasRole('FINANCEIRO') ? player.cpf ?? '—' : '***.***.***-**' },
                { label: 'Chave PIX', value: player.pixKey ?? '—' },
                { label: 'ID Asaas', value: player.asaasCustomerId ?? '—' },
                { label: 'Banido até', value: fmtDate(player.bannedUntil) },
                { label: 'Motivo', value: player.bannedReason ?? '—' },
              ].map(({ label, value }) => (
                <Grid item xs={12} sm={6} md={4} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={500}>{value}</Typography>
                </Grid>
              ))}
            </Grid>
          </TabPanel>

          {/* Transações */}
          <TabPanel value={tab} index={1}>
            <Box display="flex" flexDirection="column" gap={1}>
              {transactions.length === 0 ? (
                <Typography color="text.secondary">Nenhuma transação.</Typography>
              ) : transactions.map((tx) => (
                <Box key={tx.id} display="flex" alignItems="center" gap={2} py={1} borderBottom="1px solid" borderColor="divider">
                  <Typography variant="caption" color="text.secondary" width={140}>{fmtDate(tx.createdAt)}</Typography>
                  <Chip label={tx.type} size="small" variant="outlined" />
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color={Number(tx.amount) >= 0 ? 'success.main' : 'error.main'}
                    sx={{ flex: 1 }}
                  >
                    {Number(tx.amount) >= 0 ? '+' : ''}{tx.amount} CC
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Saldo: {tx.balanceAfter}</Typography>
                </Box>
              ))}
            </Box>
          </TabPanel>

          {/* Suporte */}
          <TabPanel value={tab} index={2}>
            <Box display="flex" flexDirection="column" gap={1}>
              {tickets.length === 0 ? (
                <Typography color="text.secondary">Nenhum ticket.</Typography>
              ) : tickets.map((tk) => (
                <Box
                  key={tk.id}
                  p={1.5}
                  border="1px solid"
                  borderColor="divider"
                  borderRadius={1}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => navigate(`/support/${tk.id}`)}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight={600} flex={1}>{tk.title}</Typography>
                    <StatusChip status={tk.status} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">{fmtDate(tk.createdAt)}</Typography>
                </Box>
              ))}
            </Box>
          </TabPanel>

          {/* Atividade */}
          <TabPanel value={tab} index={3}>
            <Box display="flex" flexDirection="column" gap={0.5}>
              {activity.length === 0 ? (
                <Typography color="text.secondary">Nenhuma atividade registrada.</Typography>
              ) : activity.map((log) => (
                <Box key={log.id} display="flex" gap={2} py={0.75} borderBottom="1px solid" borderColor="divider">
                  <Typography variant="caption" color="text.secondary" width={150} flexShrink={0}>{fmtDate(log.createdAt)}</Typography>
                  <Chip label={log.action} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                  {log.ipAddress && <Typography variant="caption" color="text.secondary">IP: {log.ipAddress}</Typography>}
                </Box>
              ))}
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Dialog — Mensagem */}
      <Dialog open={msgOpen} onClose={() => setMsgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Enviar mensagem interna</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Título" fullWidth value={msgTitle} onChange={(e) => setMsgTitle(e.target.value)} />
          <TextField label="Mensagem" fullWidth multiline rows={4} value={msgContent} onChange={(e) => setMsgContent(e.target.value)} inputProps={{ maxLength: 500 }} helperText={`${msgContent.length}/500`} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMsgOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={sendMessage} disabled={!msgTitle || !msgContent || actionLoading}>
            {actionLoading ? <CircularProgress size={16} /> : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog — Suspensão */}
      <Dialog open={suspendOpen} onClose={() => setSuspendOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Suspender conta</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Motivo (obrigatório)" fullWidth multiline rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
          <FormControl fullWidth>
            <InputLabel>Duração</InputLabel>
            <Select value={suspendDuration} label="Duração" onChange={(e) => setSuspendDuration(e.target.value)}>
              <MenuItem value="1h">1 hora</MenuItem>
              <MenuItem value="6h">6 horas</MenuItem>
              <MenuItem value="24h">24 horas</MenuItem>
              <MenuItem value="7d">7 dias</MenuItem>
              <MenuItem value="30d">30 dias</MenuItem>
              {hasRole('ADMIN') && <MenuItem value="permanent">Permanente (Banimento)</MenuItem>}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Checkbox checked={suspendNotify} onChange={(e) => setSuspendNotify(e.target.checked)} />}
            label="Notificar o usuário com explicação"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={suspend} disabled={suspendReason.length < 10 || actionLoading}>
            {actionLoading ? <CircularProgress size={16} /> : 'Confirmar Suspensão'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog — Ajuste ELO */}
      <Dialog open={eloOpen} onClose={() => setEloOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ajustar ELO</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary">ELO atual: <strong>{player.rating}</strong></Typography>
          <TextField label="Novo ELO" type="number" fullWidth value={newElo} onChange={(e) => setNewElo(e.target.value)} inputProps={{ min: 100, max: 3000 }} />
          <TextField label="Motivo (mín. 30 caracteres)" fullWidth multiline rows={3} value={eloReason} onChange={(e) => setEloReason(e.target.value)} helperText={`${eloReason.length}/30 mínimo`} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEloOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={adjustElo} disabled={!newElo || eloReason.length < 30 || actionLoading}>
            {actionLoading ? <CircularProgress size={16} /> : 'Ajustar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
