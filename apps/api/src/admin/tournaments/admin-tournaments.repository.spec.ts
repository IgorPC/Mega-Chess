import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminTournamentsRepository } from './admin-tournaments.repository';
import { Tournament, TournamentStatus } from '../../entities/tournament.entity';
import { TournamentParticipant } from '../../entities/tournament-participant.entity';
import { TournamentMatch } from '../../entities/tournament-match.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';

describe('AdminTournamentsRepository', () => {
  let repository: AdminTournamentsRepository;
  let tournaments: jest.Mocked<Repository<Tournament>>;
  let participantRepo: jest.Mocked<Repository<TournamentParticipant>>;
  let matchRepo: jest.Mocked<Repository<TournamentMatch>>;
  let wallets: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminTournamentsRepository,
        { provide: getRepositoryToken(Tournament), useValue: {
          createQueryBuilder: jest.fn(), manager: { query: jest.fn() },
          findOne: jest.fn(), update: jest.fn(), findAndCount: jest.fn(),
        }},
        { provide: getRepositoryToken(TournamentParticipant), useValue: {
          count: jest.fn(), createQueryBuilder: jest.fn(), findOne: jest.fn(), delete: jest.fn(),
        }},
        { provide: getRepositoryToken(TournamentMatch), useValue: {
          createQueryBuilder: jest.fn(), findOne: jest.fn(), update: jest.fn(),
        }},
        { provide: getRepositoryToken(Wallet), useValue: { findOne: jest.fn(), update: jest.fn() } },
        { provide: getRepositoryToken(WalletTransaction), useValue: { create: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    repository = module.get(AdminTournamentsRepository);
    tournaments = module.get(getRepositoryToken(Tournament));
    participantRepo = module.get(getRepositoryToken(TournamentParticipant));
    matchRepo = module.get(getRepositoryToken(TournamentMatch));
    wallets = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(WalletTransaction));
  });

  it('createListQuery builds a query builder on tournaments', () => {
    const qb = {} as any;
    (tournaments.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createListQuery()).toBe(qb);
    expect(tournaments.createQueryBuilder).toHaveBeenCalledWith('t');
  });

  it('queryParticipantCounts groups counts by tournament', async () => {
    (tournaments.manager.query as jest.Mock).mockResolvedValue([{ tournament_id: 't1', cnt: '2' }]);
    const result = await repository.queryParticipantCounts(['t1']);
    expect(tournaments.manager.query).toHaveBeenCalledWith(expect.stringContaining('GROUP BY tournament_id'), [['t1']]);
    expect(result).toEqual([{ tournament_id: 't1', cnt: '2' }]);
  });

  it('findTournamentById delegates to findOne', async () => {
    (tournaments.findOne as jest.Mock).mockResolvedValue({ id: 't1' });
    const result = await repository.findTournamentById('t1');
    expect(tournaments.findOne).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(result).toEqual({ id: 't1' });
  });

  it('findTournamentWithParticipants includes participants relation', async () => {
    (tournaments.findOne as jest.Mock).mockResolvedValue({ id: 't1', participants: [] });
    await repository.findTournamentWithParticipants('t1');
    expect(tournaments.findOne).toHaveBeenCalledWith({ where: { id: 't1' }, relations: ['participants'] });
  });

  it('countParticipants delegates to participantRepo.count', async () => {
    (participantRepo.count as jest.Mock).mockResolvedValue(5);
    const result = await repository.countParticipants('t1');
    expect(participantRepo.count).toHaveBeenCalledWith({ where: { tournamentId: 't1' } });
    expect(result).toBe(5);
  });

  it('createParticipantsQuery builds query builder on participantRepo', () => {
    const qb = {} as any;
    (participantRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createParticipantsQuery()).toBe(qb);
  });

  it('createMatchesQuery builds query builder on matchRepo', () => {
    const qb = {} as any;
    (matchRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    expect(repository.createMatchesQuery()).toBe(qb);
  });

  it('findParticipant delegates to findOne with composite key', async () => {
    (participantRepo.findOne as jest.Mock).mockResolvedValue(null);
    const result = await repository.findParticipant('t1', 'u1');
    expect(participantRepo.findOne).toHaveBeenCalledWith({ where: { tournamentId: 't1', userId: 'u1' } });
    expect(result).toBeNull();
  });

  it('deleteParticipant delegates to delete', async () => {
    (participantRepo.delete as jest.Mock).mockResolvedValue({ affected: 1 });
    await repository.deleteParticipant('t1', 'u1');
    expect(participantRepo.delete).toHaveBeenCalledWith({ tournamentId: 't1', userId: 'u1' });
  });

  it('findTournamentMatchWithMatch loads player relations', async () => {
    (matchRepo.findOne as jest.Mock).mockResolvedValue({ id: 'tm1' });
    await repository.findTournamentMatchWithMatch('tm1');
    expect(matchRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'tm1' },
      relations: ['match', 'match.whitePlayer', 'match.blackPlayer'],
    });
  });

  it('updateTournamentMatch delegates to update', async () => {
    await repository.updateTournamentMatch('tm1', { clockWhiteMs: 1000 } as any);
    expect(matchRepo.update).toHaveBeenCalledWith('tm1', { clockWhiteMs: 1000 });
  });

  it('updateTournament delegates to update', async () => {
    await repository.updateTournament('t1', { status: TournamentStatus.CANCELLED });
    expect(tournaments.update).toHaveBeenCalledWith('t1', { status: TournamentStatus.CANCELLED });
  });

  it('findWalletByUserId delegates to findOne', async () => {
    (wallets.findOne as jest.Mock).mockResolvedValue({ userId: 'u1' });
    await repository.findWalletByUserId('u1');
    expect(wallets.findOne).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });

  it('updateWalletBalance delegates to update', async () => {
    await repository.updateWalletBalance('u1', '10.00');
    expect(wallets.update).toHaveBeenCalledWith({ userId: 'u1' }, { balance: '10.00' });
  });

  it('createTransaction delegates to create', () => {
    (txRepo.create as jest.Mock).mockReturnValue({ id: 'tx1' });
    const result = repository.createTransaction({ userId: 'u1' });
    expect(txRepo.create).toHaveBeenCalledWith({ userId: 'u1' });
    expect(result).toEqual({ id: 'tx1' });
  });

  it('saveTransaction delegates to save', async () => {
    (txRepo.save as jest.Mock).mockResolvedValue({ id: 'tx1' });
    const result = await repository.saveTransaction({ id: 'tx1' } as any);
    expect(txRepo.save).toHaveBeenCalledWith({ id: 'tx1' });
    expect(result).toEqual({ id: 'tx1' });
  });

  it('findDuels queries by type and status with pagination', async () => {
    (tournaments.findAndCount as jest.Mock).mockResolvedValue([[], 0]);
    await repository.findDuels([TournamentStatus.REGISTERING], 2, 10);
    expect(tournaments.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      order: { createdAt: 'DESC' }, skip: 10, take: 10,
    }));
  });

  it('queryChampionNicknames queries users by ids', async () => {
    (tournaments.manager.query as jest.Mock).mockResolvedValue([{ id: 'u1', nickname: 'nick' }]);
    const result = await repository.queryChampionNicknames(['u1']);
    expect(result).toEqual([{ id: 'u1', nickname: 'nick' }]);
  });
});
