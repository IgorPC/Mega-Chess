import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class BannedUserGuard implements CanActivate {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.id;
    if (!userId) return true;

    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'bannedUntil', 'bannedReason'] });
    if (!user) return true;

    if (user.bannedUntil && user.bannedUntil > new Date()) {
      throw new ForbiddenException(
        `Conta suspensa até ${user.bannedUntil.toISOString()}. Motivo: ${user.bannedReason ?? 'violação dos termos de uso'}`,
      );
    }
    return true;
  }
}
