import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuthRepository } from './admin-auth.repository';
import { AdminUser } from '../../entities/admin-user.entity';

describe('AdminAuthRepository', () => {
  let repository: AdminAuthRepository;
  let ormRepo: jest.Mocked<Repository<AdminUser>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminAuthRepository,
        {
          provide: getRepositoryToken(AdminUser),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
      ],
    }).compile();

    repository = module.get(AdminAuthRepository);
    ormRepo = module.get(getRepositoryToken(AdminUser));
  });

  describe('findActiveByEmail', () => {
    it('queries by email and isActive true', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      await repository.findActiveByEmail('a@b.com');
      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { email: 'a@b.com', isActive: true } });
    });

    it('returns the found admin', async () => {
      ormRepo.findOne.mockResolvedValue({ id: '1' } as any);
      const result = await repository.findActiveByEmail('a@b.com');
      expect(result).toEqual({ id: '1' });
    });
  });

  describe('findById', () => {
    it('returns null when not found', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      const result = await repository.findById('missing');
      expect(result).toBeNull();
    });

    it('queries by id', async () => {
      ormRepo.findOne.mockResolvedValue({ id: '1' } as any);
      await repository.findById('1');
      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    });
  });

  describe('update', () => {
    it('delegates to the repository update method', async () => {
      ormRepo.update.mockResolvedValue({} as any);
      await repository.update('1', { mustChangePassword: false });
      expect(ormRepo.update).toHaveBeenCalledWith('1', { mustChangePassword: false });
    });
  });
});
