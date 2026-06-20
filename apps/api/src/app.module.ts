import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MatchesModule } from './matches/matches.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { GameModule } from './game/game.module';
import { FriendsModule } from './friends/friends.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RankingModule } from './ranking/ranking.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    MatchesModule,
    MatchmakingModule,
    GameModule,
    FriendsModule,
    MessagesModule,
    NotificationsModule,
    RankingModule,
    ReviewsModule,
  ],
})
export class AppModule {}
