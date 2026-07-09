import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportTicket, TicketStatus } from '../entities/support-ticket.entity';
import { TicketMessage, MessageSenderType } from '../entities/ticket-message.entity';
import { TicketAttachment } from '../entities/ticket-attachment.entity';
import { User } from '../entities/user.entity';
import { UserActivityService } from '../user-activity/user-activity.service';
import { EmailService } from '../email/email.service';

describe('SupportService', () => {
  let service: SupportService;
  let tickets: jest.Mocked<any>;
  let messages: jest.Mocked<any>;
  let attachments: jest.Mocked<any>;
  let users: jest.Mocked<any>;
  let activity: jest.Mocked<UserActivityService>;
  let email: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SupportService,
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: {
            save: jest.fn(), create: jest.fn((x) => x), findAndCount: jest.fn(), findOne: jest.fn(), update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TicketMessage),
          useValue: { save: jest.fn(), create: jest.fn((x) => x), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(TicketAttachment),
          useValue: { save: jest.fn(), create: jest.fn((x) => x), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        { provide: UserActivityService, useValue: { log: jest.fn() } },
        { provide: EmailService, useValue: { sendTicketOpened: jest.fn() } },
      ],
    }).compile();

    service = module.get(SupportService);
    tickets = module.get(getRepositoryToken(SupportTicket));
    messages = module.get(getRepositoryToken(TicketMessage));
    attachments = module.get(getRepositoryToken(TicketAttachment));
    users = module.get(getRepositoryToken(User));
    activity = module.get(UserActivityService);
    email = module.get(EmailService);
  });

  describe('createTicket', () => {
    it('creates a ticket with the initial user message and fires the notification email', async () => {
      tickets.save.mockResolvedValue({ id: 't1' });
      messages.save.mockResolvedValue({ id: 'm1' });
      tickets.findOne.mockResolvedValue({ id: 't1', messages: [] });
      users.findOne.mockResolvedValue({ email: 'u@x.com', name: 'User' });

      const result = await service.createTicket('u1', {
        category: 'PAYMENT', title: 'Problema', description: 'Descrição detalhada',
      } as any);

      expect(tickets.save).toHaveBeenCalled();
      expect(messages.save).toHaveBeenCalledWith(expect.objectContaining({ senderType: MessageSenderType.USER }));
      expect(activity.log).toHaveBeenCalled();
      expect(result).toEqual({ id: 't1', messages: [] });
      // Allow queued email promise to resolve
      await new Promise((r) => setImmediate(r));
      expect(email.sendTicketOpened).toHaveBeenCalledWith('u@x.com', 'User', 't1', 'Problema', 'PAYMENT');
    });

    it('does not fail when the user email lookup rejects', async () => {
      tickets.save.mockResolvedValue({ id: 't1' });
      messages.save.mockResolvedValue({ id: 'm1' });
      tickets.findOne.mockResolvedValue({ id: 't1' });
      users.findOne.mockRejectedValue(new Error('db error'));

      await service.createTicket('u1', { category: 'OTHER', title: 'x', description: 'y' } as any);
      await new Promise((r) => setImmediate(r));
      expect(email.sendTicketOpened).not.toHaveBeenCalled();
    });
  });

  describe('getMyTickets', () => {
    it('returns paginated tickets for the user', async () => {
      tickets.findAndCount.mockResolvedValue([[{ id: 't1' }], 1]);
      const result = await service.getMyTickets('u1', 1, 20);
      expect(result).toEqual({ items: [{ id: 't1' }], total: 1, page: 1, totalPages: 1 });
    });
  });

  describe('getTicket', () => {
    it('throws NotFoundException when missing', async () => {
      tickets.findOne.mockResolvedValue(null);
      await expect(service.getTicket('u1', 't1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'other', messages: [] });
      await expect(service.getTicket('u1', 't1')).rejects.toThrow(ForbiddenException);
    });

    it('filters out internal messages', async () => {
      tickets.findOne.mockResolvedValue({
        id: 't1', userId: 'u1',
        messages: [{ isInternal: true }, { isInternal: false }],
      });
      const result = await service.getTicket('u1', 't1');
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('addMessage', () => {
    it('throws NotFoundException when ticket missing', async () => {
      tickets.findOne.mockResolvedValue(null);
      await expect(service.addMessage('u1', 't1', { content: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'other', status: TicketStatus.OPEN });
      await expect(service.addMessage('u1', 't1', { content: 'x' } as any)).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when ticket is closed', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1', status: TicketStatus.CLOSED });
      await expect(service.addMessage('u1', 't1', { content: 'x' } as any)).rejects.toThrow(BadRequestException);
    });

    it('adds a message and moves ticket back to IN_PROGRESS when WAITING_USER', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1', status: TicketStatus.WAITING_USER });
      messages.save.mockResolvedValue({ id: 'm2' });

      const result = await service.addMessage('u1', 't1', { content: 'reply' } as any);

      expect(tickets.update).toHaveBeenCalledWith('t1', { status: TicketStatus.IN_PROGRESS });
      expect(activity.log).toHaveBeenCalled();
      expect(result).toEqual({ id: 'm2' });
    });

    it('adds a message without status change when already IN_PROGRESS', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1', status: TicketStatus.IN_PROGRESS });
      messages.save.mockResolvedValue({ id: 'm3' });

      await service.addMessage('u1', 't1', { content: 'reply' } as any);

      expect(tickets.update).not.toHaveBeenCalled();
    });
  });

  describe('attachFile', () => {
    const file = { filename: 'a.png', originalname: 'orig.png', mimetype: 'image/png', path: '/tmp/a.png', size: 2048 } as any;

    it('throws NotFoundException when ticket missing', async () => {
      tickets.findOne.mockResolvedValue(null);
      await expect(service.attachFile('u1', 't1', 'm1', file)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'other' });
      await expect(service.attachFile('u1', 't1', 'm1', file)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when message missing', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1' });
      messages.findOne.mockResolvedValue(null);
      await expect(service.attachFile('u1', 't1', 'm1', file)).rejects.toThrow(NotFoundException);
    });

    it('saves an attachment with size converted to KB', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1' });
      messages.findOne.mockResolvedValue({ id: 'm1', ticketId: 't1' });
      attachments.save.mockResolvedValue({ id: 'att1' });

      const result = await service.attachFile('u1', 't1', 'm1', file);

      expect(attachments.save).toHaveBeenCalledWith(expect.objectContaining({
        filename: 'a.png', mimeType: 'image/png', fileSizeKb: 2,
      }));
      expect(result).toEqual({ id: 'att1' });
    });
  });

  describe('getAttachment', () => {
    it('throws NotFoundException when ticket missing', async () => {
      tickets.findOne.mockResolvedValue(null);
      await expect(service.getAttachment('u1', 't1', 'a1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when not owner', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'other' });
      await expect(service.getAttachment('u1', 't1', 'a1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when attachment missing', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1' });
      attachments.findOne.mockResolvedValue(null);
      await expect(service.getAttachment('u1', 't1', 'a1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when attachment belongs to a different ticket', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1' });
      attachments.findOne.mockResolvedValue({ id: 'a1', message: { ticketId: 'other-ticket' } });
      await expect(service.getAttachment('u1', 't1', 'a1')).rejects.toThrow(NotFoundException);
    });

    it('returns the attachment when it matches the ticket', async () => {
      tickets.findOne.mockResolvedValue({ id: 't1', userId: 'u1' });
      const attachment = { id: 'a1', message: { ticketId: 't1' } };
      attachments.findOne.mockResolvedValue(attachment);
      const result = await service.getAttachment('u1', 't1', 'a1');
      expect(result).toBe(attachment);
    });
  });
});
