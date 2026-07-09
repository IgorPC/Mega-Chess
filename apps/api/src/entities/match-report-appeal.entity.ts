import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { MatchReport } from './match-report.entity';

export enum AppealStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
}

@Entity('match_report_appeals')
export class MatchReportAppeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id', unique: true })
  reportId: string;

  @OneToOne(() => MatchReport, (r) => r.appeal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: MatchReport;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  note: string;

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.PENDING })
  status: AppealStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
