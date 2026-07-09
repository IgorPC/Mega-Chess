import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminReportsRepository } from './admin-reports.repository';
import { MatchReport } from '../../entities/match-report.entity';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { Review } from '../../entities/review.entity';
import { User } from '../../entities/user.entity';

describe('AdminReportsRepository', () => {
  let repository: AdminReportsRepository;
  let reportsRepo: jest.Mocked<Repository<MatchReport>>;
  let ticketsRepo: jest.Mocked<Repository<SupportTicket>>;
  let usersRepo: jest.Mocked<Repository<User>>;
  let reviewsRepo: jest.Mocked<Repository<Review>>;
  let qb: any;

  beforeEach(async () => {
    qb = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getRawOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminReportsRepository,
        {
          provide: getRepositoryToken(MatchReport),
          useValue: {
            createQueryBuilder: jest.fn(() => qb),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { update: jest.fn() },
        },
        {
          provide: getRepositoryToken(Review),
          useValue: {
            findOne: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
          },
        },
      ],
    }).compile();

    repository = module.get(AdminReportsRepository);
    reportsRepo = module.get(getRepositoryToken(MatchReport));
    ticketsRepo = module.get(getRepositoryToken(SupportTicket));
    usersRepo = module.get(getRepositoryToken(User));
    reviewsRepo = module.get(getRepositoryToken(Review));
  });

  describe('findPage', () => {
    it('applies all optional filters when provided', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);
      await repository.findPage({
        page: 1,
        limit: 10,
        status: 'PENDING',
        verdict: 'CLEAN',
        reportedId: 'user-1',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('r.status = :status', { status: 'PENDING' });
      expect(qb.andWhere).toHaveBeenCalledWith('r.aiVerdict = :verdict', { verdict: 'CLEAN' });
      expect(qb.andWhere).toHaveBeenCalledWith('r.reportedUserId = :reportedId', { reportedId: 'user-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('r.createdAt >= :from', { from: new Date('2026-01-01') });
      expect(qb.andWhere).toHaveBeenCalledWith('r.createdAt <= :to', { to: new Date('2026-01-31') });
    });

    it('returns data and total with no filters', async () => {
      qb.getManyAndCount.mockResolvedValue([[{ id: '1' }], 1]);
      const result = await repository.findPage({ page: 1, limit: 25 });
      expect(result).toEqual({ data: [{ id: '1' }], total: 1 });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns null when not found', async () => {
      reportsRepo.findOne.mockResolvedValue(null);
      const result = await repository.findById('missing');
      expect(result).toBeNull();
    });

    it('loads relations', async () => {
      reportsRepo.findOne.mockResolvedValue({ id: '1' } as any);
      await repository.findById('1');
      expect(reportsRepo.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['reporter', 'reportedUser', 'match', 'appeal'],
      });
    });
  });

  describe('findByIdWithMatch', () => {
    it('loads only the match relation', async () => {
      reportsRepo.findOne.mockResolvedValue(null);
      await repository.findByIdWithMatch('1');
      expect(reportsRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' }, relations: ['match'] });
    });
  });

  describe('findRecentByReportedUser / countByReportedUser / findRecentTicketsByUser', () => {
    it('queries recent reports for a user', async () => {
      reportsRepo.find.mockResolvedValue([]);
      const result = await repository.findRecentByReportedUser('user-1');
      expect(result).toEqual([]);
    });

    it('counts reports for a user', async () => {
      reportsRepo.count.mockResolvedValue(3);
      const result = await repository.countByReportedUser('user-1');
      expect(result).toBe(3);
    });

    it('queries recent tickets for a user', async () => {
      ticketsRepo.find.mockResolvedValue([]);
      const result = await repository.findRecentTicketsByUser('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('updateReport', () => {
    it('delegates to the repository update', async () => {
      reportsRepo.update.mockResolvedValue({} as any);
      await repository.updateReport('1', { aiVerdict: 'CLEAN' as any });
      expect(reportsRepo.update).toHaveBeenCalledWith('1', { aiVerdict: 'CLEAN' });
    });
  });

  describe('findReviewById / deleteReview', () => {
    it('returns null when the review does not exist', async () => {
      reviewsRepo.findOne.mockResolvedValue(null);
      const result = await repository.findReviewById('missing');
      expect(result).toBeNull();
    });

    it('deletes a review by id', async () => {
      reviewsRepo.delete.mockResolvedValue({} as any);
      await repository.deleteReview('1');
      expect(reviewsRepo.delete).toHaveBeenCalledWith('1');
    });
  });

  describe('getReviewStatsForUser', () => {
    it('returns aggregated stats', async () => {
      qb.getRawOne.mockResolvedValue({ avg: '4.5', count: '2' });
      const result = await repository.getReviewStatsForUser('user-1');
      expect(qb.where).toHaveBeenCalledWith('r.reviewedId = :userId', { userId: 'user-1' });
      expect(result).toEqual({ avg: '4.5', count: '2' });
    });
  });

  describe('updateUserReviewStats', () => {
    it('updates the user with new average and count', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      await repository.updateUserReviewStats('user-1', 4.5, 2);
      expect(usersRepo.update).toHaveBeenCalledWith('user-1', { avgRating: 4.5, reviewCount: 2 });
    });

    it('accepts a null average rating', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      await repository.updateUserReviewStats('user-1', null, 0);
      expect(usersRepo.update).toHaveBeenCalledWith('user-1', { avgRating: null, reviewCount: 0 });
    });
  });
});
