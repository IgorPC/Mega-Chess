import { Injectable } from '@nestjs/common';
import { PlatformConfigService } from '../../platform-config/platform-config.service';
import { AdminAuditService } from '../admin-audit.service';
import { AdminUser } from '../../entities/admin-user.entity';
import { AdminMaintenanceRepository } from './admin-maintenance.repository';
import {
  ADMIN_MAINTENANCE_ASAAS_STATUS_TIMEOUT_MS,
  ADMIN_MAINTENANCE_ASAAS_STATUS_URL,
  ADMIN_MAINTENANCE_CONFIG_KEY_MAP,
  ADMIN_MAINTENANCE_CONFIG_REVERSE_KEY_MAP,
} from './consts/endpoints';

export interface AppMetricsDto {
  cpuUsage: number;
  memoryUsageMb: number;
  requestsPerSecond: number;
  errorsPerHour: number;
  activeGames: number;
  wsConnections: number;
  uptimeSeconds: number;
  dbSizeMb: number;
  requestsHistory: null;
}

@Injectable()
export class AdminMaintenanceService {
  private requestCount = 0;
  private errorCount = 0;
  private wsCount = 0;
  private activeGames = 0;

  constructor(
    private readonly repo: AdminMaintenanceRepository,
    private readonly platformConfig: PlatformConfigService,
    private readonly audit: AdminAuditService,
  ) {}

  // Called by game gateway to track metrics
  setActiveGames(n: number) { this.activeGames = n; }
  setWsConnections(n: number) { this.wsCount = n; }
  incrementRequests() { this.requestCount++; }
  incrementErrors() { this.errorCount++; }

  async metrics(): Promise<AppMetricsDto> {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const dbSizeBytes = await this.repo.getDbSizeBytes();

    return {
      cpuUsage: Math.round((cpu.user + cpu.system) / 1_000_000 / process.uptime() * 100) / 100,
      memoryUsageMb: Math.round(mem.heapUsed / 1024 / 1024),
      requestsPerSecond: Math.round(this.requestCount / Math.max(process.uptime(), 1) * 10) / 10,
      errorsPerHour: this.errorCount,
      activeGames: this.activeGames,
      wsConnections: this.wsCount,
      uptimeSeconds: Math.round(process.uptime()),
      dbSizeMb: Math.round(dbSizeBytes / 1024 / 1024),
      requestsHistory: null,
    };
  }

  async logs(limit = 50) {
    // Return recent error logs from a simple in-memory buffer or query platform_configs
    // For a real system, query a system_logs table; here we return an empty array
    // to avoid circular dependencies with the logger
    return [];
  }

  async getConfig() {
    const rows = await this.repo.findAllConfig();
    const result: Record<string, string | boolean | number> = {};
    for (const r of rows) {
      const camelKey = ADMIN_MAINTENANCE_CONFIG_REVERSE_KEY_MAP[r.key] ?? r.key;
      if (r.value === 'true' || r.value === 'false') result[camelKey] = r.value === 'true';
      else if (!isNaN(Number(r.value)) && r.value !== '') result[camelKey] = Number(r.value);
      else result[camelKey] = r.value;
    }
    return result;
  }

  async updateConfig(cfg: Record<string, string | boolean | number>, admin: Pick<AdminUser, 'id' | 'name'>) {
    for (const [key, value] of Object.entries(cfg)) {
      const dbKey = ADMIN_MAINTENANCE_CONFIG_KEY_MAP[key] ?? key;
      await this.platformConfig.set(dbKey, String(value));
    }
    this.audit.log(admin, 'CONFIG_UPDATED', { details: JSON.stringify(cfg) });
  }

  async asaasStatus() {
    const start = Date.now();
    try {
      const res = await fetch(ADMIN_MAINTENANCE_ASAAS_STATUS_URL, {
        headers: { access_token: process.env.ASAAS_API_KEY ?? '' },
        signal: AbortSignal.timeout(ADMIN_MAINTENANCE_ASAAS_STATUS_TIMEOUT_MS),
      });
      return { ok: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async broadcast(message: string, type: string) {
    // The game gateway handles WS broadcasting
    // Emit via a custom event that the gateway subscribes to
    (process as unknown as NodeJS.EventEmitter).emit('admin:broadcast', { message, type });
  }

  async flushRedis() {
    // Redis client is internal to modules — emit event for RedisService to handle
    (process as unknown as NodeJS.EventEmitter).emit('admin:redis_flush', {});
  }

  async aiUsageLogs(page = 1, limit = 25) {
    const { data, total } = await this.repo.findAndCountAiUsageLogs(page, limit);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }
}
