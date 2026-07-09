import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../entities/user.entity';
import { REDIS_CLIENT } from '../../redis/redis.module';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersRepo: jest.Mocked<Repository<User>>;
  let redis: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('jwt-secret') },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: REDIS_CLIENT,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
    usersRepo = module.get(getRepositoryToken(User));
    redis = module.get(REDIS_CLIENT);
  });

  describe('validate', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(strategy.validate({ sub: 'u1', email: 'a@a.com' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the account was deleted (isActive false)', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', nickname: 'alice', isActive: false } as any);
      await expect(strategy.validate({ sub: 'u1', email: 'a@a.com' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the session token does not match redis', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', nickname: 'alice', isActive: true } as any);
      redis.get.mockResolvedValue('other-session-token');
      await expect(
        strategy.validate({ sub: 'u1', email: 'a@a.com', sessionToken: 'expected-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns the safe user payload when active and session matches', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', nickname: 'alice', isActive: true } as any);
      redis.get.mockResolvedValue('session-token');
      const result = await strategy.validate({ sub: 'u1', email: 'a@a.com', sessionToken: 'session-token' });
      expect(result).toEqual({ id: 'u1', email: 'a@a.com', nickname: 'alice' });
    });

    it('skips session validation when no sessionToken is present in the payload', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', nickname: 'alice', isActive: true } as any);
      const result = await strategy.validate({ sub: 'u1', email: 'a@a.com' });
      expect(result).toEqual({ id: 'u1', email: 'a@a.com', nickname: 'alice' });
      expect(redis.get).not.toHaveBeenCalled();
    });
  });
});
