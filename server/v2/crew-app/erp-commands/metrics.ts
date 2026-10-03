type CounterName = "erp_command_queued_total" | "erp_command_applied_total" | "erp_command_blocked_total" |
  "erp_command_manual_reconciliation_total" | "erp_command_reconciliation_required_total" |
  "erp_command_dead_letter_total" | "erp_command_retry_total";

const counters = new Map<string, number>();
const durations: number[] = [];
const gauges = { erp_command_queue_depth: 0, erp_command_oldest_age: 0, erp_command_active_leases: 0 };
const safe = (value: string | undefined, fallback = "unknown") => /^[A-Z0-9_]{1,64}$/.test(value ?? "") ? value! : fallback;
const key = (name: string, labels: Record<string,string>) => `${name}|${Object.entries(labels).sort().map(([k,v])=>`${k}=${v}`).join(",")}`;

export function incrementErpMetric(name: CounterName, labels: { commandType?: string; result?: string; reasonCode?: string } = {}): void {
  const bounded = { command_type: safe(labels.commandType), result: safe(labels.result), reason_code: safe(labels.reasonCode) };
  const metricKey = key(name, bounded); counters.set(metricKey, (counters.get(metricKey) ?? 0) + 1);
}
export function observeErpProcessingDuration(milliseconds: number): void { durations.push(Math.max(0, Math.round(milliseconds))); if (durations.length > 1000) durations.shift(); }
export function setErpQueueGauges(values:{queueDepth:number;oldestAge:number;activeLeases:number}) { gauges.erp_command_queue_depth=values.queueDepth;gauges.erp_command_oldest_age=values.oldestAge;gauges.erp_command_active_leases=values.activeLeases; }
export function getErpMetricsSnapshot() { return { counters: Object.fromEntries(counters), gauges:{...gauges}, processingDurationMs: { count: durations.length, max: durations.length ? Math.max(...durations) : 0, average: durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length) : 0 } }; }
export function resetErpMetricsForTests(): void { counters.clear(); durations.length = 0; }
