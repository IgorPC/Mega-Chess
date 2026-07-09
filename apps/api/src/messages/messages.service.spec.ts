import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { Message } from '../entities/message.entity';
import { GameGateway } from '../game/game.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';

describe('MessagesService', () => {
  let service: MessagesService;
  let messages: any;
  let game: jest.Mocked<GameGateway>;
  let notifications: jest.Mocked<NotificationsService>;

  beforeEach(async () => {
    const qbMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getRepositoryToken(Message),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => qbMock),
            manager: { query: jest.fn() },
          },
        },
        { provide: GameGateway, useValue: { emitToUser: jest.fn() } },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = module.get(MessagesService);
    messages = module.get(getRepositoryToken(Message));
    game = module.get(GameGateway);
    notifications = module.get(NotificationsService);
  });

  describe('send', () => {
    it('creates and saves the message, emits realtime event and persists a notification', async () => {
      messages.create.mockReturnValue({ id: 'm-1' });
      messages.save.mockResolvedValue({ id: 'm-1' });
      messages.findOne.mockResolvedValue({
        id: 'm-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        content: 'hello there',
        sender: { nickname: 'alice' },
      });

      const result = await service.send('user-1', 'user-2', 'hello there');

      expect(messages.create).toHaveBeenCalledWith({ senderId: 'user-1', receiverId: 'user-2', content: 'hello there' });
      expect(game.emitToUser).toHaveBeenCalledWith('user-2', 'new_message', expect.objectContaining({ id: 'm-1' }));
      expect(notifications.create).toHaveBeenCalledWith('user-2', NotificationType.MESSAGE_RECEIVED, {
        senderId: 'user-1',
        senderNickname: 'alice',
        preview: 'hello there',
      });
      expect(result).toEqual(expect.objectContaining({ id: 'm-1' }));
    });

    it('truncates a long message content to 60 chars in the notification preview', async () => {
      const longContent = 'x'.repeat(100);
      messages.create.mockReturnValue({ id: 'm-2' });
      messages.save.mockResolvedValue({ id: 'm-2' });
      messages.findOne.mockResolvedValue({
        id: 'm-2',
        senderId: 'user-1',
        receiverId: 'user-2',
        content: longContent,
        sender: { nickname: 'alice' },
      });

      await service.send('user-1', 'user-2', longContent);

      expect(notifications.create).toHaveBeenCalledWith(
        'user-2',
        NotificationType.MESSAGE_RECEIVED,
        expect.objectContaining({ preview: longContent.slice(0, 60) }),
      );
    });

    it('falls back to an empty nickname when sender relation is missing', async () => {
      messages.create.mockReturnValue({ id: 'm-3' });
      messages.save.mockResolvedValue({ id: 'm-3' });
      messages.findOne.mockResolvedValue({
        id: 'm-3',
        senderId: 'user-1',
        receiverId: 'user-2',
        content: 'hi',
        sender: null,
      });

      await service.send('user-1', 'user-2', 'hi');

      expect(notifications.create).toHaveBeenCalledWith(
        'user-2',
        NotificationType.MESSAGE_RECEIVED,
        expect.objectContaining({ senderNickname: '' }),
      );
    });
  });

  describe('getConversation', () => {
    it('marks unread messages from the other user as read and returns the ordered conversation', async () => {
      const qb = messages.createQueryBuilder();
      qb.execute.mockResolvedValue({ affected: 2 });
      messages.find.mockResolvedValue([{ id: 'm-1' }, { id: 'm-2' }]);

      const result = await service.getConversation('user-1', 'user-2');

      expect(qb.update).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith(
        'sender_id = :otherId AND receiver_id = :userId AND read_at IS NULL',
        { otherId: 'user-2', userId: 'user-1' },
      );
      expect(messages.find).toHaveBeenCalledWith({
        where: [
          { senderId: 'user-1', receiverId: 'user-2' },
          { senderId: 'user-2', receiverId: 'user-1' },
        ],
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual([{ id: 'm-1' }, { id: 'm-2' }]);
    });

    it('returns an empty array when there is no conversation history', async () => {
      messages.createQueryBuilder().execute.mockResolvedValue({ affected: 0 });
      messages.find.mockResolvedValue([]);
      const result = await service.getConversation('user-1', 'user-2');
      expect(result).toEqual([]);
    });
  });

  describe('getConversations', () => {
    it('maps raw query rows into user + lastMessage shape', async () => {
      messages.manager.query.mockResolvedValue([
        {
          id: 'm-1', sender_id: 'user-1', receiver_id: 'user-2',
          content: 'hi', read_at: null, created_at: '2026-01-01T00:00:00Z',
          other_id: 'user-2', other_nickname: 'bob', other_name: 'Bob', other_avatar_url: 'b.png',
        },
      ]);

      const result = await service.getConversations('user-1');

      expect(messages.manager.query).toHaveBeenCalledWith(expect.any(String), ['user-1']);
      expect(result).toEqual([
        {
          user: { id: 'user-2', nickname: 'bob', name: 'Bob', avatarUrl: 'b.png' },
          lastMessage: {
            id: 'm-1', senderId: 'user-1', receiverId: 'user-2',
            content: 'hi', readAt: null, createdAt: '2026-01-01T00:00:00Z',
          },
        },
      ]);
    });

    it('returns an empty array when the user has no conversations', async () => {
      messages.manager.query.mockResolvedValue([]);
      const result = await service.getConversations('user-1');
      expect(result).toEqual([]);
    });
  });
});
