import {
  Controller, Get, Post, Delete, Param, Query, Body,
  UseGuards, HttpCode, HttpStatus, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { AdminTournamentsService } from './admin-tournaments.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminUser, AdminRole } from '../../entities/admin-user.entity';
import { ADMIN_TOURNAMENTS_CONTROLLER_PATH, ADMIN_TOURNAMENTS_ROUTES, ADMIN_TOURNAMENTS_DEFAULTS } from './consts/endpoints';

@Controller(ADMIN_TOURNAMENTS_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminTournamentsController {
  private readonly logger = new Logger(AdminTournamentsController.name);

  constructor(private readonly svc: AdminTournamentsService) {}

  @Get(ADMIN_TOURNAMENTS_ROUTES.LIST)
  async list(@Query() q: { page?: string; limit?: string; status?: string }) {
    try {
      return await this.svc.list({
        page: +(q.page ?? ADMIN_TOURNAMENTS_DEFAULTS.PAGE),
        limit: +(q.limit ?? ADMIN_TOURNAMENTS_DEFAULTS.LIMIT),
        status: q.status,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin list tournaments failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TOURNAMENTS_ROUTES.DUELS)
  async listDuels(@Query() q: { page?: string; limit?: string; view?: string }) {
    try {
      return await this.svc.listDuels({
        page: +(q.page ?? ADMIN_TOURNAMENTS_DEFAULTS.PAGE),
        limit: +(q.limit ?? ADMIN_TOURNAMENTS_DEFAULTS.LIMIT),
        view: q.view === 'finished' ? 'finished' : 'active',
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin listDuels failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TOURNAMENTS_ROUTES.MATCH_MOVES)
  async matchMoves(@Param('tmId') tmId: string) {
    try {
      return await this.svc.matchMoves(tmId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin matchMoves failed tmId=${tmId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_TOURNAMENTS_ROUTES.MATCH_ANALYZE)
  @HttpCode(HttpStatus.OK)
  async analyzeMatch(@Param('tmId') tmId: string) {
    try {
      return await this.svc.analyzeMatchWithAi(tmId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin analyzeMatch failed tmId=${tmId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TOURNAMENTS_ROUTES.BY_ID)
  async get(@Param('id') id: string) {
    try {
      return await this.svc.get(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin get tournament failed tournamentId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TOURNAMENTS_ROUTES.PARTICIPANTS)
  async participants(@Param('id') id: string) {
    try {
      return await this.svc.participants(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin participants failed tournamentId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(ADMIN_TOURNAMENTS_ROUTES.MATCHES)
  async matches(@Param('id') id: string) {
    try {
      return await this.svc.matches(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin matches failed tournamentId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_TOURNAMENTS_ROUTES.START)
  @AdminRoles(AdminRole.OPERADOR)
  @HttpCode(204)
  async start(@Param('id') id: string, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.start(id, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin start tournament failed tournamentId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(ADMIN_TOURNAMENTS_ROUTES.CANCEL)
  @AdminRoles(AdminRole.OPERADOR)
  @HttpCode(204)
  async cancel(@Param('id') id: string, @CurrentAdmin() admin: AdminUser) {
    try {
      return await this.svc.cancel(id, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin cancel tournament failed tournamentId=${id} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete(ADMIN_TOURNAMENTS_ROUTES.REMOVE_PARTICIPANT)
  @AdminRoles(AdminRole.OPERADOR)
  @HttpCode(204)
  async removeParticipant(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentAdmin() admin: AdminUser,
  ) {
    try {
      return await this.svc.removeParticipant(id, userId, admin);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin removeParticipant failed tournamentId=${id} userId=${userId} adminId=${admin?.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
