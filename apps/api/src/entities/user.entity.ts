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

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ default: 1200 })
  rating: number;

  @Column({ name: 'is_online', default: false })
  isOnline: boolean;

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
