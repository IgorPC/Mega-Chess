import {
  Controller, Get, UseGuards, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';

@Controller('admin/dashboard')
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminDashboardController {
  private readonly logger = new Logger(AdminDashboardController.name);

  constructor(private readonly svc: AdminDashboardService) {}

  @Get('kpis')
  async kpis() {
    try {
      return await this.svc.kpis();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('kpis failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get('top-winners')
  async topWinners() {
    try {
      return await this.svc.topWinners();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('topWinners failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get('alerts')
  async alerts() {
    try {
      return await this.svc.alerts();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('alerts failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
