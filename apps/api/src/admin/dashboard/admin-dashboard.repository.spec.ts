import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminDashboardRepository } from './admin-dashboard.repository';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Withdrawal, WithdrawalStatus } from '../../entities/withdrawal.entity';
import { Deposit, DepositStatus } from '../../entities/deposit.entity';
import { Tournament } from '../../entities/tournament.entity';
import { SupportTicket, TicketStatus } from '../../entities/support-ticket.entity';
import { Match, MatchResult } from '../../entities/match.entity';
import { UserActivityLog } from '../../entities/user-activity-log.entity';

function makeQb(overrides: Partial<Record<string, any>> = {}) {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ cnt: '0', total: '0' }),
    getRawMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
  return qb;
}

describe('AdminDashboardRepository', () => {
  let repository: AdminDashboardRepository;
  let users: jest.Mocked<Repository<User>>;
  let wallets: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;
  let withdrawals: jest.Mocked<Repository<Withdrawal>>;
  let deposits: jest.Mocked<Repository<Deposit>>;
  let tournaments: jest.Mocked<Repository<Tournament>>;
  let tickets: jest.Mocked<Repository<SupportTicket>>;
  let matches: jest.Mocked<Repository<Match>>;
  let activityLogs: jest.Mocked<Repository<UserActivityLog>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminDashboardRepository,
        { provide: getRepositoryToken(User), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Wallet), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(WalletTransaction), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Withdrawal), useValue: { count: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Deposit), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Tournament), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(SupportTicket), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Match), useValue: { count: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(UserActivityLog), useValue: { createQueryBuilder: jest.fn() } },
      ],
    }).compile();

    repository = module.get(AdminDashboardRepository);
    users = module.get(getRepositoryToken(User));
    wallets = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(WalletTransaction));
    withdrawals = module.get(getRepositoryToken(Withdrawal));
    deposits = module.get(getRepositoryToken(Deposit));
    tournaments = module.get(getRepositoryToken(Tournament));
    tickets = module.get(getRepositoryToken(SupportTicket));
    matches = module.get(getRepositoryToken(Match));
    activityLogs = module.get(getRepositoryToken(UserActivityLog));
  });

  describe('getKpiCounts', () => {
    it('aggregates all counters in parallel', async () => {
      users.count.mockResolvedValue(5);
      activityLogs.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue({ cnt: '3' }) }));
      matches.count.mockResolvedValue(2);
      tournaments.count.mockResolvedValue(1);
      tickets.count.mockResolvedValue(0);
      withdrawals.count.mockResolvedValue(0);
      wallets.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue({ total: '1000' }) }));

      const result = await repository.getKpiCounts();

      expect(result.newUsersToday).toBe(5);
      expect(result.activeUsersToday).toBe(3);
      expect(result.totalWalletBalance).toEqual({ total: '1000' });
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });

    it('defaults active user count to 0 when the raw query returns nothing', async () => {
      users.count.mockResolvedValue(0);
      activityLogs.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue(undefined) }));
      matches.count.mockResolvedValue(0);
      tournaments.count.mockResolvedValue(0);
      tickets.count.mockResolvedValue(0);
      withdrawals.count.mockResolvedValue(0);
      wallets.createQueryBuilder.mockReturnValue(makeQb());

      const result = await repository.getKpiCounts();
      expect(result.activeUsersToday).toBe(0);
    });
  });

  describe('getDepositsTodayTotal', () => {
    it('queries completed deposits within the date range', async () => {
      const qb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ total: '500' }) });
      deposits.createQueryBuilder.mockReturnValue(qb);

      const start = new Date();
      const end = new Date();
      const result = await repository.getDepositsTodayTotal(start, end);

      expect(qb.where).toHaveBeenCalledWith('d.status = :s', { s: DepositStatus.COMPLETED });
      expect(qb.andWhere).toHaveBeenCalledWith('d.completed_at BETWEEN :start AND :end', { start, end });
      expect(result).toEqual({ total: '500' });
    });
  });

  describe('getWithdrawalsTodayTotal', () => {
    it('queries completed withdrawals within the date range', async () => {
      const qb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ total: '200' }) });
      withdrawals.createQueryBuilder.mockReturnValue(qb);

      const start = new Date();
      const end = new Date();
      const result = await repository.getWithdrawalsTodayTotal(start, end);

      expect(qb.where).toHaveBeenCalledWith('w.status = :s', { s: WithdrawalStatus.COMPLETED });
      expect(result).toEqual({ total: '200' });
    });
  });

  describe('getTopWinnersRaw', () => {
    it('queries the top prize winners over the configured window', async () => {
      const qb = makeQb({ getRawMany: jest.fn().mockResolvedValue([{ userId: '1', nickname: 'Bob', totalGainedCc: '100' }]) });
      txRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.getTopWinnersRaw();

      expect(qb.where).toHaveBeenCalledWith('t.type = :type', { type: 'PRIZE' });
      expect(result).toEqual([{ userId: '1', nickname: 'Bob', totalGainedCc: '100' }]);
    });
  });

  describe('countWins', () => {
    it('counts matches won by the given user', async () => {
      const qb = makeQb({ getCount: jest.fn().mockResolvedValue(4) });
      matches.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.countWins('user-1');

      expect(qb.where).toHaveBeenCalledWith(
        '(m.result = :w AND m.white_player_id = :uid) OR (m.result = :b AND m.black_player_id = :uid)',
        { w: MatchResult.WHITE_WINS, b: MatchResult.BLACK_WINS, uid: 'user-1' },
      );
      expect(result).toBe(4);
    });
  });

  describe('countMatches', () => {
    it('counts all matches played by the given user', async () => {
      const qb = makeQb({ getCount: jest.fn().mockResolvedValue(10) });
      matches.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.countMatches('user-1');

      expect(qb.where).toHaveBeenCalledWith('m.white_player_id = :uid OR m.black_player_id = :uid', { uid: 'user-1' });
      expect(result).toBe(10);
    });
  });

  describe('countBlockedWithdrawals', () => {
    it('counts blocked withdrawals', async () => {
      withdrawals.count.mockResolvedValue(3);
      const result = await repository.countBlockedWithdrawals();
      expect(withdrawals.count).toHaveBeenCalledWith({ where: { status: WithdrawalStatus.BLOCKED } });
      expect(result).toBe(3);
    });
  });

  describe('countOpenTickets', () => {
    it('counts open tickets', async () => {
      tickets.count.mockResolvedValue(7);
      const result = await repository.countOpenTickets();
      expect(tickets.count).toHaveBeenCalledWith({ where: { status: TicketStatus.OPEN } });
      expect(result).toBe(7);
    });
  });
});
