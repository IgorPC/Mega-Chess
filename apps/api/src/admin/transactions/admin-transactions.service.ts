import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction, TransactionType } from '../../entities/wallet-transaction.entity';
import { Withdrawal, WithdrawalStatus } from '../../entities/withdrawal.entity';
import { AdminAuditService } from '../admin-audit.service';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminTransactionsRepository } from './admin-transactions.repository';
import { ADMIN_TRANSACTIONS_DEFAULTS, ADMIN_TRANSACTIONS_PERIOD_DAYS } from './consts/endpoints';

function periodSince(period: string): Date | null {
  const days = ADMIN_TRANSACTIONS_PERIOD_DAYS[period];
  if (!days) return null; // 'all' or unknown → no filter
  return new Date(Date.now() - days * 86_400_000);
}

@Injectable()
export class AdminTransactionsService {
  constructor(
    private readonly repo: AdminTransactionsRepository,
    private readonly audit: AdminAuditService,
  ) {}

  async listTransactions(page = ADMIN_TRANSACTIONS_DEFAULTS.PAGE, limit = ADMIN_TRANSACTIONS_DEFAULTS.LIMIT) {
    const [items, total] = await this.repo.findAndCountTransactions(page, limit);

    const ids = [...new Set(items.map((t) => t.userId).filter(Boolean))];
    const nicknames = ids.length ? await this.repo.queryNicknames(ids) : [];
    const nickMap = new Map(nicknames.map((u) => [u.id, u.nickname]));
    const data = items.map((t) => ({ ...t, userNickname: nickMap.get(t.userId) ?? '' }));
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async listDeposits(page = ADMIN_TRANSACTIONS_DEFAULTS.PAGE, limit = ADMIN_TRANSACTIONS_DEFAULTS.LIMIT) {
    const [items, total] = await this.repo.findAndCountDeposits(page, limit);
    const data = items.map((d) => ({ ...d, userNickname: (d as any).user?.nickname ?? '' }));
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async listWithdrawals(page = ADMIN_TRANSACTIONS_DEFAULTS.PAGE, limit = ADMIN_TRANSACTIONS_DEFAULTS.LIMIT, status?: string) {
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;

    const [items, total] = await this.repo.findAndCountWithdrawals(where, page, limit);

    const ids = [...new Set(items.map((w) => w.userId).filter(Boolean))];
    const nicknames = ids.length ? await this.repo.queryNicknames(ids) : [];
    const nickMap = new Map(nicknames.map((u) => [u.id, u.nickname]));
    const data = items.map((w) => ({
      ...w, userNickname: nickMap.get(w.userId) ?? '',
      fee: w.feeCc, riskLevel: null, riskScore: null, aiFlags: null,
    }));
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async approveWithdrawal(id: string, admin: AdminUser) {
    const w = await this.repo.findWithdrawalById(id);
    if (!w) throw new NotFoundException('Saque não encontrado');
    if (w.status !== WithdrawalStatus.BLOCKED) {
      throw new BadRequestException('Apenas saques BLOCKED podem ser aprovados manualmente');
    }
    await this.repo.updateWithdrawal(id, { status: WithdrawalStatus.PROCESSING });
    this.audit.log(admin, 'WITHDRAWAL_APPROVED', { targetType: 'withdrawal', targetId: id });
  }

  async rejectWithdrawal(id: string, reason: string, admin: AdminUser) {
    const w = await this.repo.findWithdrawalByIdAndStatus(id, WithdrawalStatus.BLOCKED);
    if (!w) throw new NotFoundException('Saque bloqueado não encontrado');

    // Estorno: devolve $CC ao usuário
    await this.repo.runInTransaction(async (em) => {
      const wallet = await em.findOne(Wallet, { where: { userId: w.userId } });
      if (!wallet) return;
      const newBalance = (parseFloat(wallet.balance) + parseFloat(w.valueCc)).toFixed(2);
      await em.update(Wallet, { userId: w.userId }, { balance: newBalance });
      await em.save(em.create(WalletTransaction, {
        userId: w.userId,
        type: TransactionType.REFUND,
        amount: w.valueCc,
        balanceAfter: newBalance,
        referenceId: id,
        description: `Estorno saque rejeitado: ${reason}`,
      }));
      await em.update(Withdrawal, id, { status: WithdrawalStatus.FAILED, blockReason: reason });
    });

    this.audit.log(admin, 'WITHDRAWAL_REJECTED', { targetType: 'withdrawal', targetId: id, details: reason });
  }

  async refund(userId: string, amountCc: number, reason: string, admin: AdminUser) {
    if (amountCc <= 0) throw new BadRequestException('Valor inválido');
    await this.repo.runInTransaction(async (em) => {
      let wallet = await em.findOne(Wallet, { where: { userId } });
      if (!wallet) {
        wallet = em.create(Wallet, { userId, balance: '0.00' });
        await em.save(wallet);
      }
      const newBalance = (parseFloat(wallet.balance) + amountCc).toFixed(2);
      await em.update(Wallet, { userId }, { balance: newBalance });
      await em.save(em.create(WalletTransaction, {
        userId,
        type: TransactionType.REFUND,
        amount: amountCc.toFixed(2),
        balanceAfter: newBalance,
        description: `Reembolso manual: ${reason}`,
      }));
    });
    this.audit.log(admin, 'MANUAL_REFUND', { targetType: 'user', targetId: userId, details: `${amountCc} $CC — ${reason}` });
  }

  async financialSummary(period = ADMIN_TRANSACTIONS_DEFAULTS.FINANCIAL_SUMMARY_PERIOD) {
    const since = periodSince(period);

    const depositQb = this.repo.createDepositQueryBuilder()
      .select('SUM(d.value_brl)', 'total')
      .where('d.status = :s', { s: 'COMPLETED' });
    if (since) depositQb.andWhere('d.created_at >= :since', { since });

    const withdrawalQb = this.repo.createWithdrawalQueryBuilder()
      .select('SUM(w.value_brl)', 'total')
      .where('w.status = :s', { s: 'COMPLETED' });
    if (since) withdrawalQb.andWhere('w.created_at >= :since', { since });

    // Rake is stored in platform_revenue (RAKE_DUEL + RAKE_TOURNAMENT)
    const rakeQb = this.repo.createRevenueQueryBuilder()
      .select('SUM(r.amount_cc)', 'total')
      .where("r.type IN ('RAKE_DUEL', 'RAKE_TOURNAMENT')");
    if (since) rakeQb.andWhere('r.created_at >= :since', { since });

    // Wallet balance is always the current snapshot (no period filter)
    const [totalDeposits, totalWithdrawals, totalWalletBalance, totalRake] = await Promise.all([
      depositQb.getRawOne<{ total: string }>(),
      withdrawalQb.getRawOne<{ total: string }>(),
      this.repo.createWalletQueryBuilder().select('SUM(w.balance)', 'total').getRawOne<{ total: string }>(),
      rakeQb.getRawOne<{ total: string }>(),
    ]);

    return {
      totalDeposits:      parseFloat(totalDeposits?.total      ?? '0').toFixed(2),
      totalWithdrawals:   parseFloat(totalWithdrawals?.total   ?? '0').toFixed(2),
      totalWalletBalance: parseFloat(totalWalletBalance?.total ?? '0').toFixed(2),
      totalRake:          parseFloat(totalRake?.total          ?? '0').toFixed(2),
    };
  }

  async rakeSummary(period: string = ADMIN_TRANSACTIONS_DEFAULTS.RAKE_SUMMARY_PERIOD) {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.repo.createTxQueryBuilder()
      .select("DATE(t.created_at)", 'date')
      .addSelect('SUM(t.amount)', 'rakeCc')
      .where('t.type = :type', { type: TransactionType.RAKE })
      .andWhere('t.created_at >= :since', { since })
      .groupBy("DATE(t.created_at)")
      .orderBy("DATE(t.created_at)", 'ASC')
      .getRawMany<{ date: string; rakeCc: string }>();

    const totalRaw = await this.repo.createTxQueryBuilder()
      .select('SUM(t.amount)', 'total')
      .where('t.type = :type', { type: TransactionType.RAKE })
      .andWhere('t.created_at >= :since', { since })
      .getRawOne<{ total: string }>();

    return { totalCc: totalRaw?.total ?? '0', chart: rows };
  }
}
