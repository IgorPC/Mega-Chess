import { Injectable, Logger, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerStorage, ThrottlerModuleOptions, InjectThrottlerOptions, InjectThrottlerStorage } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { IP_BLACKLIST_PREFIX } from '../middleware/ip-blacklist.middleware';
import { IpBlacklist } from '../../entities/ip-blacklist.entity';
import type Redis from 'ioredis';

const VIOLATIONS_PREFIX             = 'throttle_violations:';
const VIOLATIONS_WINDOW_SECONDS     = 300;   // 5-minute sliding window
const AUTO_BLOCK_THRESHOLD          = 10;    // violations → auto-block
const AUTO_BLOCK_DURATION_SECONDS   = 3600;  // 1-hour temporary block

@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(LoggingThrottlerGuard.name);

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  // Tracks per authenticated user when possible, falling back to IP only for
  // unauthenticated requests. Multiple users behind the same IP (NAT, shared
  // wifi, mobile carrier, corporate network) must not share one rate-limit
  // bucket — otherwise one user's normal traffic can exhaust the limit and
  // get an unrelated user on the same IP throttled/auto-blocked.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = this.extractUserId(req);
    return userId ? `user:${userId}` : `ip:${req.ip}`;
  }

  private extractUserId(req: Record<string, any>): string | null {
    const auth: string | undefined = req.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    try {
      const payload = this.jwtService.verify(auth.slice(7));
      return typeof payload?.sub === 'string' ? payload.sub : null;
    } catch {
      return null; // expired/invalid token — treat as unauthenticated for tracking purposes
    }
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const ip: string = req.ip ?? '';
    const userId = this.extractUserId(req);

    this.logger.warn(
      `Rate limit exceeded ip=${ip} userId=${userId ?? 'anon'} method=${req.method} path=${req.originalUrl ?? req.url}`,
    );

    // Violation counting (and the resulting IP auto-block) intentionally stays
    // keyed by IP: it exists to catch anonymous/scripted abuse hitting public
    // endpoints, not to penalize an authenticated user's own bucket exceeding
    // its limit. Authenticated users now each have their own throttle bucket
    // (see getTracker), so a legitimate user's traffic no longer inflates
    // another user's — or their IP-mate's — violation count.
    if (!userId) {
      await this.trackViolation(ip);
    }

    return super.throwThrottlingException(context, detail);
  }

  private async trackViolation(ip: string): Promise<void> {
    if (!ip) return;

    try {
      const key = `${VIOLATIONS_PREFIX}${ip}`;
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, VIOLATIONS_WINDOW_SECONDS);
      }

      if (count === AUTO_BLOCK_THRESHOLD) {
        await this.autoBlock(ip, count);
      }
    } catch (err) {
      this.logger.error(`trackViolation failed ip=${ip}`, err instanceof Error ? err.stack : String(err));
    }
  }

  private async autoBlock(ip: string, violationCount: number): Promise<void> {
    const alreadyBlocked = await this.redis.get(`${IP_BLACKLIST_PREFIX}${ip}`);
    if (alreadyBlocked) return;

    const expiresAt = new Date(Date.now() + AUTO_BLOCK_DURATION_SECONDS * 1000);
    const reason = `Auto-bloqueado: ${violationCount} violações de rate limit em ${VIOLATIONS_WINDOW_SECONDS / 60} minutos`;

    try {
      const repo = this.dataSource.getRepository(IpBlacklist);
      const existing = await repo.findOne({ where: { ip } });
      if (!existing) {
        await repo.save(repo.create({ ip, reason, expiresAt, blockedBy: null, blockedByName: 'Sistema' }));
      }

      await this.redis.setex(`${IP_BLACKLIST_PREFIX}${ip}`, AUTO_BLOCK_DURATION_SECONDS, '1');

      this.logger.warn(
        `Auto-blocked ip=${ip} violations=${violationCount} duration=${AUTO_BLOCK_DURATION_SECONDS}s expiresAt=${expiresAt.toISOString()}`,
      );
    } catch (err) {
      this.logger.error(`autoBlock failed ip=${ip}`, err instanceof Error ? err.stack : String(err));
    }
  }
}
