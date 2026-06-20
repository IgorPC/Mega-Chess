import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class RankingService {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  async getTopPlayers(period: 'day' | 'week' | 'month', limit = 100) {
    return this.users.find({
      select: ['id', 'name', 'nickname', 'avatarUrl', 'rating'],
      order: { rating: 'DESC' },
      take: limit,
    });
  }

  async getUserRank(userId: string) {
    const user = await this.users.findOne({ where: { id: userId }, select: ['rating'] });
    if (!user) return null;
    const above = await this.users.count({ where: { rating: MoreThanOrEqual(user.rating + 1) } });
    return { position: above + 1, rating: user.rating };
  }
}
