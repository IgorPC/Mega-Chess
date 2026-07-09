import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

describe('SupportController', () => {
  let controller: SupportController;
  let service: jest.Mocked<SupportService>;

  const user = { id: 'user-1' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [
        {
          provide: SupportService,
          useValue: {
            createTicket: jest.fn(),
            getMyTickets: jest.fn(),
            getTicket: jest.fn(),
            addMessage: jest.fn(),
            attachFile: jest.fn(),
            getAttachment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SupportController);
    service = module.get(SupportService);
  });

  describe('create', () => {
    it('creates a ticket', async () => {
      service.createTicket.mockResolvedValue({ id: 't1' } as any);
      const result = await controller.create(user, { title: 't' } as any);
      expect(result).toEqual({ id: 't1' });
    });

    it('rethrows HttpException from service', async () => {
      service.createTicket.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.create(user, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.createTicket.mockRejectedValue(new Error('boom'));
      await expect(controller.create(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.createTicket.mockRejectedValue('plain string');
      await expect(controller.create(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('list', () => {
    it('caps the limit at 50', async () => {
      service.getMyTickets.mockResolvedValue({ items: [] } as any);
      await controller.list(user, 1, 100);
      expect(service.getMyTickets).toHaveBeenCalledWith('user-1', 1, 50);
    });

    it('rethrows HttpException from service', async () => {
      service.getMyTickets.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.list(user, 1, 20)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.getMyTickets.mockRejectedValue(new Error('boom'));
      await expect(controller.list(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.getMyTickets.mockRejectedValue('plain string');
      await expect(controller.list(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getOne', () => {
    it('returns the ticket', async () => {
      service.getTicket.mockResolvedValue({ id: 't1' } as any);
      const result = await controller.getOne(user, 't1');
      expect(result).toEqual({ id: 't1' });
    });

    it('rethrows HttpException from service', async () => {
      service.getTicket.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getOne(user, 't1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.getTicket.mockRejectedValue(new Error('boom'));
      await expect(controller.getOne(user, 't1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.getTicket.mockRejectedValue('plain string');
      await expect(controller.getOne(user, 't1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('addMessage', () => {
    it('adds a message', async () => {
      service.addMessage.mockResolvedValue({ id: 'm1' } as any);
      const result = await controller.addMessage(user, 't1', { content: 'x' } as any);
      expect(result).toEqual({ id: 'm1' });
    });

    it('rethrows HttpException from service', async () => {
      service.addMessage.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.addMessage(user, 't1', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.addMessage.mockRejectedValue(new Error('boom'));
      await expect(controller.addMessage(user, 't1', {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.addMessage.mockRejectedValue('plain string');
      await expect(controller.addMessage(user, 't1', {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('uploadAttachment', () => {
    it('uploads an attachment', async () => {
      service.attachFile.mockResolvedValue({ id: 'att1' } as any);
      const file = { filename: 'a.png' } as any;
      const result = await controller.uploadAttachment(user, 't1', 'm1', file);
      expect(result).toEqual({ id: 'att1' });
    });

    it('rethrows HttpException from service', async () => {
      service.attachFile.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.uploadAttachment(user, 't1', 'm1', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.attachFile.mockRejectedValue(new Error('boom'));
      await expect(controller.uploadAttachment(user, 't1', 'm1', {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.attachFile.mockRejectedValue('plain string');
      await expect(controller.uploadAttachment(user, 't1', 'm1', {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('downloadAttachment', () => {
    it('returns 404 json when file does not exist on disk', async () => {
      service.getAttachment.mockResolvedValue({ filePath: '/nonexistent/path/file.png', mimeType: 'image/png', originalName: 'file.png' } as any);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() } as any;

      await controller.downloadAttachment(user, 't1', 'a1', res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Arquivo não encontrado' });
    });

    it('rethrows HttpException from service', async () => {
      service.getAttachment.mockRejectedValue(new NotFoundException('nope'));
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() } as any;
      await expect(controller.downloadAttachment(user, 't1', 'a1', res)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.getAttachment.mockRejectedValue(new Error('boom'));
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() } as any;
      await expect(controller.downloadAttachment(user, 't1', 'a1', res)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.getAttachment.mockRejectedValue('plain string');
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), set: jest.fn() } as any;
      await expect(controller.downloadAttachment(user, 't1', 'a1', res)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
