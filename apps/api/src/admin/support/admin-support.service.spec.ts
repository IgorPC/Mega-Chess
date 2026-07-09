import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminSupportService } from './admin-support.service';
import { AdminSupportRepository } from './admin-support.repository';
import { AdminAuditService } from '../admin-audit.service';
import { DeepseekService } from '../../deepseek/deepseek.service';
import { EmailService } from '../../email/email.service';
import { TicketStatus } from '../../entities/support-ticket.entity';
import { MessageSenderType } from '../../entities/ticket-message.entity';

describe('AdminSupportService', () => {
  let service: AdminSupportService;
  let repo: jest.Mocked<AdminSupportRepository>;
  let audit: jest.Mocked<AdminAuditService>;
  let deepseek: { isAvailable: boolean; analyze: jest.Mock };
  let email: jest.Mocked<EmailService>;

  const admin = { id: 'admin-1', name: 'Admin', role: 'SUPORTE' } as any;

  beforeEach(async () => {
    deepseek = { isAvailable: true, analyze: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminSupportService,
        {
          provide: AdminSupportRepository,
          useValue: {
            countTickets: jest.fn(),
            listTicketsRaw: jest.fn(),
            findTicketById: jest.fn(),
            findAdminNameById: jest.fn(),
            findUserNicknameById: jest.fn(),
            findUserEmailAndNameById: jest.fn(),
            findMessagesByTicketId: jest.fn(),
            findUserNicknameBySenderId: jest.fn(),
            findAdminNameAndRoleBySenderId: jest.fn(),
            createMessage: jest.fn(),
            saveMessage: jest.fn(),
            updateTicket: jest.fn(),
          },
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
        { provide: DeepseekService, useValue: deepseek },
        { provide: EmailService, useValue: { sendTicketUpdated: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminSupportService);
    repo = module.get(AdminSupportRepository);
    audit = module.get(AdminAuditService);
    email = module.get(EmailService);
  });

  describe('list', () => {
    it('builds where clause and returns paginated tickets', async () => {
      repo.countTickets.mockResolvedValue([{ cnt: '2' }] as any);
      repo.listTicketsRaw.mockResolvedValue([
        { id: '1', title: 'T', status: 'OPEN', category: 'c', priority: 'HIGH', user_id: 'u1', assigned_to: null, assigned_to_name: null, user_nickname: 'nick', created_at: new Date(), updated_at: new Date() },
      ] as any);

      const result = await service.list({ page: 1, limit: 25, status: 'OPEN', category: 'c', search: 'foo' });

      expect(result.total).toBe(2);
      expect(result.data[0].userNickname).toBe('nick');
      expect(result.totalPages).toBe(1);
    });

    it('returns empty data set when no tickets match', async () => {
      repo.countTickets.mockResolvedValue([{ cnt: '0' }] as any);
      repo.listTicketsRaw.mockResolvedValue([]);

      const result = await service.list({});
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('defaults total to 0 when count query returns no rows', async () => {
      repo.countTickets.mockResolvedValue([] as any);
      repo.listTicketsRaw.mockResolvedValue([
        { id: '1', title: 'T', status: 'OPEN', category: 'c', priority: 'HIGH', user_id: 'u1', assigned_to: null, assigned_to_name: undefined, user_nickname: undefined, created_at: new Date(), updated_at: new Date() },
      ] as any);

      const result = await service.list({});
      expect(result.total).toBe(0);
      expect(result.data[0].userNickname).toBe('');
      expect(result.data[0].assignedToName).toBeNull();
    });
  });

  describe('get', () => {
    it('throws NotFoundException when ticket does not exist', async () => {
      repo.findTicketById.mockResolvedValue(null);
      await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves assignedToName and userNickname', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', assignedTo: 'a1', userId: 'u1' } as any);
      repo.findAdminNameById.mockResolvedValue([{ name: 'Admin Name' }] as any);
      repo.findUserNicknameById.mockResolvedValue([{ nickname: 'nick' }] as any);

      const result = await service.get('t1');
      expect(result.assignedToName).toBe('Admin Name');
      expect(result.userNickname).toBe('nick');
    });

    it('returns null assignedToName when ticket has no assignee', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', assignedTo: null, userId: 'u1' } as any);
      repo.findUserNicknameById.mockResolvedValue([{ nickname: 'n' }] as any);

      const result = await service.get('t1');
      expect(result.assignedToName).toBeNull();
      expect(repo.findAdminNameById).not.toHaveBeenCalled();
    });

    it('falls back to null/empty when admin or user lookups return no rows', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', assignedTo: 'a1', userId: 'u1' } as any);
      repo.findAdminNameById.mockResolvedValue([]);
      repo.findUserNicknameById.mockResolvedValue([]);

      const result = await service.get('t1');
      expect(result.assignedToName).toBeNull();
      expect(result.userNickname).toBe('');
    });
  });

  describe('getMessages', () => {
    it('throws NotFoundException when ticket missing', async () => {
      repo.findTicketById.mockResolvedValue(null);
      await expect(service.getMessages('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves sender names for user and admin messages', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1' } as any);
      repo.findMessagesByTicketId.mockResolvedValue([
        { id: 'm1', senderType: MessageSenderType.USER, senderId: 'u1', content: 'hi' },
        { id: 'm2', senderType: MessageSenderType.ADMIN, senderId: 'a1', content: 'hello' },
      ] as any);
      repo.findUserNicknameBySenderId.mockResolvedValue([{ nickname: 'user-nick' }] as any);
      repo.findAdminNameAndRoleBySenderId.mockResolvedValue([{ name: 'Admin', role: 'SUPORTE' }] as any);

      const result = await service.getMessages('t1');
      expect(result[0].senderName).toBe('user-nick');
      expect(result[1].senderName).toBe('Admin');
      expect(result[1].senderRole).toBe('SUPORTE');
    });

    it('falls back to defaults when sender lookup is empty', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1' } as any);
      repo.findMessagesByTicketId.mockResolvedValue([
        { id: 'm1', senderType: MessageSenderType.USER, senderId: 'u1', content: 'hi' },
      ] as any);
      repo.findUserNicknameBySenderId.mockResolvedValue([]);

      const result = await service.getMessages('t1');
      expect(result[0].senderName).toBe('Usuário');
    });
  });

  describe('reply', () => {
    it('throws NotFoundException when ticket does not exist', async () => {
      repo.findTicketById.mockResolvedValue(null);
      await expect(service.reply('t1', 'hi', false, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when ticket is closed', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', status: TicketStatus.CLOSED } as any);
      await expect(service.reply('t1', 'hi', false, admin)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates message, updates status and emails user on public reply', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', status: TicketStatus.OPEN, userId: 'u1', title: 'Bug' } as any);
      repo.createMessage.mockReturnValue({ ticketId: 't1' } as any);
      repo.saveMessage.mockResolvedValue({ id: 'm1', content: 'hi' } as any);
      repo.findUserEmailAndNameById.mockResolvedValue([{ email: 'a@b.com', name: 'User' }] as any);

      const result = await service.reply('t1', 'hi', false, admin);

      expect(repo.updateTicket).toHaveBeenCalledWith('t1', expect.objectContaining({ status: TicketStatus.WAITING_USER }));
      expect(email.sendTicketUpdated).toHaveBeenCalledWith('a@b.com', 'User', 't1', 'Bug', 'hi');
      expect(result.senderName).toBe(admin.name);
    });

    it('does not email or update status for internal notes', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', status: TicketStatus.OPEN, userId: 'u1', title: 'Bug' } as any);
      repo.createMessage.mockReturnValue({} as any);
      repo.saveMessage.mockResolvedValue({ id: 'm1' } as any);

      await service.reply('t1', 'internal note', true, admin);

      expect(repo.updateTicket).not.toHaveBeenCalled();
      expect(email.sendTicketUpdated).not.toHaveBeenCalled();
    });

    it('skips email when user lookup returns no rows', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', status: TicketStatus.OPEN, userId: 'u1', title: 'Bug' } as any);
      repo.createMessage.mockReturnValue({} as any);
      repo.saveMessage.mockResolvedValue({ id: 'm1' } as any);
      repo.findUserEmailAndNameById.mockResolvedValue([]);

      await service.reply('t1', 'hi', false, admin);
      expect(email.sendTicketUpdated).not.toHaveBeenCalled();
    });

    it('skips status update when already WAITING_USER on public reply', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', status: TicketStatus.WAITING_USER, userId: 'u1', title: 'Bug' } as any);
      repo.createMessage.mockReturnValue({} as any);
      repo.saveMessage.mockResolvedValue({ id: 'm1' } as any);
      repo.findUserEmailAndNameById.mockResolvedValue([{ email: 'a@b.com', name: 'User' }] as any);

      await service.reply('t1', 'hi', false, admin);
      expect(repo.updateTicket).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when ticket missing', async () => {
      repo.findTicketById.mockResolvedValue(null);
      await expect(service.updateStatus('t1', TicketStatus.CLOSED, admin)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets closedAt when status is CLOSED and logs audit', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1' } as any);
      await service.updateStatus('t1', TicketStatus.CLOSED, admin);
      expect(repo.updateTicket).toHaveBeenCalledWith('t1', expect.objectContaining({ status: TicketStatus.CLOSED, closedAt: expect.any(Date) }));
      expect(audit.log).toHaveBeenCalledWith(admin, 'TICKET_STATUS_CHANGED', expect.objectContaining({ targetId: 't1' }));
    });

    it('does not set closedAt for non-closed status', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1' } as any);
      await service.updateStatus('t1', TicketStatus.IN_PROGRESS, admin);
      const call = repo.updateTicket.mock.calls[0][1];
      expect(call.closedAt).toBeUndefined();
    });
  });

  describe('assign', () => {
    it('updates ticket and logs audit', async () => {
      await service.assign('t1', 'a2', admin);
      expect(repo.updateTicket).toHaveBeenCalledWith('t1', { assignedTo: 'a2', status: TicketStatus.IN_PROGRESS });
      expect(audit.log).toHaveBeenCalledWith(admin, 'TICKET_ASSIGNED', expect.objectContaining({ details: 'a2' }));
    });
  });

  describe('aiSummary', () => {
    it('throws NotFoundException when ticket missing', async () => {
      repo.findTicketById.mockResolvedValue(null);
      await expect(service.aiSummary('t1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a message when DeepSeek is unavailable', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', title: 'Bug', category: 'c' } as any);
      repo.findMessagesByTicketId.mockResolvedValue([]);
      deepseek.isAvailable = false;

      const result = await service.aiSummary('t1');
      expect(result.summary).toContain('IA não configurada');
      expect(deepseek.analyze).not.toHaveBeenCalled();
    });

    it('returns AI-generated summary when available', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', title: 'Bug', category: 'c' } as any);
      repo.findMessagesByTicketId.mockResolvedValue([{ senderType: 'USER', content: 'help' }] as any);
      deepseek.analyze.mockResolvedValue({ summary: 'Resumo do ticket' });

      const result = await service.aiSummary('t1');
      expect(result.summary).toBe('Resumo do ticket');
    });

    it('falls back to default message when AI returns nothing', async () => {
      repo.findTicketById.mockResolvedValue({ id: 't1', title: 'Bug', category: 'c' } as any);
      repo.findMessagesByTicketId.mockResolvedValue([]);
      deepseek.analyze.mockResolvedValue(null);

      const result = await service.aiSummary('t1');
      expect(result.summary).toBe('Não foi possível gerar o resumo.');
    });
  });
});
