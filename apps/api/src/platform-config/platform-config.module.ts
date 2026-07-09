import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformConfig } from './entities/platform-config.entity';
import { PlatformConfigService } from './platform-config.service';
import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigRepository } from './platform-config.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformConfig])],
  providers: [PlatformConfigService, PlatformConfigRepository],
  controllers: [PlatformConfigController],
  exports: [PlatformConfigService],
})
export class PlatformConfigModule {}
