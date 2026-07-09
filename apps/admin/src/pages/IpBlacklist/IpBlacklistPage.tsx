import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Chip, TextField, Button, Stack, Tooltip, IconButton,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import BlockIcon from '@mui/icons-material/Block'
import { adminApi } from '../../lib/admin-api'
import type { IpBlacklistEntry } from '../../types'

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isExpired(entry: IpBlacklistEntry) {
  return !!entry.expiresAt && new Date(entry.expiresAt) < new Date()
}

interface AddDialogProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

function AddDialog({ open, onClose, onSaved }: AddDialogProps) {
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!ip.trim()) { setError('IP é obrigatório'); return }
    setLoading(true)
    setError(null)
    try {
      await adminApi.ipBlacklist.add(ip.trim(), reason.trim() || undefined, expiresAt || undefined)
      setIp(''); setReason(''); setExpiresAt('')
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao bloquear IP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Bloquear IP</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Endereço IP"
            value={ip}
            onChange={e => setIp(e.target.value)}
            placeholder="Ex: 192.168.1.1"
            fullWidth
            size="small"
          />
          <TextField
            label="Motivo (opcional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
          />
          <TextField
            label="Expira em (opcional — deixe vazio para permanente)"
            type="datetime-local"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" color="error" disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Bloquear'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface EditDialogProps {
  entry: IpBlacklistEntry | null
  onClose: () => void
  onSaved: () => void
}

function EditDialog({ entry, onClose, onSaved }: EditDialogProps) {
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (entry) {
      setReason(entry.reason ?? '')
      setExpiresAt(entry.expiresAt ? new Date(entry.expiresAt).toISOString().slice(0, 16) : '')
    }
  }, [entry])

  const handleSubmit = async () => {
    if (!entry) return
    setLoading(true)
    setError(null)
    try {
      await adminApi.ipBlacklist.update(entry.ip, {
        reason: reason.trim() || null,
        expiresAt: expiresAt || null,
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!entry} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Editar bloqueio — {entry?.ip}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Motivo"
            value={reason}
            onChange={e => setReason(e.target.value)}
            multiline
            rows={2}
            fullWidth
            size="small"
          />
          <TextField
            label="Expira em (deixe vazio para permanente)"
            type="datetime-local"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={18} /> : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function IpBlacklistPage() {
  const [data, setData]           = useState<IpBlacklistEntry[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [rowsPerPage]             = useState(25)
  const [ipFilter, setIpFilter]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [addOpen, setAddOpen]     = useState(false)
  const [editEntry, setEditEntry] = useState<IpBlacklistEntry | null>(null)
  const [delIp, setDelIp]         = useState<string | null>(null)
  const [delLoading, setDelLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.ipBlacklist.list({ page: page + 1, limit: rowsPerPage, ip: ipFilter || undefined })
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar blacklist')
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, ipFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async () => {
    if (!delIp) return
    setDelLoading(true)
    try {
      await adminApi.ipBlacklist.remove(delIp)
      setDelIp(null)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setDelLoading(false)
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <BlockIcon color="error" />
          <Typography variant="h5" fontWeight={700}>Blacklist de IPs</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Atualizar">
            <IconButton onClick={load} disabled={loading}><RefreshIcon /></IconButton>
          </Tooltip>
          <Button
            variant="contained"
            color="error"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
          >
            Bloquear IP
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Filtrar por IP"
            value={ipFilter}
            onChange={e => { setIpFilter(e.target.value); setPage(0) }}
            size="small"
            sx={{ width: 240 }}
            placeholder="192.168.1.1"
          />
          <Typography variant="body2" color="text.secondary">
            {total} IP{total !== 1 ? 's' : ''} bloqueado{total !== 1 ? 's' : ''}
          </Typography>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>IP</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Bloqueado por</TableCell>
              <TableCell>Criado em</TableCell>
              <TableCell>Expira em</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Nenhum IP bloqueado
                </TableCell>
              </TableRow>
            ) : data.map(row => (
              <TableRow key={row.id} hover sx={{ opacity: isExpired(row) ? 0.5 : 1 }}>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.ip}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Tooltip title={row.reason ?? ''}>
                    <Typography variant="body2" noWrap>{row.reason || '—'}</Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>{row.blockedByName || '—'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(row.createdAt)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {row.expiresAt ? fmtDate(row.expiresAt) : <Chip label="Permanente" size="small" color="error" />}
                </TableCell>
                <TableCell>
                  {isExpired(row)
                    ? <Chip label="Expirado" size="small" color="default" />
                    : <Chip label="Ativo" size="small" color="error" />}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => setEditEntry(row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remover bloqueio">
                    <IconButton size="small" color="error" onClick={() => setDelIp(row.ip)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25]}
          onPageChange={(_, p) => setPage(p)}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </Paper>

      <AddDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
      <EditDialog entry={editEntry} onClose={() => setEditEntry(null)} onSaved={load} />

      {/* Confirm delete */}
      <Dialog open={!!delIp} onClose={() => setDelIp(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remover bloqueio</DialogTitle>
        <DialogContent>
          <Typography>Remover IP <strong>{delIp}</strong> da blacklist?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDelIp(null)} disabled={delLoading}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={delLoading}>
            {delLoading ? <CircularProgress size={18} /> : 'Remover'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
