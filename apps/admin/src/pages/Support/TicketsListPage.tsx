import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, FormControl, InputLabel, Select, MenuItem,
  Typography, Chip, Avatar, Grid, TextField, Button,
} from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/tables/DataTable'
import { StatusChip } from '../../components/ui/StatusChip'
import { adminApi } from '../../lib/admin-api'
import type { SupportTicket } from '../../types'

function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR') }

function slaColor(createdAt: string, status: string): 'success' | 'warning' | 'error' {
  if (status === 'CLOSED') return 'success'
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (hours < 4) return 'success'
  if (hours < 24) return 'warning'
  return 'error'
}

function slaLabel(createdAt: string, status: string) {
  if (status === 'CLOSED') return 'Fechado'
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (hours < 1) return `${Math.round(hours * 60)}min`
  return `${Math.round(hours)}h`
}

export function TicketsListPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<SupportTicket[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 25 }
      if (status) params.status = status
      if (category) params.category = category
      if (search) params.search = search
      const res = await adminApi.support.list(params)
      setData(res.data); setTotalPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [page, status, category, search])

  useEffect(() => { void load() }, [load])

  const columns: ColumnDef<SupportTicket, unknown>[] = [
    {
      id: 'sla',
      header: 'SLA',
      cell: ({ row }) => (
        <Chip
          label={slaLabel(row.original.createdAt, row.original.status)}
          color={slaColor(row.original.createdAt, row.original.status)}
          size="small"
        />
      ),
    },
    {
      accessorKey: 'title',
      header: 'Título',
      cell: ({ row }) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{row.original.title}</Typography>
          <Chip label={row.original.category} size="small" variant="outlined" sx={{ mt: 0.25 }} />
        </Box>
      ),
    },
    {
      id: 'user',
      header: 'Usuário',
      cell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Avatar sx={{ width: 26, height: 26, fontSize: 11 }}>{row.original.userNickname?.charAt(0) ?? '?'}</Avatar>
          <Typography variant="caption">{row.original.userNickname}</Typography>
        </Box>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusChip status={getValue<string>()} /> },
    {
      id: 'agent',
      header: 'Atendente',
      cell: ({ row }) => <Typography variant="caption">{row.original.assignedToName ?? <em>Não atribuído</em>}</Typography>,
    },
    { accessorKey: 'createdAt', header: 'Criado em', cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string>())}</Typography> },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => <Button size="small" onClick={() => navigate(`/support/${row.original.id}`)}>Abrir</Button>,
    },
  ]

  return (
    <Box>
      <PageHeader title="Suporte" />

      <Card sx={{ mb: 2, p: 2 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={4}>
            <TextField
              label="Buscar por título ou usuário"
              fullWidth
              size="small"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="OPEN">Aberto</MenuItem>
                <MenuItem value="IN_PROGRESS">Em andamento</MenuItem>
                <MenuItem value="WAITING_USER">Aguardando usuário</MenuItem>
                <MenuItem value="CLOSED">Fechado</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Categoria</InputLabel>
              <Select value={category} label="Categoria" onChange={(e) => { setCategory(e.target.value); setPage(1) }}>
                <MenuItem value="">Todas</MenuItem>
                <MenuItem value="PAYMENT">Pagamento</MenuItem>
                <MenuItem value="ACCOUNT">Conta</MenuItem>
                <MenuItem value="GAME">Partida</MenuItem>
                <MenuItem value="TOURNAMENT">Torneio</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="OTHER">Outro</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button fullWidth size="small" onClick={() => { setSearch(''); setStatus(''); setCategory(''); setPage(1) }}>Limpar</Button>
          </Grid>
        </Grid>
      </Card>

      <Card>
        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          totalPages={totalPages}
          page={page}
          onPageChange={setPage}
          emptyMessage="Nenhum ticket encontrado"
        />
      </Card>
    </Box>
  )
}
