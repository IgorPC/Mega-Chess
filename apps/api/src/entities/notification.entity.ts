import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  FRIEND_REQUEST = 'FRIEND_REQUEST',
  FRIEND_ACCEPTED = 'FRIEND_ACCEPTED',
  GAME_CHALLENGE = 'GAME_CHALLENGE',
  GAME_STARTED = 'GAME_STARTED',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  MATCH_REPORT_RESULT = 'MATCH_REPORT_RESULT',
  ADMIN_MESSAGE = 'ADMIN_MESSAGE',
  MAINTENANCE_ALERT = 'MAINTENANCE_ALERT',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  // Torneios criados por jogadores
  TOURNAMENT_INVITE    = 'TOURNAMENT_INVITE',
  TOURNAMENT_STARTED   = 'TOURNAMENT_STARTED',
  TOURNAMENT_CANCELLED = 'TOURNAMENT_CANCELLED',
  TOURNAMENT_KICKED    = 'TOURNAMENT_KICKED',
  TOURNAMENT_PRIZE_RELEASED = 'TOURNAMENT_PRIZE_RELEASED',
  TOURNAMENT_PRIZE_FLAGGED  = 'TOURNAMENT_PRIZE_FLAGGED',
  TOURNAMENT_ALMOST_FULL    = 'TOURNAMENT_ALMOST_FULL',
  // Duelos 1v1
  DUEL_INVITE = 'DUEL_INVITE',
}

@Entity('notifications')
@Index(['userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (u) => u.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'jsonb', default: '{}' })
  payload: object;

  @Column({ name: 'read_at', nullable: true })
  readAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
