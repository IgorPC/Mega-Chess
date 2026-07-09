import {
  Controller, Post, Delete, Get, Body, UseGuards,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TournamentType } from '../entities/tournament.entity';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  private readonly logger = new Logger(MatchmakingController.name);

  constructor(private matchmaking: MatchmakingService) {}

  // ─── Queue sizes ───────────────────────────────────────────────────────────

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('active-match')
  async activeMatch(@CurrentUser() user: any) {
    try {
      return await this.matchmaking.getActiveMatch(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`activeMatch failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('sizes')
  async getSizes() {
    try {
      return await this.matchmaking.getQueueSizes();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('getSizes failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  // ─── Casual ────────────────────────────────────────────────────────────────

  @Post('queue')
  async joinQueue(@CurrentUser() user: any) {
    try {
      return await this.matchmaking.joinQueue(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`joinQueue failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete('queue')
  async leaveQueue(@CurrentUser() user: any) {
    try {
      return await this.matchmaking.leaveQueue(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`leaveQueue failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  // ─── Duel ─────────────────────────────────────────────────────────────────

  @Post('duel/queue')
  async joinDuelQueue(
    @CurrentUser() user: any,
    @Body('type') type: TournamentType.DUEL_FLASH | TournamentType.DUEL_GIANT,
    @Body('entryFee') entryFee: number,
  ) {
    try {
      return await this.matchmaking.joinDuelQueue(user.id, type, entryFee as any);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`joinDuelQueue failed userId=${user.id} type=${type} fee=${entryFee}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete('duel/queue')
  async leaveDuelQueue(@CurrentUser() user: any) {
    try {
      return await this.matchmaking.leaveDuelQueue(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`leaveDuelQueue failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  // ─── Challenges ────────────────────────────────────────────────────────────

  @Post('challenge')
  async sendChallenge(@CurrentUser() user: any, @Body('challengedId') challengedId: string) {
    try {
      return await this.matchmaking.sendChallenge(user.id, challengedId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`sendChallenge failed userId=${user.id} challengedId=${challengedId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post('challenge/accept')
  async acceptChallenge(@CurrentUser() user: any, @Body('challengerId') challengerId: string) {
    try {
      return await this.matchmaking.acceptChallenge(user.id, challengerId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`acceptChallenge failed userId=${user.id} challengerId=${challengerId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post('challenge/deny')
  async denyChallenge(@CurrentUser() user: any, @Body('challengerId') challengerId: string) {
    try {
      return await this.matchmaking.denyChallenge(user.id, challengerId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`denyChallenge failed userId=${user.id} challengerId=${challengerId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
