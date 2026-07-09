import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Chip, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, CircularProgress, Alert,
  Pagination,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { adminApi } from '../../lib/admin-api'

type SuggestionStatus = 'OPEN' | 'HIDDEN' | 'COMPLETED' | 'REJECTED'

interface Suggestion {
  id: string
  title: string
  description: string
  status: SuggestionStatus
  authorId: string
  authorNickname: string
  voteCount: number
  adminNote: string | null
  createdAt: string
}

const STATUS_COLOR: Record<SuggestionStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  OPEN: 'warning',
  HIDDEN: 'default',
  COMPLETED: 'success',
  REJECTED: 'error',
}

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  OPEN: 'Aberta',
  HIDDEN: 'Oculta',
  COMPLETED: 'Concluída',
  REJECTED: 'Rejeitada',
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Action dialog ─────────────────────────────────────────────────────────────

interface ActionDialogProps {
  open: boolean
  suggestion: Suggestion | null
  targetStatus: SuggestionStatus | null
  onClose: () => void
  onConfirm: (id: string, status: SuggestionStatus, adminNote: string) => Promise<void>
}

function ActionDialog({ open, suggestion, targetStatus, onClose, onConfirm }: ActionDialogProps) {
  const [adminNote, setAdminNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setAdminNote(suggestion?.adminNote ?? ''); setError('') }
  }, [open, suggestion])

  const needsNote = targetStatus === 'COMPLETED' || targetStatus === 'REJECTED'

  const handleConfirm = async () => {
    if (!suggestion || !targetStatus) return
    setLoading(true); setError('')
    try {
      await onConfirm(suggestion.id, targetStatus, adminNote)
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Erro ao atualizar')
    } finally {
      setLoading(false)
    }
  }

  const actionLabels: Partial<Record<SuggestionStatus, string>> = {
    COMPLETED: 'Marcar como concluída',
    REJECTED: 'Rejeitar',
    HIDDEN: 'Ocultar',
    OPEN: 'Restaurar',
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{targetStatus ? actionLabels[targetStatus] : ''}</DialogTitle>
      <DialogContent>
        {suggestion && (
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>{suggestion.title}</Typography>
            <Typography variant="body2" color="text.secondary">{truncate(suggestion.description, 200)}</Typography>
          </Box>
        )}
        {(needsNote || targetStatus === 'HIDDEN' || targetStatus === 'OPEN') && (
          <TextField
            label="Nota para o usuário (opcional)"
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            multiline
            rows={3}
            fullWidth
            inputProps={{ maxLength: 2000 }}
            sx={{ mt: 1 }}
          />
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button onClick={handleConfirm} disabled={loading} variant="contained" color={targetStatus === 'REJECTED' ? 'error' : 'primary'}>
          {loading ? <CircularProgress size={20} /> : 'Confirmar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SuggestionsAdminPage() {
  const [items, setItems] = useState<Suggestion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialog, setDialog] = useState<{ open: boolean; suggestion: Suggestion | null; targetStatus: SuggestionStatus | null }>({
    open: false, suggestion: null, targetStatus: null,
  })

  const load = useCallback(() => {
    setLoading(true); setError('')
    const params: Record<string, string | number> = { page, limit: 25 }
    if (statusFilter) params.status = statusFilter
    adminApi.suggestions.list(params as any)
      .then(d => {
        setItems(d.items as Suggestion[])
        setTotal(d.total)
        setTotalPages(d.totalPages)
        setLoading(false)
      })
      .catch(err => { setError(err.message ?? 'Erro ao carregar'); setLoading(false) })
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const openAction = (suggestion: Suggestion, targetStatus: SuggestionStatus) => {
    setDialog({ open: true, suggestion, targetStatus })
  }

  const handleConfirm = async (id: string, status: SuggestionStatus, adminNote: string) => {
    await adminApi.suggestions.update(id, status, adminNote || undefined)
    load()
  }

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>Sugestões de Melhoria</Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="OPEN">Aberta</MenuItem>
            <MenuItem value="COMPLETED">Concluída</MenuItem>
            <MenuItem value="REJECTED">Rejeitada</MenuItem>
            <MenuItem value="HIDDEN">Oculta</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" alignSelf="center">
          {total} sugestão{total !== 1 ? 'ões' : ''}
        </Typography>
        <Tooltip title="Atualizar">
          <IconButton onClick={load} disabled={loading} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell>Autor</TableCell>
              <TableCell align="center">Votos</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Data</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Nenhuma sugestão encontrada
                </TableCell>
              </TableRow>
            ) : items.map(s => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" fontWeight={500}>{truncate(s.title, 60)}</Typography>
                  <Typography variant="caption" color="text.secondary">{truncate(s.description, 80)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{s.authorNickname}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" fontWeight={700}>{s.voteCount}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={STATUS_LABEL[s.status]} color={STATUS_COLOR[s.status]} size="small" />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{formatDate(s.createdAt)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" gap={0.5}>
                    {s.status !== 'COMPLETED' && (
                      <Tooltip title="Concluir">
                        <IconButton size="small" color="success" onClick={() => openAction(s, 'COMPLETED')}>
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {s.status !== 'REJECTED' && (
                      <Tooltip title="Rejeitar">
                        <IconButton size="small" color="error" onClick={() => openAction(s, 'REJECTED')}>
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {s.status !== 'HIDDEN' ? (
                      <Tooltip title="Ocultar">
                        <IconButton size="small" onClick={() => openAction(s, 'HIDDEN')}>
                          <VisibilityOffIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Restaurar (Aberta)">
                        <IconButton size="small" color="info" onClick={() => openAction(s, 'OPEN')}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination count={totalPages} page={page} onChange={(_, v) => setPage(v)} color="primary" />
        </Box>
      )}

      <ActionDialog
        open={dialog.open}
        suggestion={dialog.suggestion}
        targetStatus={dialog.targetStatus}
        onClose={() => setDialog(d => ({ ...d, open: false }))}
        onConfirm={handleConfirm}
      />
    </Box>
  )
}
