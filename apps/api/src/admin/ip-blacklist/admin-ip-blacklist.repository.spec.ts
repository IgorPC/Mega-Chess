import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminIpBlacklistRepository } from './admin-ip-blacklist.repository';
import { IpBlacklist } from '../../entities/ip-blacklist.entity';

describe('AdminIpBlacklistRepository', () => {
  let repository: AdminIpBlacklistRepository;
  let ormRepo: jest.Mocked<Repository<IpBlacklist>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminIpBlacklistRepository,
        {
          provide: getRepositoryToken(IpBlacklist),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get(AdminIpBlacklistRepository);
    ormRepo = module.get(getRepositoryToken(IpBlacklist));
  });

  describe('findByIp', () => {
    it('returns null when not found', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      const result = await repository.findByIp('1.2.3.4');
      expect(result).toBeNull();
    });

    it('queries by ip', async () => {
      ormRepo.findOne.mockResolvedValue({ ip: '1.2.3.4' } as any);
      await repository.findByIp('1.2.3.4');
      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { ip: '1.2.3.4' } });
    });
  });

  describe('findAll', () => {
    it('returns all entries', async () => {
      ormRepo.find.mockResolvedValue([{ ip: 'a' } as any]);
      const result = await repository.findAll();
      expect(result).toEqual([{ ip: 'a' }]);
    });
  });

  describe('findPage', () => {
    function makeQb(data: any[], total: number) {
      return {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      } as any;
    }

    it('paginates without an ip filter', async () => {
      const qb = makeQb([], 0);
      ormRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findPage(1, 25);

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(25);
      expect(result).toEqual({ data: [], total: 0 });
    });

    it('filters by ip when provided', async () => {
      const qb = makeQb([{ ip: '1.1.1.1' }], 1);
      ormRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await repository.findPage(2, 10, '1.1');

      expect(qb.andWhere).toHaveBeenCalledWith('b.ip ILIKE :ip', { ip: '%1.1%' });
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(result).toEqual({ data: [{ ip: '1.1.1.1' }], total: 1 });
    });
  });

  describe('create', () => {
    it('delegates to the repository create', () => {
      ormRepo.create.mockReturnValue({ ip: '1.1.1.1' } as any);
      const result = repository.create({ ip: '1.1.1.1' });
      expect(ormRepo.create).toHaveBeenCalledWith({ ip: '1.1.1.1' });
      expect(result).toEqual({ ip: '1.1.1.1' });
    });
  });

  describe('save', () => {
    it('delegates to the repository save', async () => {
      ormRepo.save.mockResolvedValue({ ip: '1.1.1.1' } as any);
      const result = await repository.save({ ip: '1.1.1.1' } as any);
      expect(result).toEqual({ ip: '1.1.1.1' });
    });
  });

  describe('remove', () => {
    it('delegates to the repository remove', async () => {
      ormRepo.remove.mockResolvedValue({ ip: '1.1.1.1' } as any);
      const result = await repository.remove({ ip: '1.1.1.1' } as any);
      expect(result).toEqual({ ip: '1.1.1.1' });
    });
  });
});
