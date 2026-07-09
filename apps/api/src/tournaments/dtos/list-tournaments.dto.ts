import { IsEnum, IsOptional, IsInt, Min, Max, IsBoolean, IsString, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TournamentStatus, TournamentType } from '../../entities/tournament.entity';

export enum TournamentSortField {
  CREATED_AT   = 'createdAt',
  PLAYERS      = 'players',
  ENTRY_FEE    = 'entryFee',
  PRIZE_POOL   = 'prizePool',
}

export enum SortOrder {
  ASC  = 'ASC',
  DESC = 'DESC',
}

export class ListTournamentsDto {
  @IsOptional()
  @IsEnum(TournamentType)
  type?: TournamentType;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  /** undefined = todos | true = apenas públicos | false = apenas privados */
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsEnum(TournamentSortField)
  sortBy?: TournamentSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
