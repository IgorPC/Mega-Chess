import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReferralsService } from './referrals.service';
import { ReferralsRepository } from './referrals.repository';
import { PlatformConfigService } from '../platform-config/platform-config.service';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let repo: jest.Mocked<ReferralsRepository>;
  let platformConfig: jest.Mocked<PlatformConfigService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReferralsService,
        {
          provide: ReferralsRepository,
          useValue: {
            findReferralsByReferrer: jest.fn(),
            findUserNickname: jest.fn(),
            findEarnings: jest.fn(),
            findUserWithReferralCode: jest.fn(),
            findUserByReferralCode: jest.fn(),
            updateReferralCode: jest.fn(),
          },
        },
        {
          provide: PlatformConfigService,
          useValue: { getBoolean: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReferralsService);
    repo = module.get(ReferralsRepository);
    platformConfig = module.get(PlatformConfigService);
    config = module.get(ConfigService);
  });

  describe('getMyReferrals', () => {
    it('throws ForbiddenException when referrals are disabled', async () => {
      platformConfig.getBoolean.mockResolvedValue(false);
      await expect(service.getMyReferrals('u1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.findReferralsByReferrer).not.toHaveBeenCalled();
    });

    it('returns an empty list with zero total when there are no referrals', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      repo.findReferralsByReferrer.mockResolvedValue([]);
      const result = await service.getMyReferrals('u1');
      expect(result).toEqual({ referrals: [], totalEarned: 0 });
    });

    it('aggregates referral nicknames and earnings', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      repo.findReferralsByReferrer.mockResolvedValue([
        { referredId: 'r1', isEligible: true } as any,
        { referredId: 'r2', isEligible: false } as any,
      ]);
      repo.findUserNickname.mockImplementation(async (id: string) =>
        id === 'r1' ? ({ nickname: 'alice' } as any) : null,
      );
      repo.findEarnings.mockImplementation(async (_referrer: string, referred: string) =>
        referred === 'r1' ? ([{ amount: '10.5' }, { amount: '5' }] as any) : ([] as any),
      );

      const result = await service.getMyReferrals('u1');

      expect(result.referrals).toEqual([
        { nickname: 'alice', isEligible: true, totalEarned: 15.5 },
        { nickname: 'Usuário removido', isEligible: false, totalEarned: 0 },
      ]);
      expect(result.totalEarned).toBe(15.5);
    });
  });

  describe('getMyCode', () => {
    it('throws ForbiddenException when referrals are disabled', async () => {
      platformConfig.getBoolean.mockResolvedValue(false);
      await expect(service.getMyCode('u1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns null code and link when the user does not exist', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      repo.findUserWithReferralCode.mockResolvedValue(null);
      config.get.mockReturnValue('https://megachess.io');
      const result = await service.getMyCode('missing');
      expect(result).toEqual({ referralCode: null, link: null });
    });

    it('returns the existing code and link without generating a new one', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      repo.findUserWithReferralCode.mockResolvedValue({ id: 'u1', referralCode: 'EXIST123' } as any);
      config.get.mockReturnValue('https://megachess.io');

      const result = await service.getMyCode('u1');

      expect(repo.updateReferralCode).not.toHaveBeenCalled();
      expect(result).toEqual({
        referralCode: 'EXIST123',
        link: 'https://megachess.io/register?ref=EXIST123',
      });
    });

    it('generates and persists a new code when the user has none', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      repo.findUserWithReferralCode.mockResolvedValue({ id: 'u1', referralCode: null } as any);
      repo.findUserByReferralCode.mockResolvedValue(null);
      config.get.mockReturnValue('https://megachess.io');

      const result = await service.getMyCode('u1');

      expect(repo.updateReferralCode).toHaveBeenCalledWith('u1', expect.any(String));
      expect(result.referralCode).toEqual(expect.any(String));
      expect(result.link).toContain('https://megachess.io/register?ref=');
    });

    it('retries generation when a collision occurs and eventually succeeds', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      repo.findUserWithReferralCode.mockResolvedValue({ id: 'u1', referralCode: null } as any);
      repo.findUserByReferralCode
        .mockResolvedValueOnce({ id: 'other' } as any)
        .mockResolvedValueOnce(null);
      config.get.mockReturnValue('https://megachess.io');

      const result = await service.getMyCode('u1');

      expect(repo.findUserByReferralCode).toHaveBeenCalledTimes(2);
      expect(repo.updateReferralCode).toHaveBeenCalledWith('u1', expect.any(String));
      expect(result.referralCode).toEqual(expect.any(String));
    });

    it('uses the default APP_URL fallback when config has none', async () => {
      platformConfig.getBoolean.mockResolvedValue(true);
      repo.findUserWithReferralCode.mockResolvedValue({ id: 'u1', referralCode: 'ABC12345' } as any);
      config.get.mockImplementation((_key: string, fallback?: string) => fallback);

      const result = await service.getMyCode('u1');

      expect(result.link).toBe('https://megachess.io/register?ref=ABC12345');
    });
  });
});
