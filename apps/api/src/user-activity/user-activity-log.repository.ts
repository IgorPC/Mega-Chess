import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivityLog, UserAction } from '../entities/user-activity-log.entity';

interface InsertActivityLogParams {
  userId: string;
  action: UserAction;
  metadata: object | null;
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class UserActivityLogRepository {
  constructor(
    @InjectRepository(UserActivityLog)
    private readonly repo: Repository<UserActivityLog>,
  ) {}

  insert(params: InsertActivityLogParams) {
    return this.repo.insert(params);
  }

  async findByUser(userId: string, page: number, limit: number, action?: UserAction) {
    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.user_id = :userId', { userId })
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (action) qb.andWhere('log.action = :action', { action });

    return qb.getManyAndCount();
  }
}
