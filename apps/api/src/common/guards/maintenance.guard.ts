import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { PlatformConfigService } from '../../platform-config/platform-config.service';

const EXEMPT_PREFIXES = ['/api/v1/config/public', '/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/admin'];

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private config: PlatformConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const path: string = req.path ?? '';

    if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return true;

    const maintenance = await this.config.get('maintenance_mode');
    if (maintenance === 'true') {
      throw new ServiceUnavailableException(
        'Plataforma em manutenção. Tente novamente em breve.',
      );
    }
    return true;
  }
}
