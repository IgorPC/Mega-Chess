import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Match } from '../entities/match.entity';
import { Friendship } from '../entities/friendship.entity';
import { Message } from '../entities/message.entity';
import { MatchChatMessage } from '../entities/match-chat-message.entity';
import { Notification } from '../entities/notification.entity';
import { Review } from '../entities/review.entity';
import { Wallet } from '../entities/wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Deposit } from '../entities/deposit.entity';
import { Withdrawal } from '../entities/withdrawal.entity';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { AsaasEvent } from '../webhooks/entities/asaas-event.entity';
import { UserActivityLog } from '../entities/user-activity-log.entity';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { PlatformConfig } from '../platform-config/entities/platform-config.entity';
import { SupportTicket } from '../entities/support-ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketAttachment } from '../entities/ticket-attachment.entity';
import { MatchReport } from '../entities/match-report.entity';
import { MatchReportAppeal } from '../entities/match-report-appeal.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { PlatformRevenue } from '../platform-revenue/entities/platform-revenue.entity';
import { IpBlacklist } from '../entities/ip-blacklist.entity';
import { ImprovementSuggestion } from '../entities/improvement-suggestion.entity';
import { SuggestionVote } from '../entities/suggestion-vote.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { ReferralEarning } from '../referrals/entities/referral-earning.entity';

const ALL_ENTITIES = [
  User, RefreshToken, Match, Friendship, Message,
  MatchChatMessage, Notification, Review,
  Wallet, WalletTransaction, Deposit, Withdrawal,
  Tournament, TournamentParticipant, TournamentMatch,
  AsaasEvent,
  UserActivityLog, AiUsageLog, PlatformConfig,
  SupportTicket, TicketMessage, TicketAttachment,
  MatchReport, MatchReportAppeal,
  AdminUser, AdminAuditLog,
  PlatformRevenue,
  IpBlacklist,
  ImprovementSuggestion,
  SuggestionVote,
  Referral,
  ReferralEarning,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: ALL_ENTITIES,
        synchronize: config.get('NODE_ENV') !== 'production',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
