import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from '../entities/wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Deposit } from '../entities/deposit.entity';
import { Withdrawal } from '../entities/withdrawal.entity';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { ReferralEarning } from '../referrals/entities/referral-earning.entity';
import { AsaasModule } from '../asaas/asaas.module';
import { DeepseekModule } from '../deepseek/deepseek.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, WalletTransaction, Deposit, Withdrawal, Match, User, Referral, ReferralEarning]),
    AsaasModule,
    DeepseekModule,
    UserActivityModule,
    PlatformConfigModule,
    forwardRef(() => GameModule),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
