import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { TicketMessage } from './ticket-message.entity';

export enum TicketCategory {
  PAYMENT = 'PAYMENT',
  MATCH = 'MATCH',
  ACCOUNT = 'ACCOUNT',
  TECHNICAL = 'TECHNICAL',
  OTHER = 'OTHER',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_USER = 'WAITING_USER',
  CLOSED = 'CLOSED',
}

export enum TicketCloseReason {
  RESOLVED = 'RESOLVED',
  NOT_REPRODUCIBLE = 'NOT_REPRODUCIBLE',
  DUPLICATE = 'DUPLICATE',
  NO_RESPONSE = 'NO_RESPONSE',
  FRAUD = 'FRAUD',
}

@Entity('support_tickets')
@Index(['userId', 'status'])
@Index(['status', 'priority'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: TicketCategory })
  category: TicketCategory;

  @Column({ type: 'enum', enum: TicketPriority, default: TicketPriority.MEDIUM })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  status: TicketStatus;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'assigned_to', nullable: true, type: 'varchar', length: 36 })
  assignedTo: string | null;

  @Column({ name: 'close_reason', type: 'enum', enum: TicketCloseReason, nullable: true })
  closeReason: TicketCloseReason | null;

  @Column({ name: 'close_note', nullable: true, type: 'text' })
  closeNote: string | null;

  @Column({ name: 'sla_deadline', nullable: true })
  slaDeadline: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'closed_at', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => TicketMessage, (m) => m.ticket, { cascade: true })
  messages: TicketMessage[];
}
