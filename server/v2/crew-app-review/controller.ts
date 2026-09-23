import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { masterUsers } from "../../../shared/schema";
import { pendingChangesRepository } from "../crew-app/crew-information/pendingChangesRepository";
import { approveChange, rejectChange, type Reviewer } from "../crew-app/crew-information/pendingChangesService";
import { getCurrentValues } from "../crew-app/crew-information/adapters";
import { rejectPendingChangeRequestSchema } from "../../../shared/v2/crew-app/types";
import { crewMembersService } from "../crew-pool/services";
import { resolveMasterNames } from "../crew-pool/services/masterDataResolver";

/** Attaches the submitting crew member's display name/emp no — the raw queue row otherwise only carries crewUuid, which isn't useful for a reviewer deciding what to approve. */
async function withCrewIdentity<T extends { crewUuid: string }>(rows: T[]): Promise<(T & { crewName: string; empNo: string | null })[]> {
  const uniqueUuids = Array.from(new Set(rows.map(r => r.crewUuid)));
  const crews = await Promise.all(uniqueUuids.map(uuid => crewMembersService.getByUuid(uuid).catch(() => null)));
  const byUuid = new Map(uniqueUuids.map((uuid, i) => [uuid, crews[i]]));
  return rows.map(row => {
    const crew: any = byUuid.get(row.crewUuid);
    return {
      ...row,
      crewName: crew ? `${crew.firstName ?? ""} ${crew.familyName ?? ""}`.trim() || row.crewUuid : row.crewUuid,
      empNo: crew?.empNo ?? null,
    };
  });
}

/** Attaches the current field values for the keys in each row's payload, so the office review page can show "previous → new" instead of just the raw submitted values. Computed on read (nothing is persisted) — a lookup failure never breaks the whole list. */
async function withPreviousValues<T extends { section: string; crewUuid: string; targetUuid: string | null; action: string; payload: string }>(rows: T[]): Promise<(T & { previousValues: Record<string, unknown> | null })[]> {
  const previous = await Promise.all(rows.map(async row => {
    if (row.action === "create") return null;
    try {
      const current = await getCurrentValues(row.section, row.crewUuid, row.targetUuid);
      if (!current) return null;
      if (row.action === "delete" || row.section === "vessel-types") return current;
      const payloadKeys = Object.keys(JSON.parse(row.payload || "{}"));
      const narrowed: Record<string, unknown> = {};
      for (const key of payloadKeys) narrowed[key] = current[key];
      return narrowed;
    } catch {
      return null;
    }
  }));
  return rows.map((row, i) => ({ ...row, previousValues: previous[i] }));
}

/** Collects every string value out of a payload/previousValues object, including string-array fields (e.g. vessel-types' `vesselTypeUuids`) — candidates for master-data name resolution below. */
function collectStringValues(obj: Record<string, unknown> | null | undefined, out: string[]): void {
  if (!obj) return;
  for (const value of Object.values(obj)) {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) for (const item of value) if (typeof item === "string") out.push(item);
  }
}

/** Resolves any master-data UUIDs (issuingCountryUuid, nationalityUuid, vesselTypeUuid, etc.) found in each row's payload/previousValues to display names, so the review page never has to show a raw UUID. One batched lookup across all rows in the response. */
async function withResolvedNames<T extends { payload: string; previousValues: Record<string, unknown> | null }>(rows: T[]): Promise<(T & { resolvedNames: Record<string, string> })[]> {
  const candidates: string[] = [];
  for (const row of rows) {
    try { collectStringValues(JSON.parse(row.payload || "{}"), candidates); } catch { /* ignore */ }
    collectStringValues(row.previousValues, candidates);
  }
  const resolvedNames = await resolveMasterNames(candidates);
  return rows.map(row => ({ ...row, resolvedNames }));
}

/** Same office-reviewer lookup pattern as server/v2/interviews/service.ts::savePartC — resolves the authenticated office user's display name for the reviewed_by_* stamp. */
async function resolveReviewer(req: Request): Promise<Reviewer> {
  const userId = req.user!.id;
  const rows = await getDb().select().from(masterUsers).where(eq(masterUsers.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw Object.assign(new Error("Authenticated user not found"), { status: 403 });
  const name = user.fullname ?? user.displayName ??
    (`${user.firstname ?? ""} ${user.lastname ?? ""}`.trim() || null);
  return { uuid: user.userUuid ?? String(user.id), name };
}

function sendError(res: Response, error: any): void {
  const status = typeof error?.status === "number" ? error.status : 500;
  if (status === 500) {
    console.error("[CrewAppReviewController]", error);
    res.status(500).json({ error: "Request failed" });
    return;
  }
  res.status(status).json({ error: error.message });
}

export async function listPending(req: Request, res: Response): Promise<void> {
  try {
    const { status, section, crewUuid } = req.query;
    const rows = await pendingChangesRepository.listForOffice({
      status: typeof status === "string" ? status : "pending",
      section: typeof section === "string" ? section : undefined,
      crewUuid: typeof crewUuid === "string" ? crewUuid : undefined,
    });
    res.json(await withResolvedNames(await withPreviousValues(await withCrewIdentity(rows))));
  } catch (error) {
    sendError(res, error);
  }
}

export async function approve(req: Request, res: Response): Promise<void> {
  try {
    const reviewer = await resolveReviewer(req);
    const result = await approveChange(req.params.pendingUuid, reviewer);
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
}

export async function reject(req: Request, res: Response): Promise<void> {
  try {
    const body = rejectPendingChangeRequestSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "invalid_request", details: body.error.flatten() });
      return;
    }
    const reviewer = await resolveReviewer(req);
    const updated = await rejectChange(req.params.pendingUuid, reviewer, body.data.reason);
    res.json(updated);
  } catch (error) {
    sendError(res, error);
  }
}
