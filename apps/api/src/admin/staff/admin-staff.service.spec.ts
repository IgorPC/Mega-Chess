import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AdminStaffService } from './admin-staff.service';
import { AdminStaffRepository } from './admin-staff.repository';
import { AdminAuditService } from '../admin-audit.service';
import { AdminAuthService } from '../auth/admin-auth.service';
import { AdminRole } from '../../entities/admin-user.entity';

jest.mock('bcrypt');

describe('AdminStaffService', () => {
  let service: AdminStaffService;
  let repo: jest.Mocked<AdminStaffRepository>;
  let audit: jest.Mocked<AdminAuditService>;
  let authService: jest.Mocked<AdminAuthService>;
  const admin = { id: 'admin-1', name: 'Boss' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminStaffService,
        {
          provide: AdminStaffRepository,
          useValue: {
            findAndCountAdmins: jest.fn(),
            findAdminByEmail: jest.fn(),
            findAdminById: jest.fn(),
            createAdmin: jest.fn((v) => v),
            saveAdmin: jest.fn(),
            updateAdmin: jest.fn(),
            findAndCountAuditLogs: jest.fn(),
          },
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
        { provide: AdminAuthService, useValue: { generateTempPassword: jest.fn(), sendWelcomeEmail: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminStaffService);
    repo = module.get(AdminStaffRepository);
    audit = module.get(AdminAuditService);
    authService = module.get(AdminAuthService);
  });

  describe('list', () => {
    it('returns serialized admins without passwordHash', async () => {
      repo.findAndCountAdmins.mockResolvedValue([[{ id: 'a1', name: 'X', passwordHash: 'secret' }] as any, 1]);
      const result = await service.list(1, 10);
      expect(result.data[0]).not.toHaveProperty('passwordHash');
      expect(result).toEqual(expect.objectContaining({ total: 1, page: 1, totalPages: 1 }));
    });

    it('uses default page and limit when omitted', async () => {
      repo.findAndCountAdmins.mockResolvedValue([[], 0]);
      await service.list();
      expect(repo.findAndCountAdmins).toHaveBeenCalledWith(1, 25);
    });
  });

  describe('create', () => {
    it('creates a new admin with hashed temp password and sends welcome email', async () => {
      repo.findAdminByEmail.mockResolvedValue(null);
      authService.generateTempPassword.mockReturnValue('temp123');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      repo.saveAdmin.mockResolvedValue({ id: 'new-1', name: 'N', email: 'n@b.com', role: AdminRole.SUPORTE, passwordHash: 'hashed' } as any);

      const result = await service.create({ name: 'N', email: 'n@b.com', role: AdminRole.SUPORTE }, admin);

      expect(bcrypt.hash).toHaveBeenCalledWith('temp123', 12);
      expect(repo.saveAdmin).toHaveBeenCalled();
      expect(authService.sendWelcomeEmail).toHaveBeenCalledWith('n@b.com', 'N', 'temp123');
      expect(audit.log).toHaveBeenCalled();
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws ConflictException when email already exists', async () => {
      repo.findAdminByEmail.mockResolvedValue({ id: 'exists' } as any);
      await expect(service.create({ name: 'N', email: 'dup@b.com', role: AdminRole.SUPORTE }, admin)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('updates the admin and logs the audit', async () => {
      repo.findAdminById.mockResolvedValue({ id: 'a1' } as any);
      await service.update('a1', { role: AdminRole.FINANCEIRO }, admin);
      expect(repo.updateAdmin).toHaveBeenCalledWith('a1', { role: AdminRole.FINANCEIRO });
      expect(audit.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when target does not exist', async () => {
      repo.findAdminById.mockResolvedValue(null);
      await expect(service.update('missing', {}, admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('deactivates the target admin', async () => {
      repo.findAdminById.mockResolvedValue({ id: 'other' } as any);
      await service.deactivate('other', admin);
      expect(repo.updateAdmin).toHaveBeenCalledWith('other', { isActive: false });
      expect(audit.log).toHaveBeenCalled();
    });

    it('throws BadRequestException when trying to deactivate yourself', async () => {
      await expect(service.deactivate('admin-1', admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when target does not exist', async () => {
      repo.findAdminById.mockResolvedValue(null);
      await expect(service.deactivate('missing', admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('auditLogs', () => {
    it('returns paginated audit logs', async () => {
      repo.findAndCountAuditLogs.mockResolvedValue([[], 0]);
      const result = await service.auditLogs(1, 20);
      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });

    it('uses default page and limit when omitted', async () => {
      repo.findAndCountAuditLogs.mockResolvedValue([[], 0]);
      await service.auditLogs();
      expect(repo.findAndCountAuditLogs).toHaveBeenCalledWith(1, 25);
    });
  });
});
