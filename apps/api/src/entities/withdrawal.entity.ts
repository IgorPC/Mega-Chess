import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  ANALYZING = 'ANALYZING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  FAILED = 'FAILED',
}

export enum PixKeyType {
  CPF = 'CPF',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  EVP = 'EVP',
}

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'asaas_transfer_id', nullable: true, type: 'varchar', length: 60 })
  asaasTransferId: string | null;

  /** $CC amount debited (before fee) */
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'value_cc' })
  valueCc: string;

  /** BRL amount to send via PIX (value_cc - fee_cc) */
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'value_brl' })
  valueBrl: string;

  /** 2% of value_cc, minimum 2 $CC */
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'fee_cc' })
  feeCc: string;

  @Column({ name: 'pix_key', type: 'varchar', length: 150 })
  pixKey: string;

  @Column({ name: 'pix_key_type', type: 'enum', enum: PixKeyType })
  pixKeyType: PixKeyType;

  @Column({ type: 'enum', enum: WithdrawalStatus, default: WithdrawalStatus.PENDING })
  status: WithdrawalStatus;

  @Column({ name: 'block_reason', nullable: true, type: 'text' })
  blockReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date | null;
}
