import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Match } from './match.entity';

@Entity('reviews')
@Unique(['reviewerId', 'matchId'])
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reviewer_id' })
  reviewerId: string;

  @Column({ name: 'reviewed_id' })
  reviewedId: string;

  @Column({ name: 'match_id' })
  matchId: string;

  @ManyToOne(() => User, (u) => u.reviewsGiven, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  @ManyToOne(() => User, (u) => u.reviewsReceived, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewed_id' })
  reviewed: User;

  @ManyToOne(() => Match, (m) => m.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @Column()
  rating: number;

  @Column({ nullable: true, type: 'text' })
  comment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
