import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import { AdminAuditLog } from '../../entities/admin-audit-log.entity';
import { UserActivityLog } from '../../entities/user-activity-log.entity';

function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

@Injectable()
export class AdminStaffRepository {
  constructor(
    @InjectRepository(AdminUser)       private readonly admins:      Repository<AdminUser>,
    @InjectRepository(AdminAuditLog)   private readonly auditRepo:   Repository<AdminAuditLog>,
    @InjectRepository(UserActivityLog) private readonly activityRepo: Repository<UserActivityLog>,
  ) {}

  findAndCountAdmins(page: number, limit: number) {
    return this.admins.findAndCount({
      order: { createdAt: 'DESC' },
      ...paginate(page, limit),
    });
  }

  findAdminByEmail(email: string) {
    return this.admins.findOne({ where: { email } });
  }

  findAdminById(id: string) {
    return this.admins.findOne({ where: { id } });
  }

  createAdmin(data: { name: string; email: string; role: AdminRole; passwordHash: string; mustChangePassword: boolean }) {
    return this.admins.create(data);
  }

  saveAdmin(admin: AdminUser) {
    return this.admins.save(admin);
  }

  updateAdmin(id: string, data: Partial<AdminUser>) {
    return this.admins.update(id, data);
  }

  findAndCountAuditLogs(page: number, limit: number) {
    return this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      ...paginate(page, limit),
    });
  }

  queryUserActivity(filters: {
    page: number;
    limit: number;
    userId?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page, limit, userId, action, dateFrom, dateTo } = filters;
    const qb = this.activityRepo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    if (userId)   qb.andWhere('a.userId = :userId',   { userId });
    if (action)   qb.andWhere('a.action ILIKE :action', { action: `%${action}%` });
    if (dateFrom) qb.andWhere('a.createdAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    if (dateTo)   qb.andWhere('a.createdAt <= :dateTo',   { dateTo: new Date(dateTo + 'T23:59:59.999Z') });
    return qb.skip((page - 1) * limit).take(limit).getManyAndCount();
  }
}
