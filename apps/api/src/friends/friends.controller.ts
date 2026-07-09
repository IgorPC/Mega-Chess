import {
  Controller, Get, Post, Delete, Patch, Body, Param, UseGuards,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  private readonly logger = new Logger(FriendsController.name);

  constructor(private friends: FriendsService) {}

  @Get()
  async getFriends(@CurrentUser() user: any) {
    try {
      return await this.friends.getFriends(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getFriends failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get('requests')
  async getPending(@CurrentUser() user: any) {
    try {
      return await this.friends.getPendingRequests(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getPending failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post('request')
  async sendRequest(@CurrentUser() user: any, @Body('nickname') nickname: string) {
    try {
      return await this.friends.sendRequest(user.id, nickname);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`sendRequest failed userId=${user.id} nickname=${nickname}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch('request/:id/accept')
  async accept(@CurrentUser() user: any, @Param('id') id: string) {
    try {
      return await this.friends.respondRequest(user.id, id, true);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`accept request failed userId=${user.id} requestId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch('request/:id/decline')
  async decline(@CurrentUser() user: any, @Param('id') id: string) {
    try {
      return await this.friends.respondRequest(user.id, id, false);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`decline request failed userId=${user.id} requestId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Delete(':friendId')
  async remove(@CurrentUser() user: any, @Param('friendId') friendId: string) {
    try {
      return await this.friends.removeFriend(user.id, friendId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`removeFriend failed userId=${user.id} friendId=${friendId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
