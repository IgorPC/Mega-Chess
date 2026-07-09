import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  OneToMany, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { TournamentParticipant } from './tournament-participant.entity';
import { TournamentMatch } from './tournament-match.entity';
import { User } from './user.entity';

export enum TournamentType {
  DUEL_FLASH   = 'DUEL_FLASH',    // 1v1 Relâmpago — Blitz 3+2
  DUEL_GIANT   = 'DUEL_GIANT',    // 1v1 Gigantes  — Rápido 10+0
  USER_CREATED = 'USER_CREATED',  // Criado por jogador — configuração livre
  // Legacy (mantidos para compatibilidade de dados históricos, não usados em nova lógica)
  FAISCA     = 'FAISCA',
  TEMPESTADE = 'TEMPESTADE',
  GRANDE     = 'GRANDE',
}

export enum TournamentStatus {
  REGISTERING  = 'REGISTERING',
  IN_PROGRESS  = 'IN_PROGRESS',
  FINISHED     = 'FINISHED',
  CANCELLED    = 'CANCELLED',
}

export enum TimeControl {
  BLITZ_3_2   = '3+2',
  BLITZ_5_0   = '5+0',
  BLITZ_5_3   = '5+3',
  RAPID_10_0  = '10+0',
  RAPID_15_10 = '15+10',
}

/** Válidas para duelos 1v1 — garante rake mínimo de 1 CC */
export const DUEL_ENTRY_OPTIONS = [6, 10, 20] as const;
export type DuelEntryFee = typeof DUEL_ENTRY_OPTIONS[number];

/** Config estática apenas para duelos 1v1 */
export const DUEL_CONFIG: Record<
  TournamentType.DUEL_FLASH | TournamentType.DUEL_GIANT,
  { timeControl: TimeControl; initialSeconds: number; incrementSeconds: number }
> = {
  [TournamentType.DUEL_FLASH]: {
    timeControl: TimeControl.BLITZ_3_2, initialSeconds: 180, incrementSeconds: 2,
  },
  [TournamentType.DUEL_GIANT]: {
    timeControl: TimeControl.RAPID_10_0, initialSeconds: 600, incrementSeconds: 0,
  },
};

export const RAKE_RATE = 0.10;

/** Potências de 2 permitidas para torneios criados por jogadores */
export const ALLOWED_PLAYER_COUNTS = [4, 8] as const;
export type AllowedPlayerCount = typeof ALLOWED_PLAYER_COUNTS[number];

/** Estrutura de uma partida no chaveamento (JSONB) */
export interface BracketMatch {
  bracketId: string;          // ex: "R1M0", "SF0", "FINAL"
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  loserId: string | null;
  matchId: string | null;     // ref para Match entity
  tiebreakResult: 'MATERIAL_WIN' | 'CLOCK_WIN' | 'DOUBLE_ELIMINATION' | null;
}

export interface BracketRound {
  roundNumber: number;
  phase: string;
  matches: BracketMatch[];
}

export interface TournamentBracket {
  totalRounds: number;
  rounds: BracketRound[];
  thirdPlaceMatch: BracketMatch | null;
}

/** Calcula taxa de criação do torneio com base no custo de entrada */
export function calcCreationFee(entryFee: number): number {
  if (entryFee <= 4)  return 2;
  if (entryFee <= 9)  return 3;
  if (entryFee <= 19) return 5;
  return 10;
}

/**
 * Distribui prêmios arredondando para inteiro (sem centavos).
 * Com 4 jogadores não há disputa de 3º lugar — split 60/40 entre 1º e 2º.
 */
export function calcPrizes(totalPlayers: number, entryFee: number) {
  const total     = totalPlayers * entryFee;
  const prizePool = Math.floor(total * (1 - RAKE_RATE));
  const rake      = total - prizePool;

  if (totalPlayers <= 4) {
    // Sem 3º lugar — 60% para o campeão, 40% para o vice
    const first     = Math.floor(prizePool * 0.60);
    const second    = prizePool - first;  // resto exato, sem rakeExtra
    return { total, prizePool, rake, first, second, third: 0, hasThird: false };
  }

  const first     = Math.floor(prizePool * 0.50);
  const second    = Math.floor(prizePool * 0.35);
  const third     = Math.floor(prizePool * 0.15);
  const rakeExtra = prizePool - (first + second + third);
  return { total, prizePool, rake: rake + rakeExtra, first, second, third, hasThird: true };
}

@Entity('tournaments')
@Index(['type', 'status'])
@Index(['status', 'isPrivate', 'createdAt'])
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: TournamentType })
  type: TournamentType;

  @Column({ type: 'enum', enum: TournamentStatus, default: TournamentStatus.REGISTERING })
  status: TournamentStatus;

  /** Nome amigável — obrigatório para USER_CREATED */
  @Column({ type: 'varchar', length: 60, nullable: true })
  name: string | null;

  /** Criador do torneio (apenas USER_CREATED) */
  @Column({ name: 'creator_id', nullable: true, type: 'uuid' })
  creatorId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: User | null;

  /** $CC por participante */
  @Column({ name: 'entry_fee_cc', type: 'int', default: 0 })
  entryFeeCc: number;

  /** Taxa de criação paga pelo criador (não-reembolsável) */
  @Column({ name: 'creation_fee_cc', type: 'int', default: 0 })
  creationFeeCc: number;

  @Column({ name: 'time_control', type: 'varchar', length: 10 })
  timeControl: string;

  @Column({ name: 'max_players' })
  maxPlayers: number;

  /** Torneio privado — exige senha ou convite */
  @Column({ name: 'is_private', default: false })
  isPrivate: boolean;

  /** Senha em bcrypt hash (apenas para torneios privados) */
  @Column({ name: 'password_hash', nullable: true, type: 'varchar', length: 100 })
  passwordHash: string | null;

  /**
   * Modo flexível: inicia com ≥ 50% das vagas.
   * Bracket ajustado à maior potência de 2 ≤ participantes confirmados.
   */
  @Column({ name: 'is_flexible', default: false })
  isFlexible: boolean;

  /** Pote de prêmios final (90% do total — inteiro) */
  @Column({ name: 'prize_pool_cc', type: 'int', default: 0 })
  prizePoolCc: number;

  @Column({ name: 'rake_cc', type: 'int', default: 0 })
  rakeCc: number;

  /** Chaveamento completo em JSONB — atualizado em tempo real */
  @Column({ name: 'bracket_data', type: 'jsonb', nullable: true })
  bracketData: TournamentBracket | null;

  @Column({ name: 'champion_id', nullable: true, type: 'uuid' })
  championId: string | null;

  @Column({ name: 'second_place_id', nullable: true, type: 'uuid' })
  secondPlaceId: string | null;

  @Column({ name: 'third_place_id', nullable: true, type: 'uuid' })
  thirdPlaceId: string | null;

  /** Status da análise IA antifraude pós-torneio */
  @Column({ name: 'ai_fraud_status', type: 'varchar', length: 20, nullable: true })
  aiFraudStatus: 'PENDING' | 'APPROVED' | 'FLAGGED' | 'TIMEOUT' | null;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => TournamentParticipant, (p) => p.tournament, { cascade: true })
  participants: TournamentParticipant[];

  @OneToMany(() => TournamentMatch, (m) => m.tournament, { cascade: true })
  tournamentMatches: TournamentMatch[];
}
