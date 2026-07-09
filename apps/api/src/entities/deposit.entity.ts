import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

export enum DepositStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Entity('deposits')
@Index(['userId', 'status', 'createdAt'])
export class Deposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'asaas_payment_id', unique: true, nullable: true, type: 'varchar', length: 60 })
  asaasPaymentId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'value_brl' })
  valueBrl: string;

  @Column({ type: 'enum', enum: DepositStatus, default: DepositStatus.PENDING })
  status: DepositStatus;

  @Column({ name: 'qr_code', nullable: true, type: 'text' })
  qrCode: string | null;

  @Column({ name: 'copy_paste', nullable: true, type: 'text' })
  copyPaste: string | null;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date | null;
}
