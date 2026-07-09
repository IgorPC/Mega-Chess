import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { TicketStatus } from '../../entities/support-ticket.entity';

describe('AdminSupportController', () => {
  let controller: AdminSupportController;
  let service: jest.Mocked<AdminSupportService>;

  const admin = { id: 'admin-1', name: 'Admin' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminSupportController],
      providers: [
        {
          provide: AdminSupportService,
          useValue: {
            list: jest.fn(), get: jest.fn(), getMessages: jest.fn(), reply: jest.fn(),
            updateStatus: jest.fn(), assign: jest.fn(), aiSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminSupportController);
    service = module.get(AdminSupportService);
  });

  describe('list', () => {
    it('applies defaults for page/limit', async () => {
      service.list.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.list({});
      expect(service.list).toHaveBeenCalledWith({ page: 1, limit: 25, status: undefined, category: undefined, search: undefined });
    });

    it('forwards explicit page/limit/status/category/search', async () => {
      service.list.mockResolvedValue({ data: [], total: 0, page: 2, totalPages: 0 });
      await controller.list({ page: '2', limit: '10', status: 'OPEN', category: 'billing', search: 'foo' });
      expect(service.list).toHaveBeenCalledWith({ page: 2, limit: 10, status: 'OPEN', category: 'billing', search: 'foo' });
    });

    it('rethrows HttpException unchanged', async () => {
      service.list.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.list({})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.list.mockRejectedValue(new Error('db fail'));
      await expect(controller.list({})).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('get', () => {
    it('returns the ticket', async () => {
      service.get.mockResolvedValue({ id: 't1' } as any);
      const result = await controller.get('t1');
      expect(result).toEqual({ id: 't1' });
    });

    it('wraps unexpected errors as 500', async () => {
      service.get.mockRejectedValue(new Error('boom'));
      await expect(controller.get('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('messages', () => {
    it('returns messages list', async () => {
      service.getMessages.mockResolvedValue([]);
      const result = await controller.messages('t1');
      expect(result).toEqual([]);
    });

    it('wraps unexpected errors as 500', async () => {
      service.getMessages.mockRejectedValue(new Error('boom'));
      await expect(controller.messages('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('reply', () => {
    it('delegates to service with default isInternal', async () => {
      service.reply.mockResolvedValue({} as any);
      await controller.reply('t1', { content: 'hi' } as any, admin);
      expect(service.reply).toHaveBeenCalledWith('t1', 'hi', false, admin);
    });

    it('rethrows HttpException unchanged', async () => {
      service.reply.mockRejectedValue(new NotFoundException());
      await expect(controller.reply('t1', { content: 'hi' } as any, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.reply.mockRejectedValue(new Error('boom'));
      await expect(controller.reply('t1', { content: 'hi' } as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('updateStatus', () => {
    it('delegates to service', async () => {
      service.updateStatus.mockResolvedValue(undefined);
      await controller.updateStatus('t1', { status: TicketStatus.CLOSED }, admin);
      expect(service.updateStatus).toHaveBeenCalledWith('t1', TicketStatus.CLOSED, admin);
    });

    it('wraps unexpected errors as 500', async () => {
      service.updateStatus.mockRejectedValue(new Error('boom'));
      await expect(controller.updateStatus('t1', { status: TicketStatus.CLOSED }, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('assign', () => {
    it('delegates to service', async () => {
      service.assign.mockResolvedValue(undefined);
      await controller.assign('t1', { adminId: 'a2' }, admin);
      expect(service.assign).toHaveBeenCalledWith('t1', 'a2', admin);
    });

    it('wraps unexpected errors as 500', async () => {
      service.assign.mockRejectedValue(new Error('boom'));
      await expect(controller.assign('t1', { adminId: 'a2' }, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('aiSummary', () => {
    it('returns the AI summary', async () => {
      service.aiSummary.mockResolvedValue({ summary: 'resumo' });
      const result = await controller.aiSummary('t1');
      expect(result).toEqual({ summary: 'resumo' });
    });

    it('wraps unexpected errors as 500', async () => {
      service.aiSummary.mockRejectedValue(new Error('boom'));
      await expect(controller.aiSummary('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
