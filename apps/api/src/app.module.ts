import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IpBlacklistMiddleware } from './common/middleware/ip-blacklist.middleware';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
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
import { WalletModule } from './wallet/wallet.module';
import { AsaasModule } from './asaas/asaas.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DeepseekModule } from './deepseek/deepseek.module';
import { UserActivityModule } from './user-activity/user-activity.module';
import { PlatformConfigModule } from './platform-config/platform-config.module';
import { SupportModule } from './support/support.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { ReferralsModule } from './referrals/referrals.module';
import { AdminModule } from './admin/admin.module';
import { EmailModule } from './email/email.module';
import { PlatformRevenueModule } from './platform-revenue/platform-revenue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global default for internal/authenticated routes. Public, sensitive, and
    // payment-related routes override this with a stricter @Throttle() at the
    // controller level (see auth.controller.ts, admin/auth, wallet.controller.ts).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    RedisModule,
    DatabaseModule,
    EmailModule,
    PlatformRevenueModule,
    DeepseekModule,
    UserActivityModule,
    PlatformConfigModule,
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
    WalletModule,
    AsaasModule,
    TournamentsModule,
    WebhooksModule,
    SupportModule,
    SuggestionsModule,
    ReferralsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IpBlacklistMiddleware).forRoutes('*');
  }
}
