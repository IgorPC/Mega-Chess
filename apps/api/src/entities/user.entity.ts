import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Match } from './match.entity';
import { Friendship } from './friendship.entity';
import { Message } from './message.entity';
import { MatchChatMessage } from './match-chat-message.entity';
import { Notification } from './notification.entity';
import { Review } from './review.entity';
import { RefreshToken } from './refresh-token.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ unique: true })
  nickname: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'avatar_url', nullable: true, type: 'text' })
  avatarUrl: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ default: 1200 })
  rating: number;

  @Column({ name: 'is_online', default: false })
  isOnline: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'terms_accepted_at', nullable: true, type: 'timestamptz' })
  termsAcceptedAt: Date | null;

  @Column({ name: 'terms_version', nullable: true, type: 'varchar', length: 20 })
  termsVersion: string | null;

  @Column({ name: 'asaas_customer_id', nullable: true, type: 'varchar', length: 60 })
  asaasCustomerId: string | null;

  /** Full legal name for billing (Asaas customer) */
  @Column({ name: 'billing_name', nullable: true, type: 'varchar', length: 120 })
  billingName: string | null;

  /** Birth date for billing */
  @Column({ name: 'birth_date', nullable: true, type: 'date' })
  birthDate: string | null;

  /** CPF (digits only) — required for first deposit/withdrawal */
  @Column({ nullable: true, type: 'varchar', length: 14 })
  cpf: string | null;

  @Column({ name: 'pix_key', nullable: true, type: 'varchar', length: 150 })
  pixKey: string | null;

  @Column({ name: 'pix_key_type', nullable: true, type: 'varchar', length: 10 })
  pixKeyType: string | null;

  @Column({ name: 'referral_code', type: 'varchar', length: 12, unique: true, nullable: true })
  referralCode: string | null;

  @Column({ name: 'referred_by', type: 'uuid', nullable: true })
  referredBy: string | null;

  @Column({ name: 'avg_rating', type: 'float', nullable: true, default: null })
  avgRating: number | null;

  @Column({ name: 'review_count', type: 'int', default: 0 })
  reviewCount: number;

  @Column({ name: 'banned_until', nullable: true, type: 'timestamptz' })
  bannedUntil: Date | null;

  @Column({ name: 'banned_reason', nullable: true, type: 'text' })
  bannedReason: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'email_verification_token', nullable: true, type: 'varchar', length: 36 })
  emailVerificationToken: string | null;

  @Column({ name: 'email_verification_expires_at', nullable: true, type: 'timestamptz' })
  emailVerificationExpiresAt: Date | null;

  @Column({ name: 'is_bot', default: false })
  isBot: boolean;

  @Column({ name: 'bot_difficulty', nullable: true, type: 'varchar', length: 10 })
  botDifficulty: 'EASY' | 'MEDIUM' | 'HARD' | null;

  @Column({ type: 'varchar', length: 2, default: 'pt' })
  locale: 'pt' | 'en';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Match, (m) => m.whitePlayer)
  whiteMatches: Match[];

  @OneToMany(() => Match, (m) => m.blackPlayer)
  blackMatches: Match[];

  @OneToMany(() => Friendship, (f) => f.requester)
  sentRequests: Friendship[];

  @OneToMany(() => Friendship, (f) => f.receiver)
  receivedRequests: Friendship[];

  @OneToMany(() => Message, (m) => m.sender)
  sentMessages: Message[];

  @OneToMany(() => Message, (m) => m.receiver)
  receivedMessages: Message[];

  @OneToMany(() => MatchChatMessage, (m) => m.sender)
  matchChats: MatchChatMessage[];

  @OneToMany(() => Notification, (n) => n.user)
  notifications: Notification[];

  @OneToMany(() => Review, (r) => r.reviewer)
  reviewsGiven: Review[];

  @OneToMany(() => Review, (r) => r.reviewed)
  reviewsReceived: Review[];

  @OneToMany(() => RefreshToken, (r) => r.user)
  refreshTokens: RefreshToken[];
}
