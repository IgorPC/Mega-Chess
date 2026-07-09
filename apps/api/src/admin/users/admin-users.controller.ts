import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UseGuards, Res, HttpCode, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsString, MinLength, IsNumber, Min, Max, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { AdminUsersService } from './admin-users.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import {
  ADMIN_USERS_CONTROLLER_PATH, ADMIN_USERS_ROUTES, ADMIN_USERS_DEFAULTS,
  ADMIN_USERS_ELO_MIN, ADMIN_USERS_ELO_MAX, ADMIN_USERS_SUSPEND_REASON_MIN_LENGTH,
} from './consts/endpoints';

class SuspendDto {
  @IsString() @MinLength(10) reason: string;
  @IsString() duration: string;
  @IsBoolean() @IsOptional() notify?: boolean;
}

class AdjustEloDto {
  @IsNumber() @Min(ADMIN_USERS_ELO_MIN) @Max(ADMIN_USERS_ELO_MAX) @Type(() => Number) newRating: number;
  @IsString() @MinLength(ADMIN_USERS_SUSPEND_REASON_MIN_LENGTH) reason: string;
}

class SendMessageDto {
  @IsString() @MinLength(1) title: string;
  @IsString() @MinLength(1) content: string;
}

@Controller(ADMIN_USERS_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(private readonly svc: AdminUsersService) {}

  @Get(ADMIN_USERS_ROUTES.LIST)
  async list(@Query() q: { page?: string; limit?: string; search?: string; status?: string }) {
    try {
      return await this.svc.list({
        page: +(q.page ?? ADMIN_USERS_DEFAULTS.PAGE),
        limit: +(q.limit ?? ADMIN_USERS_DEFAULTS.LIMIT),
        search: q.search, status: q.status,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin list users failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_USERS_ROUTES.EXPORT)
  @AdminRoles(AdminRole.FINANCEIRO)
  async export(@Res() res: Response) {
    try {
      const csv = await this.svc.exportCsvData();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
      res.send(csv);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin export users failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_USERS_ROUTES.BY_ID)
  async get(@Param('id') id: string) {
    try {
      return await this.svc.get(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin get user failed userId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_USERS_ROUTES.TRANSACTIONS)
  async transactions(@Param('id') id: string, @Query('page') page?: string) {
    try {
      return await this.svc.transactions(id, +(page ?? ADMIN_USERS_DEFAULTS.PAGE));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin user transactions failed userId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_USERS_ROUTES.TICKETS)
  async tickets(@Param('id') id: string) {
    try {
      return await this.svc.tickets(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin user tickets failed userId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_USERS_ROUTES.ACTIVITY)
  async activity(@Param('id') id: string, @Query('page') page?: string) {
    try {
      return await this.svc.activityLogs(id, +(page ?? ADMIN_USERS_DEFAULTS.PAGE));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin user activity failed userId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_USERS_ROUTES.MESSAGE)
  @AdminRoles(AdminRole.SUPORTE)
  @HttpCode(204)
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.sendMessage(id, dto.title, dto.content, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin sendMessage failed userId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_USERS_ROUTES.SUSPEND)
  @AdminRoles(AdminRole.OPERADOR)
  @HttpCode(204)
  async suspend(@Param('id') id: string, @Body() dto: SuspendDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.suspend(id, dto.reason, dto.duration, dto.notify ?? true, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin suspend failed userId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_USERS_ROUTES.FORCE_LOGOUT)
  @AdminRoles(AdminRole.OPERADOR)
  @HttpCode(204)
  async forceLogout(@Param('id') id: string, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.forceLogout(id, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin forceLogout failed userId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch(ADMIN_USERS_ROUTES.ELO)
  @AdminRoles(AdminRole.ADMIN)
  @HttpCode(204)
  async adjustElo(@Param('id') id: string, @Body() dto: AdjustEloDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.adjustElo(id, dto.newRating, dto.reason, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin adjustElo failed userId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
