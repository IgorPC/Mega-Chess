import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('admin_audit_logs')
@Index(['adminId', 'createdAt'])
@Index(['targetType', 'targetId'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'admin_id', type: 'varchar', length: 36 })
  adminId: string;

  @Column({ name: 'admin_name', type: 'varchar', length: 100 })
  adminName: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ name: 'target_type', nullable: true, type: 'varchar', length: 50 })
  targetType: string | null;

  @Column({ name: 'target_id', nullable: true, type: 'varchar', length: 36 })
  targetId: string | null;

  @Column({ nullable: true, type: 'text' })
  details: string | null;

  @Column({ name: 'ip_address', nullable: true, type: 'varchar', length: 45 })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
