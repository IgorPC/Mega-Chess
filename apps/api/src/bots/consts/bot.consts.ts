export type BotDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export const DEPTH: Record<BotDifficulty, number> = { EASY: 2, MEDIUM: 6, HARD: 14 };

export const DELAY_MS: Record<BotDifficulty, [number, number]> = {
  EASY:   [750, 2000],
  MEDIUM: [400, 1250],
  HARD:   [150,  600],
};

export const MIN_DELAY_MS = 2000;
export const CLOCK_URGENCY_THRESHOLD_MS = 30_000;

export const STOCKFISH_MOVE_TIMEOUT_MS = 10_000;
export const DEFAULT_STOCKFISH_PATH = '/usr/bin/stockfish';
