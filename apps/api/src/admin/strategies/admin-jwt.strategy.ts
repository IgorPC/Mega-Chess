import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { AdminUser } from '../../entities/admin-user.entity';
import { REDIS_CLIENT } from '../../redis/redis.module';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  purpose: 'admin_access';
  sessionToken?: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(AdminUser) private admins: Repository<AdminUser>,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('ADMIN_JWT_SECRET'),
    });
  }

  async validate(payload: AdminJwtPayload) {
    if (payload.purpose !== 'admin_access') throw new UnauthorizedException();
    const admin = await this.admins.findOne({ where: { id: payload.sub, isActive: true } });
    if (!admin) throw new UnauthorizedException();
    if (payload.sessionToken) {
      const stored = await this.redis.get(`adminSession:${payload.sub}`);
      if (!stored || stored !== payload.sessionToken) throw new UnauthorizedException('Session invalidated');
    }
    return admin;
  }
}
