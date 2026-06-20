import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(@InjectRepository(Message) private messages: Repository<Message>) {}

  async send(senderId: string, receiverId: string, content: string) {
    const msg = this.messages.create({ senderId, receiverId, content });
    await this.messages.save(msg);
    return this.messages.findOne({ where: { id: msg.id }, relations: ['sender'] });
  }

  async getConversation(userId: string, otherId: string) {
    await this.messages.createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('sender_id = :otherId AND receiver_id = :userId AND read_at IS NULL', { otherId, userId })
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
    const messages = await this.messages.find({
      where: [{ senderId: userId }, { receiverId: userId }],
      order: { createdAt: 'DESC' },
      relations: ['sender', 'receiver'],
    });

    const seen = new Set<string>();
    const conversations: any[] = [];
    for (const m of messages) {
      const otherId = m.senderId === userId ? m.receiverId : m.senderId;
      if (!seen.has(otherId)) {
        seen.add(otherId);
        conversations.push({
          user: m.senderId === userId ? m.receiver : m.sender,
          lastMessage: m,
        });
      }
    }
    return conversations;
  }
}
