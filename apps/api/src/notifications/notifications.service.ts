import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private notifications: Repository<Notification>) {}

  async create(userId: string, type: NotificationType, payload: object) {
    const n = this.notifications.create({ userId, type, payload });
    return this.notifications.save(n);
  }

  async getUnread(userId: string) {
    return this.notifications.find({
      where: { userId, readAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async markAllRead(userId: string) {
    await this.notifications.createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('user_id = :userId AND read_at IS NULL', { userId })
      .execute();
    return { status: 'ok' };
  }
}
