import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Review } from '../entities/review.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';

const REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviews: any;
  let matches: any;
  let users: any;
  let qbMock: any;

  beforeEach(async () => {
    qbMock = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      getMany: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => qbMock),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Match),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { update: jest.fn(), findOne: jest.fn(), findByIds: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReviewsService);
    reviews = module.get(getRepositoryToken(Review));
    matches = module.get(getRepositoryToken(Match));
    users = module.get(getRepositoryToken(User));
  });

  const baseDto: CreateReviewDto = { matchId: 'match-1', reviewedId: 'user-2', rating: 5, comment: 'nice' };

  describe('create', () => {
    it('throws BadRequestException when the match does not exist', async () => {
      matches.findOne.mockResolvedValue(null);
      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the match is not finished', async () => {
      matches.findOne.mockResolvedValue({ id: 'match-1', status: MatchStatus.ONGOING });
      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when the reviewer did not play in the match', async () => {
      matches.findOne.mockResolvedValue({
        id: 'match-1', status: MatchStatus.FINISHED,
        whitePlayerId: 'user-3', blackPlayerId: 'user-4',
      });
      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when trying to review yourself', async () => {
      matches.findOne.mockResolvedValue({
        id: 'match-1', status: MatchStatus.FINISHED,
        whitePlayerId: 'user-1', blackPlayerId: 'user-2',
      });
      await expect(
        service.create('user-1', { ...baseDto, reviewedId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when the reviewed player was not in the match', async () => {
      matches.findOne.mockResolvedValue({
        id: 'match-1', status: MatchStatus.FINISHED,
        whitePlayerId: 'user-1', blackPlayerId: 'user-2',
      });
      await expect(
        service.create('user-1', { ...baseDto, reviewedId: 'user-99' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the 48h review window has passed', async () => {
      matches.findOne.mockResolvedValue({
        id: 'match-1', status: MatchStatus.FINISHED,
        whitePlayerId: 'user-1', blackPlayerId: 'user-2',
        finishedAt: new Date(Date.now() - (REVIEW_WINDOW_MS + 60_000)),
      });
      await expect(service.create('user-1', baseDto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a review submitted within the 48h window and recalculates stats', async () => {
      matches.findOne.mockResolvedValue({
        id: 'match-1', status: MatchStatus.FINISHED,
        whitePlayerId: 'user-1', blackPlayerId: 'user-2',
        finishedAt: new Date(Date.now() - 60_000),
      });
      reviews.create.mockReturnValue({ id: 'r-1', ...baseDto });
      reviews.save.mockResolvedValue({ id: 'r-1', ...baseDto });
      qbMock.getRawOne.mockResolvedValue({ avg: '4.5', count: '2' });

      const result = await service.create('user-1', baseDto);

      expect(reviews.create).toHaveBeenCalledWith({
        reviewerId: 'user-1',
        reviewedId: 'user-2',
        matchId: 'match-1',
        rating: 5,
        comment: 'nice',
      });
      expect(users.update).toHaveBeenCalledWith('user-2', { avgRating: 4.5, reviewCount: 2 });
      expect(result).toEqual({ id: 'r-1', ...baseDto });
    });

    it('allows a review right at match finish with no elapsed-window check needed when finishedAt is falsy', async () => {
      matches.findOne.mockResolvedValue({
        id: 'match-1', status: MatchStatus.FINISHED,
        whitePlayerId: 'user-1', blackPlayerId: 'user-2',
        finishedAt: null,
      });
      reviews.create.mockReturnValue({ id: 'r-2' });
      reviews.save.mockResolvedValue({ id: 'r-2' });
      qbMock.getRawOne.mockResolvedValue({ avg: null, count: '0' });

      const result = await service.create('user-1', baseDto);
      expect(result).toEqual({ id: 'r-2' });
      expect(users.update).toHaveBeenCalledWith('user-2', { avgRating: null, reviewCount: 0 });
    });

    it('rejects a duplicate review attempt for the same match due to unique constraint bubbling up', async () => {
      matches.findOne.mockResolvedValue({
        id: 'match-1', status: MatchStatus.FINISHED,
        whitePlayerId: 'user-1', blackPlayerId: 'user-2',
        finishedAt: new Date(),
      });
      reviews.create.mockReturnValue({ id: 'r-1' });
      reviews.save.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

      await expect(service.create('user-1', baseDto)).rejects.toThrow('duplicate key value violates unique constraint');
    });
  });

  describe('getPending', () => {
    it('returns an empty array when there are no finished matches within the window', async () => {
      matches.find.mockResolvedValue([]);
      const result = await service.getPending('user-1');
      expect(result).toEqual([]);
    });

    it('excludes matches finished outside the 48h window', async () => {
      matches.find.mockResolvedValue([
        { id: 'old-match', whitePlayerId: 'user-1', blackPlayerId: 'user-2', finishedAt: new Date(Date.now() - (REVIEW_WINDOW_MS + 60_000)) },
      ]);
      const result = await service.getPending('user-1');
      expect(result).toEqual([]);
    });

    it('excludes matches already reviewed by the user and returns the opponent for the rest', async () => {
      matches.find.mockResolvedValue([
        { id: 'match-1', whitePlayerId: 'user-1', blackPlayerId: 'user-2', finishedAt: new Date(Date.now() - 60_000) },
        { id: 'match-2', whitePlayerId: 'user-3', blackPlayerId: 'user-1', finishedAt: new Date(Date.now() - 120_000) },
      ]);
      qbMock.getMany.mockResolvedValue([{ matchId: 'match-1' }]);
      users.findByIds.mockResolvedValue([{ id: 'user-3', nickname: 'carol', avatarUrl: 'c.png' }]);

      const result = await service.getPending('user-1');

      expect(result).toEqual([
        { matchId: 'match-2', finishedAt: expect.any(Date), opponent: { id: 'user-3', nickname: 'carol', avatarUrl: 'c.png' } },
      ]);
    });

    it('returns an empty array when all reviewable matches have already been reviewed', async () => {
      matches.find.mockResolvedValue([
        { id: 'match-1', whitePlayerId: 'user-1', blackPlayerId: 'user-2', finishedAt: new Date(Date.now() - 60_000) },
      ]);
      qbMock.getMany.mockResolvedValue([{ matchId: 'match-1' }]);

      const result = await service.getPending('user-1');
      expect(result).toEqual([]);
    });

    it('falls back to a bare id object when the opponent user record is missing', async () => {
      matches.find.mockResolvedValue([
        { id: 'match-1', whitePlayerId: 'user-1', blackPlayerId: 'user-99', finishedAt: new Date(Date.now() - 60_000) },
      ]);
      qbMock.getMany.mockResolvedValue([]);
      users.findByIds.mockResolvedValue([]);

      const result = await service.getPending('user-1');
      expect(result).toEqual([
        { matchId: 'match-1', finishedAt: expect.any(Date), opponent: { id: 'user-99' } },
      ]);
    });
  });

  describe('getForUser', () => {
    it('returns an empty page when the user does not exist', async () => {
      users.findOne.mockResolvedValue(null);
      const result = await service.getForUser('ghost');
      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });

    it('returns a paginated set of reviews for the user, capping the limit at 50', async () => {
      users.findOne.mockResolvedValue({ id: 'user-2' });
      reviews.findAndCount.mockResolvedValue([[{ id: 'r-1' }], 1]);

      const result = await service.getForUser('bob', 2, 200);

      expect(reviews.findAndCount).toHaveBeenCalledWith({
        where: { reviewedId: 'user-2' },
        relations: ['reviewer'],
        order: { createdAt: 'DESC' },
        skip: 50,
        take: 50,
      });
      expect(result).toEqual({ data: [{ id: 'r-1' }], total: 1, page: 2, totalPages: 1 });
    });
  });
});
