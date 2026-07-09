import { useState, useEffect, useCallback } from 'react'
import {
  Box, Card, CardContent, Grid, Typography, Alert, Button,
  TextField, Switch, FormControlLabel, Chip, Divider,
  CircularProgress, Snackbar, Tab, Tabs,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import BroadcastOnPersonalIcon from '@mui/icons-material/BroadcastOnPersonal'
import { PageHeader } from '../../components/ui/PageHeader'
import { LineChart } from '../../components/charts/LineChart'
import { adminApi } from '../../lib/admin-api'
import { useAdminAuth } from '../../store/admin-auth.store'
import type { AppMetrics, SystemLog } from '../../types'

function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR') }

export function MaintenancePage() {
  const { hasRole } = useAdminAuth()
  const [tab, setTab] = useState(0)
  const [metrics, setMetrics] = useState<AppMetrics | null>(null)
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [asaasStatus, setAsaasStatus] = useState<{ ok: boolean; latencyMs: number } | null>(null)
  const [snack, setSnack] = useState('')
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'error'>('info')
  const [broadcastLoading, setBroadcastLoading] = useState(false)

  // Config state
  const [cfg, setCfg] = useState({
    maintenanceMode: false,
    maxConcurrentGames: '200',
    withdrawalDailyLimitCc: '10000',
    depositMinBrl: '10',
    depositMaxBrl: '5000',
    aiAnalysisEnabled: true,
    depositsEnabled: true,
    withdrawalsEnabled: true,
    referralsEnabled: true,
  })
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgLoaded, setCfgLoaded] = useState(false)

  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true)
    try {
      const [m, l, a] = await Promise.all([
        adminApi.maintenance.metrics(),
        adminApi.maintenance.logs({ limit: 50 }),
        adminApi.maintenance.asaasStatus(),
      ])
      setMetrics(m)
      setLogs(l)
      setAsaasStatus(a)
    } catch { /* ignore */ }
    finally { setLoadingMetrics(false) }
  }, [])

  const loadConfig = useCallback(async () => {
    if (cfgLoaded) return
    try {
      const c = await adminApi.maintenance.config()
      setCfg((prev) => ({ ...prev, ...(c as typeof prev) }))
      setCfgLoaded(true)
    } catch { /* ignore */ }
  }, [cfgLoaded])

  useEffect(() => { void loadMetrics() }, [loadMetrics])
  useEffect(() => { void loadConfig() }, [loadConfig])

  const saveConfig = async () => {
    setSavingCfg(true)
    try {
      await adminApi.maintenance.updateConfig(cfg)
      setSnack('Configurações salvas.')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setSavingCfg(false) }
  }

  const sendBroadcast = async () => {
    setBroadcastLoading(true)
    try {
      await adminApi.maintenance.broadcast(broadcastMsg, broadcastType)
      setBroadcastMsg('')
      setSnack('Broadcast enviado a todos os usuários online.')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
    finally { setBroadcastLoading(false) }
  }

  const flushRedis = async () => {
    try {
      await adminApi.maintenance.flushRedis()
      setSnack('Cache Redis limpo.')
    } catch (e) { setSnack(e instanceof Error ? e.message : 'Erro') }
  }

  const metricsChartData = metrics
    ? [
        { name: 'CPU', value: metrics.cpuUsage },
        { name: 'RAM', value: metrics.memoryUsageMb },
        { name: 'Req/s', value: metrics.requestsPerSecond },
        { name: 'Erros/h', value: metrics.errorsPerHour },
      ]
    : []

  return (
    <Box>
      <PageHeader
        title="Manutenção"
        action={
          <Button variant="outlined" startIcon={loadingMetrics ? <CircularProgress size={14} /> : <RefreshIcon />} size="small" onClick={loadMetrics}>
            Atualizar
          </Button>
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Métricas" />
        <Tab label="Logs de Erros" />
        <Tab label="Configurações" />
        <Tab label="Comunicação" />
      </Tabs>

      {/* Métricas */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {/* Asaas status */}
          <Grid item xs={12}>
            {asaasStatus ? (
              <Alert severity={asaasStatus.ok ? 'success' : 'error'}>
                Asaas: {asaasStatus.ok ? `Operacional (${asaasStatus.latencyMs}ms)` : 'Fora do ar! Pagamentos indisponíveis.'}
              </Alert>
            ) : null}
          </Grid>

          {metrics && (
            <>
              {[
                { label: 'CPU', value: `${metrics.cpuUsage.toFixed(1)}%`, color: metrics.cpuUsage > 80 ? 'error.main' : 'success.main' },
                { label: 'Memória', value: `${metrics.memoryUsageMb} MB`, color: 'text.primary' },
                { label: 'Req/s', value: metrics.requestsPerSecond.toString(), color: 'text.primary' },
                { label: 'Partidas ativas', value: metrics.activeGames.toString(), color: 'text.primary' },
                { label: 'Conexões WS', value: metrics.wsConnections.toString(), color: 'text.primary' },
                { label: 'Erros/hora', value: metrics.errorsPerHour.toString(), color: metrics.errorsPerHour > 10 ? 'error.main' : 'success.main' },
              ].map(({ label, value, color }) => (
                <Grid item xs={6} sm={4} md={2} key={label}>
                  <Card>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="h5" fontWeight={700} color={color}>{value}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}

              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" mb={2}>Histórico de requisições (últimas 24h)</Typography>
                    {metrics.requestsHistory?.length ? (
                      <LineChart
                        data={metrics.requestsHistory}
                        xKey="time"
                        lines={[{ key: 'count', label: 'Req/s', color: '#3D4AEB' }]}
                        height={200}
                      />
                    ) : <Typography variant="caption" color="text.secondary">Sem dados de histórico.</Typography>}
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      )}

      {/* Logs */}
      {tab === 1 && (
        <Card>
          <CardContent>
            <Box display="flex" flexDirection="column" gap={0.5} sx={{ fontFamily: 'monospace', fontSize: 12 }}>
              {logs.length === 0 && <Typography color="text.secondary">Nenhum log registrado.</Typography>}
              {logs.map((log) => (
                <Box
                  key={log.id}
                  display="flex"
                  gap={2}
                  py={0.5}
                  px={1}
                  sx={{ bgcolor: log.level === 'ERROR' ? 'error.dark' : log.level === 'WARN' ? 'warning.dark' : 'transparent', borderRadius: 0.5 }}
                >
                  <Typography variant="caption" color="text.secondary" flexShrink={0}>{fmtDate(log.createdAt)}</Typography>
                  <Chip label={log.level} size="small" color={log.level === 'ERROR' ? 'error' : log.level === 'WARN' ? 'warning' : 'default'} sx={{ fontFamily: 'monospace' }} />
                  <Typography variant="caption" flex={1} sx={{ wordBreak: 'break-word' }}>{log.message}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Configurações */}
      {tab === 2 && hasRole('ADMIN') && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" mb={2}>Configurações da Plataforma</Typography>
            <Box display="flex" flexDirection="column" gap={2} maxWidth={500}>
              <FormControlLabel
                control={<Switch checked={cfg.maintenanceMode} onChange={(e) => setCfg((c) => ({ ...c, maintenanceMode: e.target.checked }))} color="error" />}
                label={<Box><Typography fontWeight={600}>Modo manutenção</Typography><Typography variant="caption" color="text.secondary">Bloqueia login de jogadores</Typography></Box>}
              />
              <FormControlLabel
                control={<Switch checked={cfg.aiAnalysisEnabled} onChange={(e) => setCfg((c) => ({ ...c, aiAnalysisEnabled: e.target.checked }))} />}
                label="Análise IA de partidas habilitada"
              />
              <FormControlLabel
                control={<Switch checked={cfg.depositsEnabled} onChange={(e) => setCfg(c => ({ ...c, depositsEnabled: e.target.checked }))} color="warning" />}
                label={<Box><Typography fontWeight={600}>Habilitar Depósitos</Typography><Typography variant="caption" color="text.secondary">Desmarcar bloqueia todos os depósitos PIX</Typography></Box>}
              />
              <FormControlLabel
                control={<Switch checked={cfg.withdrawalsEnabled} onChange={(e) => setCfg(c => ({ ...c, withdrawalsEnabled: e.target.checked }))} color="warning" />}
                label={<Box><Typography fontWeight={600}>Habilitar Saques</Typography><Typography variant="caption" color="text.secondary">Desmarcar bloqueia todos os saques</Typography></Box>}
              />
              <FormControlLabel
                control={<Switch checked={cfg.referralsEnabled} onChange={(e) => setCfg(c => ({ ...c, referralsEnabled: e.target.checked }))} />}
                label={<Box><Typography fontWeight={600}>Habilitar Sistema de Indicações</Typography><Typography variant="caption" color="text.secondary">Desmarcar desativa bônus de indicação</Typography></Box>}
              />
              <Divider />
              <TextField label="Max. partidas simultâneas" value={cfg.maxConcurrentGames} onChange={(e) => setCfg((c) => ({ ...c, maxConcurrentGames: e.target.value }))} type="number" size="small" />
              <TextField label="Limite diário saque (CC)" value={cfg.withdrawalDailyLimitCc} onChange={(e) => setCfg((c) => ({ ...c, withdrawalDailyLimitCc: e.target.value }))} type="number" size="small" />
              <TextField label="Depósito mínimo (R$)" value={cfg.depositMinBrl} onChange={(e) => setCfg((c) => ({ ...c, depositMinBrl: e.target.value }))} type="number" size="small" />
              <TextField label="Depósito máximo (R$)" value={cfg.depositMaxBrl} onChange={(e) => setCfg((c) => ({ ...c, depositMaxBrl: e.target.value }))} type="number" size="small" />
              <Button variant="contained" onClick={saveConfig} disabled={savingCfg} sx={{ alignSelf: 'flex-start' }}>
                {savingCfg ? <CircularProgress size={16} /> : 'Salvar configurações'}
              </Button>

              <Divider />
              <Box>
                <Typography variant="subtitle2" mb={1}>Cache Redis</Typography>
                <Button variant="outlined" color="warning" onClick={flushRedis}>Limpar cache Redis</Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Comunicação / Broadcast */}
      {tab === 3 && (
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <BroadcastOnPersonalIcon color="primary" />
              <Typography variant="subtitle1">Broadcast Global</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Envia uma notificação para todos os usuários online via WebSocket.
            </Typography>
            <Box display="flex" flexDirection="column" gap={2} maxWidth={500}>
              <Box display="flex" gap={1}>
                {(['info', 'warning', 'error'] as const).map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    color={t === 'info' ? 'primary' : t}
                    variant={broadcastType === t ? 'filled' : 'outlined'}
                    onClick={() => setBroadcastType(t)}
                    clickable
                  />
                ))}
              </Box>
              <TextField
                label="Mensagem do broadcast"
                fullWidth
                multiline
                rows={3}
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                inputProps={{ maxLength: 300 }}
                helperText={`${broadcastMsg.length}/300`}
              />
              <Button
                variant="contained"
                color={broadcastType === 'error' ? 'error' : 'primary'}
                disabled={!broadcastMsg.trim() || broadcastLoading}
                onClick={sendBroadcast}
                startIcon={broadcastLoading ? <CircularProgress size={16} /> : <BroadcastOnPersonalIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                Enviar Broadcast
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')} message={snack} />
    </Box>
  )
}
