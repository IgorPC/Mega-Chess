import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum TransactionType {
  DEPOSIT              = 'DEPOSIT',
  WITHDRAWAL           = 'WITHDRAWAL',
  WITHDRAWAL_FEE       = 'WITHDRAWAL_FEE',
  TOURNAMENT_ENTRY     = 'TOURNAMENT_ENTRY',
  TOURNAMENT_CREATION_FEE = 'TOURNAMENT_CREATION_FEE',
  ENTRY_RESERVE        = 'ENTRY_RESERVE',
  ENTRY_RELEASE        = 'ENTRY_RELEASE',
  PRIZE                = 'PRIZE',
  RAKE                 = 'RAKE',
  REFUND               = 'REFUND',
}

@Entity('wallet_transactions')
@Index(['userId', 'createdAt'])
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  /** Positive = credit, negative = debit */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'balance_after' })
  balanceAfter: string;

  @Index()
  @Column({ name: 'reference_id', nullable: true, type: 'varchar', length: 100 })
  referenceId: string | null;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

}
