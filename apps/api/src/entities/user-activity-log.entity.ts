import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

export enum UserAction {
  // Auth
  AUTH_REGISTER = 'AUTH_REGISTER',
  AUTH_LOGIN = 'AUTH_LOGIN',
  AUTH_LOGIN_FAILED = 'AUTH_LOGIN_FAILED',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_TOKEN_REFRESH = 'AUTH_TOKEN_REFRESH',
  AUTH_PASSWORD_RESET = 'AUTH_PASSWORD_RESET',
  // Matches
  MATCH_STARTED = 'MATCH_STARTED',
  MATCH_FINISHED = 'MATCH_FINISHED',
  MATCH_FORFEITED = 'MATCH_FORFEITED',
  MATCHMAKING_JOINED = 'MATCHMAKING_JOINED',
  MATCHMAKING_LEFT = 'MATCHMAKING_LEFT',
  CHALLENGE_SENT = 'CHALLENGE_SENT',
  CHALLENGE_ACCEPTED = 'CHALLENGE_ACCEPTED',
  CHALLENGE_REJECTED = 'CHALLENGE_REJECTED',
  MATCH_REPORTED = 'MATCH_REPORTED',
  MATCH_REPORT_APPEALED = 'MATCH_REPORT_APPEALED',
  // Social
  FRIEND_REQUEST_SENT = 'FRIEND_REQUEST_SENT',
  FRIEND_REQUEST_ACCEPTED = 'FRIEND_REQUEST_ACCEPTED',
  FRIEND_REQUEST_REJECTED = 'FRIEND_REQUEST_REJECTED',
  FRIEND_REMOVED = 'FRIEND_REMOVED',
  // Financial
  DEPOSIT_INITIATED = 'DEPOSIT_INITIATED',
  DEPOSIT_CONFIRMED = 'DEPOSIT_CONFIRMED',
  DEPOSIT_EXPIRED = 'DEPOSIT_EXPIRED',
  DEPOSIT_CANCELLED = 'DEPOSIT_CANCELLED',
  WITHDRAWAL_REQUESTED = 'WITHDRAWAL_REQUESTED',
  WITHDRAWAL_PROCESSED = 'WITHDRAWAL_PROCESSED',
  WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED',
  WITHDRAWAL_BLOCKED = 'WITHDRAWAL_BLOCKED',
  PRIZE_RECEIVED = 'PRIZE_RECEIVED',
  // Tournaments
  TOURNAMENT_JOINED = 'TOURNAMENT_JOINED',
  TOURNAMENT_LEFT = 'TOURNAMENT_LEFT',
  TOURNAMENT_FINISHED = 'TOURNAMENT_FINISHED',
  // Profile
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  AVATAR_UPDATED = 'AVATAR_UPDATED',
  PIX_KEY_UPDATED = 'PIX_KEY_UPDATED',
  CPF_REGISTERED = 'CPF_REGISTERED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  TERMS_ACCEPTED = 'TERMS_ACCEPTED',
  // Support
  SUPPORT_TICKET_CREATED = 'SUPPORT_TICKET_CREATED',
  SUPPORT_TICKET_REPLIED = 'SUPPORT_TICKET_REPLIED',
  // Admin
  ELO_ADJUSTED_BY_ADMIN = 'ELO_ADJUSTED_BY_ADMIN',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  SUSPENSION_REMOVED = 'SUSPENSION_REMOVED',
}

@Entity('user_activity_logs')
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
export class UserActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: UserAction })
  action: UserAction;

  @Column({ type: 'jsonb', nullable: true })
  metadata: object | null;

  @Column({ name: 'ip_address', nullable: true, type: 'varchar', length: 45 })
  ipAddress: string | null;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
