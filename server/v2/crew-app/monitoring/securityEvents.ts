import { createHmac } from "node:crypto";

export type CrewSecurityEventName =
  | "login_failure" | "account_lockout" | "refresh_token_reuse" | "session_revoke"
  | "authorization_deny" | "ownership_deny" | "tenant_mismatch" | "cross_tenant_attempt"
  | "suspicious_enumeration" | "file_rejection" | "malware_detection"
  | "approval" | "rejection" | "erp_command_failure" | "reconciliation_required"
  | "command_leased" | "command_applied" | "command_reconciled" | "command_retry_scheduled"
  | "command_manual_reconciliation_required" | "command_blocked" | "command_dead_letter"
  | "privacy_request_transition" | "mfa_enabled";

export interface CrewSecurityEventInput {
  event: CrewSecurityEventName;
  correlationId?: string | null;
  actorId?: string | number | null;
  tenantId?: string | null;
  resourceType?: string | null;
  result: "success" | "denied" | "failed" | "warning";
  reasonCode: string;
  commandType?: string | null;
  attemptCount?: number | null;
}

export interface CrewSecurityEvent {
  timestamp: string;
  correlationId: string | null;
  actorPseudonym: string | null;
  tenantPseudonym: string | null;
  event: CrewSecurityEventName;
  resourceType: string | null;
  result: CrewSecurityEventInput["result"];
  reasonCode: string;
  commandType: string | null;
  attemptCount: number | null;
}

export interface CrewSecurityAlert {
  timestamp: string;
  alert: "repeated_login_failure" | "refresh_replay" | "tenant_violation" | "malware" | "authorization_anomaly" | "erp_backlog";
  event: CrewSecurityEvent;
  count: number;
}

export type SecurityEventSink = (event: CrewSecurityEvent) => void | Promise<void>;
export type SecurityAlertSink = (alert: CrewSecurityAlert) => void | Promise<void>;

const eventSinks = new Set<SecurityEventSink>();
const alertSinks = new Set<SecurityAlertSink>();
const counters = new Map<string, { count: number; startedAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;

function pseudonym(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const key = process.env.CREW_APP_SECURITY_EVENT_KEY || "development-only-security-event-key";
  return createHmac("sha256", key).update(String(value)).digest("hex").slice(0, 20);
}

function safeCode(value: string): string {
  return /^[a-z0-9_.-]{1,64}$/i.test(value) ? value : "invalid_reason_code";
}

function dispatchAlert(alert: CrewSecurityAlert): void {
  for (const sink of alertSinks) Promise.resolve(sink(alert)).catch(() => undefined);
}

function evaluateAlerts(event: CrewSecurityEvent): void {
  const immediate: Partial<Record<CrewSecurityEventName, CrewSecurityAlert["alert"]>> = {
    refresh_token_reuse: "refresh_replay",
    tenant_mismatch: "tenant_violation",
    cross_tenant_attempt: "tenant_violation",
    malware_detection: "malware",
    reconciliation_required: "erp_backlog",
  };
  const immediateAlert = immediate[event.event];
  if (immediateAlert) dispatchAlert({ timestamp: event.timestamp, alert: immediateAlert, event, count: 1 });

  if (event.event !== "login_failure" && event.event !== "authorization_deny" && event.event !== "ownership_deny") return;
  const now = Date.now();
  const key = `${event.event}:${event.tenantPseudonym ?? "unknown"}:${event.actorPseudonym ?? "unknown"}`;
  const prior = counters.get(key);
  const current = !prior || now - prior.startedAt > WINDOW_MS ? { count: 1, startedAt: now } : { ...prior, count: prior.count + 1 };
  counters.set(key, current);
  if (current.count === 5) {
    dispatchAlert({
      timestamp: event.timestamp,
      alert: event.event === "login_failure" ? "repeated_login_failure" : "authorization_anomaly",
      event,
      count: current.count,
    });
  }
}

export function emitCrewSecurityEvent(input: CrewSecurityEventInput): CrewSecurityEvent {
  const event: CrewSecurityEvent = {
    timestamp: new Date().toISOString(),
    correlationId: input.correlationId ?? null,
    actorPseudonym: pseudonym(input.actorId),
    tenantPseudonym: pseudonym(input.tenantId),
    event: input.event,
    resourceType: input.resourceType ? safeCode(input.resourceType) : null,
    result: input.result,
    reasonCode: safeCode(input.reasonCode),
    commandType: input.commandType ? safeCode(input.commandType) : null,
    attemptCount: Number.isInteger(input.attemptCount) && input.attemptCount! >= 0 ? input.attemptCount! : null,
  };
  if (eventSinks.size === 0) console.info(`[crew-security] ${JSON.stringify(event)}`);
  for (const sink of eventSinks) Promise.resolve(sink(event)).catch(() => undefined);
  evaluateAlerts(event);
  return event;
}

export function registerCrewSecurityEventSink(sink: SecurityEventSink): () => void {
  eventSinks.add(sink);
  return () => eventSinks.delete(sink);
}

export function registerCrewSecurityAlertSink(sink: SecurityAlertSink): () => void {
  alertSinks.add(sink);
  return () => alertSinks.delete(sink);
}

export function resetCrewSecurityMonitoringForTests(): void {
  eventSinks.clear(); alertSinks.clear(); counters.clear();
}
