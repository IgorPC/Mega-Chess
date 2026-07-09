import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Notification } from '../entities/notification.entity';

/**
 * In-process pub/sub so NotificationsService can announce new notifications
 * without depending on GameGateway directly (avoids a module import cycle
 * with TournamentsModule <-> GameModule).
 */
@Injectable()
export class NotificationEventsService extends EventEmitter {
  emitCreated(userId: string, notification: Notification) {
    this.emit('created', userId, notification);
  }

  onCreated(listener: (userId: string, notification: Notification) => void) {
    this.on('created', listener);
  }
}
