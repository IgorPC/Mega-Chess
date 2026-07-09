import { Test } from '@nestjs/testing';
import { UserActivityService } from './user-activity.service';
import { UserActivityLogRepository } from './user-activity-log.repository';
import { UserAction } from '../entities/user-activity-log.entity';
import { Request } from 'express';

describe('UserActivityService', () => {
  let service: UserActivityService;
  let repo: jest.Mocked<UserActivityLogRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserActivityService,
        {
          provide: UserActivityLogRepository,
          useValue: {
            insert: jest.fn(),
            findByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UserActivityService);
    repo = module.get(UserActivityLogRepository);
  });

  describe('log', () => {
    it('inserts a log entry with userId, action, and null defaults when no req/metadata', () => {
      repo.insert.mockResolvedValue(undefined as any);

      service.log('u1', UserAction.AUTH_LOGIN);

      expect(repo.insert).toHaveBeenCalledWith({
        userId: 'u1',
        action: UserAction.AUTH_LOGIN,
        metadata: null,
        ipAddress: null,
        userAgent: null,
      });
    });

    it('includes metadata when provided', () => {
      repo.insert.mockResolvedValue(undefined as any);

      service.log('u1', UserAction.PROFILE_UPDATED, { field: 'nickname' });

      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
        metadata: { field: 'nickname' },
      }));
    });

    it('uses req.ip (resolved upstream by Express trust-proxy config), never the raw x-forwarded-for header', () => {
      repo.insert.mockResolvedValue(undefined as any);
      // A malicious client could set x-forwarded-for directly; only req.ip (vetted
      // by Express's trust-proxy walk) is safe to trust, so it must win here even
      // though the raw header claims a different, attacker-controlled address.
      const req = { headers: { 'x-forwarded-for': '1.2.3.4' }, ip: '203.0.113.9' } as unknown as Request;

      service.log('u1', UserAction.AUTH_LOGIN, undefined, req);

      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
        ipAddress: '203.0.113.9',
      }));
    });

    it('captures req.ip and user-agent when present', () => {
      repo.insert.mockResolvedValue(undefined as any);
      const req = { headers: { 'user-agent': 'TestAgent' }, ip: '192.168.0.1' } as unknown as Request;

      service.log('u1', UserAction.AUTH_LOGIN, undefined, req);

      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
        ipAddress: '192.168.0.1',
        userAgent: 'TestAgent',
      }));
    });

    it('falls back to null when req.ip is undefined', () => {
      repo.insert.mockResolvedValue(undefined as any);
      const req = { headers: {}, ip: undefined } as unknown as Request;

      service.log('u1', UserAction.AUTH_LOGIN, undefined, req);

      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({
        ipAddress: null,
        userAgent: null,
      }));
    });

    it('does not throw when insert rejects (fire-and-forget)', () => {
      repo.insert.mockRejectedValue(new Error('db down'));
      expect(() => service.log('u1', UserAction.AUTH_LOGIN)).not.toThrow();
    });
  });

  describe('getByUser', () => {
    it('returns paginated results with computed totalPages', async () => {
      repo.findByUser.mockResolvedValue([[{ id: 'log-1' }] as any, 120]);

      const result = await service.getByUser('u1', 3, 50);

      expect(repo.findByUser).toHaveBeenCalledWith('u1', 3, 50, undefined);
      expect(result).toEqual({
        items: [{ id: 'log-1' }],
        total: 120,
        page: 3,
        totalPages: 3,
      });
    });

    it('defaults to page 1 and limit 50', async () => {
      repo.findByUser.mockResolvedValue([[], 0]);

      const result = await service.getByUser('u1');

      expect(repo.findByUser).toHaveBeenCalledWith('u1', 1, 50, undefined);
      expect(result).toEqual({ items: [], total: 0, page: 1, totalPages: 0 });
    });

    it('passes the action filter through to the repository', async () => {
      repo.findByUser.mockResolvedValue([[], 0]);

      await service.getByUser('u1', 1, 10, UserAction.AUTH_LOGIN);

      expect(repo.findByUser).toHaveBeenCalledWith('u1', 1, 10, UserAction.AUTH_LOGIN);
    });

    it('computes totalPages correctly when total is not a multiple of limit', async () => {
      repo.findByUser.mockResolvedValue([[], 51]);

      const result = await service.getByUser('u1', 1, 50);

      expect(result.totalPages).toBe(2);
    });
  });
});
