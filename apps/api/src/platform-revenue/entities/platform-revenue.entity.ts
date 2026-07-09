import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum PlatformRevenueType {
  RAKE_DUEL        = 'RAKE_DUEL',
  RAKE_TOURNAMENT  = 'RAKE_TOURNAMENT',
  WITHDRAWAL_FEE   = 'WITHDRAWAL_FEE',
  CREATION_FEE     = 'CREATION_FEE',
}

@Entity('platform_revenue')
@Index(['type', 'createdAt'])
export class PlatformRevenue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PlatformRevenueType })
  type: PlatformRevenueType;

  @Column({ name: 'amount_cc', type: 'decimal', precision: 12, scale: 2 })
  amountCc: string;

  @Index()
  @Column({ name: 'reference_id', type: 'varchar', length: 36 })
  referenceId: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
