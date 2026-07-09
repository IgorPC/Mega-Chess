import {
  Controller, Get, Post, Patch, Param, Query, Body, Res,
  UseGuards, HttpCode, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsString, IsEmail, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { Response } from 'express';
import { AdminStaffService } from './admin-staff.service';
import { AdminAuditService } from '../admin-audit.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import { AdminStaffRepository } from './admin-staff.repository';
import { ADMIN_STAFF_CONTROLLER_PATH, ADMIN_STAFF_ROUTES, ADMIN_STAFF_DEFAULTS } from './consts/endpoints';

class CreateStaffDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsEnum(AdminRole) role: AdminRole;
}

class UpdateStaffDto {
  @IsEnum(AdminRole) @IsOptional() role?: AdminRole;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

@Controller(ADMIN_STAFF_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@AdminRoles(AdminRole.ADMIN)
export class AdminStaffController {
  private readonly logger = new Logger(AdminStaffController.name);

  constructor(
    private readonly svc: AdminStaffService,
    private readonly audit: AdminAuditService,
    private readonly repo: AdminStaffRepository,
  ) {}

  @Get(ADMIN_STAFF_ROUTES.STAFF)
  async list(@Query('page') p?: string, @Query('limit') l?: string) {
    try {
      return await this.svc.list(+(p ?? ADMIN_STAFF_DEFAULTS.PAGE), +(l ?? ADMIN_STAFF_DEFAULTS.LIMIT));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin list staff failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_STAFF_ROUTES.STAFF)
  @HttpCode(201)
  async create(@Body() dto: CreateStaffDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.create(dto, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin create staff failed adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch(ADMIN_STAFF_ROUTES.STAFF_BY_ID)
  @HttpCode(204)
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.update(id, dto, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin update staff failed staffId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_STAFF_ROUTES.STAFF_DEACTIVATE)
  @HttpCode(204)
  async deactivate(@Param('id') id: string, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.deactivate(id, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin deactivate staff failed staffId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_STAFF_ROUTES.AUDIT_LOGS)
  async auditLogs(
    @Query('page') p?: string,
    @Query('limit') l?: string,
    @Query('adminId') adminId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    try {
      return await this.audit.list({
        page: +(p ?? ADMIN_STAFF_DEFAULTS.PAGE),
        limit: +(l ?? ADMIN_STAFF_DEFAULTS.LIMIT),
        adminId: adminId || undefined,
        action: action || undefined,
        targetType: targetType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin auditLogs failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_STAFF_ROUTES.USER_ACTIVITY)
  async userActivity(
    @Query('page') p?: string,
    @Query('limit') l?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    try {
      const page  = Math.max(1, +(p ?? ADMIN_STAFF_DEFAULTS.PAGE));
      const limit = Math.min(+(l ?? ADMIN_STAFF_DEFAULTS.LIMIT), ADMIN_STAFF_DEFAULTS.USER_ACTIVITY_MAX_LIMIT);
      const [data, total] = await this.repo.queryUserActivity({ page, limit, userId, action, dateFrom, dateTo });
      return { data, total, page, totalPages: Math.ceil(total / limit) };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin userActivity failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_STAFF_ROUTES.AUDIT_LOGS_EXPORT)
  async exportAuditLogs(
    @Res() res: Response,
    @Query('adminId') adminId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    try {
      const csv = await this.audit.exportCsv({
        adminId: adminId || undefined,
        action: action || undefined,
        targetType: targetType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.send(csv);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin exportAuditLogs failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
