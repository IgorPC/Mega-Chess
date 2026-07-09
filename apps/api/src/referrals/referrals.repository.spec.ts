import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralsRepository } from './referrals.repository';
import { Referral } from './entities/referral.entity';
import { ReferralEarning } from './entities/referral-earning.entity';
import { User } from '../entities/user.entity';

describe('ReferralsRepository', () => {
  let repository: ReferralsRepository;
  let referralsRepo: jest.Mocked<Repository<Referral>>;
  let earningsRepo: jest.Mocked<Repository<ReferralEarning>>;
  let usersRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReferralsRepository,
        { provide: getRepositoryToken(Referral), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(ReferralEarning), useValue: { find: jest.fn() } },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
      ],
    }).compile();

    repository = module.get(ReferralsRepository);
    referralsRepo = module.get(getRepositoryToken(Referral));
    earningsRepo = module.get(getRepositoryToken(ReferralEarning));
    usersRepo = module.get(getRepositoryToken(User));
  });

  describe('findReferralsByReferrer', () => {
    it('queries referrals by referrerId', async () => {
      referralsRepo.find.mockResolvedValue([]);
      await repository.findReferralsByReferrer('ref-1');
      expect(referralsRepo.find).toHaveBeenCalledWith({ where: { referrerId: 'ref-1' } });
    });

    it('returns the list from the repo', async () => {
      const list = [{ id: '1' }] as Referral[];
      referralsRepo.find.mockResolvedValue(list);
      const result = await repository.findReferralsByReferrer('ref-1');
      expect(result).toBe(list);
    });
  });

  describe('findUserNickname', () => {
    it('returns null when user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await repository.findUserNickname('missing');
      expect(result).toBeNull();
    });

    it('selects only nickname', async () => {
      usersRepo.findOne.mockResolvedValue({ nickname: 'foo' } as any);
      await repository.findUserNickname('user-1');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: ['nickname'] });
    });
  });

  describe('findEarnings', () => {
    it('queries earnings by referrerId and referredId', async () => {
      earningsRepo.find.mockResolvedValue([]);
      await repository.findEarnings('ref-1', 'red-1');
      expect(earningsRepo.find).toHaveBeenCalledWith({ where: { referrerId: 'ref-1', referredId: 'red-1' } });
    });
  });

  describe('findUserWithReferralCode', () => {
    it('selects id and referralCode', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', referralCode: 'ABC' } as any);
      const result = await repository.findUserWithReferralCode('u1');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { id: 'u1' }, select: ['id', 'referralCode'] });
      expect(result).toEqual({ id: 'u1', referralCode: 'ABC' });
    });
  });

  describe('findUserByReferralCode', () => {
    it('returns null when no user has that code', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await repository.findUserByReferralCode('ZZZZZZZZ');
      expect(result).toBeNull();
    });

    it('selects only id filtering by referralCode', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u2' } as any);
      await repository.findUserByReferralCode('ABC12345');
      expect(usersRepo.findOne).toHaveBeenCalledWith({ where: { referralCode: 'ABC12345' }, select: ['id'] });
    });
  });

  describe('updateReferralCode', () => {
    it('updates the user referralCode', async () => {
      usersRepo.update.mockResolvedValue({} as any);
      await repository.updateReferralCode('u1', 'CODE1234');
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { referralCode: 'CODE1234' });
    });
  });
});
