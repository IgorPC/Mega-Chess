import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchReportsService } from './match-reports.service';
import { MatchResult } from '../entities/match.entity';

describe('MatchesController', () => {
  let controller: MatchesController;
  let matches: jest.Mocked<MatchesService>;
  let reports: jest.Mocked<MatchReportsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        { provide: MatchesService, useValue: { createOfflineMatch: jest.fn() } },
        { provide: MatchReportsService, useValue: { createReport: jest.fn(), getReport: jest.fn(), createAppeal: jest.fn() } },
      ],
    }).compile();

    controller = module.get(MatchesController);
    matches = module.get(MatchesService);
    reports = module.get(MatchReportsService);
  });

  describe('saveOfflineMatch', () => {
    const user = { id: 'user-1' };

    it('creates an offline match with the given result and difficulty, defaulting pgn/moves', async () => {
      matches.createOfflineMatch.mockResolvedValue({ id: 'm1' } as any);

      const result = await controller.saveOfflineMatch(user, {
        result: MatchResult.WHITE_WINS, difficulty: 'easy',
      } as any);

      expect(matches.createOfflineMatch).toHaveBeenCalledWith('user-1', MatchResult.WHITE_WINS, 'easy', '', []);
      expect(result).toEqual({ id: 'm1' });
    });

    it('forwards a provided pgn and moves list unchanged', async () => {
      matches.createOfflineMatch.mockResolvedValue({ id: 'm1' } as any);

      await controller.saveOfflineMatch(user, {
        result: MatchResult.DRAW, difficulty: 'hard', pgn: '1. e4 e5', moves: [{ san: 'e4' }],
      } as any);

      expect(matches.createOfflineMatch).toHaveBeenCalledWith('user-1', MatchResult.DRAW, 'hard', '1. e4 e5', [{ san: 'e4' }]);
    });

    it('wraps an unexpected error as a 500', async () => {
      matches.createOfflineMatch.mockRejectedValue(new Error('db down'));

      await expect(controller.saveOfflineMatch(user, { result: MatchResult.DRAW, difficulty: 'easy' } as any))
        .rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rethrows a known HttpException unchanged', async () => {
      matches.createOfflineMatch.mockRejectedValue(new NotFoundException('nope'));

      await expect(controller.saveOfflineMatch(user, { result: MatchResult.DRAW, difficulty: 'easy' } as any))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      matches.createOfflineMatch.mockRejectedValue('plain string');

      await expect(controller.saveOfflineMatch(user, { result: MatchResult.DRAW, difficulty: 'easy' } as any))
        .rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('createReport', () => {
    const user = { id: 'user-1' };

    it('delegates to the reports service with the match id and dto', async () => {
      reports.createReport.mockResolvedValue({ reportId: 'r1', status: 'ANALYZING' });

      const result = await controller.createReport(user, 'match-1', { note: 'suspicious' });

      expect(reports.createReport).toHaveBeenCalledWith('user-1', 'match-1', { note: 'suspicious' });
      expect(result).toEqual({ reportId: 'r1', status: 'ANALYZING' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      reports.createReport.mockRejectedValue(new ConflictException('Você já denunciou esta partida'));

      await expect(controller.createReport(user, 'match-1', {})).rejects.toBeInstanceOf(ConflictException);
    });

    it('wraps an unexpected error as a 500', async () => {
      reports.createReport.mockRejectedValue(new Error('boom'));

      await expect(controller.createReport(user, 'match-1', {})).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      reports.createReport.mockRejectedValue('plain string');

      await expect(controller.createReport(user, 'match-1', {})).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getReport', () => {
    const user = { id: 'user-1' };

    it('returns the report for the current user and match', async () => {
      reports.getReport.mockResolvedValue({ id: 'r1' } as any);

      const result = await controller.getReport(user, 'match-1');

      expect(reports.getReport).toHaveBeenCalledWith('user-1', 'match-1');
      expect(result).toEqual({ id: 'r1' });
    });

    it('rethrows NotFoundException unchanged', async () => {
      reports.getReport.mockRejectedValue(new NotFoundException('Denúncia não encontrada'));

      await expect(controller.getReport(user, 'match-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      reports.getReport.mockRejectedValue(new Error('boom'));

      await expect(controller.getReport(user, 'match-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      reports.getReport.mockRejectedValue('plain string');

      await expect(controller.getReport(user, 'match-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('createAppeal', () => {
    const user = { id: 'user-1' };

    it('delegates to the reports service with the match id and appeal dto', async () => {
      reports.createAppeal.mockResolvedValue({ id: 'appeal-1' } as any);

      const result = await controller.createAppeal(user, 'match-1', { note: 'please review' });

      expect(reports.createAppeal).toHaveBeenCalledWith('user-1', 'match-1', { note: 'please review' });
      expect(result).toEqual({ id: 'appeal-1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      reports.createAppeal.mockRejectedValue(new ConflictException('Você já apelou desta denúncia'));

      await expect(controller.createAppeal(user, 'match-1', { note: 'x' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('wraps an unexpected error as a 500', async () => {
      reports.createAppeal.mockRejectedValue(new Error('boom'));

      await expect(controller.createAppeal(user, 'match-1', { note: 'x' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      reports.createAppeal.mockRejectedValue('plain string');

      await expect(controller.createAppeal(user, 'match-1', { note: 'x' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
