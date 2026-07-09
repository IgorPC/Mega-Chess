import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { UserActivityService } from '../user-activity/user-activity.service';
import { EmailService } from '../email/email.service';
import { REDIS_CLIENT } from '../redis/redis.module';

jest.mock('bcrypt');
jest.mock('uuid');

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: jest.Mocked<Repository<User>>;
  let tokensRepo: jest.Mocked<Repository<RefreshToken>>;
  let referralsRepo: jest.Mocked<Repository<Referral>>;
  let jwt: jest.Mocked<JwtService>;
  let activity: jest.Mocked<UserActivityService>;
  let email: jest.Mocked<EmailService>;
  let redis: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue('uuid-generated');

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), create: jest.fn(), save: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: { findOne: jest.fn(), delete: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Referral),
          useValue: { count: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-jwt') },
        },
        {
          provide: UserActivityService,
          useValue: { log: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { sendEmailConfirmation: jest.fn(), sendPasswordReset: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('jwt-secret'),
            get: jest.fn().mockReturnValue('https://megachess.io'),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersRepo = module.get(getRepositoryToken(User));
    tokensRepo = module.get(getRepositoryToken(RefreshToken));
    referralsRepo = module.get(getRepositoryToken(Referral));
    jwt = module.get(JwtService);
    activity = module.get(UserActivityService);
    email = module.get(EmailService);
    redis = module.get(REDIS_CLIENT);
  });

  describe('register', () => {
    const dto = { email: 'a@a.com', name: 'Alice', nickname: 'alice', password: 'password123' };

    it('throws ConflictException when email or nickname already exists', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'existing' } as any);
      await expect(service.register(dto as any)).rejects.toBeInstanceOf(ConflictException);
    });

    it('registers a new user and sends confirmation email', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null); // exists check
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      const createdUser: any = { id: '12345678-aaaa-bbbb-cccc-ddddeeeeffff', email: dto.email, name: dto.name };
      usersRepo.create.mockReturnValue(createdUser);
      usersRepo.save.mockResolvedValue(createdUser);

      const result = await service.register(dto as any);

      expect(usersRepo.save).toHaveBeenCalled();
      expect(email.sendEmailConfirmation).toHaveBeenCalledWith(dto.email, dto.name, expect.stringContaining('verify-email?token='));
      expect(activity.log).toHaveBeenCalled();
      expect(result).toEqual({ requiresEmailVerification: true });
      expect(createdUser.referralCode).toBe('12345678');
    });

    it('links referral when a valid referral code is provided and referrer has room', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null); // exists check
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      const createdUser: any = { id: 'new-user-id', email: dto.email, name: dto.name };
      usersRepo.create.mockReturnValue(createdUser);
      usersRepo.save.mockResolvedValue(createdUser);
      const referrer = { id: 'referrer-id', referredBy: null };
      usersRepo.findOne.mockResolvedValueOnce(referrer as any); // referrer lookup
      referralsRepo.count.mockResolvedValue(2);
      referralsRepo.create.mockReturnValue({ referrerId: 'referrer-id', referredId: 'new-user-id' } as any);
      referralsRepo.save.mockResolvedValue({} as any);

      await service.register({ ...dto, referralCode: 'REF123' } as any);

      expect(createdUser.referredBy).toBe('referrer-id');
      expect(referralsRepo.save).toHaveBeenCalled();
    });

    it('does not link referral when referrer already has 10 referrals', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      const createdUser: any = { id: 'new-user-id', email: dto.email, name: dto.name };
      usersRepo.create.mockReturnValue(createdUser);
      usersRepo.save.mockResolvedValue(createdUser);
      const referrer = { id: 'referrer-id', referredBy: null };
      usersRepo.findOne.mockResolvedValueOnce(referrer as any);
      referralsRepo.count.mockResolvedValue(10);

      await service.register({ ...dto, referralCode: 'REF123' } as any);

      expect(referralsRepo.save).not.toHaveBeenCalled();
      expect(createdUser.referredBy).toBeUndefined();
    });

    it('does not link referral when referrer is the same as new user (circular)', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      const createdUser: any = { id: 'same-id', email: dto.email, name: dto.name };
      usersRepo.create.mockReturnValue(createdUser);
      usersRepo.save.mockResolvedValue(createdUser);
      usersRepo.findOne.mockResolvedValueOnce({ id: 'same-id' } as any); // referrer is same as new user

      await service.register({ ...dto, referralCode: 'REF123' } as any);

      expect(referralsRepo.save).not.toHaveBeenCalled();
    });

    it('does not link referral when referral code does not match any user', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      const createdUser: any = { id: 'new-user-id', email: dto.email, name: dto.name };
      usersRepo.create.mockReturnValue(createdUser);
      usersRepo.save.mockResolvedValue(createdUser);
      usersRepo.findOne.mockResolvedValueOnce(null); // referrer not found

      await service.register({ ...dto, referralCode: 'BAD' } as any);

      expect(referralsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const dto = { email: 'a@a.com', password: 'password123' };

    it('throws UnauthorizedException and logs failed attempt when user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto as any)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(activity.log).toHaveBeenCalledWith(null, expect.anything(), expect.anything(), undefined);
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'hash' } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto as any)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything(), expect.anything(), undefined);
    });

    it('throws UnauthorizedException with EMAIL_VERIFICATION_EXPIRED when unverified and token expired', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1', passwordHash: 'hash', isActive: true, emailVerified: false,
        emailVerificationExpiresAt: new Date(Date.now() - 1000),
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login(dto as any)).rejects.toMatchObject({
        response: { code: 'EMAIL_VERIFICATION_EXPIRED', canResend: true },
      });
    });

    it('throws UnauthorizedException with EMAIL_NOT_VERIFIED when unverified but token still valid', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1', passwordHash: 'hash', isActive: true, emailVerified: false,
        emailVerificationExpiresAt: new Date(Date.now() + 100000),
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login(dto as any)).rejects.toMatchObject({
        response: { code: 'EMAIL_NOT_VERIFIED', canResend: true },
      });
    });

    it('throws UnauthorizedException when the account was deleted (isActive false)', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1', passwordHash: 'hash', isActive: false, emailVerified: true,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(service.login(dto as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens on successful login', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1', email: dto.email, passwordHash: 'hash', isActive: true, emailVerified: true,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      tokensRepo.save.mockResolvedValue({} as any);
      redis.set.mockResolvedValue('OK');

      const result = await service.login(dto as any);

      expect(result).toEqual({ accessToken: 'signed-jwt', refreshToken: 'uuid-generated' });
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything(), {}, undefined);
    });
  });

  describe('verifyEmail', () => {
    it('throws NotFoundException when token is invalid', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns tokens directly (idempotent) when already verified', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', emailVerified: true } as any);
      tokensRepo.save.mockResolvedValue({} as any);

      const result = await service.verifyEmail('tok');
      expect(result).toEqual({ accessToken: 'signed-jwt', refreshToken: 'uuid-generated' });
    });

    it('throws BadRequestException when verification token expired', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1', emailVerified: false, emailVerificationExpiresAt: new Date(Date.now() - 1000),
      } as any);
      await expect(service.verifyEmail('tok')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('verifies email and returns tokens when token is valid', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 'u1', email: 'a@a.com', emailVerified: false,
        emailVerificationExpiresAt: new Date(Date.now() + 100000),
      } as any);
      usersRepo.update.mockResolvedValue({} as any);
      tokensRepo.save.mockResolvedValue({} as any);

      const result = await service.verifyEmail('tok');
      expect(usersRepo.update).toHaveBeenCalledWith('u1', { emailVerified: true });
      expect(result).toEqual({ accessToken: 'signed-jwt', refreshToken: 'uuid-generated' });
    });
  });

  describe('resendVerification', () => {
    it('returns sent:true without sending email when user does not exist (avoid enumeration)', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await service.resendVerification('missing@a.com');
      expect(result).toEqual({ sent: true });
      expect(email.sendEmailConfirmation).not.toHaveBeenCalled();
    });

    it('returns sent:true without sending email when user already verified', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', emailVerified: true } as any);
      const result = await service.resendVerification('a@a.com');
      expect(result).toEqual({ sent: true });
      expect(email.sendEmailConfirmation).not.toHaveBeenCalled();
    });

    it('regenerates token and sends email when user unverified', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', name: 'Alice', emailVerified: false } as any);
      usersRepo.update.mockResolvedValue({} as any);

      const result = await service.resendVerification('a@a.com');
      expect(usersRepo.update).toHaveBeenCalled();
      expect(email.sendEmailConfirmation).toHaveBeenCalled();
      expect(result).toEqual({ sent: true });
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException and deletes token when token not found', async () => {
      tokensRepo.findOne.mockResolvedValue(null);
      tokensRepo.delete.mockResolvedValue({} as any);
      await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokensRepo.delete).toHaveBeenCalledWith({ token: 'bad-token' });
    });

    it('throws UnauthorizedException and deletes token when token expired', async () => {
      tokensRepo.findOne.mockResolvedValue({
        token: 'tok', expiresAt: new Date(Date.now() - 1000), userId: 'u1', user: { email: 'a@a.com' },
      } as any);
      tokensRepo.delete.mockResolvedValue({} as any);
      await expect(service.refresh('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('reuses the existing session token and returns new tokens', async () => {
      tokensRepo.findOne.mockResolvedValue({
        token: 'tok', expiresAt: new Date(Date.now() + 100000), userId: 'u1', user: { email: 'a@a.com' },
      } as any);
      tokensRepo.delete.mockResolvedValue({} as any);
      redis.get.mockResolvedValue('existing-session-token');
      redis.del.mockResolvedValue(1);
      tokensRepo.save.mockResolvedValue({} as any);
      redis.set.mockResolvedValue('OK');

      const result = await service.refresh('tok');

      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'u1', email: 'a@a.com', sessionToken: 'existing-session-token' },
        expect.anything(),
      );
      expect(result).toEqual({ accessToken: 'signed-jwt', refreshToken: 'uuid-generated' });
    });
  });

  describe('forgotPassword', () => {
    it('returns sent:true without revealing whether email exists', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      const result = await service.forgotPassword('missing@a.com');
      expect(result).toEqual({ sent: true });
      expect(email.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('invalidates old reset token and sends new one', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', name: 'Alice' } as any);
      redis.get.mockResolvedValue('old-token');
      redis.del.mockResolvedValue(1);
      redis.set.mockResolvedValue('OK');

      const result = await service.forgotPassword('a@a.com');
      expect(redis.del).toHaveBeenCalledWith('passwordResetToken:old-token');
      expect(email.sendPasswordReset).toHaveBeenCalled();
      expect(result).toEqual({ sent: true });
    });

    it('sends reset email even without an old token', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@a.com', name: 'Alice' } as any);
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');

      const result = await service.forgotPassword('a@a.com');
      expect(result).toEqual({ sent: true });
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when token is invalid/expired', async () => {
      redis.get.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'Password1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when password too short', async () => {
      redis.get.mockResolvedValue('user-id');
      await expect(service.resetPassword('tok', 'Ab1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when password missing uppercase', async () => {
      redis.get.mockResolvedValue('user-id');
      await expect(service.resetPassword('tok', 'lowercase1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when password missing a number', async () => {
      redis.get.mockResolvedValue('user-id');
      await expect(service.resetPassword('tok', 'NoNumbers')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resets password and consumes the token on success', async () => {
      redis.get.mockResolvedValue('user-id');
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      usersRepo.update.mockResolvedValue({} as any);
      redis.del.mockResolvedValue(1);

      const result = await service.resetPassword('tok', 'ValidPass1');
      expect(usersRepo.update).toHaveBeenCalledWith('user-id', { passwordHash: 'new-hash' });
      expect(redis.del).toHaveBeenCalledWith('passwordResetToken:tok');
      expect(redis.del).toHaveBeenCalledWith('passwordReset:user-id');
      expect(result).toEqual({ success: true });
    });
  });

  describe('logout', () => {
    it('deletes tokens and redis sessions, logs activity', async () => {
      tokensRepo.delete.mockResolvedValue({} as any);
      redis.del.mockResolvedValue(1);

      await service.logout('u1', 'tok');

      expect(tokensRepo.delete).toHaveBeenCalledWith({ token: 'tok' });
      expect(redis.del).toHaveBeenCalledWith('session:u1');
      expect(redis.del).toHaveBeenCalledWith('sessionToken:tok');
      expect(activity.log).toHaveBeenCalledWith('u1', expect.anything(), {}, undefined);
    });
  });
});
