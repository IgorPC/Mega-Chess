import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AsaasService } from './asaas.service';
import { AsaasRepository } from './asaas.repository';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [AsaasService, AsaasRepository],
  exports: [AsaasService],
})
export class AsaasModule {}
