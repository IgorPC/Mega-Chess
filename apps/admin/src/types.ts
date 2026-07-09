export type AdminRole = 'SUPORTE' | 'FINANCEIRO' | 'OPERADOR' | 'ADMIN'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminRole
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface PlatformConfig {
  key: string
  value: string
  description: string
  updatedAt: string
}

// ── Players ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  nickname: string
  email: string
  name: string
  avatarUrl: string | null
  rating: number
  isOnline: boolean
  bannedUntil: string | null
  bannedReason: string | null
  cpf: string | null
  pixKey: string | null
  asaasCustomerId: string | null
  createdAt: string
  lastLoginAt: string | null
}

export type PlayerStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED'

// ── Wallet / Transactions ────────────────────────────────────────────────────

export type TransactionType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_FEE'
  | 'TOURNAMENT_ENTRY'
  | 'PRIZE'
  | 'RAKE'
  | 'REFUND'

export type DepositStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'
export type WithdrawalStatus = 'PENDING' | 'ANALYZING' | 'PROCESSING' | 'COMPLETED' | 'BLOCKED' | 'FAILED'

export interface WalletTransaction {
  id: string
  userId: string
  userNickname: string
  type: TransactionType
  amount: string
  balanceAfter: string
  referenceId: string | null
  createdAt: string
}

export interface Deposit {
  id: string
  userId: string
  userNickname: string
  valueBrl: string
  status: DepositStatus
  createdAt: string
  completedAt: string | null
}

export interface Withdrawal {
  id: string
  userId: string
  userNickname: string
  valueCc: string
  valueBrl: string
  fee: string
  pixKey: string
  status: WithdrawalStatus
  blockReason: string | null
  riskScore: number | null
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null
  aiFlags: string[] | null
  createdAt: string
  completedAt: string | null
}

// ── Tournaments ──────────────────────────────────────────────────────────────

export type TournamentType = 'FAISCA' | 'TEMPESTADE' | 'GRANDE' | 'DUEL_FLASH' | 'DUEL_GIANT'
export type TournamentStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS'

export interface Tournament {
  id: string
  name: string
  status: TournamentStatus
  format: TournamentFormat
  buyIn: string
  prizePool: string
  maxPlayers: number
  registeredCount: number
  timeControl: string
  isRated: boolean
  startAt: string
  createdAt: string
}

export interface MoveTimestamp {
  san: string
  from: string
  to: string
  piece: string | null
  captured: string | null
  fen: string
  elapsed_ms: number
  clock_ms: number
  player: 'white' | 'black'
}

export interface DuelMatchMoves {
  id: string
  timeControl: string
  result: string | null
  whiteNickname: string | null
  blackNickname: string | null
  clockWhiteMs: number | null
  clockBlackMs: number | null
  moves: MoveTimestamp[]
  aiAnalysis: MoveAnalysisResult | null
}

export interface MoveAnalysisResult {
  verdict: 'CLEAN' | 'SUSPICIOUS' | 'CHEATING' | 'NO_DATA' | 'ERROR'
  confidence?: number
  suspicious: boolean
  summary?: string
  explanation: string
  flags?: string[]
  whiteAnalysis?: { avgElapsedMs: number; minElapsedMs: number; suspiciousMovesCount: number; notes: string }
  blackAnalysis?: { avgElapsedMs: number; minElapsedMs: number; suspiciousMovesCount: number; notes: string }
}

export interface AdminDuel {
  id: string
  type: 'DUEL_FLASH' | 'DUEL_GIANT'
  timeControl: string
  entryFee: number
  prizePool: number
  rake: number
  maxPlayers: number
  status: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  winnerNickname: string | null
}

// ── Support ──────────────────────────────────────────────────────────────────

export type TicketCategory = 'PAYMENT' | 'MATCH' | 'ACCOUNT' | 'TECHNICAL' | 'OTHER'
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_USER' | 'CLOSED'
export type TicketCloseReason =
  | 'RESOLVED'
  | 'NOT_REPRODUCIBLE'
  | 'DUPLICATE'
  | 'NO_RESPONSE'
  | 'FRAUD'

export interface SupportTicket {
  id: string
  userId: string
  userNickname: string
  userEmail: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  title: string
  assignedToId: string | null
  assignedToName: string | null
  slaDeadline: string | null
  closeReason: TicketCloseReason | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  lastReplyAt: string | null
}

export interface TicketMessage {
  id: string
  ticketId: string
  senderType: 'USER' | 'ADMIN'
  senderRole: 'USER' | AdminRole
  senderId: string
  senderName: string
  content: string
  isInternal: boolean
  createdAt: string
  attachments: TicketAttachment[]
}

export interface TicketAttachment {
  id: string
  messageId: string
  filename: string
  originalName: string
  mimeType: string
  fileSizeKb: number
  createdAt: string
}

// ── System ───────────────────────────────────────────────────────────────────

export type LogLevel = 'ERROR' | 'WARN'

export interface SystemLog {
  id: string
  level: LogLevel
  context: string
  message: string
  stackTrace: string | null
  requestId: string | null
  createdAt: string
}

export interface AppMetrics {
  cpuUsage: number
  memoryUsageMb: number
  requestsPerSecond: number
  errorsPerHour: number
  activeGames: number
  wsConnections: number
  uptimeSeconds: number
  dbSizeMb: number
  requestsHistory: { time: string; count: number }[] | null
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  newUsersToday: number
  activeUsersToday: number
  onlineNow: number
  matchesToday: number
  ongoingMatches: number
  tournamentsToday: number
  openTicketsToday: number
  depositsToday: string
  withdrawalsToday: string
  rakeToday: string
  blockedWithdrawals: number
  totalWalletBalance: string
}

// ── Match Reports ────────────────────────────────────────────────────────────

export type MatchReportVerdict = 'CLEAN' | 'SUSPICIOUS' | 'CHEATING'
export type MatchReportStatus = 'ANALYZING' | 'COMPLETED' | 'UNDER_REVIEW' | 'RESOLVED'
export type MatchReportResolution = 'DISMISSED' | 'WARNED' | 'SUSPENDED' | 'BANNED'

export interface MatchReport {
  id: string
  matchId: string
  reporterId: string
  reporterNickname: string
  reportedUserId: string
  reportedNickname: string
  reporterNote: string | null
  aiVerdict: MatchReportVerdict | null
  aiConfidence: number | null
  aiFlags: string[] | null
  aiExplanation: string | null
  status: MatchReportStatus
  resolution: MatchReportResolution | null
  resolvedBy: string | null
  resolvedAt: string | null
  adminNote: string | null
  createdAt: string
}

// ── User Activity ────────────────────────────────────────────────────────────

export interface UserActivityLog {
  id: string
  userId: string
  action: string
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

// ── AI Usage ────────────────────────────────────────────────────────────────

export interface AiUsageLog {
  id: string
  feature: string
  model: string
  promptTokens: number
  outputTokens: number
  costUsd: string
  referenceId: string | null
  createdAt: string
}

// ── Pagination ───────────────────────────────────────────────────────────────

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
}

// ── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  adminId: string
  adminName: string
  action: string
  targetType: string | null
  targetId: string | null
  details: string | null
  ipAddress: string | null
  createdAt: string
}

export interface IpBlacklistEntry {
  id: string
  ip: string
  reason: string | null
  blockedBy: string | null
  blockedByName: string | null
  expiresAt: string | null
  createdAt: string
}
