import {
  Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsString, IsNumber, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import { ADMIN_TRANSACTIONS_CONTROLLER_PATH, ADMIN_TRANSACTIONS_ROUTES, ADMIN_TRANSACTIONS_DEFAULTS } from './consts/endpoints';

class RejectDto { @IsString() reason: string; }
class RefundDto {
  @IsUUID() userId: string;
  @IsNumber() @Min(0.01) @Type(() => Number) amountCc: number;
  @IsString() reason: string;
}

@Controller(ADMIN_TRANSACTIONS_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
@AdminRoles(AdminRole.FINANCEIRO)
export class AdminTransactionsController {
  private readonly logger = new Logger(AdminTransactionsController.name);

  constructor(private readonly svc: AdminTransactionsService) {}

  @Get(ADMIN_TRANSACTIONS_ROUTES.TRANSACTIONS)
  async list(@Query('page') p?: string, @Query('limit') l?: string) {
    try {
      return await this.svc.listTransactions(+(p ?? ADMIN_TRANSACTIONS_DEFAULTS.PAGE), +(l ?? ADMIN_TRANSACTIONS_DEFAULTS.LIMIT));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('listTransactions failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TRANSACTIONS_ROUTES.DEPOSITS)
  async deposits(@Query('page') p?: string, @Query('limit') l?: string) {
    try {
      return await this.svc.listDeposits(+(p ?? ADMIN_TRANSACTIONS_DEFAULTS.PAGE), +(l ?? ADMIN_TRANSACTIONS_DEFAULTS.LIMIT));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('listDeposits failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TRANSACTIONS_ROUTES.WITHDRAWALS)
  async withdrawals(
    @Query('page') p?: string,
    @Query('limit') l?: string,
    @Query('status') status?: string,
  ) {
    try {
      return await this.svc.listWithdrawals(+(p ?? ADMIN_TRANSACTIONS_DEFAULTS.PAGE), +(l ?? ADMIN_TRANSACTIONS_DEFAULTS.LIMIT), status);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('listWithdrawals failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_TRANSACTIONS_ROUTES.WITHDRAWAL_APPROVE)
  @HttpCode(204)
  async approve(@Param('id') id: string, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.approveWithdrawal(id, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`approveWithdrawal failed withdrawalId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_TRANSACTIONS_ROUTES.WITHDRAWAL_REJECT)
  @HttpCode(204)
  async reject(@Param('id') id: string, @Body() dto: RejectDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.rejectWithdrawal(id, dto.reason, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`rejectWithdrawal failed withdrawalId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_TRANSACTIONS_ROUTES.REFUND)
  @AdminRoles(AdminRole.ADMIN)
  @HttpCode(204)
  async refund(@Body() dto: RefundDto, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.refund(dto.userId, dto.amountCc, dto.reason, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`refund failed userId=${dto.userId} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TRANSACTIONS_ROUTES.FINANCIAL_SUMMARY)
  @AdminRoles(AdminRole.ADMIN)
  async financialSummary(@Query('period') period = ADMIN_TRANSACTIONS_DEFAULTS.FINANCIAL_SUMMARY_PERIOD) {
    try {
      return await this.svc.financialSummary(period);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('financialSummary failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TRANSACTIONS_ROUTES.RAKE_SUMMARY)
  async rakeSummary(@Query('period') period = ADMIN_TRANSACTIONS_DEFAULTS.RAKE_SUMMARY_PERIOD) {
    try {
      return await this.svc.rakeSummary(period);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`rakeSummary failed period=${period}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
