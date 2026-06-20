import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private matchmaking: MatchmakingService) {}

  @Post('queue')
  joinQueue(@CurrentUser() user: any) {
    return this.matchmaking.joinQueue(user.id);
  }

  @Delete('queue')
  leaveQueue(@CurrentUser() user: any) {
    return this.matchmaking.leaveQueue(user.id);
  }

  @Post('challenge')
  sendChallenge(@CurrentUser() user: any, @Body('challengedId') challengedId: string) {
    return this.matchmaking.sendChallenge(user.id, challengedId);
  }

  @Post('challenge/accept')
  acceptChallenge(@CurrentUser() user: any, @Body('challengerId') challengerId: string) {
    return this.matchmaking.acceptChallenge(user.id, challengerId);
  }
}
