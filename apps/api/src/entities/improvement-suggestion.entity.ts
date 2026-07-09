import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { SuggestionVote } from './suggestion-vote.entity';

export enum SuggestionStatus {
  OPEN = 'OPEN',
  HIDDEN = 'HIDDEN',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

@Entity('improvement_suggestions')
@Index(['status', 'voteCount'])
export class ImprovementSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'author_id' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: SuggestionStatus, default: SuggestionStatus.OPEN })
  status: SuggestionStatus;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ name: 'vote_count', type: 'int', default: 0 })
  voteCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => SuggestionVote, (v) => v.suggestion, { cascade: true })
  votes: SuggestionVote[];
}
