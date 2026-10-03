import { randomUUID } from "node:crypto";
import { tenantConnectionManager } from "../../../utils/tenantConnectionManager";
import { runInCrewAppTenant } from "../tenantContext";
import { emitCrewSecurityEvent } from "../monitoring/securityEvents";
import { canonicalHash } from "./canonical";
import { commandPolicy, deriveCommandType } from "./commandPolicy";
import { erpCommandRepository, type ErpCommandRow, type PendingRow } from "./commandRepository";
import { getCommandHandler, validateApprovedPayload } from "./handlerRegistry";
import { incrementErpMetric, observeErpProcessingDuration } from "./metrics";

const DEFAULT_MAX_ATTEMPTS = 5;

function safeError(error: unknown): { code: string; summary: string } {
  const candidate = error as any;
  const code = /^[A-Z0-9_]{1,64}$/.test(candidate?.code ?? "") ? candidate.code : "ERP_COMMAND_FAILED";
  // Never persist exception text: validation/database messages can contain approved PII.
  return { code, summary: `ERP command failed (${code})` };
}

function isRetryablePreExecution(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  return ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "57P01", "57P02", "57P03", "53300"].includes(code);
}

function retryAt(attempt: number): Date {
  const base = Math.min(60_000, 1_000 * (2 ** Math.max(0, attempt - 1)));
  return new Date(Date.now() + base + Math.floor(Math.random() * Math.max(1, base / 4)));
}

function logTransition(command: ErpCommandRow, to: string, reasonCode: string): void {
  console.info("[crew-erp-worker]", JSON.stringify({
    commandId: command.commandUuid, commandType: command.commandType,
    tenantPseudonym: canonicalHash(command.domain).slice(0, 16),
    attempt: command.attemptCount, from: command.status, to, reasonCode,
  }));
}

async function reconcile(command: ErpCommandRow, pending: PendingRow, payload: Record<string, unknown>) {
  const handler = getCommandHandler(command.commandType)!;
  const outcome = await handler.reconcile(pending, payload);
  if (outcome === "matches") {
    const authoritative = await handler.loadAuthoritativeState(pending);
    logTransition(command, "applied", "AUTHORITATIVE_STATE_MATCHED");
    incrementErpMetric("erp_command_applied_total", { commandType: command.commandType, result: "APPLIED", reasonCode: "AUTHORITATIVE_STATE_MATCHED" });
    emitCrewSecurityEvent({ event: command.errorCode ? "command_reconciled" : "command_applied", correlationId: command.operationUuid, tenantId: command.domain, resourceType: "erp_command", result: "success", reasonCode: "AUTHORITATIVE_STATE_MATCHED", commandType: command.commandType, attemptCount: command.attemptCount });
    return erpCommandRepository.transition(command, "applied", {
      authoritativeRecordUuid: pending.targetUuid ?? pending.crewUuid,
      authoritativeResultHash: canonicalHash(handler.canonicalizeAuthoritativeState(authoritative, payload)),
      reconciledAt: new Date(), errorCode: null, lastErrorSummary: null,
    });
  }
  const reason = outcome === "missing" ? "AUTHORITATIVE_TARGET_MISSING" : "AMBIGUOUS_AUTHORITATIVE_STATE";
  logTransition(command, "reconciliation_required", reason);
  emitCrewSecurityEvent({ event: "reconciliation_required", tenantId: command.domain, resourceType: "erp_command", result: "warning", reasonCode: reason });
  incrementErpMetric("erp_command_reconciliation_required_total", { commandType: command.commandType, result: "RECONCILIATION_REQUIRED", reasonCode: reason });
  return erpCommandRepository.transition(command, "reconciliation_required", { errorCode: reason });
}

