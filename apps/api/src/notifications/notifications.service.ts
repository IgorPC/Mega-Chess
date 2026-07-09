import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';
import { NotificationEventsService } from './notification-events.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifications: Repository<Notification>,
    private events: NotificationEventsService,
  ) {}

  async create(userId: string, type: NotificationType, payload: object) {
    const n = this.notifications.create({ userId, type, payload });
    const saved = await this.notifications.save(n);
    this.events.emitCreated(userId, saved);
    return saved;
  }

  async getUnread(userId: string) {
    return this.notifications.find({
      where: { userId, readAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async markDuelInviteRead(userId: string, tournamentId: string) {
    await this.notifications.createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where("user_id = :userId AND type = :type AND payload->>'tournamentId' = :tournamentId AND read_at IS NULL", {
        userId,
        type: NotificationType.DUEL_INVITE,
        tournamentId,
      })
      .execute();
  }

  async markDuelInviteReadByTournament(tournamentId: string) {
    await this.notifications.createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where("type = :type AND payload->>'tournamentId' = :tournamentId AND read_at IS NULL", {
        type: NotificationType.DUEL_INVITE,
        tournamentId,
      })
      .execute();
  }

  async markOneRead(userId: string, notificationId: string) {
    await this.notifications.createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('id = :notificationId AND user_id = :userId AND read_at IS NULL', { notificationId, userId })
      .execute();
    return { status: 'ok' };
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
