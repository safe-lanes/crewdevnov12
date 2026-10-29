import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Request } from "express";
import { getDb } from "../../db";
import { presentAccessAudit, type AccessAuditEntry } from "../../../../shared/v2/admin/accessAuditPresentation";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const querySchema = z.object({
  page: z.coerce.number().int().min(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
  filter: z.enum(["all", "management", "void_completed", "parent_sync"]).default("all"),
  roleId: z.string().optional(), from: day.optional(), to: day.optional(), search: z.string().max(250).default(""),
}).refine(value => !value.from || !value.to || value.from <= value.to);

/** Read-time enrichment only. Audit records and capture remain untouched. */
export async function readAccessAuditPage(req: Request) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw Object.assign(new Error("Choose valid dates and a valid audit history page."), { status: 400 });
  const q = parsed.data;
  const condition = q.filter === "management" ? sql`a.resource='access_control' AND a.action='manage'` :
    q.filter === "void_completed" ? sql`a.resource='company_forms' AND a.action='void_completed'` :
    q.filter === "parent_sync" ? sql`a.event LIKE 'parent_sync%'` : sql`true`;
  const role = q.roleId ? sql`AND a.role_id=${q.roleId}` : sql``;
  const from = q.from ? sql`AND a.recorded_at >= ${`${q.from}T00:00:00Z`}::timestamptz` : sql``;
  const to = q.to ? sql`AND a.recorded_at < ${`${q.to}T00:00:00Z`}::timestamptz + interval '1 day'` : sql``;
  // Search the same sentences the user sees, including resolved names, not JSON.
  // Read in bounded batches, keeping only the requested page in memory.
  const items: Array<AccessAuditEntry & { sentence: string }> = [];
  const unmapped = new Set<string>();
  let cursor: string | undefined, total = 0;
  const needle = q.search.trim().toLocaleLowerCase("en-GB");
  for (;;) {
    const after = cursor ? sql`AND a.id < ${cursor}::bigint` : sql``;
    const rows: AccessAuditEntry[] = (await getDb().execute(sql`
      SELECT a.*, coalesce(nullif(u.fullname,''),nullif(u.display_name,''),
        nullif(trim(concat_ws(' ',u.firstname,u.lastname)),'')) AS actor_name,
        r.assigned_role AS role_name, coalesce(nullif(m.display_name,''),m.name) AS menu_name
      FROM adm_access_control_audit a
      LEFT JOIN master_users u ON u.id::text=a.actor->>'masterUserId'
      LEFT JOIN adm_rolemaster_ac r ON r.ruid=a.role_id
      LEFT JOIN adm_menumaster_ac m ON m.muid=substring(a.resource from 6) AND a.resource LIKE 'menu:%'
      WHERE ${condition} ${role} ${from} ${to} ${after}
      ORDER BY a.id DESC LIMIT 250`)).rows as AccessAuditEntry[];
    for (const row of rows) {
      const presentation = presentAccessAudit(row);
      presentation.unmapped.forEach(key => unmapped.add(key));
      if (needle && !presentation.sentence.toLocaleLowerCase("en-GB").includes(needle)) continue;
      if (total >= (q.page - 1) * q.pageSize && items.length < q.pageSize) items.push({ ...row, sentence: presentation.sentence });
      total++;
    }
    if (rows.length < 250) break;
    cursor = String(rows[rows.length - 1].id);
  }
  return { items, total, page: q.page, pageSize: q.pageSize, unmappedKeys: [...unmapped] };
}
