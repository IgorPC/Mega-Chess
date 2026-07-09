import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Withdrawal, WithdrawalStatus } from '../../entities/withdrawal.entity';
import { Deposit, DepositStatus } from '../../entities/deposit.entity';
import { Tournament } from '../../entities/tournament.entity';
import { SupportTicket, TicketStatus } from '../../entities/support-ticket.entity';
import { Match, MatchResult } from '../../entities/match.entity';
import { UserActivityLog } from '../../entities/user-activity-log.entity';
import {
  ADMIN_DASHBOARD_TOP_WINNERS_DAYS,
  ADMIN_DASHBOARD_TOP_WINNERS_LIMIT,
} from './consts/endpoints';

function todayRange(): { start: Date; end: Date } {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

@Injectable()
export class AdminDashboardRepository {
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
  ) {}

  async getKpiCounts() {
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

    return {
      start, end,
      newUsersToday, activeUsersToday, onlineNow, matchesToday, ongoingMatches,
      tournamentsToday, openTicketsToday, blockedWithdrawals, totalWalletBalance,
    };
  }

  getDepositsTodayTotal(start: Date, end: Date) {
    return this.deposits.createQueryBuilder('d')
      .select('SUM(d.value_brl)', 'total')
      .where('d.status = :s', { s: DepositStatus.COMPLETED })
      .andWhere('d.completed_at BETWEEN :start AND :end', { start, end })
      .getRawOne<{ total: string }>();
  }

  getWithdrawalsTodayTotal(start: Date, end: Date) {
    return this.withdrawals.createQueryBuilder('w')
      .select('SUM(w.value_brl)', 'total')
      .where('w.status = :s', { s: WithdrawalStatus.COMPLETED })
      .andWhere('w.completed_at BETWEEN :start AND :end', { start, end })
      .getRawOne<{ total: string }>();
  }

  getTopWinnersRaw() {
    const weekAgo = new Date(Date.now() - ADMIN_DASHBOARD_TOP_WINNERS_DAYS * 24 * 60 * 60 * 1000);
    return this.txRepo.createQueryBuilder('t')
      .select('t.user_id', 'userId')
      .addSelect('u.nickname', 'nickname')
      .addSelect('SUM(t.amount)', 'totalGainedCc')
      .innerJoin('users', 'u', 'u.id = t.user_id::uuid')
      .where('t.type = :type', { type: 'PRIZE' })
      .andWhere('t.created_at >= :weekAgo', { weekAgo })
      .groupBy('t.user_id, u.nickname')
      .orderBy('SUM(t.amount)', 'DESC')
      .limit(ADMIN_DASHBOARD_TOP_WINNERS_LIMIT)
      .getRawMany<{ userId: string; nickname: string; totalGainedCc: string }>();
  }

  countWins(userId: string) {
    return this.matches.createQueryBuilder('m')
      .where('(m.result = :w AND m.white_player_id = :uid) OR (m.result = :b AND m.black_player_id = :uid)',
        { w: MatchResult.WHITE_WINS, b: MatchResult.BLACK_WINS, uid: userId })
      .getCount();
  }

  countMatches(userId: string) {
    return this.matches.createQueryBuilder('m')
      .where('m.white_player_id = :uid OR m.black_player_id = :uid', { uid: userId })
      .getCount();
  }

  countBlockedWithdrawals() {
    return this.withdrawals.count({ where: { status: WithdrawalStatus.BLOCKED } });
  }

  countOpenTickets() {
    return this.tickets.count({ where: { status: TicketStatus.OPEN } });
  }
}
