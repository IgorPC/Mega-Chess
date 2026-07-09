import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Unique, Index,
} from 'typeorm';
import { Tournament } from './tournament.entity';
import { User } from './user.entity';

export enum ParticipantStatus {
  REGISTERED  = 'REGISTERED',
  ACTIVE      = 'ACTIVE',
  ELIMINATED  = 'ELIMINATED',
  CHAMPION    = 'CHAMPION',
  SECOND      = 'SECOND',
  THIRD       = 'THIRD',
  KICKED      = 'KICKED',
  LEFT        = 'LEFT',
}

@Entity('tournament_participants')
@Unique(['tournamentId', 'userId'])
@Index(['userId', 'tournamentId'])
@Index(['tournamentId', 'status'])
export class TournamentParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tournament_id' })
  tournamentId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Tournament, (t) => t.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ParticipantStatus, default: ParticipantStatus.REGISTERED })
  status: ParticipantStatus;

  /** CC pago ao entrar no torneio (debitado no início, não no join) */
  @Column({ name: 'entry_fee_paid', type: 'int', default: 0 })
  entryFeePaid: number;

  /** CC ganho como prêmio (0 se não premiado) */
  @Column({ name: 'prize_won', type: 'int', default: 0 })
  prizeWon: number;

  /** true = débito de entrada já foi efetuado (no início do torneio) */
  @Column({ name: 'has_entry_debited', default: false })
  hasEntryDebited: boolean;

  /** true = jogador foi convidado diretamente pelo criador (dispensa senha) */
  @Column({ name: 'invited_by_creator', default: false })
  invitedByCreator: boolean;

  /** Posição no bracket (índice 0-based no array de participantes após sorteio) */
  @Column({ name: 'bracket_position', nullable: true, type: 'int' })
  bracketPosition: number | null;

  @CreateDateColumn({ name: 'registered_at' })
  registeredAt: Date;
}
