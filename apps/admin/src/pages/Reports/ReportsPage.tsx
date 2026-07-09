import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, FormControl, InputLabel, Select, MenuItem,
  Typography, Chip, Avatar, Grid, TextField, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress, Alert, CircularProgress, Snackbar,
  Divider, IconButton, Tooltip,
} from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/tables/DataTable'
import { adminApi } from '../../lib/admin-api'
import type { MatchReport } from '../../types'

function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR') }

function VerdictChip({ verdict }: { verdict: string | null }) {
  if (!verdict) return <Chip label="Pendente" size="small" />
  const map: Record<string, { color: 'success' | 'warning' | 'error'; label: string }> = {
    CLEAN: { color: 'success', label: 'Limpo' },
    SUSPICIOUS: { color: 'warning', label: 'Suspeito' },
    CHEATING: { color: 'error', label: 'Trapaça' },
  }
  const cfg = map[verdict] ?? { color: 'default' as any, label: verdict }
  return <Chip label={cfg.label} color={cfg.color} size="small" />
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: 'default' | 'info' | 'warning' | 'success'; label: string }> = {
    ANALYZING: { color: 'info', label: 'Analisando' },
    COMPLETED: { color: 'default', label: 'Concluído' },
    UNDER_REVIEW: { color: 'warning', label: 'Em Revisão' },
    RESOLVED: { color: 'success', label: 'Resolvido' },
  }
  const cfg = map[status] ?? { color: 'default', label: status }
  return <Chip label={cfg.label} color={cfg.color} size="small" variant="outlined" />
}

function ResolutionLabel(r: string | null) {
  if (!r) return '—'
  const map: Record<string, string> = {
    DISMISSED: 'Descartado',
    WARNED: 'Advertido',
    SUSPENDED: 'Suspenso',
    BANNED: 'Banido',
  }
  return map[r] ?? r
}

