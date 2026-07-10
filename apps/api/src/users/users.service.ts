import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../entities/user.entity';
import { Match, MatchStatus } from '../entities/match.entity';
import { Review } from '../entities/review.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserActivityService } from '../user-activity/user-activity.service';
import { UserAction } from '../entities/user-activity-log.entity';
import { WalletService } from '../wallet/wallet.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { TERMS_VERSION } from './consts/terms';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Match) private matches: Repository<Match>,
    @InjectRepository(Review) private reviews: Repository<Review>,
    @InjectRepository(RefreshToken) private refreshTokens: Repository<RefreshToken>,
    private activity: UserActivityService,
    private wallet: WalletService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async findByNickname(nickname: string) {
    const user = await this.users.findOne({ where: { nickname } });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async getMe(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const { passwordHash, ...safe } = user;
    return safe;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.users.update(userId, dto);
    this.activity.log(userId, UserAction.PROFILE_UPDATED, { fields: Object.keys(dto) });
    return this.getMe(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.users.update(userId, { avatarUrl });
    this.activity.log(userId, UserAction.AVATAR_UPDATED);
    return { id: userId, avatarUrl };
  }

  async updateBilling(
    userId: string,
    dto: { cpf?: string; billingName?: string; birthDate?: string },
  ) {
    const update: Record<string, string> = {};
    if (dto.cpf !== undefined) update.cpf = dto.cpf.replace(/\D/g, '');
    if (dto.billingName !== undefined) update.billingName = dto.billingName;
    if (dto.birthDate !== undefined) update.birthDate = dto.birthDate;
    if (Object.keys(update).length) await this.users.update(userId, update);
    if (dto.cpf !== undefined) this.activity.log(userId, UserAction.CPF_REGISTERED);
    return this.getMe(userId);
  }

  async getMatchHistory(userId: string, page = 1, limit = 20) {
    const [matches, total] = await this.matches.findAndCount({
      where: [
        { whitePlayerId: userId, status: MatchStatus.FINISHED },
        { blackPlayerId: userId, status: MatchStatus.FINISHED },
      ],
      relations: ['whitePlayer', 'blackPlayer'],
      order: { finishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { matches, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getStats(userId: string) {
    const statsSql = `
      COUNT(*) AS total,
      SUM(CASE WHEN m.result = 'DRAW' THEN 1 ELSE 0 END) AS draws,
      SUM(CASE
        WHEN m.white_player_id = :uid AND m.result IN ('WHITE_WINS','FORFEIT_BLACK','TIMEOUT_BLACK') THEN 1
        WHEN m.black_player_id = :uid AND m.result IN ('BLACK_WINS','FORFEIT_WHITE','TIMEOUT_WHITE') THEN 1
        ELSE 0 END) AS wins
    `;
    const baseParams = { uid: userId, status: MatchStatus.FINISHED };

    const [onlineRow, offlineRow] = await Promise.all([
      this.matches.createQueryBuilder('m')
        .select(statsSql)
        .where('(m.whitePlayerId = :uid OR m.blackPlayerId = :uid) AND m.status = :status AND m.isOffline = false', baseParams)
        .getRawOne(),
      this.matches.createQueryBuilder('m')
        .select(statsSql)
        .where('(m.whitePlayerId = :uid OR m.blackPlayerId = :uid) AND m.status = :status AND m.isOffline = true', baseParams)
        .getRawOne(),
    ]);

    const parse = (row: any) => {
      const total = parseInt(row?.total ?? '0', 10);
      const draws = parseInt(row?.draws ?? '0', 10);
      const wins  = parseInt(row?.wins  ?? '0', 10);
      return { wins, losses: total - draws - wins, draws, total };
    };

    const online = parse(onlineRow);
    const offline = parse(offlineRow);
    return { ...online, offline };
  }

  async acceptTerms(userId: string) {
    await this.users.update(userId, { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION });
    this.activity.log(userId, UserAction.TERMS_ACCEPTED, { version: TERMS_VERSION });
    return this.getMe(userId);
  }

  async deleteAccount(userId: string, acknowledgeBalanceLoss = false) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    const { balance } = await this.wallet.getBalance(userId);
    if (balance > 0 && !acknowledgeBalanceLoss) {
      throw new BadRequestException({ code: 'HAS_BALANCE', balance });
    }

    // Anonymize PII instead of hard-deleting: matches, reviews and wallet
    // transactions reference this user and must be preserved for opponents'
    // history and financial/AML compliance. Freeing the email/nickname lets
    // the person register a brand-new account if they choose to.
    await this.users.update(userId, {
      isActive: false,
      email: `deleted_${userId}@deleted.invalid`,
      nickname: `deleted_${userId}`,
      name: 'Usuário excluído',
      avatarUrl: null,
      bio: null,
      passwordHash: await bcrypt.hash(uuidv4(), 10),
      cpf: null,
      billingName: null,
      birthDate: null,
      pixKey: null,
      pixKeyType: null,
      asaasCustomerId: null,
      emailVerificationToken: null,
      emailVerified: false,
    });

    await this.refreshTokens.delete({ userId });
    await this.redis.del(`session:${userId}`);
    this.activity.log(userId, UserAction.ACCOUNT_DELETED);
    return { success: true };
  }

  async getReviews(nickname: string, page = 1, limit = 10) {
    limit = Math.min(limit, 50);
    const user = await this.users.findOne({ where: { nickname } });
    if (!user) throw new NotFoundException('User not found');

    const [data, total] = await this.reviews.findAndCount({
      where: { reviewedId: user.id },
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, totalPages: Math.ceil(total / limit), avgRating: user.avgRating, reviewCount: user.reviewCount };
  }
}

