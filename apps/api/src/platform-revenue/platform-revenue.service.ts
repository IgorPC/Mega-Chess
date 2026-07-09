import { Injectable, Logger } from '@nestjs/common';
import { PlatformRevenueType } from './entities/platform-revenue.entity';
import { PlatformRevenueRepository } from './platform-revenue.repository';

@Injectable()
export class PlatformRevenueService {
  private readonly logger = new Logger(PlatformRevenueService.name);

  constructor(private readonly repo: PlatformRevenueRepository) {}

  record(
    type: PlatformRevenueType,
    amountCc: number,
    referenceId: string,
    description?: string,
  ): void {
    if (amountCc <= 0) return;
    this.repo
      .save(this.repo.create({ type, amountCc: amountCc.toFixed(2), referenceId, description: description ?? null }))
      .catch((err) => {
        this.logger.warn(`Failed to record revenue type=${type} amount=${amountCc} ref=${referenceId}`, err instanceof Error ? err.stack : String(err));
      });
  }

  async summary() {
    const rows = await this.repo.summaryByType();

    const totalCc = rows.reduce((acc, r) => acc + parseFloat(r.totalCc ?? '0'), 0);

    const byType = Object.fromEntries(
      rows.map((r) => [r.type, { totalCc: parseFloat(r.totalCc ?? '0'), count: parseInt(r.count) }]),
    );

    return { totalCc, byType };
  }

  async history(page = 1, limit = 50) {
    const [items, total] = await this.repo.findAndCount(page, limit);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async chartByPeriod(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.repo.chartByPeriod(since);

    return rows.map((r) => ({
      date: r.date.slice(0, 10),
      type: r.type,
      totalCc: parseFloat(r.totalCc ?? '0'),
    }));
  }

  async todayTotal(): Promise<number> {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const row = await this.repo.todayTotal(start, end);
    return parseFloat(row?.total ?? '0');
  }
}
