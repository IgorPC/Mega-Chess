import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminReferralsController } from './admin-referrals.controller';
import { AdminReferralsService } from './admin-referrals.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';

describe('AdminReferralsController', () => {
  let controller: AdminReferralsController;
  let service: jest.Mocked<AdminReferralsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminReferralsController],
      providers: [
        { provide: AdminReferralsService, useValue: { list: jest.fn(), stats: jest.fn() } },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminRolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminReferralsController);
    service = module.get(AdminReferralsService);
  });

  describe('list', () => {
    it('applies defaults when no query params are given', async () => {
      service.list.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
      await controller.list(undefined, undefined, undefined, undefined);
      expect(service.list).toHaveBeenCalledWith({
        page: 1,
        limit: 25,
        referrerId: undefined,
        isEligible: undefined,
      });
    });

    it('parses provided query params', async () => {
      service.list.mockResolvedValue({ items: [], total: 0, page: 2, totalPages: 0 });
      await controller.list('2', '10', 'ref-1', 'true');
      expect(service.list).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        referrerId: 'ref-1',
        isEligible: true,
      });
    });

    it('treats isEligible=false as an explicit filter', async () => {
      service.list.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
      await controller.list(undefined, undefined, undefined, 'false');
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ isEligible: false }),
      );
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.list.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.list(undefined, undefined, undefined, undefined)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('wraps an unexpected error as a 500', async () => {
      service.list.mockRejectedValue(new Error('db down'));
      await expect(controller.list(undefined, undefined, undefined, undefined)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('stats', () => {
    it('forwards the period to the service', async () => {
      service.stats.mockResolvedValue({ totalEarned: 10, totalPayments: 2 });
      await controller.stats('30d');
      expect(service.stats).toHaveBeenCalledWith('30d');
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.stats.mockRejectedValue(new NotFoundException());
      await expect(controller.stats(undefined)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.stats.mockRejectedValue(new Error('boom'));
      await expect(controller.stats(undefined)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
