import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser } from '../../entities/admin-user.entity';

@Injectable()
export class AdminAuthRepository {
  constructor(
    @InjectRepository(AdminUser) private readonly repo: Repository<AdminUser>,
  ) {}

  findActiveByEmail(email: string): Promise<AdminUser | null> {
    return this.repo.findOne({ where: { email, isActive: true } });
  }

  findById(id: string): Promise<AdminUser | null> {
    return this.repo.findOne({ where: { id } });
  }

  update(id: string, partial: Partial<AdminUser>): Promise<unknown> {
    return this.repo.update(id, partial);
  }
}
