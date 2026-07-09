import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let repo: jest.Mocked<Repository<AdminAuditLog>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        {
          provide: getRepositoryToken(AdminAuditLog),
          useValue: {
            save: jest.fn(),
            create: jest.fn((x) => x),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AdminAuditService);
    repo = module.get(getRepositoryToken(AdminAuditLog));
  });

  describe('log', () => {
    it('creates and saves an audit entry with defaults for missing options', () => {
      repo.save.mockResolvedValue({} as any);
      service.log({ id: 'admin-1', name: 'Alice' } as any, 'SOME_ACTION');

      expect(repo.create).toHaveBeenCalledWith({
        adminId: 'admin-1',
        adminName: 'Alice',
        action: 'SOME_ACTION',
        targetType: null,
        targetId: null,
        details: null,
        ipAddress: null,
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it('passes through provided options', () => {
      repo.save.mockResolvedValue({} as any);
      service.log(
        { id: 'admin-1', name: 'Alice' } as any,
        'IP_BLACKLISTED',
        { targetType: 'ip', targetId: '1.2.3.4', details: 'reason', ip: '9.9.9.9' },
      );

      expect(repo.create).toHaveBeenCalledWith({
        adminId: 'admin-1',
        adminName: 'Alice',
        action: 'IP_BLACKLISTED',
        targetType: 'ip',
        targetId: '1.2.3.4',
        details: 'reason',
        ipAddress: '9.9.9.9',
      });
    });

    it('does not throw when the underlying save rejects', async () => {
      repo.save.mockReturnValue(Promise.reject(new Error('db down')));
      expect(() => service.log({ id: 'admin-1', name: 'Alice' } as any, 'X')).not.toThrow();
      // allow the rejected promise's catch handler to run
      await new Promise((r) => setImmediate(r));
    });
  });

  describe('list', () => {
    function makeQb(data: any[], total: number) {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      };
      return qb;
    }

    it('applies default pagination when no query params are given', async () => {
      const qb = makeQb([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(25);
      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });

    it('caps the limit at 100', async () => {
      const qb = makeQb([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.list({ limit: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });

    it('applies all optional filters', async () => {
      const qb = makeQb([{ id: '1' }], 1);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.list({
        page: 2,
        limit: 10,
        adminId: 'admin-1',
        action: 'LOGIN',
        targetType: 'ip',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('a.adminId = :adminId', { adminId: 'admin-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('a.action ILIKE :action', { action: '%LOGIN%' });
      expect(qb.andWhere).toHaveBeenCalledWith('a.targetType = :targetType', { targetType: 'ip' });
      expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt >= :dateFrom', { dateFrom: new Date('2026-01-01') });
      expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt <= :dateTo', { dateTo: new Date('2026-01-31T23:59:59.999Z') });
      expect(qb.skip).toHaveBeenCalledWith(10);
    });

    it('computes totalPages via ceil', async () => {
      const qb = makeQb([{}, {}, {}], 23);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.list({ limit: 10 });

      expect(result.totalPages).toBe(3);
    });
  });

  describe('exportCsv', () => {
    it('produces a CSV header plus one row per record with escaped quotes', async () => {
      const created = new Date('2026-01-15T10:00:00.000Z');
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: '1',
              adminId: 'admin-1',
              adminName: 'Alice "The Boss"',
              action: 'LOGIN',
              targetType: null,
              targetId: null,
              details: 'note with "quotes"',
              ipAddress: null,
              createdAt: created,
            },
          ],
          1,
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const csv = await service.exportCsv({});

      expect(csv).toContain('id,admin_id,admin_name,action,target_type,target_id,details,ip_address,created_at');
      expect(csv).toContain('"Alice ""The Boss"""');
      expect(csv).toContain('"note with ""quotes"""');
      expect(csv).toContain(created.toISOString());
    });

    it('returns just the header when there is no data', async () => {
      const qb: any = {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const csv = await service.exportCsv({ adminId: 'x' });

      expect(csv).toBe('id,admin_id,admin_name,action,target_type,target_id,details,ip_address,created_at\n');
    });
  });
});
