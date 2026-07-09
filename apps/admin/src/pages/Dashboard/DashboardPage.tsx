import { useEffect, useState, useCallback } from 'react'
import {
  Grid, Card, CardContent, Typography, Box, Alert, AlertTitle,
  Chip, IconButton, Tooltip, CircularProgress,
} from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import BlockIcon from '@mui/icons-material/Block'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import RefreshIcon from '@mui/icons-material/Refresh'
import { PageHeader } from '../../components/ui/PageHeader'
import { KpiCard } from '../../components/charts/KpiCard'
import { BarChart } from '../../components/charts/BarChart'
import { RiskBadge } from '../../components/ui/RiskBadge'
import { adminApi } from '../../lib/admin-api'
import { useAdminAuth } from '../../store/admin-auth.store'
import type { DashboardKpis } from '../../types'

function fmtCC(v: string | number) { return `${Number(v).toFixed(2)} CC` }

export function DashboardPage() {
  const { hasRole } = useAdminAuth()
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [winners, setWinners] = useState<{ userId: string; nickname: string; totalGainedCc: string; winRate: number; riskLevel: string | null }[]>([])
  const [alerts, setAlerts] = useState<{ id: string; severity: 'error' | 'warning' | 'info'; message: string }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [k, w, a] = await Promise.all([
        adminApi.dashboard.kpis(),
        hasRole('OPERADOR') ? adminApi.dashboard.topWinners() : Promise.resolve([]),
        adminApi.dashboard.alerts(),
      ])
      setKpis(k)
      setWinners(w)
      setAlerts(a)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [hasRole])

  useEffect(() => { void load() }, [load])

  // Auto-refresh online count every 30s
  useEffect(() => {
    const id = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(id)
  }, [load])

  const mockVolumeData = [
    { dia: 'Seg', depositos: 120, saques: 80 },
    { dia: 'Ter', depositos: 95, saques: 60 },
    { dia: 'Qua', depositos: 140, saques: 90 },
    { dia: 'Qui', depositos: 110, saques: 75 },
    { dia: 'Sex', depositos: 200, saques: 130 },
    { dia: 'Sab', depositos: 180, saques: 110 },
    { dia: 'Dom', depositos: 160, saques: 100 },
  ]

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        action={
          <Tooltip title="Atualizar">
            <IconButton onClick={load} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        }
      />

      {/* Alerts */}
      {alerts.map((a) => (
        <Alert key={a.id} severity={a.severity} sx={{ mb: 1.5 }}>
          {a.message}
        </Alert>
      ))}

      {/* KPIs — Jogadores (todos os roles) */}
      <Typography variant="overline" color="text.secondary" display="block" mb={1}>
        Jogadores — Hoje
      </Typography>
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Novos cadastros" value={kpis?.newUsersToday ?? 0} icon={PeopleIcon} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Ativos hoje" value={kpis?.activeUsersToday ?? 0} icon={PeopleIcon} color="#2e7d32" loading={loading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Online agora" value={kpis?.onlineNow ?? 0} icon={PeopleIcon} color="#e6a817" loading={loading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Partidas hoje" value={kpis?.matchesToday ?? 0} icon={SportsEsportsIcon} loading={loading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Em andamento" value={kpis?.ongoingMatches ?? 0} icon={SportsEsportsIcon} color="#2e7d32" loading={loading} />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <KpiCard title="Tickets hoje" value={kpis?.openTicketsToday ?? 0} icon={SupportAgentIcon} color="#B15653" loading={loading} />
        </Grid>
      </Grid>

      {/* KPIs Financeiros */}
      {hasRole('FINANCEIRO') && (
        <>
          <Typography variant="overline" color="text.secondary" display="block" mb={1}>
            Financeiro — Hoje
          </Typography>
          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={4} md={2}>
              <KpiCard title="Depósitos" value={fmtCC(kpis?.depositsToday ?? 0)} icon={AccountBalanceWalletIcon} loading={loading} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <KpiCard title="Saques" value={fmtCC(kpis?.withdrawalsToday ?? 0)} icon={AccountBalanceWalletIcon} color="#B15653" loading={loading} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <KpiCard title="Rake" value={fmtCC(kpis?.rakeToday ?? 0)} icon={TrendingUpIcon} color="#2e7d32" loading={loading} />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <KpiCard
                title="Saques bloqueados"
                value={kpis?.blockedWithdrawals ?? 0}
                icon={BlockIcon}
                color={kpis && kpis.blockedWithdrawals > 0 ? '#B15653' : '#2e7d32'}
                loading={loading}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={4}>
              <KpiCard title="Saldo total em wallets" value={fmtCC(kpis?.totalWalletBalance ?? 0)} icon={AccountBalanceWalletIcon} color="#e6a817" loading={loading} />
            </Grid>
          </Grid>
        </>
      )}

      {/* Charts + Widgets */}
      <Grid container spacing={2}>
        {hasRole('FINANCEIRO') && (
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" mb={2}>Volume Financeiro (7 dias)</Typography>
                <BarChart
                  data={mockVolumeData}
                  xKey="dia"
                  bars={[
                    { key: 'depositos', label: 'Depósitos', color: '#3D4AEB' },
                    { key: 'saques', label: 'Saques', color: '#B15653' },
                  ]}
                />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Top Winners */}
        {hasRole('OPERADOR') && winners.length > 0 && (
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" mb={2}>🏆 Top Ganhadores da Semana</Typography>
                <Box display="flex" flexDirection="column" gap={1.5}>
                  {winners.map((w, i) => (
                    <Box key={w.userId} display="flex" alignItems="center" gap={1.5}>
                      <Typography color="text.secondary" fontSize={13} width={20}>#{i + 1}</Typography>
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight={600}>{w.nickname}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Win rate: {(w.winRate * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="body2" fontWeight={700} color="success.main">
                          {fmtCC(w.totalGainedCc)}
                        </Typography>
                        <RiskBadge level={w.riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Saques bloqueados */}
        {hasRole('FINANCEIRO') && kpis && kpis.blockedWithdrawals > 0 && (
          <Grid item xs={12}>
            <Alert severity="error">
              <AlertTitle>⚠️ {kpis.blockedWithdrawals} saque(s) bloqueado(s) aguardando revisão manual</AlertTitle>
              Acesse <strong>Transações → Saques Bloqueados</strong> para aprovar ou rejeitar.
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
