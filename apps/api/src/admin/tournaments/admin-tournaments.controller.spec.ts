import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminTournamentsController } from './admin-tournaments.controller';
import { AdminTournamentsService } from './admin-tournaments.service';

describe('AdminTournamentsController', () => {
  let controller: AdminTournamentsController;
  let service: jest.Mocked<AdminTournamentsService>;

  const admin = { id: 'admin-1', name: 'Admin' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminTournamentsController],
      providers: [
        {
          provide: AdminTournamentsService,
          useValue: {
            list: jest.fn(), listDuels: jest.fn(), matchMoves: jest.fn(), analyzeMatchWithAi: jest.fn(),
            get: jest.fn(), participants: jest.fn(), matches: jest.fn(), start: jest.fn(),
            cancel: jest.fn(), removeParticipant: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminTournamentsController);
    service = module.get(AdminTournamentsService);
  });

  describe('list', () => {
    it('applies defaults', async () => {
      service.list.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.list({});
      expect(service.list).toHaveBeenCalledWith({ page: 1, limit: 20, status: undefined });
    });

    it('rethrows HttpException unchanged', async () => {
      service.list.mockRejectedValue(new NotFoundException());
      await expect(controller.list({})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.list.mockRejectedValue(new Error('boom'));
      await expect(controller.list({})).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.list.mockRejectedValue('plain string');
      await expect(controller.list({})).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('listDuels', () => {
    it('defaults view to active when not finished', async () => {
      service.listDuels.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.listDuels({});
      expect(service.listDuels).toHaveBeenCalledWith({ page: 1, limit: 20, view: 'active' });
    });

    it('forwards finished view explicitly', async () => {
      service.listDuels.mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 });
      await controller.listDuels({ view: 'finished' });
      expect(service.listDuels).toHaveBeenCalledWith({ page: 1, limit: 20, view: 'finished' });
    });

    it('rethrows HttpException unchanged', async () => {
      service.listDuels.mockRejectedValue(new NotFoundException());
      await expect(controller.listDuels({})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.listDuels.mockRejectedValue(new Error('boom'));
      await expect(controller.listDuels({})).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.listDuels.mockRejectedValue('plain string');
      await expect(controller.listDuels({})).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('matchMoves', () => {
    it('returns match moves', async () => {
      service.matchMoves.mockResolvedValue({ id: 'tm1' } as any);
      const result = await controller.matchMoves('tm1');
      expect(result).toEqual({ id: 'tm1' });
    });

    it('rethrows HttpException unchanged', async () => {
      service.matchMoves.mockRejectedValue(new NotFoundException());
      await expect(controller.matchMoves('tm1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.matchMoves.mockRejectedValue(new Error('boom'));
      await expect(controller.matchMoves('tm1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.matchMoves.mockRejectedValue('plain string');
      await expect(controller.matchMoves('tm1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('analyzeMatch', () => {
    it('returns analysis result', async () => {
      service.analyzeMatchWithAi.mockResolvedValue({ verdict: 'CLEAN' } as any);
      const result = await controller.analyzeMatch('tm1');
      expect(result).toEqual({ verdict: 'CLEAN' });
    });

    it('rethrows HttpException unchanged', async () => {
      service.analyzeMatchWithAi.mockRejectedValue(new NotFoundException());
      await expect(controller.analyzeMatch('tm1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.analyzeMatchWithAi.mockRejectedValue(new Error('boom'));
      await expect(controller.analyzeMatch('tm1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.analyzeMatchWithAi.mockRejectedValue('plain string');
      await expect(controller.analyzeMatch('tm1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('get', () => {
    it('returns the tournament', async () => {
      service.get.mockResolvedValue({ id: 't1' } as any);
      const result = await controller.get('t1');
      expect(result).toEqual({ id: 't1' });
    });

    it('rethrows HttpException unchanged', async () => {
      service.get.mockRejectedValue(new NotFoundException());
      await expect(controller.get('t1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.get.mockRejectedValue(new Error('boom'));
      await expect(controller.get('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.get.mockRejectedValue('plain string');
      await expect(controller.get('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('participants', () => {
    it('returns participants list', async () => {
      service.participants.mockResolvedValue([]);
      const result = await controller.participants('t1');
      expect(result).toEqual([]);
    });

    it('rethrows HttpException unchanged', async () => {
      service.participants.mockRejectedValue(new NotFoundException());
      await expect(controller.participants('t1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.participants.mockRejectedValue(new Error('boom'));
      await expect(controller.participants('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.participants.mockRejectedValue('plain string');
      await expect(controller.participants('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('matches', () => {
    it('returns matches list', async () => {
      service.matches.mockResolvedValue([]);
      const result = await controller.matches('t1');
      expect(result).toEqual([]);
    });

    it('rethrows HttpException unchanged', async () => {
      service.matches.mockRejectedValue(new NotFoundException());
      await expect(controller.matches('t1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.matches.mockRejectedValue(new Error('boom'));
      await expect(controller.matches('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.matches.mockRejectedValue('plain string');
      await expect(controller.matches('t1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('start', () => {
    it('delegates to service', async () => {
      service.start.mockResolvedValue(undefined);
      await controller.start('t1', admin);
      expect(service.start).toHaveBeenCalledWith('t1', admin);
    });

    it('rethrows HttpException unchanged', async () => {
      service.start.mockRejectedValue(new NotFoundException());
      await expect(controller.start('t1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.start.mockRejectedValue(new Error('boom'));
      await expect(controller.start('t1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.start.mockRejectedValue('plain string');
      await expect(controller.start('t1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('cancel', () => {
    it('delegates to service', async () => {
      service.cancel.mockResolvedValue(undefined);
      await controller.cancel('t1', admin);
      expect(service.cancel).toHaveBeenCalledWith('t1', admin);
    });

    it('rethrows HttpException unchanged', async () => {
      service.cancel.mockRejectedValue(new NotFoundException());
      await expect(controller.cancel('t1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.cancel.mockRejectedValue(new Error('boom'));
      await expect(controller.cancel('t1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.cancel.mockRejectedValue('plain string');
      await expect(controller.cancel('t1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('removeParticipant', () => {
    it('delegates to service', async () => {
      service.removeParticipant.mockResolvedValue(undefined);
      await controller.removeParticipant('t1', 'u1', admin);
      expect(service.removeParticipant).toHaveBeenCalledWith('t1', 'u1', admin);
    });

    it('rethrows HttpException unchanged', async () => {
      service.removeParticipant.mockRejectedValue(new NotFoundException());
      await expect(controller.removeParticipant('t1', 'u1', admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps unexpected errors as 500', async () => {
      service.removeParticipant.mockRejectedValue(new Error('boom'));
      await expect(controller.removeParticipant('t1', 'u1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as 500', async () => {
      service.removeParticipant.mockRejectedValue('plain string');
      await expect(controller.removeParticipant('t1', 'u1', admin)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
