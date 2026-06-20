import { Controller, Get, Post, Delete, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friends: FriendsService) {}

  @Get()
  getFriends(@CurrentUser() user: any) {
    return this.friends.getFriends(user.id);
  }

  @Get('requests')
  getPending(@CurrentUser() user: any) {
    return this.friends.getPendingRequests(user.id);
  }

  @Post('request')
  sendRequest(@CurrentUser() user: any, @Body('nickname') nickname: string) {
    return this.friends.sendRequest(user.id, nickname);
  }

  @Patch('request/:id/accept')
  accept(@CurrentUser() user: any, @Param('id') id: string) {
    return this.friends.respondRequest(user.id, id, true);
  }

  @Patch('request/:id/decline')
  decline(@CurrentUser() user: any, @Param('id') id: string) {
    return this.friends.respondRequest(user.id, id, false);
  }

  @Delete(':friendId')
  remove(@CurrentUser() user: any, @Param('friendId') friendId: string) {
    return this.friends.removeFriend(user.id, friendId);
  }
}
