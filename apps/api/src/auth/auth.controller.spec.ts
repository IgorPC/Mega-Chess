import { InternalServerErrorException, ConflictException, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            verifyEmail: jest.fn(),
            resendVerification: jest.fn(),
            refresh: jest.fn(),
            forgotPassword: jest.fn(),
            resetPassword: jest.fn(),
            logout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService);
  });

  const req = { ip: '127.0.0.1' };

  describe('register', () => {
    it('forwards the dto and request to the service', async () => {
      service.register.mockResolvedValue({ requiresEmailVerification: true } as any);
      const result = await controller.register({ email: 'a@a.com' } as any, req);
      expect(service.register).toHaveBeenCalledWith({ email: 'a@a.com' }, req);
      expect(result).toEqual({ requiresEmailVerification: true });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.register.mockRejectedValue(new ConflictException('exists'));
      await expect(controller.register({} as any, req)).rejects.toBeInstanceOf(ConflictException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.register.mockRejectedValue(new Error('db down'));
      await expect(controller.register({} as any, req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.register.mockRejectedValue('plain string rejection');
      await expect(controller.register({} as any, req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('login', () => {
    it('forwards the dto and request to the service', async () => {
      service.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' } as any);
      const result = await controller.login({ email: 'a@a.com', password: 'p' } as any, req);
      expect(service.login).toHaveBeenCalledWith({ email: 'a@a.com', password: 'p' }, req);
      expect(result).toEqual({ accessToken: 'a', refreshToken: 'b' });
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.login.mockRejectedValue(new UnauthorizedException('bad creds'));
      await expect(controller.login({} as any, req)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.login.mockRejectedValue(new Error('boom'));
      await expect(controller.login({} as any, req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.login.mockRejectedValue('plain string rejection');
      await expect(controller.login({} as any, req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('verifyEmail', () => {
    it('forwards the token to the service', async () => {
      service.verifyEmail.mockResolvedValue({ accessToken: 'a' } as any);
      const result = await controller.verifyEmail('tok');
      expect(service.verifyEmail).toHaveBeenCalledWith('tok');
      expect(result).toEqual({ accessToken: 'a' });
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.verifyEmail.mockRejectedValue(new NotFoundException('invalid token'));
      await expect(controller.verifyEmail('tok')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.verifyEmail.mockRejectedValue(new Error('boom'));
      await expect(controller.verifyEmail('tok')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.verifyEmail.mockRejectedValue('plain string rejection');
      await expect(controller.verifyEmail('tok')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('resendVerification', () => {
    it('forwards the email to the service', async () => {
      service.resendVerification.mockResolvedValue({ sent: true });
      const result = await controller.resendVerification('a@a.com');
      expect(service.resendVerification).toHaveBeenCalledWith('a@a.com');
      expect(result).toEqual({ sent: true });
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.resendVerification.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.resendVerification('a@a.com')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.resendVerification.mockRejectedValue(new Error('boom'));
      await expect(controller.resendVerification('a@a.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.resendVerification.mockRejectedValue('plain string rejection');
      await expect(controller.resendVerification('a@a.com')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('refresh', () => {
    it('forwards the refresh token to the service', async () => {
      service.refresh.mockResolvedValue({ accessToken: 'a', refreshToken: 'b' } as any);
      const result = await controller.refresh('refresh-tok');
      expect(service.refresh).toHaveBeenCalledWith('refresh-tok');
      expect(result).toEqual({ accessToken: 'a', refreshToken: 'b' });
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.refresh.mockRejectedValue(new UnauthorizedException('invalid'));
      await expect(controller.refresh('bad')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.refresh.mockRejectedValue(new Error('boom'));
      await expect(controller.refresh('bad')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.refresh.mockRejectedValue('plain string rejection');
      await expect(controller.refresh('bad')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('forgotPassword', () => {
    it('forwards the email to the service', async () => {
      service.forgotPassword.mockResolvedValue({ sent: true });
      const result = await controller.forgotPassword({ email: 'a@a.com' });
      expect(service.forgotPassword).toHaveBeenCalledWith('a@a.com');
      expect(result).toEqual({ sent: true });
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.forgotPassword.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.forgotPassword({ email: 'a@a.com' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.forgotPassword.mockRejectedValue(new Error('boom'));
      await expect(controller.forgotPassword({ email: 'a@a.com' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.forgotPassword.mockRejectedValue('plain string rejection');
      await expect(controller.forgotPassword({ email: 'a@a.com' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('resetPassword', () => {
    it('forwards the token and new password to the service', async () => {
      service.resetPassword.mockResolvedValue({ success: true });
      const result = await controller.resetPassword({ token: 'tok', newPassword: 'NewPass1' });
      expect(service.resetPassword).toHaveBeenCalledWith('tok', 'NewPass1');
      expect(result).toEqual({ success: true });
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.resetPassword.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.resetPassword({ token: 'tok', newPassword: 'NewPass1' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.resetPassword.mockRejectedValue(new Error('boom'));
      await expect(controller.resetPassword({ token: 'tok', newPassword: 'NewPass1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.resetPassword.mockRejectedValue('plain string rejection');
      await expect(controller.resetPassword({ token: 'tok', newPassword: 'NewPass1' })).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('logout', () => {
    it('forwards user id, token and request to the service', async () => {
      service.logout.mockResolvedValue(undefined);
      const result = await controller.logout({ id: 'u1' }, 'tok', req);
      expect(service.logout).toHaveBeenCalledWith('u1', 'tok', req);
      expect(result).toBeUndefined();
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.logout.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.logout({ id: 'u1' }, 'tok', req)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.logout.mockRejectedValue(new Error('boom'));
      await expect(controller.logout({ id: 'u1' }, 'tok', req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.logout.mockRejectedValue('plain string rejection');
      await expect(controller.logout({ id: 'u1' }, 'tok', req)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
