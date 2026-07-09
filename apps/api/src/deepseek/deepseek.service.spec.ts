import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DeepseekService } from './deepseek.service';
import { AiUsageLogRepository } from './ai-usage-log.repository';
import { AiFeature } from '../entities/ai-usage-log.entity';

function chatResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

/** Builds a fake streaming Response whose body yields the given raw SSE chunks. */
function sseResponse(chunks: string[], ok = true): Response {
  let i = 0;
  const reader = {
    read: jest.fn(() => {
      if (i < chunks.length) {
        const chunk = chunks[i++];
        return Promise.resolve({ done: false, value: new TextEncoder().encode(chunk) });
      }
      return Promise.resolve({ done: true, value: undefined });
    }),
  };
  return {
    ok,
    body: ok ? { getReader: () => reader } : null,
  } as unknown as Response;
}

async function drain<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe('DeepseekService', () => {
  let fetchMock: jest.Mock;
  let usageLogs: jest.Mocked<AiUsageLogRepository>;

  async function buildService(apiKey: string | undefined) {
    const module = await Test.createTestingModule({
      providers: [
        DeepseekService,
        { provide: ConfigService, useValue: { get: jest.fn(() => apiKey) } },
        { provide: AiUsageLogRepository, useValue: { logUsage: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    usageLogs = module.get(AiUsageLogRepository);
    return module.get(DeepseekService);
  }

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isAvailable', () => {
    it('is false when no API key is configured', async () => {
      const service = await buildService('');
      expect(service.isAvailable).toBe(false);
    });

    it('is true when an API key is configured', async () => {
      const service = await buildService('sk-test');
      expect(service.isAvailable).toBe(true);
    });
  });

  describe('analyze', () => {
    it('returns null immediately without calling the API when not configured', async () => {
      const service = await buildService('');
      const result = await service.analyze(AiFeature.MATCH_ANALYSIS, 'system', 'user');
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('parses and returns the JSON content on success, and logs usage', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(chatResponse({
        choices: [{ message: { content: '{"verdict":"CLEAN"}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }));

      const result = await service.analyze<{ verdict: string }>(AiFeature.MATCH_ANALYSIS, 'sys', 'user', 'match-1');

      expect(result).toEqual({ verdict: 'CLEAN' });
      // logUsage is fire-and-forget; flush microtasks so the assertion sees it.
      await Promise.resolve();
      expect(usageLogs.logUsage).toHaveBeenCalledWith(
        AiFeature.MATCH_ANALYSIS, expect.any(String), 100, 20, expect.any(String), 'match-1',
      );
    });

    it('returns null when the HTTP response is not ok', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(chatResponse({ error: 'bad request' }, 400));

      const result = await service.analyze(AiFeature.MATCH_ANALYSIS, 'sys', 'user');

      expect(result).toBeNull();
    });

    it('returns null when the response content is not valid JSON', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(chatResponse({
        choices: [{ message: { content: 'not json{{' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }));

      const result = await service.analyze(AiFeature.MATCH_ANALYSIS, 'sys', 'user');

      expect(result).toBeNull();
    });

    it('still attempts to parse but tolerates a truncated response (finish_reason "length")', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(chatResponse({
        choices: [{ message: { content: '{"incomplete":' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 10, completion_tokens: 500 },
      }));

      const result = await service.analyze(AiFeature.MATCH_ANALYSIS, 'sys', 'user');

      expect(result).toBeNull();
    });

    it('returns null when the fetch call throws (network error or timeout)', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockRejectedValue(new Error('timeout'));

      const result = await service.analyze(AiFeature.MATCH_ANALYSIS, 'sys', 'user');

      expect(result).toBeNull();
    });

    it('does not throw when logging usage fails in the background', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(chatResponse({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }));
      usageLogs.logUsage.mockRejectedValue(new Error('db down'));

      const result = await service.analyze(AiFeature.MATCH_ANALYSIS, 'sys', 'user');

      expect(result).toEqual({ ok: true });
    });
  });

  describe('streamChat', () => {
    it('yields nothing and makes no request when not configured', async () => {
      const service = await buildService('');
      const chunks = await drain(service.streamChat('sys', []));
      expect(chunks).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('yields nothing when the response is not ok', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(sseResponse([], false));

      const chunks = await drain(service.streamChat('sys', []));

      expect(chunks).toEqual([]);
    });

    it('yields decoded delta content from well-formed SSE lines', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(sseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\ndata: [DONE]\n',
      ]));

      const chunks = await drain(service.streamChat('sys', [{ role: 'user', content: 'hi' }]));

      expect(chunks).toEqual(['Hel', 'lo']);
    });

    it('silently skips malformed SSE lines', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(sseResponse([
        'data: not-json\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n',
      ]));

      const chunks = await drain(service.streamChat('sys', []));

      expect(chunks).toEqual(['ok']);
    });

    it('skips chunks with no delta content', async () => {
      const service = await buildService('sk-test');
      fetchMock.mockResolvedValue(sseResponse([
        'data: {"choices":[{"delta":{}}]}\n',
        '\n',
      ]));

      const chunks = await drain(service.streamChat('sys', []));

      expect(chunks).toEqual([]);
    });
  });
});
