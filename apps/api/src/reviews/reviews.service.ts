import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviews: Repository<Review>,
    @InjectRepository(Match) private matches: Repository<Match>,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto) {
    const match = await this.matches.findOne({ where: { id: dto.matchId } });
    if (!match || match.status !== MatchStatus.FINISHED) throw new BadRequestException('Match not finished');
    if (match.whitePlayerId !== reviewerId && match.blackPlayerId !== reviewerId)
      throw new ForbiddenException('You did not play in this match');
    if (dto.reviewedId === reviewerId) throw new BadRequestException('Cannot review yourself');
    if (match.whitePlayerId !== dto.reviewedId && match.blackPlayerId !== dto.reviewedId)
      throw new ForbiddenException('Player was not in this match');

    const review = this.reviews.create({ reviewerId, reviewedId: dto.reviewedId, matchId: dto.matchId, rating: dto.rating, comment: dto.comment });
    return this.reviews.save(review);
  }
}
