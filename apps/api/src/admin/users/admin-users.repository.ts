import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { UserActivityLog } from '../../entities/user-activity-log.entity';

function paginate(page: number, limit: number) {
  return { skip: (page - 1) * limit, take: limit };
}

@Injectable()
export class AdminUsersRepository {
  constructor(
    @InjectRepository(User)              private readonly users:      Repository<User>,
    @InjectRepository(Wallet)            private readonly wallets:    Repository<Wallet>,
    @InjectRepository(WalletTransaction) private readonly txRepo:     Repository<WalletTransaction>,
    @InjectRepository(SupportTicket)     private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(UserActivityLog)   private readonly activity:   Repository<UserActivityLog>,
    private readonly dataSource: DataSource,
  ) {}

  createUsersQueryBuilder() {
    return this.users.createQueryBuilder('u');
  }

  findUserById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  findWalletByUserId(userId: string) {
    return this.wallets.findOne({ where: { userId } });
  }

  findAndCountTransactions(userId: string, page: number, limit: number) {
    return this.txRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      ...paginate(page, limit),
    });
  }

  findTicketsByUserId(userId: string) {
    return this.ticketRepo.find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  findAndCountActivityLogs(userId: string, page: number, limit: number) {
    return this.activity.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      ...paginate(page, limit),
    });
  }

  updateUser(id: string, data: Partial<User>) {
    return this.users.update(id, data);
  }

  deleteRefreshTokensByUserId(userId: string) {
    return this.dataSource.query('DELETE FROM refresh_tokens WHERE user_id = $1::uuid', [userId]);
  }

  findAllUsers() {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  findAllWallets() {
    return this.wallets.find();
  }
}
