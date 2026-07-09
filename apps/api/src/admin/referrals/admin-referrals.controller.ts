import {
  Controller, Get, Query,
  UseGuards, HttpException, InternalServerErrorException, Logger,
} from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { AdminRole } from '../../entities/admin-user.entity';
import { AdminReferralsService } from './admin-referrals.service';
import {
  ADMIN_REFERRALS_CONTROLLER_PATH,
  ADMIN_REFERRALS_DEFAULT_LIMIT,
  ADMIN_REFERRALS_DEFAULT_PAGE,
  ADMIN_REFERRALS_ROUTES,
} from './consts/endpoints';

@Controller(ADMIN_REFERRALS_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminReferralsController {
  private readonly logger = new Logger(AdminReferralsController.name);

  constructor(private readonly svc: AdminReferralsService) {}

  @Get(ADMIN_REFERRALS_ROUTES.ROOT)
  @AdminRoles(AdminRole.FINANCEIRO)
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('referrerId') referrerId?: string,
    @Query('isEligible') isEligible?: string,
  ) {
    try {
      return await this.svc.list({
        page: +(page ?? ADMIN_REFERRALS_DEFAULT_PAGE),
        limit: +(limit ?? ADMIN_REFERRALS_DEFAULT_LIMIT),
        referrerId: referrerId || undefined,
        isEligible: isEligible === undefined ? undefined : isEligible === 'true',
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin list referrals failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_REFERRALS_ROUTES.STATS)
  @AdminRoles(AdminRole.FINANCEIRO)
  async stats(@Query('period') period?: string) {
    try {
      return await this.svc.stats(period);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin referrals stats failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
