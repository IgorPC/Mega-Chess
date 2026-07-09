import {
  BadRequestException, ConflictException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchReportsService } from './match-reports.service';
import { MatchReport, ReportVerdict, ReportStatus } from '../entities/match-report.entity';
import { MatchReportAppeal, AppealStatus } from '../entities/match-report-appeal.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { Notification } from '../entities/notification.entity';
import { DeepseekService } from '../deepseek/deepseek.service';
import { UserActivityService } from '../user-activity/user-activity.service';

describe('MatchReportsService', () => {
  let service: MatchReportsService;
  let reportsRepo: jest.Mocked<Repository<MatchReport>>;
  let appealsRepo: jest.Mocked<Repository<MatchReportAppeal>>;
  let matchesRepo: jest.Mocked<Repository<Match>>;
  let usersRepo: jest.Mocked<Repository<User>>;
  let notificationsRepo: jest.Mocked<Repository<Notification>>;
  let deepseek: jest.Mocked<DeepseekService>;
  let activity: jest.Mocked<UserActivityService>;

  const finishedMatch = (overrides: Partial<Match> = {}): Match => ({
    id: 'match-1',
    status: MatchStatus.FINISHED,
    isOffline: false,
    whitePlayerId: 'reporter-1',
    blackPlayerId: 'reported-1',
    finishedAt: new Date(),
    moves: [],
    pgn: '1. e4 e5',
    result: 'WHITE_WINS',
    ...overrides,
  } as any);

  beforeEach(async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };

    const module = await Test.createTestingModule({
      providers: [
        MatchReportsService,
        {
          provide: getRepositoryToken(MatchReport),
          useValue: {
            findOne: jest.fn(), count: jest.fn(), create: jest.fn((v) => v),
            save: jest.fn(), update: jest.fn(), createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(MatchReportAppeal),
          useValue: { findOne: jest.fn(), create: jest.fn((v) => v), save: jest.fn() },
        },
        { provide: getRepositoryToken(Match), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Notification), useValue: { create: jest.fn((v) => v), save: jest.fn() } },
        { provide: DeepseekService, useValue: { analyze: jest.fn() } },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(MatchReportsService);
    reportsRepo = module.get(getRepositoryToken(MatchReport));
    appealsRepo = module.get(getRepositoryToken(MatchReportAppeal));
    matchesRepo = module.get(getRepositoryToken(Match));
    usersRepo = module.get(getRepositoryToken(User));
    notificationsRepo = module.get(getRepositoryToken(Notification));
    deepseek = module.get(DeepseekService);
    activity = module.get(UserActivityService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('createReport', () => {
    it('throws NotFoundException when the match does not exist', async () => {
      matchesRepo.findOne.mockResolvedValue(null);
      await expect(service.createReport('reporter-1', 'missing', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when the match is not finished yet', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch({ status: MatchStatus.ONGOING }));
      await expect(service.createReport('reporter-1', 'match-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException for an offline match', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch({ isOffline: true }));
      await expect(service.createReport('reporter-1', 'match-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ForbiddenException when the reporter did not play in the match', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch());
      await expect(service.createReport('outsider', 'match-1', {})).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the match is older than 72 hours', async () => {
      const old = new Date(Date.now() - 73 * 60 * 60 * 1000);
      matchesRepo.findOne.mockResolvedValue(finishedMatch({ finishedAt: old }));
      await expect(service.createReport('reporter-1', 'match-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ConflictException when the reporter already reported this match', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch());
      reportsRepo.findOne.mockResolvedValue({ id: 'existing' } as any);
      await expect(service.createReport('reporter-1', 'match-1', {})).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws BadRequestException once the daily report cap is reached', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch());
      reportsRepo.findOne.mockResolvedValue(null);
      const qb = reportsRepo.createQueryBuilder() as any;
      qb.getCount.mockResolvedValue(3);

      await expect(service.createReport('reporter-1', 'match-1', {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the report, logs the activity, and kicks off analysis in the background', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch());
      reportsRepo.findOne
        .mockResolvedValueOnce(null) // duplicate-report check inside createReport
        .mockResolvedValueOnce({ id: 'report-1', reporterId: 'reporter-1', reporterNote: null } as any); // fetched inside runAnalysis
      reportsRepo.save.mockResolvedValue({ id: 'report-1' } as any);
      usersRepo.findOne.mockResolvedValue({ id: 'reported-1', rating: 1200 } as any);
      deepseek.analyze.mockResolvedValue(null);

      const result = await service.createReport('reporter-1', 'match-1', { note: 'usou engine' });

      expect(reportsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        matchId: 'match-1', reporterId: 'reporter-1', reportedUserId: 'reported-1',
        reporterNote: 'usou engine', status: ReportStatus.ANALYZING,
      }));
      expect(activity.log).toHaveBeenCalled();
      expect(result).toEqual({ reportId: 'report-1', status: 'ANALYZING' });

      // Flush the fire-and-forget runAnalysis promise chain.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('identifies the reported user as the white player when the reporter is black', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch({ whitePlayerId: 'white-x', blackPlayerId: 'reporter-1' }));
      reportsRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'r1', reporterId: 'reporter-1' } as any);
      reportsRepo.save.mockResolvedValue({ id: 'report-1' } as any);
      usersRepo.findOne.mockResolvedValue({ id: 'white-x', rating: 1200 } as any);
      deepseek.analyze.mockResolvedValue(null);

      await service.createReport('reporter-1', 'match-1', {});

      expect(reportsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ reportedUserId: 'white-x' }));
    });

    it('logs (without throwing) when the background analysis rejects', async () => {
      matchesRepo.findOne.mockResolvedValue(finishedMatch());
      reportsRepo.findOne.mockResolvedValueOnce(null);
      reportsRepo.save.mockResolvedValue({ id: 'report-1' } as any);
      usersRepo.findOne.mockRejectedValue(new Error('db down'));

      await expect(service.createReport('reporter-1', 'match-1', {})).resolves.toEqual({ reportId: 'report-1', status: 'ANALYZING' });
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  describe('getReport', () => {
    it('returns the reporter own report for the match', async () => {
      reportsRepo.findOne.mockResolvedValue({ id: 'r1' } as any);
      const result = await service.getReport('reporter-1', 'match-1');
      expect(reportsRepo.findOne).toHaveBeenCalledWith({ where: { matchId: 'match-1', reporterId: 'reporter-1' } });
      expect(result).toEqual({ id: 'r1' });
    });

    it('throws NotFoundException when there is no report from this user', async () => {
      reportsRepo.findOne.mockResolvedValue(null);
      await expect(service.getReport('reporter-1', 'match-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createAppeal', () => {
    it('throws NotFoundException when there is no report to appeal', async () => {
      reportsRepo.findOne.mockResolvedValue(null);
      await expect(service.createAppeal('reporter-1', 'match-1', { note: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when the verdict is not CLEAN', async () => {
      reportsRepo.findOne.mockResolvedValue({ id: 'r1', aiVerdict: ReportVerdict.CHEATING, updatedAt: new Date() } as any);
      await expect(service.createAppeal('reporter-1', 'match-1', { note: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException once the 48h appeal window has expired', async () => {
      const old = new Date(Date.now() - 49 * 60 * 60 * 1000);
      reportsRepo.findOne.mockResolvedValue({ id: 'r1', aiVerdict: ReportVerdict.CLEAN, updatedAt: old } as any);
      await expect(service.createAppeal('reporter-1', 'match-1', { note: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws ConflictException when an appeal already exists for this report', async () => {
      reportsRepo.findOne.mockResolvedValue({ id: 'r1', aiVerdict: ReportVerdict.CLEAN, updatedAt: new Date() } as any);
      appealsRepo.findOne.mockResolvedValue({ id: 'appeal-1' } as any);
      await expect(service.createAppeal('reporter-1', 'match-1', { note: 'x' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates the appeal, moves the report to UNDER_REVIEW, and logs the activity', async () => {
      reportsRepo.findOne.mockResolvedValue({ id: 'r1', aiVerdict: ReportVerdict.CLEAN, updatedAt: new Date() } as any);
      appealsRepo.findOne.mockResolvedValue(null);
      appealsRepo.save.mockResolvedValue({ id: 'appeal-1' } as any);

      const result = await service.createAppeal('reporter-1', 'match-1', { note: 'please review' });

      expect(appealsRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        reportId: 'r1', userId: 'reporter-1', note: 'please review', status: AppealStatus.PENDING,
      }));
      expect(reportsRepo.update).toHaveBeenCalledWith('r1', { status: ReportStatus.UNDER_REVIEW });
      expect(activity.log).toHaveBeenCalled();
      expect(result).toEqual({ id: 'appeal-1' });
    });
  });

  describe('runAnalysis (exercised via createReport)', () => {
    async function triggerAnalysis(overrides: {
      analyzeResult?: any; reportedUser?: any; reportFetched?: any; moves?: any[];
    } = {}) {
      matchesRepo.findOne.mockResolvedValue(finishedMatch({ moves: overrides.moves ?? [] }));
      reportsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(overrides.reportFetched ?? { id: 'report-1', reporterId: 'reporter-1', reporterNote: null });
      reportsRepo.save.mockResolvedValue({ id: 'report-1' } as any);
      usersRepo.findOne.mockResolvedValue(overrides.reportedUser === undefined
        ? { id: 'reported-1', rating: 1200 }
        : overrides.reportedUser);
      deepseek.analyze.mockResolvedValue(overrides.analyzeResult ?? null);

      await service.createReport('reporter-1', 'match-1', {});
      // flush the fire-and-forget analysis chain
      for (let i = 0; i < 6; i++) await Promise.resolve();
    }

    it('marks the report for manual review when the reported user cannot be found', async () => {
      await triggerAnalysis({ reportedUser: null });
      expect(reportsRepo.update).not.toHaveBeenCalledWith('report-1', expect.objectContaining({ aiVerdict: expect.anything() }));
    });

    it('marks the report for manual review when DeepSeek is unavailable', async () => {
      await triggerAnalysis({ analyzeResult: null });
      expect(reportsRepo.update).toHaveBeenCalledWith('report-1', expect.objectContaining({
        status: ReportStatus.UNDER_REVIEW,
        aiExplanation: expect.stringContaining('indisponível'),
      }));
    });

    it('marks COMPLETED and notifies the reporter for a low-confidence CLEAN verdict', async () => {
      await triggerAnalysis({
        analyzeResult: { verdict: 'CLEAN', confidence: 0.5, flags: [], explanation_pt: 'Tudo certo' },
      });

      expect(reportsRepo.update).toHaveBeenCalledWith('report-1', expect.objectContaining({
        aiVerdict: 'CLEAN', status: ReportStatus.COMPLETED,
      }));
      expect(notificationsRepo.save).toHaveBeenCalled();
    });

    it('flags UNDER_REVIEW for a CHEATING verdict regardless of confidence', async () => {
      await triggerAnalysis({
        analyzeResult: { verdict: 'CHEATING', confidence: 0.5, flags: ['fast_moves'], explanation_pt: 'Suspeito' },
      });

      expect(reportsRepo.update).toHaveBeenCalledWith('report-1', expect.objectContaining({
        aiVerdict: 'CHEATING', status: ReportStatus.UNDER_REVIEW,
      }));
    });

    it('flags UNDER_REVIEW for a high-confidence SUSPICIOUS verdict', async () => {
      await triggerAnalysis({
        analyzeResult: { verdict: 'SUSPICIOUS', confidence: 0.85, flags: [], explanation_pt: 'Alta confiança' },
      });

      expect(reportsRepo.update).toHaveBeenCalledWith('report-1', expect.objectContaining({
        status: ReportStatus.UNDER_REVIEW,
      }));
    });

    it('marks COMPLETED for a low-confidence SUSPICIOUS verdict', async () => {
      await triggerAnalysis({
        analyzeResult: { verdict: 'SUSPICIOUS', confidence: 0.3, flags: [], explanation_pt: 'Baixa confiança' },
      });

      expect(reportsRepo.update).toHaveBeenCalledWith('report-1', expect.objectContaining({
        status: ReportStatus.COMPLETED,
      }));
    });

    it('computes move-timing stats when the match has recorded move timestamps', async () => {
      await triggerAnalysis({
        moves: [{ elapsed_ms: 500 }, { elapsed_ms: 3000 }, { elapsed_ms: 'not-a-number' }],
        analyzeResult: { verdict: 'CLEAN', confidence: 0.1, flags: [], explanation_pt: 'ok' },
      });

      expect(deepseek.analyze).toHaveBeenCalled();
    });
  });
});
