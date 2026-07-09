import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthRepository } from './auth.repository';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Referral } from '../referrals/entities/referral.entity';

describe('AuthRepository', () => {
  let repository: AuthRepository;
  let usersRepo: jest.Mocked<Repository<User>>;
  let tokensRepo: jest.Mocked<Repository<RefreshToken>>;
  let referralsRepo: jest.Mocked<Repository<Referral>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthRepository,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: { findOne: jest.fn(), delete: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Referral),
          useValue: { count: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    repository = module.get(AuthRepository);
    usersRepo = module.get(getRepositoryToken(User));
    tokensRepo = module.get(getRepositoryToken(RefreshToken));
    referralsRepo = module.get(getRepositoryToken(Referral));
  });

  describe('findUserByEmailOrNickname', () => {
    it('queries by email or nickname', () => {
      usersRepo.findOne.mockResolvedValue(null);
      repository.findUserByEmailOrNickname('a@a.com', 'nick');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: [{ email: 'a@a.com' }, { nickname: 'nick' }] });
    });
  });

  describe('createUser', () => {
    it('delegates to repository.create', () => {
      usersRepo.create.mockReturnValue({ id: '1' } as any);
      const result = repository.createUser({ email: 'a@a.com' });
      expect(usersRepo.create).toHaveBeenCalledWith({ email: 'a@a.com' });
      expect(result).toEqual({ id: '1' });
    });
  });

  describe('saveUser', () => {
    it('delegates to repository.save', async () => {
      usersRepo.save.mockResolvedValue({ id: '1' } as any);
      await repository.saveUser({ id: '1' } as any);
      expect(usersRepo.save).toHaveBeenCalledWith({ id: '1' });
    });
  });

  describe('findUserByReferralCode', () => {
    it('queries by referralCode', () => {
      usersRepo.findOne.mockResolvedValue(null);
      repository.findUserByReferralCode('ABC123');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { referralCode: 'ABC123' } });
    });
  });

  describe('countReferralsByReferrer', () => {
    it('counts referrals by referrerId', async () => {
      referralsRepo.count.mockResolvedValue(3);
      const result = await repository.countReferralsByReferrer('ref-1');
      expect(referralsRepo.count).toHaveBeenCalledWith({ where: { referrerId: 'ref-1' } });
      expect(result).toBe(3);
    });

    it('returns 0 when there are no referrals', async () => {
      referralsRepo.count.mockResolvedValue(0);
      const result = await repository.countReferralsByReferrer('ref-2');
      expect(result).toBe(0);
    });
  });

  describe('createReferral', () => {
    it('delegates to repository.create', () => {
      referralsRepo.create.mockReturnValue({ id: 'r1' } as any);
      const result = repository.createReferral({ referrerId: 'a' });
      expect(referralsRepo.create).toHaveBeenCalledWith({ referrerId: 'a' });
      expect(result).toEqual({ id: 'r1' });
    });
  });

  describe('saveReferral', () => {
    it('delegates to repository.save', async () => {
      referralsRepo.save.mockResolvedValue({ id: 'r1' } as any);
      await repository.saveReferral({ id: 'r1' } as any);
      expect(referralsRepo.save).toHaveBeenCalledWith({ id: 'r1' });
    });
  });

  describe('findUserByEmail', () => {
    it('queries by email', () => {
      usersRepo.findOne.mockResolvedValue(null);
      repository.findUserByEmail('a@a.com');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { email: 'a@a.com' } });
    });
  });

  describe('findUserByVerificationToken', () => {
    it('queries by emailVerificationToken', () => {
      usersRepo.findOne.mockResolvedValue(null);
      repository.findUserByVerificationToken('tok');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { emailVerificationToken: 'tok' } });
    });
  });

  describe('updateUser', () => {
    it('delegates to repository.update', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      await repository.updateUser('u1', { name: 'New' });
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { name: 'New' });
    });
  });

  describe('findRefreshTokenWithUser', () => {
    it('queries by token with user relation', () => {
      tokensRepo.findOne.mockResolvedValue(null);
      repository.findRefreshTokenWithUser('tok');
      expect(tokensRepo.findOne).toHaveBeenCalledWith({ where: { token: 'tok' }, relations: ['user'] });
    });
  });

  describe('deleteRefreshToken', () => {
    it('delegates to repository.delete', async () => {
      tokensRepo.delete.mockResolvedValue({} as any);
      await repository.deleteRefreshToken('tok');
      expect(tokensRepo.delete).toHaveBeenCalledWith({ token: 'tok' });
    });
  });

  describe('createRefreshToken', () => {
    it('delegates to repository.create', () => {
      tokensRepo.create.mockReturnValue({ token: 'tok' } as any);
      const result = repository.createRefreshToken({ token: 'tok' });
      expect(tokensRepo.create).toHaveBeenCalledWith({ token: 'tok' });
      expect(result).toEqual({ token: 'tok' });
    });
  });

  describe('saveRefreshToken', () => {
    it('delegates to repository.save', async () => {
      tokensRepo.save.mockResolvedValue({ token: 'tok' } as any);
      await repository.saveRefreshToken({ token: 'tok' } as any);
      expect(tokensRepo.save).toHaveBeenCalledWith({ token: 'tok' });
    });
  });
});
