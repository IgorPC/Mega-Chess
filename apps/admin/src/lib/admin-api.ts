const BASE = '/api/v1/admin'
const PUBLIC_BASE = '/api/v1'

async function request<T>(path: string, options: RequestInit = {}, isPublic = false): Promise<T> {
  const token = localStorage.getItem('adminToken')
  const isFormData = options.body instanceof FormData
  const base = isPublic ? PUBLIC_BASE : BASE

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    if (token) {
      // Sessão expirada — força logout apenas se havia token ativo
      localStorage.removeItem('adminToken')
      localStorage.removeItem('admin')
      window.dispatchEvent(new CustomEvent('admin:logout'))
      throw new Error('Sessão expirada')
    }
    // Sem token = credenciais inválidas no login — propaga a mensagem da API
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || 'Credenciais inválidas')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { message?: string }).message || `HTTP ${res.status}`)
  }

  const text = await res.text()
  return text ? (JSON.parse(text) as T) : ({} as T)
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  auth: {
    requestOtp: (email: string, password: string) =>
      request<{ sent: boolean }>('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email, password }) }),
    verifyOtp: (email: string, code: string) =>
      request<{ accessToken: string; admin: import('../types').AdminUser; mustChangePassword: boolean }>(
        '/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, code }) }
      ),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<import('../types').AdminUser>('/auth/me'),
    changePassword: (newPassword: string, currentPassword?: string) =>
      request<void>('/me/password', { method: 'PATCH', body: JSON.stringify({ newPassword, ...(currentPassword ? { currentPassword } : {}) }) }),
  },

  // ── Dashboard ──────────────────────────────────────────────────────────────

  dashboard: {
    kpis: () => request<import('../types').DashboardKpis>('/dashboard/kpis'),
    topWinners: () => request<{ userId: string; nickname: string; totalGainedCc: string; winRate: number; riskLevel: string | null }[]>('/dashboard/top-winners'),
    alerts: () => request<{ id: string; severity: 'error' | 'warning' | 'info'; message: string }[]>('/dashboard/alerts'),
  },

  // ── Users ──────────────────────────────────────────────────────────────────

  users: {
    list: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').Player>>(`/users?${qs}`)
    },
    get: (id: string) => request<import('../types').Player & { walletBalance: string }>(`/users/${id}`),
    transactions: (id: string, page = 1) =>
      request<import('../types').Paginated<import('../types').WalletTransaction>>(`/users/${id}/transactions?page=${page}`),
    tickets: (id: string) => request<import('../types').SupportTicket[]>(`/users/${id}/tickets`),
    activity: (id: string, params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : ''
      return request<import('../types').Paginated<import('../types').UserActivityLog>>(`/users/${id}/activity?${qs}`)
    },
    sendMessage: (id: string, title: string, content: string) =>
      request<void>(`/users/${id}/message`, { method: 'POST', body: JSON.stringify({ title, content }) }),
    suspend: (id: string, reason: string, duration: string, notify: boolean) =>
      request<void>(`/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason, duration, notify }) }),
    forceLogout: (id: string) => request<void>(`/users/${id}/force-logout`, { method: 'POST' }),
    adjustElo: (id: string, newRating: number, reason: string) =>
      request<void>(`/users/${id}/elo`, { method: 'PATCH', body: JSON.stringify({ newRating, reason }) }),
    exportCsv: () => `${BASE}/users/export`,
  },

  // ── Transactions ───────────────────────────────────────────────────────────

  transactions: {
    list: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').WalletTransaction>>(`/transactions?${qs}`)
    },
    deposits: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').Deposit>>(`/deposits?${qs}`)
    },
    withdrawals: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').Withdrawal>>(`/withdrawals?${qs}`)
    },
    approveWithdrawal: (id: string) =>
      request<void>(`/withdrawals/${id}/approve`, { method: 'POST' }),
    rejectWithdrawal: (id: string, reason: string) =>
      request<void>(`/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
    refund: (userId: string, amountCc: number, reason: string) =>
      request<void>('/transactions/refund', { method: 'POST', body: JSON.stringify({ userId, amountCc, reason }) }),
    rakeSummary: (period: string) =>
      request<{ totalCc: string; chart: { date: string; rakeCc: string }[] }>(`/transactions/rake-summary?period=${period}`),
    financialSummary: (period = 'all') =>
      request<{ totalDeposits: string; totalWithdrawals: string; totalWalletBalance: string; totalRake: string }>(`/transactions/financial-summary?period=${period}`),
  },

  // ── Competitions ───────────────────────────────────────────────────────────

  duels: {
    list: (params: { view: 'active' | 'finished'; page?: number; limit?: number }) => {
      const qs = new URLSearchParams(params as unknown as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').AdminDuel>>(`/tournaments/duels?${qs}`)
    },
    get: (id: string) => request<import('../types').Tournament>(`/tournaments/${id}`),
    matches: (id: string) =>
      request<{ id: string; round: number; player1Nickname: string | null; player2Nickname: string | null; winnerNickname: string | null; status: string }[]>(
        `/tournaments/${id}/matches`
      ),
    matchMoves: (tmId: string) =>
      request<import('../types').DuelMatchMoves>(`/tournaments/matches/${tmId}/moves`),
    analyzeMatch: (tmId: string) =>
      request<import('../types').MoveAnalysisResult>(`/tournaments/matches/${tmId}/analyze`, { method: 'POST' }),
  },

  // ── Tournaments ────────────────────────────────────────────────────────────

  tournaments: {
    list: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').Tournament>>(`/tournaments?${qs}`)
    },
    get: (id: string) => request<import('../types').Tournament>(`/tournaments/${id}`),
    participants: (id: string) =>
      request<{ userId: string; nickname: string; avatarUrl: string | null; seed: number; finalPosition: number | null; eliminated: boolean }[]>(
        `/tournaments/${id}/participants`
      ),
    matches: (id: string) =>
      request<{ id: string; round: number; player1Nickname: string | null; player2Nickname: string | null; winnerNickname: string | null; status: string }[]>(
        `/tournaments/${id}/matches`
      ),
    create: (data: Record<string, unknown>) =>
      request<import('../types').Tournament>('/tournaments', { method: 'POST', body: JSON.stringify(data) }),
    start: (id: string) => request<void>(`/tournaments/${id}/start`, { method: 'POST' }),
    cancel: (id: string) => request<void>(`/tournaments/${id}/cancel`, { method: 'POST' }),
    removeParticipant: (id: string, userId: string) =>
      request<void>(`/tournaments/${id}/participants/${userId}`, { method: 'DELETE' }),
  },

  // ── Support ────────────────────────────────────────────────────────────────

  support: {
    list: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').SupportTicket>>(`/support/tickets?${qs}`)
    },
    get: (id: string) => request<import('../types').SupportTicket>(`/support/tickets/${id}`),
    messages: (id: string) =>
      request<import('../types').TicketMessage[]>(`/support/tickets/${id}/messages`),
    reply: (id: string, content: string, isInternal: boolean) =>
      request<import('../types').TicketMessage>(`/support/tickets/${id}/messages`, {
        method: 'POST', body: JSON.stringify({ content, isInternal }),
      }),
    updateStatus: (id: string, status: string) =>
      request<void>(`/support/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    assign: (id: string, adminId: string) =>
      request<void>(`/support/tickets/${id}/assign`, { method: 'POST', body: JSON.stringify({ adminId }) }),
    aiSummary: (id: string) =>
      request<{ summary: string }>(`/support/tickets/${id}/ai-summary`),
  },

  // ── Maintenance ────────────────────────────────────────────────────────────

  maintenance: {
    metrics: () => request<import('../types').AppMetrics>('/maintenance/metrics'),
    logs: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').SystemLog[]>(`/maintenance/logs?${qs}`)
    },
    config: () => request<Record<string, string | number | boolean>>('/maintenance/config'),
    updateConfig: (cfg: Record<string, string | number | boolean>) =>
      request<void>('/maintenance/config', { method: 'PUT', body: JSON.stringify(cfg) }),
    asaasStatus: () => request<{ ok: boolean; latencyMs: number }>('/maintenance/asaas-status'),
    broadcast: (message: string, type: string) =>
      request<void>('/maintenance/broadcast', { method: 'POST', body: JSON.stringify({ message, type }) }),
    flushRedis: () => request<void>('/maintenance/redis/flush', { method: 'POST' }),
  },

  // ── Staff ──────────────────────────────────────────────────────────────────

  staff: {
    list: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').AdminUser>>(`/staff?${qs}`)
    },
    create: (data: Record<string, unknown>) =>
      request<import('../types').AdminUser>('/staff', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<void>(`/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request<void>(`/staff/${id}/deactivate`, { method: 'POST' }),
    auditLogs: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').AuditLog>>(`/audit-logs?${qs}`)
    },
    exportAuditLogs: (params: Record<string, string>) => {
      const qs = new URLSearchParams(params).toString()
      return `${BASE}/audit-logs/export?${qs}`
    },
    userActivity: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').UserActivityLog>>(`/user-activity?${qs}`)
    },
  },

  // ── Match Reports ──────────────────────────────────────────────────────────

  matchReports: {
    list: (params: Record<string, string | number>) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString()
      return request<import('../types').Paginated<import('../types').MatchReport>>(`/match-reports?${qs}`)
    },
    getOne: (id: string) => request<any>(`/match-reports/${id}`),
    resolve: (id: string, resolution: string, adminNote?: string) =>
      request<void>(`/match-reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, adminNote }) }),
    analyze: (id: string) => request<any>(`/match-reports/${id}/analyze`, { method: 'POST' }),
  },

  // ── AI Usage ──────────────────────────────────────────────────────────────

  aiUsage: {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : ''
      return request<import('../types').Paginated<import('../types').AiUsageLog>>(`/maintenance/ai-usage?${qs}`)
    },
  },

  // ── IP Blacklist ───────────────────────────────────────────────────────────

  ipBlacklist: {
    list: (params?: { page?: number; limit?: number; ip?: string }) => {
      const qs = new URLSearchParams((params ?? {}) as Record<string, string>).toString()
      return request<{ data: import('../types').IpBlacklistEntry[]; total: number; page: number; totalPages: number }>(`/ip-blacklist?${qs}`)
    },
    add: (ip: string, reason?: string, expiresAt?: string) =>
      request<import('../types').IpBlacklistEntry>('/ip-blacklist', { method: 'POST', body: JSON.stringify({ ip, reason, expiresAt }) }),
    update: (ip: string, updates: { reason?: string | null; expiresAt?: string | null }) =>
      request<import('../types').IpBlacklistEntry>(`/ip-blacklist/${encodeURIComponent(ip)}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    remove: (ip: string) =>
      request<void>(`/ip-blacklist/${encodeURIComponent(ip)}`, { method: 'DELETE' }),
  },

  // ── Suggestions ───────────────────────────────────────────────────────────

  suggestions: {
    list: (params?: { page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string; authorId?: string }) => {
      const qs = new URLSearchParams((params ?? {}) as Record<string, string>).toString()
      return request<{
        items: {
          id: string; title: string; description: string; status: string;
          authorId: string; authorNickname: string; voteCount: number;
          adminNote: string | null; createdAt: string;
        }[];
        total: number; page: number; totalPages: number;
      }>(`/suggestions?${qs}`)
    },
    update: (id: string, status: string, adminNote?: string) =>
      request<void>(`/suggestions/${id}`, { method: 'PATCH', body: JSON.stringify({ status, ...(adminNote !== undefined ? { adminNote } : {}) }) }),
  },

  // ── Profile (self) ─────────────────────────────────────────────────────────

  // ── Referrals ─────────────────────────────────────────────────────────────────

  referrals: {
    list: (params?: { page?: number; limit?: number; referrerId?: string; isEligible?: boolean }) => {
      const p: Record<string, string> = {}
      if (params?.page !== undefined) p.page = String(params.page)
      if (params?.limit !== undefined) p.limit = String(params.limit)
      if (params?.referrerId) p.referrerId = params.referrerId
      if (params?.isEligible !== undefined) p.isEligible = String(params.isEligible)
      const qs = new URLSearchParams(p).toString()
      return request<{
        items: {
          id: string; referrerId: string; referrerNickname: string;
          referredId: string; referredNickname: string;
          isEligible: boolean; totalEarned: number; createdAt: string;
        }[];
        total: number; page: number; totalPages: number;
      }>(`/referrals?${qs}`)
    },
    stats: (period?: string) => {
      const qs = period && period !== 'all' ? `?period=${period}` : ''
      return request<{ totalEarned: number; totalPayments: number }>(`/referrals/stats${qs}`)
    },
  },

  // ── Profile (self) ────────────────────────────────────────────────────────────

  profile: {
    changePassword: (newPassword: string, currentPassword?: string) =>
      request<void>('/me/password', { method: 'PATCH', body: JSON.stringify({ newPassword, ...(currentPassword ? { currentPassword } : {}) }) }),
    mfaSetup: () => request<{ qrCodeDataUrl: string; secret: string }>('/me/mfa/setup', { method: 'POST' }),
    mfaConfirm: (code: string) => request<void>('/me/mfa/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  },
}
