import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Match) private matches: Repository<Match>,
  ) {}

  async findByNickname(nickname: string) {
    const user = await this.users.findOne({
      where: { nickname },
      relations: ['reviewsReceived', 'reviewsReceived.reviewer'],
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async getMe(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.users.update(userId, dto);
    return this.getMe(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.users.update(userId, { avatarUrl });
    return { id: userId, avatarUrl };
  }

  async getMatchHistory(userId: string, page = 1, limit = 20) {
    const [matches, total] = await this.matches.findAndCount({
      where: [
        { whitePlayerId: userId, status: MatchStatus.FINISHED },
        { blackPlayerId: userId, status: MatchStatus.FINISHED },
      ],
      relations: ['whitePlayer', 'blackPlayer'],
      order: { finishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { matches, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getStats(userId: string) {
    const matches = await this.matches.find({
      where: [
        { whitePlayerId: userId, status: MatchStatus.FINISHED },
        { blackPlayerId: userId, status: MatchStatus.FINISHED },
      ],
      select: ['result', 'whitePlayerId'],
    });

    let wins = 0, losses = 0, draws = 0;
    for (const m of matches) {
      const isWhite = m.whitePlayerId === userId;
      if (m.result === 'DRAW') draws++;
      else if ((isWhite && m.result === 'WHITE_WINS') || (!isWhite && m.result === 'BLACK_WINS')) wins++;
      else losses++;
    }
    return { wins, losses, draws, total: matches.length };
  }
}
