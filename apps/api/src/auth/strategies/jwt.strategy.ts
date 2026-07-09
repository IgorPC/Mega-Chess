import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { User } from '../../entities/user.entity';
import { REDIS_CLIENT } from '../../redis/redis.module';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private users: Repository<User>,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; sessionToken?: string }) {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    if (!user.isActive) throw new UnauthorizedException('Esta conta foi excluída');

    if (payload.sessionToken) {
      const stored = await this.redis.get(`session:${payload.sub}`);
      if (!stored || stored !== payload.sessionToken) {
        throw new UnauthorizedException('Session invalidated');
      }
    }

    return { id: user.id, email: user.email, nickname: user.nickname };
  }
}
