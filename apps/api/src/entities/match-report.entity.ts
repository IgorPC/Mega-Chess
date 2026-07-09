import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';
import { Match } from './match.entity';
import { MatchReportAppeal } from './match-report-appeal.entity';

export enum ReportVerdict {
  CLEAN = 'CLEAN',
  SUSPICIOUS = 'SUSPICIOUS',
  CHEATING = 'CHEATING',
}

export enum ReportStatus {
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
}

export enum ReportResolution {
  DISMISSED = 'DISMISSED',
  WARNED = 'WARNED',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

@Entity('match_reports')
@Index(['matchId', 'reporterId'], { unique: true })
@Index(['status', 'createdAt'])
export class MatchReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'match_id' })
  matchId: string;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @Column({ name: 'reporter_id' })
  reporterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reported_user_id' })
  reportedUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reported_user_id' })
  reportedUser: User;

  @Column({ name: 'reporter_note', nullable: true, type: 'text' })
  reporterNote: string | null;

  @Column({ name: 'ai_verdict', type: 'enum', enum: ReportVerdict, nullable: true })
  aiVerdict: ReportVerdict | null;

  @Column({ name: 'ai_confidence', type: 'decimal', precision: 4, scale: 3, nullable: true })
  aiConfidence: string | null;

  @Column({ name: 'ai_flags', type: 'jsonb', nullable: true })
  aiFlags: string[] | null;

  @Column({ name: 'ai_explanation', nullable: true, type: 'text' })
  aiExplanation: string | null;

  @Column({ name: 'ai_raw_response', type: 'jsonb', nullable: true })
  aiRawResponse: object | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.ANALYZING })
  status: ReportStatus;

  @Column({ type: 'enum', enum: ReportResolution, nullable: true })
  resolution: ReportResolution | null;

  @Column({ name: 'admin_note', nullable: true, type: 'text' })
  adminNote: string | null;

  @Column({ name: 'resolved_by', nullable: true, type: 'varchar', length: 36 })
  resolvedBy: string | null;

  @Column({ name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => MatchReportAppeal, (a) => a.report)
  appeal: MatchReportAppeal;
}
