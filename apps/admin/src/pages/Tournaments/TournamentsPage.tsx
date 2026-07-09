import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, CardContent, Tabs, Tab, Button, Chip, Typography,
  CircularProgress, Tooltip,
} from '@mui/material'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import PublicIcon from '@mui/icons-material/Public'
import type { ColumnDef } from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/tables/DataTable'
import { StatusChip } from '../../components/ui/StatusChip'
import { adminApi } from '../../lib/admin-api'
import type { AdminDuel } from '../../types'

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString('pt-BR') : '—' }

function DuelTypeChip({ type }: { type: string }) {
  const isFlash = type === 'DUEL_FLASH'
  return (
    <Chip
      icon={isFlash ? <FlashOnIcon fontSize="small" /> : <PublicIcon fontSize="small" />}
      label={isFlash ? 'Flash' : 'Giant'}
      size="small"
      color={isFlash ? 'warning' : 'info'}
      variant="outlined"
    />
  )
}

function DuelsTab({ view }: { view: 'active' | 'finished' }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<AdminDuel[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.duels.list({ view, page, limit: 20 })
      setRows(res.data)
      setTotalPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [view, page])

  useEffect(() => { void load() }, [load])

  const baseColumns: ColumnDef<AdminDuel, unknown>[] = [
    {
      accessorKey: 'type',
      header: 'Tipo',
      cell: ({ getValue }) => <DuelTypeChip type={getValue<string>()} />,
    },
    {
      accessorKey: 'timeControl',
      header: 'Formato',
      cell: ({ getValue }) => (
        <Typography variant="body2" fontFamily="monospace">{getValue<string>()}</Typography>
      ),
    },
    {
      accessorKey: 'maxPlayers',
      header: 'Jogadores',
      cell: ({ getValue }) => <Typography variant="body2">{getValue<number>()}</Typography>,
    },
    {
      accessorKey: 'entryFee',
      header: 'Buy-in',
      cell: ({ getValue }) => <Typography variant="body2">{getValue<number>()} CC</Typography>,
    },
    {
      accessorKey: 'rake',
      header: 'Rake',
      cell: ({ getValue }) => <Typography variant="body2" color="success.main">{getValue<number>()} CC</Typography>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusChip status={getValue<string>()} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Data',
      cell: ({ getValue }) => (
        <Tooltip title={fmtDate(getValue<string>())}>
          <Typography variant="caption">{fmtDate(getValue<string>())}</Typography>
        </Tooltip>
      ),
    },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => (
        <Button size="small" onClick={() => navigate(`/tournaments/${row.original.id}`)}>
          Detalhes
        </Button>
      ),
    },
  ]

  const finishedExtraColumn: ColumnDef<AdminDuel, unknown> = {
    accessorKey: 'winnerNickname',
    header: 'Vencedor',
    cell: ({ getValue }) => {
      const nick = getValue<string | null>()
      return nick
        ? <Typography variant="body2" fontWeight={600}>{nick}</Typography>
        : <Typography variant="caption" color="text.secondary">—</Typography>
    },
  }

  const columns = view === 'finished'
    ? [...baseColumns.slice(0, 7), finishedExtraColumn, baseColumns[7]]
    : baseColumns

  return (
    <DataTable
      data={rows}
      columns={columns}
      loading={loading}
      totalPages={totalPages}
      page={page}
      onPageChange={setPage}
      emptyMessage="Nenhum duelo encontrado"
    />
  )
}

export function TournamentsPage() {
  const [outerTab, setOuterTab] = useState(0)
  const [innerTab, setInnerTab] = useState(0)

  return (
    <Box>
      <PageHeader title="Competições" />

      <Card>
        <Tabs
          value={outerTab}
          onChange={(_, v) => setOuterTab(v)}
          sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}
        >
          <Tab label="Duelos" />
          <Tab label="Torneios" disabled />
        </Tabs>

        {outerTab === 0 && (
          <>
            <Tabs
              value={innerTab}
              onChange={(_, v) => { setInnerTab(v) }}
              sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2, bgcolor: 'background.paper' }}
              textColor="secondary"
              indicatorColor="secondary"
            >
              <Tab label="Em andamento" />
              <Tab label="Concluídos" />
            </Tabs>
            <CardContent sx={{ p: 0 }}>
              {innerTab === 0 && <DuelsTab key="active" view="active" />}
              {innerTab === 1 && <DuelsTab key="finished" view="finished" />}
            </CardContent>
          </>
        )}

        {outerTab === 1 && (
          <CardContent>
            <Typography color="text.secondary" textAlign="center" py={4}>
              Em breve — torneios customizados
            </Typography>
          </CardContent>
        )}
      </Card>
    </Box>
  )
}
