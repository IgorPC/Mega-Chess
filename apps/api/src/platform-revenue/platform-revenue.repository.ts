import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformRevenue } from './entities/platform-revenue.entity';

@Injectable()
export class PlatformRevenueRepository {
  constructor(
    @InjectRepository(PlatformRevenue)
    private readonly repo: Repository<PlatformRevenue>,
  ) {}

  create(data: Partial<PlatformRevenue>): PlatformRevenue {
    return this.repo.create(data);
  }

  save(entity: PlatformRevenue): Promise<PlatformRevenue> {
    return this.repo.save(entity);
  }

  summaryByType(): Promise<{ type: string; totalCc: string; count: string }[]> {
    return this.repo
      .createQueryBuilder('r')
      .select('r.type', 'type')
      .addSelect('SUM(r.amount_cc)', 'totalCc')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.type')
      .getRawMany<{ type: string; totalCc: string; count: string }>();
  }

  findAndCount(page: number, limit: number): Promise<[PlatformRevenue[], number]> {
    return this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  chartByPeriod(since: Date): Promise<{ date: string; type: string; totalCc: string }[]> {
    return this.repo
      .createQueryBuilder('r')
      .select("DATE_TRUNC('day', r.created_at)", 'date')
      .addSelect('r.type', 'type')
      .addSelect('SUM(r.amount_cc)', 'totalCc')
      .where('r.created_at >= :since', { since })
      .groupBy("DATE_TRUNC('day', r.created_at), r.type")
      .orderBy("DATE_TRUNC('day', r.created_at)", 'ASC')
      .getRawMany<{ date: string; type: string; totalCc: string }>();
  }

  todayTotal(start: Date, end: Date): Promise<{ total: string } | undefined> {
    return this.repo
      .createQueryBuilder('r')
      .select('SUM(r.amount_cc)', 'total')
      .where('r.created_at BETWEEN :start AND :end', { start, end })
      .getRawOne<{ total: string }>();
  }
}
