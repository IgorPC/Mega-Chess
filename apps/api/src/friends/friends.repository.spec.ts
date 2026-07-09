import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FriendsRepository } from './friends.repository';
import { Friendship, FriendshipStatus } from '../entities/friendship.entity';

describe('FriendsRepository', () => {
  let repository: FriendsRepository;
  let ormRepo: any;
  let qbMock: any;

  beforeEach(async () => {
    qbMock = {
      where: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      getOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        FriendsRepository,
        {
          provide: getRepositoryToken(Friendship),
          useValue: {
            createQueryBuilder: jest.fn(() => qbMock),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get(FriendsRepository);
    ormRepo = module.get(getRepositoryToken(Friendship));
  });

  describe('findExistingBetween', () => {
    it('queries with both user id orderings and returns the match', async () => {
      qbMock.getOne.mockResolvedValue({ id: 'f-1' });
      const result = await repository.findExistingBetween('a', 'b');
      expect(ormRepo.createQueryBuilder).toHaveBeenCalledWith('f');
      expect(qbMock.where).toHaveBeenCalledWith(
        '(f.requesterId = :a AND f.receiverId = :b) OR (f.requesterId = :b AND f.receiverId = :a)',
        { a: 'a', b: 'b' },
      );
      expect(result).toEqual({ id: 'f-1' });
    });

    it('returns null when there is no existing friendship', async () => {
      qbMock.getOne.mockResolvedValue(null);
      const result = await repository.findExistingBetween('a', 'b');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('delegates to repository.create with requester/receiver ids', () => {
      ormRepo.create.mockReturnValue({ id: 'new' });
      const result = repository.create('req-1', 'rec-1');
      expect(ormRepo.create).toHaveBeenCalledWith({ requesterId: 'req-1', receiverId: 'rec-1' });
      expect(result).toEqual({ id: 'new' });
    });
  });

  describe('save', () => {
    it('delegates to repository.save', async () => {
      const friendship = { id: 'f-1' } as Friendship;
      ormRepo.save.mockResolvedValue(friendship);
      const result = await repository.save(friendship);
      expect(ormRepo.save).toHaveBeenCalledWith(friendship);
      expect(result).toBe(friendship);
    });
  });

  describe('remove', () => {
    it('delegates to repository.remove', async () => {
      const friendship = { id: 'f-1' } as Friendship;
      ormRepo.remove.mockResolvedValue(friendship);
      const result = await repository.remove(friendship);
      expect(ormRepo.remove).toHaveBeenCalledWith(friendship);
      expect(result).toBe(friendship);
    });
  });

  describe('findByIdWithUsers', () => {
    it('finds by id including requester/receiver relations', async () => {
      ormRepo.findOne.mockResolvedValue({ id: 'f-1' });
      const result = await repository.findByIdWithUsers('f-1');
      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: 'f-1' }, relations: ['receiver', 'requester'] });
      expect(result).toEqual({ id: 'f-1' });
    });

    it('returns null when not found', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      const result = await repository.findByIdWithUsers('missing');
      expect(result).toBeNull();
    });
  });

  describe('deleteAcceptedBetween', () => {
    it('builds a delete query scoped to accepted status between both users', async () => {
      qbMock.execute.mockResolvedValue({ affected: 1 });
      await repository.deleteAcceptedBetween('a', 'b');
      expect(qbMock.delete).toHaveBeenCalled();
      expect(qbMock.where).toHaveBeenCalledWith(
        '((requester_id = :a AND receiver_id = :b) OR (requester_id = :b AND receiver_id = :a)) AND status = :s',
        { a: 'a', b: 'b', s: FriendshipStatus.ACCEPTED },
      );
      expect(qbMock.execute).toHaveBeenCalled();
    });
  });

  describe('findAcceptedForUser', () => {
    it('finds accepted friendships where user is either requester or receiver', async () => {
      ormRepo.find.mockResolvedValue([{ id: 'f-1' }]);
      const result = await repository.findAcceptedForUser('user-1');
      expect(ormRepo.find).toHaveBeenCalledWith({
        where: [
          { requesterId: 'user-1', status: FriendshipStatus.ACCEPTED },
          { receiverId: 'user-1', status: FriendshipStatus.ACCEPTED },
        ],
        relations: ['requester', 'receiver'],
      });
      expect(result).toEqual([{ id: 'f-1' }]);
    });

    it('returns an empty array when there are none', async () => {
      ormRepo.find.mockResolvedValue([]);
      const result = await repository.findAcceptedForUser('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('findPendingForReceiver', () => {
    it('finds pending requests addressed to the given user', async () => {
      ormRepo.find.mockResolvedValue([{ id: 'req-1' }]);
      const result = await repository.findPendingForReceiver('user-1');
      expect(ormRepo.find).toHaveBeenCalledWith({
        where: { receiverId: 'user-1', status: FriendshipStatus.PENDING },
        relations: ['requester'],
      });
      expect(result).toEqual([{ id: 'req-1' }]);
    });
  });
});
