import { InternalServerErrorException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminIpBlacklistController } from './admin-ip-blacklist.controller';
import { AdminIpBlacklistService } from './admin-ip-blacklist.service';

describe('AdminIpBlacklistController', () => {
  let controller: AdminIpBlacklistController;
  let service: jest.Mocked<AdminIpBlacklistService>;

  const admin = { id: 'admin-1', name: 'Alice' } as any;
  const req = { ip: '9.9.9.9' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminIpBlacklistController],
      providers: [
        {
          provide: AdminIpBlacklistService,
          useValue: { list: jest.fn(), add: jest.fn(), update: jest.fn(), remove: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AdminIpBlacklistController);
    service = module.get(AdminIpBlacklistService);
  });

  describe('list', () => {
    it('applies default pagination when no query params are given', async () => {
      service.list.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.list(undefined, undefined, undefined);
      expect(service.list).toHaveBeenCalledWith(1, 25, undefined);
    });

    it('forwards explicit query params', async () => {
      service.list.mockResolvedValue({ data: [], total: 0, page: 2, totalPages: 1 });
      await controller.list('2', '10', '1.2.3.4');
      expect(service.list).toHaveBeenCalledWith(2, 10, '1.2.3.4');
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.list.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.list(undefined, undefined, undefined)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.list.mockRejectedValue(new Error('boom'));
      await expect(controller.list(undefined, undefined, undefined)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.list.mockRejectedValue('plain string');
      await expect(controller.list(undefined, undefined, undefined)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('add', () => {
    it('parses the expiry date and forwards to the service', async () => {
      service.add.mockResolvedValue({ ip: '1.1.1.1' } as any);
      await controller.add({ ip: '1.1.1.1', reason: 'bad', expiresAt: '2026-01-01' }, admin, req);
      expect(service.add).toHaveBeenCalledWith('1.1.1.1', 'bad', new Date('2026-01-01'), admin, '9.9.9.9');
    });

    it('defaults reason to null and expiresAt to null when omitted', async () => {
      service.add.mockResolvedValue({ ip: '1.1.1.1' } as any);
      await controller.add({ ip: '1.1.1.1' }, admin, req);
      expect(service.add).toHaveBeenCalledWith('1.1.1.1', null, null, admin, '9.9.9.9');
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.add.mockRejectedValue(new ConflictException('exists'));
      await expect(controller.add({ ip: '1.1.1.1' }, admin, req)).rejects.toBeInstanceOf(ConflictException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.add.mockRejectedValue(new Error('boom'));
      await expect(controller.add({ ip: '1.1.1.1' }, admin, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.add.mockRejectedValue('plain string');
      await expect(controller.add({ ip: '1.1.1.1' }, admin, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('forwards only the fields present in the DTO', async () => {
      service.update.mockResolvedValue({ ip: '1.1.1.1' } as any);
      await controller.update('1.1.1.1', { reason: 'updated' }, admin, req);
      expect(service.update).toHaveBeenCalledWith('1.1.1.1', { reason: 'updated' }, admin, '9.9.9.9');
    });

    it('parses a provided expiresAt string into a Date', async () => {
      service.update.mockResolvedValue({ ip: '1.1.1.1' } as any);
      await controller.update('1.1.1.1', { expiresAt: '2026-06-01' }, admin, req);
      expect(service.update).toHaveBeenCalledWith('1.1.1.1', { expiresAt: new Date('2026-06-01') }, admin, '9.9.9.9');
    });

    it('treats an explicit null expiresAt as clearing the expiry', async () => {
      service.update.mockResolvedValue({ ip: '1.1.1.1' } as any);
      await controller.update('1.1.1.1', { expiresAt: null }, admin, req);
      expect(service.update).toHaveBeenCalledWith('1.1.1.1', { expiresAt: null }, admin, '9.9.9.9');
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.update.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.update('1.1.1.1', {}, admin, req)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.update.mockRejectedValue(new Error('boom'));
      await expect(controller.update('1.1.1.1', {}, admin, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.update.mockRejectedValue('plain string');
      await expect(controller.update('1.1.1.1', {}, admin, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('remove', () => {
    it('forwards to the service', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove('1.1.1.1', admin, req);
      expect(service.remove).toHaveBeenCalledWith('1.1.1.1', admin, '9.9.9.9');
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.remove.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.remove('1.1.1.1', admin, req)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.remove.mockRejectedValue(new Error('boom'));
      await expect(controller.remove('1.1.1.1', admin, req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.remove.mockRejectedValue('plain string');
      await expect(controller.remove('1.1.1.1', admin, req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
