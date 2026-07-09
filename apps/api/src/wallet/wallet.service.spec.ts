import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import { Wallet } from '../entities/wallet.entity';
import { WalletTransaction, TransactionType } from '../entities/wallet-transaction.entity';
import { Deposit, DepositStatus } from '../entities/deposit.entity';
import { Withdrawal, WithdrawalStatus, PixKeyType } from '../entities/withdrawal.entity';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { ReferralEarning } from '../referrals/entities/referral-earning.entity';
import { AsaasService } from '../asaas/asaas.service';
import { DeepseekService } from '../deepseek/deepseek.service';
import { EmailService } from '../email/email.service';
import { PlatformRevenueService } from '../platform-revenue/platform-revenue.service';
import { UserActivityService } from '../user-activity/user-activity.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { GameGateway } from '../game/game.gateway';
import { SANDBOX_AUTO_APPROVE_DELAY_MS } from '../asaas/consts/asaas.consts';

describe('WalletService', () => {
  let service: WalletService;
  let walletsRepo: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;
  let depositsRepo: jest.Mocked<Repository<Deposit>>;
  let withdrawalsRepo: jest.Mocked<Repository<Withdrawal>>;
  let matchesRepo: jest.Mocked<Repository<Match>>;
  let usersRepo: jest.Mocked<Repository<User>>;
  let referralsRepo: jest.Mocked<Repository<Referral>>;
  let referralEarningsRepo: jest.Mocked<Repository<ReferralEarning>>;
  let dataSource: jest.Mocked<DataSource>;
  let asaas: jest.Mocked<AsaasService>;
  let deepseek: jest.Mocked<DeepseekService>;
  let emailService: jest.Mocked<EmailService>;
  let platformRevenue: jest.Mocked<PlatformRevenueService>;
  let activity: jest.Mocked<UserActivityService>;
  let platformConfig: jest.Mocked<PlatformConfigService>;
  let gameGateway: jest.Mocked<GameGateway>;

  const mockEm = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn((_, v) => v),
  };

  const depositsQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };

  const matchesQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    depositsQb.update.mockReturnThis();
    depositsQb.set.mockReturnThis();
    depositsQb.where.mockReturnThis();
    depositsQb.execute.mockResolvedValue(undefined);
    matchesQb.where.mockReturnThis();
    matchesQb.andWhere.mockReturnThis();
    matchesQb.getMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: { findOne: jest.fn(), save: jest.fn(), create: jest.fn((v) => v) },
        },
        {
          provide: getRepositoryToken(WalletTransaction),
          useValue: { findAndCount: jest.fn() },
        },
        {
          provide: getRepositoryToken(Deposit),
          useValue: {
            save: jest.fn(), create: jest.fn((v) => v), update: jest.fn(), delete: jest.fn(),
            findAndCount: jest.fn(), count: jest.fn(),
            createQueryBuilder: jest.fn(() => depositsQb),
          },
        },
        {
          provide: getRepositoryToken(Withdrawal),
          useValue: { save: jest.fn(), create: jest.fn((v) => v), update: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Match),
          useValue: { createQueryBuilder: jest.fn(() => matchesQb) },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(Referral),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ReferralEarning),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn((cb) => cb(mockEm)) },
        },
        {
          provide: AsaasService,
          useValue: { createPixPayment: jest.fn(), cancelPayment: jest.fn(), sendPix: jest.fn(), isSandboxEnv: jest.fn().mockReturnValue(false) },
        },
        { provide: DeepseekService, useValue: { analyze: jest.fn(), isAvailable: true } },
        { provide: EmailService, useValue: { sendDepositCreated: jest.fn(), sendDepositConfirmed: jest.fn(), sendWithdrawalRequested: jest.fn() } },
        { provide: PlatformRevenueService, useValue: { record: jest.fn() } },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
        { provide: PlatformConfigService, useValue: { getNumber: jest.fn(), getBoolean: jest.fn() } },
        { provide: GameGateway, useValue: { emitToUser: jest.fn() } },
      ],
    }).compile();

    service = module.get(WalletService);
    walletsRepo = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(WalletTransaction));
    depositsRepo = module.get(getRepositoryToken(Deposit));
    withdrawalsRepo = module.get(getRepositoryToken(Withdrawal));
    matchesRepo = module.get(getRepositoryToken(Match));
    usersRepo = module.get(getRepositoryToken(User));
    referralsRepo = module.get(getRepositoryToken(Referral));
    referralEarningsRepo = module.get(getRepositoryToken(ReferralEarning));
    dataSource = module.get(DataSource);
    asaas = module.get(AsaasService);
    deepseek = module.get(DeepseekService);
    emailService = module.get(EmailService);
    platformRevenue = module.get(PlatformRevenueService);
    activity = module.get(UserActivityService);
    platformConfig = module.get(PlatformConfigService);
    gameGateway = module.get(GameGateway);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Balance ────────────────────────────────────────────────

  describe('getOrCreateWallet', () => {
    it('returns existing wallet', async () => {
      walletsRepo.findOne.mockResolvedValue({ userId: 'u1', balance: '10.00' } as any);
      const result = await service.getOrCreateWallet('u1');
      expect(result.balance).toBe('10.00');
    });

    it('creates a new wallet when none exists', async () => {
      walletsRepo.findOne.mockResolvedValue(null);
      walletsRepo.save.mockResolvedValue({ userId: 'u1', balance: '0.00' } as any);
      const result = await service.getOrCreateWallet('u1');
      expect(walletsRepo.save).toHaveBeenCalled();
      expect(result.balance).toBe('0.00');
    });

    it('handles concurrent insert by fetching the winner row', async () => {
      walletsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ userId: 'u1', balance: '0.00' } as any);
      walletsRepo.save.mockRejectedValue(new Error('unique constraint'));
      const result = await service.getOrCreateWallet('u1');
      expect(result.balance).toBe('0.00');
    });
  });

  describe('getBalance', () => {
    it('returns balance as a number', async () => {
      walletsRepo.findOne.mockResolvedValue({ userId: 'u1', balance: '42.50' } as any);
      const result = await service.getBalance('u1');
      expect(result).toEqual({ balance: 42.5 });
    });
  });

  describe('getTransactions', () => {
    it('returns paginated transactions', async () => {
      txRepo.findAndCount.mockResolvedValue([[{ id: 't1' }] as any, 25]);
      const result = await service.getTransactions('u1', 2, 10);
      expect(txRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'u1' }, skip: 10, take: 10,
      }));
      expect(result).toEqual({ items: [{ id: 't1' }], total: 25, page: 2, totalPages: 3 });
    });
  });

  // ─── Credit / Debit ────────────────────────────────────────

  describe('credit', () => {
    it('creates wallet if not found and credits the amount', async () => {
      mockEm.findOne.mockResolvedValue(null);
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));

      const result = await service.credit('u1', 10, TransactionType.DEPOSIT, 'ref-1', 'Test');
      expect(mockEm.update).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ userId: 'u1', amount: '10.00' }));
    });

    it('adds to existing balance', async () => {
      mockEm.findOne.mockResolvedValue({ userId: 'u1', balance: '50.00' });
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));

      const result = await service.credit('u1', 25, TransactionType.PRIZE);
      expect(mockEm.update).toHaveBeenCalledWith(Wallet, { userId: 'u1' }, { balance: '75.00' });
      expect(result.balanceAfter).toBe('75.00');
    });
  });

  describe('debit', () => {
    it('throws BadRequestException when balance is insufficient', async () => {
      mockEm.findOne.mockResolvedValue({ userId: 'u1', balance: '5.00' });
      await expect(service.debit('u1', 10, TransactionType.WITHDRAWAL)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('debits the amount and returns the transaction', async () => {
      mockEm.findOne.mockResolvedValue({ userId: 'u1', balance: '100.00' });
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));

      const result = await service.debit('u1', 30, TransactionType.WITHDRAWAL, 'w-1');
      expect(mockEm.update).toHaveBeenCalledWith(Wallet, { userId: 'u1' }, { balance: '70.00' });
      expect(result.amount).toBe('-30.00');
      expect(result.balanceAfter).toBe('70.00');
    });

    it('treats null wallet as zero balance', async () => {
      mockEm.findOne.mockResolvedValue(null);
      await expect(service.debit('u1', 1, TransactionType.WITHDRAWAL)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assertBalance', () => {
    it('does not throw when balance is sufficient', async () => {
      walletsRepo.findOne.mockResolvedValue({ balance: '50.00' } as any);
      await expect(service.assertBalance('u1', 50)).resolves.toBeUndefined();
    });

    it('throws BadRequestException when balance is insufficient', async () => {
      walletsRepo.findOne.mockResolvedValue({ balance: '10.00' } as any);
      await expect(service.assertBalance('u1', 20)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('treats missing wallet as zero balance', async () => {
      walletsRepo.findOne.mockResolvedValue(null);
      await expect(service.assertBalance('u1', 1)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('debitTx', () => {
    it('debits within the provided entity manager', async () => {
      const em = {
        findOne: jest.fn().mockResolvedValue({ userId: 'u1', balance: '20.00' }),
        update: jest.fn(),
        save: jest.fn().mockImplementation((_, v) => Promise.resolve(v)),
        create: jest.fn((_, v) => v),
      } as any;

      await service.debitTx(em, 'u1', 5, TransactionType.TOURNAMENT_ENTRY);
      expect(em.update).toHaveBeenCalledWith(Wallet, { userId: 'u1' }, { balance: '15.00' });
      expect(em.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when insufficient balance', async () => {
      const em = { findOne: jest.fn().mockResolvedValue({ userId: 'u1', balance: '2.00' }) } as any;
      await expect(service.debitTx(em, 'u1', 10, TransactionType.TOURNAMENT_ENTRY)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── Deposit ────────────────────────────────────────────────

  describe('createDeposit', () => {
    it('creates a deposit and returns QR code data', async () => {
      depositsRepo.save.mockResolvedValue({ id: 'dep-1' } as any);
      asaas.createPixPayment.mockResolvedValue({
        paymentId: 'pay-1', qrCode: 'qr-data', copyPaste: 'pix-key', expiresAt: new Date().toISOString(),
      } as any);
      depositsRepo.update.mockResolvedValue(undefined as any);
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);

      const result = await service.createDeposit('u1', 50);

      expect(depositsRepo.save).toHaveBeenCalled();
      expect(asaas.createPixPayment).toHaveBeenCalledWith('u1', 50, 'dep-1', undefined);
      expect(result).toEqual(expect.objectContaining({ depositId: 'dep-1', qrCode: 'qr-data' }));
      expect(emailService.sendDepositCreated).toHaveBeenCalled();
      expect(activity.log).toHaveBeenCalled();
    });

    it('deletes the deposit and rethrows when Asaas fails', async () => {
      depositsRepo.save.mockResolvedValue({ id: 'dep-1' } as any);
      asaas.createPixPayment.mockRejectedValue(new Error('Asaas down'));

      await expect(service.createDeposit('u1', 50)).rejects.toThrow('Asaas down');
      expect(depositsRepo.delete).toHaveBeenCalledWith('dep-1');
    });

    it('does not send email when user is not found', async () => {
      depositsRepo.save.mockResolvedValue({ id: 'dep-1' } as any);
      asaas.createPixPayment.mockResolvedValue({
        paymentId: 'pay-1', qrCode: 'qr', copyPaste: 'cp', expiresAt: new Date().toISOString(),
      } as any);
      depositsRepo.update.mockResolvedValue(undefined as any);
      usersRepo.findOne.mockResolvedValue(null);

      await service.createDeposit('u1', 10);
      expect(emailService.sendDepositCreated).not.toHaveBeenCalled();
    });
  });

  describe('createDeposit — sandbox auto-approve', () => {
    it('credits the deposit directly 10s after creation and notifies over the socket when in sandbox', async () => {
      jest.useFakeTimers();
      asaas.isSandboxEnv.mockReturnValue(true);
      depositsRepo.save.mockResolvedValue({ id: 'dep-1' } as any);
      asaas.createPixPayment.mockResolvedValue({
        paymentId: 'pay-1', qrCode: 'qr', copyPaste: 'cp', expiresAt: new Date().toISOString(),
      } as any);
      depositsRepo.update.mockResolvedValue(undefined as any);
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);
      mockEm.findOne
        .mockResolvedValueOnce({ id: 'dep-1', userId: 'u1', status: DepositStatus.PENDING, valueBrl: '50.00' })
        .mockResolvedValueOnce({ userId: 'u1', balance: '10.00' });
      mockEm.update.mockResolvedValue(undefined);
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));

      await service.createDeposit('u1', 50);
      expect(gameGateway.emitToUser).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(SANDBOX_AUTO_APPROVE_DELAY_MS);

      expect(gameGateway.emitToUser).toHaveBeenCalledWith('u1', 'deposit_confirmed', { valueBrl: 50, balance: 60 });
    });

    it('does not schedule anything when not in sandbox', async () => {
      jest.useFakeTimers();
      asaas.isSandboxEnv.mockReturnValue(false);
      depositsRepo.save.mockResolvedValue({ id: 'dep-1' } as any);
      asaas.createPixPayment.mockResolvedValue({
        paymentId: 'pay-1', qrCode: 'qr', copyPaste: 'cp', expiresAt: new Date().toISOString(),
      } as any);
      depositsRepo.update.mockResolvedValue(undefined as any);
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);

      await service.createDeposit('u1', 50);
      await jest.advanceTimersByTimeAsync(SANDBOX_AUTO_APPROVE_DELAY_MS);

      expect(gameGateway.emitToUser).not.toHaveBeenCalled();
    });

    it('logs a warning and does not throw when confirming the deposit fails', async () => {
      jest.useFakeTimers();
      asaas.isSandboxEnv.mockReturnValue(true);
      depositsRepo.save.mockResolvedValue({ id: 'dep-1' } as any);
      asaas.createPixPayment.mockResolvedValue({
        paymentId: 'pay-1', qrCode: 'qr', copyPaste: 'cp', expiresAt: new Date().toISOString(),
      } as any);
      depositsRepo.update.mockResolvedValue(undefined as any);
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);
      mockEm.findOne.mockResolvedValue(null); // deposit no longer PENDING (e.g. cancelled) → confirmDeposit rejects

      await service.createDeposit('u1', 50);

      await expect(jest.advanceTimersByTimeAsync(SANDBOX_AUTO_APPROVE_DELAY_MS)).resolves.toBeUndefined();
      expect(gameGateway.emitToUser).not.toHaveBeenCalled();
    });
  });

  describe('getDeposits', () => {
    it('returns paginated deposits after expiring stale ones', async () => {
      depositsRepo.findAndCount.mockResolvedValue([[{ id: 'd1' }] as any, 5]);
      const result = await service.getDeposits('u1', 1, 15);
      expect(depositsQb.execute).toHaveBeenCalled();
      expect(result).toEqual({ items: [{ id: 'd1' }], total: 5, page: 1, totalPages: 1 });
    });
  });

  describe('cancelDeposit', () => {
    it('cancels a pending deposit and calls Asaas', async () => {
      mockEm.findOne.mockResolvedValue({ id: 'dep-1', status: DepositStatus.PENDING, asaasPaymentId: 'pay-1' });
      mockEm.update.mockResolvedValue(undefined);
      asaas.cancelPayment.mockResolvedValue(undefined as any);

      const result = await service.cancelDeposit('u1', 'dep-1');
      expect(result).toEqual({ ok: true });
      expect(asaas.cancelPayment).toHaveBeenCalledWith('pay-1');
      expect(activity.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when deposit does not exist', async () => {
      mockEm.findOne.mockResolvedValue(null);
      await expect(service.cancelDeposit('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when deposit is not PENDING', async () => {
      mockEm.findOne.mockResolvedValue({ id: 'dep-1', status: DepositStatus.COMPLETED });
      await expect(service.cancelDeposit('u1', 'dep-1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('succeeds even when Asaas cancelPayment fails (best-effort)', async () => {
      mockEm.findOne.mockResolvedValue({ id: 'dep-1', status: DepositStatus.PENDING, asaasPaymentId: 'pay-1' });
      mockEm.update.mockResolvedValue(undefined);
      asaas.cancelPayment.mockRejectedValue(new Error('network'));

      const result = await service.cancelDeposit('u1', 'dep-1');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('confirmDeposit', () => {
    it('credits wallet and returns result when deposit is pending', async () => {
      mockEm.findOne
        .mockResolvedValueOnce({ id: 'dep-1', userId: 'u1', status: DepositStatus.PENDING, valueBrl: '100.00' })
        .mockResolvedValueOnce({ userId: 'u1', balance: '50.00' });
      mockEm.update.mockResolvedValue(undefined);
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);

      const result = await service.confirmDeposit('pay-1');

      expect(result).toEqual(expect.objectContaining({ userId: 'u1', balance: 150 }));
      expect(emailService.sendDepositConfirmed).toHaveBeenCalled();
      expect(activity.log).toHaveBeenCalled();
    });

    it('throws when deposit is not found (null result hits .then chaining)', async () => {
      mockEm.findOne.mockResolvedValue(null);
      await expect(service.confirmDeposit('missing')).rejects.toThrow();
    });

    it('throws when deposit status is not PENDING', async () => {
      mockEm.findOne.mockResolvedValue({ id: 'dep-1', status: DepositStatus.COMPLETED });
      await expect(service.confirmDeposit('old')).rejects.toThrow();
    });
  });

  // ─── Withdrawal ─────────────────────────────────────────────

  describe('calcFee', () => {
    it('returns max of minimum fee and percentage fee', async () => {
      platformConfig.getNumber.mockResolvedValueOnce(0.02); // 2%
      platformConfig.getNumber.mockResolvedValueOnce(2); // min 2 CC

      const fee = await service.calcFee(200);
      expect(fee).toBe(4); // 2% of 200 = 4 > min 2
    });

    it('returns minimum fee when percentage is smaller', async () => {
      platformConfig.getNumber.mockResolvedValueOnce(0.02);
      platformConfig.getNumber.mockResolvedValueOnce(2);

      const fee = await service.calcFee(50);
      expect(fee).toBe(2); // 2% of 50 = 1 < min 2
    });
  });

  describe('requestWithdrawal', () => {
    beforeEach(() => {
      platformConfig.getNumber.mockResolvedValueOnce(0.02).mockResolvedValueOnce(2);
      // Mock debit via dataSource.transaction
      mockEm.findOne.mockResolvedValue({ userId: 'u1', balance: '100.00' });
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      mockEm.update.mockResolvedValue(undefined);
      withdrawalsRepo.save.mockResolvedValue({ id: 'w-1' } as any);
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);
      platformConfig.getBoolean.mockResolvedValue(false); // referrals disabled
    });

    it('debits the user, creates withdrawal, records fee, and returns data', async () => {
      const result = await service.requestWithdrawal('u1', 100, 'pix@key', PixKeyType.EMAIL);

      expect(result).toEqual(expect.objectContaining({
        withdrawalId: 'w-1',
        valueCC: 100,
        fee: 2,
        valueBrl: 98,
      }));
      expect(platformRevenue.record).toHaveBeenCalled();
      expect(emailService.sendWithdrawalRequested).toHaveBeenCalled();
      expect(activity.log).toHaveBeenCalled();
    });
  });

  describe('confirmWithdrawal', () => {
    it('marks withdrawal as completed', async () => {
      mockEm.findOne.mockResolvedValue({ id: 'w-1', status: WithdrawalStatus.PROCESSING });
      mockEm.update.mockResolvedValue(undefined);

      await service.confirmWithdrawal('transfer-1');
      expect(mockEm.update).toHaveBeenCalledWith(Withdrawal, 'w-1', expect.objectContaining({
        status: WithdrawalStatus.COMPLETED,
      }));
    });

    it('does nothing when withdrawal is already completed', async () => {
      mockEm.findOne.mockResolvedValue({ id: 'w-1', status: WithdrawalStatus.COMPLETED });

      await service.confirmWithdrawal('transfer-1');
      expect(mockEm.update).not.toHaveBeenCalled();
    });

    it('does nothing when withdrawal is not found', async () => {
      mockEm.findOne.mockResolvedValue(null);

      await service.confirmWithdrawal('missing');
      expect(mockEm.update).not.toHaveBeenCalled();
    });
  });

  describe('failWithdrawal', () => {
    it('marks withdrawal as failed and refunds the user', async () => {
      mockEm.findOne
        .mockResolvedValueOnce({ id: 'w-1', userId: 'u1', status: WithdrawalStatus.PROCESSING, valueCc: '50.00' })
        .mockResolvedValueOnce({ userId: 'u1', balance: '10.00' });
      mockEm.update.mockResolvedValue(undefined);
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));

      await service.failWithdrawal('transfer-1');

      expect(mockEm.update).toHaveBeenCalledWith(Withdrawal, 'w-1', { status: WithdrawalStatus.FAILED });
      expect(mockEm.update).toHaveBeenCalledWith(Wallet, { userId: 'u1' }, { balance: '60.00' });
    });

    it('creates wallet if user had none when refunding', async () => {
      mockEm.findOne
        .mockResolvedValueOnce({ id: 'w-1', userId: 'u1', status: WithdrawalStatus.PROCESSING, valueCc: '20.00' })
        .mockResolvedValueOnce(null);
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      mockEm.update.mockResolvedValue(undefined);

      await service.failWithdrawal('transfer-1');

      expect(mockEm.save).toHaveBeenCalledWith(Wallet, expect.objectContaining({ userId: 'u1', balance: '0.00' }));
    });

    it('does nothing when withdrawal is already failed', async () => {
      mockEm.findOne.mockResolvedValue({ id: 'w-1', status: WithdrawalStatus.FAILED });

      await service.failWithdrawal('transfer-1');
      expect(mockEm.update).not.toHaveBeenCalled();
    });
  });

  describe('confirmDeposit creates a wallet when the user has none', () => {
    it('creates a new wallet before crediting the deposit', async () => {
      mockEm.findOne
        .mockResolvedValueOnce({ id: 'dep-1', userId: 'u1', status: DepositStatus.PENDING, valueBrl: '100.00' })
        .mockResolvedValueOnce(null);
      mockEm.update.mockResolvedValue(undefined);
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);

      const result = await service.confirmDeposit('pay-1');

      expect(mockEm.save).toHaveBeenCalledWith(Wallet, expect.objectContaining({ userId: 'u1', balance: '0.00' }));
      expect(result).toEqual(expect.objectContaining({ userId: 'u1', balance: 100 }));
    });
  });

  describe('requestWithdrawal fire-and-forget error handling', () => {
    beforeEach(() => {
      platformConfig.getNumber.mockResolvedValueOnce(0.02).mockResolvedValueOnce(2);
      mockEm.findOne.mockResolvedValue({ userId: 'u1', balance: '100.00' });
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      mockEm.update.mockResolvedValue(undefined);
      withdrawalsRepo.save.mockResolvedValue({ id: 'w-1' } as any);
      usersRepo.findOne.mockResolvedValue({ email: 'a@b.com', name: 'Test' } as any);
    });

    it('logs an error when scheduleWithdrawalProcessing rejects with an Error', async () => {
      jest.spyOn(service as any, 'scheduleWithdrawalProcessing').mockRejectedValue(new Error('schedule failed'));
      jest.spyOn(service as any, 'creditReferralEarning').mockResolvedValue(undefined);
      const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

      await service.requestWithdrawal('u1', 100, 'pix@key', PixKeyType.EMAIL);
      await Promise.resolve();
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('scheduleWithdrawalProcessing failed'), expect.any(String));
    });

    it('logs a warning when creditReferralEarning rejects with a non-Error value', async () => {
      jest.spyOn(service as any, 'scheduleWithdrawalProcessing').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'creditReferralEarning').mockRejectedValue('plain string');
      const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      await service.requestWithdrawal('u1', 100, 'pix@key', PixKeyType.EMAIL);
      await Promise.resolve();
      await Promise.resolve();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('creditReferralEarning failed'), 'plain string');
    });
  });

  describe('scheduleWithdrawalProcessing (private)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const runWithTimer = async (promise: Promise<any>) => {
      const advance = jest.advanceTimersByTimeAsync(25 * 60 * 1000);
      await advance;
      return promise;
    };

    it('returns early when the withdrawal no longer exists', async () => {
      withdrawalsRepo.findOne.mockResolvedValue(null);
      const promise = (service as any).scheduleWithdrawalProcessing('w-1', 'u1');
      await runWithTimer(promise);
      expect(withdrawalsRepo.update).not.toHaveBeenCalled();
    });

    it('returns early when the withdrawal is no longer PENDING', async () => {
      withdrawalsRepo.findOne.mockResolvedValue({ id: 'w-1', status: WithdrawalStatus.ANALYZING } as any);
      const promise = (service as any).scheduleWithdrawalProcessing('w-1', 'u1');
      await runWithTimer(promise);
      expect(withdrawalsRepo.update).not.toHaveBeenCalled();
    });

    it('blocks the withdrawal and refunds when antiCheatCheck flags it as suspicious', async () => {
      withdrawalsRepo.findOne.mockResolvedValue({ id: 'w-1', status: WithdrawalStatus.PENDING, valueCc: '50.00' } as any);
      withdrawalsRepo.update.mockResolvedValue(undefined as any);
      jest.spyOn(service as any, 'antiCheatCheck').mockResolvedValue('Padrão suspeito');
      mockEm.findOne.mockResolvedValue({ userId: 'u1', balance: '10.00' });
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      mockEm.update.mockResolvedValue(undefined);

      const promise = (service as any).scheduleWithdrawalProcessing('w-1', 'u1');
      await runWithTimer(promise);

      expect(withdrawalsRepo.update).toHaveBeenCalledWith('w-1', { status: WithdrawalStatus.ANALYZING });
      expect(withdrawalsRepo.update).toHaveBeenCalledWith('w-1', expect.objectContaining({ status: WithdrawalStatus.BLOCKED, blockReason: 'Padrão suspeito' }));
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything(), expect.objectContaining({ withdrawalId: 'w-1', reason: 'Padrão suspeito' }));
    });

    it('processes the PIX transfer when not suspicious', async () => {
      withdrawalsRepo.findOne.mockResolvedValue({ id: 'w-1', status: WithdrawalStatus.PENDING, valueBrl: '48.00', pixKey: 'k', pixKeyType: PixKeyType.EMAIL } as any);
      withdrawalsRepo.update.mockResolvedValue(undefined as any);
      jest.spyOn(service as any, 'antiCheatCheck').mockResolvedValue(null);
      asaas.sendPix.mockResolvedValue({ id: 'transfer-1' } as any);

      const promise = (service as any).scheduleWithdrawalProcessing('w-1', 'u1');
      await runWithTimer(promise);

      expect(asaas.sendPix).toHaveBeenCalledWith(48, 'k', PixKeyType.EMAIL);
      expect(withdrawalsRepo.update).toHaveBeenCalledWith('w-1', { status: WithdrawalStatus.PROCESSING, asaasTransferId: 'transfer-1' });
    });

    it('marks the withdrawal as failed and refunds when the PIX transfer throws', async () => {
      withdrawalsRepo.findOne.mockResolvedValue({ id: 'w-1', status: WithdrawalStatus.PENDING, valueCc: '50.00', valueBrl: '48.00', pixKey: 'k', pixKeyType: PixKeyType.EMAIL } as any);
      withdrawalsRepo.update.mockResolvedValue(undefined as any);
      jest.spyOn(service as any, 'antiCheatCheck').mockResolvedValue(null);
      asaas.sendPix.mockRejectedValue(new Error('asaas down'));
      mockEm.findOne.mockResolvedValue({ userId: 'u1', balance: '10.00' });
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      mockEm.update.mockResolvedValue(undefined);

      const promise = (service as any).scheduleWithdrawalProcessing('w-1', 'u1');
      await runWithTimer(promise);

      expect(withdrawalsRepo.update).toHaveBeenCalledWith('w-1', { status: WithdrawalStatus.FAILED });
    });
  });

  describe('creditReferralEarning (private)', () => {
    it('does nothing when referrals are disabled', async () => {
      platformConfig.getBoolean.mockResolvedValue(false);
      await (service as any).creditReferralEarning('u1', 'w-1', 4);
      expect(usersRepo.findOne).not.toHaveBeenCalled();
    });

    it('does nothing when the user has no referrer', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', referredBy: null } as any);
      await (service as any).creditReferralEarning('u1', 'w-1', 4);
      expect(referralsRepo.findOne).not.toHaveBeenCalled();
    });

    it('does nothing when no eligible referral is found', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', referredBy: 'ref-1' } as any);
      referralsRepo.findOne.mockResolvedValue(null);
      await (service as any).creditReferralEarning('u1', 'w-1', 4);
      expect(depositsRepo.count).not.toHaveBeenCalled();
    });

    it('does nothing when the referred user has no completed deposits', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', referredBy: 'ref-1' } as any);
      referralsRepo.findOne.mockResolvedValue({ id: 'referral-1' } as any);
      depositsRepo.count.mockResolvedValue(0);
      await (service as any).creditReferralEarning('u1', 'w-1', 4);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('does nothing when the computed earning is zero', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', referredBy: 'ref-1' } as any);
      referralsRepo.findOne.mockResolvedValue({ id: 'referral-1' } as any);
      depositsRepo.count.mockResolvedValue(1);
      await (service as any).creditReferralEarning('u1', 'w-1', 0);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('credits the referrer wallet when eligible', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', referredBy: 'ref-1' } as any);
      referralsRepo.findOne.mockResolvedValue({ id: 'referral-1' } as any);
      depositsRepo.count.mockResolvedValue(1);
      mockEm.findOne.mockResolvedValue({ userId: 'ref-1', balance: '5.00' });
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      mockEm.update.mockResolvedValue(undefined);

      await (service as any).creditReferralEarning('u1', 'w-1', 4);

      expect(mockEm.update).toHaveBeenCalledWith(Wallet, { userId: 'ref-1' }, { balance: '7.00' });
    });

    it('creates a wallet for the referrer when none exists', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', referredBy: 'ref-1' } as any);
      referralsRepo.findOne.mockResolvedValue({ id: 'referral-1' } as any);
      depositsRepo.count.mockResolvedValue(1);
      mockEm.findOne.mockResolvedValue(null);
      mockEm.save.mockImplementation((_, v) => Promise.resolve(v));
      mockEm.update.mockResolvedValue(undefined);

      await (service as any).creditReferralEarning('u1', 'w-1', 4);

      expect(mockEm.save).toHaveBeenCalledWith(Wallet, expect.objectContaining({ userId: 'ref-1', balance: '0.00' }));
    });
  });

  describe('antiCheatCheck (private)', () => {
    it('returns null when there are no recent matches', async () => {
      matchesQb.getMany.mockResolvedValue([]);
      const result = await (service as any).antiCheatCheck('u1');
      expect(result).toBeNull();
    });

    it('returns a warning when a match has a suspicious ratio of fast moves', async () => {
      const moves = Array.from({ length: 12 }, () => ({ elapsed_ms: 500 }));
      matchesQb.getMany.mockResolvedValue([{ id: 'm1', moves, result: '1-0' }]);
      const result = await (service as any).antiCheatCheck('u1');
      expect(result).toContain('suspeito');
    });

    it('skips matches with fewer than 10 moves for the local heuristic', async () => {
      const moves = Array.from({ length: 5 }, () => ({ elapsed_ms: 500 }));
      matchesQb.getMany.mockResolvedValue([{ id: 'm1', moves, result: '1-0' }]);
      (deepseek as any).isAvailable = false;
      const result = await (service as any).antiCheatCheck('u1');
      expect(result).toBeNull();
    });

    it('returns null when deepseek is unavailable and no local heuristic triggers', async () => {
      const moves = Array.from({ length: 12 }, () => ({ elapsed_ms: 5000 }));
      matchesQb.getMany.mockResolvedValue([{ id: 'm1', moves, result: '1-0' }]);
      (deepseek as any).isAvailable = false;
      const result = await (service as any).antiCheatCheck('u1');
      expect(result).toBeNull();
    });

    it('returns the AI reason when deepseek reports HIGH risk', async () => {
      const moves = Array.from({ length: 12 }, () => ({ elapsed_ms: 5000 }));
      matchesQb.getMany.mockResolvedValue([{ id: 'm1', moves, result: '1-0' }]);
      (deepseek as any).isAvailable = true;
      deepseek.analyze.mockResolvedValue({ risk: 'HIGH', reason: 'Padrão incomum detectado' } as any);
      const result = await (service as any).antiCheatCheck('u1');
      expect(result).toBe('Padrão incomum detectado');
    });

    it('falls back to a default reason when deepseek reports HIGH risk without a reason', async () => {
      const moves = Array.from({ length: 12 }, () => ({ elapsed_ms: 5000 }));
      matchesQb.getMany.mockResolvedValue([{ id: 'm1', moves, result: '1-0' }]);
      (deepseek as any).isAvailable = true;
      deepseek.analyze.mockResolvedValue({ risk: 'HIGH', reason: null } as any);
      const result = await (service as any).antiCheatCheck('u1');
      expect(result).toContain('Risco alto detectado');
    });

    it('returns null when deepseek reports LOW risk', async () => {
      const moves = Array.from({ length: 12 }, () => ({ elapsed_ms: 5000 }));
      matchesQb.getMany.mockResolvedValue([{ id: 'm1', moves, result: '1-0' }]);
      (deepseek as any).isAvailable = true;
      deepseek.analyze.mockResolvedValue({ risk: 'LOW', reason: null } as any);
      const result = await (service as any).antiCheatCheck('u1');
      expect(result).toBeNull();
    });
  });
});
