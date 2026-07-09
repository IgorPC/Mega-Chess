import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToMany, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { MatchChatMessage } from './match-chat-message.entity';
import { Review } from './review.entity';

export enum MatchStatus {
  WAITING = 'WAITING',
  ONGOING = 'ONGOING',
  FINISHED = 'FINISHED',
}

export enum MatchResult {
  WHITE_WINS = 'WHITE_WINS',
  BLACK_WINS = 'BLACK_WINS',
  DRAW = 'DRAW',
  FORFEIT_WHITE = 'FORFEIT_WHITE',
  FORFEIT_BLACK = 'FORFEIT_BLACK',
  TIMEOUT_WHITE = 'TIMEOUT_WHITE',
  TIMEOUT_BLACK = 'TIMEOUT_BLACK',
}

export enum MatchTurn {
  WHITE = 'white',
  BLACK = 'black',
}

export enum AiDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

@Entity('matches')
@Index(['whitePlayerId', 'status'])
@Index(['blackPlayerId', 'status'])
@Index(['status', 'isOffline'])
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'white_player_id' })
  whitePlayerId: string;

  @Column({ name: 'black_player_id', nullable: true })
  blackPlayerId: string | null;

  @ManyToOne(() => User, (u) => u.whiteMatches)
  @JoinColumn({ name: 'white_player_id' })
  whitePlayer: User;

  @ManyToOne(() => User, (u) => u.blackMatches, { nullable: true })
  @JoinColumn({ name: 'black_player_id' })
  blackPlayer: User | null;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.WAITING })
  status: MatchStatus;

  @Column({ type: 'enum', enum: MatchResult, nullable: true })
  result: MatchResult;

  @Column({ default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', type: 'text' })
  fen: string;

  @Column({ default: '', type: 'text' })
  pgn: string;

  @Column({ type: 'jsonb', default: '[]' })
  moves: any[];

  @Column({ name: 'current_turn', type: 'enum', enum: MatchTurn, default: MatchTurn.WHITE })
  currentTurn: MatchTurn;

  @Column({ name: 'white_rating_before', nullable: true })
  whiteRatingBefore: number;

  @Column({ name: 'black_rating_before', nullable: true })
  blackRatingBefore: number;

  @Column({ name: 'white_rating_after', nullable: true })
  whiteRatingAfter: number;

  @Column({ name: 'black_rating_after', nullable: true })
  blackRatingAfter: number;

  @Column({ name: 'is_offline', default: false })
  isOffline: boolean;

  @Column({ name: 'ai_difficulty', type: 'enum', enum: AiDifficulty, nullable: true })
  aiDifficulty: AiDifficulty | null;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'finished_at', nullable: true })
  finishedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => MatchChatMessage, (m) => m.match)
  chatMessages: MatchChatMessage[];

  @OneToMany(() => Review, (r) => r.match)
  reviews: Review[];
}
