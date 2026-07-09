import { InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminProfileController } from './admin-profile.controller';
import { AdminAuthService } from '../auth/admin-auth.service';

describe('AdminProfileController', () => {
  let controller: AdminProfileController;
  let authService: jest.Mocked<AdminAuthService>;
  const admin = { id: 'admin-1' } as any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminProfileController],
      providers: [
        {
          provide: AdminAuthService,
          useValue: { changePassword: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AdminProfileController);
    authService = module.get(AdminAuthService);
  });

  describe('changePassword', () => {
    it('delegates to authService with admin id, new password, and current password', async () => {
      authService.changePassword.mockResolvedValue(undefined as any);

      await controller.changePassword(
        { newPassword: 'newPass123', currentPassword: 'oldPass' } as any,
        admin,
      );

      expect(authService.changePassword).toHaveBeenCalledWith('admin-1', 'newPass123', 'oldPass');
    });

    it('passes undefined currentPassword when not provided', async () => {
      authService.changePassword.mockResolvedValue(undefined as any);

      await controller.changePassword({ newPassword: 'newPass123' } as any, admin);

      expect(authService.changePassword).toHaveBeenCalledWith('admin-1', 'newPass123', undefined);
    });

    it('rethrows a known HttpException unchanged', async () => {
      authService.changePassword.mockRejectedValue(new ForbiddenException('Senha atual incorreta'));

      await expect(
        controller.changePassword({ newPassword: 'x' } as any, admin),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('wraps an unexpected error as a 500', async () => {
      authService.changePassword.mockRejectedValue(new Error('db down'));

      await expect(
        controller.changePassword({ newPassword: 'x' } as any, admin),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error thrown value as a 500', async () => {
      authService.changePassword.mockRejectedValue('plain string');

      await expect(
        controller.changePassword({ newPassword: 'x' } as any, admin),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
