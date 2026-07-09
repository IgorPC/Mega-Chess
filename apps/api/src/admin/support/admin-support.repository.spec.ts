import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminSupportRepository } from './admin-support.repository';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { TicketMessage } from '../../entities/ticket-message.entity';

describe('AdminSupportRepository', () => {
  let repository: AdminSupportRepository;
  let tickets: jest.Mocked<Repository<SupportTicket>>;
  let messages: jest.Mocked<Repository<TicketMessage>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminSupportRepository,
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: {
            manager: { query: jest.fn() },
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TicketMessage),
          useValue: {
            manager: { query: jest.fn() },
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get(AdminSupportRepository);
    tickets = module.get(getRepositoryToken(SupportTicket));
    messages = module.get(getRepositoryToken(TicketMessage));
  });

  it('countTickets runs a joined count query', async () => {
    (tickets.manager.query as jest.Mock).mockResolvedValue([{ cnt: '3' }]);
    const result = await repository.countTickets('WHERE t.status = $1', ['OPEN']);
    expect(tickets.manager.query).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'), ['OPEN']);
    expect(result).toEqual([{ cnt: '3' }]);
  });

  it('listTicketsRaw runs a joined select with limit/offset params', async () => {
    (tickets.manager.query as jest.Mock).mockResolvedValue([]);
    await repository.listTicketsRaw('', [25, 0]);
    expect(tickets.manager.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY t.created_at DESC'), [25, 0]);
  });

  it('findTicketById delegates to findOne', async () => {
    (tickets.findOne as jest.Mock).mockResolvedValue({ id: 't1' });
    const result = await repository.findTicketById('t1');
    expect(tickets.findOne).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(result).toEqual({ id: 't1' });
  });

  it('findAdminNameById queries admin_users', async () => {
    (tickets.manager.query as jest.Mock).mockResolvedValue([{ name: 'Admin' }]);
    const result = await repository.findAdminNameById('a1');
    expect(tickets.manager.query).toHaveBeenCalledWith(expect.stringContaining('admin_users'), ['a1']);
    expect(result).toEqual([{ name: 'Admin' }]);
  });

  it('findUserNicknameById queries users', async () => {
    (tickets.manager.query as jest.Mock).mockResolvedValue([{ nickname: 'nick' }]);
    await repository.findUserNicknameById('u1');
    expect(tickets.manager.query).toHaveBeenCalledWith(expect.stringContaining('FROM users'), ['u1']);
  });

  it('findUserEmailAndNameById queries users email/name', async () => {
    (tickets.manager.query as jest.Mock).mockResolvedValue([{ email: 'a@b.com', name: 'A' }]);
    const result = await repository.findUserEmailAndNameById('u1');
    expect(result).toEqual([{ email: 'a@b.com', name: 'A' }]);
  });

  it('findMessagesByTicketId orders by createdAt asc', async () => {
    (messages.find as jest.Mock).mockResolvedValue([]);
    await repository.findMessagesByTicketId('t1');
    expect(messages.find).toHaveBeenCalledWith({ where: { ticketId: 't1' }, order: { createdAt: 'ASC' } });
  });

  it('findUserNicknameBySenderId queries users', async () => {
    (messages.manager.query as jest.Mock).mockResolvedValue([{ nickname: 'x' }]);
    await repository.findUserNicknameBySenderId('u1');
    expect(messages.manager.query).toHaveBeenCalledWith(expect.stringContaining('FROM users'), ['u1']);
  });

  it('findAdminNameAndRoleBySenderId queries admin_users', async () => {
    (messages.manager.query as jest.Mock).mockResolvedValue([{ name: 'Admin', role: 'ADMIN' }]);
    await repository.findAdminNameAndRoleBySenderId('a1');
    expect(messages.manager.query).toHaveBeenCalledWith(expect.stringContaining('admin_users'), ['a1']);
  });

  it('createMessage delegates to messages.create', () => {
    (messages.create as jest.Mock).mockReturnValue({ id: 'm1' });
    const result = repository.createMessage({
      ticketId: 't1', senderType: 'ADMIN' as any, senderId: 'a1', content: 'hi', isInternal: false,
    });
    expect(messages.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 'm1' });
  });

  it('saveMessage delegates to messages.save', async () => {
    (messages.save as jest.Mock).mockResolvedValue({ id: 'm1' });
    const result = await repository.saveMessage({ id: 'm1' } as any);
    expect(messages.save).toHaveBeenCalledWith({ id: 'm1' });
    expect(result).toEqual({ id: 'm1' });
  });

  it('updateTicket delegates to tickets.update', async () => {
    (tickets.update as jest.Mock).mockResolvedValue({ affected: 1 });
    await repository.updateTicket('t1', { status: 'CLOSED' as any });
    expect(tickets.update).toHaveBeenCalledWith('t1', { status: 'CLOSED' });
  });
});
