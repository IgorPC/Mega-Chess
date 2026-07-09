import { IsEnum, IsIn, IsString, IsArray, IsOptional } from 'class-validator';
import { MatchResult } from '../../entities/match.entity';

export class CreateOfflineMatchDto {
  @IsEnum(MatchResult)
  result: MatchResult;

  @IsString()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty: string;

  @IsString()
  @IsOptional()
  pgn?: string;

  @IsArray()
  @IsOptional()
  moves?: any[];
}
