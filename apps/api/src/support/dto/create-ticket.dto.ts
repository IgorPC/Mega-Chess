import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { TicketCategory } from '../../entities/support-ticket.entity';

export class CreateTicketDto {
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;
}
