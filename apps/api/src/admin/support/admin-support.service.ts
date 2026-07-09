import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupportTicket, TicketStatus } from '../../entities/support-ticket.entity';
import { MessageSenderType } from '../../entities/ticket-message.entity';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminAuditService } from '../admin-audit.service';
import { DeepseekService } from '../../deepseek/deepseek.service';
import { EmailService } from '../../email/email.service';
import { AiFeature } from '../../entities/ai-usage-log.entity';
import { AdminSupportRepository } from './admin-support.repository';
import { ADMIN_SUPPORT_DEFAULTS } from './consts/endpoints';

function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

@Injectable()
export class AdminSupportService {
  private readonly logger = new Logger(AdminSupportService.name);

  constructor(
    private readonly repo: AdminSupportRepository,
    private readonly audit: AdminAuditService,
    private readonly deepseek: DeepseekService,
    private readonly email: EmailService,
  ) {}

  async list(query: { page?: number; limit?: number; status?: string; category?: string; search?: string }) {
    const page  = Number(query.page  ?? ADMIN_SUPPORT_DEFAULTS.PAGE);
    const limit = Number(query.limit ?? ADMIN_SUPPORT_DEFAULTS.LIMIT);

    // Use raw query to avoid TypeORM orderBy resolution issues with joins
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query.status)   { conditions.push(`t.status = $${idx++}`);   params.push(query.status); }
    if (query.category) { conditions.push(`t.category = $${idx++}`); params.push(query.category); }
    if (query.search) {
      conditions.push(`(t.title ILIKE $${idx} OR u.nickname ILIKE $${idx})`);
      params.push(`%${query.search}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await this.repo.countTickets(where, params);
    const total = parseInt(countRow[0]?.cnt ?? '0');

    const offset = paginate(page, limit).skip;
    const rows = await this.repo.listTicketsRaw(where, [...params, limit, offset]);

    const data = rows.map((r) => ({
      id: r.id, title: r.title, status: r.status, category: r.category,
      priority: r.priority, userId: r.user_id, assignedTo: r.assigned_to,
      assignedToId: r.assigned_to, assignedToName: r.assigned_to_name ?? null,
      userNickname: r.user_nickname ?? '', createdAt: r.created_at, updatedAt: r.updated_at,
    }));

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async get(id: string) {
    const ticket = await this.repo.findTicketById(id);
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    let assignedToName: string | null = null;
    if (ticket.assignedTo) {
      const adm = await this.repo.findAdminNameById(ticket.assignedTo);
      assignedToName = adm?.[0]?.name ?? null;
    }
    const user = await this.repo.findUserNicknameById(ticket.userId);
    return { ...ticket, assignedToId: ticket.assignedTo, assignedToName, userNickname: user?.[0]?.nickname ?? '' };
  }

  async getMessages(ticketId: string) {
    const ticket = await this.repo.findTicketById(ticketId);
    if (!ticket) throw new NotFoundException();

    const msgs = await this.repo.findMessagesByTicketId(ticketId);

    return Promise.all(msgs.map(async (m) => {
      let senderName = 'Sistema';
      let senderRole = m.senderType;
      if (m.senderType === MessageSenderType.USER) {
        const u = await this.repo.findUserNicknameBySenderId(m.senderId);
        senderName = u?.[0]?.nickname ?? 'Usuário';
      } else {
        const a = await this.repo.findAdminNameAndRoleBySenderId(m.senderId);
        senderName = a?.[0]?.name ?? 'Admin';
        senderRole = a?.[0]?.role ?? 'ADMIN';
      }
      return { ...m, senderName, senderRole, attachments: [] };
    }));
  }

  async reply(ticketId: string, content: string, isInternal: boolean, admin: AdminUser) {
    const ticket = await this.repo.findTicketById(ticketId);
    if (!ticket) throw new NotFoundException();
    if (ticket.status === TicketStatus.CLOSED) throw new BadRequestException('Ticket fechado');

    const msg = await this.repo.saveMessage(this.repo.createMessage({
      ticketId,
      senderType: MessageSenderType.ADMIN,
      senderId: admin.id,
      content,
      isInternal,
    }));

    if (!isInternal && ticket.status === TicketStatus.WAITING_USER) {
      // Admin replied, move to IN_PROGRESS
    } else if (!isInternal) {
      await this.repo.updateTicket(ticketId, { status: TicketStatus.WAITING_USER, updatedAt: new Date() });
    }

    if (!isInternal) {
      const user = await this.repo.findUserEmailAndNameById(ticket.userId);
      if (user?.[0]) {
        this.email.sendTicketUpdated(user[0].email, user[0].name, ticketId, ticket.title, content);
      }
      this.logger.log(`Admin replied to ticket ticketId=${ticketId} adminId=${admin.id}`);
    }

    return { ...msg, senderName: admin.name, senderRole: admin.role, attachments: [] };
  }

  async updateStatus(ticketId: string, status: TicketStatus, admin: AdminUser) {
    const ticket = await this.repo.findTicketById(ticketId);
    if (!ticket) throw new NotFoundException();
    const update: Partial<SupportTicket> = { status, updatedAt: new Date() };
    if (status === TicketStatus.CLOSED) update.closedAt = new Date();
    await this.repo.updateTicket(ticketId, update);
    this.audit.log(admin, 'TICKET_STATUS_CHANGED', { targetType: 'ticket', targetId: ticketId, details: status });
  }

  async assign(ticketId: string, adminId: string, admin: AdminUser) {
    await this.repo.updateTicket(ticketId, {
      assignedTo: adminId,
      status: TicketStatus.IN_PROGRESS,
    });
    this.audit.log(admin, 'TICKET_ASSIGNED', { targetType: 'ticket', targetId: ticketId, details: adminId });
  }

  async aiSummary(ticketId: string) {
    const ticket = await this.repo.findTicketById(ticketId);
    if (!ticket) throw new NotFoundException();

    const msgs = await this.repo.findMessagesByTicketId(ticketId);
    const conversation = msgs.map((m) => `[${m.senderType}]: ${m.content}`).join('\n');

    if (!this.deepseek.isAvailable) {
      return { summary: 'IA não configurada. Defina DEEPSEEK_API_KEY para usar esta funcionalidade.' };
    }

    const result = await this.deepseek.analyze<{ summary: string }>(
      AiFeature.TICKET_SUMMARY,
      'Você é um assistente de suporte técnico. Resuma o ticket de suporte em português em até 3 frases, identificando o problema, o que já foi tentado e a ação recomendada. Responda em JSON: {"summary": "..."}',
      `Título: ${ticket.title}\nCategoria: ${ticket.category}\n\nConversa:\n${conversation}`,
      ticketId,
      300,
    );

    return { summary: result?.summary ?? 'Não foi possível gerar o resumo.' };
  }
}
