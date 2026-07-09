import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, Button, Stack, Tooltip,
  CircularProgress, IconButton,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'
import RefreshIcon from '@mui/icons-material/Refresh'
import { adminApi } from '../../lib/admin-api'
import type { UserActivityLog } from '../../types'

const ACTION_COLOR: Record<string, 'error' | 'warning' | 'success' | 'info' | 'default'> = {
  AUTH_LOGIN: 'success',
  AUTH_LOGOUT: 'default',
  AUTH_LOGIN_FAILED: 'error',
  DEPOSIT_CONFIRMED: 'success',
  DEPOSIT_INITIATED: 'info',
  DEPOSIT_CANCELLED: 'warning',
  DEPOSIT_EXPIRED: 'warning',
  WITHDRAWAL_REQUESTED: 'info',
  WITHDRAWAL_PROCESSED: 'success',
  WITHDRAWAL_BLOCKED: 'error',
  WITHDRAWAL_FAILED: 'error',
  FRIEND_REQUEST_SENT: 'info',
  FRIEND_REQUEST_ACCEPTED: 'success',
  FRIEND_REQUEST_REJECTED: 'warning',
  FRIEND_REMOVED: 'warning',
  PROFILE_UPDATED: 'default',
  AVATAR_UPDATED: 'default',
  PIX_KEY_UPDATED: 'default',
  CPF_REGISTERED: 'info',
  MATCH_STARTED: 'success',
  MATCH_FINISHED: 'default',
  MATCH_FORFEITED: 'warning',
  TOURNAMENT_JOINED: 'info',
  PRIZE_RECEIVED: 'success',
  ACCOUNT_SUSPENDED: 'error',
  ACCOUNT_BANNED: 'error',
}

function ActionChip({ action }: { action: string }) {
  const color = ACTION_COLOR[action] ?? 'default'
  return (
    <Chip
      label={action.replace(/_/g, ' ')}
      color={color}
      size="small"
      sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
    />
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function MetaPreview({ meta }: { meta: Record<string, unknown> | null }) {
  if (!meta) return <span style={{ color: 'inherit', opacity: 0.4 }}>—</span>
  const text = JSON.stringify(meta)
  const short = text.length > 60 ? text.slice(0, 60) + '…' : text
  return (
    <Tooltip title={text} placement="top">
      <span style={{ cursor: 'help', fontFamily: 'monospace', fontSize: '0.7rem' }}>{short}</span>
    </Tooltip>
  )
}

interface Filters { userId: string; action: string; dateFrom: string; dateTo: string }
const EMPTY: Filters = { userId: '', action: '', dateFrom: '', dateTo: '' }

export function UserActivityPage() {
  const [page, setPage]               = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [draft, setDraft]             = useState<Filters>(EMPTY)
  const [applied, setApplied]         = useState<Filters>(EMPTY)
  const [rows, setRows]               = useState<UserActivityLog[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: page + 1, limit: rowsPerPage }
      if (applied.userId)   params.userId   = applied.userId
      if (applied.action)   params.action   = applied.action
      if (applied.dateFrom) params.dateFrom = applied.dateFrom
      if (applied.dateTo)   params.dateTo   = applied.dateTo
      const res = await adminApi.staff.userActivity(params) as any
      setRows(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, applied])

  useEffect(() => { load() }, [load])

  const apply  = () => { setPage(0); setApplied({ ...draft }) }
  const clear  = () => { setDraft(EMPTY); setPage(0); setApplied(EMPTY) }
  const setF   = (f: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(d => ({ ...d, [f]: e.target.value }))

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Atividade de Usuários</Typography>
        <Tooltip title="Atualizar">
          <IconButton onClick={load} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            label="User ID"
            size="small"
            value={draft.userId}
            onChange={setF('userId')}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Ação (parcial)"
            size="small"
            value={draft.action}
            onChange={setF('action')}
            placeholder="ex: DEPOSIT, LOGIN"
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="De"
            type="date"
            size="small"
            value={draft.dateFrom}
            onChange={setF('dateFrom')}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Até"
            type="date"
            size="small"
            value={draft.dateTo}
            onChange={setF('dateTo')}
            InputLabelProps={{ shrink: true }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="contained" startIcon={<SearchIcon />} onClick={apply} size="small">
              Filtrar
            </Button>
            <Tooltip title="Limpar filtros">
              <IconButton size="small" onClick={clear}><ClearIcon /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data/Hora</TableCell>
                  <TableCell>User ID</TableCell>
                  <TableCell>Ação</TableCell>
                  <TableCell>Dados</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : rows.map(row => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                      {fmtDate(row.createdAt)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                      {row.userId.slice(0, 8)}…
                    </TableCell>
                    <TableCell><ActionChip action={row.action} /></TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <MetaPreview meta={row.metadata} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                      {row.ipAddress ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0) }}
              rowsPerPageOptions={[25, 50, 100]}
              labelRowsPerPage="Por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
            />
          </>
        )}
      </Paper>
    </Box>
  )
}
