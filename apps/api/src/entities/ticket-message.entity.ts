import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { TicketAttachment } from './ticket-attachment.entity';

export enum MessageSenderType {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

@Entity('ticket_messages')
@Index(['ticketId', 'createdAt'])
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'ticket_id' })
  ticketId: string;

  @ManyToOne(() => SupportTicket, (t) => t.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @Column({ name: 'sender_type', type: 'enum', enum: MessageSenderType })
  senderType: MessageSenderType;

  @Column({ name: 'sender_id', type: 'varchar', length: 36 })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'is_internal', default: false })
  isInternal: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => TicketAttachment, (a) => a.message, { cascade: true })
  attachments: TicketAttachment[];
}
