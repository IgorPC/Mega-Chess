import {
  Controller, Get, Patch, Param, ParseUUIDPipe, UseGuards,
  Logger, InternalServerErrorException, HttpException,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private notifications: NotificationsService) {}

  @Get()
  async getUnread(@CurrentUser() user: any) {
    try {
      return await this.notifications.getUnread(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`getUnread failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch(':id/read')
  async markOneRead(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    try {
      return await this.notifications.markOneRead(user.id, id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`markOneRead failed userId=${user.id} notificationId=${id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: any) {
    try {
      return await this.notifications.markAllRead(user.id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error(`markAllRead failed userId=${user.id}`, err instanceof Error ? err.stack : String(err));
      throw new InternalServerErrorException();
    }
  }
}
