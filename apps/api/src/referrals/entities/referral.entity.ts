import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  referrerId: string;

  @Column('uuid')
  referredId: string;

  @Column({ default: true })
  isEligible: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
