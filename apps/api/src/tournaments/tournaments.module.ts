import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { TournamentGateway } from './tournament.gateway';
import { TournamentsRepository } from './tournaments.repository';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentMatch } from '../entities/tournament-match.entity';
import { Match } from '../entities/match.entity';
import { User } from '../entities/user.entity';
import { WalletModule } from '../wallet/wallet.module';
import { MatchesModule } from '../matches/matches.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeepseekModule } from '../deepseek/deepseek.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tournament, TournamentParticipant, TournamentMatch, Match, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => WalletModule),
    MatchesModule,
    NotificationsModule,
    DeepseekModule,
    forwardRef(() => GameModule),
  ],
  controllers: [TournamentsController],
  providers: [TournamentsService, TournamentGateway, TournamentsRepository],
  exports: [TournamentsService],
})
export class TournamentsModule {}
