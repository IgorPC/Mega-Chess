import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminTransactionsController } from './admin-transactions.controller';
import { AdminTransactionsService } from './admin-transactions.service';

describe('AdminTransactionsController', () => {
  let controller: AdminTransactionsController;
  let service: jest.Mocked<AdminTransactionsService>;

  const admin = { id: 'admin-1', name: 'Admin' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminTransactionsController],
      providers: [
        {
          provide: AdminTransactionsService,
          useValue: {
            listTransactions: jest.fn(), listDeposits: jest.fn(), listWithdrawals: jest.fn(),
            approveWithdrawal: jest.fn(), rejectWithdrawal: jest.fn(), refund: jest.fn(),
            financialSummary: jest.fn(), rakeSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminTransactionsController);
    service = module.get(AdminTransactionsService);
  });

  describe('list', () => {
    it('applies defaults', async () => {
      service.listTransactions.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.list();
      expect(service.listTransactions).toHaveBeenCalledWith(1, 20);
    });

    it('forwards explicit page/limit', async () => {
      service.listTransactions.mockResolvedValue({ data: [], total: 0, page: 2, totalPages: 0 });
      await controller.list('2', '5');
      expect(service.listTransactions).toHaveBeenCalledWith(2, 5);
    });

    it('rethrows HttpException unchanged', async () => {
      service.listTransactions.mockRejectedValue(new NotFoundException());
      await expect(controller.list()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.listTransactions.mockRejectedValue(new Error('boom'));
      await expect(controller.list()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.listTransactions.mockRejectedValue('plain string');
      await expect(controller.list()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('deposits', () => {
    it('applies defaults', async () => {
      service.listDeposits.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.deposits();
      expect(service.listDeposits).toHaveBeenCalledWith(1, 20);
    });

    it('rethrows HttpException unchanged', async () => {
      service.listDeposits.mockRejectedValue(new NotFoundException());
      await expect(controller.deposits()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.listDeposits.mockRejectedValue(new Error('boom'));
      await expect(controller.deposits()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.listDeposits.mockRejectedValue('plain string');
      await expect(controller.deposits()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('withdrawals', () => {
    it('forwards status filter', async () => {
      service.listWithdrawals.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.withdrawals('1', '20', 'BLOCKED');
      expect(service.listWithdrawals).toHaveBeenCalledWith(1, 20, 'BLOCKED');
    });

    it('rethrows HttpException unchanged', async () => {
      service.listWithdrawals.mockRejectedValue(new NotFoundException());
      await expect(controller.withdrawals()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.listWithdrawals.mockRejectedValue(new Error('boom'));
      await expect(controller.withdrawals()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.listWithdrawals.mockRejectedValue('plain string');
      await expect(controller.withdrawals()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('approve', () => {
    it('delegates to service', async () => {
      service.approveWithdrawal.mockResolvedValue(undefined);
      await controller.approve('w1', admin);
      expect(service.approveWithdrawal).toHaveBeenCalledWith('w1', admin);
    });

    it('rethrows HttpException unchanged', async () => {
      service.approveWithdrawal.mockRejectedValue(new NotFoundException());
      await expect(controller.approve('w1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.approveWithdrawal.mockRejectedValue(new Error('boom'));
      await expect(controller.approve('w1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.approveWithdrawal.mockRejectedValue('plain string');
      await expect(controller.approve('w1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('reject', () => {
    it('delegates to service', async () => {
      service.rejectWithdrawal.mockResolvedValue(undefined);
      await controller.reject('w1', { reason: 'suspeito' } as any, admin);
      expect(service.rejectWithdrawal).toHaveBeenCalledWith('w1', 'suspeito', admin);
    });

    it('rethrows HttpException unchanged', async () => {
      service.rejectWithdrawal.mockRejectedValue(new NotFoundException());
      await expect(controller.reject('w1', { reason: 'x' } as any, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.rejectWithdrawal.mockRejectedValue(new Error('boom'));
      await expect(controller.reject('w1', { reason: 'x' } as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.rejectWithdrawal.mockRejectedValue('plain string');
      await expect(controller.reject('w1', { reason: 'x' } as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('refund', () => {
    it('delegates to service', async () => {
      service.refund.mockResolvedValue(undefined);
      await controller.refund({ userId: 'u1', amountCc: 10, reason: 'x' } as any, admin);
      expect(service.refund).toHaveBeenCalledWith('u1', 10, 'x', admin);
    });

    it('rethrows HttpException unchanged', async () => {
      service.refund.mockRejectedValue(new NotFoundException());
      await expect(controller.refund({ userId: 'u1', amountCc: 10, reason: 'x' } as any, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.refund.mockRejectedValue(new Error('boom'));
      await expect(controller.refund({ userId: 'u1', amountCc: 10, reason: 'x' } as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.refund.mockRejectedValue('plain string');
      await expect(controller.refund({ userId: 'u1', amountCc: 10, reason: 'x' } as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('financialSummary', () => {
    it('applies default period', async () => {
      service.financialSummary.mockResolvedValue({} as any);
      await controller.financialSummary();
      expect(service.financialSummary).toHaveBeenCalledWith('all');
    });

    it('rethrows HttpException unchanged', async () => {
      service.financialSummary.mockRejectedValue(new NotFoundException());
      await expect(controller.financialSummary()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.financialSummary.mockRejectedValue(new Error('boom'));
      await expect(controller.financialSummary()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.financialSummary.mockRejectedValue('plain string');
      await expect(controller.financialSummary()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('rakeSummary', () => {
    it('applies default period', async () => {
      service.rakeSummary.mockResolvedValue({} as any);
      await controller.rakeSummary();
      expect(service.rakeSummary).toHaveBeenCalledWith('30d');
    });

    it('rethrows HttpException unchanged', async () => {
      service.rakeSummary.mockRejectedValue(new NotFoundException());
      await expect(controller.rakeSummary()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.rakeSummary.mockRejectedValue(new Error('boom'));
      await expect(controller.rakeSummary()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.rakeSummary.mockRejectedValue('plain string');
      await expect(controller.rakeSummary()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
