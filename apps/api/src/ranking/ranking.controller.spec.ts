import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';

describe('RankingController', () => {
  let controller: RankingController;
  let service: jest.Mocked<RankingService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [RankingController],
      providers: [
        {
          provide: RankingService,
          useValue: { getTopPlayers: jest.fn(), getUserRank: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(RankingController);
    service = module.get(RankingService);
  });

  describe('getTop', () => {
    it('defaults to the weekly period when none is provided', async () => {
      service.getTopPlayers.mockResolvedValue([]);
      await controller.getTop(undefined as any);
      expect(service.getTopPlayers).toHaveBeenCalledWith('week');
    });

    it('forwards an explicit period', async () => {
      service.getTopPlayers.mockResolvedValue([]);
      await controller.getTop('month');
      expect(service.getTopPlayers).toHaveBeenCalledWith('month');
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.getTopPlayers.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getTop('week')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getTopPlayers.mockRejectedValue(new Error('db down'));
      await expect(controller.getTop('week')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getTopPlayers.mockRejectedValue('plain string');
      await expect(controller.getTop('week')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getMyRank', () => {
    it('returns the service result for the current user', async () => {
      service.getUserRank.mockResolvedValue({ position: 3, rating: 1400 });
      const result = await controller.getMyRank({ id: 'user-1' });
      expect(service.getUserRank).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ position: 3, rating: 1400 });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getUserRank.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getMyRank({ id: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getUserRank.mockRejectedValue(new Error('boom'));
      await expect(controller.getMyRank({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getUserRank.mockRejectedValue('plain string');
      await expect(controller.getMyRank({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
