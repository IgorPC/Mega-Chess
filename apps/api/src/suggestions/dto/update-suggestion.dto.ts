import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class UpdateSuggestionDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(30)
  @MaxLength(1000)
  description?: string;
}
