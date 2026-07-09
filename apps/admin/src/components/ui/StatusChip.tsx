import { Chip } from '@mui/material'
import type { ChipProps } from '@mui/material'

type StatusVariant =
  | 'ACTIVE' | 'SUSPENDED' | 'BANNED'
  | 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'FAILED' | 'CANCELLED'
  | 'ANALYZING' | 'PROCESSING' | 'BLOCKED'
  | 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'CLOSED'
  | 'REGISTERING' | 'IN_PROGRESS_T' | 'FINISHED'
  | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  | 'CLEAN' | 'SUSPICIOUS' | 'CHEATING'
  | 'RESOLVED' | 'UNDER_REVIEW'
  | 'ERROR' | 'WARN'
  | string

const COLOR_MAP: Record<string, ChipProps['color']> = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  FINISHED: 'success',
  CLEAN: 'success',
  RESOLVED: 'success',
  CLOSED: 'default',
  LOW: 'success',
  SUSPENDED: 'warning',
  PENDING: 'warning',
  ANALYZING: 'warning',
  PROCESSING: 'warning',
  REGISTERING: 'info',
  IN_PROGRESS: 'info',
  IN_PROGRESS_T: 'info',
  OPEN: 'info',
  WAITING_USER: 'warning',
  UNDER_REVIEW: 'warning',
  WARN: 'warning',
  MEDIUM: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
  BANNED: 'error',
  BLOCKED: 'error',
  FAILED: 'error',
  EXPIRED: 'default',
  CANCELLED: 'default',
  SUSPICIOUS: 'warning',
  CHEATING: 'error',
  ERROR: 'error',
}

const LABEL_MAP: Record<string, string> = {
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  BANNED: 'Banido',
  PENDING: 'Pendente',
  COMPLETED: 'Concluído',
  EXPIRED: 'Expirado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
  ANALYZING: 'Analisando',
  PROCESSING: 'Processando',
  BLOCKED: 'Bloqueado',
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em Progresso',
  IN_PROGRESS_T: 'Em Progresso',
  WAITING_USER: 'Aguardando',
  CLOSED: 'Encerrado',
  REGISTERING: 'Inscrições',
  FINISHED: 'Finalizado',
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
  CLEAN: 'Limpo',
  SUSPICIOUS: 'Suspeito',
  CHEATING: 'Trapaça',
  RESOLVED: 'Resolvido',
  UNDER_REVIEW: 'Em Revisão',
  ERROR: 'Erro',
  WARN: 'Aviso',
}

interface StatusChipProps {
  status: StatusVariant
  size?: ChipProps['size']
}

export function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const color = COLOR_MAP[status] ?? 'default'
  const label = LABEL_MAP[status] ?? status

  return <Chip label={label} color={color} size={size} sx={{ fontWeight: 600 }} />
}
