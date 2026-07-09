import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLogRepository } from './ai-usage-log.repository';
import { AiUsageLog, AiFeature } from '../entities/ai-usage-log.entity';

describe('AiUsageLogRepository', () => {
  let repository: AiUsageLogRepository;
  let ormRepo: jest.Mocked<Repository<AiUsageLog>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiUsageLogRepository,
        {
          provide: getRepositoryToken(AiUsageLog),
          useValue: { create: jest.fn((v) => v), save: jest.fn() },
        },
      ],
    }).compile();

    repository = module.get(AiUsageLogRepository);
    ormRepo = module.get(getRepositoryToken(AiUsageLog));
  });

  describe('logUsage', () => {
    it('creates and saves a usage log entry with the given fields', async () => {
      await repository.logUsage(AiFeature.MATCH_ANALYSIS, 'deepseek-v4-flash', 100, 50, '0.00002100', 'match-1');

      expect(ormRepo.create).toHaveBeenCalledWith({
        feature: AiFeature.MATCH_ANALYSIS,
        model: 'deepseek-v4-flash',
        promptTokens: 100,
        outputTokens: 50,
        costUsd: '0.00002100',
        referenceId: 'match-1',
      });
      expect(ormRepo.save).toHaveBeenCalled();
    });

    it('defaults referenceId to null when not provided', async () => {
      await repository.logUsage(AiFeature.MATCH_ANALYSIS, 'deepseek-v4-flash', 10, 5, '0.00000100');

      expect(ormRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ referenceId: null }),
      );
    });
  });
});
