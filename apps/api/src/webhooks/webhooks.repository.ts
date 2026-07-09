import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AsaasEvent } from './entities/asaas-event.entity';

@Injectable()
export class WebhooksRepository {
  constructor(
    @InjectRepository(AsaasEvent) private readonly repo: Repository<AsaasEvent>,
  ) {}

  async insertEvent(asaasEventId: string, eventType: string): Promise<void> {
    await this.repo.insert({ asaasEventId, eventType });
  }
}
