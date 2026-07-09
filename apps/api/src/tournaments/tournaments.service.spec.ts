import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TournamentsService } from './tournaments.service';
import { TournamentsRepository } from './tournaments.repository';
import { WalletService } from '../wallet/wallet.service';
import { MatchesService } from '../matches/matches.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DeepseekService } from '../deepseek/deepseek.service';
import { PlatformRevenueService } from '../platform-revenue/platform-revenue.service';
import {
  TournamentType, TournamentStatus, TimeControl,
} from '../entities/tournament.entity';
import { ParticipantStatus } from '../entities/tournament-participant.entity';
import { TournamentPhase } from '../entities/tournament-match.entity';
import { MatchResult } from '../entities/match.entity';

jest.mock('bcrypt');
jest.setTimeout(15000);

describe('TournamentsService', () => {
  let service: TournamentsService;
  let tournaments: jest.Mocked<any>;
  let participants: jest.Mocked<any>;
  let tournamentMatches: jest.Mocked<any>;
  let matches: jest.Mocked<any>;
  let users: jest.Mocked<any>;
  let dataSource: jest.Mocked<any>;
  let wallet: jest.Mocked<WalletService>;
  let matchesSvc: jest.Mocked<MatchesService>;
  let notifications: jest.Mocked<NotificationsService>;
  let deepseek: jest.Mocked<DeepseekService>;
  let platformRevenue: jest.Mocked<PlatformRevenueService>;

  beforeEach(async () => {
    tournaments = {
      save: jest.fn(), create: jest.fn((x) => x), findOne: jest.fn(), update: jest.fn(),
      find: jest.fn(), createQueryBuilder: jest.fn(),
    };
    participants = {
      save: jest.fn(), create: jest.fn((x) => x), findOne: jest.fn(), update: jest.fn(),
      find: jest.fn(), remove: jest.fn(), count: jest.fn(),
    };
    tournamentMatches = { save: jest.fn(), create: jest.fn((x) => x), findOne: jest.fn(), update: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() };
    matches = {};
    users = { findOne: jest.fn() };
    dataSource = { transaction: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TournamentsService,
        {
          provide: TournamentsRepository,
          useValue: { tournaments, participants, tournamentMatches, matches, users, dataSource },
        },
        {
          provide: WalletService,
          useValue: { debit: jest.fn(), credit: jest.fn(), assertBalance: jest.fn(), debitTx: jest.fn() },
        },
        { provide: MatchesService, useValue: { createMatch: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn(), markDuelInviteRead: jest.fn(), markDuelInviteReadByTournament: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: DeepseekService, useValue: { analyze: jest.fn() } },
        { provide: PlatformRevenueService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(TournamentsService);
    wallet = module.get(WalletService);
    matchesSvc = module.get(MatchesService);
    notifications = module.get(NotificationsService);
    deepseek = module.get(DeepseekService);
    platformRevenue = module.get(PlatformRevenueService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('onModuleInit / onModuleDestroy', () => {
    it('starts and clears the stagnation interval', () => {
      service.onModuleInit();
      expect((service as any).stagnationInterval).not.toBeNull();
      service.onModuleDestroy();
    });

    it('logs an error if the scheduled stagnation cleanup rejects', async () => {
      const originalSetInterval = global.setInterval;
      let capturedCb: (() => void) | null = null;
      (global as any).setInterval = ((fn: any) => { capturedCb = fn; return 0 as any; }) as any;
      tournaments.find.mockRejectedValue(new Error('db down'));
      const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

      service.onModuleInit();
      (global as any).setInterval = originalSetInterval;

      expect(capturedCb).not.toBeNull();
      capturedCb!();
      await Promise.resolve();
      await Promise.resolve();

      expect(errorSpy).toHaveBeenCalledWith('stagnation', expect.any(Error));
      service.onModuleDestroy();
    });
  });

  describe('inviteFriend', () => {
    it('creates a duel tournament, debits the inviter and emits an invite', async () => {
      tournaments.save.mockResolvedValue({ id: 't1' });
      users.findOne.mockResolvedValue({ id: 'inviter', nickname: 'Bob', birthDate: '1990-01-01' });
      notifications.create.mockResolvedValue({ id: 'n1' } as any);
      const emitter = jest.fn();
      service.duelInviteEmitter = emitter;

      const result = await service.inviteFriend('inviter', 'friend1', TournamentType.DUEL_FLASH, 6);

      expect(wallet.debit).toHaveBeenCalledWith('inviter', 6, expect.any(String), 't1', expect.any(String));
      expect(participants.save).toHaveBeenCalled();
      expect(emitter).toHaveBeenCalled();
      expect(result).toEqual({ tournamentId: 't1' });
    });

    it('throws BadRequestException when the inviter has no birth date on file', async () => {
      users.findOne.mockResolvedValue({ id: 'inviter', nickname: 'Bob', birthDate: null });
      await expect(
        service.inviteFriend('inviter', 'friend1', TournamentType.DUEL_FLASH, 6),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tournaments.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the inviter is under 18', async () => {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      users.findOne.mockResolvedValue({ id: 'inviter', nickname: 'Bob', birthDate: tenYearsAgo.toISOString().slice(0, 10) });
      await expect(
        service.inviteFriend('inviter', 'friend1', TournamentType.DUEL_FLASH, 6),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('acceptDuelInvite', () => {
    it('throws NotFoundException when the invite tournament does not exist', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.acceptDuelInvite('u1', 't1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when there is no inviter participant', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', participants: [] });
      await expect(service.acceptDuelInvite('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when accepting your own invite', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', participants: [{ userId: 'u1' }] });
      await expect(service.acceptDuelInvite('u1', 't1')).rejects.toThrow(ForbiddenException);
    });

    it('starts the duel on success', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', participants: [{ userId: 'inviter' }], entryFeeCc: 6, timeControl: TimeControl.BLITZ_3_2,
      });
      matchesSvc.createMatch.mockResolvedValue({ id: 'match1' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null, birthDate: '1990-01-01' });

      const result = await service.acceptDuelInvite('acceptor', 't1');

      expect(wallet.debit).toHaveBeenCalledWith('acceptor', 6, expect.any(String), 't1', expect.any(String));
      expect(tournaments.update).toHaveBeenCalledWith('t1', expect.objectContaining({ status: TournamentStatus.IN_PROGRESS }));
      expect(result).toEqual({ status: 'matched', tournamentId: 't1', matchId: 'match1' });
    });

    it('throws BadRequestException when the acceptor has no birth date on file', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', participants: [{ userId: 'inviter' }], entryFeeCc: 6, timeControl: TimeControl.BLITZ_3_2,
      });
      users.findOne.mockResolvedValue({ id: 'acceptor', nickname: 'X', birthDate: null });

      await expect(service.acceptDuelInvite('acceptor', 't1')).rejects.toBeInstanceOf(BadRequestException);
      expect(wallet.debit).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the acceptor is under 18', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', participants: [{ userId: 'inviter' }], entryFeeCc: 6, timeControl: TimeControl.BLITZ_3_2,
      });
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      users.findOne.mockResolvedValue({ id: 'acceptor', nickname: 'X', birthDate: tenYearsAgo.toISOString().slice(0, 10) });

      await expect(service.acceptDuelInvite('acceptor', 't1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('declineDuelInvite', () => {
    it('marks notification read and cancels the invite', async () => {
      tournaments.findOne.mockResolvedValue(null);
      const result = await service.declineDuelInvite('u1', 't1');
      expect(notifications.markDuelInviteRead).toHaveBeenCalledWith('u1', 't1');
      expect(result).toEqual({ status: 'declined' });
    });

    it('refunds the inviter when a debited participant exists', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', status: TournamentStatus.REGISTERING, entryFeeCc: 6 });
      participants.findOne.mockResolvedValue({ userId: 'inviter' });

      await service.declineDuelInvite('u1', 't1');

      expect(wallet.credit).toHaveBeenCalledWith('inviter', 6, expect.any(String), 't1', expect.any(String));
    });
  });

  describe('createCustomTournament', () => {
    it('creates a tournament and debits the creation fee', async () => {
      dataSource.transaction.mockImplementation(async (cb: any) => cb({
        save: jest.fn().mockResolvedValue({ id: 't1', name: 'X', maxPlayers: 4, entryFeeCc: 10 }),
        create: jest.fn((_e, x) => x),
      }));

      const result = await service.createCustomTournament('creator1', {
        name: 'X', entryFee: 10, maxPlayers: 4, timeControl: TimeControl.RAPID_10_0, isPrivate: false,
      } as any);

      expect(wallet.assertBalance).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 't1');
    });

    it('hashes the password when private', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      dataSource.transaction.mockImplementation(async (cb: any) => cb({
        save: jest.fn().mockResolvedValue({ id: 't2', name: 'Y', maxPlayers: 4, entryFeeCc: 10 }),
        create: jest.fn((_e, x) => x),
      }));

      await service.createCustomTournament('creator1', {
        name: 'Y', entryFee: 10, maxPlayers: 4, timeControl: TimeControl.RAPID_10_0,
        isPrivate: true, password: 'secret1',
      } as any);

      expect(bcrypt.hash).toHaveBeenCalledWith('secret1', 10);
    });
  });

  describe('joinCustomTournament', () => {
    const baseTournament = {
      id: 't1', status: TournamentStatus.REGISTERING, type: TournamentType.USER_CREATED,
      maxPlayers: 4, entryFeeCc: 10, isPrivate: false, participants: [],
    };

    it('throws NotFoundException when tournament missing or not registering', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.joinCustomTournament('u1', 't1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for non user-created tournaments', async () => {
      tournaments.findOne.mockResolvedValue({ ...baseTournament, type: TournamentType.DUEL_FLASH });
      await expect(service.joinCustomTournament('u1', 't1', {} as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when already registered', async () => {
      tournaments.findOne.mockResolvedValue({
        ...baseTournament, participants: [{ userId: 'u1', status: ParticipantStatus.REGISTERED }],
      });
      await expect(service.joinCustomTournament('u1', 't1', {} as any)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when tournament is full', async () => {
      tournaments.findOne.mockResolvedValue({
        ...baseTournament, maxPlayers: 1,
        participants: [{ userId: 'other', status: ParticipantStatus.REGISTERED }],
      });
      await expect(service.joinCustomTournament('u1', 't1', {} as any)).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when private tournament requires password and none given', async () => {
      tournaments.findOne.mockResolvedValue({ ...baseTournament, isPrivate: true, passwordHash: 'hash' });
      participants.findOne.mockResolvedValue(null);
      await expect(service.joinCustomTournament('u1', 't1', {} as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when password is incorrect', async () => {
      tournaments.findOne.mockResolvedValue({ ...baseTournament, isPrivate: true, passwordHash: 'hash' });
      participants.findOne.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.joinCustomTournament('u1', 't1', { password: 'wrong' } as any)).rejects.toThrow(ForbiddenException);
    });

    it('joins successfully with valid password', async () => {
      tournaments.findOne.mockResolvedValue({ ...baseTournament, isPrivate: true, passwordHash: 'hash' });
      participants.findOne.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      participants.save.mockResolvedValue({ id: 'p1' });

      const result = await service.joinCustomTournament('u1', 't1', { password: 'correct' } as any);

      expect(result).toEqual({ participantId: 'p1', tournamentId: 't1' });
    });

    it('joins successfully for public tournaments and checks balance', async () => {
      tournaments.findOne.mockResolvedValue({ ...baseTournament });
      participants.save.mockResolvedValue({ id: 'p2' });

      const result = await service.joinCustomTournament('u1', 't1', {} as any);

      expect(wallet.assertBalance).toHaveBeenCalledWith('u1', 10);
      expect(result).toEqual({ participantId: 'p2', tournamentId: 't1' });
    });

    it('allows re-registration after being kicked, removing the stale record', async () => {
      const stale = { userId: 'u1', status: ParticipantStatus.KICKED };
      tournaments.findOne.mockResolvedValue({ ...baseTournament, participants: [stale] });
      participants.save.mockResolvedValue({ id: 'p3' });

      await service.joinCustomTournament('u1', 't1', {} as any);

      expect(participants.remove).toHaveBeenCalledWith(stale);
    });
  });

  describe('leaveCustomTournament', () => {
    it('throws BadRequestException when tournament missing/started', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.leaveCustomTournament('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when user not registered', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1' });
      participants.findOne.mockResolvedValue(null);
      await expect(service.leaveCustomTournament('u1', 't1')).rejects.toThrow(NotFoundException);
    });

    it('removes the participant on success', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1' });
      participants.findOne.mockResolvedValue({ id: 'p1' });
      participants.count.mockResolvedValue(1);

      const result = await service.leaveCustomTournament('u1', 't1');

      expect(participants.remove).toHaveBeenCalled();
      expect(result).toEqual({ status: 'left' });
    });
  });

  describe('kickParticipant', () => {
    it('throws ForbiddenException when not the creator', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.kickParticipant('creator1', 't1', 'u2')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when kicking self', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1' });
      await expect(service.kickParticipant('creator1', 't1', 'creator1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when participant missing', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1' });
      participants.findOne.mockResolvedValue(null);
      await expect(service.kickParticipant('creator1', 't1', 'u2')).rejects.toThrow(NotFoundException);
    });

    it('kicks the participant and notifies them', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', name: 'X' });
      participants.findOne.mockResolvedValue({ id: 'p1' });
      participants.count.mockResolvedValue(2);

      const result = await service.kickParticipant('creator1', 't1', 'u2');

      expect(participants.update).toHaveBeenCalledWith('p1', { status: ParticipantStatus.KICKED });
      expect(notifications.create).toHaveBeenCalled();
      expect(result).toEqual({ status: 'kicked' });
    });
  });

  describe('cancelCustomTournament', () => {
    it('throws NotFoundException when missing/started', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.cancelCustomTournament('u1', 't1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not the creator', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', creatorId: 'other' });
      await expect(service.cancelCustomTournament('u1', 't1')).rejects.toThrow(ForbiddenException);
    });

    it('cancels and notifies participants', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', creatorId: 'u1', name: 'X' });
      participants.find.mockResolvedValue([{ userId: 'p1' }]);

      const result = await service.cancelCustomTournament('u1', 't1');

      expect(tournaments.update).toHaveBeenCalledWith('t1', { status: TournamentStatus.CANCELLED });
      expect(notifications.create).toHaveBeenCalled();
      expect(result).toEqual({ status: 'cancelled' });
    });
  });

  describe('adminCancelTournament', () => {
    it('throws NotFoundException when missing', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.adminCancelTournament('t1')).rejects.toThrow(NotFoundException);
    });

    it('refunds debited participants for in-progress tournaments', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', status: TournamentStatus.IN_PROGRESS, name: 'X' });
      participants.find.mockResolvedValue([{ userId: 'p1', entryFeePaid: 10 }]);

      const result = await service.adminCancelTournament('t1');

      expect(wallet.credit).toHaveBeenCalledWith('p1', 10, expect.any(String), 't1', expect.any(String));
      expect(result).toEqual({ status: 'cancelled' });
    });

    it('does not refund when tournament was still registering', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', status: TournamentStatus.REGISTERING, name: 'X' });

      await service.adminCancelTournament('t1');

      expect(wallet.credit).not.toHaveBeenCalled();
    });
  });

  describe('inviteByNickname', () => {
    it('throws ForbiddenException when not the creator', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.inviteByNickname('creator1', 't1', 'nick')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when target player missing', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1' });
      users.findOne.mockResolvedValueOnce(null);
      await expect(service.inviteByNickname('creator1', 't1', 'nick')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when already invited/joined', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1' });
      users.findOne.mockResolvedValueOnce({ id: 'target1', nickname: 'nick' });
      participants.findOne.mockResolvedValue({ id: 'p1' });
      await expect(service.inviteByNickname('creator1', 't1', 'nick')).rejects.toThrow(BadRequestException);
    });

    it('invites successfully', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', maxPlayers: 4, entryFeeCc: 10, name: 'X', timeControl: '10+0', isPrivate: false });
      users.findOne
        .mockResolvedValueOnce({ id: 'target1', nickname: 'nick' })
        .mockResolvedValueOnce({ id: 'creator1', nickname: 'Creator' });
      participants.findOne.mockResolvedValue(null);

      const result = await service.inviteByNickname('creator1', 't1', 'nick');

      expect(participants.save).toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalled();
      expect(result).toEqual({ status: 'invited' });
    });
  });

  describe('inviteFriendToTournament', () => {
    it('throws NotFoundException when friend missing', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(service.inviteFriendToTournament('creator1', 't1', 'friend1')).rejects.toThrow(NotFoundException);
    });

    it('delegates to inviteByNickname with the friend nickname', async () => {
      users.findOne
        .mockResolvedValueOnce({ id: 'friend1', nickname: 'friendNick' });
      const spy = jest.spyOn(service, 'inviteByNickname').mockResolvedValue({ status: 'invited' } as any);

      const result = await service.inviteFriendToTournament('creator1', 't1', 'friend1');

      expect(spy).toHaveBeenCalledWith('creator1', 't1', 'friendNick');
      expect(result).toEqual({ status: 'invited' });
    });
  });

  describe('manuallyStartTournament', () => {
    it('throws NotFoundException when missing', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.manuallyStartTournament('u1', 't1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not the creator', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', creatorId: 'other', participants: [] });
      await expect(service.manuallyStartTournament('u1', 't1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when not registering', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', creatorId: 'u1', status: TournamentStatus.IN_PROGRESS, participants: [] });
      await expect(service.manuallyStartTournament('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when fewer than 4 active players', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', creatorId: 'u1', status: TournamentStatus.REGISTERING,
        participants: [{ status: ParticipantStatus.REGISTERED }],
      });
      await expect(service.manuallyStartTournament('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when not flexible and not full', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', creatorId: 'u1', status: TournamentStatus.REGISTERING, isFlexible: false, maxPlayers: 8,
        participants: Array.from({ length: 4 }, () => ({ status: ParticipantStatus.REGISTERED })),
      });
      await expect(service.manuallyStartTournament('u1', 't1')).rejects.toThrow(BadRequestException);
    });

    it('starts the tournament when eligible', async () => {
      const regTournament = {
        id: 't1', creatorId: 'u1', status: TournamentStatus.REGISTERING, isFlexible: false, maxPlayers: 4,
        name: 'X', entryFeeCc: 10, timeControl: '10+0',
        participants: Array.from({ length: 4 }, (_, i) => ({
          id: `p${i}`, userId: `u${i}`, status: ParticipantStatus.REGISTERED,
          hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, i + 1),
        })),
      };
      tournaments.findOne
        .mockResolvedValueOnce(regTournament) // manuallyStartTournament lookup
        .mockResolvedValueOnce(regTournament); // startCustomTournament internal lookup
      dataSource.transaction.mockImplementation(async (cb: any) => cb({ update: jest.fn() }));
      matchesSvc.createMatch.mockResolvedValue({ id: 'match1' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      const result = await service.manuallyStartTournament('u1', 't1');

      expect(result).toEqual({ status: 'started' });
      expect(tournamentMatches.save).toHaveBeenCalled();
    });

    it('does not start when bracket size is invalid (not power of two / < 4)', async () => {
      const regTournament = {
        id: 't1', creatorId: 'u1', status: TournamentStatus.REGISTERING, isFlexible: true, maxPlayers: 4,
        participants: Array.from({ length: 3 }, (_, i) => ({
          id: `p${i}`, userId: `u${i}`, status: ParticipantStatus.REGISTERED,
          hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(),
        })),
      };
      tournaments.findOne.mockResolvedValueOnce(regTournament).mockResolvedValueOnce(regTournament);

      await expect(service.manuallyStartTournament('u1', 't1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('onMatchFinished', () => {
    it('does nothing when the tournament match is not found', async () => {
      tournamentMatches.findOne.mockResolvedValue(null);
      await service.onMatchFinished('m1', MatchResult.WHITE_WINS, 1000, 1000, []);
      expect(tournamentMatches.update).not.toHaveBeenCalled();
    });

    it('finalizes a duel when tournament type is DUEL_FLASH', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1',
        tournament: { id: 't1', type: TournamentType.DUEL_FLASH, prizePoolCc: 100, rakeCc: 12, entryFeeCc: 6 },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.WHITE_WINS, 1000, 1000, []);

      expect(wallet.credit).toHaveBeenCalledWith('w1', 100, expect.any(String), 't1', expect.any(String));
      expect(tournaments.update).toHaveBeenCalledWith('t1', expect.objectContaining({ status: TournamentStatus.FINISHED }));
    });

    it('splits the pool on a draw duel', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1',
        tournament: { id: 't1', type: TournamentType.DUEL_GIANT, prizePoolCc: 100, rakeCc: 12, entryFeeCc: 6 },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.DRAW, 1000, 1000, []);

      expect(wallet.credit).toHaveBeenCalledWith('w1', 50, expect.any(String), 't1', 'Empate — metade do pote');
      expect(wallet.credit).toHaveBeenCalledWith('b1', 50, expect.any(String), 't1', 'Empate — metade do pote');
    });

    it('routes to custom tournament finalization for USER_CREATED type', async () => {
      const bracket = {
        totalRounds: 2,
        rounds: [
          { roundNumber: 1, phase: TournamentPhase.ROUND_1, matches: [{ bracketId: 'R1M0', player1Id: 'w1', player2Id: 'b1', winnerId: null, loserId: null, matchId: 'm1', tiebreakResult: null }] },
          { roundNumber: 2, phase: TournamentPhase.FINAL, matches: [{ bracketId: 'R2M0', player1Id: null, player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null }] },
        ],
        thirdPlaceMatch: null,
      };
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.WHITE_WINS, 1000, 800, []);

      expect(participants.update).toHaveBeenCalledWith(
        { tournamentId: 't1', userId: 'b1' }, { status: ParticipantStatus.ELIMINATED },
      );
      expect(tournaments.update).toHaveBeenCalledWith('t1', expect.objectContaining({ bracketData: expect.any(Object) }));
    });

    it('resolves draws in a custom tournament via material tiebreak', async () => {
      const bracket = {
        totalRounds: 1,
        rounds: [{ roundNumber: 1, phase: TournamentPhase.FINAL, matches: [{ bracketId: 'R1M0', player1Id: 'w1', player2Id: 'b1', winnerId: null, loserId: null, matchId: 'm1', tiebreakResult: null }] }],
        thirdPlaceMatch: null,
      };
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.FINAL,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket, maxPlayers: 4, entryFeeCc: 10, name: 'X' },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });
      // FEN with white having more material: white has a queen, black nothing extra
      const fen = '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1';

      await service.onMatchFinished('m1', MatchResult.DRAW, 1000, 1000, [], fen);

      expect(tournamentMatches.update).toHaveBeenCalledWith('tm1', { tiebreakResult: 'MATERIAL_WIN' });
    });
  });

  describe('listTournaments', () => {
    it('applies filters and returns a paginated list', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{
          id: 't1', name: 'X', maxPlayers: 4, entryFeeCc: 10,
          participants: [
            { userId: 'u1', status: ParticipantStatus.ACTIVE },
            { userId: 'u2', status: ParticipantStatus.KICKED },
          ],
        }], 1]),
      };
      tournaments.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listTournaments({ name: 'X', status: TournamentStatus.REGISTERING, isPublic: true } as any, 'u1');

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('t1');
      expect(result.items[0].currentPlayers).toBe(1); // the KICKED participant doesn't count
      expect(result.items[0].isUserJoined).toBe(true);
    });
  });

  describe('getUserTournaments', () => {
    it('returns tournaments the user has joined', async () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 't1', maxPlayers: 4, entryFeeCc: 10, participants: [] }], 1]),
      };
      tournaments.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getUserTournaments('u1', {} as any);

      expect(result.total).toBe(1);
    });
  });

  describe('getTournamentDetails', () => {
    it('throws NotFoundException when missing', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await expect(service.getTournamentDetails('t1')).rejects.toThrow(NotFoundException);
    });

    it('returns tournament with mapped participants', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1',
        participants: [{ userId: 'u1', user: { nickname: 'Bob' }, status: ParticipantStatus.ACTIVE, hasEntryDebited: true, invitedByCreator: false, bracketPosition: 0, prizeWon: 0 }],
      });

      const result = await service.getTournamentDetails('t1');

      expect(result.participants[0].nickname).toBe('Bob');
    });
  });

  describe('getMatchTournamentDetails', () => {
    it('returns the tournament match with relations', async () => {
      tournamentMatches.findOne.mockResolvedValue({ id: 'tm1' });
      const result = await service.getMatchTournamentDetails('m1');
      expect(result).toEqual({ id: 'tm1' });
    });
  });

  describe('getUserTournamentHistory', () => {
    it('returns paginated match history', async () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'tm1' }], 1]),
      };
      tournamentMatches.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getUserTournamentHistory('u1', 1, 20);

      expect(result.total).toBe(1);
    });
  });

  describe('joinCustomTournament — side effects', () => {
    it('notifies participants when the tournament reaches 80% capacity', async () => {
      const tournament = {
        id: 't1', status: TournamentStatus.REGISTERING, type: TournamentType.USER_CREATED,
        maxPlayers: 5, entryFeeCc: 10, isPrivate: false,
        participants: Array.from({ length: 3 }, (_, i) => ({ userId: `u${i}`, status: ParticipantStatus.REGISTERED })),
        name: 'X',
      };
      tournaments.findOne.mockResolvedValue(tournament);
      participants.save.mockResolvedValue({ id: 'p-new' });
      participants.find.mockResolvedValue(tournament.participants);
      participants.count.mockResolvedValue(4);

      await service.joinCustomTournament('newUser', 't1', {} as any);
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(notifications.create).toHaveBeenCalledWith(
        expect.any(String), expect.anything(), expect.objectContaining({ tournamentId: 't1' }),
      );
    });

    it('kicks off startCustomTournament once the tournament fills up', async () => {
      const tournament = {
        id: 't1', status: TournamentStatus.REGISTERING, type: TournamentType.USER_CREATED,
        maxPlayers: 4, entryFeeCc: 10, isPrivate: false,
        participants: Array.from({ length: 3 }, (_, i) => ({
          id: `p${i}`, userId: `u${i}`, status: ParticipantStatus.REGISTERED,
        })) as any[],
        name: 'X', isFlexible: false, timeControl: '10+0',
      };
      tournaments.findOne
        .mockResolvedValueOnce(tournament) // joinCustomTournament lookup
        .mockResolvedValue({
          ...tournament,
          participants: [
            ...tournament.participants,
            { id: 'p4', userId: 'newUser', status: ParticipantStatus.REGISTERED },
          ].map((p, i) => ({ ...p, hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, i + 1) })),
        });
      participants.save.mockResolvedValue({ id: 'p-new' });
      participants.find.mockResolvedValue(tournament.participants);
      dataSource.transaction.mockImplementation(async (cb: any) => cb({ update: jest.fn() }));
      matchesSvc.createMatch.mockResolvedValue({ id: 'match1' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      await service.joinCustomTournament('newUser', 't1', {} as any);
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(tournamentMatches.save).toHaveBeenCalled();
    });
  });

  describe('leaveCustomTournament / kickParticipant — room updates', () => {
    it('emits a room update with the participant list after leaving', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1' });
      participants.findOne.mockResolvedValue({ id: 'p1' });
      participants.count.mockResolvedValue(0);
      participants.find.mockResolvedValue([]);
      const roomEmitter = jest.fn();
      (service as any)._roomUpdateEmitter = roomEmitter;

      await service.leaveCustomTournament('u1', 't1');
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(roomEmitter).toHaveBeenCalledWith('t1', expect.objectContaining({ type: 'PLAYER_LEFT' }));
    });

    it('emits a room update with the participant list after kicking', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', name: 'X' });
      participants.findOne.mockResolvedValue({ id: 'p1' });
      participants.count.mockResolvedValue(1);
      participants.find.mockResolvedValue([{ userId: 'u2', user: { nickname: 'Bob', avatarUrl: null, rating: 1000 }, status: ParticipantStatus.KICKED, hasEntryDebited: false, bracketPosition: null }]);
      const roomEmitter = jest.fn();
      (service as any)._roomUpdateEmitter = roomEmitter;

      await service.kickParticipant('creator1', 't1', 'u2');
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));

      expect(roomEmitter).toHaveBeenCalledWith('t1', expect.objectContaining({ type: 'PLAYER_KICKED' }));
    });
  });

  describe('startCustomTournament (private, via manuallyStartTournament)', () => {
    it('reduces the bracket to the largest valid power of two when flexible', async () => {
      const regTournament = {
        id: 't1', creatorId: 'u1', status: TournamentStatus.REGISTERING, isFlexible: true, maxPlayers: 8,
        name: 'X', entryFeeCc: 10, timeControl: '10+0',
        participants: Array.from({ length: 5 }, (_, i) => ({
          id: `p${i}`, userId: `u${i}`, status: ParticipantStatus.REGISTERED,
          hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, i + 1),
        })),
      };
      tournaments.findOne.mockResolvedValueOnce(regTournament).mockResolvedValueOnce(regTournament);
      const txUpdate = jest.fn();
      dataSource.transaction.mockImplementation(async (cb: any) => cb({ update: txUpdate }));
      matchesSvc.createMatch.mockResolvedValue({ id: 'match1' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      // isFlexible=true skips the "must be full" check; 5 active players get trimmed
      // down to the largest valid bracket size (4) via FIFO by registeredAt.
      const result = await service.manuallyStartTournament('u1', 't1');

      expect(result).toEqual({ status: 'started' });
      expect(wallet.debitTx).toHaveBeenCalledTimes(4);
      expect(tournamentMatches.save).toHaveBeenCalledTimes(2); // bracket size 4 → 2 first-round matches
    });

    it('builds a full 16-player bracket exercising every named round phase', async () => {
      const regTournament = {
        id: 't1', creatorId: 'u1', status: TournamentStatus.REGISTERING, isFlexible: false, maxPlayers: 16,
        name: 'X', entryFeeCc: 10, timeControl: '10+0',
        participants: Array.from({ length: 16 }, (_, i) => ({
          id: `p${i}`, userId: `u${i}`, status: ParticipantStatus.REGISTERED,
          hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, i + 1),
        })),
      };
      tournaments.findOne.mockResolvedValueOnce(regTournament).mockResolvedValueOnce(regTournament);
      dataSource.transaction.mockImplementation(async (cb: any) => cb({ update: jest.fn() }));
      matchesSvc.createMatch.mockResolvedValue({ id: 'match1' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      const result = await service.manuallyStartTournament('u1', 't1');

      expect(result).toEqual({ status: 'started' });
      expect(wallet.debitTx).toHaveBeenCalledTimes(16);
      expect(tournamentMatches.save).toHaveBeenCalledTimes(8); // round 1 of a 16-player bracket
    });

    it('warns and does nothing when a non-flexible bracket size is not a valid power of two', async () => {
      // Reachable in practice when a tournament auto-starts (joinCustomTournament)
      // with a non power-of-two maxPlayers — bypasses manuallyStartTournament's own guards.
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.REGISTERING, isFlexible: false, maxPlayers: 5, name: 'X',
        participants: Array.from({ length: 5 }, (_, i) => ({
          id: `p${i}`, userId: `u${i}`, status: ParticipantStatus.REGISTERED,
          hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, i + 1),
        })),
      });

      await (service as any).startCustomTournament('t1');

      expect(wallet.debitTx).not.toHaveBeenCalled();
      expect(tournamentMatches.save).not.toHaveBeenCalled();
    });

    it('debits only participants who have not already been debited', async () => {
      const regTournament = {
        id: 't1', creatorId: 'u1', status: TournamentStatus.REGISTERING, isFlexible: false, maxPlayers: 4,
        name: 'X', entryFeeCc: 10, timeControl: '10+0',
        participants: [
          { id: 'p0', userId: 'u0', status: ParticipantStatus.REGISTERED, hasEntryDebited: true, entryFeePaid: 10, registeredAt: new Date(2026, 0, 1) },
          { id: 'p1', userId: 'u1', status: ParticipantStatus.REGISTERED, hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, 2) },
          { id: 'p2', userId: 'u2', status: ParticipantStatus.REGISTERED, hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, 3) },
          { id: 'p3', userId: 'u3', status: ParticipantStatus.REGISTERED, hasEntryDebited: false, entryFeePaid: 10, registeredAt: new Date(2026, 0, 4) },
        ],
      };
      tournaments.findOne.mockResolvedValueOnce(regTournament).mockResolvedValueOnce(regTournament);
      const txUpdate = jest.fn();
      dataSource.transaction.mockImplementation(async (cb: any) => cb({ update: txUpdate }));
      matchesSvc.createMatch.mockResolvedValue({ id: 'match1' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      await service.manuallyStartTournament('u1', 't1');

      expect(wallet.debitTx).toHaveBeenCalledTimes(3);
    });
  });

  describe('finalizeDuel (via onMatchFinished)', () => {
    it('credits the black player when black wins', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1',
        tournament: { id: 't1', type: TournamentType.DUEL_FLASH, prizePoolCc: 100, rakeCc: 12, entryFeeCc: 6 },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.BLACK_WINS, 1000, 1000, []);

      expect(wallet.credit).toHaveBeenCalledWith('b1', 100, expect.any(String), 't1', expect.any(String));
      expect(tournamentMatches.update).toHaveBeenCalledWith('tm1', { blackPrize: 100 });
      expect(tournaments.update).toHaveBeenCalledWith('t1', expect.objectContaining({ championId: 'b1' }));
    });
  });

  describe('finalizeCustomTournamentMatch tiebreak branches (via onMatchFinished)', () => {
    const bracket = (phase: TournamentPhase = TournamentPhase.ROUND_1) => ({
      totalRounds: 2,
      rounds: [
        { roundNumber: 1, phase, matches: [{ bracketId: 'R1M0', player1Id: 'w1', player2Id: 'b1', winnerId: null, loserId: null, matchId: 'm1', tiebreakResult: null }] },
        { roundNumber: 2, phase: TournamentPhase.FINAL, matches: [{ bracketId: 'R2M0', player1Id: null, player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null }] },
      ],
      thirdPlaceMatch: null,
    });

    it('resolves a draw by clock when material is tied (white clock higher)', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket() },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'; // only kings — equal material

      await service.onMatchFinished('m1', MatchResult.DRAW, 2000, 1000, [], fen);

      expect(tournamentMatches.update).toHaveBeenCalledWith('tm1', { tiebreakResult: 'CLOCK_WIN' });
      expect(participants.update).toHaveBeenCalledWith(
        { tournamentId: 't1', userId: 'b1' }, { status: ParticipantStatus.ELIMINATED },
      );
    });

    it('resolves a draw by clock when material is tied (black clock higher)', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket() },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

      await service.onMatchFinished('m1', MatchResult.DRAW, 1000, 2000, [], fen);

      expect(tournamentMatches.update).toHaveBeenCalledWith('tm1', { tiebreakResult: 'CLOCK_WIN' });
      expect(participants.update).toHaveBeenCalledWith(
        { tournamentId: 't1', userId: 'w1' }, { status: ParticipantStatus.ELIMINATED },
      );
    });

    it('marks both players eliminated on a full double elimination (equal material and clock)', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket() },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });
      const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

      await service.onMatchFinished('m1', MatchResult.DRAW, 1000, 1000, [], fen);

      expect(tournamentMatches.update).toHaveBeenCalledWith('tm1', { tiebreakResult: 'DOUBLE_ELIMINATION' });
      expect(participants.update).toHaveBeenCalledWith(
        { tournamentId: 't1', userId: 'w1' }, { status: ParticipantStatus.ELIMINATED },
      );
      expect(participants.update).toHaveBeenCalledWith(
        { tournamentId: 't1', userId: 'b1' }, { status: ParticipantStatus.ELIMINATED },
      );
    });

    it('resolves a draw with black having more material', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket() },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });
      const fen = '4k3/8/8/8/8/8/8/q3K3 w - - 0 1'; // black queen only

      await service.onMatchFinished('m1', MatchResult.DRAW, 1000, 1000, [], fen);

      expect(tournamentMatches.update).toHaveBeenCalledWith('tm1', { tiebreakResult: 'MATERIAL_WIN' });
      expect(participants.update).toHaveBeenCalledWith(
        { tournamentId: 't1', userId: 'w1' }, { status: ParticipantStatus.ELIMINATED },
      );
    });

    it('resolves a clear win (not a draw) and eliminates the loser', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket() },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.BLACK_WINS, 1000, 1000, []);

      expect(participants.update).toHaveBeenCalledWith(
        { tournamentId: 't1', userId: 'w1' }, { status: ParticipantStatus.ELIMINATED },
      );
    });

    it('schedules and eventually runs checkAndFinalizeTournament when the finished match was the FINAL', async () => {
      const originalSetTimeout = global.setTimeout;
      let capturedCb: (() => Promise<void>) | null = null;
      const setTimeoutSpy = jest.fn((fn: any) => { capturedCb = fn; return 0 as any; });
      (global as any).setTimeout = setTimeoutSpy;
      const finalBracket = bracket(TournamentPhase.FINAL);
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R2M0', phase: TournamentPhase.FINAL,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: finalBracket },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.WHITE_WINS, 1000, 1000, []);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2_000);
      (global as any).setTimeout = originalSetTimeout;

      // Exercises the scheduled callback body itself (calls checkAndFinalizeTournament)
      tournaments.findOne.mockResolvedValue({ id: 't1', bracketData: null });
      capturedCb!();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('schedules and eventually runs tryAdvanceRound, emitting countdown for non-final rounds', async () => {
      const originalSetTimeout = global.setTimeout;
      let capturedCb: (() => Promise<void>) | null = null;
      const setTimeoutSpy = jest.fn((fn: any) => { capturedCb = fn; return 0 as any; });
      (global as any).setTimeout = setTimeoutSpy;
      const nextRoundEmitter = jest.fn();
      service.nextRoundEmitter = nextRoundEmitter;
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: bracket() },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.WHITE_WINS, 1000, 1000, []);

      expect(nextRoundEmitter).toHaveBeenCalledWith('t1', 30);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
      (global as any).setTimeout = originalSetTimeout;

      // Exercises the scheduled callback body itself (calls tryAdvanceRound)
      tournaments.findOne.mockResolvedValue({ id: 't1', bracketData: null, status: TournamentStatus.IN_PROGRESS });
      capturedCb!();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('returns early when the tournament has no bracketData', async () => {
      tournamentMatches.findOne.mockResolvedValue({
        id: 'tm1', bracketId: 'R1M0', phase: TournamentPhase.ROUND_1,
        tournament: { id: 't1', type: TournamentType.USER_CREATED, bracketData: null },
        match: { whitePlayerId: 'w1', blackPlayerId: 'b1' },
      });

      await service.onMatchFinished('m1', MatchResult.WHITE_WINS, 1000, 1000, []);

      expect(tournaments.update).not.toHaveBeenCalled();
    });
  });

  describe('advanceBracket (private)', () => {
    function baseBracket(): any {
      return {
        totalRounds: 2,
        rounds: [
          {
            roundNumber: 1, phase: TournamentPhase.ROUND_1,
            matches: [
              { bracketId: 'R1M0', player1Id: 'a', player2Id: 'b', winnerId: null, loserId: null, matchId: 'm1', tiebreakResult: null },
              { bracketId: 'R1M1', player1Id: 'c', player2Id: 'd', winnerId: null, loserId: null, matchId: 'm2', tiebreakResult: null },
            ],
          },
          {
            roundNumber: 2, phase: TournamentPhase.FINAL,
            matches: [{ bracketId: 'R2M0', player1Id: null, player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null }],
          },
        ],
        thirdPlaceMatch: { bracketId: 'THIRD', player1Id: null, player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null },
      };
    }

    it('advances the winner of match index 0 into player1 of the next round', () => {
      const result = (service as any).advanceBracket(baseBracket(), 'R1M0', 'a', 'b', null);
      expect(result.rounds[1].matches[0].player1Id).toBe('a');
    });

    it('advances the winner of match index 1 into player2 of the next round', () => {
      const result = (service as any).advanceBracket(baseBracket(), 'R1M1', 'c', 'd', null);
      expect(result.rounds[1].matches[0].player2Id).toBe('c');
    });

    it('does not advance anyone when winnerId is null (double elimination)', () => {
      const result = (service as any).advanceBracket(baseBracket(), 'R1M0', null, null, 'DOUBLE_ELIMINATION');
      expect(result.rounds[1].matches[0].player1Id).toBeNull();
      expect(result.rounds[1].matches[0].player2Id).toBeNull();
    });

    it('sends the semifinal loser to the third place match (first slot then second slot)', () => {
      const semiBracket: any = {
        totalRounds: 3,
        rounds: [
          { roundNumber: 1, phase: TournamentPhase.ROUND_1, matches: [] },
          {
            roundNumber: 2, phase: TournamentPhase.SEMIFINAL,
            matches: [
              { bracketId: 'SF0', player1Id: 'a', player2Id: 'b', winnerId: null, loserId: null, matchId: 'm1', tiebreakResult: null },
              { bracketId: 'SF1', player1Id: 'c', player2Id: 'd', winnerId: null, loserId: null, matchId: 'm2', tiebreakResult: null },
            ],
          },
          { roundNumber: 3, phase: TournamentPhase.FINAL, matches: [{ bracketId: 'R3M0', player1Id: null, player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null }] },
        ],
        thirdPlaceMatch: { bracketId: 'THIRD', player1Id: null, player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null },
      };

      let updated = (service as any).advanceBracket(semiBracket, 'SF0', 'a', 'b', null);
      expect(updated.thirdPlaceMatch.player1Id).toBe('b');

      updated = (service as any).advanceBracket(updated, 'SF1', 'c', 'd', null);
      expect(updated.thirdPlaceMatch.player2Id).toBe('d');
    });

    it('updates the third place match itself when it is the completed bracket entry', () => {
      const result = (service as any).advanceBracket(baseBracket(), 'THIRD', 'x', 'y', 'CLOCK_WIN');
      expect(result.thirdPlaceMatch).toMatchObject({ winnerId: 'x', loserId: 'y', tiebreakResult: 'CLOCK_WIN' });
    });
  });

  describe('tryAdvanceRound (private)', () => {
    it('returns early when there is no bracketData or the tournament is not in progress', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', bracketData: null, status: TournamentStatus.IN_PROGRESS });
      await (service as any).tryAdvanceRound('t1');
      expect(tournamentMatches.save).not.toHaveBeenCalled();

      tournaments.findOne.mockResolvedValue({ id: 't1', bracketData: {}, status: TournamentStatus.FINISHED });
      await (service as any).tryAdvanceRound('t1');
      expect(tournamentMatches.save).not.toHaveBeenCalled();
    });

    it('does nothing while matches in the current round are still pending', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.IN_PROGRESS,
        bracketData: {
          totalRounds: 1,
          rounds: [{
            roundNumber: 1, phase: TournamentPhase.FINAL,
            matches: [{ bracketId: 'R1M0', player1Id: 'a', player2Id: 'b', winnerId: null, loserId: null, matchId: 'm1', tiebreakResult: null }],
          }],
          thirdPlaceMatch: null,
        },
      });
      await (service as any).tryAdvanceRound('t1');
      expect(tournamentMatches.save).not.toHaveBeenCalled();
    });

    it('creates the next round matches once all current-round matches are complete', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.IN_PROGRESS, name: 'X', timeControl: '10+0',
        bracketData: {
          totalRounds: 2,
          rounds: [
            { roundNumber: 1, phase: TournamentPhase.ROUND_1, matches: [{ bracketId: 'R1M0', player1Id: 'a', player2Id: 'b', winnerId: 'a', loserId: 'b', matchId: 'm1', tiebreakResult: null }] },
            { roundNumber: 2, phase: TournamentPhase.FINAL, matches: [{ bracketId: 'R2M0', player1Id: 'a', player2Id: 'c', winnerId: null, loserId: null, matchId: null, tiebreakResult: null }] },
          ],
          thirdPlaceMatch: null,
        },
      });
      matchesSvc.createMatch.mockResolvedValue({ id: 'match2' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      await (service as any).tryAdvanceRound('t1');

      expect(matchesSvc.createMatch).toHaveBeenCalledWith('a', 'c');
      expect(tournamentMatches.save).toHaveBeenCalled();
    });

    it('creates the third place match when advancing into the final and both semi losers are known', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.IN_PROGRESS, name: 'X', timeControl: '10+0',
        bracketData: {
          totalRounds: 2,
          rounds: [
            { roundNumber: 1, phase: TournamentPhase.SEMIFINAL, matches: [{ bracketId: 'SF0', player1Id: 'a', player2Id: 'b', winnerId: 'a', loserId: 'b', matchId: 'm1', tiebreakResult: null }] },
            { roundNumber: 2, phase: TournamentPhase.FINAL, matches: [{ bracketId: 'R2M0', player1Id: 'a', player2Id: null, winnerId: null, loserId: null, matchId: null, tiebreakResult: null }] },
          ],
          thirdPlaceMatch: { bracketId: 'THIRD', player1Id: 'b', player2Id: 'd', winnerId: null, loserId: null, matchId: null, tiebreakResult: null },
        },
      });
      matchesSvc.createMatch.mockResolvedValue({ id: 'match3' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      await (service as any).tryAdvanceRound('t1');

      expect(matchesSvc.createMatch).toHaveBeenCalledWith('b', 'd');
    });
  });

  describe('createThirdPlaceMatch (private)', () => {
    it('does nothing when the third place match is missing required players', async () => {
      const bracket: any = { thirdPlaceMatch: { bracketId: 'THIRD', player1Id: null, player2Id: 'b' } };
      await (service as any).createThirdPlaceMatch({ id: 't1' }, bracket);
      expect(matchesSvc.createMatch).not.toHaveBeenCalled();
    });

    it('does nothing when the third place match already has a matchId', async () => {
      const bracket: any = { thirdPlaceMatch: { bracketId: 'THIRD', player1Id: 'a', player2Id: 'b', matchId: 'existing' } };
      await (service as any).createThirdPlaceMatch({ id: 't1' }, bracket);
      expect(matchesSvc.createMatch).not.toHaveBeenCalled();
    });

    it('creates the match and persists the bracket', async () => {
      const bracket: any = { thirdPlaceMatch: { bracketId: 'THIRD', player1Id: 'a', player2Id: 'b', matchId: null } };
      matchesSvc.createMatch.mockResolvedValue({ id: 'match-third' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      await (service as any).createThirdPlaceMatch({ id: 't1', timeControl: '10+0' }, bracket);

      expect(tournamentMatches.save).toHaveBeenCalled();
      expect(tournaments.update).toHaveBeenCalledWith('t1', { bracketData: bracket });
    });
  });

  describe('createFinalAndThirdPlace (private, currently unused helper)', () => {
    it('creates the final match and the third place match when ready', async () => {
      const bracket: any = {
        rounds: [{ roundNumber: 1, matches: [{ bracketId: 'FINAL', player1Id: 'a', player2Id: 'b', matchId: null }] }],
        thirdPlaceMatch: { bracketId: 'THIRD', player1Id: 'c', player2Id: 'd', matchId: null },
      };
      matchesSvc.createMatch.mockResolvedValue({ id: 'match-final' } as any);
      users.findOne.mockResolvedValue({ id: 'u', nickname: 'X', rating: 1000, avatarUrl: null });

      await (service as any).createFinalAndThirdPlace({ id: 't1', timeControl: '10+0' }, bracket);

      expect(matchesSvc.createMatch).toHaveBeenCalledWith('a', 'b');
      expect(matchesSvc.createMatch).toHaveBeenCalledWith('c', 'd');
      expect(tournaments.update).toHaveBeenCalledWith('t1', { bracketData: bracket });
    });

    it('skips creating the final match when it already has a matchId', async () => {
      const bracket: any = {
        rounds: [{ roundNumber: 1, matches: [{ bracketId: 'FINAL', player1Id: 'a', player2Id: 'b', matchId: 'existing' }] }],
        thirdPlaceMatch: null,
      };

      await (service as any).createFinalAndThirdPlace({ id: 't1', timeControl: '10+0' }, bracket);

      expect(matchesSvc.createMatch).not.toHaveBeenCalled();
    });
  });

  describe('checkAndFinalizeTournament (private)', () => {
    it('returns early when the tournament has no bracketData', async () => {
      tournaments.findOne.mockResolvedValue({ id: 't1', bracketData: null });
      await (service as any).checkAndFinalizeTournament('t1');
      expect(tournaments.update).not.toHaveBeenCalled();
    });

    it('returns early when the tournament is not in progress (already finalized)', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.FINISHED,
        bracketData: { rounds: [{ matches: [{ winnerId: 'a' }] }], thirdPlaceMatch: null },
      });
      await (service as any).checkAndFinalizeTournament('t1');
      expect(tournaments.update).not.toHaveBeenCalled();
    });

    it('returns early when the final has not finished yet', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.IN_PROGRESS,
        bracketData: { rounds: [{ matches: [{ winnerId: null }] }], thirdPlaceMatch: null },
      });
      await (service as any).checkAndFinalizeTournament('t1');
      expect(tournaments.update).not.toHaveBeenCalled();
    });

    it('returns early when the third place match has not finished yet', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.IN_PROGRESS,
        bracketData: {
          rounds: [{ matches: [{ winnerId: 'a', loserId: 'b' }] }],
          thirdPlaceMatch: { winnerId: null },
        },
      });
      await (service as any).checkAndFinalizeTournament('t1');
      expect(tournaments.update).not.toHaveBeenCalled();
    });

    it('finalizes standings and triggers fraud analysis when both final and third place are done', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.IN_PROGRESS,
        bracketData: {
          rounds: [{ matches: [{ winnerId: 'champ', loserId: 'second' }] }],
          thirdPlaceMatch: { winnerId: 'third' },
        },
      });
      deepseek.analyze.mockResolvedValue({ verdict: 'CLEAN', reason: 'ok' });
      tournamentMatches.find.mockResolvedValue([]);

      await (service as any).checkAndFinalizeTournament('t1');

      expect(tournaments.update).toHaveBeenCalledWith('t1', expect.objectContaining({
        championId: 'champ', secondPlaceId: 'second', thirdPlaceId: 'third', aiFraudStatus: 'PENDING',
      }));
      expect(participants.update).toHaveBeenCalledWith({ tournamentId: 't1', userId: 'champ' }, { status: ParticipantStatus.CHAMPION });
    });

    it('treats a missing third place match as already done (4-player tournaments)', async () => {
      tournaments.findOne.mockResolvedValue({
        id: 't1', status: TournamentStatus.IN_PROGRESS,
        bracketData: {
          rounds: [{ matches: [{ winnerId: 'champ', loserId: 'second' }] }],
          thirdPlaceMatch: null,
        },
      });
      deepseek.analyze.mockResolvedValue({ verdict: 'CLEAN', reason: 'ok' });
      tournamentMatches.find.mockResolvedValue([]);

      await (service as any).checkAndFinalizeTournament('t1');

      expect(tournaments.update).toHaveBeenCalledWith('t1', expect.objectContaining({ championId: 'champ' }));
    });
  });

  describe('runFraudAnalysisWithTimeout (private)', () => {
    afterEach(() => jest.useRealTimers());

    it('approves and distributes prizes when the AI verdict is CLEAN', async () => {
      deepseek.analyze.mockResolvedValue({ verdict: 'CLEAN', reason: 'ok' });
      tournamentMatches.find.mockResolvedValue([
        { moveTimestamps: [{ san: 'e4', elapsedMs: 500 }], clockWhiteMs: 1000, clockBlackMs: 2000 },
      ]);
      tournaments.findOne.mockResolvedValue({
        id: 't1', maxPlayers: 4, entryFeeCc: 10, name: 'X', championId: 'champ',
        secondPlaceId: 'second', thirdPlaceId: null, rakeCc: 0,
      });

      await (service as any).runFraudAnalysisWithTimeout({ id: 't1', name: 'X' });

      expect(tournaments.update).toHaveBeenCalledWith('t1', { aiFraudStatus: 'APPROVED' });
      expect(wallet.credit).toHaveBeenCalled();
    });

    it('flags the tournament and notifies winners when the AI verdict is CHEATING', async () => {
      deepseek.analyze.mockResolvedValue({ verdict: 'CHEATING', reason: 'suspicious' });
      tournamentMatches.find.mockResolvedValue([]);
      tournaments.findOne.mockResolvedValue({
        id: 't1', championId: 'champ', secondPlaceId: 'second', thirdPlaceId: 'third',
      });

      await (service as any).runFraudAnalysisWithTimeout({ id: 't1', name: 'X' });

      expect(tournaments.update).toHaveBeenCalledWith('t1', { aiFraudStatus: 'FLAGGED' });
      expect(notifications.create).toHaveBeenCalledWith('champ', expect.anything(), expect.objectContaining({ tournamentId: 't1' }));
      expect(notifications.create).toHaveBeenCalledWith('second', expect.anything(), expect.objectContaining({ tournamentId: 't1' }));
      expect(notifications.create).toHaveBeenCalledWith('third', expect.anything(), expect.objectContaining({ tournamentId: 't1' }));
    });

    it('falls back to CLEAN (auto-approve) when DeepSeek is unavailable', async () => {
      deepseek.analyze.mockResolvedValue(null);
      tournamentMatches.find.mockResolvedValue([]);
      tournaments.findOne.mockResolvedValue({ id: 't1', maxPlayers: 4, entryFeeCc: 10, name: 'X', rakeCc: 0 });

      await (service as any).runFraudAnalysisWithTimeout({ id: 't1', name: 'X' });

      expect(tournaments.update).toHaveBeenCalledWith('t1', { aiFraudStatus: 'APPROVED' });
    });

    it('leaves the timeout callback registered when the analysis throws, and it auto-releases prizes when fired', async () => {
      const originalSetTimeout = global.setTimeout;
      let capturedCb: (() => Promise<void> | void) | null = null;
      (global as any).setTimeout = ((fn: any) => { capturedCb = fn; return 0 as any; }) as any;

      tournamentMatches.find.mockRejectedValue(new Error('db down'));
      tournaments.findOne.mockResolvedValue({ id: 't1', maxPlayers: 4, entryFeeCc: 10, name: 'X', rakeCc: 0 });

      await (service as any).runFraudAnalysisWithTimeout({ id: 't1', name: 'X' });
      (global as any).setTimeout = originalSetTimeout;

      expect(capturedCb).not.toBeNull();
      await capturedCb!();

      expect(tournaments.update).toHaveBeenCalledWith('t1', { aiFraudStatus: 'TIMEOUT' });
    });

    it('auto-releases prizes via the timeout branch when analysis never resolves in time', async () => {
      const originalSetTimeout = global.setTimeout;
      let capturedCb: (() => Promise<void> | void) | null = null;
      (global as any).setTimeout = ((fn: any) => { capturedCb = fn; return 0 as any; }) as any;

      deepseek.analyze.mockReturnValue(new Promise(() => {})); // never resolves
      tournamentMatches.find.mockResolvedValue([]);
      tournaments.findOne.mockResolvedValue({ id: 't1', maxPlayers: 4, entryFeeCc: 10, name: 'X', rakeCc: 0 });

      // Fire-and-forget: the analyze() promise never resolves, so the outer
      // runFraudAnalysisWithTimeout promise never settles either — only the
      // timeout branch (invoked manually below) completes.
      void (service as any).runFraudAnalysisWithTimeout({ id: 't1', name: 'X' });
      // let the microtask queue settle so the timeout is registered before we invoke it
      await Promise.resolve();
      await Promise.resolve();
      (global as any).setTimeout = originalSetTimeout;

      expect(capturedCb).not.toBeNull();
      await capturedCb!();

      expect(tournaments.update).toHaveBeenCalledWith('t1', { aiFraudStatus: 'TIMEOUT' });
    });
  });

  describe('parseAiFraudVerdict (private)', () => {
    it('parses each valid verdict value', () => {
      expect((service as any).parseAiFraudVerdict(JSON.stringify({ verdict: 'CLEAN' }))).toBe('CLEAN');
      expect((service as any).parseAiFraudVerdict(JSON.stringify({ verdict: 'SUSPICIOUS' }))).toBe('SUSPICIOUS');
      expect((service as any).parseAiFraudVerdict(JSON.stringify({ verdict: 'CHEATING' }))).toBe('CHEATING');
    });

    it('falls back to CLEAN for invalid JSON', () => {
      expect((service as any).parseAiFraudVerdict('not json')).toBe('CLEAN');
    });

    it('falls back to CLEAN for an unrecognized verdict value', () => {
      expect((service as any).parseAiFraudVerdict(JSON.stringify({ verdict: 'MAYBE' }))).toBe('CLEAN');
    });
  });

  describe('distributeTournamentPrizes (private)', () => {
    it('returns early when the tournament no longer exists', async () => {
      tournaments.findOne.mockResolvedValue(null);
      await (service as any).distributeTournamentPrizes('t1', 'approved');
      expect(wallet.credit).not.toHaveBeenCalled();
    });

    it('skips awards with no winner or zero amount, and records rake revenue', async () => {
      tournaments.findOne
        .mockResolvedValueOnce({
          id: 't1', maxPlayers: 4, entryFeeCc: 10, name: 'X', rakeCc: 4,
          championId: 'champ', secondPlaceId: null, thirdPlaceId: null,
        })
        .mockResolvedValueOnce({ id: 't1', rakeCc: 4, name: 'X', maxPlayers: 4 });

      await (service as any).distributeTournamentPrizes('t1', 'approved');

      expect(wallet.credit).toHaveBeenCalledTimes(1);
      expect(platformRevenue.record).toHaveBeenCalled();
      expect(tournaments.update).toHaveBeenCalledWith('t1', { status: TournamentStatus.FINISHED });
    });

    it('notifies the tournament room when a finishedEmitter is registered', async () => {
      tournaments.findOne
        .mockResolvedValueOnce({
          id: 't1', maxPlayers: 4, entryFeeCc: 10, name: 'X', rakeCc: 0,
          championId: null, secondPlaceId: null, thirdPlaceId: null,
        })
        .mockResolvedValueOnce({ id: 't1', rakeCc: 0, name: 'X', maxPlayers: 4 })
        .mockResolvedValueOnce({ id: 't1', participants: [] });
      const finishedEmitter = jest.fn();
      service.tournamentFinishedEmitter = finishedEmitter;

      await (service as any).distributeTournamentPrizes('t1', 'approved');

      expect(finishedEmitter).toHaveBeenCalledWith('t1', expect.anything());
    });
  });

  describe('listTournaments — visibility filter', () => {
    it('filters for private tournaments when isPublic is false', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      tournaments.createQueryBuilder.mockReturnValue(qb);

      await service.listTournaments({ isPublic: false } as any);

      expect(qb.andWhere).toHaveBeenCalledWith('t.isPrivate = true');
    });

    it('leaves isUserJoined undefined when no requesting user is provided', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 't1', maxPlayers: 4, entryFeeCc: 10, participants: [] }], 1]),
      };
      tournaments.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listTournaments({} as any);

      expect(result.items[0].isUserJoined).toBeUndefined();
    });
  });

  describe('runStagnationCleanup (private)', () => {
    it('auto-cancels tournaments stale for more than 48h and notifies participants', async () => {
      const old = new Date(Date.now() - 49 * 60 * 60 * 1000);
      tournaments.find.mockResolvedValue([{ id: 't1', createdAt: old, name: 'X' }]);
      participants.find.mockResolvedValue([{ userId: 'u1' }]);

      await (service as any).runStagnationCleanup();

      expect(tournaments.update).toHaveBeenCalledWith('t1', { status: TournamentStatus.CANCELLED });
      expect(notifications.create).toHaveBeenCalledWith('u1', expect.anything(), expect.objectContaining({ tournamentId: 't1' }));
    });

    it('notifies the creator once after 24h of inactivity without cancelling', async () => {
      const almostStale = new Date(Date.now() - 25 * 60 * 60 * 1000);
      tournaments.find.mockResolvedValue([{ id: 't1', createdAt: almostStale, name: 'X', creatorId: 'creator1' }]);

      await (service as any).runStagnationCleanup();

      expect(tournaments.update).not.toHaveBeenCalled();
      expect(notifications.create).toHaveBeenCalledWith('creator1', expect.anything(), expect.objectContaining({ tournamentId: 't1' }));
    });

    it('does nothing for recently created tournaments', async () => {
      tournaments.find.mockResolvedValue([{ id: 't1', createdAt: new Date(), name: 'X', creatorId: 'creator1' }]);

      await (service as any).runStagnationCleanup();

      expect(tournaments.update).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('skips the creator notification when there is no creatorId', async () => {
      const almostStale = new Date(Date.now() - 25 * 60 * 60 * 1000);
      tournaments.find.mockResolvedValue([{ id: 't1', createdAt: almostStale, name: 'X', creatorId: null }]);

      await (service as any).runStagnationCleanup();

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket emit helpers (private)', () => {
    it('emitBracketUpdate calls the emitter only when registered', () => {
      (service as any).emitBracketUpdate('t1', { totalRounds: 1 });
      const emitter = jest.fn();
      service.bracketUpdateEmitter = emitter;
      (service as any).emitBracketUpdate('t1', { totalRounds: 1 });
      expect(emitter).toHaveBeenCalledWith('t1', { totalRounds: 1 });
    });

    it('emitMatchFound calls the emitter only when registered', () => {
      (service as any).emitMatchFound('a', 'b', 'm1', {});
      const emitter = jest.fn();
      service.matchFoundEmitter = emitter;
      (service as any).emitMatchFound('a', 'b', 'm1', {});
      expect(emitter).toHaveBeenCalledWith('a', 'b', 'm1', {});
    });

    it('emitTournamentRoomUpdate calls the room emitter only when registered', () => {
      (service as any).emitTournamentRoomUpdate('t1', { type: 'X' });
      const emitter = jest.fn();
      (service as any)._roomUpdateEmitter = emitter;
      (service as any).emitTournamentRoomUpdate('t1', { type: 'X' });
      expect(emitter).toHaveBeenCalledWith('t1', { type: 'X' });
    });
  });

  describe('isPowerOfTwo (private)', () => {
    it('identifies non powers of two and non-positive numbers as invalid', () => {
      expect((service as any).isPowerOfTwo(4)).toBe(true);
      expect((service as any).isPowerOfTwo(3)).toBe(false);
      expect((service as any).isPowerOfTwo(0)).toBe(false);
    });
  });
});
