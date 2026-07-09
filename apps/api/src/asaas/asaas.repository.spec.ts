import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AsaasRepository } from './asaas.repository';
import { User } from '../entities/user.entity';

describe('AsaasRepository', () => {
  let repository: AsaasRepository;
  let ormRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AsaasRepository,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
      ],
    }).compile();

    repository = module.get(AsaasRepository);
    ormRepo = module.get(getRepositoryToken(User));
  });

  describe('findById', () => {
    it('queries by id and returns the user', async () => {
      const user = { id: 'user-1' } as User;
      ormRepo.findOne.mockResolvedValue(user);

      const result = await repository.findById('user-1');

      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result).toBe(user);
    });

    it('returns null when the user does not exist', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('updateAsaasCustomerId', () => {
    it('updates the user with the given Asaas customer id', async () => {
      ormRepo.update.mockResolvedValue({ affected: 1 } as any);

      await repository.updateAsaasCustomerId('user-1', 'cus_123');

      expect(ormRepo.update).toHaveBeenCalledWith('user-1', { asaasCustomerId: 'cus_123' });
    });
  });
});
