import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdminTransactionsRepository } from './admin-transactions.repository';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Deposit } from '../../entities/deposit.entity';
import { Withdrawal, WithdrawalStatus } from '../../entities/withdrawal.entity';
import { Wallet } from '../../entities/wallet.entity';
import { PlatformRevenue } from '../../platform-revenue/entities/platform-revenue.entity';

describe('AdminTransactionsRepository', () => {
  let repository: AdminTransactionsRepository;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;
  let deposits: jest.Mocked<Repository<Deposit>>;
  let withdrawals: jest.Mocked<Repository<Withdrawal>>;
  let wallets: jest.Mocked<Repository<Wallet>>;
  let revenue: jest.Mocked<Repository<PlatformRevenue>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminTransactionsRepository,
        { provide: getRepositoryToken(WalletTransaction), useValue: { findAndCount: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Deposit), useValue: { findAndCount: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Withdrawal), useValue: { findAndCount: jest.fn(), findOne: jest.fn(), update: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(Wallet), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(PlatformRevenue), useValue: { createQueryBuilder: jest.fn() } },
        { provide: getDataSourceToken(), useValue: { query: jest.fn(), transaction: jest.fn() } },
      ],
    }).compile();

    repository = module.get(AdminTransactionsRepository);
    txRepo = module.get(getRepositoryToken(WalletTransaction));
    deposits = module.get(getRepositoryToken(Deposit));
    withdrawals = module.get(getRepositoryToken(Withdrawal));
    wallets = module.get(getRepositoryToken(Wallet));
    revenue = module.get(getRepositoryToken(PlatformRevenue));
    dataSource = module.get(getDataSourceToken());
  });

  it('findAndCountTransactions paginates ordered by createdAt desc', async () => {
    (txRepo.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
    await repository.findAndCountTransactions(2, 10);
    expect(txRepo.findAndCount).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, skip: 10, take: 10 });
  });

  it('findAndCountDeposits includes user relation', async () => {
    (deposits.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
    await repository.findAndCountDeposits(1, 20);
    expect(deposits.findAndCount).toHaveBeenCalledWith({ relations: ['user'], order: { createdAt: 'DESC' }, skip: 0, take: 20 });
  });

  it('findAndCountWithdrawals applies where filter', async () => {
    (withdrawals.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
    await repository.findAndCountWithdrawals({ status: 'BLOCKED' }, 1, 20);
    expect(withdrawals.findAndCount).toHaveBeenCalledWith({ where: { status: 'BLOCKED' }, order: { createdAt: 'DESC' }, skip: 0, take: 20 });
  });

  it('queryNicknames queries users by ids', async () => {
    (dataSource.query as jest.Mock).mockResolvedValue([{ id: 'u1', nickname: 'nick' }]);
    const result = await repository.queryNicknames(['u1']);
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('FROM users'), [['u1']]);
    expect(result).toEqual([{ id: 'u1', nickname: 'nick' }]);
  });

  it('findWithdrawalById delegates to findOne', async () => {
    (withdrawals.findOne as jest.Mock).mockResolvedValue({ id: 'w1' });
    const result = await repository.findWithdrawalById('w1');
    expect(withdrawals.findOne).toHaveBeenCalledWith({ where: { id: 'w1' } });
    expect(result).toEqual({ id: 'w1' });
  });

  it('findWithdrawalByIdAndStatus filters by status', async () => {
    (withdrawals.findOne as jest.Mock).mockResolvedValue(null);
    await repository.findWithdrawalByIdAndStatus('w1', WithdrawalStatus.BLOCKED);
    expect(withdrawals.findOne).toHaveBeenCalledWith({ where: { id: 'w1', status: WithdrawalStatus.BLOCKED } });
  });

  it('updateWithdrawal delegates to update', async () => {
    await repository.updateWithdrawal('w1', { status: WithdrawalStatus.PROCESSING });
    expect(withdrawals.update).toHaveBeenCalledWith('w1', { status: WithdrawalStatus.PROCESSING });
  });

  it('runInTransaction delegates to dataSource.transaction', async () => {
    const fn = jest.fn();
    (dataSource.transaction as jest.Mock).mockResolvedValue('result');
    const result = await repository.runInTransaction(fn);
    expect(dataSource.transaction).toHaveBeenCalledWith(fn);
    expect(result).toBe('result');
  });

  it('createDepositQueryBuilder builds query builder on deposits', () => {
    const qb = {} as any;
    (deposits.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createDepositQueryBuilder()).toBe(qb);
  });

  it('createWithdrawalQueryBuilder builds query builder on withdrawals', () => {
    const qb = {} as any;
    (withdrawals.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createWithdrawalQueryBuilder()).toBe(qb);
  });

  it('createRevenueQueryBuilder builds query builder on revenue', () => {
    const qb = {} as any;
    (revenue.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createRevenueQueryBuilder()).toBe(qb);
  });

  it('createWalletQueryBuilder builds query builder on wallets', () => {
    const qb = {} as any;
    (wallets.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createWalletQueryBuilder()).toBe(qb);
  });

  it('createTxQueryBuilder builds query builder on txRepo', () => {
    const qb = {} as any;
    (txRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createTxQueryBuilder()).toBe(qb);
  });
});
