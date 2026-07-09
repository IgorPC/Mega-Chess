import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException, ConflictException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SuggestionsService } from './suggestions.service';
import { ImprovementSuggestion, SuggestionStatus } from '../entities/improvement-suggestion.entity';
import { SuggestionVote } from '../entities/suggestion-vote.entity';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  let suggestions: jest.Mocked<any>;
  let votes: jest.Mocked<any>;
  let redis: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        {
          provide: getRepositoryToken(ImprovementSuggestion),
          useValue: {
            findAndCount: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((x) => x),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SuggestionVote),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SuggestionsService);
    suggestions = module.get(getRepositoryToken(ImprovementSuggestion));
    votes = module.get(getRepositoryToken(SuggestionVote));
    redis = module.get(REDIS_CLIENT);
    dataSource = module.get(DataSource);
  });

  describe('list', () => {
    it('returns items with vote info and remaining weekly votes', async () => {
      suggestions.findAndCount.mockResolvedValue([
        [{ id: 's1', author: { nickname: 'Bob' } }],
        1,
      ]);
      votes.find.mockResolvedValue([{ suggestionId: 's1' }]);
      redis.get.mockResolvedValue('2');

      const result = await service.list('user-1', 1, 20);

      expect(result.items[0].myVote).toBe(true);
      expect(result.items[0].authorNickname).toBe('Bob');
      expect(result.votesRemaining).toBe(8);
      expect(result.total).toBe(1);
    });

    it('falls back to OPEN status when a non-listable status is requested', async () => {
      suggestions.findAndCount.mockResolvedValue([[], 0]);
      redis.get.mockResolvedValue(null);
      await service.list('user-1', 1, 20, SuggestionStatus.HIDDEN);
      expect(suggestions.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: SuggestionStatus.OPEN } }),
      );
    });

    it('allows COMPLETED status explicitly', async () => {
      suggestions.findAndCount.mockResolvedValue([[], 0]);
      redis.get.mockResolvedValue(null);
      await service.list('user-1', 1, 20, SuggestionStatus.COMPLETED);
      expect(suggestions.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: SuggestionStatus.COMPLETED } }),
      );
    });

    it('skips vote lookup when there are no items', async () => {
      suggestions.findAndCount.mockResolvedValue([[], 0]);
      redis.get.mockResolvedValue(null);
      await service.list('user-1');
      expect(votes.find).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('throws NotFoundException when missing', async () => {
      suggestions.findOne.mockResolvedValue(null);
      await expect(service.getOne('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when suggestion is hidden', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', status: SuggestionStatus.HIDDEN });
      await expect(service.getOne('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('returns suggestion with myVote flag', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', status: SuggestionStatus.OPEN, author: { nickname: 'Ana' } });
      votes.findOne.mockResolvedValue({ id: 'v1' });
      const result = await service.getOne('u1', 's1');
      expect(result.myVote).toBe(true);
      expect(result.authorNickname).toBe('Ana');
    });
  });

  describe('create', () => {
    it('creates a suggestion when under the weekly limit', async () => {
      redis.get.mockResolvedValue('1');
      suggestions.save.mockResolvedValue({ id: 'new-id' });

      const result = await service.create('u1', { title: ' T ', description: ' D ' } as any);

      expect(suggestions.save).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
      expect(result).toEqual({ id: 'new-id' });
    });

    it('throws BadRequestException when weekly suggestion limit reached', async () => {
      redis.get.mockResolvedValue('3');
      await expect(service.create('u1', { title: 'a', description: 'b' } as any))
        .rejects.toThrow(BadRequestException);
      expect(suggestions.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when suggestion does not exist', async () => {
      suggestions.findOne.mockResolvedValue(null);
      await expect(service.update('u1', 's1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the author', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', authorId: 'other', status: SuggestionStatus.OPEN, voteCount: 0 });
      await expect(service.update('u1', 's1', {} as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when suggestion is not OPEN', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', authorId: 'u1', status: SuggestionStatus.COMPLETED, voteCount: 0 });
      await expect(service.update('u1', 's1', {} as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when suggestion already has votes', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', authorId: 'u1', status: SuggestionStatus.OPEN, voteCount: 2 });
      await expect(service.update('u1', 's1', { title: 'x' } as any)).rejects.toThrow(BadRequestException);
    });

    it('updates title and description when valid', async () => {
      const suggestion = { id: 's1', authorId: 'u1', status: SuggestionStatus.OPEN, voteCount: 0, title: 'old', description: 'old' };
      suggestions.findOne.mockResolvedValue(suggestion);
      suggestions.save.mockImplementation((s) => s);

      const result = await service.update('u1', 's1', { title: 'new', description: 'newd' } as any);

      expect(result.title).toBe('new');
      expect(result.description).toBe('newd');
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when missing', async () => {
      suggestions.findOne.mockResolvedValue(null);
      await expect(service.delete('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not the author', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', authorId: 'other', status: SuggestionStatus.OPEN, voteCount: 0 });
      await expect(service.delete('u1', 's1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when not OPEN', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', authorId: 'u1', status: SuggestionStatus.REJECTED, voteCount: 0 });
      await expect(service.delete('u1', 's1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when suggestion has votes', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', authorId: 'u1', status: SuggestionStatus.OPEN, voteCount: 1 });
      await expect(service.delete('u1', 's1')).rejects.toThrow(BadRequestException);
    });

    it('removes the suggestion when valid', async () => {
      const suggestion = { id: 's1', authorId: 'u1', status: SuggestionStatus.OPEN, voteCount: 0 };
      suggestions.findOne.mockResolvedValue(suggestion);
      await service.delete('u1', 's1');
      expect(suggestions.remove).toHaveBeenCalledWith(suggestion);
    });
  });

  describe('vote', () => {
    const em = { save: jest.fn(), increment: jest.fn(), create: jest.fn((_e, x) => x) };
    beforeEach(() => {
      dataSource.transaction.mockImplementation(async (cb: any) => cb(em));
    });

    it('throws NotFoundException when suggestion missing', async () => {
      suggestions.findOne.mockResolvedValue(null);
      await expect(service.vote('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when suggestion is hidden', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', status: SuggestionStatus.HIDDEN, authorId: 'other' });
      await expect(service.vote('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when voting on own suggestion', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', status: SuggestionStatus.OPEN, authorId: 'u1' });
      await expect(service.vote('u1', 's1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when weekly vote limit reached', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', status: SuggestionStatus.OPEN, authorId: 'other' });
      redis.get.mockResolvedValue('10');
      await expect(service.vote('u1', 's1')).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when already voted', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', status: SuggestionStatus.OPEN, authorId: 'other' });
      redis.get.mockResolvedValue('1');
      votes.findOne.mockResolvedValue({ id: 'existing-vote' });
      await expect(service.vote('u1', 's1')).rejects.toThrow(ConflictException);
    });

    it('registers the vote and updates redis counter', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1', status: SuggestionStatus.OPEN, authorId: 'other' });
      redis.get.mockResolvedValue('1');
      votes.findOne.mockResolvedValue(null);

      await service.vote('u1', 's1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(expect.stringContaining('suggestion_votes:u1'), '2', 'EX', expect.any(Number));
    });
  });

  describe('unvote', () => {
    const em = { remove: jest.fn(), decrement: jest.fn() };
    beforeEach(() => {
      dataSource.transaction.mockImplementation(async (cb: any) => cb(em));
    });

    it('throws NotFoundException when suggestion missing', async () => {
      suggestions.findOne.mockResolvedValue(null);
      await expect(service.unvote('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when vote does not exist', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1' });
      votes.findOne.mockResolvedValue(null);
      await expect(service.unvote('u1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('removes the vote and decrements weekly counter', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1' });
      votes.findOne.mockResolvedValue({ id: 'v1' });
      redis.get.mockResolvedValue('2');

      await service.unvote('u1', 's1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith(expect.stringContaining('suggestion_votes:u1'), '1', 'EX', expect.any(Number));
    });

    it('does not decrement below zero', async () => {
      suggestions.findOne.mockResolvedValue({ id: 's1' });
      votes.findOne.mockResolvedValue({ id: 'v1' });
      redis.get.mockResolvedValue('0');

      await service.unvote('u1', 's1');

      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('adminList', () => {
    it('applies filters and returns paged results', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 's1', author: { nickname: 'Zed' } }], 1]),
      };
      suggestions.createQueryBuilder.mockReturnValue(qb);

      const result = await service.adminList({
        page: 2, limit: 10, status: 'OPEN', dateFrom: '2026-01-01', dateTo: '2026-02-01', authorId: 'u1',
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(4);
      expect(result.items[0].authorNickname).toBe('Zed');
      expect(result.page).toBe(2);
    });

    it('works with no filters provided', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      suggestions.createQueryBuilder.mockReturnValue(qb);

      const result = await service.adminList({});
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result.total).toBe(0);
    });
  });

  describe('adminUpdate', () => {
    it('throws NotFoundException when suggestion missing', async () => {
      suggestions.findOne.mockResolvedValue(null);
      await expect(service.adminUpdate('s1', SuggestionStatus.COMPLETED)).rejects.toThrow(NotFoundException);
    });

    it('updates status and admin note', async () => {
      const suggestion = { id: 's1', status: SuggestionStatus.OPEN, adminNote: undefined };
      suggestions.findOne.mockResolvedValue(suggestion);
      suggestions.save.mockImplementation((s: any) => s);

      const result = await service.adminUpdate('s1', SuggestionStatus.COMPLETED, 'done');

      expect(result.status).toBe(SuggestionStatus.COMPLETED);
      expect(result.adminNote).toBe('done');
    });
  });
});
