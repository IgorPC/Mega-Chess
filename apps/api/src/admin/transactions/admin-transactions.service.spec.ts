import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminTransactionsRepository } from './admin-transactions.repository';
import { AdminAuditService } from '../admin-audit.service';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction, TransactionType } from '../../entities/wallet-transaction.entity';
import { Withdrawal, WithdrawalStatus } from '../../entities/withdrawal.entity';

describe('AdminTransactionsService', () => {
  let service: AdminTransactionsService;
  let repo: jest.Mocked<AdminTransactionsRepository>;
  let audit: jest.Mocked<AdminAuditService>;

  const admin = { id: 'admin-1', name: 'Admin' } as any;

  function makeEm() {
    return {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      create: jest.fn((_entity, data) => data),
    };
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminTransactionsService,
        {
          provide: AdminTransactionsRepository,
          useValue: {
            findAndCountTransactions: jest.fn(),
            findAndCountDeposits: jest.fn(),
            findAndCountWithdrawals: jest.fn(),
            queryNicknames: jest.fn(),
            findWithdrawalById: jest.fn(),
            findWithdrawalByIdAndStatus: jest.fn(),
            updateWithdrawal: jest.fn(),
            runInTransaction: jest.fn(),
            createDepositQueryBuilder: jest.fn(),
            createWithdrawalQueryBuilder: jest.fn(),
            createRevenueQueryBuilder: jest.fn(),
            createWalletQueryBuilder: jest.fn(),
            createTxQueryBuilder: jest.fn(),
          },
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminTransactionsService);
    repo = module.get(AdminTransactionsRepository);
    audit = module.get(AdminAuditService);
  });

  describe('listTransactions', () => {
    it('resolves nicknames for listed transactions', async () => {
      repo.findAndCountTransactions.mockResolvedValue([[{ userId: 'u1' }], 1] as any);
      repo.queryNicknames.mockResolvedValue([{ id: 'u1', nickname: 'nick' }] as any);

      const result = await service.listTransactions();
      expect(result.data[0].userNickname).toBe('nick');
      expect(result.total).toBe(1);
    });

    it('skips nickname lookup when there are no user ids', async () => {
      repo.findAndCountTransactions.mockResolvedValue([[], 0] as any);
      const result = await service.listTransactions();
      expect(repo.queryNicknames).not.toHaveBeenCalled();
      expect(result.data).toEqual([]);
    });
  });

  describe('listDeposits', () => {
    it('maps deposit nickname from relation', async () => {
      repo.findAndCountDeposits.mockResolvedValue([[{ id: 'd1', user: { nickname: 'n' } }], 1] as any);
      const result = await service.listDeposits();
      expect(result.data[0].userNickname).toBe('n');
    });

    it('defaults nickname to empty string when relation missing', async () => {
      repo.findAndCountDeposits.mockResolvedValue([[{ id: 'd1' }], 1] as any);
      const result = await service.listDeposits();
      expect(result.data[0].userNickname).toBe('');
    });
  });

  describe('listWithdrawals', () => {
    it('applies status filter and resolves nicknames', async () => {
      repo.findAndCountWithdrawals.mockResolvedValue([[{ userId: 'u1', feeCc: '1.00' }], 1] as any);
      repo.queryNicknames.mockResolvedValue([{ id: 'u1', nickname: 'nick' }] as any);

      const result = await service.listWithdrawals(1, 20, 'BLOCKED');
      expect(repo.findAndCountWithdrawals).toHaveBeenCalledWith({ status: 'BLOCKED' }, 1, 20);
      expect(result.data[0].userNickname).toBe('nick');
      expect(result.data[0].fee).toBe('1.00');
    });

    it('omits status filter when not provided', async () => {
      repo.findAndCountWithdrawals.mockResolvedValue([[], 0] as any);
      await service.listWithdrawals();
      expect(repo.findAndCountWithdrawals).toHaveBeenCalledWith({}, 1, 20);
    });
  });

  describe('approveWithdrawal', () => {
    it('throws NotFoundException when withdrawal missing', async () => {
      repo.findWithdrawalById.mockResolvedValue(null);
      await expect(service.approveWithdrawal('w1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when not BLOCKED', async () => {
      repo.findWithdrawalById.mockResolvedValue({ id: 'w1', status: WithdrawalStatus.PENDING } as any);
      await expect(service.approveWithdrawal('w1', admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('approves a BLOCKED withdrawal and logs audit', async () => {
      repo.findWithdrawalById.mockResolvedValue({ id: 'w1', status: WithdrawalStatus.BLOCKED } as any);
      await service.approveWithdrawal('w1', admin);
      expect(repo.updateWithdrawal).toHaveBeenCalledWith('w1', { status: WithdrawalStatus.PROCESSING });
      expect(audit.log).toHaveBeenCalledWith(admin, 'WITHDRAWAL_APPROVED', expect.objectContaining({ targetId: 'w1' }));
    });
  });

  describe('rejectWithdrawal', () => {
    it('throws NotFoundException when blocked withdrawal not found', async () => {
      repo.findWithdrawalByIdAndStatus.mockResolvedValue(null);
      await expect(service.rejectWithdrawal('w1', 'reason', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refunds the user and marks withdrawal FAILED', async () => {
      repo.findWithdrawalByIdAndStatus.mockResolvedValue({ id: 'w1', userId: 'u1', valueCc: '10.00' } as any);
      const em = makeEm();
      em.findOne.mockResolvedValue({ userId: 'u1', balance: '5.00' });
      repo.runInTransaction.mockImplementation((fn: any) => fn(em));

      await service.rejectWithdrawal('w1', 'suspeito', admin);

      expect(em.update).toHaveBeenCalledWith(Wallet, { userId: 'u1' }, { balance: '15.00' });
      expect(em.update).toHaveBeenCalledWith(Withdrawal, 'w1', { status: WithdrawalStatus.FAILED, blockReason: 'suspeito' });
      expect(audit.log).toHaveBeenCalledWith(admin, 'WITHDRAWAL_REJECTED', expect.objectContaining({ details: 'suspeito' }));
    });

    it('skips refund when wallet is not found', async () => {
      repo.findWithdrawalByIdAndStatus.mockResolvedValue({ id: 'w1', userId: 'u1', valueCc: '10.00' } as any);
      const em = makeEm();
      em.findOne.mockResolvedValue(null);
      repo.runInTransaction.mockImplementation((fn: any) => fn(em));

      await service.rejectWithdrawal('w1', 'suspeito', admin);
      expect(em.update).not.toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    it('throws BadRequestException for non-positive amount', async () => {
      await expect(service.refund('u1', 0, 'motivo', admin)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.refund('u1', -5, 'motivo', admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('credits an existing wallet', async () => {
      const em = makeEm();
      em.findOne.mockResolvedValue({ userId: 'u1', balance: '5.00' });
      repo.runInTransaction.mockImplementation((fn: any) => fn(em));

      await service.refund('u1', 10, 'reembolso', admin);
      expect(em.update).toHaveBeenCalledWith(Wallet, { userId: 'u1' }, { balance: '15.00' });
      expect(audit.log).toHaveBeenCalledWith(admin, 'MANUAL_REFUND', expect.objectContaining({ targetId: 'u1' }));
    });

    it('creates a new wallet when the user has none', async () => {
      const em = makeEm();
      em.findOne.mockResolvedValue(null);
      repo.runInTransaction.mockImplementation((fn: any) => fn(em));

      await service.refund('u1', 10, 'reembolso', admin);
      expect(em.save).toHaveBeenCalled();
      expect(em.update).toHaveBeenCalledWith(Wallet, { userId: 'u1' }, { balance: '10.00' });
    });
  });

  describe('financialSummary', () => {
    function makeQb(result: { total: string } | undefined) {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(result),
      };
    }

    it('aggregates deposits, withdrawals, wallet balance and rake', async () => {
      repo.createDepositQueryBuilder.mockReturnValue(makeQb({ total: '100' }) as any);
      repo.createWithdrawalQueryBuilder.mockReturnValue(makeQb({ total: '40' }) as any);
      repo.createWalletQueryBuilder.mockReturnValue(makeQb({ total: '500' }) as any);
      repo.createRevenueQueryBuilder.mockReturnValue(makeQb({ total: '10' }) as any);

      const result = await service.financialSummary('all');
      expect(result).toEqual({
        totalDeposits: '100.00', totalWithdrawals: '40.00', totalWalletBalance: '500.00', totalRake: '10.00',
      });
    });

    it('defaults totals to 0.00 when no rows are returned', async () => {
      repo.createDepositQueryBuilder.mockReturnValue(makeQb(undefined) as any);
      repo.createWithdrawalQueryBuilder.mockReturnValue(makeQb(undefined) as any);
      repo.createWalletQueryBuilder.mockReturnValue(makeQb(undefined) as any);
      repo.createRevenueQueryBuilder.mockReturnValue(makeQb(undefined) as any);

      const result = await service.financialSummary('7d');
      expect(result.totalDeposits).toBe('0.00');
    });

    it('applies a period filter for recognized periods', async () => {
      const depositQb = makeQb({ total: '1' });
      repo.createDepositQueryBuilder.mockReturnValue(depositQb as any);
      repo.createWithdrawalQueryBuilder.mockReturnValue(makeQb({ total: '1' }) as any);
      repo.createWalletQueryBuilder.mockReturnValue(makeQb({ total: '1' }) as any);
      repo.createRevenueQueryBuilder.mockReturnValue(makeQb({ total: '1' }) as any);

      await service.financialSummary('30d');
      expect(depositQb.andWhere).toHaveBeenCalled();
    });
  });

  describe('rakeSummary', () => {
    function makeTxQb(rows: any[], total: { total: string } | undefined) {
      return {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
        getRawOne: jest.fn().mockResolvedValue(total),
      };
    }

    it('returns chart rows and total for the given period', async () => {
      repo.createTxQueryBuilder.mockReturnValue(makeTxQb([{ date: '2026-01-01', rakeCc: '5' }], { total: '5' }) as any);
      const result = await service.rakeSummary('7d');
      expect(result.totalCc).toBe('5');
      expect(result.chart).toEqual([{ date: '2026-01-01', rakeCc: '5' }]);
    });

    it('defaults totalCc to 0 when no rows exist', async () => {
      repo.createTxQueryBuilder.mockReturnValue(makeTxQb([], undefined) as any);
      const result = await service.rakeSummary('90d');
      expect(result.totalCc).toBe('0');
    });

    it('defaults to 30 days for unrecognized period', async () => {
      const qb = makeTxQb([], { total: '0' });
      repo.createTxQueryBuilder.mockReturnValue(qb as any);
      await service.rakeSummary('unknown');
      expect(qb.andWhere).toHaveBeenCalled();
    });
  });
});
