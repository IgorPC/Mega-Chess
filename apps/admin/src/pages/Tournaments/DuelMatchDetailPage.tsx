import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Alert,
  CircularProgress, Divider, Paper, LinearProgress, Tooltip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PsychologyIcon from '@mui/icons-material/Psychology'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningIcon from '@mui/icons-material/Warning'
import GppBadIcon from '@mui/icons-material/GppBad'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import { PageHeader } from '../../components/ui/PageHeader'
import { adminApi } from '../../lib/admin-api'
import type { DuelMatchMoves, MoveAnalysisResult, MoveTimestamp } from '../../types'

function fmtMs(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtClock(ms: number | null) {
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

const RESULT_LABELS: Record<string, { label: string; color: 'default' | 'success' | 'error' | 'warning' | 'info' }> = {
  WHITE_WINS:    { label: 'Vitória das Brancas (xeque-mate)',  color: 'success' },
  BLACK_WINS:    { label: 'Vitória das Pretas (xeque-mate)',   color: 'success' },
  DRAW:          { label: 'Empate',                             color: 'info'    },
  FORFEIT_WHITE: { label: 'Desistência das Brancas',           color: 'warning' },
  FORFEIT_BLACK: { label: 'Desistência das Pretas',            color: 'warning' },
  TIMEOUT_WHITE: { label: 'Derrota das Brancas por tempo',     color: 'error'   },
  TIMEOUT_BLACK: { label: 'Derrota das Pretas por tempo',      color: 'error'   },
}

function ResultChip({ result }: { result: string | null }) {
  if (!result) return <Typography variant="body2" color="text.secondary">Em andamento</Typography>
  const cfg = RESULT_LABELS[result] ?? { label: result, color: 'default' as const }
  return <Chip label={cfg.label} size="small" color={cfg.color} />
}

function pieceLabel(p: string | null) {
  const map: Record<string, string> = { p: '♟ Peão', n: '♞ Cavalo', b: '♝ Bispo', r: '♜ Torre', q: '♛ Rainha', k: '♚ Rei' }
  return p ? (map[p] ?? p) : '—'
}

function ElapsedChip({ ms }: { ms: number }) {
  const color = ms < 1500 ? 'error' : ms < 3000 ? 'warning' : 'default'
  return <Chip label={fmtMs(ms)} size="small" color={color} variant={color !== 'default' ? 'filled' : 'outlined'} />
}

function VerdictBanner({ result }: { result: MoveAnalysisResult }) {
  const config = {
    CLEAN:     { color: 'success' as const, icon: <CheckCircleIcon />, label: 'Limpo' },
    SUSPICIOUS:{ color: 'warning' as const, icon: <WarningIcon />,     label: 'Suspeito' },
    CHEATING:  { color: 'error'   as const, icon: <GppBadIcon />,      label: 'Trapaça detectada' },
    NO_DATA:   { color: 'info'    as const, icon: <HelpOutlineIcon />, label: 'Sem dados' },
    ERROR:     { color: 'info'    as const, icon: <HelpOutlineIcon />, label: 'Erro' },
  }
  const cfg = config[result.verdict] ?? config.NO_DATA

  return (
    <Alert
      severity={cfg.color === 'success' ? 'success' : cfg.color === 'warning' ? 'warning' : cfg.color === 'error' ? 'error' : 'info'}
      icon={cfg.icon}
      sx={{ mb: 2 }}
    >
      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
        <Typography fontWeight={700}>{cfg.label}</Typography>
        {result.confidence != null && (
          <Chip label={`Confiança: ${result.confidence}%`} size="small" />
        )}
      </Box>
      {result.summary && <Typography variant="body2" mt={0.5}>{result.summary}</Typography>}
    </Alert>
  )
}

function PlayerStats({ label, moves, analysis }: {
  label: string
  moves: MoveTimestamp[]
  analysis?: MoveAnalysisResult['whiteAnalysis']
}) {
  if (!moves.length) return null
  const avg = Math.round(moves.reduce((s, m) => s + m.elapsed_ms, 0) / moves.length)
  const min = Math.min(...moves.map(m => m.elapsed_ms))
  const fast = moves.filter(m => m.elapsed_ms < 1500).length

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={700} mb={1}>{label}</Typography>
      <Grid container spacing={1}>
        {[
          ['Jogadas', moves.length],
          ['Tempo médio', fmtMs(analysis?.avgElapsedMs ?? avg)],
          ['Tempo mínimo', fmtMs(analysis?.minElapsedMs ?? min)],
          ['Jogadas < 1.5s', analysis?.suspiciousMovesCount ?? fast],
        ].map(([k, v]) => (
          <Grid item xs={6} key={String(k)}>
            <Typography variant="caption" color="text.secondary">{k}</Typography>
            <Typography fontWeight={600}>{v}</Typography>
          </Grid>
        ))}
      </Grid>
      {analysis?.notes && (
        <Typography variant="body2" color="text.secondary" mt={1}>{analysis.notes}</Typography>
      )}
    </Paper>
  )
}

function MovesTable({ moves, label }: { moves: MoveTimestamp[]; label: string }) {
  const [expanded, setExpanded] = useState(false)
  const displayed = expanded ? moves : moves.slice(0, 20)

  if (!moves.length) return null

  return (
    <Box>
      <Typography fontWeight={600} mb={1}>{label} ({moves.length} jogadas)</Typography>
      <Table size="small" sx={{ mb: 1 }}>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Jogada</TableCell>
            <TableCell>Peça</TableCell>
            <TableCell>De → Para</TableCell>
            <TableCell>Captura</TableCell>
            <TableCell>Tempo gasto</TableCell>
            <TableCell>Relógio restante</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {displayed.map((m, i) => (
            <TableRow key={i} sx={{ bgcolor: m.elapsed_ms < 1500 ? 'error.main' : 'inherit', '&:hover': { opacity: 0.9 } }}>
              <TableCell>{i + 1}</TableCell>
              <TableCell><Typography fontFamily="monospace" fontWeight={700}>{m.san}</Typography></TableCell>
              <TableCell>{pieceLabel(m.piece)}</TableCell>
              <TableCell>
                <Typography fontFamily="monospace" variant="body2">{m.from} → {m.to}</Typography>
              </TableCell>
              <TableCell>{m.captured ? pieceLabel(m.captured) : '—'}</TableCell>
              <TableCell><ElapsedChip ms={m.elapsed_ms} /></TableCell>
              <TableCell>
                <Tooltip title={`${m.clock_ms}ms`}>
                  <Typography variant="body2">{fmtClock(m.clock_ms)}</Typography>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {moves.length > 20 && (
        <Button size="small" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Mostrar menos' : `Ver todas as ${moves.length} jogadas`}
        </Button>
      )}
    </Box>
  )
}

export function DuelMatchDetailPage() {
  const { tmId } = useParams<{ tmId: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<DuelMatchMoves | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<MoveAnalysisResult | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tmId) return
    setLoading(true)
    try {
      const res = await adminApi.duels.matchMoves(tmId)
      setData(res)
      if (res.aiAnalysis) setAnalysis(res.aiAnalysis)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [tmId])

  useEffect(() => { void load() }, [load])

  const handleAnalyze = async () => {
    if (!tmId) return
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const res = await adminApi.duels.analyzeMatch(tmId)
      setAnalysis(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na análise de IA')
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
  if (error && !data) return <Alert severity="error">{error}</Alert>
  if (!data) return null

  const whiteMoves = data.moves.filter(m => m.player === 'white')
  const blackMoves = data.moves.filter(m => m.player === 'black')

  return (
    <Box>
      <PageHeader
        title="Detalhes da Partida"
        action={
          <Box display="flex" gap={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} variant="outlined" size="small">
              Voltar
            </Button>
            <Button
              variant={analysis ? 'outlined' : 'contained'}
              startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : <PsychologyIcon />}
              onClick={handleAnalyze}
              disabled={analyzing || !data.moves.length}
              color="secondary"
              size="small"
            >
              {analyzing ? 'Analisando...' : analysis ? 'Re-analisar com IA' : 'Analisar com IA'}
            </Button>
          </Box>
        }
      />

      {analyzing && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Info header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4} textAlign={{ sm: 'right' }}>
              <Typography variant="h6" fontWeight={700}>{data.whiteNickname ?? '—'}</Typography>
              <Typography variant="caption" color="text.secondary">Brancas · {fmtClock(data.clockWhiteMs)}</Typography>
            </Grid>
            <Grid item xs={12} sm={4} textAlign="center">
              <Chip label={data.timeControl} variant="outlined" sx={{ mb: 0.5 }} />
              <ResultChip result={data.result} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="h6" fontWeight={700}>{data.blackNickname ?? '—'}</Typography>
              <Typography variant="caption" color="text.secondary">Pretas · {fmtClock(data.clockBlackMs)}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* AI Analysis result */}
      {analysis && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={2} display="flex" alignItems="center" gap={1}>
              <PsychologyIcon /> Análise de IA
            </Typography>
            <VerdictBanner result={analysis} />

            {analysis.explanation && (
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>{analysis.explanation}</Typography>
            )}

            {analysis.flags && analysis.flags.length > 0 && (
              <Box mb={2}>
                <Typography fontWeight={600} mb={1}>Sinais identificados</Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {analysis.flags.map((f, i) => (
                    <Chip key={i} label={f} size="small" color="warning" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <PlayerStats
                  label={`Brancas — ${data.whiteNickname ?? '?'}`}
                  moves={whiteMoves}
                  analysis={analysis.whiteAnalysis}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <PlayerStats
                  label={`Pretas — ${data.blackNickname ?? '?'}`}
                  moves={blackMoves}
                  analysis={analysis.blackAnalysis}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Move history */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700} mb={2}>Histórico de Jogadas</Typography>
          {!data.moves.length ? (
            <Alert severity="info">Esta partida não possui histórico de jogadas registrado. Apenas partidas de duelo/torneio com relógio registram o histórico.</Alert>
          ) : (
            <Box display="flex" flexDirection="column" gap={3}>
              <PlayerStats label={`Brancas — ${data.whiteNickname ?? '?'}`} moves={whiteMoves} />
              <Divider />
              <MovesTable moves={whiteMoves} label={`Jogadas das Brancas — ${data.whiteNickname ?? '?'}`} />
              <Divider />
              <PlayerStats label={`Pretas — ${data.blackNickname ?? '?'}`} moves={blackMoves} />
              <Divider />
              <MovesTable moves={blackMoves} label={`Jogadas das Pretas — ${data.blackNickname ?? '?'}`} />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
