import { Chip } from '@mui/material'

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const CONFIG: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  LOW:      { label: '🟢 Baixo',   color: '#2e7d32', bg: 'rgba(46,125,50,0.15)' },
  MEDIUM:   { label: '🟡 Médio',   color: '#e6a817', bg: 'rgba(230,168,23,0.15)' },
  HIGH:     { label: '🔴 Alto',    color: '#B15653', bg: 'rgba(177,86,83,0.15)' },
  CRITICAL: { label: '🚨 Crítico', color: '#f44336', bg: 'rgba(244,67,54,0.2)' },
}

export function RiskBadge({ level }: { level: RiskLevel | null | undefined }) {
  if (!level) return <span style={{ color: '#8B8CA7' }}>—</span>
  const { label, color, bg } = CONFIG[level]
  return (
    <Chip
      label={label}
      size="small"
      sx={{ fontWeight: 700, color, backgroundColor: bg, border: `1px solid ${color}` }}
    />
  )
}
