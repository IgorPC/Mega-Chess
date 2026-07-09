import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserActivityLog } from '../entities/user-activity-log.entity';
import { UserActivityService } from './user-activity.service';
import { UserActivityLogRepository } from './user-activity-log.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserActivityLog])],
  providers: [UserActivityService, UserActivityLogRepository],
  exports: [UserActivityService],
})
export class UserActivityModule {}
