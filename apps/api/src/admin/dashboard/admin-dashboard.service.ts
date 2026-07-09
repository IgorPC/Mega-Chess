import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Withdrawal, WithdrawalStatus } from '../../entities/withdrawal.entity';
import { Deposit, DepositStatus } from '../../entities/deposit.entity';
import { Tournament } from '../../entities/tournament.entity';
import { SupportTicket, TicketStatus } from '../../entities/support-ticket.entity';
import { Match, MatchResult } from '../../entities/match.entity';
import { UserActivityLog } from '../../entities/user-activity-log.entity';
import { PlatformRevenueService } from '../../platform-revenue/platform-revenue.service';

function todayRange(): { start: Date; end: Date } {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)              private users:        Repository<User>,
    @InjectRepository(Wallet)            private wallets:      Repository<Wallet>,
    @InjectRepository(WalletTransaction) private txRepo:       Repository<WalletTransaction>,
    @InjectRepository(Withdrawal)        private withdrawals:  Repository<Withdrawal>,
    @InjectRepository(Deposit)           private deposits:     Repository<Deposit>,
    @InjectRepository(Tournament)        private tournaments:  Repository<Tournament>,
    @InjectRepository(SupportTicket)     private tickets:      Repository<SupportTicket>,
    @InjectRepository(Match)             private matches:      Repository<Match>,
    @InjectRepository(UserActivityLog)   private activityLogs: Repository<UserActivityLog>,
    private readonly platformRevenue:    PlatformRevenueService,
  ) {}

  async kpis() {
    const { start, end } = todayRange();
    const range = Between(start, end);

    const [
      newUsersToday,
      activeUsersToday,
      onlineNow,
      matchesToday,
      ongoingMatches,
      tournamentsToday,
      openTicketsToday,
      blockedWithdrawals,
      totalWalletBalance,
    ] = await Promise.all([
      this.users.count({ where: { createdAt: range } }),
      this.activityLogs.createQueryBuilder('al')
        .select('COUNT(DISTINCT al.user_id)', 'cnt')
        .where('al.created_at BETWEEN :start AND :end', { start, end })
        .getRawOne<{ cnt: string }>().then((r) => parseInt(r?.cnt ?? '0')),
      this.users.count({ where: { isOnline: true } }),
      this.matches.count({ where: { createdAt: range } } as any),
      this.matches.count({ where: { status: 'ONGOING' as any } }),
      this.tournaments.count({ where: { createdAt: range } } as any),
      this.tickets.count({ where: { status: TicketStatus.OPEN, createdAt: range } } as any),
      this.withdrawals.count({ where: { status: WithdrawalStatus.BLOCKED } }),
      this.wallets.createQueryBuilder('w').select('SUM(w.balance)', 'total').getRawOne<{ total: string }>(),
    ]);

    // Financial aggregates for today
    const depositsTodayRaw = await this.deposits.createQueryBuilder('d')
      .select('SUM(d.value_brl)', 'total')
      .where('d.status = :s', { s: DepositStatus.COMPLETED })
      .andWhere('d.completed_at BETWEEN :start AND :end', { start, end })
      .getRawOne<{ total: string }>();

    const withdrawalsTodayRaw = await this.withdrawals.createQueryBuilder('w')
      .select('SUM(w.value_brl)', 'total')
      .where('w.status = :s', { s: WithdrawalStatus.COMPLETED })
      .andWhere('w.completed_at BETWEEN :start AND :end', { start, end })
      .getRawOne<{ total: string }>();

    const rakeToday = await this.platformRevenue.todayTotal();

    return {
      newUsersToday,
      activeUsersToday,
      onlineNow,
      matchesToday,
      ongoingMatches,
      tournamentsToday,
      openTicketsToday,
      depositsToday:   depositsTodayRaw?.total   ?? '0',
      withdrawalsToday: withdrawalsTodayRaw?.total ?? '0',
      rakeToday:       rakeToday.toFixed(2),
      blockedWithdrawals,
      totalWalletBalance: totalWalletBalance?.total ?? '0',
    };
  }

  async topWinners() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.txRepo.createQueryBuilder('t')
      .select('t.user_id', 'userId')
      .addSelect('u.nickname', 'nickname')
      .addSelect('SUM(t.amount)', 'totalGainedCc')
      .innerJoin('users', 'u', 'u.id = t.user_id::uuid')
      .where('t.type = :type', { type: 'PRIZE' })
      .andWhere('t.created_at >= :weekAgo', { weekAgo })
      .groupBy('t.user_id, u.nickname')
      .orderBy('SUM(t.amount)', 'DESC')
      .limit(10)
      .getRawMany<{ userId: string; nickname: string; totalGainedCc: string }>();

    // Get win rates from matches
    const results = await Promise.all(rows.map(async (r) => {
      const [wins, total] = await Promise.all([
        this.matches.createQueryBuilder('m')
          .where('(m.result = :w AND m.white_player_id = :uid) OR (m.result = :b AND m.black_player_id = :uid)',
            { w: MatchResult.WHITE_WINS, b: MatchResult.BLACK_WINS, uid: r.userId })
          .getCount(),
        this.matches.createQueryBuilder('m')
          .where('m.white_player_id = :uid OR m.black_player_id = :uid', { uid: r.userId })
          .getCount(),
      ]);
      return { ...r, winRate: total > 0 ? wins / total : 0, riskLevel: null };
    }));

    return results;
  }

  async alerts() {
    const alerts: { id: string; severity: 'error' | 'warning' | 'info'; message: string }[] = [];

    const blocked = await this.withdrawals.count({ where: { status: WithdrawalStatus.BLOCKED } });
    if (blocked > 0) {
      alerts.push({ id: 'blocked-withdrawals', severity: 'error', message: `${blocked} saque(s) bloqueado(s) aguardam revisão manual.` });
    }

    const openTickets = await this.tickets.count({ where: { status: TicketStatus.OPEN } });
    if (openTickets > 10) {
      alerts.push({ id: 'open-tickets', severity: 'warning', message: `${openTickets} tickets em aberto na fila de suporte.` });
    }

    return alerts;
  }
}
