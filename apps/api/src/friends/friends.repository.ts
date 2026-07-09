import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Friendship, FriendshipStatus } from '../entities/friendship.entity';

@Injectable()
export class FriendsRepository {
  constructor(
    @InjectRepository(Friendship) private readonly friendships: Repository<Friendship>,
  ) {}

  findExistingBetween(userIdA: string, userIdB: string) {
    return this.friendships
      .createQueryBuilder('f')
      .where('(f.requesterId = :a AND f.receiverId = :b) OR (f.requesterId = :b AND f.receiverId = :a)', { a: userIdA, b: userIdB })
      .getOne();
  }

  create(requesterId: string, receiverId: string): Friendship {
    return this.friendships.create({ requesterId, receiverId });
  }

  save(friendship: Friendship) {
    return this.friendships.save(friendship);
  }

  remove(friendship: Friendship) {
    return this.friendships.remove(friendship);
  }

  findByIdWithUsers(id: string) {
    return this.friendships.findOne({
      where: { id },
      relations: ['receiver', 'requester'],
    });
  }

  deleteAcceptedBetween(userIdA: string, userIdB: string) {
    return this.friendships
      .createQueryBuilder()
      .delete()
      .where(
        '((requester_id = :a AND receiver_id = :b) OR (requester_id = :b AND receiver_id = :a)) AND status = :s',
        { a: userIdA, b: userIdB, s: FriendshipStatus.ACCEPTED },
      )
      .execute();
  }

  findAcceptedForUser(userId: string) {
    return this.friendships.find({
      where: [
        { requesterId: userId, status: FriendshipStatus.ACCEPTED },
        { receiverId: userId, status: FriendshipStatus.ACCEPTED },
      ],
      relations: ['requester', 'receiver'],
    });
  }

  findPendingForReceiver(userId: string) {
    return this.friendships.find({
      where: { receiverId: userId, status: FriendshipStatus.PENDING },
      relations: ['requester'],
    });
  }
}
