import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../redis/redis.module';
import type Redis from 'ioredis';

export const IP_BLACKLIST_PREFIX = 'ip_blacklist:';

@Injectable()
export class IpBlacklistMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlacklistMiddleware.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip ?? req.socket.remoteAddress ?? '';

    try {
      const blocked = await this.redis.get(`${IP_BLACKLIST_PREFIX}${ip}`);
      if (blocked) {
        this.logger.warn(`Blocked request from blacklisted IP=${ip} ${req.method} ${req.path}`);
        res.status(403).json({ statusCode: 403, message: 'Access denied' });
        return;
      }
    } catch (err) {
      this.logger.error(`IpBlacklistMiddleware Redis error ip=${ip}`, err instanceof Error ? err.stack : String(err));
    }

    next();
  }
}
