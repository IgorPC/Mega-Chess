import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export enum AdminRole {
  SUPORTE    = 'SUPORTE',
  FINANCEIRO = 'FINANCEIRO',
  OPERADOR   = 'OPERADOR',
  ADMIN      = 'ADMIN',
}

export const ROLE_HIERARCHY: Record<AdminRole, number> = {
  [AdminRole.SUPORTE]:    1,
  [AdminRole.FINANCEIRO]: 2,
  [AdminRole.OPERADOR]:   3,
  [AdminRole.ADMIN]:      4,
};

@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'enum', enum: AdminRole, default: AdminRole.SUPORTE })
  role: AdminRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'must_change_password', default: true })
  mustChangePassword: boolean;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
