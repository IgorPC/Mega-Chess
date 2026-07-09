import {
  IsEnum, IsIn, IsUUID, IsString, IsInt, IsBoolean,
  IsOptional, Min, Max, MaxLength, MinLength, ValidateIf,
} from 'class-validator';
import {
  TournamentType, DUEL_ENTRY_OPTIONS, DuelEntryFee,
  ALLOWED_PLAYER_COUNTS, AllowedPlayerCount, TimeControl,
} from '../../entities/tournament.entity';

// ─── Duelo 1v1 ───────────────────────────────────────────────────────────────

export class CreateDuelDto {
  @IsEnum([TournamentType.DUEL_FLASH, TournamentType.DUEL_GIANT])
  type: TournamentType.DUEL_FLASH | TournamentType.DUEL_GIANT;

  @IsIn(DUEL_ENTRY_OPTIONS)
  entryFee: DuelEntryFee;
}

export class InviteDuelDto extends CreateDuelDto {
  @IsUUID()
  friendId: string;
}

// ─── Torneio criado por jogador ───────────────────────────────────────────────

export class CreateCustomTournamentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  name: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  entryFee: number;

  @IsIn(ALLOWED_PLAYER_COUNTS)
  maxPlayers: AllowedPlayerCount;

  @IsEnum(TimeControl)
  timeControl: TimeControl;

  @IsBoolean()
  isPrivate: boolean;

  @ValidateIf((o) => o.isPrivate === true)
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  password?: string;

  @IsOptional()
  @IsBoolean()
  isFlexible?: boolean;
}

export class JoinTournamentDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  password?: string;
}

export class InviteByNicknameDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  nickname: string;
}

export class KickParticipantDto {
  @IsUUID()
  userId: string;
}
