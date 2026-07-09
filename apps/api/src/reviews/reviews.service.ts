import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { CreateReviewDto } from './dto/create-review.dto';

const REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviews: Repository<Review>,
    @InjectRepository(Match) private matches: Repository<Match>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async create(reviewerId: string, dto: CreateReviewDto) {
    const match = await this.matches.findOne({ where: { id: dto.matchId } });
    if (!match || match.status !== MatchStatus.FINISHED) throw new BadRequestException('Match not finished');
    if (match.whitePlayerId !== reviewerId && match.blackPlayerId !== reviewerId)
      throw new ForbiddenException('You did not play in this match');
    if (dto.reviewedId === reviewerId) throw new BadRequestException('Cannot review yourself');
    if (match.whitePlayerId !== dto.reviewedId && match.blackPlayerId !== dto.reviewedId)
      throw new ForbiddenException('Player was not in this match');

    if (match.finishedAt) {
      const elapsed = Date.now() - new Date(match.finishedAt).getTime();
      if (elapsed > REVIEW_WINDOW_MS) throw new BadRequestException('Review window of 48 hours has passed');
    }

    const review = this.reviews.create({
      reviewerId,
      reviewedId: dto.reviewedId,
      matchId: dto.matchId,
      rating: dto.rating,
      comment: dto.comment,
    });
    const saved = await this.reviews.save(review);
    await this.recalcStats(dto.reviewedId);
    return saved;
  }

  async getPending(userId: string) {
    const finished = await this.matches.find({
      where: [
        { whitePlayerId: userId, status: MatchStatus.FINISHED },
        { blackPlayerId: userId, status: MatchStatus.FINISHED },
      ],
      order: { finishedAt: 'DESC' },
      take: 50,
    });

    const cutoff = new Date(Date.now() - REVIEW_WINDOW_MS);
    const reviewable = finished.filter((m) => m.finishedAt && new Date(m.finishedAt) > cutoff);
    if (!reviewable.length) return [];

    const matchIds = reviewable.map((m) => m.id);
    const given = await this.reviews.createQueryBuilder('r')
      .where('r.reviewerId = :userId', { userId })
      .andWhere('r.matchId IN (:...matchIds)', { matchIds })
      .getMany();

    const givenSet = new Set(given.map((r) => r.matchId));
    const opponentIds = reviewable
      .filter((m) => !givenSet.has(m.id))
      .map((m) => (m.whitePlayerId === userId ? m.blackPlayerId : m.whitePlayerId));
    if (!opponentIds.length) return [];

    const uniqueOpponentIds = [...new Set(opponentIds)];
    const opponents = await this.users.findByIds(uniqueOpponentIds);
    const opponentMap = new Map(opponents.map((u) => [u.id, u]));

    return reviewable
      .filter((m) => !givenSet.has(m.id))
      .map((m) => {
        const opId = m.whitePlayerId === userId ? m.blackPlayerId : m.whitePlayerId;
        const op = opponentMap.get(opId);
        return {
          matchId: m.id,
          finishedAt: m.finishedAt,
          opponent: op ? { id: op.id, nickname: op.nickname, avatarUrl: op.avatarUrl } : { id: opId },
        };
      });
  }

  async getForUser(nickname: string, page = 1, limit = 10) {
    limit = Math.min(limit, 50);
    const user = await this.users.findOne({ where: { nickname } });
    if (!user) return { data: [], total: 0, page, totalPages: 0 };

    const [data, total] = await this.reviews.findAndCount({
      where: { reviewedId: user.id },
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  private async recalcStats(userId: string) {
    const { avg, count } = await this.reviews
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.reviewedId = :userId', { userId })
      .getRawOne<{ avg: string; count: string }>();

    await this.users.update(userId, {
      avgRating: avg ? parseFloat(avg) : null,
      reviewCount: parseInt(count ?? '0', 10),
    });
  }
}
