import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdminUsersRepository } from './admin-users.repository';
import { User } from '../../entities/user.entity';
import { Wallet } from '../../entities/wallet.entity';
import { WalletTransaction } from '../../entities/wallet-transaction.entity';
import { SupportTicket } from '../../entities/support-ticket.entity';
import { UserActivityLog } from '../../entities/user-activity-log.entity';

describe('AdminUsersRepository', () => {
  let repo: AdminUsersRepository;
  let usersRepo: jest.Mocked<Repository<User>>;
  let walletsRepo: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;
  let ticketRepo: jest.Mocked<Repository<SupportTicket>>;
  let activityRepo: jest.Mocked<Repository<UserActivityLog>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AdminUsersRepository,
        { provide: getRepositoryToken(User), useValue: { createQueryBuilder: jest.fn(), findOne: jest.fn(), update: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(Wallet), useValue: { findOne: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(WalletTransaction), useValue: { findAndCount: jest.fn() } },
        { provide: getRepositoryToken(SupportTicket), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(UserActivityLog), useValue: { findAndCount: jest.fn() } },
        { provide: DataSource, useValue: { query: jest.fn() } },
      ],
    }).compile();

    repo = module.get(AdminUsersRepository);
    usersRepo = module.get(getRepositoryToken(User));
    walletsRepo = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(WalletTransaction));
    ticketRepo = module.get(getRepositoryToken(SupportTicket));
    activityRepo = module.get(getRepositoryToken(UserActivityLog));
    dataSource = module.get(DataSource);
  });

  it('createUsersQueryBuilder returns a query builder', () => {
    const qb = { where: jest.fn() };
    usersRepo.createQueryBuilder.mockReturnValue(qb as any);
    expect(repo.createUsersQueryBuilder()).toBe(qb);
    expect(usersRepo.createQueryBuilder).toHaveBeenCalledWith('u');
  });

  it('findUserById queries by id', async () => {
    usersRepo.findOne.mockResolvedValue({ id: 'u1' } as any);
    expect(await repo.findUserById('u1')).toEqual({ id: 'u1' });
  });

  it('findWalletByUserId queries by userId', async () => {
    walletsRepo.findOne.mockResolvedValue({ userId: 'u1', balance: '10.00' } as any);
    expect(await repo.findWalletByUserId('u1')).toEqual({ userId: 'u1', balance: '10.00' });
  });

  it('findAndCountTransactions returns paginated transactions', async () => {
    txRepo.findAndCount.mockResolvedValue([[{ id: 't1' }] as any, 1]);
    const result = await repo.findAndCountTransactions('u1', 2, 10);
    expect(txRepo.findAndCount).toHaveBeenCalledWith({ where: { userId: 'u1' }, order: { createdAt: 'DESC' }, skip: 10, take: 10 });
    expect(result).toEqual([[{ id: 't1' }], 1]);
  });

  it('findTicketsByUserId returns tickets', async () => {
    ticketRepo.find.mockResolvedValue([{ id: 'tk1' }] as any);
    expect(await repo.findTicketsByUserId('u1')).toEqual([{ id: 'tk1' }]);
  });

  it('findAndCountActivityLogs returns paginated logs', async () => {
    activityRepo.findAndCount.mockResolvedValue([[], 0]);
    const result = await repo.findAndCountActivityLogs('u1', 1, 50);
    expect(activityRepo.findAndCount).toHaveBeenCalledWith({ where: { userId: 'u1' }, order: { createdAt: 'DESC' }, skip: 0, take: 50 });
    expect(result).toEqual([[], 0]);
  });

  it('updateUser delegates to repo.update', async () => {
    await repo.updateUser('u1', { rating: 1500 } as any);
    expect(usersRepo.update).toHaveBeenCalledWith('u1', { rating: 1500 });
  });

  it('deleteRefreshTokensByUserId runs raw query', async () => {
    await repo.deleteRefreshTokensByUserId('u1');
    expect(dataSource.query).toHaveBeenCalledWith('DELETE FROM refresh_tokens WHERE user_id = $1::uuid', ['u1']);
  });

  it('findAllUsers and findAllWallets return all records', async () => {
    usersRepo.find.mockResolvedValue([]);
    walletsRepo.find.mockResolvedValue([]);
    await repo.findAllUsers();
    await repo.findAllWallets();
    expect(usersRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    expect(walletsRepo.find).toHaveBeenCalled();
  });
});
