import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchesService } from '../matches/matches.service';
import { GameGateway } from '../game/game.gateway';
import { User } from '../entities/user.entity';

interface QueueEntry { userId: string; rating: number; joinedAt: Date; }

@Injectable()
export class MatchmakingService {
  private queue: QueueEntry[] = [];

  constructor(
    private matches: MatchesService,
    private game: GameGateway,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async joinQueue(userId: string) {
    if (this.queue.find(e => e.userId === userId)) return { status: 'already_queued' };
    const user = await this.users.findOne({ where: { id: userId } });
    const opponent = this.findOpponent(user.rating);

    if (opponent) {
      this.queue = this.queue.filter(e => e.userId !== opponent.userId);
      const white = Math.random() > 0.5 ? userId : opponent.userId;
      const black = white === userId ? opponent.userId : userId;
      const match = await this.matches.createMatch(white, black);
      this.game.emitToUser(userId, 'match_found', { matchId: match.id, color: white === userId ? 'white' : 'black', match });
      this.game.emitToUser(opponent.userId, 'match_found', { matchId: match.id, color: white === opponent.userId ? 'white' : 'black', match });
      return { status: 'matched', matchId: match.id };
    }

    this.queue.push({ userId, rating: user.rating, joinedAt: new Date() });
    return { status: 'queued' };
  }

  leaveQueue(userId: string) {
    this.queue = this.queue.filter(e => e.userId !== userId);
    return { status: 'left' };
  }

  async sendChallenge(challengerId: string, challengedId: string) {
    const challenger = await this.users.findOne({ where: { id: challengerId } });
    this.game.emitToUser(challengedId, 'challenge_received', {
      challengerId, challengerRating: challenger.rating, expiresIn: 30,
    });
    return { status: 'sent' };
  }

  async acceptChallenge(acceptorId: string, challengerId: string) {
    const white = Math.random() > 0.5 ? acceptorId : challengerId;
    const black = white === acceptorId ? challengerId : acceptorId;
    const match = await this.matches.createMatch(white, black);
    this.game.emitToUser(acceptorId, 'match_found', { matchId: match.id, color: white === acceptorId ? 'white' : 'black', match });
    this.game.emitToUser(challengerId, 'match_found', { matchId: match.id, color: white === challengerId ? 'white' : 'black', match });
    return { status: 'matched', matchId: match.id };
  }

  private findOpponent(rating: number, maxDiff = 200): QueueEntry | null {
    return [...this.queue]
      .sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating))
      .find(e => Math.abs(e.rating - rating) <= maxDiff) ?? null;
  }
}
