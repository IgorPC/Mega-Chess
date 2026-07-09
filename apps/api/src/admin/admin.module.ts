import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Entities
import { AdminUser }       from '../entities/admin-user.entity';
import { AdminAuditLog }   from '../entities/admin-audit-log.entity';
import { User }            from '../entities/user.entity';
import { Wallet }          from '../entities/wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Deposit }         from '../entities/deposit.entity';
import { Withdrawal }      from '../entities/withdrawal.entity';
import { Tournament }      from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { SupportTicket }   from '../entities/support-ticket.entity';
import { TicketMessage }   from '../entities/ticket-message.entity';
import { Match }           from '../entities/match.entity';
import { UserActivityLog } from '../entities/user-activity-log.entity';
import { AiUsageLog }      from '../entities/ai-usage-log.entity';
import { PlatformConfig }  from '../platform-config/entities/platform-config.entity';
import { PlatformRevenue } from '../platform-revenue/entities/platform-revenue.entity';
import { IpBlacklist } from '../entities/ip-blacklist.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { ReferralEarning } from '../referrals/entities/referral-earning.entity';
import { MatchReport }     from '../entities/match-report.entity';
import { Review }          from '../entities/review.entity';

// Shared
import { DeepseekModule }        from '../deepseek/deepseek.module';
import { PlatformConfigModule }  from '../platform-config/platform-config.module';
import { EmailModule }           from '../email/email.module';

// Admin internals
import { AdminJwtStrategy }     from './strategies/admin-jwt.strategy';
import { AdminAuditService }    from './admin-audit.service';

// Auth
import { AdminAuthService }     from './auth/admin-auth.service';
import { AdminAuthController }  from './auth/admin-auth.controller';
import { AdminAuthRepository }  from './auth/admin-auth.repository';

// Dashboard
import { AdminDashboardService }    from './dashboard/admin-dashboard.service';
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardRepository } from './dashboard/admin-dashboard.repository';

// Users
import { AdminUsersService }    from './users/admin-users.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersRepository } from './users/admin-users.repository';

// Transactions
import { AdminTransactionsService }    from './transactions/admin-transactions.service';
import { AdminTransactionsController } from './transactions/admin-transactions.controller';
import { AdminTransactionsRepository } from './transactions/admin-transactions.repository';

// Tournaments
import { AdminTournamentsService }    from './tournaments/admin-tournaments.service';
import { AdminTournamentsController } from './tournaments/admin-tournaments.controller';
import { AdminTournamentsRepository } from './tournaments/admin-tournaments.repository';

// Support
import { AdminSupportService }    from './support/admin-support.service';
import { AdminSupportController } from './support/admin-support.controller';
import { AdminSupportRepository } from './support/admin-support.repository';

// Maintenance
import { AdminMaintenanceService }    from './maintenance/admin-maintenance.service';
import { AdminMaintenanceController } from './maintenance/admin-maintenance.controller';
import { AdminMaintenanceRepository } from './maintenance/admin-maintenance.repository';

// Staff
import { AdminStaffService }    from './staff/admin-staff.service';
import { AdminStaffController } from './staff/admin-staff.controller';
import { AdminStaffRepository } from './staff/admin-staff.repository';

// Profile
import { AdminProfileController } from './profile/admin-profile.controller';

// Revenue
import { AdminRevenueController } from './revenue/admin-revenue.controller';

// IP Blacklist
import { AdminIpBlacklistService }    from './ip-blacklist/admin-ip-blacklist.service';
import { AdminIpBlacklistController } from './ip-blacklist/admin-ip-blacklist.controller';
import { AdminIpBlacklistRepository } from './ip-blacklist/admin-ip-blacklist.repository';

// Suggestions
import { AdminSuggestionsController } from './suggestions/admin-suggestions.controller';
import { SuggestionsModule }          from '../suggestions/suggestions.module';

// Referrals
import { AdminReferralsService }    from './referrals/admin-referrals.service';
import { AdminReferralsController } from './referrals/admin-referrals.controller';
import { AdminReferralsRepository } from './referrals/admin-referrals.repository';

// Reports
import { AdminReportsService }    from './reports/admin-reports.service';
import { AdminReportsController } from './reports/admin-reports.controller';
import { AdminReportsRepository } from './reports/admin-reports.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('ADMIN_JWT_SECRET'),
        signOptions: { expiresIn: '4h' },
      }),
    }),
    TypeOrmModule.forFeature([
      AdminUser, AdminAuditLog,
      User, Wallet, WalletTransaction, Deposit, Withdrawal,
      Tournament, TournamentParticipant, TournamentMatch,
      SupportTicket, TicketMessage,
      Match, UserActivityLog, AiUsageLog, PlatformConfig, PlatformRevenue,
      IpBlacklist, Referral, ReferralEarning,
      MatchReport, Review,
    ]),
    DeepseekModule,
    PlatformConfigModule,
    EmailModule,
    SuggestionsModule,
  ],
  providers: [
    AdminJwtStrategy,
    AdminAuditService,
    AdminAuthService,
    AdminAuthRepository,
    AdminDashboardService,
    AdminDashboardRepository,
    AdminUsersService,
    AdminUsersRepository,
    AdminTransactionsService,
    AdminTransactionsRepository,
    AdminTournamentsService,
    AdminTournamentsRepository,
    AdminSupportService,
    AdminSupportRepository,
    AdminMaintenanceService,
    AdminMaintenanceRepository,
    AdminStaffService,
    AdminStaffRepository,
    AdminIpBlacklistService,
    AdminIpBlacklistRepository,
    AdminReferralsService,
    AdminReferralsRepository,
    AdminReportsService,
    AdminReportsRepository,
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminUsersController,
    AdminTransactionsController,
    AdminTournamentsController,
    AdminSupportController,
    AdminMaintenanceController,
    AdminStaffController,
    AdminProfileController,
    AdminRevenueController,
    AdminIpBlacklistController,
    AdminSuggestionsController,
    AdminReferralsController,
    AdminReportsController,
  ],
})
export class AdminModule {}
