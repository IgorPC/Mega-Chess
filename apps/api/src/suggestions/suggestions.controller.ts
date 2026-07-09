import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UseGuards, HttpCode, Request, Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuggestionsService } from './suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto';
import { SUGGESTIONS_ENDPOINTS } from './consts/endpoints';

@Controller(SUGGESTIONS_ENDPOINTS.ROOT)
@UseGuards(JwtAuthGuard)
export class SuggestionsController {
  private readonly logger = new Logger(SuggestionsController.name);

  constructor(private readonly svc: SuggestionsService) {}

  @Get()
  async list(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    try {
      return await this.svc.list(req.user.id, +(page ?? 1), +(limit ?? 20), status);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('list suggestions failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(SUGGESTIONS_ENDPOINTS.BY_ID)
  async getOne(@Request() req: any, @Param('id') id: string) {
    try {
      return await this.svc.getOne(req.user.id, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getOne suggestion failed id=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post()
  @HttpCode(201)
  async create(@Request() req: any, @Body() dto: CreateSuggestionDto) {
    try {
      return await this.svc.create(req.user.id, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('create suggestion failed', err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch(SUGGESTIONS_ENDPOINTS.BY_ID)
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateSuggestionDto) {
    try {
      return await this.svc.update(req.user.id, id, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`update suggestion failed id=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete(SUGGESTIONS_ENDPOINTS.BY_ID)
  @HttpCode(204)
  async delete(@Request() req: any, @Param('id') id: string) {
    try {
      await this.svc.delete(req.user.id, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`delete suggestion failed id=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(SUGGESTIONS_ENDPOINTS.VOTE)
  @HttpCode(204)
  async vote(@Request() req: any, @Param('id') id: string) {
    try {
      await this.svc.vote(req.user.id, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`vote suggestion failed id=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete(SUGGESTIONS_ENDPOINTS.VOTE)
  @HttpCode(204)
  async unvote(@Request() req: any, @Param('id') id: string) {
    try {
      await this.svc.unvote(req.user.id, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`unvote suggestion failed id=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
