import {
  Controller, Get, Post, Delete, Patch, Param, Query, Body,
  UseGuards, HttpCode, Logger, InternalServerErrorException, HttpException, Req,
} from '@nestjs/common';
import { IsString, IsOptional, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Request } from 'express';
import { AdminIpBlacklistService } from './admin-ip-blacklist.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import { ADMIN_IP_BLACKLIST_CONTROLLER_PATH, ADMIN_IP_BLACKLIST_ROUTES } from './consts/endpoints';

class AddIpDto {
  @IsString() ip: string;
  @IsString() @IsOptional() reason?: string;
  @IsDateString() @IsOptional() expiresAt?: string;
}

class UpdateIpDto {
  @IsString() @IsOptional() reason?: string | null;
  @Transform(({ value }) => (value === null ? null : value))
  @IsDateString() @IsOptional() expiresAt?: string | null;
}

@Controller(ADMIN_IP_BLACKLIST_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@AdminRoles(AdminRole.ADMIN)
export class AdminIpBlacklistController {
  private readonly logger = new Logger(AdminIpBlacklistController.name);

  constructor(private readonly svc: AdminIpBlacklistService) {}

  @Get(ADMIN_IP_BLACKLIST_ROUTES.ROOT)
  async list(
    @Query('page') p?: string,
    @Query('limit') l?: string,
    @Query('ip') ip?: string,
  ) {
    try {
      return await this.svc.list(+(p ?? 1), +(l ?? 25), ip || undefined);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('list ip-blacklist failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_IP_BLACKLIST_ROUTES.ROOT)
  @HttpCode(201)
  async add(@Body() dto: AddIpDto, @CurrentAdmin() admin: AdminUser, @Req() req: Request) {
    try {
      const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
      return await this.svc.add(dto.ip, dto.reason ?? null, expiresAt, admin, req.ip ?? '');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`add ip-blacklist failed ip=${dto.ip} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch(ADMIN_IP_BLACKLIST_ROUTES.BY_IP)
  async update(
    @Param('ip') ip: string,
    @Body() dto: UpdateIpDto,
    @CurrentAdmin() admin: AdminUser,
    @Req() req: Request,
  ) {
    try {
      const updates: { reason?: string | null; expiresAt?: Date | null } = {};
      if (dto.reason !== undefined) updates.reason = dto.reason;
      if (dto.expiresAt !== undefined) updates.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
      return await this.svc.update(ip, updates, admin, req.ip ?? '');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`update ip-blacklist failed ip=${ip}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete(ADMIN_IP_BLACKLIST_ROUTES.BY_IP)
  @HttpCode(204)
  async remove(@Param('ip') ip: string, @CurrentAdmin() admin: AdminUser, @Req() req: Request) {
    try {
      await this.svc.remove(ip, admin, req.ip ?? '');
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`remove ip-blacklist failed ip=${ip}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
