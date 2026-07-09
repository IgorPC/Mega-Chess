import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformRevenue } from './entities/platform-revenue.entity';
import { PlatformRevenueService } from './platform-revenue.service';
import { PlatformRevenueRepository } from './platform-revenue.repository';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformRevenue])],
  providers: [PlatformRevenueService, PlatformRevenueRepository],
  exports: [PlatformRevenueService],
})
export class PlatformRevenueModule {}
