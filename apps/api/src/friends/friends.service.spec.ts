import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { Friendship, FriendshipStatus } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';
import { GameGateway } from '../game/game.gateway';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';

describe('FriendsService', () => {
  let service: FriendsService;
  let friendships: any;
  let users: any;
  let notifications: jest.Mocked<NotificationsService>;
  let game: jest.Mocked<GameGateway>;
  let activity: jest.Mocked<UserActivityService>;

  beforeEach(async () => {
    const qbMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      getOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: getRepositoryToken(Friendship),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => qbMock),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: GameGateway, useValue: { emitToUser: jest.fn() } },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(FriendsService);
    friendships = module.get(getRepositoryToken(Friendship));
    users = module.get(getRepositoryToken(User));
    notifications = module.get(NotificationsService);
    game = module.get(GameGateway);
    activity = module.get(UserActivityService);
  });

  describe('sendRequest', () => {
    it('throws NotFoundException when the receiver does not exist', async () => {
      users.findOne.mockResolvedValueOnce(null);
      await expect(service.sendRequest('user-1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when trying to add yourself', async () => {
      users.findOne.mockResolvedValueOnce({ id: 'user-1', nickname: 'me' });
      await expect(service.sendRequest('user-1', 'me')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ConflictException when a request already exists', async () => {
      users.findOne.mockResolvedValueOnce({ id: 'user-2', nickname: 'bob' });
      friendships.createQueryBuilder().getOne.mockResolvedValueOnce({ id: 'existing' });
      await expect(service.sendRequest('user-1', 'bob')).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates a friendship, notifies, emits socket event and logs activity', async () => {
      users.findOne
        .mockResolvedValueOnce({ id: 'user-2', nickname: 'bob' }) // receiver
        .mockResolvedValueOnce({ id: 'user-1', nickname: 'alice', avatarUrl: 'a.png' }); // requester
      friendships.createQueryBuilder().getOne.mockResolvedValueOnce(null);
      friendships.create.mockReturnValue({ id: 'f-1' });
      friendships.save.mockResolvedValue({ id: 'f-1' });

      const result = await service.sendRequest('user-1', 'bob');

      expect(friendships.create).toHaveBeenCalledWith({ requesterId: 'user-1', receiverId: 'user-2' });
      expect(notifications.create).toHaveBeenCalledWith('user-2', NotificationType.FRIEND_REQUEST, {
        requestId: 'f-1',
        fromId: 'user-1',
        fromNickname: 'alice',
        fromAvatarUrl: 'a.png',
      });
      expect(game.emitToUser).toHaveBeenCalledWith('user-2', 'friend_request_received', expect.any(Object));
      expect(activity.log).toHaveBeenCalledWith('user-1', UserAction.FRIEND_REQUEST_SENT, { toUserId: 'user-2', toNickname: 'bob' });
      expect(result).toEqual({ id: 'f-1' });
    });

    it('handles a null avatarUrl on the requester', async () => {
      users.findOne
        .mockResolvedValueOnce({ id: 'user-2', nickname: 'bob' })
        .mockResolvedValueOnce({ id: 'user-1', nickname: 'alice', avatarUrl: null });
      friendships.createQueryBuilder().getOne.mockResolvedValueOnce(null);
      friendships.create.mockReturnValue({ id: 'f-1' });
      friendships.save.mockResolvedValue({ id: 'f-1' });

      await service.sendRequest('user-1', 'bob');

      expect(notifications.create).toHaveBeenCalledWith(
        'user-2',
        NotificationType.FRIEND_REQUEST,
        expect.objectContaining({ fromAvatarUrl: null }),
      );
    });
  });

  describe('respondRequest', () => {
    it('throws ForbiddenException when friendship does not exist', async () => {
      friendships.findOne.mockResolvedValue(null);
      await expect(service.respondRequest('user-2', 'f-1', true)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when the current user is not the receiver', async () => {
      friendships.findOne.mockResolvedValue({ id: 'f-1', receiverId: 'someone-else' });
      await expect(service.respondRequest('user-2', 'f-1', true)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('removes the friendship and logs rejection when declined', async () => {
      const f = { id: 'f-1', receiverId: 'user-2', requesterId: 'user-1' };
      friendships.findOne.mockResolvedValue(f);
      friendships.remove.mockResolvedValue(f);

      const result = await service.respondRequest('user-2', 'f-1', false);

      expect(activity.log).toHaveBeenCalledWith('user-2', UserAction.FRIEND_REQUEST_REJECTED, { fromUserId: 'user-1' });
      expect(friendships.remove).toHaveBeenCalledWith(f);
      expect(result).toBe(f);
    });

    it('accepts the request, notifies requester, emits socket event and logs activity', async () => {
      const f = {
        id: 'f-1',
        receiverId: 'user-2',
        requesterId: 'user-1',
        status: FriendshipStatus.PENDING,
        receiver: { nickname: 'bob', avatarUrl: 'b.png' },
      };
      friendships.findOne.mockResolvedValue(f);
      friendships.save.mockResolvedValue(f);

      const result = await service.respondRequest('user-2', 'f-1', true);

      expect(f.status).toBe(FriendshipStatus.ACCEPTED);
      expect(friendships.save).toHaveBeenCalledWith(f);
      expect(notifications.create).toHaveBeenCalledWith('user-1', NotificationType.FRIEND_ACCEPTED, {
        fromId: 'user-2',
        fromNickname: 'bob',
        fromAvatarUrl: 'b.png',
      });
      expect(game.emitToUser).toHaveBeenCalledWith('user-1', 'friend_request_accepted', expect.any(Object));
      expect(activity.log).toHaveBeenCalledWith('user-2', UserAction.FRIEND_REQUEST_ACCEPTED, { fromUserId: 'user-1' });
      expect(result).toBe(f);
    });
  });

  describe('removeFriend', () => {
    it('deletes the accepted friendship between the two users and logs it', async () => {
      const result = await service.removeFriend('user-1', 'user-2');
      expect(friendships.createQueryBuilder().delete).toHaveBeenCalled();
      expect(friendships.createQueryBuilder().execute).toHaveBeenCalled();
      expect(activity.log).toHaveBeenCalledWith('user-1', UserAction.FRIEND_REMOVED, { friendId: 'user-2' });
      expect(result).toEqual({ status: 'removed' });
    });
  });

  describe('getFriends', () => {
    it('maps friendships to the other user in the relationship', async () => {
      const other = { id: 'user-2', nickname: 'bob' };
      const me = { id: 'user-1', nickname: 'alice' };
      friendships.find.mockResolvedValue([
        { requesterId: 'user-1', receiverId: 'user-2', requester: me, receiver: other },
        { requesterId: 'user-3', receiverId: 'user-1', requester: { id: 'user-3' }, receiver: me },
      ]);

      const result = await service.getFriends('user-1');

      expect(result).toEqual([other, { id: 'user-3' }]);
    });

    it('returns an empty array when there are no accepted friendships', async () => {
      friendships.find.mockResolvedValue([]);
      const result = await service.getFriends('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getPendingRequests', () => {
    it('returns pending requests addressed to the user', async () => {
      friendships.find.mockResolvedValue([{ id: 'req-1' }]);
      const result = await service.getPendingRequests('user-1');
      expect(friendships.find).toHaveBeenCalledWith({
        where: { receiverId: 'user-1', status: FriendshipStatus.PENDING },
        relations: ['requester'],
      });
      expect(result).toEqual([{ id: 'req-1' }]);
    });
  });
});
