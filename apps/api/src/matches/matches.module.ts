import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match, User])],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
