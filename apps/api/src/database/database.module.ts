import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Match } from '../entities/match.entity';
import { Friendship } from '../entities/friendship.entity';
import { Message } from '../entities/message.entity';
import { MatchChatMessage } from '../entities/match-chat-message.entity';
import { Notification } from '../entities/notification.entity';
import { Review } from '../entities/review.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, RefreshToken, Match, Friendship, Message, MatchChatMessage, Notification, Review],
      synchronize: true,
      logging: false,
    }),
  ],
})
export class DatabaseModule {}
