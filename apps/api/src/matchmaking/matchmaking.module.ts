import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { MatchesModule } from '../matches/matches.module';
import { GameModule } from '../game/game.module';
import { User } from '../entities/user.entity';

@Module({
  imports: [MatchesModule, GameModule, TypeOrmModule.forFeature([User])],
  providers: [MatchmakingService],
  controllers: [MatchmakingController],
})
export class MatchmakingModule {}
