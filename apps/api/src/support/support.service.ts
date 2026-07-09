import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket, TicketStatus, TicketPriority } from '../entities/support-ticket.entity';
import { TicketMessage, MessageSenderType } from '../entities/ticket-message.entity';
import { TicketAttachment } from '../entities/ticket-attachment.entity';
import { User } from '../entities/user.entity';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';
import { EmailService } from '../email/email.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';

const SLA_HOURS: Record<TicketPriority, number> = {
  [TicketPriority.HIGH]: 2,
  [TicketPriority.MEDIUM]: 8,
  [TicketPriority.LOW]: 24,
};

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(SupportTicket) private tickets: Repository<SupportTicket>,
    @InjectRepository(TicketMessage) private messages: Repository<TicketMessage>,
    @InjectRepository(TicketAttachment) private attachments: Repository<TicketAttachment>,
    @InjectRepository(User) private users: Repository<User>,
    private activity: UserActivityService,
    private email: EmailService,
  ) {}

  async createTicket(userId: string, dto: CreateTicketDto): Promise<SupportTicket> {
    const slaDeadline = new Date(
      Date.now() + SLA_HOURS[TicketPriority.MEDIUM] * 60 * 60 * 1000,
    );

    const ticket = await this.tickets.save(
      this.tickets.create({
        userId,
        category: dto.category,
        title: dto.title,
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        slaDeadline,
      }),
    );

    await this.messages.save(
      this.messages.create({
        ticketId: ticket.id,
        senderType: MessageSenderType.USER,
        senderId: userId,
        content: dto.description,
        isInternal: false,
      }),
    );

    this.activity.log(userId, UserAction.SUPPORT_TICKET_CREATED, {
      ticketId: ticket.id,
      category: dto.category,
    });

    this.logger.log(`Support ticket created ticketId=${ticket.id} userId=${userId} category=${dto.category}`);
    this.users.findOne({ where: { id: userId }, select: ['email', 'name'] }).then((user) => {
      if (user) this.email.sendTicketOpened(user.email, user.name, ticket.id, dto.title, dto.category);
    }).catch((err) => {
      this.logger.warn(`Failed to send ticket opened email ticketId=${ticket.id}`, err instanceof Error ? err.stack : String(err));
    });

    return this.tickets.findOne({
      where: { id: ticket.id },
      relations: ['messages'],
    });
  }

  async getMyTickets(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.tickets.findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getTicket(userId: string, ticketId: string): Promise<SupportTicket> {
    const ticket = await this.tickets.findOne({
      where: { id: ticketId },
      relations: ['messages', 'messages.attachments'],
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    if (ticket.userId !== userId) throw new ForbiddenException('Acesso negado');

    // Filter out internal notes from user view
    ticket.messages = ticket.messages.filter((m) => !m.isInternal);
    return ticket;
  }

  async addMessage(
    userId: string,
    ticketId: string,
    dto: CreateMessageDto,
  ): Promise<TicketMessage> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    if (ticket.userId !== userId) throw new ForbiddenException('Acesso negado');
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Este ticket está fechado');
    }

    const message = await this.messages.save(
      this.messages.create({
        ticketId,
        senderType: MessageSenderType.USER,
        senderId: userId,
        content: dto.content,
        isInternal: false,
      }),
    );

    // If admin was waiting on user, move back to IN_PROGRESS
    if (ticket.status === TicketStatus.WAITING_USER) {
      await this.tickets.update(ticketId, { status: TicketStatus.IN_PROGRESS });
    }

    this.activity.log(userId, UserAction.SUPPORT_TICKET_REPLIED, { ticketId });

    return message;
  }

  async attachFile(
    userId: string,
    ticketId: string,
    messageId: string,
    file: Express.Multer.File,
  ): Promise<TicketAttachment> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    if (ticket.userId !== userId) throw new ForbiddenException('Acesso negado');

    const message = await this.messages.findOne({ where: { id: messageId, ticketId } });
    if (!message) throw new NotFoundException('Mensagem não encontrada');

    return this.attachments.save(
      this.attachments.create({
        messageId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        filePath: file.path,
        fileSizeKb: Math.ceil(file.size / 1024),
      }),
    );
  }

  async getAttachment(userId: string, ticketId: string, attachmentId: string) {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    if (ticket.userId !== userId) throw new ForbiddenException('Acesso negado');

    const attachment = await this.attachments.findOne({
      where: { id: attachmentId },
      relations: ['message'],
    });
    if (!attachment || attachment.message.ticketId !== ticketId) {
      throw new NotFoundException('Anexo não encontrado');
    }
    return attachment;
  }
}
