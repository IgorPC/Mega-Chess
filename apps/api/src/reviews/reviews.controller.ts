import {
  Controller, Post, Get, Body, UseGuards, Query,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { REVIEWS_ENDPOINTS } from './consts/endpoints';

@Controller(REVIEWS_ENDPOINTS.ROOT)
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  private readonly logger = new Logger(ReviewsController.name);

  constructor(private reviews: ReviewsService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateReviewDto) {
    try {
      return await this.reviews.create(user.id, dto);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`create review failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(REVIEWS_ENDPOINTS.PENDING)
  async getPending(@CurrentUser() user: any) {
    try {
      return await this.reviews.getPending(user.id);
    } catch (err) {
      this.logger.error(`getPending failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
