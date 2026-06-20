import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  getConversations(@CurrentUser() user: any) {
    return this.messages.getConversations(user.id);
  }

  @Get(':userId')
  getConversation(@CurrentUser() user: any, @Param('userId') otherId: string) {
    return this.messages.getConversation(user.id, otherId);
  }

  @Post(':userId')
  send(@CurrentUser() user: any, @Param('userId') receiverId: string, @Body('content') content: string) {
    return this.messages.send(user.id, receiverId, content);
  }
}
