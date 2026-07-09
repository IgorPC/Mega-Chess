import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WalletService } from '../wallet/wallet.service';
import { GameGateway } from '../game/game.gateway';
import { ASAAS_WEBHOOK_TOKEN_HEADER } from './consts/endpoints';

const TOKEN = 'super-secret-token';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let wallet: jest.Mocked<WalletService>;
  let gateway: jest.Mocked<GameGateway>;
  let events: jest.Mocked<WebhooksRepository>;

  const buildModule = async (tokenValue: string | undefined = TOKEN) => {
    const module = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(tokenValue) },
        },
        {
          provide: WalletService,
          useValue: { confirmDeposit: jest.fn(), confirmWithdrawal: jest.fn(), failWithdrawal: jest.fn() },
        },
        {
          provide: GameGateway,
          useValue: { emitToUser: jest.fn() },
        },
        {
          provide: WebhooksRepository,
          useValue: { insertEvent: jest.fn() },
        },
      ],
    }).compile();

    wallet = module.get(WalletService);
    gateway = module.get(GameGateway);
    events = module.get(WebhooksRepository);
    controller = module.get(WebhooksController);
  };

  beforeEach(async () => {
    await buildModule();
    events.insertEvent.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('throws if ASAAS_WEBHOOK_TOKEN is not configured', async () => {
      // NestJS catches the constructor error during compile() — verify via direct instantiation
      const { ConfigService } = require('@nestjs/config');
      const cfg = new ConfigService();
      jest.spyOn(cfg, 'get').mockReturnValue(undefined);
      expect(() => new WebhooksController(cfg, null as any, null as any, null as any))
        .toThrow('ASAAS_WEBHOOK_TOKEN');
    });
  });

  describe('token validation', () => {
    it('rejects when the token header is missing', async () => {
      await expect(
        controller.handleAsaas({ id: 'e1', event: 'PAYMENT_RECEIVED' }, undefined as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(events.insertEvent).not.toHaveBeenCalled();
    });

    it('rejects a token of different length', async () => {
      await expect(
        controller.handleAsaas({ id: 'e1', event: 'PAYMENT_RECEIVED' }, 'short'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token of the same length but wrong value', async () => {
      const wrongSameLength = 'x'.repeat(TOKEN.length);
      await expect(
        controller.handleAsaas({ id: 'e1', event: 'PAYMENT_RECEIVED' }, wrongSameLength),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts the correct token', async () => {
      wallet.confirmDeposit.mockResolvedValue(null as any);
      const result = await controller.handleAsaas(
        { id: 'e1', event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 10 } },
        TOKEN,
      );
      expect(result).toEqual({ received: true });
    });
  });

  describe('idempotency', () => {
    it('returns received:true without processing when the event id is missing', async () => {
      const result = await controller.handleAsaas({ event: 'PAYMENT_RECEIVED' }, TOKEN);
      expect(result).toEqual({ received: true });
      expect(events.insertEvent).not.toHaveBeenCalled();
      expect(wallet.confirmDeposit).not.toHaveBeenCalled();
    });

    it('acknowledges but skips processing when the event was already recorded (duplicate)', async () => {
      events.insertEvent.mockRejectedValue(new Error('duplicate key'));
      const result = await controller.handleAsaas(
        { id: 'e1', event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 10 } },
        TOKEN,
      );
      expect(result).toEqual({ received: true });
      expect(wallet.confirmDeposit).not.toHaveBeenCalled();
    });

    it('derives the event id from payment.id when body.id is absent', async () => {
      wallet.confirmDeposit.mockResolvedValue(null as any);
      await controller.handleAsaas(
        { event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 10 } },
        TOKEN,
      );
      expect(events.insertEvent).toHaveBeenCalledWith('p1', 'PAYMENT_RECEIVED');
    });

    it('derives the event id from transfer.id when body.id is absent', async () => {
      wallet.confirmWithdrawal.mockResolvedValue(undefined as any);
      await controller.handleAsaas(
        { event: 'TRANSFER_DONE', transfer: { id: 't1' } },
        TOKEN,
      );
      expect(events.insertEvent).toHaveBeenCalledWith('t1', 'TRANSFER_DONE');
    });
  });

  describe('PAYMENT_RECEIVED / PAYMENT_CONFIRMED', () => {
    it('confirms the deposit and emits a socket event when the wallet returns a result', async () => {
      wallet.confirmDeposit.mockResolvedValue({ userId: 'user-1', balance: 42 } as any);

      await controller.handleAsaas(
        { id: 'e1', event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 10 } },
        TOKEN,
      );

      expect(wallet.confirmDeposit).toHaveBeenCalledWith('p1');
      expect(gateway.emitToUser).toHaveBeenCalledWith('user-1', 'deposit_confirmed', {
        valueBrl: 10,
        balance: 42,
      });
    });

    it('does not emit when the wallet returns null (already processed / unknown deposit)', async () => {
      wallet.confirmDeposit.mockResolvedValue(null as any);
      await controller.handleAsaas(
        { id: 'e1', event: 'PAYMENT_CONFIRMED', payment: { id: 'p1', value: 10 } },
        TOKEN,
      );
      expect(gateway.emitToUser).not.toHaveBeenCalled();
    });
  });

  describe('TRANSFER_DONE', () => {
    it('confirms the withdrawal', async () => {
      wallet.confirmWithdrawal.mockResolvedValue(undefined as any);
      await controller.handleAsaas({ id: 'e1', event: 'TRANSFER_DONE', transfer: { id: 't1' } }, TOKEN);
      expect(wallet.confirmWithdrawal).toHaveBeenCalledWith('t1');
    });
  });

  describe('TRANSFER_FAILED', () => {
    it('fails the withdrawal', async () => {
      wallet.failWithdrawal.mockResolvedValue(undefined as any);
      await controller.handleAsaas({ id: 'e1', event: 'TRANSFER_FAILED', transfer: { id: 't1' } }, TOKEN);
      expect(wallet.failWithdrawal).toHaveBeenCalledWith('t1');
    });
  });

  describe('unknown event types', () => {
    it('acknowledges receipt without touching the wallet', async () => {
      const result = await controller.handleAsaas({ id: 'e1', event: 'SOME_OTHER_EVENT' }, TOKEN);
      expect(result).toEqual({ received: true });
      expect(wallet.confirmDeposit).not.toHaveBeenCalled();
      expect(wallet.confirmWithdrawal).not.toHaveBeenCalled();
      expect(wallet.failWithdrawal).not.toHaveBeenCalled();
    });
  });

  describe('processing errors', () => {
    it('swallows an error from wallet processing and still acknowledges the webhook', async () => {
      wallet.confirmDeposit.mockRejectedValue(new Error('db down'));
      const result = await controller.handleAsaas(
        { id: 'e1', event: 'PAYMENT_RECEIVED', payment: { id: 'p1', value: 10 } },
        TOKEN,
      );
      expect(result).toEqual({ received: true });
    });
  });
});
