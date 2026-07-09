import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

describe('SuggestionsController', () => {
  let controller: SuggestionsController;
  let service: jest.Mocked<SuggestionsService>;

  const req = { user: { id: 'user-1' } };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SuggestionsController],
      providers: [
        {
          provide: SuggestionsService,
          useValue: {
            list: jest.fn(),
            getOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            vote: jest.fn(),
            unvote: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SuggestionsController);
    service = module.get(SuggestionsService);
  });

  describe('list', () => {
    it('forwards parsed query params', async () => {
      service.list.mockResolvedValue({ items: [] } as any);
      await controller.list(req, '2', '10', 'OPEN');
      expect(service.list).toHaveBeenCalledWith('user-1', 2, 10, 'OPEN');
    });

    it('defaults page and limit when not provided', async () => {
      service.list.mockResolvedValue({ items: [] } as any);
      await controller.list(req, undefined, undefined, undefined);
      expect(service.list).toHaveBeenCalledWith('user-1', 1, 20, undefined);
    });

    it('rethrows HttpException from service', async () => {
      service.list.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.list(req)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.list.mockRejectedValue(new Error('boom'));
      await expect(controller.list(req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getOne', () => {
    it('returns the suggestion', async () => {
      service.getOne.mockResolvedValue({ id: 's1' } as any);
      const result = await controller.getOne(req, 's1');
      expect(result).toEqual({ id: 's1' });
    });

    it('wraps unexpected error as 500', async () => {
      service.getOne.mockRejectedValue(new Error('boom'));
      await expect(controller.getOne(req, 's1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('create', () => {
    it('creates a suggestion', async () => {
      service.create.mockResolvedValue({ id: 'new' } as any);
      const result = await controller.create(req, { title: 't', description: 'd' } as any);
      expect(result).toEqual({ id: 'new' });
    });

    it('wraps unexpected error as 500', async () => {
      service.create.mockRejectedValue(new Error('boom'));
      await expect(controller.create(req, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('updates a suggestion', async () => {
      service.update.mockResolvedValue({ id: 's1', title: 'new' } as any);
      const result = await controller.update(req, 's1', { title: 'new' } as any);
      expect(result).toEqual({ id: 's1', title: 'new' });
    });

    it('wraps unexpected error as 500', async () => {
      service.update.mockRejectedValue(new Error('boom'));
      await expect(controller.update(req, 's1', {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('delete', () => {
    it('deletes a suggestion', async () => {
      service.delete.mockResolvedValue(undefined);
      await expect(controller.delete(req, 's1')).resolves.toBeUndefined();
    });

    it('wraps unexpected error as 500', async () => {
      service.delete.mockRejectedValue(new Error('boom'));
      await expect(controller.delete(req, 's1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('vote', () => {
    it('votes on a suggestion', async () => {
      service.vote.mockResolvedValue(undefined);
      await expect(controller.vote(req, 's1')).resolves.toBeUndefined();
    });

    it('wraps unexpected error as 500', async () => {
      service.vote.mockRejectedValue(new Error('boom'));
      await expect(controller.vote(req, 's1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('unvote', () => {
    it('removes a vote', async () => {
      service.unvote.mockResolvedValue(undefined);
      await expect(controller.unvote(req, 's1')).resolves.toBeUndefined();
    });

    it('rethrows HttpException from service', async () => {
      service.unvote.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.unvote(req, 's1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected error as 500', async () => {
      service.unvote.mockRejectedValue(new Error('boom'));
      await expect(controller.unvote(req, 's1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
