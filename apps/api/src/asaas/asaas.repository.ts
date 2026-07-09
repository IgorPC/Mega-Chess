import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class AsaasRepository {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findById(userId: string): Promise<User | null> {
    return this.users.findOne({ where: { id: userId } });
  }

  updateAsaasCustomerId(userId: string, asaasCustomerId: string): Promise<unknown> {
    return this.users.update(userId, { asaasCustomerId });
  }
}
