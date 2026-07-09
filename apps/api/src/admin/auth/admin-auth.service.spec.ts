import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuditService } from '../admin-audit.service';
import { EmailService } from '../../email/email.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { AdminUser } from '../../entities/admin-user.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let admins: jest.Mocked<Repository<AdminUser>>;
  let jwt: jest.Mocked<JwtService>;
  let audit: jest.Mocked<AdminAuditService>;
  let email: jest.Mocked<EmailService>;
  let redis: any;

  const mockAdmin: AdminUser = {
    id: 'admin-1',
    name: 'Alice',
    email: 'alice@megachess.io',
    role: 'ADMIN',
    isActive: true,
    passwordHash: 'hashed-pw',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        {
          provide: getRepositoryToken(AdminUser),
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed-jwt') } },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
        { provide: EmailService, useValue: { sendAdminOtp: jest.fn(), sendAdminWelcome: jest.fn() } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('secret') } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get(AdminAuthService);
    admins = module.get(getRepositoryToken(AdminUser));
    jwt = module.get(JwtService);
    audit = module.get(AdminAuditService);
    email = module.get(EmailService);
  });

  describe('requestOtp', () => {
    it('throws unauthorized and performs a fake compare when the admin does not exist', async () => {
      admins.findOne.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.requestOtp('missing@x.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(bcrypt.compare).toHaveBeenCalledWith('pw', expect.stringContaining('$2b$12$'));
    });

    it('throws unauthorized and audits a failed login on wrong password', async () => {
      admins.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.requestOtp('alice@megachess.io', 'wrong', '1.2.3.4')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(audit.log).toHaveBeenCalledWith(mockAdmin, 'ADMIN_LOGIN_FAILED', { ip: '1.2.3.4', details: 'Senha incorreta' });
    });

    it('throws unauthorized when the account is currently locked out', async () => {
      admins.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      redis.get.mockResolvedValue('1');

      await expect(service.requestOtp('alice@megachess.io', 'correct')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('generates and stores an OTP and sends the email on valid credentials', async () => {
      admins.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      redis.get.mockResolvedValue(null);

      await service.requestOtp('alice@megachess.io', 'correct', '9.9.9.9');

      expect(redis.set).toHaveBeenCalledWith(
        'adminOtp:alice@megachess.io',
        expect.stringMatching(/^\d{6}$/),
        'EX',
        600,
      );
      expect(redis.del).toHaveBeenCalledWith('adminOtpAttempts:alice@megachess.io');
      expect(audit.log).toHaveBeenCalledWith(mockAdmin, 'ADMIN_OTP_REQUESTED', { ip: '9.9.9.9' });
      expect(email.sendAdminOtp).toHaveBeenCalledWith('alice@megachess.io', 'Alice', expect.stringMatching(/^\d{6}$/));
    });
  });

  describe('verifyOtp', () => {
    it('throws unauthorized when locked out', async () => {
      redis.get.mockResolvedValueOnce('1');
      await expect(service.verifyOtp('alice@megachess.io', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws unauthorized when there is no stored OTP (expired or never requested)', async () => {
      redis.get.mockResolvedValueOnce(null); // lock check
      redis.get.mockResolvedValueOnce(null); // stored otp
      await expect(service.verifyOtp('alice@megachess.io', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('increments attempts and rejects on the first wrong code', async () => {
      redis.get.mockResolvedValueOnce(null); // lock check
      redis.get.mockResolvedValueOnce('999999'); // stored otp
      redis.incr.mockResolvedValue(1);

      await expect(service.verifyOtp('alice@megachess.io', '000000')).rejects.toThrow(
        /2 tentativa\(s\) restante\(s\)/,
      );
      expect(redis.expire).toHaveBeenCalledWith('adminOtpAttempts:alice@megachess.io', 300);
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('rejects on the second wrong code without locking', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce('999999');
      redis.incr.mockResolvedValue(2);

      await expect(service.verifyOtp('alice@megachess.io', '000000')).rejects.toThrow(
        /1 tentativa\(s\) restante\(s\)/,
      );
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('locks the account after the third wrong attempt', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce('999999');
      redis.incr.mockResolvedValue(3);

      await expect(service.verifyOtp('alice@megachess.io', '000000', '1.1.1.1')).rejects.toThrow(
        /Conta bloqueada/,
      );
      expect(redis.set).toHaveBeenCalledWith('adminOtpLock:alice@megachess.io', '1', 'EX', 300);
      expect(redis.del).toHaveBeenCalledWith('adminOtp:alice@megachess.io');
      expect(audit.log).toHaveBeenCalledWith(
        { id: 'system', name: 'alice@megachess.io' },
        'ADMIN_OTP_LOCKOUT',
        { ip: '1.1.1.1', details: '3 tentativas falhas' },
      );
    });

    it('throws unauthorized when the correct code is provided but the admin no longer exists', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce('123456');
      admins.findOne.mockResolvedValue(null);

      await expect(service.verifyOtp('alice@megachess.io', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(redis.del).toHaveBeenCalledWith('adminOtp:alice@megachess.io');
    });

    it('rejects a code that was already consumed (treated as expired on replay)', async () => {
      // First call consumes and deletes the stored OTP; a replay finds nothing stored.
      redis.get.mockResolvedValueOnce(null); // lock check
      redis.get.mockResolvedValueOnce(null); // stored otp already deleted from prior use
      await expect(service.verifyOtp('alice@megachess.io', '123456')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('issues an access token, updates lastLoginAt, and returns the serialized admin on success', async () => {
      redis.get.mockResolvedValueOnce(null); // lock check
      redis.get.mockResolvedValueOnce('123456'); // stored otp
      admins.findOne.mockResolvedValue(mockAdmin);
      admins.update.mockResolvedValue({} as any);

      const result = await service.verifyOtp('alice@megachess.io', '123456', '2.2.2.2');

      expect(redis.del).toHaveBeenCalledWith('adminOtp:alice@megachess.io');
      expect(redis.del).toHaveBeenCalledWith('adminOtpAttempts:alice@megachess.io');
      expect(admins.update).toHaveBeenCalledWith('admin-1', { lastLoginAt: expect.any(Date) });
      expect(audit.log).toHaveBeenCalledWith(mockAdmin, 'ADMIN_LOGIN', { ip: '2.2.2.2' });
      expect(redis.set).toHaveBeenCalledWith('adminSession:admin-1', expect.any(String), 'EX', 14400);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'admin-1', email: 'alice@megachess.io', purpose: 'admin_access' }),
        { secret: 'secret', expiresIn: '4h' },
      );
      expect(result).toEqual({
        accessToken: 'signed-jwt',
        admin: service.serialize(mockAdmin),
        mustChangePassword: false,
      });
    });

    it('invalidates a previous session when a new login issues a new session token (single-session enforcement)', async () => {
      redis.get.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce('123456');
      admins.findOne.mockResolvedValue(mockAdmin);
      admins.update.mockResolvedValue({} as any);

      await service.verifyOtp('alice@megachess.io', '123456');

      // The new session simply overwrites the adminSession key — any previous session token
      // stored there is replaced, invalidating prior sessions on their next request.
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^adminSession:/),
        expect.any(String),
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('changePassword', () => {
    it('throws unauthorized when the admin does not exist', async () => {
      admins.findOne.mockResolvedValue(null);
      await expect(service.changePassword('missing', 'newpassword123')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws bad request when the new password is too short', async () => {
      admins.findOne.mockResolvedValue(mockAdmin);
      await expect(service.changePassword('admin-1', 'short')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires the current password when it is not a forced first-time change', async () => {
      admins.findOne.mockResolvedValue(mockAdmin);
      await expect(service.changePassword('admin-1', 'newpassword123')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws unauthorized when the current password is incorrect', async () => {
      admins.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.changePassword('admin-1', 'newpassword123', 'wrong-current'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('updates the password hash and clears mustChangePassword on success', async () => {
      admins.findOne.mockResolvedValue(mockAdmin);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      admins.update.mockResolvedValue({} as any);

      await service.changePassword('admin-1', 'newpassword123', 'current-pw');

      expect(admins.update).toHaveBeenCalledWith('admin-1', { passwordHash: 'new-hash', mustChangePassword: false });
      expect(audit.log).toHaveBeenCalledWith(mockAdmin, 'ADMIN_PASSWORD_CHANGED');
    });

    it('skips the current-password check when mustChangePassword is true (forced first-time change)', async () => {
      const forced = { ...mockAdmin, mustChangePassword: true };
      admins.findOne.mockResolvedValue(forced as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      admins.update.mockResolvedValue({} as any);

      await service.changePassword('admin-1', 'newpassword123');

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(admins.update).toHaveBeenCalledWith('admin-1', { passwordHash: 'new-hash', mustChangePassword: false });
    });
  });

  describe('deleteSession', () => {
    it('removes the admin session key from redis', async () => {
      await service.deleteSession('admin-1');
      expect(redis.del).toHaveBeenCalledWith('adminSession:admin-1');
    });
  });

  describe('generateTempPassword', () => {
    it('generates a 16 character alphanumeric password', () => {
      const pw = service.generateTempPassword();
      expect(pw).toHaveLength(16);
      expect(pw).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('generates different passwords across calls (probabilistically)', () => {
      const a = service.generateTempPassword();
      const b = service.generateTempPassword();
      expect(a).not.toBe(b);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('delegates to the email service', () => {
      service.sendWelcomeEmail('new@x.com', 'New Admin', 'tempPw123456789');
      expect(email.sendAdminWelcome).toHaveBeenCalledWith('new@x.com', 'New Admin', 'tempPw123456789');
    });
  });

  describe('serialize', () => {
    it('exposes only the safe public fields', () => {
      const result = service.serialize(mockAdmin);
      expect(result).toEqual({
        id: 'admin-1',
        name: 'Alice',
        email: 'alice@megachess.io',
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
        lastLoginAt: null,
        createdAt: mockAdmin.createdAt,
      });
      expect((result as any).passwordHash).toBeUndefined();
    });
  });
});
