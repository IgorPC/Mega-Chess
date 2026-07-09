import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { Deposit } from '../../entities/deposit.entity';
import { Withdrawal } from '../../entities/withdrawal.entity';
import { Wallet } from '../../entities/wallet.entity';
import { PlatformRevenue } from '../../platform-revenue/entities/platform-revenue.entity';

function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

@Injectable()
export class AdminTransactionsRepository {
  constructor(
    @InjectRepository(WalletTransaction) private readonly txRepo:      Repository<WalletTransaction>,
    @InjectRepository(Deposit)           private readonly deposits:    Repository<Deposit>,
    @InjectRepository(Withdrawal)        private readonly withdrawals: Repository<Withdrawal>,
    @InjectRepository(Wallet)            private readonly wallets:     Repository<Wallet>,
    @InjectRepository(PlatformRevenue)   private readonly revenue:     Repository<PlatformRevenue>,
    private readonly dataSource: DataSource,
  ) {}

  findAndCountTransactions(page: number, limit: number) {
    return this.txRepo.findAndCount({
      order: { createdAt: 'DESC' },
      ...paginate(page, limit),
    });
  }

  findAndCountDeposits(page: number, limit: number) {
    return this.deposits.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      ...paginate(page, limit),
    });
  }

  findAndCountWithdrawals(where: Record<string, unknown>, page: number, limit: number) {
    return this.withdrawals.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      ...paginate(page, limit),
    });
  }

  queryNicknames(ids: string[]) {
    return this.dataSource.query<{ id: string; nickname: string }[]>(
      'SELECT id::text, nickname FROM users WHERE id = ANY($1::uuid[])', [ids],
    );
  }

  findWithdrawalById(id: string) {
    return this.withdrawals.findOne({ where: { id } });
  }

  findWithdrawalByIdAndStatus(id: string, status: Withdrawal['status']) {
    return this.withdrawals.findOne({ where: { id, status } });
  }

  updateWithdrawal(id: string, data: Partial<Withdrawal>) {
    return this.withdrawals.update(id, data);
  }

  runInTransaction<T>(fn: (em: import('typeorm').EntityManager) => Promise<T>) {
    return this.dataSource.transaction(fn);
  }

  createDepositQueryBuilder() {
    return this.deposits.createQueryBuilder('d');
  }

  createWithdrawalQueryBuilder() {
    return this.withdrawals.createQueryBuilder('w');
  }

  createRevenueQueryBuilder() {
    return this.revenue.createQueryBuilder('r');
  }

  createWalletQueryBuilder() {
    return this.wallets.createQueryBuilder('w');
  }

  createTxQueryBuilder() {
    return this.txRepo.createQueryBuilder('t');
  }
}
