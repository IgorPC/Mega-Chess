import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { MatchesModule } from '../matches/matches.module';
import { AuthModule } from '../auth/auth.module';
import { MatchChatMessage } from '../entities/match-chat-message.entity';
import { User } from '../entities/user.entity';
import { Friendship } from '../entities/friendship.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { BotModule } from '../bots/bot.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MatchesModule,
    AuthModule,
    BotModule,
    NotificationsModule,
    forwardRef(() => TournamentsModule),
    TypeOrmModule.forFeature([MatchChatMessage, User, Friendship, TournamentMatch]),
  ],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class GameModule {}
