import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Request } from "express";
import { getDb } from "../../db";
import {
  AUDIT_ACTION_LABELS, AUDIT_EVENT_LABELS, presentAccessAudit, type AccessAuditEntry,
} from "../../../../shared/v2/admin/accessAuditPresentation";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const querySchema = z.object({
  page: z.coerce.number().int().min(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
  filter: z.enum(["all", "management", "void_completed", "parent_sync"]).default("all"),
  export: z.literal("all").optional(),
  roleId: z.string().optional(), from: day.optional(), to: day.optional(), search: z.string().max(250).default(""),
}).refine(value => !value.from || !value.to || value.from <= value.to);

const actorName = sql`coalesce(nullif(u.fullname,''),nullif(u.display_name,''),
  nullif(trim(concat_ws(' ',u.firstname,u.lastname)),''))`;
const menuName = sql`coalesce(nullif(m.display_name,''),m.name)`;
const menuJoin = sql`LEFT JOIN adm_menumaster_ac m
  ON m.muid=substring(a.resource from 6) AND left(a.resource,5)='menu:'`;
const nameJoins = sql`LEFT JOIN master_users u ON u.id::text=a.actor->>'masterUserId'
  LEFT JOIN adm_rolemaster_ac r ON r.ruid=a.role_id ${menuJoin}`;

function literalContains(value: string) {
  return `%${value.replace(/[!%_]/g, "!$&")}%`;
}

/** Keep the exact totals and the page in a single database snapshot. */
export async function readAccessAuditPage(req: Request, db = getDb()) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) throw Object.assign(new Error("Choose valid dates and a valid audit history page."), { status: 400 });
  const q = parsed.data;
  const condition = q.filter === "management" ? sql`a.resource='access_control' AND a.action='manage'` :
    q.filter === "void_completed" ? sql`a.resource='company_forms' AND a.action='void_completed'` :
    q.filter === "parent_sync" ? sql`a.event LIKE 'parent_sync%'` : sql`true`;
  const role = q.roleId ? sql`AND a.role_id=${q.roleId}` : sql``;
  const from = q.from ? sql`AND a.recorded_at >= ${`${q.from}T00:00:00Z`}::timestamptz` : sql``;
  const to = q.to ? sql`AND a.recorded_at < ${`${q.to}T00:00:00Z`}::timestamptz + interval '1 day'` : sql``;
  const needle = q.search.trim().toLocaleLowerCase("en-GB");
  const pattern = literalContains(needle);
  const actions = JSON.stringify(AUDIT_ACTION_LABELS);
  const events = JSON.stringify(AUDIT_EVENT_LABELS);
  const roleLabel = sql`coalesce(nullif(adm_audit_trim(a.affected_role_name),''),r.assigned_role)`;
  const capturedMenu = sql`CASE WHEN jsonb_typeof(a.details->'menuName')='string'
    THEN adm_audit_safe_label(a.details->>'menuName') END`;
  const liveLabels = needle ? sql`, live_menus AS MATERIALIZED (
    SELECT m.muid, adm_audit_fold(adm_audit_safe_label(${menuName})) AS label FROM adm_menumaster_ac m
  ), live_labels AS MATERIALIZED (
    SELECT a.id, a.event, coalesce(nullif(adm_audit_trim(a.actor_display_name),''),
        adm_audit_safe_label(${actorName})) AS actor_label,
      CASE WHEN adm_audit_safe_label(${roleLabel}) IS NOT NULL THEN ${roleLabel} END AS role_label,
      coalesce(nullif(adm_audit_trim(a.permission_display_label),''),${actions}::jsonb->>a.action,'Access setting')
        AS permission_label,
      coalesce(adm_audit_safe_label(a.menu_display_label),adm_audit_safe_label(${menuName}),${capturedMenu}) AS menu_label
    FROM scoped a ${nameJoins}
    WHERE NOT EXISTS (SELECT 1 FROM adm_access_control_audit_search s WHERE s.audit_id=a.id)
  ), live_grants AS NOT MATERIALIZED (
    SELECT a.id, a.before_value, a.after_value, a.recorded_at,
      coalesce(l.actor_label,
        CASE WHEN jsonb_typeof(a.actor->'roleName')='string' THEN adm_audit_safe_label(a.actor->>'roleName') END,
        CASE WHEN left(a.actor->>'source',19)='trusted_parent_sync'
          THEN 'The parent application' ELSE 'A user whose name was not recorded' END) AS who,
      coalesce('the ' || l.role_label || ' role','a role no longer available') AS role_words,
      l.permission_label || CASE WHEN left(a.resource,5)='menu:'
        THEN ' — ' || coalesce(l.menu_label,'an unavailable screen') ELSE '' END AS permission
    FROM live_labels l JOIN adm_access_control_audit a ON a.id=l.id WHERE l.event='grant_change'
  )` : sql``;
  const matches = needle ? sql`
    SELECT a.id FROM adm_access_control_audit_search s JOIN scoped a ON a.id=s.audit_id
    WHERE s.sentence_folded LIKE ${pattern} ESCAPE '!'
    UNION ALL
    SELECT a.id FROM adm_access_control_audit_search s JOIN scoped a ON a.id=s.audit_id
    LEFT JOIN live_menus m ON m.muid=s.menu_id
    WHERE s.menu_id IS NOT NULL AND (s.menu_left || coalesce(m.label,s.menu_fallback,'an unavailable screen')
      || s.menu_right) LIKE ${pattern} ESCAPE '!'
    UNION ALL
    -- Legacy grants with missing capture fields use the original live rules.
    SELECT id FROM live_grants WHERE adm_audit_fold(
      to_char(recorded_at AT TIME ZONE 'UTC','DD Mon YYYY, HH24:MI') || ' UTC — ' || who || ' ' ||
      CASE
        WHEN after_value='true' AND before_value='true' THEN 'kept “' || permission || '” permission granted to ' || role_words
        WHEN after_value='true' THEN 'granted “' || permission || '” permission to ' || role_words
        WHEN after_value='false' AND (before_value IS NULL OR before_value IN ('false','null'))
          THEN 'left “' || permission || '” permission not granted to ' || role_words
        WHEN after_value='false' THEN 'removed “' || permission || '” permission from ' || role_words
        ELSE 'updated “' || permission || '” permission for ' || role_words
      END || '.') LIKE ${pattern} ESCAPE '!'
    UNION ALL
    SELECT a.id FROM live_labels l JOIN adm_access_control_audit a ON a.id=l.id
    WHERE l.event<>'grant_change' AND adm_audit_fold(adm_audit_sentence(a.event,a.actor,a.role_id,a.resource,
        a.before_value,a.after_value,a.details,a.recorded_at,
        l.actor_label,l.role_label,l.permission_label,l.menu_label)) LIKE ${pattern} ESCAPE '!'
  ` : sql`SELECT id FROM scoped`;
  const limit = q.export === "all" ? sql`` : sql`LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`;
  type ResultRow = AccessAuditEntry & { matched_total: string; unmapped_keys: string[] };
  const rows = (await db.execute(sql`
    WITH scoped AS NOT MATERIALIZED (
      SELECT a.* FROM adm_access_control_audit a WHERE ${condition} ${role} ${from} ${to}
    ) ${liveLabels}, matched AS MATERIALIZED (${matches}), selected AS (
      SELECT id FROM matched ORDER BY id DESC ${limit}
    ), unknown AS (
      SELECT 'event:' || event AS key, max(id) AS last_id, 1 AS kind FROM scoped
        WHERE NOT (${events}::jsonb ? event) GROUP BY event
      UNION ALL
      SELECT 'action:' || action, max(id), 2 FROM scoped
        WHERE action<>'' AND NOT (${actions}::jsonb ? action) GROUP BY action
      UNION ALL
      SELECT resource, max(a.id), 3 FROM scoped a ${menuJoin}
        WHERE a.event='grant_change' AND left(a.resource,5)='menu:'
          AND a.menu_display_label IS NULL
          AND ${capturedMenu} IS NULL AND adm_audit_safe_label(${menuName}) IS NULL
        GROUP BY resource
    ), meta AS (
      SELECT (SELECT count(*) FROM matched) AS matched_total,
        ARRAY(SELECT key FROM unknown ORDER BY last_id DESC,kind) AS unmapped_keys
    )
    SELECT a.*, ${actorName} AS actor_name, r.assigned_role AS role_name,
      ${menuName} AS menu_name, meta.matched_total, meta.unmapped_keys
    FROM meta LEFT JOIN selected ON true
    LEFT JOIN adm_access_control_audit a ON a.id=selected.id ${nameJoins}
    ORDER BY selected.id DESC
  `)).rows as ResultRow[];
  const items: Array<AccessAuditEntry & { sentence: string }> = [];
  for (const { matched_total, unmapped_keys, ...row } of rows) {
    // A metadata-only record preserves the exact total for out-of-range pages.
    if (row.id !== null) items.push({ ...row, sentence: presentAccessAudit(row).sentence });
  }
  return { items, total: Number(rows[0]?.matched_total ?? 0), page: q.page, pageSize: q.pageSize,
    unmappedKeys: rows[0]?.unmapped_keys ?? [] };
}
