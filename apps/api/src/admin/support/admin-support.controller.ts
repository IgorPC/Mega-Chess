import {
  Controller, Get, Post, Patch, Param, Query, Body,
  UseGuards, HttpCode, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsString, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { AdminSupportService } from './admin-support.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser } from '../../entities/admin-user.entity';
import { TicketStatus } from '../../entities/support-ticket.entity';
import { ADMIN_SUPPORT_CONTROLLER_PATH, ADMIN_SUPPORT_ROUTES, ADMIN_SUPPORT_DEFAULTS } from './consts/endpoints';

class ReplyDto {
  @IsString() content: string;
  @IsBoolean() @IsOptional() isInternal?: boolean;
}

class UpdateStatusDto {
  @IsEnum(TicketStatus) status: TicketStatus;
}

class AssignDto {
  @IsString() adminId: string;
}

@Controller(ADMIN_SUPPORT_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminSupportController {
  private readonly logger = new Logger(AdminSupportController.name);

  constructor(private readonly svc: AdminSupportService) {}

  @Get(ADMIN_SUPPORT_ROUTES.LIST)
  async list(@Query() q: { page?: string; limit?: string; status?: string; category?: string; search?: string }) {
    try {
      return await this.svc.list({
        page: +(q.page ?? ADMIN_SUPPORT_DEFAULTS.PAGE),
        limit: +(q.limit ?? ADMIN_SUPPORT_DEFAULTS.LIMIT),
        status: q.status, category: q.category, search: q.search,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin list tickets failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_SUPPORT_ROUTES.BY_ID)
  async get(@Param('id') id: string) {
    try {
      return await this.svc.get(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin get ticket failed ticketId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_SUPPORT_ROUTES.MESSAGES)
  async messages(@Param('id') id: string) {
    try {
      return await this.svc.getMessages(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin getMessages failed ticketId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_SUPPORT_ROUTES.MESSAGES)
  @HttpCode(201)
  async reply(@Param('id') id: string, @Body() dto: ReplyDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.reply(id, dto.content, dto.isInternal ?? false, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin reply failed ticketId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch(ADMIN_SUPPORT_ROUTES.UPDATE_STATUS)
  @HttpCode(204)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.updateStatus(id, dto.status, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin updateStatus failed ticketId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_SUPPORT_ROUTES.ASSIGN)
  @HttpCode(204)
  async assign(@Param('id') id: string, @Body() dto: AssignDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.assign(id, dto.adminId, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin assign failed ticketId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_SUPPORT_ROUTES.AI_SUMMARY)
  async aiSummary(@Param('id') id: string) {
    try {
      return await this.svc.aiSummary(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin aiSummary failed ticketId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
