import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { getErpWorkerConfig, type ErpWorkerConfig } from "../../../config/productionConfig";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { runInCrewAppTenant } from "../tenantContext";
import { erpCommandRepository } from "./commandRepository";
import { processNextForCurrentTenant } from "./worker";
import { getErpMetricsSnapshot, setErpQueueGauges } from "./metrics";
import { emitCrewSecurityEvent } from "../monitoring/securityEvents";

export interface WorkerHealth {
  enabled: boolean; running: boolean; stopping: boolean; workerId: string;
  lastSuccessfulPoll: string | null; lastCommandProcessedAt: string | null;
  activeCommandCount: number; lastPollErrorCode: string | null;
}

const instance = createHash("sha256").update(hostname()).digest("hex").slice(0, 10);

export class ErpCommandWorkerSupervisor {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private config: ErpWorkerConfig | null = null;
  private active = new Set<Promise<unknown>>();
  private lastAgingAlertAt = 0;
  private health: WorkerHealth = { enabled: false, running: false, stopping: false, workerId: `erp-${instance}-${randomUUID().slice(0,8)}`, lastSuccessfulPoll: null, lastCommandProcessedAt: null, activeCommandCount: 0, lastPollErrorCode: null };

  start(config = getErpWorkerConfig()): void {
    if (this.health.running) return;
    this.config = config; this.health.enabled = config.enabled;
    if (!config.enabled) return;
    this.health.running = true; this.health.stopping = false;
    this.schedule(0);
  }

  private schedule(delay: number): void {
    if (!this.health.running || this.health.stopping) return;
    this.timer = setTimeout(async () => {
      try { await this.pollOnce(); this.health.lastSuccessfulPoll = new Date().toISOString(); this.health.lastPollErrorCode = null; }
      catch { this.health.lastPollErrorCode = "POLL_FAILED"; }
      finally { if (!this.health.stopping) this.schedule(this.config!.pollIntervalMs); }
    }, delay);
    this.timer.unref?.();
  }

  async pollOnce(): Promise<number> {
    const config = this.config ?? getErpWorkerConfig();
    if (this.health.stopping) return 0;
    let processed = 0;
    const processTenant = async (run: <T>(callback: () => Promise<T>) => Promise<T>) => {
      await run(async () => {
        const runners = Array.from({ length: config.concurrency }, async (_, slot) => {
          while (!this.health.stopping && processed < config.batchSize) {
            const reservation = processed; processed++;
            if (reservation >= config.batchSize) { processed--; break; }
            const task = processNextForCurrentTenant(`${this.health.workerId}-${slot}`, config.leaseSeconds, config.maxAttempts);
            this.active.add(task); this.health.activeCommandCount = this.active.size;
            try { const result = await task; if (!result) { processed--; break; } this.health.lastCommandProcessedAt = new Date().toISOString(); }
            finally { this.active.delete(task); this.health.activeCommandCount = this.active.size; }
          }
        });
        await Promise.all(runners);
      });
    };
    if (tenantConnectionManager.isMultiTenantEnabled) {
      for (const tuid of await tenantConnectionManager.getActiveTenants()) {
        if (this.health.stopping || processed >= config.batchSize) break;
        await processTenant(callback => tenantConnectionManager.runInTenantContext(tuid, callback));
      }
    } else {
      const domain = process.env.CREW_APP_SINGLE_TENANT_DOMAIN;
      if (!domain) throw new Error("CREW_APP_SINGLE_TENANT_DOMAIN is required");
      await processTenant(callback => runInCrewAppTenant(domain, () => callback()));
    }
    const queue = await this.collectQueueStats();
    setErpQueueGauges({queueDepth:queue.queue_depth??0,oldestAge:queue.oldest_queued_age_seconds??0,activeLeases:queue.active_leases??0});
    if ((queue.stale_queue_count??0)>0 || (queue.expired_lease_count??0)>0 || (queue.reconciliation_required_count??0)>0 || (queue.dead_letter_count??0)>0) {
      if(Date.now()-this.lastAgingAlertAt>60_000){this.lastAgingAlertAt=Date.now();emitCrewSecurityEvent({event:"reconciliation_required",resourceType:"erp_command_queue",result:"warning",reasonCode:"ERP_QUEUE_BACKLOG"});}
    }
    return processed;
  }

  async stop(): Promise<void> {
    this.health.stopping = true; this.health.running = false;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    await Promise.allSettled([...this.active]);
    this.health.activeCommandCount = 0;
  }

  getHealth(): WorkerHealth { return { ...this.health }; }

  private async collectQueueStats(): Promise<Record<string,number>> {
    const totals:Record<string,number>={};const collect=async()=>{const stats=await erpCommandRepository.queueStats();for(const [key,value] of Object.entries(stats))totals[key]=(totals[key]??0)+Number(value??0);};
    if(tenantConnectionManager.isMultiTenantEnabled)for(const tuid of await tenantConnectionManager.getActiveTenants())await tenantConnectionManager.runInTenantContext(tuid,collect);else{const domain=process.env.CREW_APP_SINGLE_TENANT_DOMAIN;if(domain)await runInCrewAppTenant(domain,collect);}return totals;
  }

  async getOperationalHealth() {
    const totals=await this.collectQueueStats();
    return { worker: this.getHealth(), queue: totals, metrics: getErpMetricsSnapshot() };
  }
}

export const erpCommandWorkerSupervisor = new ErpCommandWorkerSupervisor();
