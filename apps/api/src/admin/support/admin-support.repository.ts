import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket, TicketStatus } from '../../entities/support-ticket.entity';
import { TicketMessage } from '../../entities/ticket-message.entity';

@Injectable()
export class AdminSupportRepository {
  constructor(
    @InjectRepository(SupportTicket) private readonly tickets:  Repository<SupportTicket>,
    @InjectRepository(TicketMessage) private readonly messages: Repository<TicketMessage>,
  ) {}

  countTickets(where: string, params: unknown[]) {
    return this.tickets.manager.query<[{ cnt: string }]>(
      `SELECT COUNT(*) as cnt FROM support_tickets t LEFT JOIN users u ON u.id = t.user_id::uuid ${where}`,
      params,
    );
  }

  listTicketsRaw(where: string, params: unknown[]) {
    return this.tickets.manager.query<any[]>(
      `SELECT t.*, u.nickname as user_nickname,
              (SELECT name FROM admin_users WHERE id = t.assigned_to::uuid LIMIT 1) as assigned_to_name
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id::uuid
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      params,
    );
  }

  findTicketById(id: string) {
    return this.tickets.findOne({ where: { id } });
  }

  findAdminNameById(adminId: string) {
    return this.tickets.manager.query('SELECT name FROM admin_users WHERE id = $1::uuid', [adminId]);
  }

  findUserNicknameById(userId: string) {
    return this.tickets.manager.query('SELECT nickname FROM users WHERE id = $1::uuid', [userId]);
  }

  findUserEmailAndNameById(userId: string) {
    return this.tickets.manager.query<{ email: string; name: string }[]>(
      'SELECT email, name FROM users WHERE id = $1::uuid', [userId],
    );
  }

  findMessagesByTicketId(ticketId: string) {
    return this.messages.find({ where: { ticketId }, order: { createdAt: 'ASC' } });
  }

  findUserNicknameBySenderId(senderId: string) {
    return this.messages.manager.query('SELECT nickname FROM users WHERE id = $1::uuid', [senderId]);
  }

  findAdminNameAndRoleBySenderId(senderId: string) {
    return this.messages.manager.query('SELECT name, role FROM admin_users WHERE id = $1::uuid', [senderId]);
  }

  createMessage(data: { ticketId: string; senderType: TicketMessage['senderType']; senderId: string; content: string; isInternal: boolean }) {
    return this.messages.create(data);
  }

  saveMessage(message: TicketMessage) {
    return this.messages.save(message);
  }

  updateTicket(id: string, data: Partial<SupportTicket>) {
    return this.tickets.update(id, data);
  }
}
