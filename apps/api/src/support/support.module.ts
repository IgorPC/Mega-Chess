import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from '../entities/support-ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketAttachment } from '../entities/ticket-attachment.entity';
import { User } from '../entities/user.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { UserActivityModule } from '../user-activity/user-activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket, TicketMessage, TicketAttachment, User]),
    UserActivityModule,
  ],
  providers: [SupportService],
  controllers: [SupportController],
  exports: [SupportService],
})
export class SupportModule {}
