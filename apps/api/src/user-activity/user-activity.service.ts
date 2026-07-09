import { Injectable, Logger } from '@nestjs/common';
import { UserAction } from '../entities/user-activity-log.entity';
import { UserActivityLogRepository } from './user-activity-log.repository';
import { Request } from 'express';

@Injectable()
export class UserActivityService {
  private readonly logger = new Logger(UserActivityService.name);

  constructor(private readonly repo: UserActivityLogRepository) {}

  log(userId: string, action: UserAction, metadata?: object, req?: Request): void {
    this.repo
      .insert({
        userId,
        action,
        metadata: metadata ?? null,
        // req.ip is resolved by Express's trust-proxy logic (main.ts), which walks
        // X-Forwarded-For from the trusted-proxy side inward — never read the raw
        // header directly here, its leftmost entry is client-controlled/spoofable.
        ipAddress: req?.ip ?? null,
        userAgent: req?.headers['user-agent'] ?? null,
      })
      .catch((err) => this.logger.warn(`Failed to log activity ${action}: ${err?.message}`));
  }

  async getByUser(
    userId: string,
    page = 1,
    limit = 50,
    action?: UserAction,
  ) {
    const [items, total] = await this.repo.findByUser(userId, page, limit, action);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

}
