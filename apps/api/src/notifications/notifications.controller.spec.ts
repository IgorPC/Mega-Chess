import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: {
            getUnread: jest.fn(),
            markOneRead: jest.fn(),
            markAllRead: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(NotificationsController);
    service = module.get(NotificationsService);
  });

  describe('getUnread', () => {
    it('returns unread notifications for the current user', async () => {
      service.getUnread.mockResolvedValue([{ id: 'n-1' }] as any);
      const result = await controller.getUnread({ id: 'user-1' });
      expect(service.getUnread).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'n-1' }]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getUnread.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getUnread({ id: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getUnread.mockRejectedValue(new Error('db down'));
      await expect(controller.getUnread({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getUnread.mockRejectedValue('plain string');
      await expect(controller.getUnread({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('markOneRead', () => {
    it('marks a single notification as read', async () => {
      service.markOneRead.mockResolvedValue({ status: 'ok' });
      const result = await controller.markOneRead({ id: 'user-1' }, 'n-1');
      expect(service.markOneRead).toHaveBeenCalledWith('user-1', 'n-1');
      expect(result).toEqual({ status: 'ok' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.markOneRead.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.markOneRead({ id: 'user-1' }, 'n-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.markOneRead.mockRejectedValue(new Error('boom'));
      await expect(controller.markOneRead({ id: 'user-1' }, 'n-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.markOneRead.mockRejectedValue('plain string');
      await expect(controller.markOneRead({ id: 'user-1' }, 'n-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('markAllRead', () => {
    it('marks all notifications as read for the current user', async () => {
      service.markAllRead.mockResolvedValue({ status: 'ok' });
      const result = await controller.markAllRead({ id: 'user-1' });
      expect(service.markAllRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ status: 'ok' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.markAllRead.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.markAllRead({ id: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.markAllRead.mockRejectedValue(new Error('boom'));
      await expect(controller.markAllRead({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.markAllRead.mockRejectedValue('plain string');
      await expect(controller.markAllRead({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
