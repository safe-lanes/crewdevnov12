import type { Request } from "express";
import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { resolveRequestRole, type ResolvedRole } from "../../auth/roleResolutionService";

export class AccessControlError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
export const normalizeRole = (value: string) => value.trim().toLowerCase();
const interimNames = new Set(["admin", "super admin", "sail admin"]);
export type AuditActor = { masterUserId: number; roleId?: string; roleName?: string; userType: string; source: string;
  /** Server-derived snapshot, never copied from a request body. */
  displayName?: string | null };
export async function lockAccessControl(tx: any) {
  // Database-local key: one lock per tenant DB, shared by all grant writes and parent sync.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(382, 1)`);
}
export async function managementSnapshot(tx: any) {
  const roles = (await tx.execute(sql`SELECT r.ruid, r.assigned_role, r.roletype, r.is_active,
    r.is_deleted, r.parent_owned,
    (SELECT g.allowed FROM adm_resource_action_grants g WHERE g.role_id=r.ruid
      AND g.resource='access_control' AND g.action='manage') AS decision
    FROM adm_rolemaster_ac r`)).rows as any[];
  const names = new Map<string, number>();
  for (const r of roles) if (r.is_active && !r.is_deleted)
    names.set(normalizeRole(r.assigned_role), (names.get(normalizeRole(r.assigned_role)) ?? 0) + 1);
  const grantTargets = roles.filter(r => r.parent_owned && r.is_active && !r.is_deleted
    && names.get(normalizeRole(r.assigned_role)) === 1);
  // A UUID with an allowed decision is not a usable manager unless a persisted
  // trusted user can actually resolve it. Renames must not strand that user.
  const users = (await tx.execute(sql`SELECT role FROM master_users
    WHERE NULLIF(btrim(user_type),'') IS NOT NULL`)).rows as { role: string | null }[];
  const principalNames = new Set(users.map(u => normalizeRole(u.role ?? "")));
  const eligible = grantTargets.filter(r => principalNames.has(normalizeRole(r.assigned_role)));
  const state = (await tx.execute(sql`SELECT category_ready FROM adm_access_control_state WHERE singleton=true`)).rows[0];
  if (!state) throw new Error("Access Control storage upgrade required.");
  return { roles, grantTargets, eligible, categoryReady: state.category_ready === true,
    eligibleManagerCount: eligible.filter(r => r.decision === true).length };
}
export function trustedRecoveryRoleIds(snapshot: Awaited<ReturnType<typeof managementSnapshot>>): string[] {
  return snapshot.eligible.filter(r => snapshot.categoryReady ?
    normalizeRole(r.roletype) === "sail admin" : interimNames.has(normalizeRole(r.assigned_role)))
    .map(r => r.ruid);
}
export function authorityFor(role: ResolvedRole | undefined, snapshot: Awaited<ReturnType<typeof managementSnapshot>>) {
  const eligible = role && snapshot.eligible.find(r => r.ruid === role.roleId);
  let mode = "denied";
  if (eligible?.decision === true) mode = "management";
  // EXACT interim fallback: successful trusted resolution, no category readiness, zero eligible managers, whitelist.
  else if (eligible && snapshot.eligibleManagerCount === 0 && !snapshot.categoryReady
    && interimNames.has(normalizeRole(eligible.assigned_role))) mode = "name_bootstrap";
  else if (eligible && snapshot.eligibleManagerCount === 0 && snapshot.categoryReady
    && normalizeRole(eligible.roletype) === "sail admin") mode = "category_recovery";
  return { allowed: mode !== "denied", mode, eligibleManagerCount: snapshot.eligibleManagerCount,
    categoryReady: snapshot.categoryReady,
    recoveryRoute: snapshot.categoryReady ? "parent_sail_admin" : "interim_names" };
}
export async function accessControlAuthority(req: Request, executor?: any) {
  if (!executor) return getDb().transaction(async (tx: any) => {
    await lockAccessControl(tx);
    return accessControlAuthority(req, tx);
  });
  const tx = executor;
  const resolved = await resolveRequestRole(req, tx);
  return authorityFor(resolved.ok ? resolved.role : undefined, await managementSnapshot(tx));
}
/** Read-only display information; authority and grant-write safeguards are unchanged. */
export async function accessControlDisplayState(req: Request) {
  return getDb().transaction(async (tx: any) => {
    await lockAccessControl(tx);
    const resolved = await resolveRequestRole(req, tx);
    const snapshot = await managementSnapshot(tx);
    return {
      ...authorityFor(resolved.ok ? resolved.role : undefined, snapshot),
      currentRoleId: resolved.ok ? resolved.role.roleId : null,
      // Stored explicit grants are not the same as the eligible-manager count.
      // Do not silently omit a holder because it currently lacks a linked user.
      explicitManagers: snapshot.roles.filter(r => r.decision === true)
        .map(r => ({ roleId: r.ruid as string, roleName: r.assigned_role as string }))
        .sort((a, b) => a.roleName.localeCompare(b.roleName) || a.roleId.localeCompare(b.roleId)),
    };
  });
}
export async function authenticatedActor(req: Request, tx: any): Promise<AuditActor> {
  const resolution = await resolveRequestRole(req, tx);
  if (!resolution.ok) throw new AccessControlError("Trusted authenticated editor unavailable.");
  const r = resolution.role;
  return { masterUserId: r.masterUserId, roleId: r.roleId, roleName: r.roleName,
    userType: r.masterUserType, source: "access_control",
    displayName: await auditActorDisplayName(tx, r.masterUserId) };
}
async function auditActorDisplayName(tx: any, masterUserId: number): Promise<string | null> {
  const result = await tx.execute(sql`SELECT coalesce(nullif(btrim(fullname),''),nullif(btrim(display_name),''),
    nullif(trim(concat_ws(' ',firstname,lastname)),'')) AS name
    FROM master_users WHERE id=${masterUserId}`);
  return result.rows[0]?.name ?? null;
}
export async function appendAudit(tx: any, actor: AuditActor, event: string, roleId: string | null,
  resource: string, action: string, before: unknown, after: unknown, details: unknown = {},
  affectedRoleName?: string | null) {
  // Compare the actual JSON values stored, not key order or object identity.
  // This applies to every event, including internal writers and null/null.
  const beforeJson = JSON.stringify(before ?? null), afterJson = JSON.stringify(after ?? null);
  if (isDeepStrictEqual(JSON.parse(beforeJson), JSON.parse(afterJson))) return;
  // Parent sync snapshots this before replacing users. Other internal writers
  // without a snapshot are resolved here, using this transaction's database.
  const { displayName, ...identifiers } = actor;
  const frozenName = displayName === undefined ? await auditActorDisplayName(tx, actor.masterUserId) : displayName;
  const roleName = roleId ? affectedRoleName === undefined ?
    (await tx.execute(sql`SELECT assigned_role FROM adm_rolemaster_ac WHERE ruid=${roleId}`)).rows[0]?.assigned_role :
    affectedRoleName : null;
  await tx.execute(sql`INSERT INTO adm_access_control_audit
    (event,actor,actor_display_name,role_id,affected_role_name,resource,action,before_value,after_value,details)
    VALUES (${event},${JSON.stringify(identifiers)}::jsonb,
      ${frozenName?.trim() || "A user whose name was not recorded"},${roleId},
      ${roleId ? roleName?.trim() || "a role whose name was not recorded" : null},${resource},${action},
      ${before === null ? null : JSON.stringify(before)}::jsonb,
      ${after === null ? null : JSON.stringify(after)}::jsonb,${JSON.stringify(details)}::jsonb)`);
}
export function protectLastManager(before: number, after: number) {
  if (before > 0 && after === 0)
    throw new AccessControlError("Cannot remove the last eligible Access Control manager.", 409);
}
export async function managedWrite<T>(req: Request, write: (tx: any, actor: AuditActor) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx: any) => {
    await lockAccessControl(tx);
    // Never trust middleware's cached role or a browser authority flag after waiting for the lock.
    const authority = await accessControlAuthority(req, tx);
    if (!authority.allowed) throw new AccessControlError("You do not have permission to manage Access Control.");
    const actor = await authenticatedActor(req, tx);
    const result = await write(tx, actor);
    const after = await managementSnapshot(tx);
    protectLastManager(authority.eligibleManagerCount, after.eligibleManagerCount);
    if (after.eligibleManagerCount === 0 && trustedRecoveryRoleIds(after).length === 0)
      throw new AccessControlError("Cannot remove the last valid trusted Access Control recovery principal.", 409);
    return result;
  });
}
export async function saveActionDecisions(req: Request, roleId: string, resource: string, decisions: Record<string, boolean>) {
  return managedWrite(req, (tx, actor) => writeActionDecisions(tx, actor, roleId, resource, decisions));
}
/** Transaction-scoped writer shared by standalone and atomic role saves. */
export async function writeActionDecisions(tx: any, actor: AuditActor, roleId: string,
  resource: string, decisions: Record<string, boolean>) {
    const snapshot = await managementSnapshot(tx);
    if (!snapshot.grantTargets.some(r => r.ruid === roleId)) throw new AccessControlError("Active eligible parent role not found.", 400);
    for (const [action, allowed] of Object.entries(decisions)) {
      const existing = (await tx.execute(sql`SELECT allowed FROM adm_resource_action_grants
        WHERE role_id=${roleId} AND resource=${resource} AND action=${action}`)).rows[0];
      const before = existing ? existing.allowed : null;
      if (before === allowed) continue;
      await tx.execute(sql`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed,updated_by_uuid)
        VALUES (${roleId},${resource},${action},${allowed},${String(actor.masterUserId)})
        ON CONFLICT(role_id,resource,action) DO UPDATE SET allowed=EXCLUDED.allowed,
          updated_by_uuid=EXCLUDED.updated_by_uuid,updated_at=now()`);
      await appendAudit(tx, actor, "grant_change", roleId, resource, action, before, allowed);
    }
    return decisions;
}
