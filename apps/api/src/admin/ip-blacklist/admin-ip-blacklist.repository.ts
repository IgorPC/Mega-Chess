import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpBlacklist } from '../../entities/ip-blacklist.entity';

@Injectable()
export class AdminIpBlacklistRepository {
  constructor(
    @InjectRepository(IpBlacklist) private readonly repo: Repository<IpBlacklist>,
  ) {}

  findByIp(ip: string): Promise<IpBlacklist | null> {
    return this.repo.findOne({ where: { ip } });
  }

  findAll(): Promise<IpBlacklist[]> {
    return this.repo.find();
  }

  async findPage(page: number, limit: number, ip?: string) {
    const qb = this.repo.createQueryBuilder('b').orderBy('b.createdAt', 'DESC');
    if (ip) qb.andWhere('b.ip ILIKE :ip', { ip: `%${ip}%` });
    const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, total };
  }

  create(partial: Partial<IpBlacklist>): IpBlacklist {
    return this.repo.create(partial);
  }

  save(entry: IpBlacklist): Promise<IpBlacklist> {
    return this.repo.save(entry);
  }

  remove(entry: IpBlacklist): Promise<IpBlacklist> {
    return this.repo.remove(entry);
  }
}
