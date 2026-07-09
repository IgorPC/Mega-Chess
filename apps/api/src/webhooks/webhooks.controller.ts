import {
  Controller, Post, Body, Headers, UnauthorizedException,
  InternalServerErrorException, Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WalletService } from '../wallet/wallet.service';
import { GameGateway } from '../game/game.gateway';
import { WebhooksRepository } from './webhooks.repository';
import {
  WEBHOOKS_ROUTE,
  WEBHOOKS_ASAAS_ROUTE,
  ASAAS_WEBHOOK_TOKEN_HEADER,
  ASAAS_EVENT_TYPES,
} from './consts/endpoints';

@SkipThrottle()
@Controller(WEBHOOKS_ROUTE)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookToken: Buffer;

  constructor(
    config: ConfigService,
    private wallet: WalletService,
    private gateway: GameGateway,
    private events: WebhooksRepository,
  ) {
    const token = config.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (!token) throw new InternalServerErrorException('ASAAS_WEBHOOK_TOKEN não configurado');
    this.webhookToken = Buffer.from(token);
  }

  private isValidToken(incoming: string | undefined): boolean {
    if (!incoming) return false;
    try {
      const incomingBuf = Buffer.from(incoming);
      if (incomingBuf.length !== this.webhookToken.length) return false;
      return crypto.timingSafeEqual(incomingBuf, this.webhookToken);
    } catch {
      return false;
    }
  }

  @Post(WEBHOOKS_ASAAS_ROUTE)
  async handleAsaas(
    @Body() body: any,
    @Headers(ASAAS_WEBHOOK_TOKEN_HEADER) token: string,
  ) {
    if (!this.isValidToken(token)) {
      this.logger.warn('Asaas webhook received with invalid token');
      throw new UnauthorizedException();
    }

    const eventId = body?.id ?? body?.payment?.id ?? body?.transfer?.id;
    if (!eventId) return { received: true };

    // Atomic idempotency: INSERT the event first — unique PK rejects duplicates
    try {
      await this.events.insertEvent(eventId, body.event);
    } catch {
      this.logger.warn(`Duplicate Asaas event ignored eventId=${eventId} eventType=${body.event}`);
      return { received: true };
    }

    try {
      if (body.event === ASAAS_EVENT_TYPES.PAYMENT_RECEIVED || body.event === ASAAS_EVENT_TYPES.PAYMENT_CONFIRMED) {
        // Use stored valueBrl from DB — never trust the webhook body amount
        const result = await this.wallet.confirmDeposit(body.payment.id);
        if (result) {
          this.logger.log(`Deposit confirmed userId=${result.userId} paymentId=${body.payment.id}`);
          this.gateway.emitToUser(result.userId, 'deposit_confirmed', {
            valueBrl: body.payment.value,
            balance: result.balance,
          });
        }
      } else if (body.event === ASAAS_EVENT_TYPES.TRANSFER_DONE) {
        this.logger.log(`Withdrawal transfer done transferId=${body.transfer.id}`);
        await this.wallet.confirmWithdrawal(body.transfer.id);
      } else if (body.event === ASAAS_EVENT_TYPES.TRANSFER_FAILED) {
        this.logger.warn(`Withdrawal transfer failed transferId=${body.transfer.id}`);
        await this.wallet.failWithdrawal(body.transfer.id);
      }
    } catch (err) {
      this.logger.error(`Webhook processing error eventId=${eventId} eventType=${body.event}`, err instanceof Error ? err.stack : String(err));
    }

    return { received: true };
  }
}
