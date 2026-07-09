import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from '../../referrals/entities/referral.entity';
import { ReferralEarning } from '../../referrals/entities/referral-earning.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class AdminReferralsRepository {
  constructor(
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
    @InjectRepository(ReferralEarning)
    private readonly earningRepo: Repository<ReferralEarning>,
  ) {}

  async findPage(params: {
    page: number;
    limit: number;
    referrerId?: string;
    isEligible?: boolean;
  }) {
    const { page, limit, referrerId, isEligible } = params;
    const skip = (page - 1) * limit;

    const qb = this.referralRepo
      .createQueryBuilder('r')
      .leftJoin(User, 'referrer', 'referrer.id = r.referrerId')
      .leftJoin(User, 'referred', 'referred.id = r.referredId')
      .select([
        'r.id AS id',
        'r.referrerId AS "referrerId"',
        'referrer.nickname AS "referrerNickname"',
        'r.referredId AS "referredId"',
        'referred.nickname AS "referredNickname"',
        'r.isEligible AS "isEligible"',
        'r.createdAt AS "createdAt"',
      ])
      .addSelect(subQuery => {
        return subQuery
          .select('COALESCE(SUM(e.amount), 0)')
          .from(ReferralEarning, 'e')
          .where('e.referrerId = r.referrerId AND e.referredId = r.referredId');
      }, 'totalEarned')
      .orderBy('r.createdAt', 'DESC')
      .offset(skip)
      .limit(limit);

    if (referrerId) {
      qb.andWhere('r.referrerId = :referrerId', { referrerId });
    }
    if (isEligible !== undefined) {
      qb.andWhere('r.isEligible = :isEligible', { isEligible });
    }

    const [items, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);

    return { items, total };
  }

  getEarningsStatsRaw(since?: Date) {
    const qb = this.earningRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'totalEarned')
      .addSelect('COUNT(e.id)', 'totalPayments');

    if (since) {
      qb.where('e.createdAt >= :since', { since });
    }

    return qb.getRawOne<{ totalEarned: string; totalPayments: string }>();
  }
}
