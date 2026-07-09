import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum AiFeature {
  WITHDRAWAL_RISK        = 'WITHDRAWAL_RISK',
  MATCH_REPORT           = 'MATCH_REPORT',
  TICKET_SUMMARY         = 'TICKET_SUMMARY',
  SUPPORT_CHATBOT        = 'SUPPORT_CHATBOT',
  MATCH_ANALYSIS         = 'MATCH_ANALYSIS',
  USER_PROFILE_SUMMARY   = 'USER_PROFILE_SUMMARY',
  TOURNAMENT_FRAUD_CHECK = 'TOURNAMENT_FRAUD_CHECK',
}

@Entity('ai_usage_logs')
@Index(['feature', 'createdAt'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AiFeature })
  feature: AiFeature;

  @Column({ type: 'varchar', length: 40 })
  model: string;

  @Column({ name: 'prompt_tokens', type: 'int' })
  promptTokens: number;

  @Column({ name: 'output_tokens', type: 'int' })
  outputTokens: number;

  @Column({ name: 'cost_usd', type: 'decimal', precision: 10, scale: 8 })
  costUsd: string;

  @Column({ name: 'reference_id', nullable: true, type: 'varchar', length: 100 })
  referenceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
