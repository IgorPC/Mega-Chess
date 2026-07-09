import {
  Controller, Get, Post, Put, Body, Query, UseGuards, HttpCode,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { AdminMaintenanceService } from './admin-maintenance.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { AdminRole, AdminUser } from '../../entities/admin-user.entity';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { ADMIN_MAINTENANCE_CONTROLLER_PATH, ADMIN_MAINTENANCE_ROUTES } from './consts/endpoints';

@Controller(ADMIN_MAINTENANCE_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@AdminRoles(AdminRole.OPERADOR)
export class AdminMaintenanceController {
  private readonly logger = new Logger(AdminMaintenanceController.name);

  constructor(private readonly svc: AdminMaintenanceService) {}

  @Get(ADMIN_MAINTENANCE_ROUTES.METRICS)
  async metrics() {
    try {
      return await this.svc.metrics();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('metrics failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_MAINTENANCE_ROUTES.LOGS)
  async logs(@Query('limit') limit?: string) {
    try {
      return await this.svc.logs(+(limit ?? 50));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('logs failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_MAINTENANCE_ROUTES.CONFIG)
  @AdminRoles(AdminRole.ADMIN)
  async config() {
    try {
      return await this.svc.getConfig();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('getConfig failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Put(ADMIN_MAINTENANCE_ROUTES.CONFIG)
  @AdminRoles(AdminRole.ADMIN)
  @HttpCode(204)
  async updateConfig(@Body() cfg: Record<string, string | boolean | number>, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.updateConfig(cfg, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('updateConfig failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_MAINTENANCE_ROUTES.ASAAS_STATUS)
  async asaasStatus() {
    try {
      return await this.svc.asaasStatus();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('asaasStatus failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_MAINTENANCE_ROUTES.BROADCAST)
  @HttpCode(204)
  async broadcast(@Body() body: { message: string; type: string }) {
    try {
      return await this.svc.broadcast(body.message, body.type);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('broadcast failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_MAINTENANCE_ROUTES.REDIS_FLUSH)
  @AdminRoles(AdminRole.ADMIN)
  @HttpCode(204)
  async flushRedis() {
    try {
      return await this.svc.flushRedis();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('flushRedis failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_MAINTENANCE_ROUTES.AI_USAGE)
  async aiUsage(@Query('page') p?: string, @Query('limit') l?: string) {
    try {
      return await this.svc.aiUsageLogs(+(p ?? 1), +(l ?? 25));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('aiUsageLogs failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
