import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchReport } from '../../entities/match-report.entity';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { Review } from '../../entities/review.entity';
import { User } from '../../entities/user.entity';
import { ADMIN_REPORTS_HISTORY_TAKE } from './consts/endpoints';

@Injectable()
export class AdminReportsRepository {
  constructor(
    @InjectRepository(MatchReport) private reports: Repository<MatchReport>,
    @InjectRepository(SupportTicket) private tickets: Repository<SupportTicket>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Review) private reviews: Repository<Review>,
  ) {}

  async findPage(params: {
    page: number;
    limit: number;
    status?: string;
    verdict?: string;
    reportedId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const { page, limit } = params;
    const qb = this.reports.createQueryBuilder('r')
      .leftJoin('r.reporter', 'reporter')
      .leftJoin('r.reportedUser', 'reported')
      .addSelect(['reporter.id', 'reporter.nickname', 'reporter.avatarUrl'])
      .addSelect(['reported.id', 'reported.nickname', 'reported.avatarUrl', 'reported.bannedUntil'])
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (params.status) qb.andWhere('r.status = :status', { status: params.status });
    if (params.verdict) qb.andWhere('r.aiVerdict = :verdict', { verdict: params.verdict });
    if (params.reportedId) qb.andWhere('r.reportedUserId = :reportedId', { reportedId: params.reportedId });
    if (params.dateFrom) qb.andWhere('r.createdAt >= :from', { from: new Date(params.dateFrom) });
    if (params.dateTo) qb.andWhere('r.createdAt <= :to', { to: new Date(params.dateTo) });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  findById(id: string): Promise<MatchReport | null> {
    return this.reports.findOne({
      where: { id },
      relations: ['reporter', 'reportedUser', 'match', 'appeal'],
    });
  }

  findByIdWithMatch(id: string): Promise<MatchReport | null> {
    return this.reports.findOne({ where: { id }, relations: ['match'] });
  }

  findRecentByReportedUser(reportedUserId: string) {
    return this.reports.find({
      where: { reportedUserId },
      order: { createdAt: 'DESC' },
      take: ADMIN_REPORTS_HISTORY_TAKE,
    });
  }

  countByReportedUser(reportedUserId: string): Promise<number> {
    return this.reports.count({ where: { reportedUserId } });
  }

  findRecentTicketsByUser(userId: string) {
    return this.tickets.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: ADMIN_REPORTS_HISTORY_TAKE,
    });
  }

  updateReport(id: string, partial: Partial<MatchReport>): Promise<unknown> {
    return this.reports.update(id, partial as any);
  }

  findReviewById(id: string): Promise<Review | null> {
    return this.reviews.findOne({ where: { id } });
  }

  deleteReview(id: string): Promise<unknown> {
    return this.reviews.delete(id);
  }

  getReviewStatsForUser(userId: string) {
    return this.reviews
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.reviewedId = :userId', { userId })
      .getRawOne<{ avg: string; count: string }>();
  }

  updateUserReviewStats(userId: string, avgRating: number | null, reviewCount: number): Promise<unknown> {
    return this.users.update(userId, { avgRating, reviewCount });
  }
}
