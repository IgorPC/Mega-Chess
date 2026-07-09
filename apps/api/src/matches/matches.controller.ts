import {
  Controller, Post, Get, Body, Param, ParseUUIDPipe, UseGuards,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { MatchReportsService } from './match-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateOfflineMatchDto } from './dto/create-offline-match.dto';
import { ReportMatchDto, AppealReportDto } from './dto/report-match.dto';

@UseGuards(JwtAuthGuard)
@Controller('matches')
export class MatchesController {
  private readonly logger = new Logger(MatchesController.name);

  constructor(
    private matches: MatchesService,
    private reports: MatchReportsService,
  ) {}

  @Post('offline')
  async saveOfflineMatch(@CurrentUser() user: any, @Body() dto: CreateOfflineMatchDto) {
    try {
      return await this.matches.createOfflineMatch(
        user.id,
        dto.result,
        dto.difficulty,
        dto.pgn ?? '',
        dto.moves ?? [],
      );
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`saveOfflineMatch failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(':id/report')
  async createReport(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: ReportMatchDto,
  ) {
    try {
      return await this.reports.createReport(user.id, matchId, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`createReport failed userId=${user.id} matchId=${matchId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(':id/report')
  async getReport(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) matchId: string) {
    try {
      return await this.reports.getReport(user.id, matchId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getReport failed userId=${user.id} matchId=${matchId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(':id/report/appeal')
  async createAppeal(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) matchId: string,
    @Body() dto: AppealReportDto,
  ) {
    try {
      return await this.reports.createAppeal(user.id, matchId, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`createAppeal failed userId=${user.id} matchId=${matchId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
