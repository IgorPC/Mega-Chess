import {
  Injectable, ConflictException, UnauthorizedException, NotFoundException, BadRequestException,
  Logger, Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';
import { EmailService } from '../email/email.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const SESSION_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly appUrl: string;

  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(RefreshToken) private tokens: Repository<RefreshToken>,
    @InjectRepository(Referral) private referrals: Repository<Referral>,
    private jwt: JwtService,
    private activity: UserActivityService,
    private email: EmailService,
    config: ConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {
    this.jwtSecret = config.getOrThrow<string>('JWT_SECRET');
    this.appUrl = config.get<string>('APP_URL', 'https://megachess.io');
  }

  async register(dto: RegisterDto, req?: any) {
    const exists = await this.users.findOne({
      where: [{ email: dto.email }, { nickname: dto.nickname }],
    });
    if (exists) throw new ConflictException('Email or nickname already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const verificationToken = uuidv4();
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = this.users.create({
      email: dto.email,
      name: dto.name,
      nickname: dto.nickname,
      passwordHash,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiresAt: verificationExpiresAt,
    });
    await this.users.save(user);

    // Generate referral code from first 8 chars of UUID (no hyphens), uppercase
    const referralCode = user.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    user.referralCode = referralCode;

    // Handle incoming referral code
    if (dto.referralCode) {
      const referrer = await this.users.findOne({ where: { referralCode: dto.referralCode } });
      if (referrer && referrer.id !== user.id) {
        // Prevent circular: check referrer is not already referred by this user (new user has no referrals yet so just check referrer.referredBy !== user.id)
        const circularCheck = referrer.referredBy === user.id;
        if (!circularCheck) {
          // Check referrer has fewer than 10 referrals
          const referralCount = await this.referrals.count({ where: { referrerId: referrer.id } });
          if (referralCount < 10) {
            user.referredBy = referrer.id;
            await this.referrals.save(this.referrals.create({ referrerId: referrer.id, referredId: user.id }));
          }
        }
      }
    }

    await this.users.save(user);
    this.logger.log(`User registered userId=${user.id}`);
    this.activity.log(user.id, UserAction.AUTH_REGISTER, { email: dto.email }, req);

    const confirmUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;
    this.email.sendEmailConfirmation(user.email, user.name, confirmUrl);

    return { requiresEmailVerification: true };
  }

  async login(dto: LoginDto, req?: any) {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) {
      this.activity.log(null, UserAction.AUTH_LOGIN_FAILED, { email: dto.email }, req);
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      this.activity.log(user.id, UserAction.AUTH_LOGIN_FAILED, { email: dto.email }, req);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Esta conta foi excluída');
    }

    if (!user.emailVerified) {
      const tokenExpired = !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date();
      throw new UnauthorizedException({
        code: tokenExpired ? 'EMAIL_VERIFICATION_EXPIRED' : 'EMAIL_NOT_VERIFIED',
        canResend: true,
      });
    }

    this.activity.log(user.id, UserAction.AUTH_LOGIN, {}, req);
    return this.generateTokens(user.id, user.email, null);
  }

  async verifyEmail(token: string) {
    const user = await this.users.findOne({ where: { emailVerificationToken: token } });
    if (!user) throw new NotFoundException('Token de verificação inválido');
    if (user.emailVerified) return this.generateTokens(user.id, user.email, null);
    if (user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_EXPIRED',
        canResend: true,
        message: 'Link expirado. Solicite um novo email de verificação.',
      });
    }

    await this.users.update(user.id, {
      emailVerified: true,
      // Keep token in DB for idempotency — clicking the link again finds the user
      // already verified and returns tokens instead of 404
    });

    return this.generateTokens(user.id, user.email, null);
  }

  async resendVerification(email: string) {
    const user = await this.users.findOne({ where: { email } });
    // Always return same response to avoid email enumeration
    if (!user || user.emailVerified) return { sent: true };

    const verificationToken = uuidv4();
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.users.update(user.id, {
      emailVerificationToken: verificationToken,
      emailVerificationExpiresAt: verificationExpiresAt,
    });

    const confirmUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;
    this.email.sendEmailConfirmation(user.email, user.name, confirmUrl);
    return { sent: true };
  }

  async refresh(token: string) {
    const stored = await this.tokens.findOne({
      where: { token },
      relations: ['user'],
    });
    if (!stored || stored.expiresAt < new Date()) {
      await this.tokens.delete({ token });
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Retrieve existing sessionToken so the old access token stays valid during the race window
    const existingSession = await this.redis.get(`sessionToken:${token}`);
    await this.tokens.delete({ token });
    await this.redis.del(`sessionToken:${token}`);
    return this.generateTokens(stored.userId, stored.user.email, existingSession);
  }

  async forgotPassword(email: string) {
    const user = await this.users.findOne({ where: { email } });
    // Always return the same response — never reveal if email exists
    if (!user) return { sent: true };

    // Invalidate any existing reset token for this user
    const oldToken = await this.redis.get(`passwordReset:${user.id}`);
    if (oldToken) await this.redis.del(`passwordResetToken:${oldToken}`);

    const token = uuidv4();
    const TTL = 60 * 60; // 1h
    await this.redis.set(`passwordReset:${user.id}`, token, 'EX', TTL);
    await this.redis.set(`passwordResetToken:${token}`, user.id, 'EX', TTL);

    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;
    this.email.sendPasswordReset(user.email, user.name, resetUrl);
    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const userId = await this.redis.get(`passwordResetToken:${token}`);
    if (!userId) throw new BadRequestException('Link inválido ou expirado');

    if (newPassword.length < 8) throw new BadRequestException('Senha deve ter ao menos 8 caracteres');
    if (!/[A-Z]/.test(newPassword)) throw new BadRequestException('Senha deve conter ao menos uma letra maiúscula');
    if (!/[0-9]/.test(newPassword)) throw new BadRequestException('Senha deve conter ao menos um número');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.update(userId, { passwordHash });

    // Consume token (one-time use)
    await this.redis.del(`passwordResetToken:${token}`);
    await this.redis.del(`passwordReset:${userId}`);

    return { success: true };
  }

  async logout(userId: string, token: string, req?: any) {
    await this.tokens.delete({ token });
    await this.redis.del(`session:${userId}`);
    await this.redis.del(`sessionToken:${token}`);
    this.activity.log(userId, UserAction.AUTH_LOGOUT, {}, req);
  }

  /**
   * Generates access + refresh tokens.
   * If `existingSessionToken` is provided (refresh flow), reuses it — same session,
   * new tokens. If null (login/verify flow), generates a new sessionToken and
   * overwrites any existing session in Redis, invalidating other devices.
   */
  private async generateTokens(userId: string, email: string, existingSessionToken: string | null) {
    const sessionToken = existingSessionToken ?? uuidv4();
    const accessToken = this.jwt.sign(
      { sub: userId, email, sessionToken },
      { secret: this.jwtSecret, expiresIn: '15m' },
    );
    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await Promise.all([
      this.tokens.save(this.tokens.create({ token: refreshToken, userId, expiresAt })),
      this.redis.set(`session:${userId}`, sessionToken, 'EX', SESSION_TTL_SEC),
      this.redis.set(`sessionToken:${refreshToken}`, sessionToken, 'EX', SESSION_TTL_SEC),
    ]);
    return { accessToken, refreshToken };
  }
}
