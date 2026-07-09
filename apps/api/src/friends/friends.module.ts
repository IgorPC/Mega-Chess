import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { Friendship } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GameModule } from '../game/game.module';
import { UserActivityModule } from '../user-activity/user-activity.module';

@Module({
  imports: [TypeOrmModule.forFeature([Friendship, User]), NotificationsModule, GameModule, UserActivityModule],
  providers: [FriendsService],
  controllers: [FriendsController],
})
export class FriendsModule {}
