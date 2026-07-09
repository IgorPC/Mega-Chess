import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

describe('FriendsController', () => {
  let controller: FriendsController;
  let service: jest.Mocked<FriendsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        {
          provide: FriendsService,
          useValue: {
            getFriends: jest.fn(),
            getPendingRequests: jest.fn(),
            sendRequest: jest.fn(),
            respondRequest: jest.fn(),
            removeFriend: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(FriendsController);
    service = module.get(FriendsService);
  });

  describe('getFriends', () => {
    it('returns the list of friends for the current user', async () => {
      service.getFriends.mockResolvedValue([{ id: 'f-1' }] as any);
      const result = await controller.getFriends({ id: 'user-1' });
      expect(service.getFriends).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'f-1' }]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getFriends.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getFriends({ id: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getFriends.mockRejectedValue(new Error('db down'));
      await expect(controller.getFriends({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getFriends.mockRejectedValue('plain string');
      await expect(controller.getFriends({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getPending', () => {
    it('returns pending requests for the current user', async () => {
      service.getPendingRequests.mockResolvedValue([{ id: 'req-1' }] as any);
      const result = await controller.getPending({ id: 'user-1' });
      expect(service.getPendingRequests).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'req-1' }]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getPendingRequests.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getPending({ id: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getPendingRequests.mockRejectedValue(new Error('boom'));
      await expect(controller.getPending({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getPendingRequests.mockRejectedValue('plain string');
      await expect(controller.getPending({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('sendRequest', () => {
    it('delegates to the service with userId and nickname', async () => {
      service.sendRequest.mockResolvedValue({ id: 'req-1' } as any);
      const result = await controller.sendRequest({ id: 'user-1' }, 'alice');
      expect(service.sendRequest).toHaveBeenCalledWith('user-1', 'alice');
      expect(result).toEqual({ id: 'req-1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.sendRequest.mockRejectedValue(new NotFoundException('User not found'));
      await expect(controller.sendRequest({ id: 'user-1' }, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.sendRequest.mockRejectedValue(new Error('boom'));
      await expect(controller.sendRequest({ id: 'user-1' }, 'alice')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.sendRequest.mockRejectedValue('plain string');
      await expect(controller.sendRequest({ id: 'user-1' }, 'alice')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('accept', () => {
    it('delegates to respondRequest with accept=true', async () => {
      service.respondRequest.mockResolvedValue({ id: 'req-1' } as any);
      const result = await controller.accept({ id: 'user-1' }, 'req-1');
      expect(service.respondRequest).toHaveBeenCalledWith('user-1', 'req-1', true);
      expect(result).toEqual({ id: 'req-1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.respondRequest.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.accept({ id: 'user-1' }, 'req-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.respondRequest.mockRejectedValue(new Error('boom'));
      await expect(controller.accept({ id: 'user-1' }, 'req-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.respondRequest.mockRejectedValue('plain string');
      await expect(controller.accept({ id: 'user-1' }, 'req-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('decline', () => {
    it('delegates to respondRequest with accept=false', async () => {
      service.respondRequest.mockResolvedValue({ status: 'removed' } as any);
      const result = await controller.decline({ id: 'user-1' }, 'req-1');
      expect(service.respondRequest).toHaveBeenCalledWith('user-1', 'req-1', false);
      expect(result).toEqual({ status: 'removed' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.respondRequest.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.decline({ id: 'user-1' }, 'req-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.respondRequest.mockRejectedValue(new Error('boom'));
      await expect(controller.decline({ id: 'user-1' }, 'req-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.respondRequest.mockRejectedValue('plain string');
      await expect(controller.decline({ id: 'user-1' }, 'req-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('remove', () => {
    it('delegates to removeFriend', async () => {
      service.removeFriend.mockResolvedValue({ status: 'removed' } as any);
      const result = await controller.remove({ id: 'user-1' }, 'friend-1');
      expect(service.removeFriend).toHaveBeenCalledWith('user-1', 'friend-1');
      expect(result).toEqual({ status: 'removed' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.removeFriend.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.remove({ id: 'user-1' }, 'friend-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.removeFriend.mockRejectedValue(new Error('boom'));
      await expect(controller.remove({ id: 'user-1' }, 'friend-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.removeFriend.mockRejectedValue('plain string');
      await expect(controller.remove({ id: 'user-1' }, 'friend-1')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
