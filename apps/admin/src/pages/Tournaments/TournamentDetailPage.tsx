import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  Tab, Tabs, Avatar, Alert, CircularProgress, Snackbar,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CancelIcon from '@mui/icons-material/Cancel'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusChip } from '../../components/ui/StatusChip'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { adminApi } from '../../lib/admin-api'
import { useAdminAuth } from '../../store/admin-auth.store'
import type { Tournament } from '../../types'

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString('pt-BR') : '—' }

interface Participant {
  userId: string
  nickname: string
  avatarUrl: string | null
  seed: number
  finalPosition: number | null
  eliminated: boolean
}

interface Match {
  id: string
  round: number
  player1Nickname: string | null
  player2Nickname: string | null
  winnerNickname: string | null
  status: string
}

export function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAdminAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [snack, setSnack] = useState('')
  const [startConfirm, setStartConfirm] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [t, p, m] = await Promise.all([
        adminApi.tournaments.get(id),
        adminApi.tournaments.participants(id),
        adminApi.tournaments.matches(id),
      ])
      setTournament(t)
      setParticipants(p)
      setMatches(m)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])

  const handleStart = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.tournaments.start(id)
      setSnack('Torneio iniciado! Chaveamento gerado.')
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false); setStartConfirm(false) }
  }

  const handleCancel = async () => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.tournaments.cancel(id)
      setSnack('Torneio cancelado. Buy-ins estornados.')
      navigate('/tournaments')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false); setCancelConfirm(false) }
  }

  const handleKick = async (userId: string) => {
    if (!id) return
    try {
      await adminApi.tournaments.removeParticipant(id, userId)
      setSnack('Participante removido.')
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
  }

  if (loading) return <Box display="flex" justifyContent="center" pt={6}><CircularProgress /></Box>
  if (!tournament) return <Alert severity="error">Torneio não encontrado.</Alert>

  const roundGroups = matches.reduce<Record<number, Match[]>>((acc, m) => {
    if (!acc[m.round]) acc[m.round] = []
    acc[m.round].push(m)
    return acc
  }, {})

  return (
    <Box>
      <PageHeader
        title={tournament.name}
        crumbs={[{ label: 'Torneios', to: '/tournaments' }, { label: tournament.name }]}
        action={
          hasRole('OPERADOR') ? (
            <Box display="flex" gap={1}>
              {tournament.status === 'OPEN' && (
                <Button variant="contained" color="success" startIcon={<PlayArrowIcon />} size="small" onClick={() => setStartConfirm(true)}>
                  Iniciar
                </Button>
              )}
              {['OPEN', 'IN_PROGRESS'].includes(tournament.status) && (
                <Button variant="outlined" color="error" startIcon={<CancelIcon />} size="small" onClick={() => setCancelConfirm(true)}>
                  Cancelar
                </Button>
              )}
            </Box>
          ) : undefined
        }
      />

      {/* Summary card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            {[
              { label: 'Status', value: <StatusChip status={tournament.status} /> },
              { label: 'Formato', value: <Chip label={tournament.format} size="small" variant="outlined" /> },
              { label: 'Jogadores', value: `${tournament.registeredCount} / ${tournament.maxPlayers}` },
              { label: 'Buy-in', value: `${tournament.buyIn} CC` },
              { label: 'Premiação', value: `${tournament.prizePool} CC` },
              { label: 'Tempo', value: tournament.timeControl },
              { label: 'Ranqueado', value: tournament.isRated ? 'Sim' : 'Não' },
              { label: 'Início', value: fmtDate(tournament.startAt) },
            ].map(({ label, value }) => (
              <Grid item xs={6} sm={3} key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Box mt={0.5}>{typeof value === 'string' ? <Typography fontWeight={500}>{value}</Typography> : value}</Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
          <Tab label={`Participantes (${participants.length})`} />
          <Tab label="Partidas / Chaveamento" />
        </Tabs>

        <CardContent>
          {tab === 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Seed</TableCell>
                  <TableCell>Jogador</TableCell>
                  <TableCell>Posição final</TableCell>
                  <TableCell>Status</TableCell>
                  {hasRole('OPERADOR') && tournament.status === 'OPEN' && <TableCell />}
                </TableRow>
              </TableHead>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.userId}>
                    <TableCell>#{p.seed}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar src={p.avatarUrl ?? undefined} sx={{ width: 28, height: 28, fontSize: 12 }}>
                          {p.nickname.charAt(0)}
                        </Avatar>
                        {p.nickname}
                      </Box>
                    </TableCell>
                    <TableCell>{p.finalPosition ?? '—'}</TableCell>
                    <TableCell>
                      <Chip label={p.eliminated ? 'Eliminado' : 'Ativo'} size="small" color={p.eliminated ? 'default' : 'success'} />
                    </TableCell>
                    {hasRole('OPERADOR') && tournament.status === 'OPEN' && (
                      <TableCell>
                        <Button size="small" color="error" onClick={() => handleKick(p.userId)}>Remover</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {participants.length === 0 && (
                  <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Nenhum participante.</Typography></TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {tab === 1 && (
            <Box>
              {Object.entries(roundGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([round, rMatches]) => (
                <Box key={round} mb={3}>
                  <Typography variant="subtitle2" color="text.secondary" mb={1}>Rodada {round}</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Brancas</TableCell>
                        <TableCell>Pretas</TableCell>
                        <TableCell>Vencedor</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rMatches.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{m.player1Nickname ?? 'BYE'}</TableCell>
                          <TableCell>{m.player2Nickname ?? 'BYE'}</TableCell>
                          <TableCell>{m.winnerNickname ?? '—'}</TableCell>
                          <TableCell><StatusChip status={m.status} /></TableCell>
                          <TableCell>
                            <Button size="small" onClick={() => navigate(`/tournaments/matches/${m.id}`)}>
                              Ver Jogadas
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ))}
              {matches.length === 0 && (
                <Typography color="text.secondary">Nenhuma partida gerada ainda.</Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={startConfirm}
        title="Iniciar torneio"
        description="O chaveamento será gerado com base nos participantes inscritos. Esta ação não pode ser desfeita."
        onConfirm={handleStart}
        onClose={() => setStartConfirm(false)}
        loading={actionLoading}
        confirmColor="success"
        confirmLabel="Iniciar"
      />

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancelar torneio"
        description="Todos os buy-ins serão estornados automaticamente. O torneio ficará visível no histórico como cancelado."
        onConfirm={handleCancel}
        onClose={() => setCancelConfirm(false)}
        loading={actionLoading}
        confirmColor="error"
        confirmLabel="Cancelar Torneio"
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
