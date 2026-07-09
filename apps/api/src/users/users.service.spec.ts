import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../entities/user.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { Review } from '../entities/review.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { UserActivityService } from '../user-activity/user-activity.service';
import { WalletService } from '../wallet/wallet.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { TERMS_VERSION } from './consts/terms';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: jest.Mocked<Repository<User>>;
  let matchesRepo: jest.Mocked<Repository<Match>>;
  let reviewsRepo: jest.Mocked<Repository<Review>>;
  let refreshTokensRepo: jest.Mocked<Repository<RefreshToken>>;
  let activity: jest.Mocked<UserActivityService>;
  let wallet: jest.Mocked<WalletService>;
  let redis: any;

  const queryBuilderMock = () => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(Match),
          useValue: { findAndCount: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Review),
          useValue: { findAndCount: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: { delete: jest.fn() },
        },
        {
          provide: UserActivityService,
          useValue: { log: jest.fn() },
        },
        {
          provide: WalletService,
          useValue: { getBalance: jest.fn() },
        },
        {
          provide: REDIS_CLIENT,
          useValue: { del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    usersRepo = module.get(getRepositoryToken(User));
    matchesRepo = module.get(getRepositoryToken(Match));
    reviewsRepo = module.get(getRepositoryToken(Review));
    refreshTokensRepo = module.get(getRepositoryToken(RefreshToken));
    activity = module.get(UserActivityService);
    wallet = module.get(WalletService);
    redis = module.get(REDIS_CLIENT);
  });

  describe('findByNickname', () => {
    it('throws NotFoundException when user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.findByNickname('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the user without the passwordHash field', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', nickname: 'alice', passwordHash: 'secret' } as any);
      const result = await service.findByNickname('alice');
      expect(result).toEqual({ id: 'u1', nickname: 'alice' });
      expect((result as any).passwordHash).toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('throws NotFoundException when user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.getMe('missing-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the user without the passwordHash field', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'secret' } as any);
      const result = await service.getMe('u1');
      expect(result).toEqual({ id: 'u1' });
    });
  });

  describe('updateProfile', () => {
    it('updates the user, logs activity, and returns the fresh profile', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', name: 'New Name', passwordHash: 'x' } as any);

      const result = await service.updateProfile('u1', { name: 'New Name' } as any);

      expect(usersRepo.update).toHaveBeenCalledWith('u1', { name: 'New Name' });
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything(), { fields: ['name'] });
      expect(result).toEqual({ id: 'u1', name: 'New Name' });
    });
  });

  describe('updateAvatar', () => {
    it('updates avatarUrl, logs activity, returns id and avatarUrl', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      const result = await service.updateAvatar('u1', '/uploads/avatars/a.jpg');
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { avatarUrl: '/uploads/avatars/a.jpg' });
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything());
      expect(result).toEqual({ id: 'u1', avatarUrl: '/uploads/avatars/a.jpg' });
    });
  });

  describe('updateBilling', () => {
    it('strips non-digits from cpf and updates, logs CPF_REGISTERED', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'x' } as any);

      await service.updateBilling('u1', { cpf: '123.456.789-00' });

      expect(usersRepo.update).toHaveBeenCalledWith('u1', { cpf: '12345678900' });
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything());
    });

    it('updates billingName and birthDate without logging CPF_REGISTERED', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'x' } as any);

      await service.updateBilling('u1', { billingName: 'Alice', birthDate: '1990-01-01' });

      expect(usersRepo.update).toHaveBeenCalledWith('u1', { billingName: 'Alice', birthDate: '1990-01-01' });
      expect(activity.log).not.toHaveBeenCalled();
    });

    it('does not call update when dto is empty', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'x' } as any);
      await service.updateBilling('u1', {});
      expect(usersRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('getMatchHistory', () => {
    it('returns paginated finished matches for the user', async () => {
      matchesRepo.findAndCount.mockResolvedValue([[{ id: 'm1' }], 1] as any);
      const result = await service.getMatchHistory('u1', 1, 20);
      expect(matchesRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [
            { whitePlayerId: 'u1', status: MatchStatus.FINISHED },
            { blackPlayerId: 'u1', status: MatchStatus.FINISHED },
          ],
        }),
      );
      expect(result).toEqual({ matches: [{ id: 'm1' }], total: 1, page: 1, totalPages: 1 });
    });

    it('uses default page/limit values', async () => {
      matchesRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.getMatchHistory('u1');
      expect(result).toEqual({ matches: [], total: 0, page: 1, totalPages: 0 });
    });
  });

  describe('getStats', () => {
    it('parses online and offline stats correctly', async () => {
      const onlineQb = queryBuilderMock();
      onlineQb.getRawOne.mockResolvedValue({ total: '10', draws: '2', wins: '5' });
      const offlineQb = queryBuilderMock();
      offlineQb.getRawOne.mockResolvedValue({ total: '4', draws: '1', wins: '2' });

      matchesRepo.createQueryBuilder
        .mockReturnValueOnce(onlineQb as any)
        .mockReturnValueOnce(offlineQb as any);

      const result = await service.getStats('u1');

      expect(result).toEqual({
        wins: 5, losses: 3, draws: 2, total: 10,
        offline: { wins: 2, losses: 1, draws: 1, total: 4 },
      });
    });

    it('defaults to zero when raw rows are null/undefined', async () => {
      const onlineQb = queryBuilderMock();
      onlineQb.getRawOne.mockResolvedValue(null);
      const offlineQb = queryBuilderMock();
      offlineQb.getRawOne.mockResolvedValue(undefined);

      matchesRepo.createQueryBuilder
        .mockReturnValueOnce(onlineQb as any)
        .mockReturnValueOnce(offlineQb as any);

      const result = await service.getStats('u1');
      expect(result).toEqual({
        wins: 0, losses: 0, draws: 0, total: 0,
        offline: { wins: 0, losses: 0, draws: 0, total: 0 },
      });
    });
  });

  describe('acceptTerms', () => {
    it('records acceptance with the current terms version and logs activity', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'x', termsVersion: TERMS_VERSION } as any);

      const result = await service.acceptTerms('u1');

      expect(usersRepo.update).toHaveBeenCalledWith('u1', {
        termsAcceptedAt: expect.any(Date),
        termsVersion: TERMS_VERSION,
      });
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything(), { version: TERMS_VERSION });
      expect(result).toEqual({ id: 'u1', termsVersion: TERMS_VERSION });
    });
  });

  describe('deleteAccount', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteAccount('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException with HAS_BALANCE when balance > 0 and not acknowledged', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1' } as any);
      wallet.getBalance.mockResolvedValue({ balance: 42.5 });

      await expect(service.deleteAccount('u1')).rejects.toMatchObject({
        response: { code: 'HAS_BALANCE', balance: 42.5 },
      });
      expect(usersRepo.update).not.toHaveBeenCalled();
    });

    it('proceeds and anonymizes when balance > 0 but the user acknowledges the loss', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1' } as any);
      wallet.getBalance.mockResolvedValue({ balance: 42.5 });
      usersRepo.update.mockResolvedValue({} as any);
      refreshTokensRepo.delete.mockResolvedValue({} as any);
      redis.del.mockResolvedValue(1);

      const result = await service.deleteAccount('u1', true);

      expect(usersRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({
        isActive: false,
        email: 'deleted_u1@deleted.megachess.io',
        nickname: 'deleted_u1',
        cpf: null,
        birthDate: null,
      }));
      expect(result).toEqual({ success: true });
    });

    it('anonymizes, revokes sessions and logs activity when balance is zero', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1' } as any);
      wallet.getBalance.mockResolvedValue({ balance: 0 });
      usersRepo.update.mockResolvedValue({} as any);
      refreshTokensRepo.delete.mockResolvedValue({} as any);
      redis.del.mockResolvedValue(1);

      const result = await service.deleteAccount('u1');

      expect(refreshTokensRepo.delete).toHaveBeenCalledWith({ userId: 'u1' });
      expect(redis.del).toHaveBeenCalledWith('session:u1');
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything());
      expect(result).toEqual({ success: true });
    });
  });

  describe('getReviews', () => {
    it('throws NotFoundException when user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.getReviews('missing', 1, 10)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns paginated reviews with avgRating and reviewCount', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', avgRating: 4.5, reviewCount: 10 } as any);
      reviewsRepo.findAndCount.mockResolvedValue([[{ id: 'r1' }] as any, 1]);

      const result = await service.getReviews('alice', 1, 10);
      expect(result).toEqual({ data: [{ id: 'r1' }], total: 1, page: 1, totalPages: 1, avgRating: 4.5, reviewCount: 10 });
    });

    it('caps the limit at 50 even when a higher value is requested', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', avgRating: 0, reviewCount: 0 } as any);
      reviewsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getReviews('alice', 1, 999);
      expect(reviewsRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });

    it('uses default page/limit values', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', avgRating: 0, reviewCount: 0 } as any);
      reviewsRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getReviews('alice');
      expect(result.page).toBe(1);
    });
  });
});
