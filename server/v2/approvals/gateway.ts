/**
 * The functions Crewing modules call to use the approval engine. Module services import from
 * HERE, never from ../approval-engine directly.
 *
 * Pattern for a flow (see docs/APPROVAL-ENGINE-CREWING.md):
 *   submit:  run the module's own checks first → submitForApproval(req, …)
 *            STARTED          → mark the record "pending approval"
 *            NO_WORKFLOW / DISABLED → keep today's behaviour exactly
 *            ALREADY_PENDING  → tell the user it is already waiting
 *   decide:  if pendingRequestFor(req, …) finds a request → decideApproval(req, …)
 *            (the card's onDecision then applies the result); otherwise today's behaviour.
 */
import type { Request } from "express";
import {
  EngineError,
  type ApprovalEngine,
  type DecideResult,
  type EngineCtx,
  type RequestRow,
  type Scope,
  type SubmitOutcome,
} from "../approval-engine";
import { resolveApprovalActor } from "./actor";
import { currentEngineTenantId } from "./tenantProvider";

let engine: ApprovalEngine | null = null;

export function setCrewingEngine(e: ApprovalEngine | null): void { engine = e; }
export function getCrewingEngine(): ApprovalEngine | null { return engine; }

export class ApprovalUnavailableError extends Error {
  readonly statusCode = 503;
  constructor() { super("The approval engine is not available on this server."); }
}
export class ApprovalActorError extends Error {
  readonly statusCode = 403;
  constructor() { super("Your user or role could not be resolved for approvals."); }
}

function requireEngine(): ApprovalEngine {
  if (!engine) throw new ApprovalUnavailableError();
  return engine;
}

/** Engine context for this request: current tenant + actor from the login token. */
export async function engineCtx(req: Request): Promise<EngineCtx> {
  const actor = await resolveApprovalActor(req);
  if (!actor) throw new ApprovalActorError();
  return { tenantId: currentEngineTenantId(), actor };
}

/** Context for background work inside a tenant context (no signed-in user). */
export function systemEngineCtx(label: string): EngineCtx {
  return { tenantId: currentEngineTenantId(), actor: { userId: `system:${label}`, role: null, userType: null } };
}

export function scopeFor(moduleId: string, screenId: string, actionId = ""): Scope {
  return { moduleId, screenId, actionId };
}

/** Submit a subject for approval. Run the module's own validation BEFORE calling this. */
export async function submitForApproval(
  req: Request,
  input: { scope: Scope; subjectRef: string; subject: unknown; vesselId?: string | null },
): Promise<SubmitOutcome> {
  const e = requireEngine();
  return e.submit(await engineCtx(req), input);
}

/** The pending engine request for a subject, if any. */
export async function pendingRequestFor(req: Request, scope: Scope, subjectRef: string): Promise<RequestRow | null> {
  const e = requireEngine();
  const rows = await e.status(await engineCtx(req), scope, subjectRef);
  return rows.find((r) => r.status === "pending") ?? null;
}

/** Approve or reject the active step as the signed-in user. */
export async function decideApproval(
  req: Request,
  requuid: string,
  decision: "approve" | "reject",
  remarks?: string,
): Promise<DecideResult> {
  const e = requireEngine();
  return e.decide(await engineCtx(req), requuid, { decision, remarks });
}

/** Engine errors carry an HTTP status; modules can pass them straight to the response. */
export function approvalErrorStatus(err: unknown): number | null {
  if (err instanceof EngineError) return err.statusCode;
  if (err instanceof ApprovalUnavailableError || err instanceof ApprovalActorError) return err.statusCode;
  return null;
}
