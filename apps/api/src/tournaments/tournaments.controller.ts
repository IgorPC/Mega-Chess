import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards,
  ParseUUIDPipe, DefaultValuePipe, ParseIntPipe, HttpCode, HttpStatus,
  ServiceUnavailableException, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  InviteDuelDto,
  CreateCustomTournamentDto, JoinTournamentDto,
  InviteByNicknameDto, KickParticipantDto,
} from './dtos/create-tournament.dto';
import { ListTournamentsDto } from './dtos/list-tournaments.dto';
import { TOURNAMENTS_ROOT, TOURNAMENTS_ROUTES } from './consts/endpoints';

@Controller(TOURNAMENTS_ROOT)
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  private readonly logger = new Logger(TournamentsController.name);

  constructor(private readonly svc: TournamentsService) {}

  private assertTournamentsEnabled(): void {
    throw new ServiceUnavailableException('Módulo de torneios em implementação. Em breve disponível!');
  }

  // ─── Duelo 1v1 ───────────────────────────────────────────────────────────

  @Post(TOURNAMENTS_ROUTES.DUEL_INVITE)
  async inviteDuel(
    @CurrentUser() user: { id: string },
    @Body() dto: InviteDuelDto,
  ) {
    try {
      return await this.svc.inviteFriend(user.id, dto.friendId, dto.type, dto.entryFee);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`inviteDuel failed userId=${user.id} friendId=${dto.friendId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(TOURNAMENTS_ROUTES.DUEL_ACCEPT)
  @HttpCode(HttpStatus.OK)
  async acceptDuelInvite(
    @CurrentUser() user: { id: string },
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    try {
      return await this.svc.acceptDuelInvite(user.id, tournamentId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`acceptDuelInvite failed userId=${user.id} tournamentId=${tournamentId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(TOURNAMENTS_ROUTES.DUEL_DECLINE)
  @HttpCode(HttpStatus.OK)
  async declineDuelInvite(
    @CurrentUser() user: { id: string },
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    try {
      return await this.svc.declineDuelInvite(user.id, tournamentId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`declineDuelInvite failed userId=${user.id} tournamentId=${tournamentId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  // ─── Torneios criados por jogadores ──────────────────────────────────────

  @Get()
  list() { this.assertTournamentsEnabled(); }

  @Get(TOURNAMENTS_ROUTES.MINE)
  myTournaments() { this.assertTournamentsEnabled(); }

  @Post()
  create() { this.assertTournamentsEnabled(); }

  @Get(TOURNAMENTS_ROUTES.DETAILS)
  details() { this.assertTournamentsEnabled(); }

  @Post(TOURNAMENTS_ROUTES.JOIN)
  @HttpCode(HttpStatus.OK)
  join() { this.assertTournamentsEnabled(); }

  @Delete(TOURNAMENTS_ROUTES.LEAVE)
  @HttpCode(HttpStatus.OK)
  leave() { this.assertTournamentsEnabled(); }

  @Post(TOURNAMENTS_ROUTES.START)
  @HttpCode(HttpStatus.OK)
  start() { this.assertTournamentsEnabled(); }

  @Delete(TOURNAMENTS_ROUTES.CANCEL)
  @HttpCode(HttpStatus.OK)
  cancel() { this.assertTournamentsEnabled(); }

  @Post(TOURNAMENTS_ROUTES.INVITE_BY_NICKNAME)
  inviteByNickname() { this.assertTournamentsEnabled(); }

  @Post(TOURNAMENTS_ROUTES.INVITE_FRIEND)
  inviteFriend() { this.assertTournamentsEnabled(); }

  @Post(TOURNAMENTS_ROUTES.KICK)
  @HttpCode(HttpStatus.OK)
  kick() { this.assertTournamentsEnabled(); }

  @Get(TOURNAMENTS_ROUTES.HISTORY_ME)
  async history(
    @CurrentUser() user: { id: string },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    try {
      return await this.svc.getUserTournamentHistory(user.id, page, Math.min(limit, 50));
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`history failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(TOURNAMENTS_ROUTES.MATCH_DETAILS)
  async matchDetails(@Param('matchId', ParseUUIDPipe) matchId: string) {
    try {
      return await this.svc.getMatchTournamentDetails(matchId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`matchDetails failed matchId=${matchId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
