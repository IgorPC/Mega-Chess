import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformConfig } from './entities/platform-config.entity';

@Injectable()
export class PlatformConfigRepository {
  constructor(
    @InjectRepository(PlatformConfig)
    private readonly repo: Repository<PlatformConfig>,
  ) {}

  find(): Promise<PlatformConfig[]> {
    return this.repo.find();
  }

  upsert(key: string, value: string, updatedBy?: string | null): Promise<unknown> {
    return this.repo.upsert({ key, value, updatedBy: updatedBy ?? null }, ['key']);
  }
}
