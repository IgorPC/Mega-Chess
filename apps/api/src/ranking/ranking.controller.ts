import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('ranking')
export class RankingController {
  constructor(private ranking: RankingService) {}

  @Get()
  getTop(@Query('period') period: 'day' | 'week' | 'month' = 'week') {
    return this.ranking.getTopPlayers(period);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyRank(@CurrentUser() user: any) {
    return this.ranking.getUserRank(user.id);
  }
}
