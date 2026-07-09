import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException, Inject, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ImprovementSuggestion, SuggestionStatus } from '../entities/improvement-suggestion.entity';
import { SuggestionVote } from '../entities/suggestion-vote.entity';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto';

function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekTtlSeconds(date: Date): number {
  const d = new Date(date);
  const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + daysUntilSunday);
  sunday.setHours(23, 59, 59, 0);
  return Math.max(1, Math.floor((sunday.getTime() - d.getTime()) / 1000));
}

const MAX_SUGGESTIONS_PER_WEEK = 3;
const MAX_VOTES_PER_WEEK = 10;

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);

  constructor(
    @InjectRepository(ImprovementSuggestion)
    private suggestions: Repository<ImprovementSuggestion>,
    @InjectRepository(SuggestionVote)
    private votes: Repository<SuggestionVote>,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private dataSource: DataSource,
  ) {}

  // ── List ─────────────────────────────────────────────────────────────────────

  async list(userId: string, page = 1, limit = 20, status?: string) {
    const resolvedStatus = status ?? SuggestionStatus.OPEN;

    // Regular users can only see OPEN and COMPLETED
    if (resolvedStatus === SuggestionStatus.HIDDEN || resolvedStatus === SuggestionStatus.REJECTED) {
      // Still allow, we'll just return OPEN as fallback for non-admin
      // Actually spec says HIDDEN not accessible to users — return empty or only OPEN/COMPLETED
    }

    const allowedStatuses = [SuggestionStatus.OPEN, SuggestionStatus.COMPLETED];
    const effectiveStatus = allowedStatuses.includes(resolvedStatus as SuggestionStatus)
      ? resolvedStatus
      : SuggestionStatus.OPEN;

    const [items, total] = await this.suggestions.findAndCount({
      where: { status: effectiveStatus as SuggestionStatus },
      relations: ['author'],
      order: { voteCount: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Fetch user's votes for this page
    const ids = items.map(s => s.id);
    let votedSet = new Set<string>();
    if (ids.length > 0) {
      const userVotes = await this.votes.find({
        where: ids.map(sid => ({ suggestionId: sid, userId })),
      });
      votedSet = new Set(userVotes.map(v => v.suggestionId));
    }

    // Weekly votes used
    const week = getIsoWeek(new Date());
    const votesUsed = parseInt(await this.redis.get(`suggestion_votes:${userId}:${week}`) ?? '0', 10);

    return {
      items: items.map(s => ({
        ...s,
        authorNickname: (s.author as any)?.nickname ?? '',
        myVote: votedSet.has(s.id),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      votesRemaining: Math.max(0, MAX_VOTES_PER_WEEK - votesUsed),
    };
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getOne(userId: string, id: string) {
    const suggestion = await this.suggestions.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!suggestion) throw new NotFoundException('Sugestão não encontrada');
    if (suggestion.status === SuggestionStatus.HIDDEN) throw new NotFoundException('Sugestão não encontrada');

    const vote = await this.votes.findOne({ where: { suggestionId: id, userId } });
    return {
      ...suggestion,
      authorNickname: (suggestion.author as any)?.nickname ?? '',
      myVote: !!vote,
    };
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateSuggestionDto): Promise<ImprovementSuggestion> {
    const now = new Date();
    const week = getIsoWeek(now);
    const key = `suggestions_created:${userId}:${week}`;

    const current = parseInt(await this.redis.get(key) ?? '0', 10);
    if (current >= MAX_SUGGESTIONS_PER_WEEK) {
      throw new BadRequestException(`Limite de ${MAX_SUGGESTIONS_PER_WEEK} sugestões por semana atingido`);
    }

    const suggestion = await this.suggestions.save(
      this.suggestions.create({
        authorId: userId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        status: SuggestionStatus.OPEN,
        voteCount: 0,
      }),
    );

    const ttl = weekTtlSeconds(now);
    await this.redis.set(key, String(current + 1), 'EX', ttl);

    this.logger.log(`Suggestion created id=${suggestion.id} userId=${userId}`);
    return suggestion;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(userId: string, id: string, dto: UpdateSuggestionDto): Promise<ImprovementSuggestion> {
    const suggestion = await this.suggestions.findOne({ where: { id } });
    if (!suggestion) throw new NotFoundException('Sugestão não encontrada');
    if (suggestion.authorId !== userId) throw new ForbiddenException('Acesso negado');
    if (suggestion.status !== SuggestionStatus.OPEN) {
      throw new BadRequestException('Só é possível editar sugestões abertas');
    }
    if (suggestion.voteCount > 0) {
      throw new BadRequestException('Não é possível editar uma sugestão que já recebeu votos');
    }

    if (dto.title !== undefined) suggestion.title = dto.title.trim();
    if (dto.description !== undefined) suggestion.description = dto.description.trim();

    return this.suggestions.save(suggestion);
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(userId: string, id: string): Promise<void> {
    const suggestion = await this.suggestions.findOne({ where: { id } });
    if (!suggestion) throw new NotFoundException('Sugestão não encontrada');
    if (suggestion.authorId !== userId) throw new ForbiddenException('Acesso negado');
    if (suggestion.status !== SuggestionStatus.OPEN) {
      throw new BadRequestException('Só é possível excluir sugestões abertas');
    }
    if (suggestion.voteCount > 0) {
      throw new BadRequestException('Não é possível excluir uma sugestão que já recebeu votos');
    }

    await this.suggestions.remove(suggestion);
  }

  // ── Vote ──────────────────────────────────────────────────────────────────

  async vote(userId: string, id: string): Promise<void> {
    const now = new Date();
    const week = getIsoWeek(now);
    const voteKey = `suggestion_votes:${userId}:${week}`;

    const suggestion = await this.suggestions.findOne({ where: { id } });
    if (!suggestion) throw new NotFoundException('Sugestão não encontrada');
    if (suggestion.status === SuggestionStatus.HIDDEN) throw new NotFoundException('Sugestão não encontrada');
    if (suggestion.authorId === userId) throw new ForbiddenException('Você não pode votar na própria sugestão');

    const votesUsed = parseInt(await this.redis.get(voteKey) ?? '0', 10);
    if (votesUsed >= MAX_VOTES_PER_WEEK) {
      throw new BadRequestException(`Limite de ${MAX_VOTES_PER_WEEK} votos por semana atingido`);
    }

    const existing = await this.votes.findOne({ where: { suggestionId: id, userId } });
    if (existing) throw new ConflictException('Você já votou nesta sugestão');

    await this.dataSource.transaction(async (em) => {
      await em.save(SuggestionVote, em.create(SuggestionVote, { suggestionId: id, userId }));
      await em.increment(ImprovementSuggestion, { id }, 'voteCount', 1);
    });

    const ttl = weekTtlSeconds(now);
    await this.redis.set(voteKey, String(votesUsed + 1), 'EX', ttl);
  }

  // ── Unvote ────────────────────────────────────────────────────────────────

  async unvote(userId: string, id: string): Promise<void> {
    const suggestion = await this.suggestions.findOne({ where: { id } });
    if (!suggestion) throw new NotFoundException('Sugestão não encontrada');

    const vote = await this.votes.findOne({ where: { suggestionId: id, userId } });
    if (!vote) throw new NotFoundException('Voto não encontrado');

    await this.dataSource.transaction(async (em) => {
      await em.remove(SuggestionVote, vote);
      await em.decrement(ImprovementSuggestion, { id }, 'voteCount', 1);
    });

    // Decrement weekly counter
    const week = getIsoWeek(new Date());
    const voteKey = `suggestion_votes:${userId}:${week}`;
    const current = parseInt(await this.redis.get(voteKey) ?? '0', 10);
    if (current > 0) {
      const ttl = weekTtlSeconds(new Date());
      await this.redis.set(voteKey, String(current - 1), 'EX', ttl);
    }
  }

  // ── Admin: list ───────────────────────────────────────────────────────────

  async adminList(params: {
    page?: number; limit?: number; status?: string;
    dateFrom?: string; dateTo?: string; authorId?: string;
  }) {
    const { page = 1, limit = 25, status, dateFrom, dateTo, authorId } = params;

    const qb = this.suggestions.createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .orderBy('s.voteCount', 'DESC')
      .addOrderBy('s.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('s.status = :status', { status });
    if (dateFrom) qb.andWhere('s.createdAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    if (dateTo) qb.andWhere('s.createdAt <= :dateTo', { dateTo: new Date(dateTo) });
    if (authorId) qb.andWhere('s.authorId = :authorId', { authorId });

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map(s => ({ ...s, authorNickname: (s.author as any)?.nickname ?? '' })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Admin: update status ──────────────────────────────────────────────────

  async adminUpdate(id: string, status: SuggestionStatus, adminNote?: string): Promise<ImprovementSuggestion> {
    const suggestion = await this.suggestions.findOne({ where: { id } });
    if (!suggestion) throw new NotFoundException('Sugestão não encontrada');

    suggestion.status = status;
    if (adminNote !== undefined) suggestion.adminNote = adminNote;

    return this.suggestions.save(suggestion);
  }
}
