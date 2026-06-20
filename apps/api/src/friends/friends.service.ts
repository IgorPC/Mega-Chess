import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship, FriendshipStatus } from '../entities/friendship.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(Friendship) private friendships: Repository<Friendship>,
    @InjectRepository(User) private users: Repository<User>,
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

    const f = this.friendships.create({ requesterId, receiverId: receiver.id });
    return this.friendships.save(f);
  }

  async respondRequest(userId: string, friendshipId: string, accept: boolean) {
    const f = await this.friendships.findOne({ where: { id: friendshipId } });
    if (!f || f.receiverId !== userId) throw new ForbiddenException();
    if (!accept) return this.friendships.remove(f);
    f.status = FriendshipStatus.ACCEPTED;
    return this.friendships.save(f);
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
