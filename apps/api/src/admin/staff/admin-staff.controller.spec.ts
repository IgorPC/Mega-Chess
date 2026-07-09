import { InternalServerErrorException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminStaffController } from './admin-staff.controller';
import { AdminStaffService } from './admin-staff.service';
import { AdminAuditService } from '../admin-audit.service';
import { AdminStaffRepository } from './admin-staff.repository';
import { AdminRole } from '../../entities/admin-user.entity';

describe('AdminStaffController', () => {
  let controller: AdminStaffController;
  let svc: jest.Mocked<AdminStaffService>;
  let audit: jest.Mocked<AdminAuditService>;
  let repo: jest.Mocked<AdminStaffRepository>;
  const admin = { id: 'admin-1' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminStaffController],
      providers: [
        {
          provide: AdminStaffService,
          useValue: { list: jest.fn(), create: jest.fn(), update: jest.fn(), deactivate: jest.fn(), auditLogs: jest.fn() },
        },
        { provide: AdminAuditService, useValue: { list: jest.fn(), exportCsv: jest.fn() } },
        { provide: AdminStaffRepository, useValue: { queryUserActivity: jest.fn() } },
      ],
    }).compile();

    controller = module.get(AdminStaffController);
    svc = module.get(AdminStaffService);
    audit = module.get(AdminAuditService);
    repo = module.get(AdminStaffRepository);
  });

  describe('list', () => {
    it('delegates with parsed page/limit', async () => {
      svc.list.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      const result = await controller.list('2', '5');
      expect(svc.list).toHaveBeenCalledWith(2, 5);
      expect(result).toEqual({ data: [], total: 0, page: 1, totalPages: 0 });
    });

    it('rethrows HttpException unchanged', async () => {
      svc.list.mockRejectedValue(new NotFoundException());
      await expect(controller.list()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.list.mockRejectedValue(new Error('boom'));
      await expect(controller.list()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.list.mockRejectedValue('plain string');
      await expect(controller.list()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('create', () => {
    it('delegates to service', async () => {
      svc.create.mockResolvedValue({ id: 'new-1' } as any);
      const result = await controller.create({ name: 'X', email: 'x@y.com', role: AdminRole.SUPORTE } as any, admin);
      expect(result).toEqual({ id: 'new-1' });
    });

    it('rethrows ConflictException', async () => {
      svc.create.mockRejectedValue(new ConflictException());
      await expect(controller.create({} as any, admin)).rejects.toBeInstanceOf(ConflictException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.create.mockRejectedValue(new Error('boom'));
      await expect(controller.create({} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.create.mockRejectedValue('plain string');
      await expect(controller.create({} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('delegates to service', async () => {
      svc.update.mockResolvedValue(undefined as any);
      await controller.update('a1', { role: AdminRole.FINANCEIRO } as any, admin);
      expect(svc.update).toHaveBeenCalledWith('a1', { role: AdminRole.FINANCEIRO }, admin);
    });

    it('rethrows NotFoundException', async () => {
      svc.update.mockRejectedValue(new NotFoundException());
      await expect(controller.update('a1', {} as any, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.update.mockRejectedValue(new Error('boom'));
      await expect(controller.update('a1', {} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.update.mockRejectedValue('plain string');
      await expect(controller.update('a1', {} as any, admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('deactivate', () => {
    it('delegates to service', async () => {
      svc.deactivate.mockResolvedValue(undefined as any);
      await controller.deactivate('a1', admin);
      expect(svc.deactivate).toHaveBeenCalledWith('a1', admin);
    });

    it('rethrows HttpException unchanged', async () => {
      svc.deactivate.mockRejectedValue(new NotFoundException());
      await expect(controller.deactivate('a1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      svc.deactivate.mockRejectedValue(new Error('boom'));
      await expect(controller.deactivate('a1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      svc.deactivate.mockRejectedValue('plain string');
      await expect(controller.deactivate('a1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('auditLogs', () => {
    it('delegates to audit.list with parsed filters', async () => {
      audit.list.mockResolvedValue({ data: [], total: 0 } as any);
      await controller.auditLogs('1', '20', 'admin-1', 'STAFF_CREATED', 'admin_user', '2026-01-01', '2026-01-31');
      expect(audit.list).toHaveBeenCalledWith({
        page: 1, limit: 20, adminId: 'admin-1', action: 'STAFF_CREATED',
        targetType: 'admin_user', dateFrom: '2026-01-01', dateTo: '2026-01-31',
      });
    });

    it('passes undefined for empty string filters', async () => {
      audit.list.mockResolvedValue({ data: [], total: 0 } as any);
      await controller.auditLogs(undefined, undefined, '', '', '', '', '');
      expect(audit.list).toHaveBeenCalledWith(expect.objectContaining({
        adminId: undefined, action: undefined, targetType: undefined, dateFrom: undefined, dateTo: undefined,
      }));
    });

    it('rethrows HttpException unchanged', async () => {
      audit.list.mockRejectedValue(new NotFoundException());
      await expect(controller.auditLogs()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      audit.list.mockRejectedValue(new Error('boom'));
      await expect(controller.auditLogs()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      audit.list.mockRejectedValue('plain string');
      await expect(controller.auditLogs()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('userActivity', () => {
    it('returns paginated user activity', async () => {
      repo.queryUserActivity.mockResolvedValue([[{ id: 'a1' }], 1] as any);
      const result = await controller.userActivity('1', '50');
      expect(result).toEqual({ data: [{ id: 'a1' }], total: 1, page: 1, totalPages: 1 });
    });

    it('rethrows HttpException unchanged', async () => {
      repo.queryUserActivity.mockRejectedValue(new NotFoundException());
      await expect(controller.userActivity()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      repo.queryUserActivity.mockRejectedValue(new Error('boom'));
      await expect(controller.userActivity()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      repo.queryUserActivity.mockRejectedValue('plain string');
      await expect(controller.userActivity()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('exportAuditLogs', () => {
    it('sends CSV with correct headers', async () => {
      audit.exportCsv.mockResolvedValue('id,action\n1,LOGIN');
      const res = { setHeader: jest.fn(), send: jest.fn() } as any;
      await controller.exportAuditLogs(res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      expect(res.send).toHaveBeenCalledWith('id,action\n1,LOGIN');
    });

    it('rethrows HttpException unchanged', async () => {
      audit.exportCsv.mockRejectedValue(new NotFoundException());
      const res = {} as any;
      await expect(controller.exportAuditLogs(res)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      audit.exportCsv.mockRejectedValue(new Error('boom'));
      const res = {} as any;
      await expect(controller.exportAuditLogs(res)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      audit.exportCsv.mockRejectedValue('plain string');
      const res = {} as any;
      await expect(controller.exportAuditLogs(res)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
