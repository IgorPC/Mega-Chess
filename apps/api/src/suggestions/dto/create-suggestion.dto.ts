import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateSuggestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(30)
  @MaxLength(1000)
  description: string;
}
