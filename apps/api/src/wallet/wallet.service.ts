import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger,
  Inject, forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { WalletTransaction } from '../entities/wallet-transaction.entity';
import { Deposit, DepositStatus } from '../entities/deposit.entity';
import { Withdrawal, WithdrawalStatus, PixKeyType } from '../entities/withdrawal.entity';
import { AsaasService } from '../asaas/asaas.service';
import { DeepseekService } from '../deepseek/deepseek.service';
import { EmailService } from '../email/email.service';
import { PlatformRevenueService } from '../platform-revenue/platform-revenue.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { UserAction } from '../entities/user-activity-log.entity';
import { PlatformRevenueType } from '../platform-revenue/entities/platform-revenue.entity';
import { AiFeature } from '../entities/ai-usage-log.entity';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { ReferralEarning } from '../referrals/entities/referral-earning.entity';
import { TransactionType } from '../entities/wallet-transaction.entity';
import { GameGateway } from '../game/game.gateway';
import { SANDBOX_AUTO_APPROVE_DELAY_MS } from '../asaas/consts/asaas.consts';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet) private wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction) private txRepo: Repository<WalletTransaction>,
    @InjectRepository(Deposit) private deposits: Repository<Deposit>,
    @InjectRepository(Withdrawal) private withdrawals: Repository<Withdrawal>,
    @InjectRepository(Match) private matches: Repository<Match>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Referral) private referrals: Repository<Referral>,
    @InjectRepository(ReferralEarning) private referralEarnings: Repository<ReferralEarning>,
    private dataSource: DataSource,
    private asaas: AsaasService,
    private deepseek: DeepseekService,
    private email: EmailService,
    private platformRevenue: PlatformRevenueService,
    private activity: UserActivityService,
    private platformConfig: PlatformConfigService,
    @Inject(forwardRef(() => GameGateway)) private gameGateway: GameGateway,
  ) {}

  // â”€â”€â”€ Balance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const existing = await this.wallets.findOne({ where: { userId } });
    if (existing) return existing;
    try {
      return await this.wallets.save(this.wallets.create({ userId, balance: '0.00' }));
    } catch {
      // Concurrent insert hit the unique constraint â€” fetch the winner's row
      return this.wallets.findOne({ where: { userId } });
    }
  }

  async getBalance(userId: string) {
    const wallet = await this.getOrCreateWallet(userId);
    return { balance: parseFloat(wallet.balance) };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.txRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // â”€â”€â”€ Internal credit / debit (atomic via DB transaction) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async credit(
    userId: string,
    amount: number,
    type: TransactionType,
    referenceId?: string,
    description?: string,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (em) => {
      const wallet = await em.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      }) ?? await em.save(Wallet, em.create(Wallet, { userId, balance: '0.00' }));

      const newBalance = (Math.round(parseFloat(wallet.balance) * 100) + Math.round(amount * 100)) / 100;
      await em.update(Wallet, { userId }, { balance: newBalance.toFixed(2) });

      return em.save(WalletTransaction, em.create(WalletTransaction, {
        userId, type, amount: amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        referenceId: referenceId ?? null,
        description: description ?? null,
      }));
    });
  }

  async debit(
    userId: string,
    amount: number,
    type: TransactionType,
    referenceId?: string,
    description?: string,
  ): Promise<WalletTransaction> {
    return this.dataSource.transaction(async (em) => {
      const wallet = await em.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      const currentCents = wallet ? Math.round(parseFloat(wallet.balance) * 100) : 0;
      const amountCents = Math.round(amount * 100);
      if (currentCents < amountCents) {
        throw new BadRequestException('Saldo insuficiente de $CC');
      }
      const newBalance = (currentCents - amountCents) / 100;
      if (wallet) {
        await em.update(Wallet, { userId }, { balance: newBalance.toFixed(2) });
      }
      return em.save(WalletTransaction, em.create(WalletTransaction, {
        userId, type, amount: (-amount).toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        referenceId: referenceId ?? null,
        description: description ?? null,
      }));
    });
  }

  /** Verifica se o usuÃ¡rio tem saldo suficiente sem debitar. LanÃ§a BadRequestException se nÃ£o. */
  async assertBalance(userId: string, amount: number): Promise<void> {
    const wallet = await this.wallets.findOne({ where: { userId } });
    const balanceCents = wallet ? Math.round(parseFloat(wallet.balance) * 100) : 0;
    if (balanceCents < Math.round(amount * 100)) {
      throw new BadRequestException(`Saldo insuficiente. NecessÃ¡rio: ${amount} CC`);
    }
  }

  /**
   * DÃ©bito dentro de um EntityManager jÃ¡ ativo (para uso em DataSource.transaction callbacks).
   * NÃ£o abre nova transaÃ§Ã£o â€” usa o `em` recebido.
   */
  async debitTx(
    em: import('typeorm').EntityManager,
    userId: string,
    amount: number,
    type: TransactionType,
    referenceId?: string,
    description?: string,
  ): Promise<void> {
    const wallet = await em.findOne(Wallet, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    const currentCents = wallet ? Math.round(parseFloat(wallet.balance) * 100) : 0;
    const amountCents  = Math.round(amount * 100);
    if (currentCents < amountCents) {
      throw new BadRequestException('Saldo insuficiente de CC');
    }
    const newBalance = (currentCents - amountCents) / 100;
    if (wallet) {
      await em.update(Wallet, { userId }, { balance: newBalance.toFixed(2) });
    }
    await em.save(WalletTransaction, em.create(WalletTransaction, {
      userId, type, amount: (-amount).toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      referenceId: referenceId ?? null,
      description: description ?? null,
    }));
  }

  // â”€â”€â”€ Deposit (PIX â†’ $CC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async createDeposit(userId: string, valueBrl: number, cpf?: string) {
    // Auto-expire pending deposits whose PIX QR has passed its expiry time
    await this.deposits
      .createQueryBuilder()
      .update()
      .set({ status: DepositStatus.EXPIRED, qrCode: null, copyPaste: null })
      .where('user_id = :userId AND status = :status AND expires_at < NOW()', {
        userId, status: DepositStatus.PENDING,
      })
      .execute();

    const deposit = await this.deposits.save(
      this.deposits.create({ userId, valueBrl: valueBrl.toFixed(2) }),
    );

    try {
      const { paymentId, qrCode, copyPaste, expiresAt } =
        await this.asaas.createPixPayment(userId, valueBrl, deposit.id, cpf);

      const expiresDate = new Date(Date.now() + 3 * 60 * 60 * 1000);
      await this.deposits.update(deposit.id, {
        asaasPaymentId: paymentId,
        qrCode,
        copyPaste,
        expiresAt: expiresDate,
      });
      const user = await this.users.findOne({ where: { id: userId }, select: ['email', 'name'] });
      if (user) this.email.sendDepositCreated(user.email, user.name, valueBrl, deposit.id);
      this.activity.log(userId, UserAction.DEPOSIT_INITIATED, { depositId: deposit.id, valueBrl });

      if (this.asaas.isSandboxEnv()) {
        this.scheduleSandboxAutoApprove(paymentId);
      }

      return { depositId: deposit.id, qrCode, copyPaste, expiresAt: expiresDate.toISOString(), valueBrl };
    } catch (err) {
      await this.deposits.delete(deposit.id);
      throw err;
    }
  }

  // Sandbox-only: credits the deposit directly instead of waiting for a real
  // Asaas webhook, which can never reach us from an unreachable dev/local URL.
  // Reuses confirmDeposit so the crediting logic is identical to production.
  // Never runs when ASAAS_ENV=production (guarded by isSandboxEnv() at the call site).
  private scheduleSandboxAutoApprove(paymentId: string): void {
    const timer = setTimeout(() => {
      this.confirmDeposit(paymentId).then((result) => {
        if (result) {
          this.gameGateway.emitToUser(result.userId, 'deposit_confirmed', {
            valueBrl: result.valueBrl,
            balance: result.balance,
          });
        }
      }).catch((err) => {
        this.logger.warn(`[SANDBOX AUTO-APPROVE] failed paymentId=${paymentId}`, err instanceof Error ? err.stack : String(err));
      });
    }, SANDBOX_AUTO_APPROVE_DELAY_MS);
    timer.unref?.();
  }

  async getDeposits(userId: string, page = 1, limit = 15) {
    // Expire stale pending deposits before returning
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await this.deposits
      .createQueryBuilder()
      .update()
      .set({ status: DepositStatus.EXPIRED })
      .where('user_id = :userId AND status = :status AND created_at < :cutoff', {
        userId, status: DepositStatus.PENDING, cutoff: threeHoursAgo,
      })
      .execute();

    const [items, total] = await this.deposits.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'asaasPaymentId', 'valueBrl', 'status', 'qrCode', 'copyPaste', 'expiresAt', 'createdAt', 'completedAt'],
    });
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async cancelDeposit(userId: string, depositId: string) {
    let asaasPaymentId: string | null = null;

    await this.dataSource.transaction(async (em) => {
      const deposit = await em.findOne(Deposit, {
        where: { id: depositId, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!deposit) throw new NotFoundException('DepÃ³sito nÃ£o encontrado');
      if (deposit.status !== DepositStatus.PENDING) {
        throw new ForbiddenException('Apenas depÃ³sitos pendentes podem ser cancelados');
      }
      await em.update(Deposit, depositId, { status: DepositStatus.CANCELLED, qrCode: null, copyPaste: null });
      asaasPaymentId = deposit.asaasPaymentId;
    });

    if (asaasPaymentId) {
      try {
        await this.asaas.cancelPayment(asaasPaymentId);
      } catch (err) {
        this.logger.warn(`Asaas cancelPayment best-effort failed depositId=${depositId} paymentId=${asaasPaymentId}`, err instanceof Error ? err.stack : String(err));
      }
    }
    this.activity.log(userId, UserAction.DEPOSIT_CANCELLED, { depositId });
    return { ok: true };
  }

  async confirmDeposit(asaasPaymentId: string): Promise<{ userId: string; balance: number; valueBrl: number } | null> {
    return this.dataSource.transaction(async (em) => {
      const deposit = await em.findOne(Deposit, {
        where: { asaasPaymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!deposit || deposit.status !== DepositStatus.PENDING) return null;

      // Use the amount stored in OUR DB â€” never the webhook body value
      const valueBrl = parseFloat(deposit.valueBrl);

      await em.update(Deposit, deposit.id, {
        status: DepositStatus.COMPLETED,
        completedAt: new Date(),
        qrCode: null,
        copyPaste: null,
      });

      let wallet = await em.findOne(Wallet, {
        where: { userId: deposit.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        wallet = await em.save(Wallet, em.create(Wallet, { userId: deposit.userId, balance: '0.00' }));
      }

      // Use integer cents to avoid floating-point drift
      const newBalanceCents = Math.round(parseFloat(wallet.balance) * 100) + Math.round(valueBrl * 100);
      const newBalance = newBalanceCents / 100;
      await em.update(Wallet, { userId: deposit.userId }, { balance: newBalance.toFixed(2) });

      await em.save(WalletTransaction, em.create(WalletTransaction, {
        userId: deposit.userId,
        type: TransactionType.DEPOSIT,
        amount: valueBrl.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        referenceId: deposit.id,
        description: `DepÃ³sito PIX confirmado â€” R$ ${valueBrl.toFixed(2)}`,
      }));

      this.logger.log(`Deposit confirmed userId=${deposit.userId} valueBrl=${valueBrl} newBalance=${newBalance}`);
      const result = { userId: deposit.userId, balance: newBalance, valueBrl };
      return result;
    }).then(async (result) => {
      const user = await this.users.findOne({ where: { id: result.userId }, select: ['email', 'name'] });
      if (user) this.email.sendDepositConfirmed(user.email, user.name, result.valueBrl, result.balance);
      this.activity.log(result.userId, UserAction.DEPOSIT_CONFIRMED, { valueBrl: result.valueBrl, balance: result.balance });
      return result;
    });
  }

  // â”€â”€â”€ Withdrawal ($CC â†’ PIX) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async calcFee(valueCC: number): Promise<number> {
    const feeRate = await this.platformConfig.getNumber('withdrawal_fee_pct');
    const feeMin = await this.platformConfig.getNumber('withdrawal_fee_min_cc');
    return Math.max(feeMin, valueCC * feeRate);
  }

  async requestWithdrawal(
    userId: string,
    valueCC: number,
    pixKey: string,
    pixKeyType: PixKeyType,
  ) {
    const fee = await this.calcFee(valueCC);
    const valueBrl = valueCC - fee;

    await this.debit(
      userId,
      valueCC,
      TransactionType.WITHDRAWAL,
      undefined,
      `Saque solicitado de ${valueCC} $CC`,
    );

    const withdrawal = await this.withdrawals.save(
      this.withdrawals.create({
        userId,
        valueCc: valueCC.toFixed(2),
        valueBrl: valueBrl.toFixed(2),
        feeCc: fee.toFixed(2),
        pixKey,
        pixKeyType,
        status: WithdrawalStatus.PENDING,
      }),
    );

    this.scheduleWithdrawalProcessing(withdrawal.id, userId).catch((err) => {
      this.logger.error(`scheduleWithdrawalProcessing failed withdrawalId=${withdrawal.id} userId=${userId}`, err instanceof Error ? err.stack : String(err));
    });
    this.platformRevenue.record(
      PlatformRevenueType.WITHDRAWAL_FEE,
      fee,
      withdrawal.id,
      `Taxa de saque — ${valueCC} CC`,
    );
    // Referral earning: credit 50% of fee to referrer if eligible
    this.creditReferralEarning(userId, withdrawal.id, fee).catch((err) => {
      this.logger.warn(`creditReferralEarning failed userId=${userId} withdrawalId=${withdrawal.id}`, err instanceof Error ? err.stack : String(err));
    });
    const user = await this.users.findOne({ where: { id: userId }, select: ['email', 'name'] });
    if (user) this.email.sendWithdrawalRequested(user.email, user.name, valueCC, valueBrl, fee, pixKey);
    this.activity.log(userId, UserAction.WITHDRAWAL_REQUESTED, { withdrawalId: withdrawal.id, valueCC, fee, valueBrl });
    return { withdrawalId: withdrawal.id, valueCC, fee, valueBrl };
  }

  /**
   * Anti-cheat delay (25 min) before processing the PIX transfer.
   * KNOWN LIMITATION: setTimeout is lost on process restart â€” saques ficam em PENDING
   * indefinidamente. Migrar para Bull/BullMQ queue para garantir durabilidade.
   */
  private async scheduleWithdrawalProcessing(withdrawalId: string, userId: string) {
    await new Promise(resolve => setTimeout(resolve, 25 * 60 * 1000));

    const withdrawal = await this.withdrawals.findOne({ where: { id: withdrawalId } });
    if (!withdrawal || withdrawal.status !== WithdrawalStatus.PENDING) return;

    await this.withdrawals.update(withdrawalId, { status: WithdrawalStatus.ANALYZING });

    const suspicious = await this.antiCheatCheck(userId);
    if (suspicious) {
      await this.withdrawals.update(withdrawalId, {
        status: WithdrawalStatus.BLOCKED,
        blockReason: suspicious,
      });
      await this.credit(
        userId, parseFloat(withdrawal.valueCc),
        TransactionType.REFUND, withdrawalId,
        'Saque bloqueado por anÃ¡lise anti-cheat â€” $CC estornados',
      );
      this.activity.log(userId, UserAction.WITHDRAWAL_BLOCKED, { withdrawalId, reason: suspicious });
      return;
    }

    try {
      const transfer = await this.asaas.sendPix(
        parseFloat(withdrawal.valueBrl),
        withdrawal.pixKey,
        withdrawal.pixKeyType,
      );
      await this.withdrawals.update(withdrawalId, {
        status: WithdrawalStatus.PROCESSING,
        asaasTransferId: transfer.id,
      });
    } catch (err) {
      this.logger.error(`PIX transfer failed withdrawalId=${withdrawalId} userId=${userId}`, err instanceof Error ? err.stack : String(err));
      await this.withdrawals.update(withdrawalId, { status: WithdrawalStatus.FAILED });
      await this.credit(
        userId, parseFloat(withdrawal.valueCc),
        TransactionType.REFUND, withdrawalId,
        'Saque falhou â€” $CC estornados',
      );
    }
  }

  async confirmWithdrawal(asaasTransferId: string) {
    await this.dataSource.transaction(async (em) => {
      const withdrawal = await em.findOne(Withdrawal, {
        where: { asaasTransferId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!withdrawal || withdrawal.status === WithdrawalStatus.COMPLETED) return;
      await em.update(Withdrawal, withdrawal.id, {
        status: WithdrawalStatus.COMPLETED,
        completedAt: new Date(),
      });
    });
  }

  async failWithdrawal(asaasTransferId: string) {
    await this.dataSource.transaction(async (em) => {
      const withdrawal = await em.findOne(Withdrawal, {
        where: { asaasTransferId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!withdrawal || withdrawal.status === WithdrawalStatus.FAILED) return;

      await em.update(Withdrawal, withdrawal.id, { status: WithdrawalStatus.FAILED });

      const wallet = await em.findOne(Wallet, {
        where: { userId: withdrawal.userId },
        lock: { mode: 'pessimistic_write' },
      }) ?? await em.save(Wallet, em.create(Wallet, { userId: withdrawal.userId, balance: '0.00' }));

      const refundCents = Math.round(parseFloat(withdrawal.valueCc) * 100);
      const newBalanceCents = Math.round(parseFloat(wallet.balance) * 100) + refundCents;
      const newBalance = newBalanceCents / 100;
      await em.update(Wallet, { userId: withdrawal.userId }, { balance: newBalance.toFixed(2) });

      await em.save(WalletTransaction, em.create(WalletTransaction, {
        userId: withdrawal.userId,
        type: TransactionType.REFUND,
        amount: parseFloat(withdrawal.valueCc).toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        referenceId: withdrawal.id,
        description: 'Saque PIX falhou â€” $CC estornados automaticamente',
      }));
    });
  }

  // ─── Referral earning ────────────────────────────────────────────────────────

  private async creditReferralEarning(userId: string, withdrawalId: string, fee: number): Promise<void> {
    const referralsEnabled = await this.platformConfig.getBoolean('referrals_enabled');
    if (!referralsEnabled) return;

    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'referredBy'] });
    if (!user?.referredBy) return;

    const referral = await this.referrals.findOne({
      where: { referrerId: user.referredBy, referredId: userId, isEligible: true },
    });
    if (!referral) return;

    // Check that referred user has at least 1 completed deposit
    const depositCount = await this.deposits.count({
      where: { userId, status: 'COMPLETED' as any },
    });
    if (depositCount === 0) return;

    const earning = Math.round(fee * 0.5 * 100) / 100;
    if (earning <= 0) return;

    await this.dataSource.transaction(async (em) => {
      // Credit referrer's wallet
      const wallet = await em.findOne(Wallet, {
        where: { userId: user.referredBy! },
        lock: { mode: 'pessimistic_write' },
      }) ?? await em.save(Wallet, em.create(Wallet, { userId: user.referredBy!, balance: '0.00' }));

      const newBalance = (Math.round(parseFloat(wallet.balance) * 100) + Math.round(earning * 100)) / 100;
      await em.update(Wallet, { userId: user.referredBy! }, { balance: newBalance.toFixed(2) });

      await em.save(WalletTransaction, em.create(WalletTransaction, {
        userId: user.referredBy!,
        type: TransactionType.PRIZE,
        amount: earning.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        referenceId: withdrawalId,
        description: `Bônus de indicação — saque do indicado`,
      }));

      await em.save(ReferralEarning, em.create(ReferralEarning, {
        referrerId: user.referredBy!,
        referredId: userId,
        withdrawalId,
        amount: earning,
      }));
    });

    this.logger.log(`Referral earning referrerId=${user.referredBy} referredId=${userId} amount=${earning}`);
  }

  // ─── Anti-cheat (withdrawal risk) ────────────────────────────────────────────────────────────────────────────────────

  private async antiCheatCheck(userId: string): Promise<string | null> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMatches = await this.matches.createQueryBuilder('m')
      .where('(m.white_player_id = :uid OR m.black_player_id = :uid)', { uid: userId })
      .andWhere('m.finished_at >= :since', { since })
      .andWhere('m.status = :status', { status: 'FINISHED' })
      .andWhere('m.is_offline = false')
      .getMany();

    if (recentMatches.length === 0) return null;

    // Quick local heuristic first (free check before AI call)
    for (const match of recentMatches) {
      const moves: any[] = match.moves ?? [];
      if (moves.length < 10) continue;
      const uniformTimes = moves.filter(
        (m) => m.elapsed_ms !== undefined && m.elapsed_ms < 1500,
      );
      if (uniformTimes.length / moves.length > 0.9) {
        return `PadrÃ£o de lances suspeito detectado por anÃ¡lise local`;
      }
    }

    if (!this.deepseek.isAvailable) return null;

    const matchSummaries = recentMatches.slice(0, 5).map((m) => {
      const moves: any[] = m.moves ?? [];
      const times = moves.map((mv) => mv?.elapsed_ms).filter(Number.isFinite);
      return {
        move_count: moves.length,
        avg_ms: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
        fast_moves_pct: times.length ? times.filter((t) => t < 1500).length / times.length : null,
        result: m.result,
      };
    });

    const SYSTEM_PROMPT = `VocÃª Ã© um sistema de detecÃ§Ã£o de risco em saques de plataforma de xadrez online.
Analise os dados das partidas recentes e determine se hÃ¡ risco de fraude no saque solicitado.
Responda APENAS com JSON: { "risk": "LOW" | "MEDIUM" | "HIGH", "reason": "string | null" }`;

    interface RiskResult { risk: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string | null }

    const result = await this.deepseek.analyze<RiskResult>(
      AiFeature.WITHDRAWAL_RISK,
      SYSTEM_PROMPT,
      JSON.stringify({ matches: matchSummaries }),
      userId,
      200,
    );

    if (result?.risk === 'HIGH') return result.reason ?? 'Risco alto detectado pela anÃ¡lise de IA';
    return null;
  }
}

