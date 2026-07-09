import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship, FriendshipStatus } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../entities/notification.entity';
import { GameGateway } from '../game/game.gateway';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship) private friendships: Repository<Friendship>,
    @InjectRepository(User) private users: Repository<User>,
    private notifications: NotificationsService,
    private game: GameGateway,
    private activity: UserActivityService,
  ) {}

  async sendRequest(requesterId: string, receiverNickname: string) {
    const receiver = await this.users.findOne({ where: { nickname: receiverNickname } });
    if (!receiver) throw new NotFoundException('User not found');
    if (receiver.id === requesterId) throw new ForbiddenException('Cannot add yourself');

    const existing = await this.friendships
      .createQueryBuilder('f')
      .where('(f.requesterId = :a AND f.receiverId = :b) OR (f.requesterId = :b AND f.receiverId = :a)', { a: requesterId, b: receiver.id })
      .getOne();
    if (existing) throw new ConflictException('Request already exists');

    const requester = await this.users.findOne({ where: { id: requesterId } });
    const f = this.friendships.create({ requesterId, receiverId: receiver.id });
    await this.friendships.save(f);

    const payload = {
      requestId: f.id,
      fromId: requesterId,
      fromNickname: requester.nickname,
      fromAvatarUrl: requester.avatarUrl ?? null,
    };

    await this.notifications.create(receiver.id, NotificationType.FRIEND_REQUEST, payload);
    this.game.emitToUser(receiver.id, 'friend_request_received', payload);
    this.activity.log(requesterId, UserAction.FRIEND_REQUEST_SENT, { toUserId: receiver.id, toNickname: receiver.nickname });

    return f;
  }

  async respondRequest(userId: string, friendshipId: string, accept: boolean) {
    const f = await this.friendships.findOne({
      where: { id: friendshipId },
      relations: ['receiver', 'requester'],
    });
    if (!f || f.receiverId !== userId) throw new ForbiddenException();

    if (!accept) {
      this.activity.log(userId, UserAction.FRIEND_REQUEST_REJECTED, { fromUserId: f.requesterId });
      return this.friendships.remove(f);
    }

    f.status = FriendshipStatus.ACCEPTED;
    await this.friendships.save(f);

    const payload = {
      fromId: userId,
      fromNickname: f.receiver.nickname,
      fromAvatarUrl: f.receiver.avatarUrl ?? null,
    };
    await this.notifications.create(f.requesterId, NotificationType.FRIEND_ACCEPTED, payload);
    this.game.emitToUser(f.requesterId, 'friend_request_accepted', payload);
    this.activity.log(userId, UserAction.FRIEND_REQUEST_ACCEPTED, { fromUserId: f.requesterId });

    return f;
  }

  async removeFriend(userId: string, friendId: string) {
    await this.friendships
      .createQueryBuilder()
      .delete()
      .where(
        '((requester_id = :a AND receiver_id = :b) OR (requester_id = :b AND receiver_id = :a)) AND status = :s',
        { a: userId, b: friendId, s: FriendshipStatus.ACCEPTED },
      )
      .execute();
    this.activity.log(userId, UserAction.FRIEND_REMOVED, { friendId });
    return { status: 'removed' };
  }

  async getFriends(userId: string) {
    const friendships = await this.friendships.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { receiverId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      relations: ['requester', 'receiver'],
    });
    return friendships.map(f => (f.requesterId === userId ? f.receiver : f.requester));
  }

  async getPendingRequests(userId: string) {
    return this.friendships.find({
      where: { receiverId: userId, status: FriendshipStatus.PENDING },
      relations: ['requester'],
    });
  }
}

