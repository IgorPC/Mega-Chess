import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { Match } from '../entities/match.entity';
import { Review } from '../entities/review.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Match, Review, RefreshToken]),
    UserActivityModule,
    WalletModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
