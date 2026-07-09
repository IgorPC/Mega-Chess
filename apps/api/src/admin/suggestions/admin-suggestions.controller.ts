import {
  Controller, Get, Patch, Param, Query, Body,
  UseGuards, HttpCode, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminRolesGuard } from '../guards/admin-roles.guard';
import { AdminRoles } from '../decorators/admin-roles.decorator';
import { AdminRole } from '../../entities/admin-user.entity';
import { SuggestionsService } from '../../suggestions/suggestions.service';
import { SuggestionStatus } from '../../entities/improvement-suggestion.entity';
import { ADMIN_SUGGESTIONS_CONTROLLER_PATH, ADMIN_SUGGESTIONS_ROUTES, ADMIN_SUGGESTIONS_DEFAULTS } from './consts/endpoints';

class AdminUpdateSuggestionDto {
  @IsEnum(SuggestionStatus)
  status: SuggestionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

@Controller(ADMIN_SUGGESTIONS_CONTROLLER_PATH)
@UseGuards(AdminJwtGuard, AdminRolesGuard)
export class AdminSuggestionsController {
  private readonly logger = new Logger(AdminSuggestionsController.name);

  constructor(private readonly svc: SuggestionsService) {}

  @Get(ADMIN_SUGGESTIONS_ROUTES.LIST)
  @AdminRoles(AdminRole.OPERADOR)
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('authorId') authorId?: string,
  ) {
    try {
      return await this.svc.adminList({
        page: +(page ?? ADMIN_SUGGESTIONS_DEFAULTS.PAGE),
        limit: +(limit ?? ADMIN_SUGGESTIONS_DEFAULTS.LIMIT),
        status,
        dateFrom,
        dateTo,
        authorId,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('admin list suggestions failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch(ADMIN_SUGGESTIONS_ROUTES.UPDATE)
  @AdminRoles(AdminRole.OPERADOR)
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: AdminUpdateSuggestionDto) {
    try {
      return await this.svc.adminUpdate(id, dto.status, dto.adminNote);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`admin update suggestion failed id=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
