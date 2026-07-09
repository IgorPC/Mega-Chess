import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('messages')
@Index(['senderId', 'receiverId'])
@Index(['receiverId', 'readAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'sender_id' })
  senderId: string;

  @Index()
  @Column({ name: 'receiver_id' })
  receiverId: string;

  @ManyToOne(() => User, (u) => u.sentMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ManyToOne(() => User, (u) => u.receivedMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({ type: 'text' })
  content: string;

  @Index()
  @Column({ name: 'read_at', nullable: true })
  readAt: Date;

  @Index()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
