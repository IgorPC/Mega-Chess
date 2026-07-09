import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { MatchReportsService } from './match-reports.service';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { MatchReport } from '../entities/match-report.entity';
import { MatchReportAppeal } from '../entities/match-report-appeal.entity';
import { Notification } from '../entities/notification.entity';
import { DeepseekModule } from '../deepseek/deepseek.module';
import { UserActivityModule } from '../user-activity/user-activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, User, MatchReport, MatchReportAppeal, Notification]),
    DeepseekModule,
    UserActivityModule,
  ],
  providers: [MatchesService, MatchReportsService],
  controllers: [MatchesController],
  exports: [MatchesService],
})
export class MatchesModule {}
