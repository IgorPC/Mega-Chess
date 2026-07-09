import { Test } from '@nestjs/testing';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';

describe('AdminReportsController', () => {
  let controller: AdminReportsController;
  let service: jest.Mocked<AdminReportsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminReportsController],
      providers: [
        {
          provide: AdminReportsService,
          useValue: {
            list: jest.fn(),
            getOne: jest.fn(),
            resolve: jest.fn(),
            analyzeWithAi: jest.fn(),
            deleteReview: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminRolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminReportsController);
    service = module.get(AdminReportsService);
  });

  describe('list', () => {
    it('applies defaults when the query is empty', () => {
      service.list.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      controller.list({});
      expect(service.list).toHaveBeenCalledWith({
        page: 1,
        limit: 25,
        status: undefined,
        verdict: undefined,
        reportedId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
    });

    it('parses numeric query params and forwards filters', () => {
      service.list.mockResolvedValue({ data: [], total: 0, page: 2, totalPages: 0 });
      controller.list({ page: '2', limit: '10', status: 'PENDING', verdict: 'CLEAN', reportedId: 'u1' });
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 10, status: 'PENDING', verdict: 'CLEAN', reportedId: 'u1' }),
      );
    });

    it('propagates a rejection from the service', async () => {
      service.list.mockRejectedValue(new Error('db down'));
      await expect(controller.list({})).rejects.toThrow('db down');
    });
  });

  describe('getOne', () => {
    it('delegates to the service with the id param', async () => {
      service.getOne.mockResolvedValue({ id: '1' } as any);
      const result = await controller.getOne('1');
      expect(service.getOne).toHaveBeenCalledWith('1');
      expect(result).toEqual({ id: '1' });
    });

    it('propagates a rejection from the service', async () => {
      service.getOne.mockRejectedValue(new Error('boom'));
      await expect(controller.getOne('1')).rejects.toThrow('boom');
    });
  });

  describe('resolve', () => {
    it('delegates to the service with id, body, and admin', async () => {
      service.resolve.mockResolvedValue(undefined);
      const admin = { id: 'admin-1' };
      await controller.resolve('1', { resolution: 'BANNED' }, admin);
      expect(service.resolve).toHaveBeenCalledWith('1', { resolution: 'BANNED' }, admin);
    });

    it('propagates a rejection from the service', async () => {
      service.resolve.mockRejectedValue(new Error('Report not found'));
      await expect(controller.resolve('1', { resolution: 'x' }, {})).rejects.toThrow('Report not found');
    });
  });

  describe('analyze', () => {
    it('delegates to the service analyzeWithAi', async () => {
      service.analyzeWithAi.mockResolvedValue({ id: '1' } as any);
      const result = await controller.analyze('1');
      expect(service.analyzeWithAi).toHaveBeenCalledWith('1');
      expect(result).toEqual({ id: '1' });
    });

    it('propagates a rejection from the service', async () => {
      service.analyzeWithAi.mockRejectedValue(new Error('ai down'));
      await expect(controller.analyze('1')).rejects.toThrow('ai down');
    });
  });

  describe('deleteReview', () => {
    it('delegates to the service with id and admin', async () => {
      service.deleteReview.mockResolvedValue(undefined);
      const admin = { id: 'admin-1' };
      await controller.deleteReview('rev-1', admin);
      expect(service.deleteReview).toHaveBeenCalledWith('rev-1', admin);
    });

    it('propagates a rejection from the service', async () => {
      service.deleteReview.mockRejectedValue(new Error('Review not found'));
      await expect(controller.deleteReview('rev-1', {})).rejects.toThrow('Review not found');
    });
  });
});