export async function processLeasedCommand(initial: ErpCommandRow & { recoveryMode: "execute" | "verify" }, maxAttempts = DEFAULT_MAX_ATTEMPTS): Promise<ErpCommandRow> {
  const startedAt = Date.now();
  let command: ErpCommandRow = initial;
  const policy = commandPolicy(command.commandType);
  if (!policy.automated) {
    const status = policy.classification === "BLOCKED" ? "blocked" : "manual_reconciliation_required";
    logTransition(command, status, policy.reasonCode);
    incrementErpMetric(status === "blocked" ? "erp_command_blocked_total" : "erp_command_manual_reconciliation_total", { commandType: command.commandType, result: status.toUpperCase(), reasonCode: policy.reasonCode });
    emitCrewSecurityEvent({ event: status === "blocked" ? "command_blocked" : "command_manual_reconciliation_required", correlationId: command.operationUuid, tenantId: command.domain, resourceType: "erp_command", result: "warning", reasonCode: policy.reasonCode, commandType: command.commandType, attemptCount: command.attemptCount });
    return erpCommandRepository.transition(command, status, { errorCode: policy.reasonCode });
  }

  const pending = await erpCommandRepository.loadPending(command);
  if (!pending) return erpCommandRepository.transition(command, "dead_letter", { errorCode: "APPROVED_SNAPSHOT_MISSING" });
  if (deriveCommandType(pending.section, pending.action) !== command.commandType) {
    return erpCommandRepository.transition(command, "blocked", { errorCode: "COMMAND_TYPE_MISMATCH" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = validateApprovedPayload(command.commandType, JSON.parse(pending.payload || "{}"));
    if (command.approvedPayloadHash && canonicalHash(payload) !== command.approvedPayloadHash) {
      return erpCommandRepository.transition(command, "blocked", { errorCode: "APPROVED_PAYLOAD_HASH_MISMATCH" });
    }
    const handler = getCommandHandler(command.commandType)!;
    await handler.validateTarget(pending);
    if (initial.recoveryMode === "verify") return reconcile(command, pending, payload);

    const current = await handler.loadAuthoritativeState(pending);
    if (handler.compare(payload, current)) {
      command = await erpCommandRepository.transition(command, "verifying");
      return reconcile(command, pending, payload);
    }

    command = await erpCommandRepository.transition(command, "applying");
    try { await handler.execute(pending, payload); }
    catch (error) {
      const safe = safeError(error);
      command = await erpCommandRepository.transition(command, "verifying", { errorCode: safe.code, lastErrorSummary: safe.summary });
      return reconcile(command, pending, payload);
    }
    command = await erpCommandRepository.transition(command, "verifying");
    return reconcile(command, pending, payload);
  } catch (error) {
    const safe = safeError(error);
    const exhausted = command.attemptCount >= maxAttempts;
    const terminal = command.status === "leased" && isRetryablePreExecution(error) && !exhausted
      ? "retryable" : "dead_letter";
    const errorCode = exhausted && isRetryablePreExecution(error) ? "MAX_ATTEMPTS_EXCEEDED" : safe.code;
    logTransition(command, terminal, errorCode);
    emitCrewSecurityEvent({ event: "erp_command_failure", tenantId: command.domain, resourceType: "erp_command", result: "failed", reasonCode: safe.code });
    incrementErpMetric(terminal === "retryable" ? "erp_command_retry_total" : "erp_command_dead_letter_total", { commandType: command.commandType, result: terminal.toUpperCase(), reasonCode: errorCode });
    emitCrewSecurityEvent({ event: terminal === "retryable" ? "command_retry_scheduled" : "command_dead_letter", correlationId: command.operationUuid, tenantId: command.domain, resourceType: "erp_command", result: terminal === "retryable" ? "warning" : "failed", reasonCode: errorCode, commandType: command.commandType, attemptCount: command.attemptCount });
    return erpCommandRepository.transition(command, terminal, {
      errorCode, lastErrorSummary: safe.summary,
      ...(terminal === "retryable" ? { nextAttemptAt: retryAt(command.attemptCount), leaseOwner: null, leaseExpiresAt: null } : {}),
    });
  } finally { observeErpProcessingDuration(Date.now() - startedAt); }
}

export async function processNextForCurrentTenant(workerId = `crew-erp-${randomUUID()}`, leaseSeconds = 60, maxAttempts = DEFAULT_MAX_ATTEMPTS): Promise<ErpCommandRow | undefined> {
  const command = await erpCommandRepository.leaseNext(workerId, leaseSeconds);
  if (!command) return undefined;
  emitCrewSecurityEvent({ event: "command_leased", correlationId: command.operationUuid, tenantId: command.domain, resourceType: "erp_command", result: "success", reasonCode: command.recoveryMode === "verify" ? "RECOVERED_FOR_VERIFICATION" : "LEASE_ACQUIRED", commandType: command.commandType, attemptCount: command.attemptCount });
  return processLeasedCommand(command, maxAttempts);
}

export async function runErpCommandWorkerOnce(): Promise<number> {
  let processed = 0;
  if (tenantConnectionManager.isMultiTenantEnabled) {
    for (const tuid of await tenantConnectionManager.getActiveTenants()) {
      await tenantConnectionManager.runInTenantContext(tuid, async () => {
        while (await processNextForCurrentTenant()) processed++;
      });
    }
    return processed;
  }
  const domain = process.env.CREW_APP_SINGLE_TENANT_DOMAIN;
  if (!domain) throw new Error("CREW_APP_SINGLE_TENANT_DOMAIN is required to run ERP commands");
  await runInCrewAppTenant(domain, async () => { while (await processNextForCurrentTenant()) processed++; });
  return processed;
}
