import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { MatchesModule } from '../matches/matches.module';
import { GameModule } from '../game/game.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { UserActivityModule } from '../user-activity/user-activity.module';
import { BotModule } from '../bots/bot.module';
import { User } from '../entities/user.entity';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';

@Module({
  imports: [
    MatchesModule,
    GameModule,
    NotificationsModule,
    WalletModule,
    UserActivityModule,
    BotModule,
    TypeOrmModule.forFeature([User, Tournament, TournamentParticipant, TournamentMatch]),
  ],
  providers: [MatchmakingService],
  controllers: [MatchmakingController],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
