import {
  Controller, Get, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import { CONFIG_ENDPOINTS } from './consts/platform-config.consts';

@Controller(CONFIG_ENDPOINTS.ROOT)
export class PlatformConfigController {
  private readonly logger = new Logger(PlatformConfigController.name);

  constructor(private readonly cfg: PlatformConfigService) {}

  @Get(CONFIG_ENDPOINTS.PUBLIC)
  async getPublic() {
    try {
      return await this.cfg.getPublicConfig();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('getPublicConfig failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
