import {
  Controller, Get, Post, Body, Param, UseGuards,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(private messages: MessagesService) {}

  @Get()
  async getConversations(@CurrentUser() user: any) {
    try {
      return await this.messages.getConversations(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getConversations failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Get(':userId')
  async getConversation(@CurrentUser() user: any, @Param('userId') otherId: string) {
    try {
      return await this.messages.getConversation(user.id, otherId);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getConversation failed userId=${user.id} otherId=${otherId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Post(':userId')
  async send(@CurrentUser() user: any, @Param('userId') receiverId: string, @Body('content') content: string) {
    try {
      return await this.messages.send(user.id, receiverId, content);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`send message failed userId=${user.id} receiverId=${receiverId}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
