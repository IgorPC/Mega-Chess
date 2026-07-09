import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let svc: jest.Mocked<AdminUsersService>;
  const admin = { id: 'admin-1' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {
            list: jest.fn(), get: jest.fn(), transactions: jest.fn(),
            tickets: jest.fn(), activityLogs: jest.fn(), sendMessage: jest.fn(),
            suspend: jest.fn(), forceLogout: jest.fn(), adjustElo: jest.fn(),
            exportCsvData: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminUsersController);
    svc = module.get(AdminUsersService);
  });

  describe('list', () => {
    it('delegates with parsed query params', async () => {
      svc.list.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.list({ page: '2', limit: '5', search: 'bob', status: 'ACTIVE' });
      expect(svc.list).toHaveBeenCalledWith({ page: 2, limit: 5, search: 'bob', status: 'ACTIVE' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.list.mockRejectedValue(new NotFoundException());
      await expect(controller.list({})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.list.mockRejectedValue(new Error('boom'));
      await expect(controller.list({})).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.list.mockRejectedValue('plain string');
      await expect(controller.list({})).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('export', () => {
    it('sends CSV response', async () => {
      svc.exportCsvData.mockResolvedValue('id,name\n1,X');
      const res = { setHeader: jest.fn(), send: jest.fn() } as any;
      await controller.export(res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.send).toHaveBeenCalledWith('id,name\n1,X');
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.exportCsvData.mockRejectedValue(new NotFoundException());
      await expect(controller.export({} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.exportCsvData.mockRejectedValue(new Error('boom'));
      await expect(controller.export({} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.exportCsvData.mockRejectedValue('plain string');
      await expect(controller.export({} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('get', () => {
    it('returns user data', async () => {
      svc.get.mockResolvedValue({ id: 'u1' } as any);
      expect(await controller.get('u1')).toEqual({ id: 'u1' });
    });

    it('rethrows NotFoundException', async () => {
      svc.get.mockRejectedValue(new NotFoundException());
      await expect(controller.get('u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.get.mockRejectedValue(new Error('boom'));
      await expect(controller.get('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.get.mockRejectedValue('plain string');
      await expect(controller.get('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('transactions', () => {
    it('delegates with parsed page', async () => {
      svc.transactions.mockResolvedValue({ data: [], total: 0, page: 2, totalPages: 0 });
      await controller.transactions('u1', '2');
      expect(svc.transactions).toHaveBeenCalledWith('u1', 2);
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.transactions.mockRejectedValue(new NotFoundException());
      await expect(controller.transactions('u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.transactions.mockRejectedValue(new Error('boom'));
      await expect(controller.transactions('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.transactions.mockRejectedValue('plain string');
      await expect(controller.transactions('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('tickets', () => {
    it('delegates to service', async () => {
      svc.tickets.mockResolvedValue([]);
      expect(await controller.tickets('u1')).toEqual([]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.tickets.mockRejectedValue(new NotFoundException());
      await expect(controller.tickets('u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.tickets.mockRejectedValue(new Error('boom'));
      await expect(controller.tickets('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.tickets.mockRejectedValue('plain string');
      await expect(controller.tickets('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('activity', () => {
    it('delegates with parsed page', async () => {
      svc.activityLogs.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.activity('u1', '3');
      expect(svc.activityLogs).toHaveBeenCalledWith('u1', 3);
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.activityLogs.mockRejectedValue(new NotFoundException());
      await expect(controller.activity('u1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.activityLogs.mockRejectedValue(new Error('boom'));
      await expect(controller.activity('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.activityLogs.mockRejectedValue('plain string');
      await expect(controller.activity('u1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('sendMessage', () => {
    it('delegates to service', async () => {
      svc.sendMessage.mockResolvedValue(undefined);
      await controller.sendMessage('u1', { title: 'T', content: 'C' } as any, admin);
      expect(svc.sendMessage).toHaveBeenCalledWith('u1', 'T', 'C', admin);
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.sendMessage.mockRejectedValue(new NotFoundException());
      await expect(controller.sendMessage('u1', {} as any, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.sendMessage.mockRejectedValue(new Error('boom'));
      await expect(controller.sendMessage('u1', {} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.sendMessage.mockRejectedValue('plain string');
      await expect(controller.sendMessage('u1', {} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('suspend', () => {
    it('delegates with dto fields', async () => {
      svc.suspend.mockResolvedValue(undefined);
      await controller.suspend('u1', { reason: 'R', duration: '24h' } as any, admin);
      expect(svc.suspend).toHaveBeenCalledWith('u1', 'R', '24h', true, admin);
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.suspend.mockRejectedValue(new NotFoundException());
      await expect(controller.suspend('u1', { reason: 'R', duration: '24h' } as any, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.suspend.mockRejectedValue(new Error('boom'));
      await expect(controller.suspend('u1', { reason: 'R', duration: '24h' } as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.suspend.mockRejectedValue('plain string');
      await expect(controller.suspend('u1', { reason: 'R', duration: '24h' } as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('forceLogout', () => {
    it('delegates to service', async () => {
      svc.forceLogout.mockResolvedValue(undefined);
      await controller.forceLogout('u1', admin);
      expect(svc.forceLogout).toHaveBeenCalledWith('u1', admin);
    });

    it('rethrows a known HttpException unchanged', async () => {
      svc.forceLogout.mockRejectedValue(new NotFoundException());
      await expect(controller.forceLogout('u1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.forceLogout.mockRejectedValue(new Error('boom'));
      await expect(controller.forceLogout('u1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.forceLogout.mockRejectedValue('plain string');
      await expect(controller.forceLogout('u1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('adjustElo', () => {
    it('delegates to service', async () => {
      svc.adjustElo.mockResolvedValue(undefined);
      await controller.adjustElo('u1', { newRating: 1500, reason: 'Long reason text here' } as any, admin);
      expect(svc.adjustElo).toHaveBeenCalledWith('u1', 1500, 'Long reason text here', admin);
    });

    it('rethrows NotFoundException', async () => {
      svc.adjustElo.mockRejectedValue(new NotFoundException());
      await expect(controller.adjustElo('u1', {} as any, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.adjustElo.mockRejectedValue(new Error('boom'));
      await expect(controller.adjustElo('u1', {} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.adjustElo.mockRejectedValue('plain string');
      await expect(controller.adjustElo('u1', {} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
