import { Injectable, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PlatformConfigService } from '../platform-config/platform-config.service';
import { ReferralsRepository } from './referrals.repository';
import {
  REFERRALS_ENABLED_CONFIG_KEY,
  REFERRAL_CODE_LENGTH,
  REFERRAL_CODE_GENERATION_MAX_ATTEMPTS,
  DEFAULT_APP_URL,
} from './consts/referrals.consts';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly repo: ReferralsRepository,
    private platformConfig: PlatformConfigService,
    private config: ConfigService,
  ) {}

  async getMyReferrals(userId: string) {
    const referralsEnabled = await this.platformConfig.getBoolean(REFERRALS_ENABLED_CONFIG_KEY);
    if (!referralsEnabled) throw new ForbiddenException('Sistema de indicações desabilitado');

    const referralList = await this.repo.findReferralsByReferrer(userId);

    const result = await Promise.all(
      referralList.map(async (r) => {
        const referred = await this.repo.findUserNickname(r.referredId);
        const earningRows = await this.repo.findEarnings(userId, r.referredId);
        const totalEarned = earningRows.reduce((sum, e) => sum + Number(e.amount), 0);
        return {
          nickname: referred?.nickname ?? 'Usuário removido',
          isEligible: r.isEligible,
          totalEarned,
        };
      }),
    );

    const totalEarned = result.reduce((sum, r) => sum + r.totalEarned, 0);
    return { referrals: result, totalEarned };
  }

  private generateCode(): string {
    return randomBytes(6).toString('base64url').slice(0, REFERRAL_CODE_LENGTH).toUpperCase();
  }

  async getMyCode(userId: string) {
    const referralsEnabled = await this.platformConfig.getBoolean(REFERRALS_ENABLED_CONFIG_KEY);
    if (!referralsEnabled) throw new ForbiddenException('Sistema de indicações desabilitado');

    let user = await this.repo.findUserWithReferralCode(userId);
    const appUrl = this.config.get<string>('APP_URL', DEFAULT_APP_URL);

    if (user && !user.referralCode) {
      // Generate a unique code for existing users that don't have one yet
      let code: string;
      let attempts = 0;
      do {
        code = this.generateCode();
        const existing = await this.repo.findUserByReferralCode(code);
        if (!existing) break;
        attempts++;
      } while (attempts < REFERRAL_CODE_GENERATION_MAX_ATTEMPTS);

      await this.repo.updateReferralCode(userId, code);
      user = { ...user, referralCode: code };
    }

    return {
      referralCode: user?.referralCode ?? null,
      link: user?.referralCode ? `${appUrl}/register?ref=${user.referralCode}` : null,
    };
  }
}
