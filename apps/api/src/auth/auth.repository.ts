import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { Referral } from '../referrals/entities/referral.entity';

@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(RefreshToken) private tokens: Repository<RefreshToken>,
    @InjectRepository(Referral) private referrals: Repository<Referral>,
  ) {}

  findUserByEmailOrNickname(email: string, nickname: string) {
    return this.users.findOne({ where: [{ email }, { nickname }] });
  }

  createUser(data: Partial<User>) {
    return this.users.create(data);
  }

  saveUser(user: User) {
    return this.users.save(user);
  }

  findUserByReferralCode(referralCode: string) {
    return this.users.findOne({ where: { referralCode } });
  }

  countReferralsByReferrer(referrerId: string) {
    return this.referrals.count({ where: { referrerId } });
  }

  createReferral(data: Partial<Referral>) {
    return this.referrals.create(data);
  }

  saveReferral(referral: Referral) {
    return this.referrals.save(referral);
  }

  findUserByEmail(email: string) {
    return this.users.findOne({ where: { email } });
  }

  findUserByVerificationToken(token: string) {
    return this.users.findOne({ where: { emailVerificationToken: token } });
  }

  updateUser(id: string, data: Partial<User>) {
    return this.users.update(id, data);
  }

  findRefreshTokenWithUser(token: string) {
    return this.tokens.findOne({ where: { token }, relations: ['user'] });
  }

  deleteRefreshToken(token: string) {
    return this.tokens.delete({ token });
  }

  createRefreshToken(data: Partial<RefreshToken>) {
    return this.tokens.create(data);
  }

  saveRefreshToken(token: RefreshToken) {
    return this.tokens.save(token);
  }
}
