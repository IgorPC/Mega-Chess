import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLog, AiFeature } from '../entities/ai-usage-log.entity';

@Injectable()
export class AiUsageLogRepository {
  constructor(
    @InjectRepository(AiUsageLog) private readonly repo: Repository<AiUsageLog>,
  ) {}

  async logUsage(
    feature: AiFeature,
    model: string,
    promptTokens: number,
    outputTokens: number,
    costUsd: string,
    referenceId?: string,
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({
        feature,
        model,
        promptTokens,
        outputTokens,
        costUsd,
        referenceId: referenceId ?? null,
      }),
    );
  }
}
