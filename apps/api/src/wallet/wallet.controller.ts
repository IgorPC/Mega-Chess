import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe, Logger, InternalServerErrorException, HttpException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateDepositDto } from './dto/deposit.dto';
import { WithdrawDto, UpdatePixKeyDto } from './dto/withdraw.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Repository } from 'typeorm';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { calculateAge } from '../common/age.util';
import { WALLET_ENDPOINTS } from './consts/endpoints';

@Controller(WALLET_ENDPOINTS.ROOT)
@UseGuards(JwtAuthGuard)
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(
    private readonly wallet: WalletService,
    @InjectRepository(User) private users: Repository<User>,
    private activity: UserActivityService,
    private platformConfig: PlatformConfigService,
  ) {}

  @Get()
  async getBalance(@CurrentUser() user: { id: string }) {
    try {
      return await this.wallet.getBalance(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getBalance failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(WALLET_ENDPOINTS.TRANSACTIONS)
  async getTransactions(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    try {
      return await this.wallet.getTransactions(user.id, page, Math.min(limit, 50));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getTransactions failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(WALLET_ENDPOINTS.DEPOSITS)
  async getDeposits(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(15), ParseIntPipe) limit: number,
  ) {
    try {
      return await this.wallet.getDeposits(user.id, page, Math.min(limit, 50));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getDeposits failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  // Payment-related — keep a strict limit regardless of the internal-routes default.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(WALLET_ENDPOINTS.DEPOSIT)
  async createDeposit(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDepositDto,
  ) {
    try {
      const depositsEnabled = await this.platformConfig.getBoolean('deposits_enabled');
      if (!depositsEnabled) throw new ForbiddenException('Depósitos temporariamente desabilitados');

      const dbUser = await this.users.findOne({ where: { id: user.id }, select: ['id', 'birthDate'] });
      const birthDateStr = dto.birthDate ?? dbUser?.birthDate;
      if (!birthDateStr) throw new BadRequestException('Data de nascimento é obrigatória para depósitos');
      if (calculateAge(birthDateStr) < 18) throw new BadRequestException('Você precisa ter pelo menos 18 anos para realizar depósitos');

      return await this.wallet.createDeposit(user.id, dto.valueBrl, dto.cpf);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`createDeposit failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete(WALLET_ENDPOINTS.DEPOSIT_BY_ID)
  async cancelDeposit(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    try {
      return await this.wallet.cancelDeposit(user.id, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`cancelDeposit failed userId=${user.id} depositId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  // Payment-related — keep a strict limit regardless of the internal-routes default.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(WALLET_ENDPOINTS.WITHDRAW)
  async requestWithdrawal(
    @CurrentUser() user: { id: string },
    @Body() dto: WithdrawDto,
  ) {
    try {
      const withdrawalsEnabled = await this.platformConfig.getBoolean('withdrawals_enabled');
      if (!withdrawalsEnabled) throw new ForbiddenException('Saques temporariamente desabilitados');
      return await this.wallet.requestWithdrawal(
        user.id,
        dto.valueCC,
        dto.pixKey,
        dto.pixKeyType,
      );
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`requestWithdrawal failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  // Changes the withdrawal destination — payment-adjacent, keep it strict too.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(WALLET_ENDPOINTS.PIX_KEY)
  async savePixKey(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePixKeyDto,
  ) {
    try {
      await this.users.update(user.id, {
        pixKey: dto.pixKey,
        pixKeyType: dto.pixKeyType,
      });
      this.activity.log(user.id, UserAction.PIX_KEY_UPDATED, { pixKeyType: dto.pixKeyType });
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`savePixKey failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}

