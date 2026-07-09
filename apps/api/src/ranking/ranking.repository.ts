import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class RankingRepository {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findTopByRating(limit: number): Promise<User[]> {
    return this.users.find({
      select: ['id', 'name', 'nickname', 'avatarUrl', 'rating'],
      order: { rating: 'DESC' },
      take: limit,
    });
  }

  findRating(userId: string): Promise<Pick<User, 'rating'> | null> {
    return this.users.findOne({ where: { id: userId }, select: ['rating'] });
  }

  countAboveRating(rating: number): Promise<number> {
    return this.users.count({ where: { rating: MoreThanOrEqual(rating + 1) } });
  }
}
