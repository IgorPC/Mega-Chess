import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportMatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AppealReportDto {
  @IsString()
  @MaxLength(2000)
  note: string;
}
