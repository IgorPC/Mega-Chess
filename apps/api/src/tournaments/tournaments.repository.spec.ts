import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TournamentsRepository } from './tournaments.repository';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';

describe('TournamentsRepository', () => {
  let repository: TournamentsRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TournamentsRepository,
        { provide: getRepositoryToken(Tournament), useValue: { marker: 'tournaments' } },
        { provide: getRepositoryToken(TournamentParticipant), useValue: { marker: 'participants' } },
        { provide: getRepositoryToken(TournamentMatch), useValue: { marker: 'tournamentMatches' } },
        { provide: getRepositoryToken(Match), useValue: { marker: 'matches' } },
        { provide: getRepositoryToken(User), useValue: { marker: 'users' } },
        { provide: DataSource, useValue: { marker: 'dataSource' } },
      ],
    }).compile();

    repository = module.get(TournamentsRepository);
  });

  it('exposes the tournaments repository', () => {
    expect((repository.tournaments as any).marker).toBe('tournaments');
  });

  it('exposes the participants repository', () => {
    expect((repository.participants as any).marker).toBe('participants');
  });

  it('exposes the tournamentMatches repository', () => {
    expect((repository.tournamentMatches as any).marker).toBe('tournamentMatches');
  });

  it('exposes the matches repository', () => {
    expect((repository.matches as any).marker).toBe('matches');
  });

  it('exposes the users repository', () => {
    expect((repository.users as any).marker).toBe('users');
  });

  it('exposes the dataSource', () => {
    expect((repository.dataSource as any).marker).toBe('dataSource');
  });
});
