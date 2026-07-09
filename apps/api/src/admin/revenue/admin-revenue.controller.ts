import {
  Controller, Get, Query, UseGuards, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { PlatformRevenueService } from '../../platform-revenue/platform-revenue.service';
import { ADMIN_REVENUE_CONTROLLER_PATH, ADMIN_REVENUE_ROUTES, ADMIN_REVENUE_DEFAULTS } from './consts/endpoints';

@UseGuards(AdminJwtGuard)
@Controller(ADMIN_REVENUE_CONTROLLER_PATH)
export class AdminRevenueController {
  private readonly logger = new Logger(AdminRevenueController.name);

  constructor(private readonly revenue: PlatformRevenueService) {}

  @Get(ADMIN_REVENUE_ROUTES.SUMMARY)
  async summary() {
    try {
      return await this.revenue.summary();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('revenue summary failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_REVENUE_ROUTES.HISTORY)
  async history(
    @Query('page') page = ADMIN_REVENUE_DEFAULTS.HISTORY_PAGE,
    @Query('limit') limit = ADMIN_REVENUE_DEFAULTS.HISTORY_LIMIT,
  ) {
    try {
      return await this.revenue.history(Number(page), Number(limit));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('revenue history failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_REVENUE_ROUTES.CHART)
  async chart(@Query('days') days = ADMIN_REVENUE_DEFAULTS.CHART_DAYS) {
    try {
      return await this.revenue.chartByPeriod(Number(days));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('revenue chart failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
