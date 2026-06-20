import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { MatchesModule } from '../matches/matches.module';
import { AuthModule } from '../auth/auth.module';
import { MatchChatMessage } from '../entities/match-chat-message.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [MatchesModule, AuthModule, TypeOrmModule.forFeature([MatchChatMessage, User])],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class GameModule {}
