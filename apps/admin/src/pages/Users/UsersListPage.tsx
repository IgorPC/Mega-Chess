import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, CardContent, Grid, TextField, Select, MenuItem,
  FormControl, InputLabel, Button, Avatar, Typography, Chip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import type { ColumnDef } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/tables/DataTable'
import { StatusChip } from '../../components/ui/StatusChip'
import { adminApi } from '../../lib/admin-api'
import type { Player } from '../../types'
import { useAdminAuth } from '../../store/admin-auth.store'

function playerStatus(p: Player) {
  if (p.bannedUntil) {
    const until = new Date(p.bannedUntil)
    if (until.getFullYear() > 2100) return 'BANNED'
    if (until > new Date()) return 'SUSPENDED'
  }
  return 'ACTIVE'
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

export function UsersListPage() {
  const navigate = useNavigate()
  const { hasRole } = useAdminAuth()
  const [data, setData] = useState<Player[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (search) params.search = search
      if (status) params.status = status
      const res = await adminApi.users.list(params)
      setData(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [page, search, status])

  useEffect(() => { void load() }, [load])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    void load()
  }

  const columns: ColumnDef<Player, unknown>[] = [
    {
      id: 'user',
      header: 'Usuário',
      cell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1.5}>
          <Avatar src={row.original.avatarUrl ?? undefined} sx={{ width: 32, height: 32, fontSize: 13 }}>
            {row.original.nickname.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600}>{row.original.nickname}</Typography>
            <Typography variant="caption" color="text.secondary">{row.original.email}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      accessorKey: 'rating',
      header: 'ELO',
      cell: ({ getValue }) => <Chip label={getValue<number>()} size="small" variant="outlined" />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusChip status={playerStatus(row.original)} />,
    },
    {
      id: 'online',
      header: 'Online',
      cell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={0.5}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: row.original.isOnline ? 'success.main' : 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary">{row.original.isOnline ? 'Online' : 'Offline'}</Typography>
        </Box>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Cadastro',
      cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string>())}</Typography>,
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Último login',
      cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string | null>())}</Typography>,
    },
  ]

  return (
    <Box>
      <PageHeader
        title={`Usuários${total ? ` (${total})` : ''}`}
        action={
          hasRole('FINANCEIRO') ? (
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              href={adminApi.users.exportCsv()}
              size="small"
            >
              Exportar CSV
            </Button>
          ) : undefined
        }
      />

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box component="form" onSubmit={handleSearch}>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  placeholder="Buscar por nickname ou email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="ACTIVE">Ativo</MenuItem>
                    <MenuItem value="SUSPENDED">Suspenso</MenuItem>
                    <MenuItem value="BANNED">Banido</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6} sm={2}>
                <Button type="submit" variant="contained" fullWidth>Buscar</Button>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button fullWidth onClick={() => { setSearch(''); setStatus(''); setPage(1) }}>Limpar</Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <DataTable
          data={data}
          columns={columns}
          loading={loading}
          totalPages={totalPages}
          page={page}
          onPageChange={(p) => { setPage(p); void load() }}
          emptyMessage="Nenhum usuário encontrado"
        />
      </Card>

      {/* Row click — navigate to detail */}
      <Box
        sx={{ display: 'none' }}
        onClick={(e) => {
          const row = (e.target as HTMLElement).closest('tr')
          if (row) {
            const idx = parseInt(row.getAttribute('data-index') ?? '-1')
            if (idx >= 0) navigate(`/users/${data[idx]?.id}`)
          }
        }}
      />
    </Box>
  )
}
