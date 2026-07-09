import { IsNumber, IsOptional, IsString, IsDateString, Length, Min, Max } from 'class-validator';

export class CreateDepositDto {
  @IsNumber()
  @Min(5)
  @Max(10000)
  valueBrl: number;

  @IsOptional()
  @IsString()
  @Length(11, 14)
  cpf?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;
}
