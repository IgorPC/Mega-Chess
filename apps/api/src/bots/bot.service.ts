import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'child_process';
import { Chess } from 'chess.js';
import {
  BotDifficulty,
  DEPTH,
  DELAY_MS,
  MIN_DELAY_MS,
  CLOCK_URGENCY_THRESHOLD_MS,
  STOCKFISH_MOVE_TIMEOUT_MS,
  DEFAULT_STOCKFISH_PATH,
} from './consts/bot.consts';

export { BotDifficulty };

function computeDelay(difficulty: BotDifficulty, remainingClockMs?: number): number {
  const [min, max] = DELAY_MS[difficulty];
  const base = min + Math.random() * (max - min);
  if (!remainingClockMs || remainingClockMs >= CLOCK_URGENCY_THRESHOLD_MS) return base;
  const urgencyFactor = remainingClockMs / CLOCK_URGENCY_THRESHOLD_MS;
  return Math.max(MIN_DELAY_MS, base * urgencyFactor);
}

@Injectable()
export class BotService implements OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly stockfishPath: string;
  private engines = new Map<string, ChildProcess>();
  private stockfishAvailable: boolean | null = null; // null = untested

  /** Tracks which bot user IDs are currently in an active match */
  private activeBotUserIds = new Set<string>();

  markBotActive(botId: string) { this.activeBotUserIds.add(botId); }
  markBotIdle(botId: string)   { this.activeBotUserIds.delete(botId); }
  isActive(botId: string)      { return this.activeBotUserIds.has(botId); }
  getActiveBotIds()            { return this.activeBotUserIds; }

  constructor(config: ConfigService) {
    this.stockfishPath = config.get<string>('STOCKFISH_PATH') ?? DEFAULT_STOCKFISH_PATH;
  }

  onModuleDestroy() {
    for (const [, engine] of this.engines) {
      try { engine.kill(); } catch {}
    }
    this.engines.clear();
  }

  async getMove(botId: string, fen: string, difficulty: BotDifficulty): Promise<string> {
    if (this.stockfishAvailable === false) {
      return this.randomMove(fen);
    }
    try {
      return await Promise.race([
        this.stockfishMove(botId, fen, difficulty),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), STOCKFISH_MOVE_TIMEOUT_MS)),
      ]);
    } catch (err) {
      this.logger.debug(`[bot] Stockfish unavailable, using chess.js fallback: ${err}`);
      this.stockfishAvailable = false;
      this.destroyEngine(botId);
      return this.randomMove(fen);
    }
  }

  private stockfishMove(botId: string, fen: string, difficulty: BotDifficulty): Promise<string> {
    return new Promise((resolve, reject) => {
      const engine = this.getOrCreateEngine(botId);
      if (!engine) { reject(new Error('no engine')); return; }

      const depth = DEPTH[difficulty];
      let buffer = '';

      const onData = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('bestmove')) {
            engine.stdout?.off('data', onData);
            engine.stderr?.off('data', onErr);
            const parts = line.trim().split(' ');
            const move = parts[1];
            if (!move || move === '(none)') { reject(new Error('no move')); return; }
            resolve(move);
          }
        }
      };

      const onErr = (data: Buffer) => {
        this.logger.debug(`[bot] stockfish stderr: ${data.toString().trim()}`);
      };

      engine.stdout?.on('data', onData);
      engine.stderr?.on('data', onErr);
      engine.stdin?.write(`position fen ${fen}\n`);
      engine.stdin?.write(`go depth ${depth}\n`);
    });
  }

  private getOrCreateEngine(botId: string): ChildProcess | null {
    const existing = this.engines.get(botId);
    if (existing && !existing.killed) return existing;

    try {
      const proc = spawn(this.stockfishPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      proc.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          if (this.stockfishAvailable !== false) {
            this.logger.debug(`[bot] stockfish not found at ${this.stockfishPath}, using chess.js fallback`);
            this.stockfishAvailable = false;
          }
        } else {
          this.logger.debug(`[bot] stockfish process error for ${botId}: ${err.message}`);
        }
        this.engines.delete(botId);
      });
      proc.on('exit', () => this.engines.delete(botId));
      proc.stdin?.write('uci\nisready\n');
      this.engines.set(botId, proc);
      this.stockfishAvailable = true;
      return proc;
    } catch (err) {
      this.logger.debug(`[bot] Failed to spawn stockfish at ${this.stockfishPath}: ${err}`);
      this.stockfishAvailable = false;
      return null;
    }
  }

  private destroyEngine(botId: string) {
    const engine = this.engines.get(botId);
    if (engine) { try { engine.kill(); } catch {} }
    this.engines.delete(botId);
  }

  private randomMove(fen: string): string {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    if (!moves.length) throw new Error('no legal moves');
    const m = moves[Math.floor(Math.random() * moves.length)];
    return `${m.from}${m.to}${m.promotion ?? ''}`;
  }

  /** Fire-and-forget: schedules a bot move after a human-like delay, then calls applyMove. */
  scheduleMove(
    matchId: string,
    botId: string,
    difficulty: BotDifficulty,
    fen: string,
    remainingClockMs: number | undefined,
    applyMove: (uci: string) => Promise<void>,
  ): void {
    const delay = computeDelay(difficulty, remainingClockMs);
    setTimeout(async () => {
      try {
        const uci = await this.getMove(botId, fen, difficulty);
        await applyMove(uci);
      } catch (err) {
        this.logger.error(`[bot] scheduleMove failed matchId=${matchId}: ${err}`);
      }
    }, delay);
  }
}
