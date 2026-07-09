import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from './entities/referral.entity';
import { ReferralEarning } from './entities/referral-earning.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class ReferralsRepository {
  constructor(
    @InjectRepository(Referral) private readonly referrals: Repository<Referral>,
    @InjectRepository(ReferralEarning) private readonly earnings: Repository<ReferralEarning>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  findReferralsByReferrer(referrerId: string): Promise<Referral[]> {
    return this.referrals.find({ where: { referrerId } });
  }

  findUserNickname(userId: string): Promise<Pick<User, 'nickname'> | null> {
    return this.users.findOne({ where: { id: userId }, select: ['nickname'] });
  }

  findEarnings(referrerId: string, referredId: string): Promise<ReferralEarning[]> {
    return this.earnings.find({ where: { referrerId, referredId } });
  }

  findUserWithReferralCode(userId: string): Promise<Pick<User, 'id' | 'referralCode'> | null> {
    return this.users.findOne({ where: { id: userId }, select: ['id', 'referralCode'] });
  }

  findUserByReferralCode(code: string): Promise<Pick<User, 'id'> | null> {
    return this.users.findOne({ where: { referralCode: code }, select: ['id'] });
  }

  updateReferralCode(userId: string, code: string): Promise<unknown> {
    return this.users.update(userId, { referralCode: code });
  }
}
