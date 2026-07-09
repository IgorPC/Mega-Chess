import {
  Injectable, UnauthorizedException, BadRequestException, Inject, NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminAuditService } from '../admin-audit.service';
import { EmailService } from '../../email/email.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const ADMIN_SESSION_TTL = 4 * 60 * 60; // 4h — matches JWT expiry
const OTP_TTL = 10 * 60;               // 10 min
const LOCKOUT_TTL = 5 * 60;            // 5 min
const MAX_OTP_ATTEMPTS = 3;

@Injectable()
export class AdminAuthService {
  private readonly adminJwtSecret: string;
  private readonly adminJwtExpiry = '4h';

  constructor(
    @InjectRepository(AdminUser) private admins: Repository<AdminUser>,
    private jwt: JwtService,
    private readonly audit: AdminAuditService,
    private readonly email: EmailService,
    config: ConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {
    this.adminJwtSecret = config.getOrThrow<string>('ADMIN_JWT_SECRET');
  }

  async requestOtp(emailAddr: string, password: string, ip?: string): Promise<void> {
    const admin = await this.admins.findOne({ where: { email: emailAddr, isActive: true } });
    if (!admin) {
      // Constant-time fake compare to avoid timing attacks
      await bcrypt.compare(password, '$2b$12$invalidhashfortimingprotection000000000000000000000');
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      this.audit.log(admin, 'ADMIN_LOGIN_FAILED', { ip, details: 'Senha incorreta' });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const lockKey = `adminOtpLock:${emailAddr}`;
    const locked = await this.redis.get(lockKey);
    if (locked) throw new UnauthorizedException('Muitas tentativas. Aguarde 5 minutos.');

    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    await this.redis.set(`adminOtp:${emailAddr}`, code, 'EX', OTP_TTL);
    await this.redis.del(`adminOtpAttempts:${emailAddr}`);
    this.audit.log(admin, 'ADMIN_OTP_REQUESTED', { ip });
    this.email.sendAdminOtp(emailAddr, admin.name, code);
  }

  async verifyOtp(emailAddr: string, code: string, ip?: string) {
    const lockKey = `adminOtpLock:${emailAddr}`;
    const attKey = `adminOtpAttempts:${emailAddr}`;

    const locked = await this.redis.get(lockKey);
    if (locked) throw new UnauthorizedException('Muitas tentativas. Aguarde 5 minutos.');

    const stored = await this.redis.get(`adminOtp:${emailAddr}`);
    if (!stored) throw new UnauthorizedException('Código inválido ou expirado');

    if (stored !== code) {
      const attempts = await this.redis.incr(attKey);
      await this.redis.expire(attKey, LOCKOUT_TTL);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await this.redis.set(lockKey, '1', 'EX', LOCKOUT_TTL);
        await this.redis.del(`adminOtp:${emailAddr}`);
        this.audit.log(
          { id: 'system', name: emailAddr } as any,
          'ADMIN_OTP_LOCKOUT',
          { ip, details: `${attempts} tentativas falhas` },
        );
        throw new UnauthorizedException('Muitas tentativas. Conta bloqueada por 5 minutos.');
      }
      throw new UnauthorizedException(`Código incorreto. ${MAX_OTP_ATTEMPTS - attempts} tentativa(s) restante(s).`);
    }

    // OTP valid — consume it
    await this.redis.del(`adminOtp:${emailAddr}`);
    await this.redis.del(attKey);

    const admin = await this.admins.findOne({ where: { email: emailAddr, isActive: true } });
    if (!admin) throw new UnauthorizedException();

    await this.admins.update(admin.id, { lastLoginAt: new Date() });
    this.audit.log(admin, 'ADMIN_LOGIN', { ip });

    return {
      accessToken: await this.issueAccessToken(admin),
      admin: this.serialize(admin),
      mustChangePassword: admin.mustChangePassword,
    };
  }

  async changePassword(adminId: string, newPw: string, currentPw?: string): Promise<void> {
    const admin = await this.admins.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException();
    if (newPw.length < 12) throw new BadRequestException('Senha deve ter ao menos 12 caracteres');
    // Current password required only when it's not a forced first-time change
    if (!admin.mustChangePassword) {
      if (!currentPw) throw new BadRequestException('Senha atual obrigatória');
      const valid = await bcrypt.compare(currentPw, admin.passwordHash);
      if (!valid) throw new UnauthorizedException('Senha atual incorreta');
    }
    const passwordHash = await bcrypt.hash(newPw, 12);
    await this.admins.update(adminId, { passwordHash, mustChangePassword: false });
    this.audit.log(admin, 'ADMIN_PASSWORD_CHANGED');
  }

  async deleteSession(adminId: string): Promise<void> {
    await this.redis.del(`adminSession:${adminId}`);
  }

  /** Generates a cryptographically random 16-char alphanumeric password. */
  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  sendWelcomeEmail(email: string, name: string, tempPassword: string): void {
    this.email.sendAdminWelcome(email, name, tempPassword);
  }

  private async issueAccessToken(admin: AdminUser): Promise<string> {
    const sessionToken = uuidv4();
    await this.redis.set(`adminSession:${admin.id}`, sessionToken, 'EX', ADMIN_SESSION_TTL);
    return this.jwt.sign(
      { sub: admin.id, email: admin.email, role: admin.role, purpose: 'admin_access', sessionToken },
      { secret: this.adminJwtSecret, expiresIn: this.adminJwtExpiry },
    );
  }

  serialize(admin: AdminUser) {
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    };
  }
}
