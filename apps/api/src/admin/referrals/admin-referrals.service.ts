import { Injectable } from '@nestjs/common';
import { AdminReferralsRepository } from './admin-referrals.repository';
import { ADMIN_REFERRALS_STATS_PERIOD_DAYS } from './consts/endpoints';

@Injectable()
export class AdminReferralsService {
  constructor(
    private readonly repo: AdminReferralsRepository,
  ) {}

  async list(params: {
    page: number;
    limit: number;
    referrerId?: string;
    isEligible?: boolean;
  }) {
    const { page, limit } = params;
    const { items, total } = await this.repo.findPage(params);

    return {
      items: items.map(row => ({
        id: row.id,
        referrerId: row.referrerId,
        referrerNickname: row.referrerNickname ?? '?',
        referredId: row.referredId,
        referredNickname: row.referredNickname ?? '?',
        isEligible: row.isEligible,
        createdAt: row.createdAt,
        totalEarned: Number(row.totalEarned ?? 0),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async stats(period?: string) {
    let since: Date | undefined;
    if (period && period !== 'all') {
      const days = ADMIN_REFERRALS_STATS_PERIOD_DAYS[period];
      if (days) {
        since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      }
    }

    const result = await this.repo.getEarningsStatsRaw(since);

    return {
      totalEarned: Number(result?.totalEarned ?? 0),
      totalPayments: Number(result?.totalPayments ?? 0),
    };
  }
}
