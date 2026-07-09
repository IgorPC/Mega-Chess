export const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
export const MODEL = 'deepseek-v4-flash';

// Pricing per 1M tokens (cache miss)
export const INPUT_PRICE_PER_M = 0.14;
export const OUTPUT_PRICE_PER_M = 0.28;

export const ANALYZE_TIMEOUT_MS = 30_000;
export const STREAM_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_TOKENS = 500;
export const STREAM_MAX_TOKENS = 400;
export const LOG_PREVIEW_LENGTH = 300;
