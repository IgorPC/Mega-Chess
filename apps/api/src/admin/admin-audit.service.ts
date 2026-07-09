import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AdminUser } from '../entities/admin-user.entity';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectRepository(AdminAuditLog) private repo: Repository<AdminAuditLog>,
  ) {}

  log(
    admin: Pick<AdminUser, 'id' | 'name'>,
    action: string,
    opts: { targetType?: string; targetId?: string; details?: string; ip?: string } = {},
  ) {
    this.repo.save(
      this.repo.create({
        adminId: admin.id,
        adminName: admin.name,
        action,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        details: opts.details ?? null,
        ipAddress: opts.ip ?? null,
      }),
    ).catch((err) => {
      this.logger.warn(`Failed to write audit log action=${action} adminId=${admin.id}`, err instanceof Error ? err.stack : String(err));
    });
  }

  async list(query: {
    page?: number;
    limit?: number;
    adminId?: string;
    action?: string;
    targetType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const page  = Number(query.page  ?? 1);
    const limit = Math.min(Number(query.limit ?? 25), 100);

    const qb = this.repo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');

    if (query.adminId)    qb.andWhere('a.adminId = :adminId',        { adminId: query.adminId });
    if (query.action)     qb.andWhere('a.action ILIKE :action',      { action: `%${query.action}%` });
    if (query.targetType) qb.andWhere('a.targetType = :targetType',  { targetType: query.targetType });
    if (query.dateFrom)   qb.andWhere('a.createdAt >= :dateFrom',    { dateFrom: new Date(query.dateFrom) });
    if (query.dateTo)     qb.andWhere('a.createdAt <= :dateTo',      { dateTo: new Date(query.dateTo + 'T23:59:59.999Z') });

    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async exportCsv(query: {
    adminId?: string;
    action?: string;
    targetType?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { data } = await this.list({ ...query, page: 1, limit: 5000 });
    const header = 'id,admin_id,admin_name,action,target_type,target_id,details,ip_address,created_at\n';
    const rows = (data as AdminAuditLog[]).map((r) =>
      [
        r.id,
        r.adminId,
        `"${r.adminName.replace(/"/g, '""')}"`,
        r.action,
        r.targetType ?? '',
        r.targetId ?? '',
        `"${(r.details ?? '').replace(/"/g, '""')}"`,
        r.ipAddress ?? '',
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      ].join(',')
    ).join('\n');
    return header + rows;
  }
}
