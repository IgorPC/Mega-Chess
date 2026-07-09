import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole, ROLE_HIERARCHY } from '../../entities/admin-user.entity';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const admin = ctx.switchToHttp().getRequest().user;
    if (!admin) throw new ForbiddenException('Não autenticado');

    const adminLevel = ROLE_HIERARCHY[admin.role as AdminRole] ?? 0;
    const requiredLevel = Math.min(...required.map((r) => ROLE_HIERARCHY[r]));

    if (adminLevel < requiredLevel) {
      throw new ForbiddenException('Permissão insuficiente para esta operação');
    }
    return true;
  }
}
