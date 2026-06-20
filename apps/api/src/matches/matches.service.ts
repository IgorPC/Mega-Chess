import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, MatchResult, MatchStatus } from '../entities/match.entity';
import { User } from '../entities/user.entity';

const K = 32;
const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));
const newRating = (r: number, s: number, e: number) => Math.round(r + K * (s - e));

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private matches: Repository<Match>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async createMatch(whiteId: string, blackId: string) {
    const [white, black] = await Promise.all([
      this.users.findOne({ where: { id: whiteId } }),
      this.users.findOne({ where: { id: blackId } }),
    ]);
    const match = this.matches.create({
      whitePlayerId: whiteId,
      blackPlayerId: blackId,
      status: MatchStatus.ONGOING,
      whiteRatingBefore: white.rating,
      blackRatingBefore: black.rating,
      startedAt: new Date(),
    });
    await this.matches.save(match);
    return this.matches.findOne({
      where: { id: match.id },
      relations: ['whitePlayer', 'blackPlayer'],
    });
  }

  async getMatch(matchId: string) {
    return this.matches.findOne({
      where: { id: matchId },
      relations: ['whitePlayer', 'blackPlayer'],
    });
  }

  async updateFen(matchId: string, fen: string, pgn: string, moves: any[]) {
    const currentTurn = fen.includes(' w ') ? 'white' : 'black';
    await this.matches.update(matchId, { fen, pgn, moves, currentTurn });
  }

  async finishMatch(matchId: string, result: MatchResult) {
    const match = await this.matches.findOne({
      where: { id: matchId },
      relations: ['whitePlayer', 'blackPlayer'],
    });

    const wr = match.whitePlayer.rating;
    const br = match.blackPlayer.rating;
    const eW = expected(wr, br);
    const eB = expected(br, wr);

    let sW = 0.5, sB = 0.5;
    if (['WHITE_WINS', 'FORFEIT_BLACK', 'TIMEOUT_BLACK'].includes(result)) { sW = 1; sB = 0; }
    else if (['BLACK_WINS', 'FORFEIT_WHITE', 'TIMEOUT_WHITE'].includes(result)) { sW = 0; sB = 1; }

    const newWr = newRating(wr, sW, eW);
    const newBr = newRating(br, sB, eB);

    await Promise.all([
      this.users.update(match.whitePlayerId, { rating: newWr }),
      this.users.update(match.blackPlayerId, { rating: newBr }),
      this.matches.update(matchId, {
        status: MatchStatus.FINISHED,
        result,
        whiteRatingAfter: newWr,
        blackRatingAfter: newBr,
        finishedAt: new Date(),
      }),
    ]);
  }
}
