import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { AsaasEvent } from './entities/asaas-event.entity';
import { WalletModule } from '../wallet/wallet.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AsaasEvent]),
    WalletModule,
    GameModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksRepository],
})
export class WebhooksModule {}
