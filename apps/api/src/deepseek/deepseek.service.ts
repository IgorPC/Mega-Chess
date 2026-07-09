import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiFeature } from '../entities/ai-usage-log.entity';
import { AiUsageLogRepository } from './ai-usage-log.repository';
import {
  DEEPSEEK_BASE,
  MODEL,
  INPUT_PRICE_PER_M,
  OUTPUT_PRICE_PER_M,
  ANALYZE_TIMEOUT_MS,
  STREAM_TIMEOUT_MS,
  DEFAULT_MAX_TOKENS,
  STREAM_MAX_TOKENS,
  LOG_PREVIEW_LENGTH,
} from './consts/config';

interface DeepseekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepseekResponse {
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly apiKey: string;

  constructor(
    config: ConfigService,
    private readonly usageLogs: AiUsageLogRepository,
  ) {
    this.apiKey = config.get<string>('DEEPSEEK_API_KEY') ?? '';
  }

  get isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async analyze<T>(
    feature: AiFeature,
    systemPrompt: string,
    userPrompt: string,
    referenceId?: string,
    maxTokens = DEFAULT_MAX_TOKENS,
  ): Promise<T | null> {
    if (!this.isAvailable) {
      this.logger.warn(`DeepSeek not configured — skipping ${feature}`);
      return null;
    }

    const messages: DeepseekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(ANALYZE_TIMEOUT_MS),
      });

      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`DeepSeek ${feature} → ${res.status}: ${text}`);
        return null;
      }

      const data = (await res.json()) as DeepseekResponse;
      const usage = data.usage;
      const finishReason = data.choices[0]?.finish_reason;

      this.logUsage(feature, usage.prompt_tokens, usage.completion_tokens, referenceId).catch(
        (err) => this.logger.warn(`Failed to log AI usage feature=${feature}`, err instanceof Error ? err.message : String(err)),
      );

      if (finishReason === 'length') {
        this.logger.warn(
          `DeepSeek ${feature} hit max_tokens (${maxTokens}) — response truncated, JSON.parse will likely fail. Increase maxTokens.`,
        );
      }

      const raw = data.choices[0].message.content;
      try {
        return JSON.parse(raw) as T;
      } catch {
        this.logger.error(`DeepSeek ${feature} — JSON.parse failed. finish_reason=${finishReason}. Raw (first ${LOG_PREVIEW_LENGTH}): ${raw.slice(0, LOG_PREVIEW_LENGTH)}`);
        return null;
      }
    } catch (err) {
      this.logger.error(`DeepSeek ${feature} failed: ${err}`);
      return null;
    }
  }

  async *streamChat(
    systemPrompt: string,
    messages: DeepseekMessage[],
  ): AsyncGenerator<string> {
    if (!this.isAvailable) return;

    const body = JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: STREAM_MAX_TOKENS,
    });

    const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
    });

    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        const trimmed = line.replace(/^data: /, '').trim();
        if (!trimmed || trimmed === '[DONE]') continue;
        try {
          const parsed = JSON.parse(trimmed);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // ignore malformed SSE lines
        }
      }
    }
  }

  private async logUsage(
    feature: AiFeature,
    promptTokens: number,
    outputTokens: number,
    referenceId?: string,
  ) {
    const costUsd =
      (promptTokens * INPUT_PRICE_PER_M + outputTokens * OUTPUT_PRICE_PER_M) / 1_000_000;

    await this.usageLogs.logUsage(
      feature,
      MODEL,
      promptTokens,
      outputTokens,
      costUsd.toFixed(8),
      referenceId,
    );
  }
}
