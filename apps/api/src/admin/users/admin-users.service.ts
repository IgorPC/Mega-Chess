import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { AdminAuditService } from '../admin-audit.service';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminUsersRepository } from './admin-users.repository';
import { ADMIN_USERS_DEFAULTS, ADMIN_USERS_ELO_MIN, ADMIN_USERS_ELO_MAX, ADMIN_USERS_SUSPEND_REASON_MIN_LENGTH } from './consts/endpoints';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly repo: AdminUsersRepository,
    private readonly audit: AdminAuditService,
  ) {}

  async list(query: { page?: number; limit?: number; search?: string; status?: string }) {
    const page  = Number(query.page  ?? ADMIN_USERS_DEFAULTS.PAGE);
    const limit = Number(query.limit ?? ADMIN_USERS_DEFAULTS.LIMIT);
    const qb = this.repo.createUsersQueryBuilder();

    if (query.search) {
      qb.where('u.nickname ILIKE :q OR u.email ILIKE :q', { q: `%${query.search}%` });
    }
    if (query.status === 'BANNED') {
      qb.andWhere("u.banned_until > NOW() AND EXTRACT(YEAR FROM u.banned_until) > 2100");
    } else if (query.status === 'SUSPENDED') {
      qb.andWhere("u.banned_until > NOW() AND EXTRACT(YEAR FROM u.banned_until) <= 2100");
    } else if (query.status === 'ACTIVE') {
      qb.andWhere('(u.banned_until IS NULL OR u.banned_until <= NOW())');
    }

    qb.orderBy('u.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async get(id: string) {
    const user = await this.repo.findUserById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    const wallet = await this.repo.findWalletByUserId(id);
    return { ...user, walletBalance: wallet?.balance ?? '0.00' };
  }

  async transactions(id: string, page = ADMIN_USERS_DEFAULTS.PAGE, limit = ADMIN_USERS_DEFAULTS.LIMIT) {
    const [data, total] = await this.repo.findAndCountTransactions(id, page, limit);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async tickets(id: string) {
    return this.repo.findTicketsByUserId(id);
  }

  async activityLogs(id: string, page = ADMIN_USERS_DEFAULTS.PAGE, limit = ADMIN_USERS_DEFAULTS.ACTIVITY_LIMIT) {
    const [data, total] = await this.repo.findAndCountActivityLogs(id, page, limit);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async sendMessage(userId: string, title: string, content: string, admin: AdminUser) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundException();
    // In a real system, insert into notifications table or send email
    this.audit.log(admin, 'USER_MESSAGE_SENT', { targetType: 'user', targetId: userId, details: title });
  }

  async suspend(userId: string, reason: string, duration: string, notify: boolean, admin: AdminUser) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundException();

    let bannedUntil: Date;
    if (duration === 'permanent') {
      bannedUntil = new Date('2200-01-01');
    } else {
      const now = Date.now();
      const match = /^(\d+)(h|d)$/.exec(duration);
      if (!match) throw new BadRequestException('Duração inválida (ex: 24h, 7d, permanent)');
      const val = parseInt(match[1]);
      const unit = match[2] === 'h' ? 3_600_000 : 86_400_000;
      bannedUntil = new Date(now + val * unit);
    }

    await this.repo.updateUser(userId, { bannedUntil, bannedReason: reason });
    const action = duration === 'permanent' ? 'USER_BANNED' : 'USER_SUSPENDED';
    this.logger.log(`User ${action.toLowerCase()} userId=${userId} duration=${duration} adminId=${admin.id}`);
    this.audit.log(admin, action, { targetType: 'user', targetId: userId, details: `${duration} — ${reason}` });
  }

  async forceLogout(userId: string, admin: AdminUser) {
    // Invalidate all refresh tokens for user
    await this.repo.deleteRefreshTokensByUserId(userId);
    this.audit.log(admin, 'USER_FORCE_LOGOUT', { targetType: 'user', targetId: userId });
  }

  async adjustElo(userId: string, newRating: number, reason: string, admin: AdminUser) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new NotFoundException();
    if (newRating < ADMIN_USERS_ELO_MIN || newRating > ADMIN_USERS_ELO_MAX) {
      throw new BadRequestException(`ELO inválido (${ADMIN_USERS_ELO_MIN}–${ADMIN_USERS_ELO_MAX})`);
    }
    if (reason.length < ADMIN_USERS_SUSPEND_REASON_MIN_LENGTH) {
      throw new BadRequestException(`Motivo deve ter ao menos ${ADMIN_USERS_SUSPEND_REASON_MIN_LENGTH} caracteres`);
    }

    await this.repo.updateUser(userId, { rating: newRating });
    this.logger.log(`ELO adjusted userId=${userId} from=${user.rating} to=${newRating} adminId=${admin.id}`);
    this.audit.log(admin, 'USER_ELO_ADJUSTED', {
      targetType: 'user', targetId: userId,
      details: `${user.rating} → ${newRating} | ${reason}`,
    });
  }

  async exportCsvData() {
    const users = await this.repo.findAllUsers();
    const wallets = await this.repo.findAllWallets();
    const balanceMap = new Map(wallets.map((w) => [w.userId, w.balance]));

    const header = 'id,nickname,email,name,rating,cpf,pix_key,balance,banned_until,created_at\n';
    const rows = users.map((u) =>
      [
        u.id, u.nickname, u.email, u.name, u.rating,
        u.cpf ?? '', u.pixKey ?? '',
        balanceMap.get(u.id) ?? '0.00',
        u.bannedUntil?.toISOString() ?? '',
        u.createdAt.toISOString(),
      ].join(',')
    ).join('\n');
    return header + rows;
  }
}
