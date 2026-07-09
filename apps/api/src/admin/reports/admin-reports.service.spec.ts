import { Test } from '@nestjs/testing';
import { AdminReportsService } from './admin-reports.service';
import { AdminReportsRepository } from './admin-reports.repository';
import { AdminAuditService } from '../admin-audit.service';
import { DeepseekService } from '../../deepseek/deepseek.service';

describe('AdminReportsService', () => {
  let service: AdminReportsService;
  let repo: jest.Mocked<AdminReportsRepository>;
  let audit: jest.Mocked<AdminAuditService>;
  let deepseek: jest.Mocked<DeepseekService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminReportsService,
        {
          provide: AdminReportsRepository,
          useValue: {
            findPage: jest.fn(),
            findById: jest.fn(),
            findByIdWithMatch: jest.fn(),
            findRecentByReportedUser: jest.fn(),
            countByReportedUser: jest.fn(),
            findRecentTicketsByUser: jest.fn(),
            updateReport: jest.fn(),
            findReviewById: jest.fn(),
            deleteReview: jest.fn(),
            getReviewStatsForUser: jest.fn(),
            updateUserReviewStats: jest.fn(),
          },
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
        { provide: DeepseekService, useValue: { analyze: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminReportsService);
    repo = module.get(AdminReportsRepository);
    audit = module.get(AdminAuditService);
    deepseek = module.get(DeepseekService);
  });

  describe('list', () => {
    it('applies default pagination', async () => {
      repo.findPage.mockResolvedValue({ data: [], total: 0 });
      const result = await service.list({});
      expect(repo.findPage).toHaveBeenCalledWith({ page: 1, limit: 25 });
      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });

    it('caps the limit at the configured maximum', async () => {
      repo.findPage.mockResolvedValue({ data: [], total: 0 });
      await service.list({ limit: 500 });
      expect(repo.findPage).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    });

    it('computes totalPages from total and limit', async () => {
      repo.findPage.mockResolvedValue({ data: [{ id: '1' } as any], total: 51 });
      const result = await service.list({ page: 2, limit: 25 });
      expect(result.totalPages).toBe(3);
    });
  });

  describe('getOne', () => {
    it('returns null when the report does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      const result = await service.getOne('missing');
      expect(result).toBeNull();
      expect(repo.findRecentByReportedUser).not.toHaveBeenCalled();
    });

    it('enriches the report with history and tickets', async () => {
      repo.findById.mockResolvedValue({ id: '1', reportedUserId: 'user-1' } as any);
      repo.findRecentByReportedUser.mockResolvedValue([{ id: 'h1' }] as any);
      repo.countByReportedUser.mockResolvedValue(2);
      repo.findRecentTicketsByUser.mockResolvedValue([{ id: 't1' }] as any);

      const result = await service.getOne('1');

      expect(result).toEqual({
        id: '1',
        reportedUserId: 'user-1',
        reportHistory: [{ id: 'h1' }],
        reportHistoryCount: 2,
        tickets: [{ id: 't1' }],
      });
    });
  });

  describe('resolve', () => {
    it('throws when the report does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.resolve('missing', { resolution: 'ok' }, { id: 'admin-1', name: 'Admin' }),
      ).rejects.toThrow('Report not found');
      expect(repo.updateReport).not.toHaveBeenCalled();
    });

    it('updates the report and logs an audit entry', async () => {
      repo.findById.mockResolvedValue({ id: '1' } as any);
      repo.updateReport.mockResolvedValue({} as any);

      await service.resolve('1', { resolution: 'BANNED', adminNote: 'note' }, { id: 'admin-1', name: 'Admin' });

      expect(repo.updateReport).toHaveBeenCalledWith('1', expect.objectContaining({
        status: 'RESOLVED',
        resolution: 'BANNED',
        adminNote: 'note',
        resolvedBy: 'admin-1',
      }));
      expect(audit.log).toHaveBeenCalledWith(
        { id: 'admin-1', name: 'Admin' },
        'REPORT_RESOLVED',
        expect.objectContaining({ targetType: 'MatchReport', targetId: '1' }),
      );
    });
  });

  describe('analyzeWithAi', () => {
    it('returns null when the report does not exist', async () => {
      repo.findByIdWithMatch.mockResolvedValue(null);
      const result = await service.analyzeWithAi('missing');
      expect(result).toBeNull();
    });

    it('returns null when the report has no match', async () => {
      repo.findByIdWithMatch.mockResolvedValue({ id: '1', match: null } as any);
      const result = await service.analyzeWithAi('1');
      expect(result).toBeNull();
    });

    it('returns the existing report without calling deepseek when it already has a verdict', async () => {
      repo.findByIdWithMatch.mockResolvedValue({ id: '1', aiVerdict: 'CLEAN', match: {} } as any);
      const result = await service.analyzeWithAi('1');
      expect(deepseek.analyze).not.toHaveBeenCalled();
      expect(result).toEqual({ id: '1', aiVerdict: 'CLEAN', match: {} });
    });

    it('returns the original report when deepseek is unavailable (returns null)', async () => {
      const report = { id: '1', match: { pgn: 'abc', moves: [] } };
      repo.findByIdWithMatch.mockResolvedValue(report as any);
      deepseek.analyze.mockResolvedValue(null);

      const result = await service.analyzeWithAi('1');

      expect(result).toEqual(report);
      expect(repo.updateReport).not.toHaveBeenCalled();
    });

    it('updates the report and escalates to UNDER_REVIEW on high-confidence non-clean verdict', async () => {
      const moves = [{ elapsed_ms: 500 }, { elapsed_ms: 2000 }];
      repo.findByIdWithMatch.mockResolvedValue({ id: '1', match: { pgn: 'abc', moves } } as any);
      deepseek.analyze.mockResolvedValue({
        verdict: 'CHEATING',
        confidence: 0.9,
        flags: ['fast_moves'],
        explanation_pt: 'suspeito',
      });
      repo.updateReport.mockResolvedValue({} as any);
      repo.findById.mockResolvedValue({ id: '1', aiVerdict: 'CHEATING' } as any);

      const result = await service.analyzeWithAi('1');

      expect(repo.updateReport).toHaveBeenCalledWith('1', expect.objectContaining({
        aiVerdict: 'CHEATING',
        aiConfidence: '0.9',
        aiFlags: ['fast_moves'],
        aiExplanation: 'suspeito',
        status: 'UNDER_REVIEW',
      }));
      expect(result).toEqual({ id: '1', aiVerdict: 'CHEATING' });
    });

    it('marks the report COMPLETED for a clean verdict', async () => {
      repo.findByIdWithMatch.mockResolvedValue({ id: '1', match: { pgn: 'abc', moves: [] } } as any);
      deepseek.analyze.mockResolvedValue({
        verdict: 'CLEAN',
        confidence: 0.95,
        flags: [],
        explanation_pt: 'ok',
      });
      repo.updateReport.mockResolvedValue({} as any);
      repo.findById.mockResolvedValue({ id: '1', aiVerdict: 'CLEAN' } as any);

      await service.analyzeWithAi('1');

      expect(repo.updateReport).toHaveBeenCalledWith('1', expect.objectContaining({ status: 'COMPLETED' }));
    });

    it('handles a match with no moves array (avgMs and fastPct default to 0)', async () => {
      repo.findByIdWithMatch.mockResolvedValue({ id: '1', match: { pgn: 'abc' } } as any);
      deepseek.analyze.mockResolvedValue(null);

      await service.analyzeWithAi('1');

      expect(deepseek.analyze).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.stringContaining('"avgMoveMs":0'),
        '1',
        expect.any(Number),
      );
    });
  });

  describe('deleteReview', () => {
    it('throws when the review does not exist', async () => {
      repo.findReviewById.mockResolvedValue(null);
      await expect(service.deleteReview('missing', { id: 'admin-1', name: 'Admin' })).rejects.toThrow(
        'Review not found',
      );
      expect(repo.deleteReview).not.toHaveBeenCalled();
    });

    it('deletes the review, recalculates stats, and logs an audit entry', async () => {
      repo.findReviewById.mockResolvedValue({ id: 'rev-1', reviewedId: 'user-1' } as any);
      repo.deleteReview.mockResolvedValue({} as any);
      repo.getReviewStatsForUser.mockResolvedValue({ avg: '4.2', count: '5' });
      repo.updateUserReviewStats.mockResolvedValue({} as any);

      await service.deleteReview('rev-1', { id: 'admin-1', name: 'Admin' });

      expect(repo.deleteReview).toHaveBeenCalledWith('rev-1');
      expect(repo.updateUserReviewStats).toHaveBeenCalledWith('user-1', 4.2, 5);
      expect(audit.log).toHaveBeenCalledWith(
        { id: 'admin-1', name: 'Admin' },
        'REVIEW_DELETED',
        { targetType: 'Review', targetId: 'rev-1' },
      );
    });

    it('handles missing review stats gracefully (null avg, 0 count)', async () => {
      repo.findReviewById.mockResolvedValue({ id: 'rev-1', reviewedId: 'user-1' } as any);
      repo.deleteReview.mockResolvedValue({} as any);
      repo.getReviewStatsForUser.mockResolvedValue(undefined);
      repo.updateUserReviewStats.mockResolvedValue({} as any);

      await service.deleteReview('rev-1', { id: 'admin-1', name: 'Admin' });

      expect(repo.updateUserReviewStats).toHaveBeenCalledWith('user-1', null, 0);
    });
  });
});
