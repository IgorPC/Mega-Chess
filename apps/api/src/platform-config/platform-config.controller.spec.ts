import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

describe('PlatformConfigController', () => {
  let controller: PlatformConfigController;
  let service: jest.Mocked<PlatformConfigService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PlatformConfigController],
      providers: [
        { provide: PlatformConfigService, useValue: { getPublicConfig: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PlatformConfigController);
    service = module.get(PlatformConfigService);
  });

  describe('getPublic', () => {
    it('returns the public config from the service', async () => {
      const cfg = { fees: {}, maintenance: { active: false } };
      service.getPublicConfig.mockResolvedValue(cfg as any);
      const result = await controller.getPublic();
      expect(result).toBe(cfg);
    });

    it('rethrows a known HttpException from the service unchanged', async () => {
      service.getPublicConfig.mockRejectedValue(new NotFoundException('nope'));
      await expect(controller.getPublic()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('wraps an unexpected error as a 500', async () => {
      service.getPublicConfig.mockRejectedValue(new Error('db down'));
      await expect(controller.getPublic()).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('wraps a non-Error rejection as a 500', async () => {
      service.getPublicConfig.mockRejectedValue('plain string');
      await expect(controller.getPublic()).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
