import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: jest.Mocked<MessagesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        {
          provide: MessagesService,
          useValue: {
            getConversations: jest.fn(),
            getConversation: jest.fn(),
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(MessagesController);
    service = module.get(MessagesService);
  });

  describe('getConversations', () => {
    it('returns the conversation list for the current user', async () => {
      service.getConversations.mockResolvedValue([{ user: { id: 'u-2' } }] as any);
      const result = await controller.getConversations({ id: 'user-1' });
      expect(service.getConversations).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ user: { id: 'u-2' } }]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getConversations.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getConversations({ id: 'user-1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getConversations.mockRejectedValue(new Error('db down'));
      await expect(controller.getConversations({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getConversations.mockRejectedValue('plain string');
      await expect(controller.getConversations({ id: 'user-1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getConversation', () => {
    it('returns messages between the current user and the other user', async () => {
      service.getConversation.mockResolvedValue([{ id: 'm-1' }] as any);
      const result = await controller.getConversation({ id: 'user-1' }, 'user-2');
      expect(service.getConversation).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual([{ id: 'm-1' }]);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getConversation.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getConversation({ id: 'user-1' }, 'user-2')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getConversation.mockRejectedValue(new Error('boom'));
      await expect(controller.getConversation({ id: 'user-1' }, 'user-2')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getConversation.mockRejectedValue('plain string');
      await expect(controller.getConversation({ id: 'user-1' }, 'user-2')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('send', () => {
    it('delegates to the service with sender, receiver and content', async () => {
      service.send.mockResolvedValue({ id: 'm-1', content: 'hi' } as any);
      const result = await controller.send({ id: 'user-1' }, 'user-2', 'hi');
      expect(service.send).toHaveBeenCalledWith('user-1', 'user-2', 'hi');
      expect(result).toEqual({ id: 'm-1', content: 'hi' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.send.mockRejectedValue(new NotFoundException('receiver not found'));
      await expect(controller.send({ id: 'user-1' }, 'user-2', 'hi')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.send.mockRejectedValue(new Error('boom'));
      await expect(controller.send({ id: 'user-1' }, 'user-2', 'hi')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.send.mockRejectedValue('plain string');
      await expect(controller.send({ id: 'user-1' }, 'user-2', 'hi')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
