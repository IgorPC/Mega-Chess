import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivityLogRepository } from './user-activity-log.repository';
import { UserActivityLog, UserAction } from '../entities/user-activity-log.entity';

describe('UserActivityLogRepository', () => {
  let repository: UserActivityLogRepository;
  let typeormRepo: jest.Mocked<Repository<UserActivityLog>>;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserActivityLogRepository,
        {
          provide: getRepositoryToken(UserActivityLog),
          useValue: {
            insert: jest.fn(),
            createQueryBuilder: jest.fn(() => queryBuilder),
          },
        },
      ],
    }).compile();

    repository = module.get(UserActivityLogRepository);
    typeormRepo = module.get(getRepositoryToken(UserActivityLog));
    jest.clearAllMocks();
    queryBuilder.where.mockReturnThis();
    queryBuilder.andWhere.mockReturnThis();
    queryBuilder.orderBy.mockReturnThis();
    queryBuilder.skip.mockReturnThis();
    queryBuilder.take.mockReturnThis();
  });

  describe('insert', () => {
    it('delegates to the underlying repo insert', async () => {
      const params = {
        userId: 'u1',
        action: UserAction.AUTH_LOGIN,
        metadata: null,
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
      };
      typeormRepo.insert.mockResolvedValue({ identifiers: [{ id: 'log-1' }] } as any);

      const result = await repository.insert(params);

      expect(typeormRepo.insert).toHaveBeenCalledWith(params);
      expect(result).toEqual({ identifiers: [{ id: 'log-1' }] });
    });
  });

  describe('findByUser', () => {
    it('queries by userId with pagination and returns items + count', async () => {
      const logs = [{ id: 'log-1' }];
      queryBuilder.getManyAndCount.mockResolvedValue([logs, 1]);

      const result = await repository.findByUser('u1', 2, 25);

      expect(queryBuilder.where).toHaveBeenCalledWith('log.user_id = :userId', { userId: 'u1' });
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('log.created_at', 'DESC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(25);
      expect(queryBuilder.take).toHaveBeenCalledWith(25);
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(result).toEqual([logs, 1]);
    });

    it('adds an action filter when provided', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await repository.findByUser('u1', 1, 50, UserAction.AUTH_LOGIN);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.action = :action', { action: UserAction.AUTH_LOGIN });
    });
  });
});
