import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType } from '../entities/notification.entity';
import { NotificationEventsService } from './notification-events.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifications: any;
  let events: jest.Mocked<NotificationEventsService>;
  let qbMock: any;

  beforeEach(async () => {
    qbMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => qbMock),
          },
        },
        { provide: NotificationEventsService, useValue: { emitCreated: jest.fn() } },
      ],
    }).compile();

    service = module.get(NotificationsService);
    notifications = module.get(getRepositoryToken(Notification));
    events = module.get(NotificationEventsService);
  });

  describe('create', () => {
    it('creates, saves and emits the created event with the saved entity', async () => {
      notifications.create.mockReturnValue({ userId: 'user-1', type: NotificationType.FRIEND_REQUEST, payload: {} });
      notifications.save.mockResolvedValue({ id: 'n-1', userId: 'user-1', type: NotificationType.FRIEND_REQUEST, payload: {} });

      const result = await service.create('user-1', NotificationType.FRIEND_REQUEST, { foo: 'bar' });

      expect(notifications.create).toHaveBeenCalledWith({ userId: 'user-1', type: NotificationType.FRIEND_REQUEST, payload: { foo: 'bar' } });
      expect(events.emitCreated).toHaveBeenCalledWith('user-1', { id: 'n-1', userId: 'user-1', type: NotificationType.FRIEND_REQUEST, payload: {} });
      expect(result).toEqual({ id: 'n-1', userId: 'user-1', type: NotificationType.FRIEND_REQUEST, payload: {} });
    });
  });

  describe('getUnread', () => {
    it('finds unread notifications ordered by newest first', async () => {
      notifications.find.mockResolvedValue([{ id: 'n-1' }]);
      const result = await service.getUnread('user-1');
      expect(notifications.find).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([{ id: 'n-1' }]);
    });

    it('returns an empty array when there are no unread notifications', async () => {
      notifications.find.mockResolvedValue([]);
      const result = await service.getUnread('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('markDuelInviteRead', () => {
    it('updates duel invite notifications matching the tournamentId for the user', async () => {
      qbMock.execute.mockResolvedValue({ affected: 1 });
      await service.markDuelInviteRead('user-1', 'tourney-1');
      expect(qbMock.where).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'tournamentId' = :tournamentId"),
        { userId: 'user-1', type: NotificationType.DUEL_INVITE, tournamentId: 'tourney-1' },
      );
    });
  });

  describe('markDuelInviteReadByTournament', () => {
    it('updates duel invite notifications for all users for a tournament', async () => {
      qbMock.execute.mockResolvedValue({ affected: 3 });
      await service.markDuelInviteReadByTournament('tourney-1');
      expect(qbMock.where).toHaveBeenCalledWith(
        expect.stringContaining("payload->>'tournamentId' = :tournamentId"),
        { type: NotificationType.DUEL_INVITE, tournamentId: 'tourney-1' },
      );
    });
  });

  describe('markOneRead', () => {
    it('marks a single unread notification as read and returns status ok', async () => {
      qbMock.execute.mockResolvedValue({ affected: 1 });
      const result = await service.markOneRead('user-1', 'n-1');
      expect(qbMock.where).toHaveBeenCalledWith(
        'id = :notificationId AND user_id = :userId AND read_at IS NULL',
        { notificationId: 'n-1', userId: 'user-1' },
      );
      expect(result).toEqual({ status: 'ok' });
    });

    it('still returns status ok even when no rows were affected', async () => {
      qbMock.execute.mockResolvedValue({ affected: 0 });
      const result = await service.markOneRead('user-1', 'missing');
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('markAllRead', () => {
    it('marks all unread notifications for a user as read', async () => {
      qbMock.execute.mockResolvedValue({ affected: 5 });
      const result = await service.markAllRead('user-1');
      expect(qbMock.where).toHaveBeenCalledWith('user_id = :userId AND read_at IS NULL', { userId: 'user-1' });
      expect(result).toEqual({ status: 'ok' });
    });
  });
});
