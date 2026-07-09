import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

/** Idempotency table — one row per processed Asaas webhook event */
@Entity('asaas_events')
export class AsaasEvent {
  @PrimaryColumn({ name: 'asaas_event_id', type: 'varchar', length: 100 })
  asaasEventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 50 })
  eventType: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
