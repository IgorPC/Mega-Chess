import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';
import { TournamentType } from '../entities/tournament.entity';

describe('MatchmakingController', () => {
  let controller: MatchmakingController;
  let service: jest.Mocked<MatchmakingService>;
  const user = { id: 'user-1' };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MatchmakingController],
      providers: [
        {
          provide: MatchmakingService,
          useValue: {
            getActiveMatch: jest.fn(),
            getQueueSizes: jest.fn(),
            joinQueue: jest.fn(),
            leaveQueue: jest.fn(),
            joinDuelQueue: jest.fn(),
            leaveDuelQueue: jest.fn(),
            sendChallenge: jest.fn(),
            acceptChallenge: jest.fn(),
            denyChallenge: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(MatchmakingController);
    service = module.get(MatchmakingService);
  });

  describe('activeMatch', () => {
    it('returns the active match for the current user', async () => {
      service.getActiveMatch.mockResolvedValue({ matchId: 'm1', color: 'white' } as any);
      const result = await controller.activeMatch(user);
      expect(service.getActiveMatch).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ matchId: 'm1', color: 'white' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getActiveMatch.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.activeMatch(user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getActiveMatch.mockRejectedValue(new Error('db down'));
      await expect(controller.activeMatch(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a thrown non-Error value as a 500 too', async () => {
      service.getActiveMatch.mockRejectedValue('a plain string rejection');
      await expect(controller.activeMatch(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getSizes', () => {
    it('returns the current queue sizes', async () => {
      service.getQueueSizes.mockReturnValue({ casual: 3, duel: {} } as any);
      const result = await controller.getSizes();
      expect(result).toEqual({ casual: 3, duel: {} });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getQueueSizes.mockImplementation(() => { throw new NotFoundException('nope'); });
      await expect(controller.getSizes()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getQueueSizes.mockImplementation(() => { throw new Error('boom'); });
      await expect(controller.getSizes()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a thrown non-Error value as a 500 too', async () => {
      service.getQueueSizes.mockImplementation(() => { throw 'plain string'; });
      await expect(controller.getSizes()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('joinQueue', () => {
    it('delegates to the service for the current user', async () => {
      service.joinQueue.mockResolvedValue({ status: 'queued' });
      const result = await controller.joinQueue(user);
      expect(service.joinQueue).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ status: 'queued' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.joinQueue.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.joinQueue(user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.joinQueue.mockRejectedValue(new Error('boom'));
      await expect(controller.joinQueue(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a thrown non-Error value as a 500 too', async () => {
      service.joinQueue.mockRejectedValue('plain string');
      await expect(controller.joinQueue(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('leaveQueue', () => {
    it('delegates to the service for the current user', async () => {
      service.leaveQueue.mockReturnValue({ status: 'left' } as any);
      const result = await controller.leaveQueue(user);
      expect(service.leaveQueue).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ status: 'left' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.leaveQueue.mockImplementation(() => { throw new NotFoundException('nope'); });
      await expect(controller.leaveQueue(user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.leaveQueue.mockImplementation(() => { throw new Error('boom'); });
      await expect(controller.leaveQueue(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a thrown non-Error value as a 500 too', async () => {
      service.leaveQueue.mockImplementation(() => { throw 'plain string'; });
      await expect(controller.leaveQueue(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('joinDuelQueue', () => {
    it('delegates the type and entry fee to the service', async () => {
      service.joinDuelQueue.mockResolvedValue({ status: 'queued' });
      const result = await controller.joinDuelQueue(user, TournamentType.DUEL_FLASH, 6);
      expect(service.joinDuelQueue).toHaveBeenCalledWith('user-1', TournamentType.DUEL_FLASH, 6);
      expect(result).toEqual({ status: 'queued' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.joinDuelQueue.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.joinDuelQueue(user, TournamentType.DUEL_FLASH, 6)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.joinDuelQueue.mockRejectedValue(new Error('boom'));
      await expect(controller.joinDuelQueue(user, TournamentType.DUEL_FLASH, 6)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.joinDuelQueue.mockRejectedValue('plain string');
      await expect(controller.joinDuelQueue(user, TournamentType.DUEL_FLASH, 6)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('leaveDuelQueue', () => {
    it('delegates to the service for the current user', async () => {
      service.leaveDuelQueue.mockReturnValue({ status: 'left' } as any);
      const result = await controller.leaveDuelQueue(user);
      expect(service.leaveDuelQueue).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ status: 'left' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.leaveDuelQueue.mockImplementation(() => { throw new NotFoundException('nope'); });
      await expect(controller.leaveDuelQueue(user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.leaveDuelQueue.mockImplementation(() => { throw new Error('boom'); });
      await expect(controller.leaveDuelQueue(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a thrown non-Error value as a 500 too', async () => {
      service.leaveDuelQueue.mockImplementation(() => { throw 'plain string'; });
      await expect(controller.leaveDuelQueue(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('sendChallenge', () => {
    it('delegates challenger and challenged ids to the service', async () => {
      service.sendChallenge.mockResolvedValue({ status: 'sent' });
      const result = await controller.sendChallenge(user, 'target-1');
      expect(service.sendChallenge).toHaveBeenCalledWith('user-1', 'target-1');
      expect(result).toEqual({ status: 'sent' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.sendChallenge.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.sendChallenge(user, 'target-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.sendChallenge.mockRejectedValue(new Error('boom'));
      await expect(controller.sendChallenge(user, 'target-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.sendChallenge.mockRejectedValue('plain string');
      await expect(controller.sendChallenge(user, 'target-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('acceptChallenge', () => {
    it('delegates to the service with the challenger id', async () => {
      service.acceptChallenge.mockResolvedValue({ status: 'matched', matchId: 'm1' });
      const result = await controller.acceptChallenge(user, 'challenger-1');
      expect(service.acceptChallenge).toHaveBeenCalledWith('user-1', 'challenger-1');
      expect(result).toEqual({ status: 'matched', matchId: 'm1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.acceptChallenge.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.acceptChallenge(user, 'challenger-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.acceptChallenge.mockRejectedValue(new Error('boom'));
      await expect(controller.acceptChallenge(user, 'challenger-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.acceptChallenge.mockRejectedValue('plain string');
      await expect(controller.acceptChallenge(user, 'challenger-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('denyChallenge', () => {
    it('delegates to the service with the challenger id', async () => {
      service.denyChallenge.mockResolvedValue({ status: 'denied' });
      const result = await controller.denyChallenge(user, 'challenger-1');
      expect(service.denyChallenge).toHaveBeenCalledWith('user-1', 'challenger-1');
      expect(result).toEqual({ status: 'denied' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.denyChallenge.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.denyChallenge(user, 'challenger-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.denyChallenge.mockRejectedValue(new Error('boom'));
      await expect(controller.denyChallenge(user, 'challenger-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.denyChallenge.mockRejectedValue('plain string');
      await expect(controller.denyChallenge(user, 'challenger-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
