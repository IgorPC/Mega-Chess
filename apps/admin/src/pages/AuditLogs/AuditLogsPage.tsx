import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, MenuItem, Select, FormControl, InputLabel,
  Button, Stack, Tooltip, IconButton, CircularProgress, Divider,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import DownloadIcon from '@mui/icons-material/Download'
import ClearIcon from '@mui/icons-material/Clear'
import RefreshIcon from '@mui/icons-material/Refresh'
import { adminApi } from '../../lib/admin-api'
import type { AuditLog } from '../../types'

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'user', label: 'Usuário' },
  { value: 'withdrawal', label: 'Saque' },
  { value: 'tournament', label: 'Torneio' },
  { value: 'admin_user', label: 'Admin' },
]

const ACTION_COLOR: Record<string, 'error' | 'warning' | 'success' | 'info' | 'default'> = {
  ADMIN_LOGIN_FAILED: 'error',
  ADMIN_LOGIN_MFA_FAILED: 'error',
  USER_BANNED: 'error',
  WITHDRAWAL_REJECTED: 'error',
  ADMIN_LOGIN: 'success',
  ADMIN_LOGIN_MFA_OK: 'success',
  WITHDRAWAL_APPROVED: 'success',
  USER_SUSPENDED: 'warning',
  USER_ELO_ADJUSTED: 'warning',
  CONFIG_UPDATED: 'warning',
}

function ActionChip({ action }: { action: string }) {
  const color = ACTION_COLOR[action] ?? 'default'
  const label = action.replace(/_/g, ' ')
  return <Chip label={label} color={color} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

interface Filters {
  adminId: string
  action: string
  targetType: string
  dateFrom: string
  dateTo: string
}

const EMPTY_FILTERS: Filters = { adminId: '', action: '', targetType: '', dateFrom: '', dateTo: '' }

export function AuditLogsPage() {
  const [page, setPage]               = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [draft, setDraft]             = useState<Filters>(EMPTY_FILTERS)
  const [applied, setApplied]         = useState<Filters>(EMPTY_FILTERS)
  const [rows, setRows]               = useState<AuditLog[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: page + 1, limit: rowsPerPage }
      if (applied.adminId)    params.adminId    = applied.adminId
      if (applied.action)     params.action     = applied.action
      if (applied.targetType) params.targetType = applied.targetType
      if (applied.dateFrom)   params.dateFrom   = applied.dateFrom
      if (applied.dateTo)     params.dateTo     = applied.dateTo

      const res = await adminApi.staff.auditLogs(params) as any
      setRows(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, applied])

  useEffect(() => { load() }, [load])

  const applyFilters = () => {
    setPage(0)
    setApplied({ ...draft })
  }

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS)
    setPage(0)
    setApplied(EMPTY_FILTERS)
  }

  const handleExport = () => {
    const filterParams: Record<string, string> = {}
    if (applied.adminId)    filterParams.adminId    = applied.adminId
    if (applied.action)     filterParams.action     = applied.action
    if (applied.targetType) filterParams.targetType = applied.targetType
    if (applied.dateFrom)   filterParams.dateFrom   = applied.dateFrom
    if (applied.dateTo)     filterParams.dateTo     = applied.dateTo
    const url = adminApi.staff.exportAuditLogs(filterParams)
    const token = localStorage.getItem('adminToken')
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'audit-logs.csv'
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  const setField = (field: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value as string }))

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Audit Log (Admins)</Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Atualizar">
            <IconButton onClick={load} disabled={loading}><RefreshIcon /></IconButton>
          </Tooltip>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport} size="small">
            Exportar CSV
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" useFlexGap>
          <TextField
            label="Admin ID ou Nome"
            size="small"
            value={draft.adminId}
            onChange={setField('adminId')}
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="Ação (parcial)"
            size="small"
            value={draft.action}
            onChange={setField('action')}
            placeholder="ex: LOGIN, SUSPENDED"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Tipo de Alvo</InputLabel>
            <Select
              value={draft.targetType}
              label="Tipo de Alvo"
              onChange={(e) => setDraft((d) => ({ ...d, targetType: e.target.value }))}
            >
              {TARGET_TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="De"
            type="date"
            size="small"
            value={draft.dateFrom}
            onChange={setField('dateFrom')}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Até"
            type="date"
            size="small"
            value={draft.dateTo}
            onChange={setField('dateTo')}
            InputLabelProps={{ shrink: true }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="contained" startIcon={<SearchIcon />} onClick={applyFilters} size="small">
              Filtrar
            </Button>
            <Tooltip title="Limpar filtros">
              <IconButton size="small" onClick={clearFilters}><ClearIcon /></IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Paper>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data/Hora</TableCell>
                  <TableCell>Admin</TableCell>
                  <TableCell>Ação</TableCell>
                  <TableCell>Tipo Alvo</TableCell>
                  <TableCell>ID Alvo</TableCell>
                  <TableCell>Detalhes</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                      {fmtDate(row.createdAt)}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      <Typography variant="body2" fontWeight={500}>{row.adminName}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {row.adminId.length > 8 ? `${row.adminId.slice(0, 8)}…` : row.adminId}
                      </Typography>
                    </TableCell>
                    <TableCell><ActionChip action={row.action} /></TableCell>
                    <TableCell>
                      {row.targetType && (
                        <Chip label={row.targetType} size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                      {row.targetId ? `${row.targetId.slice(0, 8)}…` : '—'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280, fontSize: '0.75rem' }}>
                      <Tooltip title={row.details ?? ''} placement="top">
                        <span style={{ cursor: row.details ? 'help' : 'default' }}>
                          {row.details
                            ? row.details.length > 60 ? row.details.slice(0, 60) + '…' : row.details
                            : '—'}
                        </span>
                      </Tooltip>
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
              onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0) }}
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
