import {
  Controller, Get, Query, UseGuards,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { RankingService } from './ranking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RANKING_ENDPOINTS } from './consts/endpoints';

@Controller(RANKING_ENDPOINTS.ROOT)
export class RankingController {
  private readonly logger = new Logger(RankingController.name);

  constructor(private ranking: RankingService) {}

  @Get()
  async getTop(@Query('period') period: 'day' | 'week' | 'month' = 'week') {
    try {
      return await this.ranking.getTopPlayers(period);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getTop failed period=${period}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(RANKING_ENDPOINTS.ME)
  async getMyRank(@CurrentUser() user: any) {
    try {
      return await this.ranking.getUserRank(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getMyRank failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
