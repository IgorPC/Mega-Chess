import {
  Injectable, Logger, ConflictException, NotFoundException, OnApplicationBootstrap,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { IpBlacklist } from '../../entities/ip-blacklist.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminAuditService } from '../admin-audit.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { IP_BLACKLIST_PREFIX } from '../../common/middleware/ip-blacklist.middleware';
import type Redis from 'ioredis';
import { AdminIpBlacklistRepository } from './admin-ip-blacklist.repository';
import {
  ADMIN_IP_BLACKLIST_MAX_LIMIT,
  ADMIN_IP_BLACKLIST_PERMANENT_TTL_SECONDS,
} from './consts/endpoints';

@Injectable()
export class AdminIpBlacklistService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminIpBlacklistService.name);

  constructor(
    private readonly repo: AdminIpBlacklistRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly audit: AdminAuditService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedRedisFromDb();
  }

  async list(page = 1, limit = 25, ip?: string) {
    limit = Math.min(limit, ADMIN_IP_BLACKLIST_MAX_LIMIT);
    const { data, total } = await this.repo.findPage(page, limit, ip);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async add(
    ip: string,
    reason: string | null,
    expiresAt: Date | null,
    admin: Pick<AdminUser, 'id' | 'name'>,
    reqIp: string,
  ) {
    const existing = await this.repo.findByIp(ip);
    if (existing) throw new ConflictException(`IP ${ip} is already blacklisted`);

    const entry = this.repo.create({ ip, reason, expiresAt, blockedBy: admin.id, blockedByName: admin.name });
    await this.repo.save(entry);
    await this.syncToRedis(entry);

    this.audit.log(admin, 'IP_BLACKLISTED', {
      targetType: 'ip',
      targetId: ip,
      details: JSON.stringify({ reason, expiresAt }),
      ip: reqIp,
    });

    this.logger.log(`IP blacklisted ip=${ip} by admin=${admin.id} expiresAt=${expiresAt ?? 'permanent'}`);
    return entry;
  }

  async update(
    ip: string,
    updates: { reason?: string | null; expiresAt?: Date | null },
    admin: Pick<AdminUser, 'id' | 'name'>,
    reqIp: string,
  ) {
    const entry = await this.repo.findByIp(ip);
    if (!entry) throw new NotFoundException(`IP ${ip} not found in blacklist`);

    if (updates.reason !== undefined) entry.reason = updates.reason;
    if (updates.expiresAt !== undefined) entry.expiresAt = updates.expiresAt;

    await this.repo.save(entry);
    await this.syncToRedis(entry);

    this.audit.log(admin, 'IP_BLACKLIST_UPDATED', {
      targetType: 'ip',
      targetId: ip,
      details: JSON.stringify(updates),
      ip: reqIp,
    });

    return entry;
  }

  async remove(ip: string, admin: Pick<AdminUser, 'id' | 'name'>, reqIp: string) {
    const entry = await this.repo.findByIp(ip);
    if (!entry) throw new NotFoundException(`IP ${ip} not found in blacklist`);

    await this.repo.remove(entry);
    await this.redis.del(`${IP_BLACKLIST_PREFIX}${ip}`);

    this.audit.log(admin, 'IP_UNBLACKLISTED', {
      targetType: 'ip',
      targetId: ip,
      ip: reqIp,
    });

    this.logger.log(`IP removed from blacklist ip=${ip} by admin=${admin.id}`);
  }

  private async syncToRedis(entry: IpBlacklist) {
    const key = `${IP_BLACKLIST_PREFIX}${entry.ip}`;
    if (entry.expiresAt) {
      const ttlSeconds = Math.floor((entry.expiresAt.getTime() - Date.now()) / 1000);
      if (ttlSeconds <= 0) {
        await this.redis.del(key);
        return;
      }
      await this.redis.setex(key, ttlSeconds, '1');
    } else {
      // permanent — very long TTL
      await this.redis.setex(key, ADMIN_IP_BLACKLIST_PERMANENT_TTL_SECONDS, '1');
    }
  }

  async seedRedisFromDb() {
    const entries = await this.repo.findAll();
    for (const entry of entries) {
      await this.syncToRedis(entry);
    }
    this.logger.log(`Seeded Redis with ${entries.length} IP blacklist entries`);
  }
}
