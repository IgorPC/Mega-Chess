import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLog } from '../../entities/ai-usage-log.entity';
import { PlatformConfig } from '../../platform-config/entities/platform-config.entity';

@Injectable()
export class AdminMaintenanceRepository {
  constructor(
    @InjectRepository(AiUsageLog)     private aiLogs: Repository<AiUsageLog>,
    @InjectRepository(PlatformConfig) private cfgRepo: Repository<PlatformConfig>,
  ) {}

  async getDbSizeBytes(): Promise<number> {
    const raw = await this.cfgRepo.manager.query(
      'SELECT pg_database_size(current_database()) AS size',
    ) as [{ size: string }];
    return parseInt(raw[0]?.size ?? '0');
  }

  findAllConfig(): Promise<PlatformConfig[]> {
    return this.cfgRepo.find();
  }

  async findAndCountAiUsageLogs(page: number, limit: number) {
    const [data, total] = await this.aiLogs.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }
}
