import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminSuggestionsController } from './admin-suggestions.controller';
import { SuggestionsService } from '../../suggestions/suggestions.service';
import { SuggestionStatus } from '../../entities/improvement-suggestion.entity';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';

describe('AdminSuggestionsController', () => {
  let controller: AdminSuggestionsController;
  let service: jest.Mocked<SuggestionsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminSuggestionsController],
      providers: [
        { provide: SuggestionsService, useValue: { adminList: jest.fn(), adminUpdate: jest.fn() } },
      ],
    })
      .overrideGuard(AdminJwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminRolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminSuggestionsController);
    service = module.get(SuggestionsService);
  });

  describe('list', () => {
    it('applies defaults when no query params are given', async () => {
      service.adminList.mockResolvedValue({ data: [], total: 0 } as any);
      await controller.list(undefined, undefined, undefined, undefined, undefined, undefined);
      expect(service.adminList).toHaveBeenCalledWith({
        page: 1,
        limit: 25,
        status: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        authorId: undefined,
      });
    });

    it('forwards provided query params', async () => {
      service.adminList.mockResolvedValue({ data: [], total: 0 } as any);
      await controller.list('2', '10', 'PENDING', '2026-01-01', '2026-01-31', 'author-1');
      expect(service.adminList).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        status: 'PENDING',
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        authorId: 'author-1',
      });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.adminList.mockRejectedValue(new NotFoundException('nope'));
      await expect(
        controller.list(undefined, undefined, undefined, undefined, undefined, undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.adminList.mockRejectedValue(new Error('db down'));
      await expect(
        controller.list(undefined, undefined, undefined, undefined, undefined, undefined),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.adminList.mockRejectedValue('raw string failure');
      await expect(
        controller.list(undefined, undefined, undefined, undefined, undefined, undefined),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('delegates to the service with id, status, and adminNote', async () => {
      service.adminUpdate.mockResolvedValue({ id: '1' } as any);
      const dto = { status: SuggestionStatus.COMPLETED, adminNote: 'ok' };
      const result = await controller.update('1', dto as any);
      expect(service.adminUpdate).toHaveBeenCalledWith('1', SuggestionStatus.COMPLETED, 'ok');
      expect(result).toEqual({ id: '1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.adminUpdate.mockRejectedValue(new NotFoundException('not found'));
      await expect(
        controller.update('1', { status: SuggestionStatus.REJECTED } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.adminUpdate.mockRejectedValue(new Error('boom'));
      await expect(
        controller.update('1', { status: SuggestionStatus.REJECTED } as any),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.adminUpdate.mockRejectedValue('raw string failure');
      await expect(
        controller.update('1', { status: SuggestionStatus.REJECTED } as any),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
