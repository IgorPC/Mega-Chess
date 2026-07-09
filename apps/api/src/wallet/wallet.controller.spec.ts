import { InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { User } from '../entities/user.entity';
import { UserActivityService } from '../user-activity/user-activity.service';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { PixKeyType } from '../entities/withdrawal.entity';

describe('WalletController', () => {
  let controller: WalletController;
  let wallet: jest.Mocked<WalletService>;
  let usersRepo: jest.Mocked<Repository<User>>;
  let activity: jest.Mocked<UserActivityService>;
  let platformConfig: jest.Mocked<PlatformConfigService>;
  const user = { id: 'user-1' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: {
            getBalance: jest.fn(),
            getTransactions: jest.fn(),
            getDeposits: jest.fn(),
            createDeposit: jest.fn(),
            cancelDeposit: jest.fn(),
            requestWithdrawal: jest.fn(),
          },
        },
        { provide: getRepositoryToken(User), useValue: { update: jest.fn(), findOne: jest.fn() } },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
        { provide: PlatformConfigService, useValue: { getBoolean: jest.fn() } },
      ],
    }).compile();

    controller = module.get(WalletController);
    wallet = module.get(WalletService);
    usersRepo = module.get(getRepositoryToken(User));
    activity = module.get(UserActivityService);
    platformConfig = module.get(PlatformConfigService);
  });

  describe('getBalance', () => {
    it('returns the balance', async () => {
      wallet.getBalance.mockResolvedValue({ balance: 42.5 });
      expect(await controller.getBalance(user)).toEqual({ balance: 42.5 });
    });

    it('rethrows HttpException', async () => {
      wallet.getBalance.mockRejectedValue(new NotFoundException());
      await expect(controller.getBalance(user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      wallet.getBalance.mockRejectedValue(new Error('boom'));
      await expect(controller.getBalance(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      wallet.getBalance.mockRejectedValue('plain string');
      await expect(controller.getBalance(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getTransactions', () => {
    it('delegates with clamped limit', async () => {
      wallet.getTransactions.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
      await controller.getTransactions(user, 1, 100);
      expect(wallet.getTransactions).toHaveBeenCalledWith('user-1', 1, 50);
    });

    it('rethrows HttpException', async () => {
      wallet.getTransactions.mockRejectedValue(new NotFoundException());
      await expect(controller.getTransactions(user, 1, 20)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      wallet.getTransactions.mockRejectedValue(new Error('boom'));
      await expect(controller.getTransactions(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      wallet.getTransactions.mockRejectedValue('plain string');
      await expect(controller.getTransactions(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getDeposits', () => {
    it('delegates with clamped limit', async () => {
      wallet.getDeposits.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
      await controller.getDeposits(user, 1, 100);
      expect(wallet.getDeposits).toHaveBeenCalledWith('user-1', 1, 50);
    });

    it('rethrows HttpException', async () => {
      wallet.getDeposits.mockRejectedValue(new NotFoundException());
      await expect(controller.getDeposits(user, 1, 15)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      wallet.getDeposits.mockRejectedValue(new Error('boom'));
      await expect(controller.getDeposits(user, 1, 15)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      wallet.getDeposits.mockRejectedValue('plain string');
      await expect(controller.getDeposits(user, 1, 15)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('createDeposit', () => {
    it('creates deposit when the dto provides an adult birth date', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', birthDate: null } as any);
      wallet.createDeposit.mockResolvedValue({ depositId: 'd1' } as any);

      const result = await controller.createDeposit(user, { valueBrl: 50, birthDate: '1990-01-01' } as any);
      expect(result).toEqual({ depositId: 'd1' });
      expect(wallet.createDeposit).toHaveBeenCalledWith('user-1', 50, undefined);
    });

    it('creates deposit using the birth date already saved on the profile', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', birthDate: '1990-01-01' } as any);
      wallet.createDeposit.mockResolvedValue({ depositId: 'd1' } as any);

      const result = await controller.createDeposit(user, { valueBrl: 50 } as any);
      expect(result).toEqual({ depositId: 'd1' });
    });

    it('throws ForbiddenException when deposits are disabled', async () => {
      platformConfig.getBoolean.mockResolvedValue(false);
      await expect(controller.createDeposit(user, { valueBrl: 50 } as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when no birth date is provided or saved', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', birthDate: null } as any);
      await expect(controller.createDeposit(user, { valueBrl: 50 } as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(wallet.createDeposit).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the user is under 18', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', birthDate: null } as any);
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

      await expect(
        controller.createDeposit(user, { valueBrl: 50, birthDate: tenYearsAgo.toISOString().slice(0, 10) } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(wallet.createDeposit).not.toHaveBeenCalled();
    });

    it('wraps unexpected error as 500', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', birthDate: '1990-01-01' } as any);
      wallet.createDeposit.mockRejectedValue(new Error('boom'));
      await expect(controller.createDeposit(user, { valueBrl: 50 } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      usersRepo.findOne.mockResolvedValue({ id: 'user-1', birthDate: '1990-01-01' } as any);
      wallet.createDeposit.mockRejectedValue('plain string');
      await expect(controller.createDeposit(user, { valueBrl: 50 } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('cancelDeposit', () => {
    it('delegates to service', async () => {
      wallet.cancelDeposit.mockResolvedValue({ ok: true });
      expect(await controller.cancelDeposit(user, 'dep-1')).toEqual({ ok: true });
    });

    it('rethrows HttpException', async () => {
      wallet.cancelDeposit.mockRejectedValue(new NotFoundException());
      await expect(controller.cancelDeposit(user, 'dep-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      wallet.cancelDeposit.mockRejectedValue(new Error('boom'));
      await expect(controller.cancelDeposit(user, 'dep-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      wallet.cancelDeposit.mockRejectedValue('plain string');
      await expect(controller.cancelDeposit(user, 'dep-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('requestWithdrawal', () => {
    it('creates withdrawal when enabled', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      wallet.requestWithdrawal.mockResolvedValue({ withdrawalId: 'w-1' } as any);

      const dto = { valueCC: 100, pixKey: 'key', pixKeyType: PixKeyType.EMAIL };
      const result = await controller.requestWithdrawal(user, dto as any);
      expect(wallet.requestWithdrawal).toHaveBeenCalledWith('user-1', 100, 'key', PixKeyType.EMAIL);
      expect(result).toEqual({ withdrawalId: 'w-1' });
    });

    it('throws ForbiddenException when withdrawals are disabled', async () => {
      platformConfig.getBoolean.mockResolvedValue(false);
      await expect(controller.requestWithdrawal(user, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rethrows HttpException from service', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      wallet.requestWithdrawal.mockRejectedValue(new NotFoundException());
      await expect(controller.requestWithdrawal(user, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      wallet.requestWithdrawal.mockRejectedValue(new Error('boom'));
      await expect(controller.requestWithdrawal(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      wallet.requestWithdrawal.mockRejectedValue('plain string');
      await expect(controller.requestWithdrawal(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('savePixKey', () => {
    it('updates user pix key and logs activity', async () => {
      usersRepo.update.mockResolvedValue(undefined as any);

      const result = await controller.savePixKey(user, { pixKey: 'k', pixKeyType: PixKeyType.CPF } as any);
      expect(usersRepo.update).toHaveBeenCalledWith('user-1', { pixKey: 'k', pixKeyType: PixKeyType.CPF });
      expect(activity.log).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('rethrows HttpException', async () => {
      usersRepo.update.mockRejectedValue(new NotFoundException());
      await expect(controller.savePixKey(user, { pixKey: 'k', pixKeyType: PixKeyType.CPF } as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      usersRepo.update.mockRejectedValue(new Error('boom'));
      await expect(controller.savePixKey(user, { pixKey: 'k', pixKeyType: PixKeyType.CPF } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      usersRepo.update.mockRejectedValue('plain string');
      await expect(controller.savePixKey(user, { pixKey: 'k', pixKeyType: PixKeyType.CPF } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
