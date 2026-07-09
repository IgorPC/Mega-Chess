import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersRepository } from './admin-users.repository';
import { AdminAuditService } from '../admin-audit.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let repo: jest.Mocked<AdminUsersRepository>;
  let audit: jest.Mocked<AdminAuditService>;
  const admin = { id: 'admin-1' } as any;

  const usersQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    usersQb.where.mockReturnThis();
    usersQb.andWhere.mockReturnThis();
    usersQb.orderBy.mockReturnThis();
    usersQb.skip.mockReturnThis();
    usersQb.take.mockReturnThis();
    usersQb.getManyAndCount.mockResolvedValue([[], 0]);

    const module = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: AdminUsersRepository,
          useValue: {
            createUsersQueryBuilder: jest.fn(() => usersQb),
            findUserById: jest.fn(),
            findWalletByUserId: jest.fn(),
            findAndCountTransactions: jest.fn(),
            findTicketsByUserId: jest.fn(),
            findAndCountActivityLogs: jest.fn(),
            updateUser: jest.fn(),
            deleteRefreshTokensByUserId: jest.fn(),
            findAllUsers: jest.fn(),
            findAllWallets: jest.fn(),
          },
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminUsersService);
    repo = module.get(AdminUsersRepository);
    audit = module.get(AdminAuditService);
  });

  describe('list', () => {
    it('returns paginated users with no filters', async () => {
      usersQb.getManyAndCount.mockResolvedValue([[{ id: 'u1' }], 1]);
      const result = await service.list({ page: 1, limit: 10 });
      expect(usersQb.where).not.toHaveBeenCalled();
      expect(usersQb.andWhere).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [{ id: 'u1' }], total: 1, page: 1, totalPages: 1 });
    });

    it('applies search filter', async () => {
      await service.list({ search: 'alice' });
      expect(usersQb.where).toHaveBeenCalledWith('u.nickname ILIKE :q OR u.email ILIKE :q', { q: '%alice%' });
    });

    it('applies BANNED status filter', async () => {
      await service.list({ status: 'BANNED' });
      expect(usersQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('2100'));
    });

    it('applies SUSPENDED status filter', async () => {
      await service.list({ status: 'SUSPENDED' });
      expect(usersQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('<= 2100'));
    });

    it('applies ACTIVE status filter', async () => {
      await service.list({ status: 'ACTIVE' });
      expect(usersQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('IS NULL'));
    });
  });

  describe('get', () => {
    it('returns user with wallet balance', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1', nickname: 'X' } as any);
      repo.findWalletByUserId.mockResolvedValue({ balance: '50.00' } as any);
      const result = await service.get('u1');
      expect(result).toEqual({ id: 'u1', nickname: 'X', walletBalance: '50.00' });
    });

    it('defaults walletBalance to 0.00 when no wallet exists', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1' } as any);
      repo.findWalletByUserId.mockResolvedValue(null);
      const result = await service.get('u1');
      expect(result.walletBalance).toBe('0.00');
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findUserById.mockResolvedValue(null);
      await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('transactions', () => {
    it('returns paginated transactions', async () => {
      repo.findAndCountTransactions.mockResolvedValue([[{ id: 't1' }] as any, 5]);
      const result = await service.transactions('u1', 1, 20);
      expect(result).toEqual({ data: [{ id: 't1' }], total: 5, page: 1, totalPages: 1 });
    });
  });

  describe('tickets', () => {
    it('delegates to repo', async () => {
      repo.findTicketsByUserId.mockResolvedValue([{ id: 'tk1' }] as any);
      expect(await service.tickets('u1')).toEqual([{ id: 'tk1' }]);
    });
  });

  describe('activityLogs', () => {
    it('returns paginated activity logs', async () => {
      repo.findAndCountActivityLogs.mockResolvedValue([[], 0]);
      const result = await service.activityLogs('u1');
      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });
  });

  describe('sendMessage', () => {
    it('logs audit when user exists', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1' } as any);
      await service.sendMessage('u1', 'Title', 'Content', admin);
      expect(audit.log).toHaveBeenCalledWith(admin, 'USER_MESSAGE_SENT', expect.objectContaining({ targetId: 'u1' }));
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findUserById.mockResolvedValue(null);
      await expect(service.sendMessage('missing', 'T', 'C', admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('suspend', () => {
    it('suspends with hours duration', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1' } as any);
      await service.suspend('u1', 'Reason text', '24h', false, admin);
      expect(repo.updateUser).toHaveBeenCalledWith('u1', expect.objectContaining({ bannedReason: 'Reason text' }));
      expect(audit.log).toHaveBeenCalledWith(admin, 'USER_SUSPENDED', expect.anything());
    });

    it('bans permanently', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1' } as any);
      await service.suspend('u1', 'Permanent reason', 'permanent', false, admin);
      const updateCall = repo.updateUser.mock.calls[0][1] as any;
      expect(updateCall.bannedUntil.getFullYear()).toBeGreaterThanOrEqual(2199);
      expect(audit.log).toHaveBeenCalledWith(admin, 'USER_BANNED', expect.anything());
    });

    it('suspends with days duration', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1' } as any);
      await service.suspend('u1', 'Reason text', '7d', false, admin);
      expect(repo.updateUser).toHaveBeenCalled();
    });

    it('throws BadRequestException for invalid duration format', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1' } as any);
      await expect(service.suspend('u1', 'Reason', 'invalid', false, admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findUserById.mockResolvedValue(null);
      await expect(service.suspend('missing', 'R', '24h', false, admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('forceLogout', () => {
    it('deletes refresh tokens and logs audit', async () => {
      repo.deleteRefreshTokensByUserId.mockResolvedValue(undefined);
      await service.forceLogout('u1', admin);
      expect(repo.deleteRefreshTokensByUserId).toHaveBeenCalledWith('u1');
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('adjustElo', () => {
    it('adjusts ELO and logs audit', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1', rating: 1200 } as any);
      await service.adjustElo('u1', 1500, 'Ajuste por revisão manual de partidas suspeitas', admin);
      expect(repo.updateUser).toHaveBeenCalledWith('u1', { rating: 1500 });
      expect(audit.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findUserById.mockResolvedValue(null);
      await expect(service.adjustElo('missing', 1500, 'Reason long enough for validation', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for out-of-range ELO', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1', rating: 1200 } as any);
      await expect(service.adjustElo('u1', 50, 'Ajuste por revisão manual de partidas suspeitas', admin)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.adjustElo('u1', 5000, 'Ajuste por revisão manual de partidas suspeitas', admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when reason is too short', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1', rating: 1200 } as any);
      await expect(service.adjustElo('u1', 1500, 'short', admin)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('exportCsvData', () => {
    it('generates CSV with header and user rows', async () => {
      repo.findAllUsers.mockResolvedValue([
        { id: 'u1', nickname: 'Alice', email: 'a@b.com', name: 'Alice', rating: 1200, cpf: null, pixKey: null, bannedUntil: null, createdAt: new Date('2026-01-01') },
      ] as any);
      repo.findAllWallets.mockResolvedValue([{ userId: 'u1', balance: '42.50' }] as any);

      const csv = await service.exportCsvData();
      expect(csv).toContain('id,nickname,email');
      expect(csv).toContain('u1,Alice,a@b.com');
      expect(csv).toContain('42.50');
    });

    it('defaults balance to 0.00 for users without wallets', async () => {
      repo.findAllUsers.mockResolvedValue([
        { id: 'u1', nickname: 'X', email: 'x@y.com', name: 'X', rating: 1000, cpf: null, pixKey: null, bannedUntil: null, createdAt: new Date('2026-01-01') },
      ] as any);
      repo.findAllWallets.mockResolvedValue([]);

      const csv = await service.exportCsvData();
      expect(csv).toContain('0.00');
    });
  });
});
