import { InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getMe: jest.fn(),
            updateProfile: jest.fn(),
            updateAvatar: jest.fn(),
            updateBilling: jest.fn(),
            getStats: jest.fn(),
            getMatchHistory: jest.fn(),
            findByNickname: jest.fn(),
            getReviews: jest.fn(),
            acceptTerms: jest.fn(),
            deleteAccount: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
    service = module.get(UsersService);
  });

  const user = { id: 'u1' };

  describe('getMe', () => {
    it('returns the current user profile', async () => {
      service.getMe.mockResolvedValue({ id: 'u1' } as any);
      const result = await controller.getMe(user);
      expect(service.getMe).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ id: 'u1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getMe.mockRejectedValue(new NotFoundException());
      await expect(controller.getMe(user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getMe.mockRejectedValue(new Error('boom'));
      await expect(controller.getMe(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getMe.mockRejectedValue('plain string');
      await expect(controller.getMe(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('updateProfile', () => {
    it('forwards the dto to the service', async () => {
      service.updateProfile.mockResolvedValue({ id: 'u1', name: 'New' } as any);
      const result = await controller.updateProfile(user, { name: 'New' } as any);
      expect(service.updateProfile).toHaveBeenCalledWith('u1', { name: 'New' });
      expect(result).toEqual({ id: 'u1', name: 'New' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.updateProfile.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.updateProfile(user, {} as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.updateProfile.mockRejectedValue(new Error('boom'));
      await expect(controller.updateProfile(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.updateProfile.mockRejectedValue('plain string');
      await expect(controller.updateProfile(user, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('uploadAvatar', () => {
    it('throws BadRequestException when no file is provided', async () => {
      await expect(controller.uploadAvatar(user, undefined as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(service.updateAvatar).not.toHaveBeenCalled();
    });

    it('uploads the avatar using the generated filename path', async () => {
      service.updateAvatar.mockResolvedValue({ id: 'u1', avatarUrl: '/uploads/avatars/x.jpg' });
      const file = { filename: 'x.jpg' } as any;
      const result = await controller.uploadAvatar(user, file);
      expect(service.updateAvatar).toHaveBeenCalledWith('u1', '/uploads/avatars/x.jpg');
      expect(result).toEqual({ id: 'u1', avatarUrl: '/uploads/avatars/x.jpg' });
    });

    it('wraps an unexpected error as a 500', async () => {
      service.updateAvatar.mockRejectedValue(new Error('boom'));
      await expect(controller.uploadAvatar(user, { filename: 'x.jpg' } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.updateAvatar.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.uploadAvatar(user, { filename: 'x.jpg' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.updateAvatar.mockRejectedValue('plain string');
      await expect(controller.uploadAvatar(user, { filename: 'x.jpg' } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('updateBilling', () => {
    it('forwards the dto to the service', async () => {
      service.updateBilling.mockResolvedValue({ id: 'u1' } as any);
      const result = await controller.updateBilling(user, { cpf: '12345678900' });
      expect(service.updateBilling).toHaveBeenCalledWith('u1', { cpf: '12345678900' });
      expect(result).toEqual({ id: 'u1' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.updateBilling.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.updateBilling(user, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.updateBilling.mockRejectedValue(new Error('boom'));
      await expect(controller.updateBilling(user, {})).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.updateBilling.mockRejectedValue('plain string');
      await expect(controller.updateBilling(user, {})).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getMyStats', () => {
    it('returns the stats for the current user', async () => {
      service.getStats.mockResolvedValue({ wins: 1 } as any);
      const result = await controller.getMyStats(user);
      expect(service.getStats).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ wins: 1 });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getStats.mockRejectedValue(new NotFoundException());
      await expect(controller.getMyStats(user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getStats.mockRejectedValue(new Error('boom'));
      await expect(controller.getMyStats(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getStats.mockRejectedValue('plain string');
      await expect(controller.getMyStats(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getMyHistory', () => {
    it('forwards page and limit to the service', async () => {
      service.getMatchHistory.mockResolvedValue({ matches: [] } as any);
      const result = await controller.getMyHistory(user, 2, 10);
      expect(service.getMatchHistory).toHaveBeenCalledWith('u1', 2, 10);
      expect(result).toEqual({ matches: [] });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getMatchHistory.mockRejectedValue(new NotFoundException());
      await expect(controller.getMyHistory(user, 1, 20)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getMatchHistory.mockRejectedValue(new Error('boom'));
      await expect(controller.getMyHistory(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getMatchHistory.mockRejectedValue('plain string');
      await expect(controller.getMyHistory(user, 1, 20)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getProfile', () => {
    it('returns the profile for the given nickname', async () => {
      service.findByNickname.mockResolvedValue({ id: 'u2', nickname: 'bob' } as any);
      const result = await controller.getProfile('bob');
      expect(service.findByNickname).toHaveBeenCalledWith('bob');
      expect(result).toEqual({ id: 'u2', nickname: 'bob' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.findByNickname.mockRejectedValue(new NotFoundException());
      await expect(controller.getProfile('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.findByNickname.mockRejectedValue(new Error('boom'));
      await expect(controller.getProfile('bob')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.findByNickname.mockRejectedValue('plain string');
      await expect(controller.getProfile('bob')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getStats', () => {
    it('looks up the user then returns stats for their id', async () => {
      service.findByNickname.mockResolvedValue({ id: 'u2' } as any);
      service.getStats.mockResolvedValue({ wins: 2 } as any);
      const result = await controller.getStats('bob');
      expect(service.findByNickname).toHaveBeenCalledWith('bob');
      expect(service.getStats).toHaveBeenCalledWith('u2');
      expect(result).toEqual({ wins: 2 });
    });

    it('rethrows a known HttpException when nickname is not found', async () => {
      service.findByNickname.mockRejectedValue(new NotFoundException());
      await expect(controller.getStats('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.findByNickname.mockRejectedValue(new Error('boom'));
      await expect(controller.getStats('bob')).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.findByNickname.mockRejectedValue('plain string');
      await expect(controller.getStats('bob')).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('getReviews', () => {
    it('forwards nickname, page and limit to the service', async () => {
      service.getReviews.mockResolvedValue({ data: [] } as any);
      const result = await controller.getReviews('bob', 1, 10);
      expect(service.getReviews).toHaveBeenCalledWith('bob', 1, 10);
      expect(result).toEqual({ data: [] });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.getReviews.mockRejectedValue(new NotFoundException());
      await expect(controller.getReviews('missing', 1, 10)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getReviews.mockRejectedValue(new Error('boom'));
      await expect(controller.getReviews('bob', 1, 10)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getReviews.mockRejectedValue('plain string');
      await expect(controller.getReviews('bob', 1, 10)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('acceptTerms', () => {
    it('delegates to the service and returns the updated profile', async () => {
      service.acceptTerms.mockResolvedValue({ id: 'u1', termsVersion: '2026-07-03' } as any);
      const result = await controller.acceptTerms(user);
      expect(service.acceptTerms).toHaveBeenCalledWith('u1');
      expect(result).toEqual({ id: 'u1', termsVersion: '2026-07-03' });
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.acceptTerms.mockRejectedValue(new BadRequestException('bad'));
      await expect(controller.acceptTerms(user)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.acceptTerms.mockRejectedValue(new Error('boom'));
      await expect(controller.acceptTerms(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.acceptTerms.mockRejectedValue('plain string');
      await expect(controller.acceptTerms(user)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('deleteAccount', () => {
    it('delegates to the service with acknowledgeBalanceLoss defaulted to false', async () => {
      service.deleteAccount.mockResolvedValue({ success: true } as any);
      const result = await controller.deleteAccount(user, {});
      expect(service.deleteAccount).toHaveBeenCalledWith('u1', false);
      expect(result).toEqual({ success: true });
    });

    it('forwards an explicit acknowledgeBalanceLoss flag', async () => {
      service.deleteAccount.mockResolvedValue({ success: true } as any);
      await controller.deleteAccount(user, { acknowledgeBalanceLoss: true });
      expect(service.deleteAccount).toHaveBeenCalledWith('u1', true);
    });

    it('rethrows a known HttpException unchanged', async () => {
      service.deleteAccount.mockRejectedValue(new BadRequestException({ code: 'HAS_BALANCE', balance: 10 }));
      await expect(controller.deleteAccount(user, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.deleteAccount.mockRejectedValue(new Error('boom'));
      await expect(controller.deleteAccount(user, {})).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.deleteAccount.mockRejectedValue('plain string');
      await expect(controller.deleteAccount(user, {})).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
