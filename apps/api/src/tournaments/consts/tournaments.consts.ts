export const STAGNATION_WARN_MS  = 24 * 60 * 60 * 1000;  // 24h sem novos jogadores
export const STAGNATION_KILL_MS  = 48 * 60 * 60 * 1000;  // 48h → cancel automático
export const AI_FRAUD_TIMEOUT_MS = 60 * 60 * 1000;        // 60 min SLA análise IA
export const NEXT_MATCH_DELAY_MS = 30_000;                 // 30s entre rodadas
export const DUEL_INVITE_TTL_MS  = 60_000;

export const STAGNATION_CHECK_INTERVAL_MS = 30 * 60 * 1000; // verifica stagnation a cada 30 min
