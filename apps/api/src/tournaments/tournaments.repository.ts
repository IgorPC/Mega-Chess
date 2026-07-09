import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';

/**
 * Encapsulates direct TypeORM repository access for the tournaments module.
 * Exposes the underlying repositories/DataSource so TournamentsService can
 * keep its existing query logic unchanged while no longer injecting
 * @InjectRepository directly.
 */
@Injectable()
export class TournamentsRepository {
  constructor(
    @InjectRepository(Tournament) readonly tournaments: Repository<Tournament>,
    @InjectRepository(TournamentParticipant) readonly participants: Repository<TournamentParticipant>,
    @InjectRepository(TournamentMatch) readonly tournamentMatches: Repository<TournamentMatch>,
    @InjectRepository(Match) readonly matches: Repository<Match>,
    @InjectRepository(User) readonly users: Repository<User>,
    readonly dataSource: DataSource,
  ) {}
}
