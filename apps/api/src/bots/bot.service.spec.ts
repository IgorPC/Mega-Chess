import { EventEmitter } from 'events';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BotService } from './bot.service';
import { MIN_DELAY_MS, CLOCK_URGENCY_THRESHOLD_MS } from './consts/bot.consts';

class FakeChildProcess extends EventEmitter {
  stdin = { write: jest.fn() };
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill = jest.fn(() => { this.killed = true; });
}

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
}));

describe('BotService', () => {
  let service: BotService;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(BotService);
    config = module.get(ConfigService);
  });

  describe('active bot tracking', () => {
    it('marks a bot active and idle', () => {
      expect(service.isActive('bot-1')).toBe(false);
      service.markBotActive('bot-1');
      expect(service.isActive('bot-1')).toBe(true);
      expect(service.getActiveBotIds().has('bot-1')).toBe(true);
      service.markBotIdle('bot-1');
      expect(service.isActive('bot-1')).toBe(false);
    });
  });

  describe('getMove - stockfish happy path', () => {
    it('resolves with the bestmove parsed from stdout', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getMove('bot-1', 'startpos', 'MEDIUM');
      // allow spawn callbacks/microtasks to settle
      await Promise.resolve();
      proc.stdout.emit('data', Buffer.from('info depth 1\n'));
      proc.stdout.emit('data', Buffer.from('bestmove e2e4 ponder e7e5\n'));

      const move = await promise;
      expect(move).toBe('e2e4');
      expect(proc.stdin.write).toHaveBeenCalledWith('position fen startpos\n');
      expect(proc.stdin.write).toHaveBeenCalledWith('go depth 6\n');
    });

    it('reuses an existing non-killed engine for the same bot', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);

      const p1 = service.getMove('bot-1', 'fen1', 'EASY');
      await Promise.resolve();
      proc.stdout.emit('data', Buffer.from('bestmove a2a3\n'));
      await p1;

      const p2 = service.getMove('bot-1', 'fen2', 'EASY');
      await Promise.resolve();
      proc.stdout.emit('data', Buffer.from('bestmove b2b3\n'));
      await p2;

      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it('rejects and falls back when bestmove is (none)', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getMove('bot-1', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', 'HARD');
      await Promise.resolve();
      proc.stdout.emit('data', Buffer.from('bestmove (none)\n'));

      const move = await promise;
      // falls back to chess.js random move since stockfishMove rejected
      expect(typeof move).toBe('string');
      expect(move.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('getMove - stockfish unavailable (ENOENT fallback)', () => {
    it('falls back to chess.js random move when spawn errors with ENOENT', async () => {
      jest.useFakeTimers();
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);

      const promise = service.getMove(
        'bot-2',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'EASY',
      );
      await Promise.resolve();
      const err: any = new Error('spawn ENOENT');
      err.code = 'ENOENT';
      proc.emit('error', err);

      jest.advanceTimersByTime(10_001);
      const move = await promise;
      expect(typeof move).toBe('string');
      expect(move.length).toBeGreaterThanOrEqual(4);
      jest.useRealTimers();
    }, 15000);

    it('short-circuits to randomMove once stockfishAvailable is false', async () => {
      jest.useFakeTimers();
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);

      const p1 = service.getMove(
        'bot-3',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'EASY',
      );
      await Promise.resolve();
      const err: any = new Error('spawn ENOENT');
      err.code = 'ENOENT';
      proc.emit('error', err);
      jest.advanceTimersByTime(10_001);
      await p1;
      jest.useRealTimers();

      mockSpawn.mockClear();
      const move = await service.getMove(
        'bot-3',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'EASY',
      );
      expect(typeof move).toBe('string');
      expect(mockSpawn).not.toHaveBeenCalled();
    }, 15000);

    it('throws when there are no legal moves for randomMove fallback', async () => {
      // checkmate position: no legal moves
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(null as any);

      await expect(
        service.getMove('bot-4', 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', 'EASY'),
      ).rejects.toThrow();
    });

    it('falls back when spawn throws synchronously', async () => {
      mockSpawn.mockImplementation(() => { throw new Error('spawn failure'); });

      const move = await service.getMove(
        'bot-5',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'EASY',
      );
      expect(typeof move).toBe('string');
    });
  });

  describe('scheduleMove', () => {
    it('applies the move returned by getMove after the computed delay', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);
      const applyMove = jest.fn().mockResolvedValue(undefined);
      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementationOnce((fn: any) => { fn(); return 0 as any; });

      service.scheduleMove('match-1', 'bot-1', 'EASY', 'fen', undefined, applyMove);
      setTimeoutSpy.mockRestore();
      await new Promise((r) => setImmediate(r));
      proc.stdout.emit('data', Buffer.from('bestmove d2d4\n'));
      await new Promise((r) => setImmediate(r));

      expect(applyMove).toHaveBeenCalledWith('d2d4');
    });

    it('logs an error and does not throw when applyMove rejects', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);
      const applyMove = jest.fn().mockRejectedValue(new Error('apply failed'));
      const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementationOnce((fn: any) => { fn(); return 0 as any; });

      service.scheduleMove('match-1', 'bot-1', 'EASY', 'fen', undefined, applyMove);
      setTimeoutSpy.mockRestore();
      await new Promise((r) => setImmediate(r));
      proc.stdout.emit('data', Buffer.from('bestmove d2d4\n'));
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('kills all tracked engines and clears the map', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);

      const p = service.getMove('bot-1', 'fen', 'EASY');
      await Promise.resolve();
      proc.stdout.emit('data', Buffer.from('bestmove a2a3\n'));
      await p;

      service.onModuleDestroy();
      expect(proc.kill).toHaveBeenCalled();
    });

    it('does not throw if engine.kill() throws', () => {
      const proc = new FakeChildProcess();
      proc.kill = jest.fn(() => { throw new Error('kill failed'); });
      mockSpawn.mockReturnValue(proc);
      (service as any).engines.set('bot-x', proc);

      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('computeDelay via scheduleMove timing', () => {
    it('uses at least MIN_DELAY_MS when clock is urgent', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);
      const applyMove = jest.fn().mockResolvedValue(undefined);
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      service.scheduleMove('match-1', 'bot-1', 'HARD', 'fen', 100, applyMove);

      const delayArg = setTimeoutSpy.mock.calls[0][1] as number;
      expect(delayArg).toBeGreaterThanOrEqual(MIN_DELAY_MS);
      setTimeoutSpy.mockRestore();
    });

    it('uses base delay range when clock is not urgent (above threshold)', async () => {
      const proc = new FakeChildProcess();
      mockSpawn.mockReturnValue(proc);
      const applyMove = jest.fn().mockResolvedValue(undefined);
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      service.scheduleMove('match-1', 'bot-1', 'HARD', 'fen', CLOCK_URGENCY_THRESHOLD_MS + 1000, applyMove);

      const delayArg = setTimeoutSpy.mock.calls[0][1] as number;
      expect(delayArg).toBeGreaterThanOrEqual(150);
      expect(delayArg).toBeLessThanOrEqual(600);
      setTimeoutSpy.mockRestore();
    });

    it('uses base delay range when remainingClockMs is undefined', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
      service.scheduleMove('match-1', 'bot-1', 'EASY', 'fen', undefined, jest.fn().mockResolvedValue(undefined));
      const delayArg = setTimeoutSpy.mock.calls[0][1] as number;
      expect(delayArg).toBeGreaterThanOrEqual(750);
      expect(delayArg).toBeLessThanOrEqual(2000);
      setTimeoutSpy.mockRestore();
    });
  });

  describe('constructor', () => {
    it('uses STOCKFISH_PATH from config when provided', async () => {
      config.get.mockReturnValue('/custom/stockfish');
      const module = await Test.createTestingModule({
        providers: [BotService, { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('/custom/stockfish') } }],
      }).compile();
      const svc = module.get(BotService);
      expect((svc as any).stockfishPath).toBe('/custom/stockfish');
    });
  });
});
