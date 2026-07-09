import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { GameGateway } from '../game/game.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private messages: Repository<Message>,
    private game: GameGateway,
    private notifications: NotificationsService,
  ) {}

  async send(senderId: string, receiverId: string, content: string) {
    const msg = this.messages.create({ senderId, receiverId, content });
    await this.messages.save(msg);
    const full = await this.messages.findOne({
      where: { id: msg.id },
      relations: ['sender'],
    });

    // Deliver in real-time to the receiver if they are online
    this.game.emitToUser(receiverId, 'new_message', full);

    // Persist notification with enough context to display inline
    await this.notifications.create(receiverId, NotificationType.MESSAGE_RECEIVED, {
      senderId,
      senderNickname: full.sender?.nickname ?? '',
      preview: content.slice(0, 60),
    });

    return full;
  }

  async getConversation(userId: string, otherId: string) {
    await this.messages
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where(
        'sender_id = :otherId AND receiver_id = :userId AND read_at IS NULL',
        { otherId, userId },
      )
      .execute();

    return this.messages.find({
      where: [
        { senderId: userId, receiverId: otherId },
        { senderId: otherId, receiverId: userId },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  async getConversations(userId: string) {
    // Use a subquery to get only the latest message per conversation partner,
    // avoiding loading the entire message history into memory.
    const rows = await this.messages.manager.query<{
      id: string; sender_id: string; receiver_id: string;
      content: string; read_at: string | null; created_at: string;
      other_id: string; other_nickname: string; other_name: string; other_avatar_url: string | null;
    }[]>(
      `SELECT DISTINCT ON (other_id)
         m.id, m.sender_id, m.receiver_id, m.content, m.read_at, m.created_at,
         CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_id,
         u.nickname AS other_nickname, u.name AS other_name, u.avatar_url AS other_avatar_url
       FROM messages m
       JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY other_id, m.created_at DESC`,
      [userId],
    );

    return rows.map(r => ({
      user: { id: r.other_id, nickname: r.other_nickname, name: r.other_name, avatarUrl: r.other_avatar_url },
      lastMessage: {
        id: r.id, senderId: r.sender_id, receiverId: r.receiver_id,
        content: r.content, readAt: r.read_at, createdAt: r.created_at,
      },
    }));
  }
}
