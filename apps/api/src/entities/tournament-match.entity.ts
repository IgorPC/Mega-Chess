import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToOne, JoinColumn, Index, Unique,
} from 'typeorm';
import { Tournament } from './tournament.entity';
import { Match } from './match.entity';

export enum TournamentPhase {
  DUEL         = 'DUEL',
  ROUND_1      = 'ROUND_1',
  ROUND_2      = 'ROUND_2',
  ROUND_3      = 'ROUND_3',
  ROUND_4      = 'ROUND_4',
  ROUND_5      = 'ROUND_5',
  QUARTERFINAL = 'QUARTERFINAL',
  SEMIFINAL    = 'SEMIFINAL',
  THIRD_PLACE  = 'THIRD_PLACE',
  FINAL        = 'FINAL',
  // Legacy
  GROUP_A  = 'GROUP_A',
  GROUP_B  = 'GROUP_B',
  GROUP_C  = 'GROUP_C',
  SWISS_R1 = 'SWISS_R1',
  SWISS_R2 = 'SWISS_R2',
  SWISS_R3 = 'SWISS_R3',
  SWISS_R4 = 'SWISS_R4',
  SWISS_R5 = 'SWISS_R5',
  ROUND_32 = 'ROUND_32',
  ROUND_16 = 'ROUND_16',
}

export type TiebreakResult = 'MATERIAL_WIN' | 'CLOCK_WIN' | 'DOUBLE_ELIMINATION';

export interface MoveTimestamp {
  san: string;
  from: string;
  to: string;
  piece: string | null;       // p=pawn, n=knight, b=bishop, r=rook, q=queen, k=king
  captured: string | null;    // piece letter if capture, null otherwise
  fen: string;
  elapsed_ms: number;
  clock_ms: number;
  player: 'white' | 'black';
}

@Entity('tournament_matches')
@Index(['tournamentId'])
@Unique(['matchId'])
@Index(['tournamentId', 'phase'])
export class TournamentMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @Column({ name: 'match_id' })
  matchId: string;

  @ManyToOne(() => Tournament, (t) => t.tournamentMatches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @OneToOne(() => Match)
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @Column({ type: 'enum', enum: TournamentPhase })
  phase: TournamentPhase;

  /** Número da rodada (1-based) para fácil consulta */
  @Column({ name: 'round_number', type: 'int', default: 1 })
  roundNumber: number;

  /** ID do slot no bracket (ex: "R1M0") para correlação com bracketData */
  @Column({ name: 'bracket_id', type: 'varchar', length: 20, nullable: true })
  bracketId: string | null;

  @Column({ name: 'move_timestamps', type: 'jsonb', default: '[]' })
  moveTimestamps: MoveTimestamp[];

  /** Resultado da análise anti-cheat por IA — persistido para evitar re-análise */
  @Column({ name: 'ai_analysis', type: 'jsonb', nullable: true })
  aiAnalysis: Record<string, unknown> | null;

  @Column({ name: 'clock_white_ms', nullable: true, type: 'int' })
  clockWhiteMs: number | null;

  @Column({ name: 'clock_black_ms', nullable: true, type: 'int' })
  clockBlackMs: number | null;

  @Column({ name: 'time_control', type: 'varchar', length: 10 })
  timeControl: string;

  /** null = sem desempate especial; preenchido quando há empate na posição final de peças */
  @Column({ name: 'tiebreak_result', type: 'varchar', length: 25, nullable: true })
  tiebreakResult: TiebreakResult | null;

  /** CC de prêmio creditado ao jogador branco nesta partida */
  @Column({ name: 'white_prize', type: 'int', default: 0 })
  whitePrize: number;

  /** CC de prêmio creditado ao jogador preto nesta partida */
  @Column({ name: 'black_prize', type: 'int', default: 0 })
  blackPrize: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
