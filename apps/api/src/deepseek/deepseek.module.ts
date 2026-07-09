import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { DeepseekService } from './deepseek.service';
import { AiUsageLogRepository } from './ai-usage-log.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLog])],
  providers: [DeepseekService, AiUsageLogRepository],
  exports: [DeepseekService],
})
export class DeepseekModule {}
