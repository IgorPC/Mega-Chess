import React, { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, CardContent, Tabs, Tab, Grid, TextField,
  FormControl, InputLabel, Select, MenuItem, Button,
  Typography, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, CircularProgress, Snackbar,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import PercentIcon from '@mui/icons-material/Percent'
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard'
import type { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable } from '../../components/tables/DataTable'
import { StatusChip } from '../../components/ui/StatusChip'
import { RiskBadge } from '../../components/ui/RiskBadge'
import { BarChart } from '../../components/charts/BarChart'
import { adminApi } from '../../lib/admin-api'
import type { WalletTransaction, Deposit, Withdrawal } from '../../types'
import { useAdminAuth } from '../../store/admin-auth.store'

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleString('pt-BR') : '—' }
function fmtBrl(v: string | number) { return `R$ ${parseFloat(String(v)).toFixed(2)}` }
function fmtCc(v: string | number) { return `${parseFloat(String(v)).toFixed(2)} CC` }

interface FinancialSummary {
  totalDeposits: string
  totalWithdrawals: string
  totalWalletBalance: string
  totalRake: string
}

function SummaryCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>{title}</Typography>
            <Typography variant="h5" fontWeight={700} mt={0.5}>{value}</Typography>
          </Box>
          <Box sx={{ bgcolor: `${color}22`, color, borderRadius: 2, p: 1, display: 'flex' }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export function TransactionsPage() {
  const { hasRole } = useAdminAuth()
  const [tab, setTab] = useState(0)

  // Transactions tab
  const [txData, setTxData] = useState<WalletTransaction[]>([])
  const [txPage, setTxPage] = useState(1)
  const [txPages, setTxPages] = useState(1)
  const [txLoading, setTxLoading] = useState(false)

  // Withdrawals tab
  const [wdData, setWdData] = useState<Withdrawal[]>([])
  const [wdPage, setWdPage] = useState(1)
  const [wdPages, setWdPages] = useState(1)
  const [wdStatus, setWdStatus] = useState('')
  const [wdLoading, setWdLoading] = useState(false)

  // Deposits tab
  const [dpData, setDpData] = useState<Deposit[]>([])
  const [dpPage, setDpPage] = useState(1)
  const [dpPages, setDpPages] = useState(1)
  const [dpLoading, setDpLoading] = useState(false)

  // Rake summary
  const [rakeData, setRakeData] = useState<{ date: string; rakeCc: string }[]>([])
  const [rakePeriod, setRakePeriod] = useState('30d')

  // Financial overview (ADMIN only)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [financialLoading, setFinancialLoading] = useState(false)
  const [financialPeriod, setFinancialPeriod] = useState('all')
  const [referralBonusStats, setReferralBonusStats] = useState<{ totalEarned: number; totalPayments: number } | null>(null)

  // Action dialogs
  const [approveId, setApproveId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [snack, setSnack] = useState('')

  // Refund dialog
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundUser, setRefundUser] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  const loadTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const res = await adminApi.transactions.list({ page: txPage, limit: 20 })
      setTxData(res.data); setTxPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setTxLoading(false) }
  }, [txPage])

  const loadWithdrawals = useCallback(async () => {
    setWdLoading(true)
    try {
      const params: Record<string, string | number> = { page: wdPage, limit: 20 }
      if (wdStatus) params.status = wdStatus
      const res = await adminApi.transactions.withdrawals(params)
      setWdData(res.data); setWdPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setWdLoading(false) }
  }, [wdPage, wdStatus])

  const loadDeposits = useCallback(async () => {
    setDpLoading(true)
    try {
      const res = await adminApi.transactions.deposits({ page: dpPage, limit: 20 })
      setDpData(res.data); setDpPages(res.totalPages)
    } catch { /* ignore */ }
    finally { setDpLoading(false) }
  }, [dpPage])

  const loadRake = useCallback(async () => {
    try {
      const res = await adminApi.transactions.rakeSummary(rakePeriod)
      setRakeData(res.chart.map((c) => ({ ...c, date: c.date.slice(5) })))
    } catch { /* ignore */ }
  }, [rakePeriod])

  const loadFinancial = useCallback(async () => {
    setFinancialLoading(true)
    try {
      const [res, refStats] = await Promise.all([
        adminApi.transactions.financialSummary(financialPeriod),
        adminApi.referrals.stats(financialPeriod).catch(() => null),
      ])
      setFinancial(res)
      setReferralBonusStats(refStats)
    } catch { /* ignore */ }
    finally { setFinancialLoading(false) }
  }, [financialPeriod])

  useEffect(() => { void loadTransactions() }, [loadTransactions])
  useEffect(() => { void loadWithdrawals() }, [loadWithdrawals])
  useEffect(() => { void loadDeposits() }, [loadDeposits])
  useEffect(() => { void loadRake() }, [loadRake])
  useEffect(() => { if (hasRole('FINANCEIRO')) void loadFinancial() }, [loadFinancial, hasRole])

  const approve = async () => {
    if (!approveId) return
    setActionLoading(true)
    try {
      await adminApi.transactions.approveWithdrawal(approveId)
      setApproveId(null); setSnack('Saque aprovado! PIX em processamento.')
      void loadWithdrawals()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  const reject = async () => {
    if (!rejectId) return
    setActionLoading(true)
    try {
      await adminApi.transactions.rejectWithdrawal(rejectId, rejectReason)
      setRejectId(null); setRejectReason(''); setSnack('Saque rejeitado. CC estornado.')
      void loadWithdrawals()
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  const sendRefund = async () => {
    setActionLoading(true)
    try {
      await adminApi.transactions.refund(refundUser, parseFloat(refundAmount), refundReason)
      setRefundOpen(false); setSnack('Reembolso aplicado com sucesso.')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setActionLoading(false) }
  }

  // Tab index depends on role
  const rakeTabIndex = 3
  const financialTabIndex = 4

  const txColumns: ColumnDef<WalletTransaction, unknown>[] = [
    { accessorKey: 'createdAt', header: 'Data', cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string>())}</Typography> },
    { accessorKey: 'userNickname', header: 'Usuário' },
    { accessorKey: 'type', header: 'Tipo', cell: ({ getValue }) => <StatusChip status={getValue<string>()} /> },
    {
      accessorKey: 'amount',
      header: 'Valor',
      cell: ({ getValue }) => {
        const v = Number(getValue<string>())
        return <Typography variant="body2" fontWeight={700} color={v >= 0 ? 'success.main' : 'error.main'}>{v >= 0 ? '+' : ''}{fmtCc(v)}</Typography>
      },
    },
    { accessorKey: 'balanceAfter', header: 'Saldo após', cell: ({ getValue }) => <Typography variant="caption">{fmtCc(getValue<string>())}</Typography> },
  ]

  const wdColumns: ColumnDef<Withdrawal, unknown>[] = [
    { accessorKey: 'createdAt', header: 'Data', cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string>())}</Typography> },
    { accessorKey: 'userNickname', header: 'Usuário' },
    { accessorKey: 'valueCc', header: 'CC debitados', cell: ({ getValue }) => <Typography fontWeight={600}>{fmtCc(getValue<string>())}</Typography> },
    { accessorKey: 'valueBrl', header: 'BRL enviado', cell: ({ getValue }) => <Typography>{fmtBrl(getValue<string>())}</Typography> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusChip status={getValue<string>()} /> },
    {
      id: 'risk',
      header: 'Risco',
      cell: ({ row }) => <RiskBadge level={row.original.riskLevel} />,
    },
    {
      id: 'actions',
      header: 'Ações',
      cell: ({ row }) =>
        row.original.status === 'BLOCKED' ? (
          <Box display="flex" gap={0.5}>
            <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => setApproveId(row.original.id)}>Aprovar</Button>
            <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />} onClick={() => setRejectId(row.original.id)}>Rejeitar</Button>
          </Box>
        ) : null,
    },
  ]

  const dpColumns: ColumnDef<Deposit, unknown>[] = [
    { accessorKey: 'createdAt', header: 'Data', cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string>())}</Typography> },
    { accessorKey: 'userNickname', header: 'Usuário' },
    { accessorKey: 'valueBrl', header: 'Valor BRL', cell: ({ getValue }) => <Typography fontWeight={600}>{fmtBrl(getValue<string>())}</Typography> },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusChip status={getValue<string>()} /> },
    { accessorKey: 'completedAt', header: 'Confirmado em', cell: ({ getValue }) => <Typography variant="caption">{fmtDate(getValue<string | null>())}</Typography> },
  ]

  return (
    <Box>
      <PageHeader
        title="Transações"
        action={
          hasRole('ADMIN') ? (
            <Button variant="outlined" color="warning" size="small" onClick={() => setRefundOpen(true)}>
              Reembolso Manual
            </Button>
          ) : undefined
        }
      />

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 2 }}>
          <Tab label="Extrato Geral" />
          <Tab label="Depósitos" />
          <Tab label="Saques" />
          {hasRole('FINANCEIRO') && <Tab label="Rake" />}
          {hasRole('FINANCEIRO') && <Tab label="Visão Financeira" />}
        </Tabs>

        <CardContent sx={{ p: 2 }}>
          {/* Extrato Geral */}
          {tab === 0 && (
            <DataTable data={txData} columns={txColumns} loading={txLoading} totalPages={txPages} page={txPage} onPageChange={setTxPage} />
          )}

          {/* Depósitos */}
          {tab === 1 && (
            <DataTable data={dpData} columns={dpColumns} loading={dpLoading} totalPages={dpPages} page={dpPage} onPageChange={setDpPage} />
          )}

          {/* Saques */}
          {tab === 2 && (
            <Box>
              <Box mb={2} display="flex" gap={2} alignItems="flex-end">
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Status</InputLabel>
                  <Select value={wdStatus} label="Status" onChange={(e) => { setWdStatus(e.target.value); setWdPage(1) }}>
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="PENDING">Pendente</MenuItem>
                    <MenuItem value="PROCESSING">Processando</MenuItem>
                    <MenuItem value="COMPLETED">Concluído</MenuItem>
                    <MenuItem value="BLOCKED">Bloqueado</MenuItem>
                    <MenuItem value="FAILED">Falhou</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {wdData.some((w) => w.status === 'BLOCKED') && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Existem saques bloqueados pelo anti-cheat aguardando revisão manual.
                </Alert>
              )}
              <DataTable data={wdData} columns={wdColumns} loading={wdLoading} totalPages={wdPages} page={wdPage} onPageChange={setWdPage} />
            </Box>
          )}

          {/* Rake */}
          {tab === rakeTabIndex && hasRole('FINANCEIRO') && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <FormControl size="small">
                  <InputLabel>Período</InputLabel>
                  <Select value={rakePeriod} label="Período" onChange={(e) => setRakePeriod(e.target.value)}>
                    <MenuItem value="7d">7 dias</MenuItem>
                    <MenuItem value="30d">30 dias</MenuItem>
                    <MenuItem value="90d">90 dias</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {rakeData.length > 0 ? (
                <BarChart data={rakeData} xKey="date" bars={[{ key: 'rakeCc', label: 'Rake (CC)', color: '#3D4AEB' }]} height={260} />
              ) : (
                <Typography color="text.secondary" textAlign="center" py={4}>Sem dados de rake para o período.</Typography>
              )}
            </Box>
          )}

          {/* Visão Financeira — FINANCEIRO+ */}
          {tab === financialTabIndex && hasRole('FINANCEIRO') && (
            <Box>
              {/* Period filter */}
              <Box display="flex" gap={1} mb={3} flexWrap="wrap">
                {[
                  { label: 'Últimos 7 dias', value: '7d' },
                  { label: 'Últimos 15 dias', value: '15d' },
                  { label: 'Último mês', value: '30d' },
                  { label: '3 meses', value: '90d' },
                  { label: 'Tudo', value: 'all' },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    size="small"
                    variant={financialPeriod === opt.value ? 'contained' : 'outlined'}
                    onClick={() => setFinancialPeriod(opt.value)}
                    sx={{ borderRadius: 4, textTransform: 'none' }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </Box>

              {financialLoading ? (
                <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
              ) : financial ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard
                      title="Total em Depósitos"
                      value={fmtBrl(financial.totalDeposits)}
                      icon={<TrendingUpIcon />}
                      color="#4caf50"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard
                      title="Total em Saques"
                      value={fmtBrl(financial.totalWithdrawals)}
                      icon={<TrendingDownIcon />}
                      color="#f44336"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard
                      title="Saldo em Carteiras"
                      value={fmtCc(financial.totalWalletBalance)}
                      icon={<AccountBalanceWalletIcon />}
                      color="#3D4AEB"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard
                      title="Total em Rakes"
                      value={fmtCc(financial.totalRake)}
                      icon={<PercentIcon />}
                      color="#ff9800"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard
                      title="Bônus de Indicação"
                      value={referralBonusStats ? `${fmtCc(referralBonusStats.totalEarned)} (${referralBonusStats.totalPayments} pgtos)` : '—'}
                      icon={<CardGiftcardIcon />}
                      color="#9c27b0"
                    />
                  </Grid>
                </Grid>
              ) : null}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Approve dialog */}
      <Dialog open={!!approveId} onClose={() => setApproveId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Aprovar saque</DialogTitle>
        <DialogContent><Typography>Confirmar aprovação? O PIX será enviado imediatamente.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveId(null)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={approve} disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={16} /> : 'Aprovar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onClose={() => setRejectId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rejeitar saque</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Typography mb={2}>Os CC serão estornados e o usuário será notificado.</Typography>
          <TextField label="Motivo da rejeição" fullWidth multiline rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectId(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={reject} disabled={!rejectReason || actionLoading}>
            {actionLoading ? <CircularProgress size={16} /> : 'Rejeitar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={refundOpen} onClose={() => setRefundOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reembolso Manual</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="ID do usuário" fullWidth value={refundUser} onChange={(e) => setRefundUser(e.target.value)} />
          <TextField label="Valor em CC" type="number" fullWidth value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} inputProps={{ min: 0.01, step: 0.01 }} />
          <TextField label="Motivo" fullWidth multiline rows={3} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" onClick={sendRefund} disabled={!refundUser || !refundAmount || !refundReason || actionLoading}>
            {actionLoading ? <CircularProgress size={16} /> : 'Aplicar Reembolso'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
