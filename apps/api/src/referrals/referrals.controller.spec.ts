import { Test } from '@nestjs/testing';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('ReferralsController', () => {
  let controller: ReferralsController;
  let service: jest.Mocked<ReferralsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReferralsController],
      providers: [
        { provide: ReferralsService, useValue: { getMyReferrals: jest.fn(), getMyCode: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ReferralsController);
    service = module.get(ReferralsService);
  });

  describe('getMyReferrals', () => {
    it('delegates to the service with the current user id', async () => {
      service.getMyReferrals.mockResolvedValue({ referrals: [], totalEarned: 0 });
      const result = await controller.getMyReferrals({ id: 'user-1' });
      expect(service.getMyReferrals).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ referrals: [], totalEarned: 0 });
    });
  });

  describe('getMyCode', () => {
    it('delegates to the service with the current user id', async () => {
      service.getMyCode.mockResolvedValue({ referralCode: 'ABC12345', link: 'https://megachess.io/register?ref=ABC12345' });
      const result = await controller.getMyCode({ id: 'user-1' });
      expect(service.getMyCode).toHaveBeenCalledWith('user-1');
      expect(result.referralCode).toBe('ABC12345');
    });
  });
});
