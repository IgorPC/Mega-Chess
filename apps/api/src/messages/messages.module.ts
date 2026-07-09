import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { Message } from '../entities/message.entity';
import { GameModule } from '../game/game.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), GameModule, NotificationsModule],
  providers: [MessagesService],
  controllers: [MessagesController],
})
export class MessagesModule {}
