import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminIpBlacklistService } from './admin-ip-blacklist.service';
import { AdminIpBlacklistRepository } from './admin-ip-blacklist.repository';
import { AdminAuditService } from '../admin-audit.service';
import { REDIS_CLIENT } from '../../redis/redis.module';

describe('AdminIpBlacklistService', () => {
  let service: AdminIpBlacklistService;
  let repo: jest.Mocked<AdminIpBlacklistRepository>;
  let audit: jest.Mocked<AdminAuditService>;
  let redis: any;

  const admin = { id: 'admin-1', name: 'Alice' };

  beforeEach(async () => {
    redis = { setex: jest.fn(), del: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminIpBlacklistService,
        {
          provide: AdminIpBlacklistRepository,
          useValue: {
            findPage: jest.fn(),
            findByIp: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminIpBlacklistService);
    repo = module.get(AdminIpBlacklistRepository);
    audit = module.get(AdminAuditService);
  });

  describe('list', () => {
    it('returns a paginated response', async () => {
      repo.findPage.mockResolvedValue({ data: [{ ip: '1.1.1.1' }] as any, total: 1 });
      const result = await service.list(1, 25);
      expect(result).toEqual({ data: [{ ip: '1.1.1.1' }], total: 1, page: 1, totalPages: 1 });
    });

    it('uses page 1 and limit 25 when called with no arguments', async () => {
      repo.findPage.mockResolvedValue({ data: [], total: 0 });
      await service.list();
      expect(repo.findPage).toHaveBeenCalledWith(1, 25, undefined);
    });

    it('caps the limit at the configured max', async () => {
      repo.findPage.mockResolvedValue({ data: [], total: 0 });
      await service.list(1, 500);
      expect(repo.findPage).toHaveBeenCalledWith(1, 100, undefined);
    });

    it('forwards the ip filter', async () => {
      repo.findPage.mockResolvedValue({ data: [], total: 0 });
      await service.list(1, 25, '1.2.3.4');
      expect(repo.findPage).toHaveBeenCalledWith(1, 25, '1.2.3.4');
    });
  });

  describe('add', () => {
    it('throws a conflict when the IP is already blacklisted', async () => {
      repo.findByIp.mockResolvedValue({ ip: '1.1.1.1' } as any);
      await expect(service.add('1.1.1.1', null, null, admin, '9.9.9.9')).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates, saves, syncs to redis with a permanent TTL, and audits when no expiry is set', async () => {
      repo.findByIp.mockResolvedValue(null);
      const entry = { ip: '1.1.1.1', expiresAt: null };
      repo.create.mockReturnValue(entry as any);
      repo.save.mockResolvedValue(entry as any);

      const result = await service.add('1.1.1.1', 'suspicious', null, admin, '9.9.9.9');

      expect(repo.create).toHaveBeenCalledWith({
        ip: '1.1.1.1', reason: 'suspicious', expiresAt: null, blockedBy: 'admin-1', blockedByName: 'Alice',
      });
      expect(redis.setex).toHaveBeenCalledWith(expect.stringContaining('1.1.1.1'), expect.any(Number), '1');
      expect(audit.log).toHaveBeenCalledWith(admin, 'IP_BLACKLISTED', {
        targetType: 'ip', targetId: '1.1.1.1', details: JSON.stringify({ reason: 'suspicious', expiresAt: null }), ip: '9.9.9.9',
      });
      expect(result).toEqual(entry);
    });

    it('syncs to redis with a TTL derived from a future expiry date', async () => {
      repo.findByIp.mockResolvedValue(null);
      const future = new Date(Date.now() + 60_000);
      const entry = { ip: '2.2.2.2', expiresAt: future };
      repo.create.mockReturnValue(entry as any);
      repo.save.mockResolvedValue(entry as any);

      await service.add('2.2.2.2', null, future, admin, '9.9.9.9');

      expect(redis.setex).toHaveBeenCalledWith(expect.stringContaining('2.2.2.2'), expect.any(Number), '1');
    });

    it('deletes the redis key instead of setting a negative/zero TTL for an already-expired date', async () => {
      repo.findByIp.mockResolvedValue(null);
      const past = new Date(Date.now() - 60_000);
      const entry = { ip: '3.3.3.3', expiresAt: past };
      repo.create.mockReturnValue(entry as any);
      repo.save.mockResolvedValue(entry as any);

      await service.add('3.3.3.3', null, past, admin, '9.9.9.9');

      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('3.3.3.3'));
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws not found when the IP is not blacklisted', async () => {
      repo.findByIp.mockResolvedValue(null);
      await expect(service.update('1.1.1.1', { reason: 'x' }, admin, '9.9.9.9')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('updates the reason and expiry, saves, and audits', async () => {
      const entry = { ip: '1.1.1.1', reason: 'old', expiresAt: null };
      repo.findByIp.mockResolvedValue(entry as any);
      repo.save.mockResolvedValue(entry as any);

      await service.update('1.1.1.1', { reason: 'new reason', expiresAt: null }, admin, '9.9.9.9');

      expect(entry.reason).toBe('new reason');
      expect(audit.log).toHaveBeenCalledWith(admin, 'IP_BLACKLIST_UPDATED', {
        targetType: 'ip', targetId: '1.1.1.1', details: JSON.stringify({ reason: 'new reason', expiresAt: null }), ip: '9.9.9.9',
      });
    });

    it('leaves fields untouched when they are not provided in the update', async () => {
      const entry = { ip: '1.1.1.1', reason: 'old', expiresAt: null };
      repo.findByIp.mockResolvedValue(entry as any);
      repo.save.mockResolvedValue(entry as any);

      await service.update('1.1.1.1', {}, admin, '9.9.9.9');

      expect(entry.reason).toBe('old');
    });
  });

  describe('remove', () => {
    it('throws not found when the IP is not blacklisted', async () => {
      repo.findByIp.mockResolvedValue(null);
      await expect(service.remove('1.1.1.1', admin, '9.9.9.9')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes the entry, clears redis, and audits', async () => {
      const entry = { ip: '1.1.1.1' };
      repo.findByIp.mockResolvedValue(entry as any);
      repo.remove.mockResolvedValue(entry as any);

      await service.remove('1.1.1.1', admin, '9.9.9.9');

      expect(repo.remove).toHaveBeenCalledWith(entry);
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('1.1.1.1'));
      expect(audit.log).toHaveBeenCalledWith(admin, 'IP_UNBLACKLISTED', {
        targetType: 'ip', targetId: '1.1.1.1', ip: '9.9.9.9',
      });
    });
  });

  describe('seedRedisFromDb / onApplicationBootstrap', () => {
    it('syncs every stored entry to redis on bootstrap', async () => {
      repo.findAll.mockResolvedValue([
        { ip: '1.1.1.1', expiresAt: null },
        { ip: '2.2.2.2', expiresAt: null },
      ] as any);

      await service.onApplicationBootstrap();

      expect(redis.setex).toHaveBeenCalledTimes(2);
    });

    it('handles an empty blacklist gracefully', async () => {
      repo.findAll.mockResolvedValue([]);
      await service.seedRedisFromDb();
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });
});
