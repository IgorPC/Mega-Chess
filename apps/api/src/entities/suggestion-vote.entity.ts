import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { User } from './user.entity';
import { ImprovementSuggestion } from './improvement-suggestion.entity';

@Entity('suggestion_votes')
@Unique(['suggestionId', 'userId'])
export class SuggestionVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'suggestion_id' })
  suggestionId: string;

  @ManyToOne(() => ImprovementSuggestion, (s) => s.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'suggestion_id' })
  suggestion: ImprovementSuggestion;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
