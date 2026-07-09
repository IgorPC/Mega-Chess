import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: jest.Mocked<ReviewsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: { create: jest.fn(), getPending: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(ReviewsController);
    service = module.get(ReviewsService);
  });

  describe('create', () => {
    const dto: CreateReviewDto = { matchId: 'm-1', reviewedId: 'user-2', rating: 5, comment: 'great game' };

    it('delegates to the service with the current user id and dto', async () => {
      service.create.mockResolvedValue({ id: 'r-1' } as any);
      const result = await controller.create({ id: 'user-1' }, dto);
      expect(service.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual({ id: 'r-1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.create.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.create({ id: 'user-1' }, dto)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.create.mockRejectedValue(new Error('boom'));
      await expect(controller.create({ id: 'user-1' }, dto)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.create.mockRejectedValue('plain string');
      await expect(controller.create({ id: 'user-1' }, dto)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getPending', () => {
    it('returns pending reviews for the current user', async () => {
      service.getPending.mockResolvedValue([{ matchId: 'm-1' }] as any);
      const result = await controller.getPending({ id: 'user-1' });
      expect(service.getPending).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ matchId: 'm-1' }]);
    });

    it('wraps an unexpected error as a 500 (even for HttpException, per current implementation)', async () => {
      service.getPending.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getPending({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a generic unexpected error as a 500', async () => {
      service.getPending.mockRejectedValue(new Error('boom'));
      await expect(controller.getPending({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getPending.mockRejectedValue('plain string');
      await expect(controller.getPending({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
