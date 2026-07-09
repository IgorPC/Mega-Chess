import { InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { TournamentType } from '../entities/tournament.entity';

describe('TournamentsController', () => {
  let controller: TournamentsController;
  let service: jest.Mocked<TournamentsService>;

  const user = { id: 'user-1' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TournamentsController],
      providers: [
        {
          provide: TournamentsService,
          useValue: {
            inviteFriend: jest.fn(),
            acceptDuelInvite: jest.fn(),
            declineDuelInvite: jest.fn(),
            getUserTournamentHistory: jest.fn(),
            getMatchTournamentDetails: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TournamentsController);
    service = module.get(TournamentsService);
  });

  describe('inviteDuel', () => {
    it('invites a friend to a duel', async () => {
      service.inviteFriend.mockResolvedValue({ tournamentId: 't1' } as any);
      const result = await controller.inviteDuel(user, { friendId: 'f1', type: TournamentType.DUEL_FLASH, entryFee: 6 } as any);
      expect(result).toEqual({ tournamentId: 't1' });
    });

    it('rethrows HttpException from service', async () => {
      service.inviteFriend.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.inviteDuel(user, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.inviteFriend.mockRejectedValue(new Error('boom'));
      await expect(controller.inviteDuel(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.inviteFriend.mockRejectedValue('plain string');
      await expect(controller.inviteDuel(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('acceptDuelInvite', () => {
    it('accepts the invite', async () => {
      service.acceptDuelInvite.mockResolvedValue({ status: 'matched' } as any);
      const result = await controller.acceptDuelInvite(user, 't1');
      expect(result).toEqual({ status: 'matched' });
    });

    it('rethrows HttpException from service', async () => {
      service.acceptDuelInvite.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.acceptDuelInvite(user, 't1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.acceptDuelInvite.mockRejectedValue(new Error('boom'));
      await expect(controller.acceptDuelInvite(user, 't1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.acceptDuelInvite.mockRejectedValue('plain string');
      await expect(controller.acceptDuelInvite(user, 't1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('declineDuelInvite', () => {
    it('declines the invite', async () => {
      service.declineDuelInvite.mockResolvedValue({ status: 'declined' } as any);
      const result = await controller.declineDuelInvite(user, 't1');
      expect(result).toEqual({ status: 'declined' });
    });

    it('rethrows HttpException from service', async () => {
      service.declineDuelInvite.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.declineDuelInvite(user, 't1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.declineDuelInvite.mockRejectedValue(new Error('boom'));
      await expect(controller.declineDuelInvite(user, 't1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.declineDuelInvite.mockRejectedValue('plain string');
      await expect(controller.declineDuelInvite(user, 't1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('stubbed custom-tournament endpoints', () => {
    it('list throws ServiceUnavailableException', () => {
      expect(() => controller.list()).toThrow(ServiceUnavailableException);
    });
    it('myTournaments throws ServiceUnavailableException', () => {
      expect(() => controller.myTournaments()).toThrow(ServiceUnavailableException);
    });
    it('create throws ServiceUnavailableException', () => {
      expect(() => controller.create()).toThrow(ServiceUnavailableException);
    });
    it('details throws ServiceUnavailableException', () => {
      expect(() => controller.details()).toThrow(ServiceUnavailableException);
    });
    it('join throws ServiceUnavailableException', () => {
      expect(() => controller.join()).toThrow(ServiceUnavailableException);
    });
    it('leave throws ServiceUnavailableException', () => {
      expect(() => controller.leave()).toThrow(ServiceUnavailableException);
    });
    it('start throws ServiceUnavailableException', () => {
      expect(() => controller.start()).toThrow(ServiceUnavailableException);
    });
    it('cancel throws ServiceUnavailableException', () => {
      expect(() => controller.cancel()).toThrow(ServiceUnavailableException);
    });
    it('inviteByNickname throws ServiceUnavailableException', () => {
      expect(() => controller.inviteByNickname()).toThrow(ServiceUnavailableException);
    });
    it('inviteFriend throws ServiceUnavailableException', () => {
      expect(() => controller.inviteFriend()).toThrow(ServiceUnavailableException);
    });
    it('kick throws ServiceUnavailableException', () => {
      expect(() => controller.kick()).toThrow(ServiceUnavailableException);
    });
  });

  describe('history', () => {
    it('returns paginated tournament history', async () => {
      service.getUserTournamentHistory.mockResolvedValue({ items: [] } as any);
      await controller.history(user, 1, 100);
      expect(service.getUserTournamentHistory).toHaveBeenCalledWith('user-1', 1, 50);
    });

    it('rethrows HttpException from service', async () => {
      service.getUserTournamentHistory.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.history(user, 1, 20)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.getUserTournamentHistory.mockRejectedValue(new Error('boom'));
      await expect(controller.history(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.getUserTournamentHistory.mockRejectedValue('plain string');
      await expect(controller.history(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('matchDetails', () => {
    it('returns match tournament details', async () => {
      service.getMatchTournamentDetails.mockResolvedValue({ id: 'tm1' } as any);
      const result = await controller.matchDetails('m1');
      expect(result).toEqual({ id: 'tm1' });
    });

    it('rethrows HttpException from service', async () => {
      service.getMatchTournamentDetails.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.matchDetails('m1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.getMatchTournamentDetails.mockRejectedValue(new Error('boom'));
      await expect(controller.matchDetails('m1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.getMatchTournamentDetails.mockRejectedValue('plain string');
      await expect(controller.matchDetails('m1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