export function ReportsPage() {
  const [data, setData] = useState<MatchReport[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [verdictFilter, setVerdictFilter] = useState('')
  const [reportedId, setReportedId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [selected, setSelected] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [resolution, setResolution] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [resolving, setResolving] = useState(false)
  const [snack, setSnack] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 25 }
      if (statusFilter) params.status = statusFilter
      if (verdictFilter) params.verdict = verdictFilter
      if (reportedId) params.reportedId = reportedId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      const res = await adminApi.matchReports.list(params)
      setData(res.data)
      setTotalPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [page, statusFilter, verdictFilter, reportedId, dateFrom, dateTo])

  useEffect(() => { void load() }, [load])

  const openDetail = async (report: MatchReport) => {
    setDetailLoading(true)
    setSelected(null)
    try {
      const detail = await adminApi.matchReports.getOne(report.id)
      setSelected(detail)
      setResolution(detail.resolution ?? '')
      setAdminNote(detail.adminNote ?? '')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setDetailLoading(false) }
  }

  const handleAnalyze = async () => {
    if (!selected) return
    setAiLoading(true)
    try {
      const updated = await adminApi.matchReports.analyze(selected.id)
      setSelected((prev: any) => ({ ...prev, ...updated }))
      setSnack('Análise concluída.')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro ao analisar') }
    finally { setAiLoading(false) }
  }

  const handleResolve = async () => {
    if (!selected || !resolution) return
    setResolving(true)
    try {
      await adminApi.matchReports.resolve(selected.id, resolution, adminNote || undefined)
      setSnack('Report resolvido.')
      setSelected(null)
      void load()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro ao resolver') }
    finally { setResolving(false) }
  }

  const columns: ColumnDef<MatchReport, unknown>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Data',
      cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string>())}</Typography>,
    },
    {
      id: 'reporter',
      header: 'Denunciante',
      cell: ({ row }) => {
        const nick = (row.original as any).reporter?.nickname ?? row.original.reporterNickname ?? '?'
        return (
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>{nick.charAt(0)}</Avatar>
            <Typography variant="caption">{nick}</Typography>
          </Box>
        )
      },
    },
    {
      id: 'reported',
      header: 'Denunciado',
      cell: ({ row }) => {
        const nick = (row.original as any).reportedUser?.nickname ?? row.original.reportedNickname ?? '?'
        return (
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>{nick.charAt(0)}</Avatar>
            <Typography variant="caption">{nick}</Typography>
          </Box>
        )
      },
    },
    {
      id: 'verdict',
      header: 'Veredicto IA',
      cell: ({ row }) => <VerdictChip verdict={row.original.aiVerdict} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => (
        <Button size="small" onClick={() => openDetail(row.original)}>
          Ver
        </Button>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <PageHeader title="Reports de Jogadores" />
        <Tooltip title="Atualizar">
          <IconButton onClick={() => void load()} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Card sx={{ mb: 2, p: 2 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="ANALYZING">Analisando</MenuItem>
                <MenuItem value="UNDER_REVIEW">Em Revisão</MenuItem>
                <MenuItem value="COMPLETED">Concluído</MenuItem>
                <MenuItem value="RESOLVED">Resolvido</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Veredicto IA</InputLabel>
              <Select value={verdictFilter} label="Veredicto IA" onChange={(e) => { setVerdictFilter(e.target.value); setPage(1) }}>
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="CLEAN">Limpo</MenuItem>
                <MenuItem value="SUSPICIOUS">Suspeito</MenuItem>
                <MenuItem value="CHEATING">Trapaça</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="ID do denunciado"
              fullWidth
              size="small"
              value={reportedId}
              onChange={(e) => { setReportedId(e.target.value); setPage(1) }}
            />
          </Grid>
          <Grid item xs={6} sm={1.5}>
            <TextField
              label="De"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            />
          </Grid>
          <Grid item xs={6} sm={1.5}>
            <TextField
              label="Até"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            />
          </Grid>
          <Grid item xs={12} sm={12} display="flex" justifyContent="flex-end">
            <Button size="small" onClick={() => { setStatusFilter(''); setVerdictFilter(''); setReportedId(''); setDateFrom(''); setDateTo(''); setPage(1) }}>
              Limpar
            </Button>
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
          emptyMessage="Nenhum report encontrado"
        />
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected || detailLoading} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Detalhes do Report</Typography>
          <IconButton onClick={() => setSelected(null)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {detailLoading && <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}

          {selected && (
            <Grid container spacing={2}>
              {/* Left: report info */}
              <Grid item xs={12} md={7}>
                <Box display="flex" flexDirection="column" gap={2}>
                  {/* Parties */}
                  <Box>
                    <Typography variant="subtitle2" mb={1}>Partes</Typography>
                    <Box display="flex" gap={2}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Denunciante</Typography>
                        <Typography variant="body2" fontWeight={600}>{selected.reporter?.nickname ?? selected.reporterNickname}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Denunciado</Typography>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography variant="body2" fontWeight={600}>{selected.reportedUser?.nickname ?? selected.reportedNickname}</Typography>
                          {selected.reportedUser?.bannedUntil && (
                            <Chip label="Banido" color="error" size="small" />
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Reporter note */}
                  {selected.reporterNote && (
                    <Box>
                      <Typography variant="subtitle2" mb={0.5}>Nota do denunciante</Typography>
                      <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
                        <Typography variant="body2">{selected.reporterNote}</Typography>
                      </Box>
                    </Box>
                  )}

                  {/* AI Analysis */}
                  <Box>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <SmartToyIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2">Análise IA</Typography>
                      </Box>
                      {!selected.aiVerdict && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleAnalyze}
                          disabled={aiLoading}
                          startIcon={aiLoading ? <CircularProgress size={14} /> : <SmartToyIcon />}
                        >
                          Analisar com IA
                        </Button>
                      )}
                    </Box>

                    {selected.aiVerdict ? (
                      <Box display="flex" flexDirection="column" gap={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <VerdictChip verdict={selected.aiVerdict} />
                          {selected.aiConfidence != null && (
                            <Typography variant="caption" color="text.secondary">
                              Confiança: {Math.round(selected.aiConfidence * 100)}%
                            </Typography>
                          )}
                        </Box>
                        {selected.aiConfidence != null && (
                          <LinearProgress
                            variant="determinate"
                            value={selected.aiConfidence * 100}
                            color={selected.aiVerdict === 'CHEATING' ? 'error' : selected.aiVerdict === 'SUSPICIOUS' ? 'warning' : 'success'}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        )}
                        {selected.aiFlags && selected.aiFlags.length > 0 && (
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {(selected.aiFlags as string[]).map((f: string) => (
                              <Chip key={f} label={f} size="small" variant="outlined" color="warning" />
                            ))}
                          </Box>
                        )}
                        {selected.aiExplanation && (
                          <Typography variant="body2" color="text.secondary">{selected.aiExplanation}</Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        Nenhuma análise realizada ainda. Clique em "Analisar com IA" para iniciar.
                      </Typography>
                    )}
                  </Box>

                  <Divider />

                  {/* Match link */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary">ID da partida:</Typography>
                    <Typography variant="caption" fontFamily="monospace">{selected.matchId}</Typography>
                    <Tooltip title="Ver partida">
                      <IconButton size="small" href={`/tournaments/matches/${selected.matchId}`} target="_blank">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary">Criado em:</Typography>
                    <Typography variant="caption">{fmtDate(selected.createdAt)}</Typography>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary">Status:</Typography>
                    <StatusChip status={selected.status} />
                    {selected.resolution && (
                      <Chip label={ResolutionLabel(selected.resolution)} size="small" />
                    )}
                  </Box>
                </Box>
              </Grid>

              {/* Right: history, tickets, resolution */}
              <Grid item xs={12} md={5}>
                <Box display="flex" flexDirection="column" gap={2}>
                  {/* Report history */}
                  <Box>
                    <Typography variant="subtitle2" mb={1}>
                      Histórico de reports contra este jogador ({selected.reportHistoryCount ?? 0})
                    </Typography>
                    {(selected.reportHistory ?? []).slice(0, 5).map((r: any) => (
                      <Box key={r.id} sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover', mb: 0.5 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption">{fmtDate(r.createdAt)}</Typography>
                          <VerdictChip verdict={r.aiVerdict} />
                        </Box>
                        <StatusChip status={r.status} />
                      </Box>
                    ))}
                    {(selected.reportHistoryCount ?? 0) === 0 && (
                      <Typography variant="caption" color="text.disabled">Nenhum report anterior.</Typography>
                    )}
                  </Box>

                  <Divider />

                  {/* Support tickets */}
                  <Box>
                    <Typography variant="subtitle2" mb={1}>Tickets de suporte</Typography>
                    {(selected.tickets ?? []).length === 0 ? (
                      <Typography variant="caption" color="text.disabled">Nenhum ticket.</Typography>
                    ) : (
                      (selected.tickets as any[]).map((t: any) => (
                        <Box key={t.id} sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover', mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={600}>{t.title}</Typography>
                          <Box display="flex" justifyContent="space-between">
                            <Chip label={t.category} size="small" variant="outlined" sx={{ mt: 0.25 }} />
                            <Typography variant="caption" color="text.secondary">{t.status}</Typography>
                          </Box>
                        </Box>
                      ))
                    )}
                  </Box>

                  <Divider />

                  {/* Resolution */}
                  {selected.status !== 'RESOLVED' && (
                    <Box>
                      <Typography variant="subtitle2" mb={1}>Resolução</Typography>
                      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                        <InputLabel>Decisão</InputLabel>
                        <Select
                          value={resolution}
                          label="Decisão"
                          onChange={(e) => setResolution(e.target.value)}
                        >
                          <MenuItem value="DISMISSED">Descartado (sem evidência)</MenuItem>
                          <MenuItem value="WARNED">Advertência ao jogador</MenuItem>
                          <MenuItem value="SUSPENDED">Suspensão temporária</MenuItem>
                          <MenuItem value="BANNED">Banimento</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label="Nota do administrador"
                        fullWidth
                        multiline
                        rows={3}
                        size="small"
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        sx={{ mb: 1.5 }}
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        disabled={!resolution || resolving}
                        onClick={handleResolve}
                        startIcon={resolving ? <CircularProgress size={14} /> : undefined}
                      >
                        Resolver
                      </Button>
                    </Box>
                  )}

                  {selected.status === 'RESOLVED' && (
                    <Alert severity="success">
                      Resolvido como: <strong>{ResolutionLabel(selected.resolution)}</strong>
                      {selected.adminNote && <><br />{selected.adminNote}</>}
                    </Alert>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setSelected(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
