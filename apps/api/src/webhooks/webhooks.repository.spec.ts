import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhooksRepository } from './webhooks.repository';
import { AsaasEvent } from './entities/asaas-event.entity';

describe('WebhooksRepository', () => {
  let repository: WebhooksRepository;
  let ormRepo: jest.Mocked<Repository<AsaasEvent>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebhooksRepository,
        { provide: getRepositoryToken(AsaasEvent), useValue: { insert: jest.fn() } },
      ],
    }).compile();

    repository = module.get(WebhooksRepository);
    ormRepo = module.get(getRepositoryToken(AsaasEvent));
  });

  describe('insertEvent', () => {
    it('inserts the event id and type', async () => {
      ormRepo.insert.mockResolvedValue({} as any);
      await repository.insertEvent('evt-1', 'PAYMENT_RECEIVED');
      expect(ormRepo.insert).toHaveBeenCalledWith({ asaasEventId: 'evt-1', eventType: 'PAYMENT_RECEIVED' });
    });

    it('propagates a duplicate-key rejection from the repository', async () => {
      ormRepo.insert.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
      await expect(repository.insertEvent('evt-1', 'PAYMENT_RECEIVED')).rejects.toThrow('duplicate key');
    });
  });
});
