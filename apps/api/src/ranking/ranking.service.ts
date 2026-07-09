import { Injectable } from '@nestjs/common';
import { RankingRepository } from './ranking.repository';
import { DEFAULT_TOP_PLAYERS_LIMIT } from './consts/endpoints';

@Injectable()
export class RankingService {
  constructor(private readonly repo: RankingRepository) {}

  async getTopPlayers(period: 'day' | 'week' | 'month', limit = DEFAULT_TOP_PLAYERS_LIMIT) {
    return this.repo.findTopByRating(limit);
  }

  async getUserRank(userId: string) {
    const user = await this.repo.findRating(userId);
    if (!user) return null;
    const above = await this.repo.countAboveRating(user.rating);
    return { position: above + 1, rating: user.rating };
  }
}
