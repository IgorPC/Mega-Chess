import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tournament, TournamentStatus, TournamentType } from '../../entities/tournament.entity';
import { TournamentParticipant } from '../../entities/tournament-participant.entity';
import { TournamentMatch } from '../../entities/tournament-match.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';

@Injectable()
export class AdminTournamentsRepository {
  constructor(
    @InjectRepository(Tournament)            private readonly tournaments:    Repository<Tournament>,
    @InjectRepository(TournamentParticipant) private readonly participantRepo: Repository<TournamentParticipant>,
    @InjectRepository(TournamentMatch)       private readonly matchRepo:      Repository<TournamentMatch>,
    @InjectRepository(Wallet)                private readonly wallets:        Repository<Wallet>,
    @InjectRepository(WalletTransaction)     private readonly txRepo:         Repository<WalletTransaction>,
  ) {}

  createListQuery() {
    return this.tournaments.createQueryBuilder('t');
  }

  queryParticipantCounts(ids: string[]) {
    return this.tournaments.manager.query<{ tournament_id: string; cnt: string }[]>(
      `SELECT tournament_id, COUNT(*) as cnt FROM tournament_participants WHERE tournament_id = ANY($1::uuid[]) GROUP BY tournament_id`,
      [ids],
    );
  }

  findTournamentById(id: string) {
    return this.tournaments.findOne({ where: { id } });
  }

  findTournamentWithParticipants(id: string) {
    return this.tournaments.findOne({ where: { id }, relations: ['participants'] });
  }

  countParticipants(tournamentId: string) {
    return this.participantRepo.count({ where: { tournamentId } });
  }

  createParticipantsQuery() {
    return this.participantRepo.createQueryBuilder('p');
  }

  createMatchesQuery() {
    return this.matchRepo.createQueryBuilder('tm');
  }

  findParticipant(tournamentId: string, userId: string) {
    return this.participantRepo.findOne({ where: { tournamentId, userId } });
  }

  deleteParticipant(tournamentId: string, userId: string) {
    return this.participantRepo.delete({ tournamentId, userId });
  }

  findTournamentMatchWithMatch(id: string) {
    return this.matchRepo.findOne({
      where: { id },
      relations: ['match', 'match.whitePlayer', 'match.blackPlayer'],
    });
  }

  updateTournamentMatch(id: string, data: Partial<TournamentMatch>) {
    return this.matchRepo.update(id, data);
  }

  updateTournament(id: string, data: Partial<Tournament>) {
    return this.tournaments.update(id, data);
  }

  findWalletByUserId(userId: string) {
    return this.wallets.findOne({ where: { userId } });
  }

  updateWalletBalance(userId: string, balance: string) {
    return this.wallets.update({ userId }, { balance });
  }

  createTransaction(data: Partial<WalletTransaction>) {
    return this.txRepo.create(data);
  }

  saveTransaction(tx: WalletTransaction) {
    return this.txRepo.save(tx);
  }

  findDuels(statuses: TournamentStatus[], page: number, limit: number) {
    return this.tournaments.findAndCount({
      where: {
        type: In([TournamentType.DUEL_FLASH, TournamentType.DUEL_GIANT]),
        status: In(statuses),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  queryChampionNicknames(championIds: string[]) {
    return this.tournaments.manager.query<{ id: string; nickname: string }[]>(
      `SELECT id, nickname FROM users WHERE id = ANY($1::uuid[])`,
      [championIds],
    );
  }
}
