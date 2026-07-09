import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminStaffRepository } from './admin-staff.repository';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import { AdminAuditLog } from '../../entities/admin-audit-log.entity';
import { UserActivityLog } from '../../entities/user-activity-log.entity';

describe('AdminStaffRepository', () => {
  let repo: AdminStaffRepository;
  let adminsRepo: jest.Mocked<Repository<AdminUser>>;
  let auditRepo: jest.Mocked<Repository<AdminAuditLog>>;

  const activityQb = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    activityQb.orderBy.mockReturnThis();
    activityQb.andWhere.mockReturnThis();
    activityQb.skip.mockReturnThis();
    activityQb.take.mockReturnThis();

    const module = await Test.createTestingModule({
      providers: [
        AdminStaffRepository,
        {
          provide: getRepositoryToken(AdminUser),
          useValue: { findAndCount: jest.fn(), findOne: jest.fn(), create: jest.fn((v) => v), save: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(AdminAuditLog),
          useValue: { findAndCount: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserActivityLog),
          useValue: { createQueryBuilder: jest.fn(() => activityQb) },
        },
      ],
    }).compile();

    repo = module.get(AdminStaffRepository);
    adminsRepo = module.get(getRepositoryToken(AdminUser));
    auditRepo = module.get(getRepositoryToken(AdminAuditLog));
  });

  describe('findAndCountAdmins', () => {
    it('returns paginated admins ordered by createdAt DESC', async () => {
      adminsRepo.findAndCount.mockResolvedValue([[{ id: 'a1' }] as any, 1]);
      const result = await repo.findAndCountAdmins(2, 10);
      expect(adminsRepo.findAndCount).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, skip: 10, take: 10 });
      expect(result).toEqual([[{ id: 'a1' }], 1]);
    });
  });

  describe('findAdminByEmail', () => {
    it('queries by email', async () => {
      adminsRepo.findOne.mockResolvedValue({ id: 'a1' } as any);
      const result = await repo.findAdminByEmail('a@b.com');
      expect(adminsRepo.findOne).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
      expect(result).toEqual({ id: 'a1' });
    });
  });

  describe('findAdminById', () => {
    it('queries by id', async () => {
      adminsRepo.findOne.mockResolvedValue({ id: 'a1' } as any);
      expect(await repo.findAdminById('a1')).toEqual({ id: 'a1' });
    });
  });

  describe('createAdmin', () => {
    it('creates an admin entity', () => {
      const data = { name: 'X', email: 'x@y.com', role: AdminRole.ADMIN, passwordHash: 'h', mustChangePassword: true };
      repo.createAdmin(data);
      expect(adminsRepo.create).toHaveBeenCalledWith(data);
    });
  });

  describe('saveAdmin / updateAdmin', () => {
    it('saves and updates', async () => {
      adminsRepo.save.mockResolvedValue({ id: 'a1' } as any);
      await repo.saveAdmin({ id: 'a1' } as any);
      expect(adminsRepo.save).toHaveBeenCalled();

      await repo.updateAdmin('a1', { isActive: false } as any);
      expect(adminsRepo.update).toHaveBeenCalledWith('a1', { isActive: false });
    });
  });

  describe('findAndCountAuditLogs', () => {
    it('returns paginated audit logs', async () => {
      auditRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await repo.findAndCountAuditLogs(1, 20);
      expect(auditRepo.findAndCount).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, skip: 0, take: 20 });
      expect(result).toEqual([[], 0]);
    });
  });

  describe('queryUserActivity', () => {
    it('queries with no filters', async () => {
      await repo.queryUserActivity({ page: 1, limit: 50 });
      expect(activityQb.orderBy).toHaveBeenCalledWith('a.createdAt', 'DESC');
      expect(activityQb.andWhere).not.toHaveBeenCalled();
      expect(activityQb.skip).toHaveBeenCalledWith(0);
      expect(activityQb.take).toHaveBeenCalledWith(50);
    });

    it('applies all filters when provided', async () => {
      await repo.queryUserActivity({
        page: 2, limit: 10, userId: 'u1', action: 'LOGIN', dateFrom: '2026-01-01', dateTo: '2026-01-31',
      });
      expect(activityQb.andWhere).toHaveBeenCalledTimes(4);
      expect(activityQb.skip).toHaveBeenCalledWith(10);
    });
  });
});
