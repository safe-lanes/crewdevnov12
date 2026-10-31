/**
 * Live-data area (Part B4): rotation plans waiting for approval — Sahil's decision of 29-Oct-2026.
 *
 * One base row = ONE plan (rotation_drafts_v2). CODE (rotationDraftsService.getProposals): waiting = plan status Proposed or
 * Partially Approved; approval is recorded per entry (rotation_entries_v2.proposal_status: Pending = waiting, Deployed = approved,
 * Rejected). Drafts = In Draft. Company-wide. 'For me' (31-Oct-2026): Crewing records no individual approver, so a personal
 * queue cannot be identified and is NOT equated with holding the Rotation right — the company's pending plans are returned with
 * personalQueue { identifiable: false, statement }, and the assistant appends that statement verbatim.
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { DEFINITIONS, dateOf, vesselNameOf } from "./definitions";
import { inList, num, pagingSchema, resolveVesselNames, runArea, type AreaQuery, type ToolContext } from "./common";
import type { Query } from "../repositories/assistantDataRepository";

export const rotationArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("list"),
    groupBy: z.array(z.enum(["status", "vesselName"])).min(1).max(1).optional(),
    /** waiting (default) = Proposed / Partially Approved; draft = In Draft; all = every plan not archived */
    status: z.enum(["waiting", "draft", "all"]).default("waiting"),
    /** plans that include this vessel */
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    /** only plans awaiting the asking user's approval (verified identity + Rotation permission) */
    forMe: z.boolean().default(false),
    sort: z.enum(["proposed_desc", "plan_from_asc"]).default("proposed_desc"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
  });
export type RotationArgs = z.infer<typeof rotationArgs>;

const STATUS_CLASS = sql`(CASE WHEN d.plan_status IN ('Proposed', 'Partially Approved') THEN 'waiting' WHEN d.plan_status = 'In Draft' THEN 'draft'
  WHEN d.plan_status IN ('Archived', 'Completed') THEN 'closed' ELSE 'other' END)`;

export async function queryRotation(q: Query, ctx: ToolContext, a: RotationArgs) {
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const notes: string[] = [];
  const personalQueue = a.forMe
    ? { identifiable: false, statement: "Crewing does not record an individual approver for rotation plans, so a personal approval queue cannot be identified. The plans shown are all plans waiting for approval in your company." }
    : undefined;

  const conds: SQL[] = [sql`d.is_deleted = false`];
  if (a.status === "waiting") conds.push(sql`${STATUS_CLASS} = 'waiting'`);
  else if (a.status === "draft") conds.push(sql`${STATUS_CLASS} = 'draft'`);
  else conds.push(sql`${STATUS_CLASS} IN ('waiting', 'draft', 'other')`);
  const planVessels = sql`(SELECT array_remove(array_agg(DISTINCT x), NULL) FROM (
      SELECT dv.vessel_uuid AS x FROM rotation_draft_vessels_v2 dv WHERE dv.draft_uuid = d.draft_uuid AND dv.is_deleted = false
      UNION SELECT e.vessel_uuid FROM rotation_entries_v2 e WHERE e.draft_uuid = d.draft_uuid AND e.is_deleted = false) v)`;
  if (vessels) conds.push(sql`${planVessels} && ARRAY[${sql.join(vessels.map((v) => sql`${v.vesselId}`), sql`, `)}]::text[]`);

  const entryCount = (cond: SQL) => sql`(SELECT count(*)::int FROM rotation_entries_v2 e WHERE e.draft_uuid = d.draft_uuid AND e.is_deleted = false AND ${cond})`;
  const proposedBy = sql`(SELECT COALESCE(NULLIF(btrim(mu.fullname), ''), NULLIF(btrim(mu.display_name), '')) FROM master_users mu WHERE mu.user_uuid = d.proposed_by_uuid LIMIT 1)`;
  const vesselNames = sql`(SELECT string_agg(DISTINCT ${vesselNameOf(sql`v.x`)}, ' / ') FROM unnest(${planVessels}) AS v(x))`;
  const where = sql`WHERE ${sql.join(conds, sql` AND `)}`;

  const base = sql`SELECT d.draft_uuid AS row_id, NULL::text AS crew_uuid, d.draft_id AS plan_id, d.plan_status, ${STATUS_CLASS} AS status_class,
      ${dateOf(sql`d.plan_from_date`)} AS plan_from, ${dateOf(sql`d.plan_to_date`)} AS plan_to, ${dateOf(sql`d.proposed_date`)} AS proposed_on,
      ${proposedBy} AS proposed_by_name, ${vesselNames} AS vessel_names,
      ${entryCount(sql`TRUE`)} AS entries_total, ${entryCount(sql`e.proposal_status = 'Pending'`)} AS entries_waiting,
      ${entryCount(sql`e.proposal_status = 'Deployed'`)} AS entries_approved, ${entryCount(sql`e.proposal_status = 'Rejected'`)} AS entries_rejected
    FROM rotation_drafts_v2 d ${where}`;

  const area: AreaQuery = {
    base,
    rowUnit: "plans",
    rowColumns: [
      ["planId", sql`b.plan_id`], ["status", sql`b.plan_status`], ["statusClass", sql`b.status_class`],
      ["planFromDate", sql`to_char(b.plan_from, 'YYYY-MM-DD')`], ["planToDate", sql`to_char(b.plan_to, 'YYYY-MM-DD')`],
      ["proposedByName", sql`b.proposed_by_name`], ["proposedOn", sql`to_char(b.proposed_on, 'YYYY-MM-DD')`], ["vesselNames", sql`b.vessel_names`],
      ["entriesTotal", sql`b.entries_total`], ["entriesWaiting", sql`b.entries_waiting`], ["entriesApproved", sql`b.entries_approved`], ["entriesRejected", sql`b.entries_rejected`],
    ],
    personColumns: [["planId", sql`min(b.plan_id)`], ["crewId", sql`b.crew_uuid`]],
    rowSort: a.sort === "plan_from_asc" ? sql`b.plan_from ASC NULLS LAST, b.plan_id` : sql`b.proposed_on DESC NULLS LAST, b.plan_id`,
    personSort: sql`min(b.plan_id)`,
    groupKeys: { status: sql`b.status_class`, vesselName: sql`b.vessel_names` },
  };
  const result = await runArea(q, area, { ...a, unit: "plans" });
  const [s] = await q(sql`SELECT count(*) FILTER (WHERE ${STATUS_CLASS} = 'waiting')::int AS waiting, count(*) FILTER (WHERE ${STATUS_CLASS} = 'draft')::int AS drafts
    FROM rotation_drafts_v2 d WHERE d.is_deleted = false${vessels ? sql` AND ${planVessels} && ARRAY[${sql.join(vessels.map((v) => sql`${v.vesselId}`), sql`, `)}]::text[]` : sql``}`);

  return {
    ok: true as const,
    area: "rotation",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: "plans",
    query: { ...a, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    definitions: [DEFINITIONS.rotation, DEFINITIONS.dates],
    ...result,
    summary: { waiting: num(s?.waiting), drafts: num(s?.drafts) },
    ...(personalQueue ? { personalQueue } : {}),
    ...(notes.length ? { notes } : {}),
  };
}
