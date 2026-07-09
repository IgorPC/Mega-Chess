import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminDashboardService } from './admin-dashboard.service';
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

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  let users: jest.Mocked<Repository<User>>;
  let wallets: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;
  let withdrawals: jest.Mocked<Repository<Withdrawal>>;
  let deposits: jest.Mocked<Repository<Deposit>>;
  let tournaments: jest.Mocked<Repository<Tournament>>;
  let tickets: jest.Mocked<Repository<SupportTicket>>;
  let matches: jest.Mocked<Repository<Match>>;
  let activityLogs: jest.Mocked<Repository<UserActivityLog>>;
  let platformRevenue: jest.Mocked<PlatformRevenueService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: getRepositoryToken(User), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Wallet), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(WalletTransaction), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Withdrawal), useValue: { count: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Deposit), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Tournament), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(SupportTicket), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(Match), useValue: { count: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(UserActivityLog), useValue: { createQueryBuilder: jest.fn() } },
        { provide: PlatformRevenueService, useValue: { todayTotal: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminDashboardService);
    users = module.get(getRepositoryToken(User));
    wallets = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(WalletTransaction));
    withdrawals = module.get(getRepositoryToken(Withdrawal));
    deposits = module.get(getRepositoryToken(Deposit));
    tournaments = module.get(getRepositoryToken(Tournament));
    tickets = module.get(getRepositoryToken(SupportTicket));
    matches = module.get(getRepositoryToken(Match));
    activityLogs = module.get(getRepositoryToken(UserActivityLog));
    platformRevenue = module.get(PlatformRevenueService);

    users.count.mockResolvedValue(0);
    activityLogs.createQueryBuilder.mockReturnValue(makeQb());
    matches.count.mockResolvedValue(0);
    matches.createQueryBuilder.mockReturnValue(makeQb());
    tournaments.count.mockResolvedValue(0);
    tickets.count.mockResolvedValue(0);
    withdrawals.count.mockResolvedValue(0);
    withdrawals.createQueryBuilder.mockReturnValue(makeQb());
    wallets.createQueryBuilder.mockReturnValue(makeQb());
    deposits.createQueryBuilder.mockReturnValue(makeQb());
    platformRevenue.todayTotal.mockResolvedValue(0);
  });

  describe('kpis', () => {
    it('aggregates all metrics into a single response object', async () => {
      users.count.mockResolvedValue(10);
      withdrawals.count.mockResolvedValue(2);
      deposits.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue({ total: '300' }) }));
      withdrawals.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue({ total: '150' }) }));
      platformRevenue.todayTotal.mockResolvedValue(42.5);

      const result = await service.kpis();

      expect(result.newUsersToday).toBe(10);
      expect(result.blockedWithdrawals).toBe(2);
      expect(result.depositsToday).toBe('300');
      expect(result.withdrawalsToday).toBe('150');
      expect(result.rakeToday).toBe('42.50');
    });

    it('defaults active users to 0 when the raw activity query returns nothing', async () => {
      activityLogs.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue(undefined) }));

      const result = await service.kpis();

      expect(result.activeUsersToday).toBe(0);
    });

    it('defaults financial totals to "0" when queries return nothing', async () => {
      deposits.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue(undefined) }));
      withdrawals.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue(undefined) }));
      wallets.createQueryBuilder.mockReturnValue(makeQb({ getRawOne: jest.fn().mockResolvedValue(undefined) }));

      const result = await service.kpis();

      expect(result.depositsToday).toBe('0');
      expect(result.withdrawalsToday).toBe('0');
      expect(result.totalWalletBalance).toBe('0');
    });
  });

  describe('topWinners', () => {
    it('returns an empty list when there are no winners', async () => {
      txRepo.createQueryBuilder.mockReturnValue(makeQb({ getRawMany: jest.fn().mockResolvedValue([]) }));
      const result = await service.topWinners();
      expect(result).toEqual([]);
    });

    it('computes the win rate for each winner', async () => {
      txRepo.createQueryBuilder.mockReturnValue(
        makeQb({ getRawMany: jest.fn().mockResolvedValue([{ userId: 'u1', nickname: 'Bob', totalGainedCc: '500' }]) }),
      );
      matches.createQueryBuilder
        .mockReturnValueOnce(makeQb({ getCount: jest.fn().mockResolvedValue(3) }))
        .mockReturnValueOnce(makeQb({ getCount: jest.fn().mockResolvedValue(6) }));

      const result = await service.topWinners();

      expect(result).toEqual([
        { userId: 'u1', nickname: 'Bob', totalGainedCc: '500', winRate: 0.5, riskLevel: null },
      ]);
    });

    it('reports a 0 win rate when the user has played no matches', async () => {
      txRepo.createQueryBuilder.mockReturnValue(
        makeQb({ getRawMany: jest.fn().mockResolvedValue([{ userId: 'u2', nickname: 'Carl', totalGainedCc: '10' }]) }),
      );
      matches.createQueryBuilder
        .mockReturnValueOnce(makeQb({ getCount: jest.fn().mockResolvedValue(0) }))
        .mockReturnValueOnce(makeQb({ getCount: jest.fn().mockResolvedValue(0) }));

      const result = await service.topWinners();

      expect(result[0].winRate).toBe(0);
    });
  });

  describe('alerts', () => {
    it('returns an empty array when nothing needs attention', async () => {
      withdrawals.count.mockResolvedValue(0);
      tickets.count.mockResolvedValue(0);

      const result = await service.alerts();
      expect(result).toEqual([]);
    });

    it('adds an error alert when there are blocked withdrawals', async () => {
      withdrawals.count.mockResolvedValue(3);
      tickets.count.mockResolvedValue(0);

      const result = await service.alerts();

      expect(result).toContainEqual({
        id: 'blocked-withdrawals',
        severity: 'error',
        message: '3 saque(s) bloqueado(s) aguardam revisão manual.',
      });
    });

    it('adds a warning alert when open tickets exceed the threshold', async () => {
      withdrawals.count.mockResolvedValue(0);
      tickets.count.mockResolvedValue(11);

      const result = await service.alerts();

      expect(result).toContainEqual({
        id: 'open-tickets',
        severity: 'warning',
        message: '11 tickets em aberto na fila de suporte.',
      });
    });

    it('does not add a ticket alert when at or below the threshold', async () => {
      withdrawals.count.mockResolvedValue(0);
      tickets.count.mockResolvedValue(10);

      const result = await service.alerts();
      expect(result.find((a) => a.id === 'open-tickets')).toBeUndefined();
    });
  });
});
