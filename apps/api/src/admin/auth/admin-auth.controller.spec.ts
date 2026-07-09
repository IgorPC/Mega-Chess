import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthController', () => {
  let controller: AdminAuthController;
  let service: jest.Mocked<AdminAuthService>;

  const req = { headers: {}, ip: '127.0.0.1' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        {
          provide: AdminAuthService,
          useValue: {
            requestOtp: jest.fn(),
            verifyOtp: jest.fn(),
            deleteSession: jest.fn(),
            serialize: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminAuthController);
    service = module.get(AdminAuthService);
  });

  describe('requestOtp', () => {
    it('returns sent true on success', async () => {
      service.requestOtp.mockResolvedValue(undefined);
      const result = await controller.requestOtp({ email: 'a@b.com', password: 'pw' }, req);
      expect(service.requestOtp).toHaveBeenCalledWith('a@b.com', 'pw', '127.0.0.1');
      expect(result).toEqual({ sent: true });
    });

    it('uses req.ip and never the raw x-forwarded-for header (client-spoofable)', async () => {
      service.requestOtp.mockResolvedValue(undefined);
      const reqWithSpoofedHeader = { headers: { 'x-forwarded-for': '5.5.5.5' }, ip: '203.0.113.9' } as any;
      await controller.requestOtp({ email: 'a@b.com', password: 'pw' }, reqWithSpoofedHeader);
      expect(service.requestOtp).toHaveBeenCalledWith('a@b.com', 'pw', '203.0.113.9');
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.requestOtp.mockRejectedValue(new UnauthorizedException('bad creds'));
      await expect(controller.requestOtp({ email: 'a@b.com', password: 'pw' }, req)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('wraps an unexpected error as a 500', async () => {
      service.requestOtp.mockRejectedValue(new Error('boom'));
      await expect(controller.requestOtp({ email: 'a@b.com', password: 'pw' }, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.requestOtp.mockRejectedValue('plain string');
      await expect(controller.requestOtp({ email: 'a@b.com', password: 'pw' }, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('returns the service result on success', async () => {
      service.verifyOtp.mockResolvedValue({ accessToken: 'tok', admin: {}, mustChangePassword: false } as any);
      const result = await controller.verifyOtp({ email: 'a@b.com', code: '123456' }, req);
      expect(service.verifyOtp).toHaveBeenCalledWith('a@b.com', '123456', '127.0.0.1');
      expect(result).toEqual({ accessToken: 'tok', admin: {}, mustChangePassword: false });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.verifyOtp.mockRejectedValue(new UnauthorizedException('locked'));
      await expect(controller.verifyOtp({ email: 'a@b.com', code: '000000' }, req)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('wraps an unexpected error as a 500', async () => {
      service.verifyOtp.mockRejectedValue(new Error('boom'));
      await expect(controller.verifyOtp({ email: 'a@b.com', code: '000000' }, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.verifyOtp.mockRejectedValue('plain string');
      await expect(controller.verifyOtp({ email: 'a@b.com', code: '000000' }, req)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('logout', () => {
    it('deletes the current admin session', async () => {
      service.deleteSession.mockResolvedValue(undefined);
      await controller.logout({ id: 'admin-1' } as any);
      expect(service.deleteSession).toHaveBeenCalledWith('admin-1');
    });
  });

  describe('me', () => {
    it('returns the serialized admin', async () => {
      service.serialize.mockReturnValue({ id: 'admin-1' } as any);
      const result = await controller.me({ id: 'admin-1' } as any);
      expect(result).toEqual({ id: 'admin-1' });
    });

    it('wraps an unexpected error as a 500', async () => {
      service.serialize.mockImplementation(() => {
        throw new Error('boom');
      });
      await expect(controller.me({ id: 'admin-1' } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.serialize.mockImplementation(() => {
        throw new UnauthorizedException('nope');
      });
      await expect(controller.me({ id: 'admin-1' } as any)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.serialize.mockImplementation(() => {
        throw 'plain string';
      });
      await expect(controller.me({ id: 'admin-1' } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
