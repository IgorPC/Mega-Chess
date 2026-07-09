import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Chip, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, CircularProgress, Alert, Pagination,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { adminApi } from '../../lib/admin-api'

interface ReferralItem {
  id: string
  referrerId: string
  referrerNickname: string
  referredId: string
  referredNickname: string
  isEligible: boolean
  totalEarned: number
  createdAt: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

function fmtCC(v: number) {
  return `${Number(v).toFixed(2)} CC`
}

export function ReferralsAdminPage() {
  const [items, setItems] = useState<ReferralItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [eligibleFilter, setEligibleFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    const params: Parameters<typeof adminApi.referrals.list>[0] = { page, limit: 25 }
    if (eligibleFilter === 'true') params.isEligible = true
    if (eligibleFilter === 'false') params.isEligible = false

    adminApi.referrals.list(params)
      .then(d => {
        setItems(d.items)
        setTotal(d.total)
        setTotalPages(d.totalPages)
        setLoading(false)
      })
      .catch(err => {
        setError((err as Error).message ?? 'Erro ao carregar')
        setLoading(false)
      })
  }, [page, eligibleFilter])

  useEffect(() => { load() }, [load])

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={700} mb={3}>Indicações</Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap" alignItems="center">
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Elegibilidade</InputLabel>
          <Select
            value={eligibleFilter}
            label="Elegibilidade"
            onChange={e => { setEligibleFilter(e.target.value); setPage(1) }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="true">Elegíveis</MenuItem>
            <MenuItem value="false">Não elegíveis</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="body2" color="text.secondary" alignSelf="center">
          {total} indicaç{total !== 1 ? 'ões' : 'ão'}
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
              <TableCell>Indicador</TableCell>
              <TableCell>Indicado</TableCell>
              <TableCell align="center">Elegível</TableCell>
              <TableCell align="right">Total Ganho</TableCell>
              <TableCell>Data</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Nenhuma indicação encontrada
                </TableCell>
              </TableRow>
            ) : items.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{row.referrerNickname}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.referrerId.slice(0, 8)}…</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{row.referredNickname}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.referredId.slice(0, 8)}…</Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={row.isEligible ? 'Sim' : 'Não'}
                    color={row.isEligible ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700} color={row.totalEarned > 0 ? 'success.main' : 'text.secondary'}>
                    {fmtCC(row.totalEarned)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{formatDate(row.createdAt)}</Typography>
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
    </Box>
  )
}
