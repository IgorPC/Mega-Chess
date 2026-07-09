import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import { AdminAuditService } from '../admin-audit.service';
import { AdminAuthService } from '../auth/admin-auth.service';
import { AdminStaffRepository } from './admin-staff.repository';
import { ADMIN_STAFF_DEFAULTS } from './consts/endpoints';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminStaffService {
  constructor(
    private readonly repo: AdminStaffRepository,
    private readonly audit: AdminAuditService,
    private readonly authService: AdminAuthService,
  ) {}

  async list(page = ADMIN_STAFF_DEFAULTS.PAGE, limit = ADMIN_STAFF_DEFAULTS.LIMIT) {
    const [data, total] = await this.repo.findAndCountAdmins(page, limit);
    return { data: data.map(this.serialize), total, page, totalPages: Math.ceil(total / limit) };
  }

  async create(
    dto: { name: string; email: string; role: AdminRole },
    admin: AdminUser,
  ) {
    const exists = await this.repo.findAdminByEmail(dto.email);
    if (exists) throw new ConflictException('E-mail já cadastrado');

    const tempPassword = this.authService.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const created = await this.repo.saveAdmin(
      this.repo.createAdmin({ name: dto.name, email: dto.email, role: dto.role, passwordHash, mustChangePassword: true }),
    );
    this.audit.log(admin, 'STAFF_CREATED', { targetType: 'admin_user', targetId: created.id, details: `${dto.email} — ${dto.role}` });
    this.authService.sendWelcomeEmail(dto.email, dto.name, tempPassword);
    return this.serialize(created);
  }

  async update(id: string, dto: { role?: AdminRole; isActive?: boolean }, admin: AdminUser) {
    const target = await this.repo.findAdminById(id);
    if (!target) throw new NotFoundException();
    await this.repo.updateAdmin(id, dto);
    this.audit.log(admin, 'STAFF_UPDATED', { targetType: 'admin_user', targetId: id, details: JSON.stringify(dto) });
  }

  async deactivate(id: string, admin: AdminUser) {
    if (id === admin.id) throw new BadRequestException('Não é possível desativar sua própria conta');
    const target = await this.repo.findAdminById(id);
    if (!target) throw new NotFoundException();
    await this.repo.updateAdmin(id, { isActive: false });
    this.audit.log(admin, 'STAFF_DEACTIVATED', { targetType: 'admin_user', targetId: id });
  }

  async auditLogs(page = ADMIN_STAFF_DEFAULTS.PAGE, limit = ADMIN_STAFF_DEFAULTS.LIMIT) {
    const [data, total] = await this.repo.findAndCountAuditLogs(page, limit);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  private serialize(a: AdminUser) {
    const { passwordHash, ...safe } = a;
    return safe;
  }
}
