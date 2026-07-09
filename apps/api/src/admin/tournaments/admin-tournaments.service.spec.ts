import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminTournamentsService } from './admin-tournaments.service';
import { AdminTournamentsRepository } from './admin-tournaments.repository';
import { AdminAuditService } from '../admin-audit.service';
import { DeepseekService } from '../../deepseek/deepseek.service';
import { TournamentStatus, TournamentType } from '../../entities/tournament.entity';

describe('AdminTournamentsService', () => {
  let service: AdminTournamentsService;
  let repo: jest.Mocked<AdminTournamentsRepository>;
  let audit: jest.Mocked<AdminAuditService>;
  let deepseek: { analyze: jest.Mock };

  const admin = { id: 'admin-1', name: 'Admin' } as any;

  function makeTournament(overrides: any = {}) {
    return {
      id: 't1',
      type: TournamentType.DUEL_FLASH,
      timeControl: '3+2',
      status: TournamentStatus.REGISTERING,
      entryFeeCc: 10,
      prizePoolCc: 18,
      maxPlayers: 2,
      createdAt: new Date('2026-01-01'),
      startedAt: null,
      finishedAt: null,
      championId: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    deepseek = { analyze: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminTournamentsService,
        {
          provide: AdminTournamentsRepository,
          useValue: {
            createListQuery: jest.fn(),
            queryParticipantCounts: jest.fn(),
            findTournamentById: jest.fn(),
            countParticipants: jest.fn(),
            createParticipantsQuery: jest.fn(),
            createMatchesQuery: jest.fn(),
            findTournamentWithParticipants: jest.fn(),
            findWalletByUserId: jest.fn(),
            updateWalletBalance: jest.fn(),
            createTransaction: jest.fn(),
            saveTransaction: jest.fn(),
            updateTournament: jest.fn(),
            findParticipant: jest.fn(),
            deleteParticipant: jest.fn(),
            findTournamentMatchWithMatch: jest.fn(),
            updateTournamentMatch: jest.fn(),
            findDuels: jest.fn(),
            queryChampionNicknames: jest.fn(),
          },
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
        { provide: DeepseekService, useValue: deepseek },
      ],
    }).compile();

    service = module.get(AdminTournamentsService);
    repo = module.get(AdminTournamentsRepository);
    audit = module.get(AdminAuditService);
  });

  describe('list', () => {
    it('returns paginated tournaments with participant counts', async () => {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[makeTournament()], 1]),
      };
      repo.createListQuery.mockReturnValue(qb);
      repo.queryParticipantCounts.mockResolvedValue([{ tournament_id: 't1', cnt: '2' }] as any);

      const result = await service.list({ page: 1, limit: 20 });
      expect(result.total).toBe(1);
      expect(result.data[0].registeredCount).toBe(2);
    });

    it('maps status filter through status map and applies where', async () => {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repo.createListQuery.mockReturnValue(qb);

      await service.list({ status: 'OPEN,COMPLETED' });
      expect(qb.where).toHaveBeenCalledWith('t.status IN (:...statuses)', { statuses: ['REGISTERING', 'FINISHED'] });
    });

    it('skips participant count query when there are no rows', async () => {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repo.createListQuery.mockReturnValue(qb);

      await service.list({});
      expect(repo.queryParticipantCounts).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('throws NotFoundException when tournament missing', async () => {
      repo.findTournamentById.mockResolvedValue(null);
      await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('serializes tournament with participant count', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament() as any);
      repo.countParticipants.mockResolvedValue(1);
      const result = await service.get('t1');
      expect(result.registeredCount).toBe(1);
      expect(result.status).toBe('OPEN');
    });

    it('passes through IN_PROGRESS/CANCELLED statuses unmapped', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament({ status: TournamentStatus.IN_PROGRESS }) as any);
      repo.countParticipants.mockResolvedValue(1);
      const result = await service.get('t1');
      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  describe('participants', () => {
    it('maps participant rows with position and elimination flags', async () => {
      const qb: any = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ userId: 'u1', status: 'CHAMPION' }, { userId: 'u2', status: 'ELIMINATED' }],
          raw: [{ u_nickname: 'n1', u_avatar_url: null }, { u_nickname: 'n2', u_avatar_url: 'a.png' }],
        }),
      };
      repo.createParticipantsQuery.mockReturnValue(qb);

      const result = await service.participants('t1');
      expect(result[0]).toEqual({ userId: 'u1', nickname: 'n1', avatarUrl: null, seed: 1, finalPosition: 1, eliminated: false });
      expect(result[1].eliminated).toBe(true);
      expect(result[1].finalPosition).toBeNull();
    });
  });

  describe('matches', () => {
    it('maps match rows with winner nickname resolved from result', async () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ id: 'tm1', phase: 'FINAL' }],
          raw: [{ m_result: 'WHITE_WINS', w_nickname: 'white', b_nickname: 'black', m_status: 'FINISHED' }],
        }),
      };
      repo.createMatchesQuery.mockReturnValue(qb);

      const result = await service.matches('t1');
      expect(result[0].winnerNickname).toBe('white');
    });

    it('defaults status to PENDING and winner to null when no result', async () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ id: 'tm1', phase: 'R1' }],
          raw: [{}],
        }),
      };
      repo.createMatchesQuery.mockReturnValue(qb);

      const result = await service.matches('t1');
      expect(result[0].status).toBe('PENDING');
      expect(result[0].winnerNickname).toBeNull();
    });
  });

  describe('start', () => {
    it('throws NotFoundException when tournament missing', async () => {
      repo.findTournamentById.mockResolvedValue(null);
      await expect(service.start('t1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when status is not REGISTERING', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament({ status: TournamentStatus.IN_PROGRESS }) as any);
      await expect(service.start('t1', admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('starts tournament and logs audit', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament() as any);
      await service.start('t1', admin);
      expect(repo.updateTournament).toHaveBeenCalledWith('t1', expect.objectContaining({ status: TournamentStatus.IN_PROGRESS }));
      expect(audit.log).toHaveBeenCalledWith(admin, 'TOURNAMENT_STARTED', expect.objectContaining({ targetId: 't1' }));
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when tournament missing', async () => {
      repo.findTournamentWithParticipants.mockResolvedValue(null);
      await expect(service.cancel('t1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when already finished', async () => {
      repo.findTournamentWithParticipants.mockResolvedValue(makeTournament({ status: TournamentStatus.FINISHED }) as any);
      await expect(service.cancel('t1', admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refunds entry fees for participants who paid and cancels', async () => {
      repo.findTournamentWithParticipants.mockResolvedValue(makeTournament({
        participants: [{ userId: 'u1', hasEntryDebited: true }, { userId: 'u2', hasEntryDebited: false }],
      }) as any);
      repo.findWalletByUserId.mockResolvedValue({ userId: 'u1', balance: '5.00' } as any);
      repo.createTransaction.mockReturnValue({} as any);

      await service.cancel('t1', admin);

      expect(repo.updateWalletBalance).toHaveBeenCalledWith('u1', '15.00');
      expect(repo.saveTransaction).toHaveBeenCalledTimes(1);
      expect(repo.updateTournament).toHaveBeenCalledWith('t1', expect.objectContaining({ status: TournamentStatus.CANCELLED }));
    });

    it('skips refund when wallet is not found', async () => {
      repo.findTournamentWithParticipants.mockResolvedValue(makeTournament({
        participants: [{ userId: 'u1', hasEntryDebited: true }],
      }) as any);
      repo.findWalletByUserId.mockResolvedValue(null);

      await service.cancel('t1', admin);
      expect(repo.updateWalletBalance).not.toHaveBeenCalled();
    });

    it('skips refund when entryFeeCc is zero', async () => {
      repo.findTournamentWithParticipants.mockResolvedValue(makeTournament({
        entryFeeCc: 0,
        participants: [{ userId: 'u1', hasEntryDebited: true }],
      }) as any);
      repo.findWalletByUserId.mockResolvedValue({ userId: 'u1', balance: '5.00' } as any);

      await service.cancel('t1', admin);
      expect(repo.updateWalletBalance).not.toHaveBeenCalled();
    });

    it('handles tournaments with no participants array', async () => {
      repo.findTournamentWithParticipants.mockResolvedValue(makeTournament({ participants: undefined }) as any);
      await service.cancel('t1', admin);
      expect(repo.updateTournament).toHaveBeenCalled();
    });
  });

  describe('removeParticipant', () => {
    it('throws NotFoundException when tournament missing', async () => {
      repo.findTournamentById.mockResolvedValue(null);
      await expect(service.removeParticipant('t1', 'u1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when tournament not REGISTERING', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament({ status: TournamentStatus.IN_PROGRESS }) as any);
      await expect(service.removeParticipant('t1', 'u1', admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when participant not found', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament() as any);
      repo.findParticipant.mockResolvedValue(null);
      await expect(service.removeParticipant('t1', 'u1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes participant and refunds when entry was debited', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament() as any);
      repo.findParticipant.mockResolvedValue({ userId: 'u1', hasEntryDebited: true } as any);
      repo.findWalletByUserId.mockResolvedValue({ userId: 'u1', balance: '5.00' } as any);
      repo.createTransaction.mockReturnValue({} as any);

      await service.removeParticipant('t1', 'u1', admin);

      expect(repo.deleteParticipant).toHaveBeenCalledWith('t1', 'u1');
      expect(repo.updateWalletBalance).toHaveBeenCalledWith('u1', '15.00');
      expect(audit.log).toHaveBeenCalledWith(admin, 'TOURNAMENT_PARTICIPANT_REMOVED', expect.objectContaining({ targetId: 't1' }));
    });

    it('does not refund when entry was not debited', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament() as any);
      repo.findParticipant.mockResolvedValue({ userId: 'u1', hasEntryDebited: false } as any);

      await service.removeParticipant('t1', 'u1', admin);
      expect(repo.updateWalletBalance).not.toHaveBeenCalled();
    });

    it('skips refund when wallet is missing even if entry was debited', async () => {
      repo.findTournamentById.mockResolvedValue(makeTournament() as any);
      repo.findParticipant.mockResolvedValue({ userId: 'u1', hasEntryDebited: true } as any);
      repo.findWalletByUserId.mockResolvedValue(null);

      await service.removeParticipant('t1', 'u1', admin);
      expect(repo.updateWalletBalance).not.toHaveBeenCalled();
    });
  });

  describe('matchMoves', () => {
    it('throws NotFoundException when match missing', async () => {
      repo.findTournamentMatchWithMatch.mockResolvedValue(null);
      await expect(service.matchMoves('tm1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps tournament match data', async () => {
      repo.findTournamentMatchWithMatch.mockResolvedValue({
        id: 'tm1', timeControl: '3+2', clockWhiteMs: 100, clockBlackMs: 200,
        moveTimestamps: [{ san: 'e4' }], aiAnalysis: null,
        match: { result: 'DRAW', whitePlayer: { nickname: 'w' }, blackPlayer: { nickname: 'b' } },
      } as any);

      const result = await service.matchMoves('tm1');
      expect(result.whiteNickname).toBe('w');
      expect(result.result).toBe('DRAW');
    });

    it('handles missing match relation gracefully', async () => {
      repo.findTournamentMatchWithMatch.mockResolvedValue({
        id: 'tm1', timeControl: '3+2', clockWhiteMs: null, clockBlackMs: null,
        moveTimestamps: [], aiAnalysis: null, match: null,
      } as any);

      const result = await service.matchMoves('tm1');
      expect(result.result).toBeNull();
      expect(result.whiteNickname).toBeNull();
    });
  });

  describe('analyzeMatchWithAi', () => {
    it('returns NO_DATA verdict when there are no moves', async () => {
      repo.findTournamentMatchWithMatch.mockResolvedValue({
        id: 'tm1', timeControl: '3+2', moveTimestamps: [], match: null,
      } as any);

      const result = await service.analyzeMatchWithAi('tm1');
      expect(result.verdict).toBe('NO_DATA');
    });

    it('returns ERROR verdict when AI is unavailable', async () => {
      repo.findTournamentMatchWithMatch.mockResolvedValue({
        id: 'tm1', timeControl: '3+2', moveTimestamps: [{ san: 'e4', player: 'white', elapsed_ms: 2000, clock_ms: 1000 }],
        match: { result: 'DRAW', whitePlayer: { nickname: 'w' }, blackPlayer: { nickname: 'b' } },
      } as any);
      deepseek.analyze.mockResolvedValue(null);

      const result = await service.analyzeMatchWithAi('tm1');
      expect(result.verdict).toBe('ERROR');
    });

    it('returns AI verdict and persists analysis', async () => {
      repo.findTournamentMatchWithMatch.mockResolvedValue({
        id: 'tm1', timeControl: '3+2',
        moveTimestamps: [
          { san: 'e4', player: 'white', elapsed_ms: 2000, clock_ms: 1000 },
          { san: 'e5', player: 'black', elapsed_ms: 1500, clock_ms: 900 },
        ],
        match: { result: 'FORFEIT_WHITE', whitePlayer: { nickname: 'w' }, blackPlayer: { nickname: 'b' } },
      } as any);
      const aiResult = { verdict: 'CLEAN', confidence: 90, suspicious: false, summary: 's', explanation: 'e', flags: [], whiteAnalysis: {}, blackAnalysis: {} };
      deepseek.analyze.mockResolvedValue(aiResult);

      const result = await service.analyzeMatchWithAi('tm1');
      expect(result).toEqual(aiResult);
      expect(repo.updateTournamentMatch).toHaveBeenCalledWith('tm1', { aiAnalysis: aiResult });
    });
  });

  describe('listDuels', () => {
    it('returns active duels with champion nicknames resolved', async () => {
      repo.findDuels.mockResolvedValue([[makeTournament({ championId: 'u1' })], 1] as any);
      repo.queryChampionNicknames.mockResolvedValue([{ id: 'u1', nickname: 'champ' }] as any);

      const result = await service.listDuels({ view: 'active' });
      expect(result.data[0].winnerNickname).toBe('champ');
      expect(repo.findDuels).toHaveBeenCalledWith(
        [TournamentStatus.REGISTERING, TournamentStatus.IN_PROGRESS], 1, 20,
      );
    });

    it('queries finished/cancelled statuses for the finished view', async () => {
      repo.findDuels.mockResolvedValue([[], 0] as any);
      await service.listDuels({ view: 'finished' });
      expect(repo.findDuels).toHaveBeenCalledWith(
        [TournamentStatus.FINISHED, TournamentStatus.CANCELLED], 1, 20,
      );
    });

    it('skips nickname lookup and returns null winner when no champion set', async () => {
      repo.findDuels.mockResolvedValue([[makeTournament({ championId: null })], 1] as any);
      const result = await service.listDuels({ view: 'active' });
      expect(repo.queryChampionNicknames).not.toHaveBeenCalled();
      expect(result.data[0].winnerNickname).toBeNull();
    });
  });
});
