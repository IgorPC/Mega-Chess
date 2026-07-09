import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { Referral } from './entities/referral.entity';
import { ReferralEarning } from './entities/referral-earning.entity';
import { User } from '../entities/user.entity';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { ReferralsRepository } from './referrals.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Referral, ReferralEarning, User]),
    PlatformConfigModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralsRepository],
  exports: [ReferralsService],
})
export class ReferralsModule {}
