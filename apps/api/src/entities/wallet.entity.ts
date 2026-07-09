import {
  Entity, PrimaryGeneratedColumn, Column, OneToOne,
  JoinColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '0.00' })
  balance: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
