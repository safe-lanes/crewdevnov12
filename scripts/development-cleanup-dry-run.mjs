import pg from "pg";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { identitySQL, sameIdentity } from "./test-database-guard.mjs";

// This program has no development write path. The manifest is private:
// identifiers, fingerprints and provenance must not be committed or published.
const out = "generated-artifacts/private-db-backups";
await fs.mkdir(out, { recursive: true, mode: 0o700 });
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
const quote = value => `"${value.replaceAll('"', '""')}"`;
const standardIds = new Set([1, 2, 6, 8, 9, 10]);
const testText = value => /(?:^|\b)(?:TEST(?: ONLY)?|CHKMT|CHECKMATE|fixture|acceptance|CF(?:\d+)?[- _]|T\d+[- _]|VT_VW|VW[- _]|DEMO[- _]|E2E|AUTOCREATE|NOSCALE|FROZEN|REQ[- _]|RULE[- _]|debrief[- _]|Void Race|Forms race office|Stage-less form office|Boundary vessel type|Render vessel type)|@[^@\s]+\.(?:test|invalid)\b/i.test(String(value ?? ""));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === "object" && !(value instanceof Date) ?
    Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = row => crypto.createHash("sha256").update(JSON.stringify(canonical(row))).digest("hex");
const data = new Map();
const issues = [];
try {
  await c.connect();
  await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const identity = (await c.query(identitySQL)).rows[0];
  if (!sameIdentity(identity, { clusterid: "7586633721581772821", databaseoid: "16384" }))
    throw new Error("Wrong development identity; dry run refused.");
  const schemas = (await c.query(`SELECT nspname FROM pg_namespace
    WHERE nspname ~ '^(test_stage|test_ac|cf_dimensions|cf_lock|cf_verified_history|cf_crew_import)_[0-9a-f]+$'
    ORDER BY nspname`)).rows.map(row => row.nspname);
  if (schemas.length !== 224) throw new Error("Retained schema inventory changed; review needed.");
  const tables = (await c.query(`SELECT tablename FROM pg_tables
    WHERE schemaname='public' ORDER BY tablename`)).rows.map(row => row.tablename);
  for (const table of tables) {
    const rows = (await c.query(`SELECT * FROM public.${quote(table)}`)).rows;
    data.set(table, rows.map((row, index) => ({
      row, index, decision: "KEEP", reasons: [], protected: false,
    })));
  }
  const entries = table => data.get(table) ?? [];
  const remove = (entry, reason) => {
    if (entry.protected) {
      const message = `Protected ${entry.table ?? "record"} conflicts with ${reason}`;
      if (!entry.reasons.includes(message)) {
        entry.reasons.push(message);
        issues.push({ table: entry.table, index: entry.index, reason: message });
      }
      return false;
    }
    if (entry.decision === "REMOVE") return false;
    entry.decision = "REMOVE"; entry.reasons.push(reason); return true;
  };
  for (const [table, rows] of data) for (const entry of rows) entry.table = table;
  const keepCrew = new Set(entries("crew_members_v2").filter(e =>
    e.row.id >= 44 && e.row.id <= 170 && /^A[0-9]+$/.test(e.row.emp_no)).map(e => e.row.crew_uuid));
  const keepVessels = new Set(entries("master_vessels").filter(e =>
    /^vessel (?:0[2-9]|10)$/i.test(e.row.vessel)).map(e => e.row.vessel_uuid));
  if (keepCrew.size !== 127 || keepVessels.size !== 9)
    throw new Error("Established crew/vessel allowlist no longer matches the reviewed inventory.");
  const keepEmp = new Set(entries("crew_members_v2").filter(e => keepCrew.has(e.row.crew_uuid)).map(e => e.row.emp_no));
  const keepCrewIds = new Set(entries("crew_members_v2").filter(e => keepCrew.has(e.row.crew_uuid)).map(e => String(e.row.id)));
  const keepCandidates = new Set(entries("crew_members_v2").filter(e => keepCrew.has(e.row.crew_uuid))
    .map(e => e.row.source_rec_can_uuid).filter(Boolean));
  const removeCrew = new Set(entries("crew_members_v2").filter(e => !keepCrew.has(e.row.crew_uuid)).map(e => e.row.crew_uuid));
  const removeEmp = new Set(entries("crew_members_v2").filter(e => removeCrew.has(e.row.crew_uuid)).map(e => e.row.emp_no));
  const reviewVessels = new Set(entries("master_vessels").filter(e =>
    String(e.row.vessel).startsWith("Import-") && entries("crew_assignments").some(a =>
      a.row.vessel_uuid === e.row.vessel_uuid && keepCrew.has(a.row.crew_uuid))).map(e => e.row.vessel_uuid));
  const removeVessels = new Set(entries("master_vessels").filter(e =>
    !keepVessels.has(e.row.vessel_uuid) && !reviewVessels.has(e.row.vessel_uuid)).map(e => e.row.vessel_uuid));
  for (const [table, rows] of data) for (const entry of rows) {
    const r = entry.row;
    if (table === "master_vessels") {
      if (keepVessels.has(r.vessel_uuid)) entry.protected = true;
      else if (reviewVessels.has(r.vessel_uuid)) {
        entry.decision = "KEEP";
        entry.protected = true;
        entry.reasons.push("Approved retention: historical import vessel referenced by established crew");
      }
      else remove(entry, "Not one of the nine retained parent vessels, including MV CHECKMATE");
    } else if (table === "crew_members_v2") {
      if (keepCrew.has(r.crew_uuid)) entry.protected = true;
      else remove(entry, "Outside the 127 established A-number seafarers; includes five CHKMT");
    } else if (table === "adm_forms_v2") {
      if (standardIds.has(r.id)) entry.protected = true;
      else remove(entry, r.category === "dynamic" ? "All Company Forms explicitly in scope" : "Test Standard Form");
    } else if (table === "adm_rank_groups_v2" && /^Test Senior Officers/.test(r.name)) {
      remove(entry, "Explicit Test Senior Officers group");
    } else if (table === "adm_rolemaster_ac" && testText(r.assigned_role)) {
      remove(entry, "Explicit fixture role name");
    } else if (table === "master_users" && r.id <= 24) {
      entry.protected = true;
    } else if (table === "adm_access_control_audit" && r.event === "checklist_override" &&
      testText(r.details?.reason)) {
      remove(entry, "Explicit TEST ONLY checklist-override acceptance record");
    } else if (table === "master_users" &&
      ([r.firstname, r.lastname, r.fullname, r.email, r.designation, r.display_name].some(testText) ||
       (r.id > 24 && r.email == null))) {
      remove(entry, "Fixture marker or email-less test-actor cohort after the original 24 parent users");
    } else if (table === "users" && testText(r.username)) {
      remove(entry, "Explicit fixture login");
    } else if (table.startsWith("master_") && !["master_vessels", "master_users"].includes(table)) {
      const labels = Object.entries(r).filter(([key]) =>
        /^(name|vessel|vessel_type|nationality|country|group_name|pool_name|agent_name|port_name|license_name|label|value|entry_name|code|fullname)$/.test(key));
      if (labels.some(([, value]) => testText(value) || uuid.test(String(value ?? ""))))
        remove(entry, "Explicit test label or identifier used as a master-list label");
    }
    if (/^frm_(requirements|requirement_history|resolution_runs|stage_attempts|stage_audit|stage_cycles|stage_events|company_submissions|company_submission_assignments|company_submission_system_snapshots|version_applicability|applicability_sets|applicability_conditions|applicability_release_proof|version_release_changes)$/.test(table))
      remove(entry, "All Company Form operational/policy records explicitly in scope");
    if (table !== "master_vessels" && table !== "crew_members_v2") {
      const owner = r.crew_uuid ?? r.crew_member_id ?? r.crew_id;
      const realOwner = keepCrew.has(owner) || keepEmp.has(owner) || keepCrewIds.has(String(owner)) ||
        keepCandidates.has(r.rec_can_uuid);
      // Company Form records are explicitly removed even for realistic subjects.
      if (realOwner && !table.startsWith("frm_")) entry.protected = true;
      if (removeCrew.has(owner) || removeEmp.has(owner)) remove(entry, "Owned by a removed fixture seafarer");
      if (testText(r.crew_member_id)) remove(entry, "Explicit synthetic seafarer code on an unlinked legacy record");
      if (removeVessels.has(r.vessel_uuid)) remove(entry, "Owned by/references a removed fixture vessel");
      if (removeCrew.has(r.reliever_crew_uuid)) remove(entry, "References a removed fixture reliever");
    }
  }
  const removedRoles = new Set(entries("adm_rolemaster_ac").filter(e => e.decision === "REMOVE")
    .flatMap(e => [String(e.row.id), e.row.ruid, e.row.assigned_role]));
  for (const e of entries("master_users")) {
    if (removedRoles.has(e.row.role) || testText(e.row.role))
      remove(e, "User belongs to an explicitly identified fixture role");
  }
  for (const table of ["adm_roleaccess_ac", "adm_resource_action_grants", "adm_access_control_audit"]) {
    for (const e of entries(table))
      if (removedRoles.has(String(e.row.role_id))) remove(e, "Grant/audit targets an explicitly identified fixture role");
  }
  const fks = (await c.query(`SELECT child.relname AS child,parent.relname AS parent,
    ARRAY(SELECT a.attname::text FROM unnest(k.conkey) WITH ORDINALITY x(num,n)
      JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num ORDER BY x.n) AS child_columns,
    ARRAY(SELECT a.attname::text FROM unnest(k.confkey) WITH ORDINALITY x(num,n)
      JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num ORDER BY x.n) AS parent_columns
    FROM pg_constraint k JOIN pg_class child ON child.oid=k.conrelid
    JOIN pg_class parent ON parent.oid=k.confrelid
    JOIN pg_namespace cn ON cn.oid=child.relnamespace
    JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    WHERE k.contype='f' AND cn.nspname='public' AND pn.nspname='public'`)).rows;
  const unique = (await c.query(`SELECT t.relname AS table_name,a.attname AS column_name
    FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(i.indkey)
    WHERE n.nspname='public' AND i.indisunique AND i.indnkeyatts=1`)).rows;
  const ownKeys = new Map();
  for (const r of unique) {
    if (!ownKeys.has(r.table_name)) ownKeys.set(r.table_name, new Set());
    ownKeys.get(r.table_name).add(r.column_name);
  }
  for (const [table, key] of [
    ["adm_forms_v2", "form_uuid"], ["adm_form_versions_v2", "fv_uuid"],
    ["adm_rank_groups_v2", "rg_uuid"], ["adm_rolemaster_ac", "ruid"],
    ["frm_form_parts", "form_part_uuid"], ["frm_sections", "section_uuid"],
    ["frm_questions", "question_uuid"], ["frm_option_sets", "option_set_uuid"],
    ["frm_options", "option_uuid"], ["frm_company_submissions", "submission_uuid"],
    ["frm_signature_attachments", "sig_att_uuid"],
  ]) {
    if (!ownKeys.has(table)) ownKeys.set(table, new Set());
    ownKeys.get(table).add(key);
  }
  for (const [table, rows] of data) {
    if (table.startsWith("master_") && rows.length) {
      const key = Object.keys(rows[0].row).find(key => key.endsWith("_uuid"));
      if (key) {
        if (!ownKeys.has(table)) ownKeys.set(table, new Set());
        ownKeys.get(table).add(key);
      }
    }
  }
  let changed = true;
  const protectedIdentities = new Set([
    ...keepCrew, ...keepVessels,
    ...entries("adm_forms_v2").filter(e => e.protected).map(e => e.row.form_uuid),
    ...entries("master_users").filter(e => e.protected).map(e => e.row.user_uuid),
  ].filter(Boolean).map(value => value.toLowerCase()));
  const foreignColumns = new Map();
  for (const fk of fks) {
    if (!foreignColumns.has(fk.child)) foreignColumns.set(fk.child, new Set());
    for (const key of fk.child_columns) foreignColumns.get(fk.child).add(key);
  }
  while (changed) {
    changed = false;
    const removedUuids = new Set();
    for (const [table, rows] of data) for (const e of rows.filter(e => e.decision === "REMOVE"))
      for (const key of ownKeys.get(table) ?? [])
        if (!foreignColumns.get(table)?.has(key) &&
            !["crew_assign_uuid", "reliever_assign_uuid", "deployed_to_plan_uuid"].includes(key) &&
            (key !== "crew_uuid" || table === "crew_members_v2") &&
            uuid.test(String(e.row[key] ?? "")) && !protectedIdentities.has(String(e.row[key]).toLowerCase()))
          removedUuids.add(String(e.row[key]).toLowerCase());
    for (const fk of fks) {
      const removed = new Set(entries(fk.parent).filter(e => e.decision === "REMOVE")
        .map(e => JSON.stringify(fk.parent_columns.map(key => e.row[key]))));
      for (const e of entries(fk.child)) {
        const values = fk.child_columns.map(key => e.row[key]);
        if (values.every(value => value != null) && removed.has(JSON.stringify(values)))
          changed = remove(e, `Foreign key to removed ${fk.parent}`) || changed;
      }
    }
    for (const [table, rows] of data) for (const e of rows) {
      const references = Object.entries(e.row).filter(([key]) => /(?:_uuid|_uid|_ruid|_ref|_id)$/.test(key));
      if (references.some(([, value]) => typeof value === "string" && removedUuids.has(value.toLowerCase())))
        changed = remove(e, "Exact UUID reference to a removed record") || changed;
    }
  }
  // References without a database FK need an explicit, table-scoped check.
  for (const [table, rows] of data) for (const e of rows) {
    if (e.row.form_id != null && !standardIds.has(e.row.form_id) &&
        entries("adm_forms_v2").some(f => f.row.id === e.row.form_id && f.decision === "REMOVE"))
      remove(e, "Legacy form ID references a removed definition");
  }
  const retainedReferences = new Set();
  for (const [table, rows] of data) {
    if (table === "frm_signature_attachments") continue;
    for (const e of rows.filter(e => e.decision === "KEEP"))
      for (const value of JSON.stringify(e.row).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [])
        retainedReferences.add(value.toLowerCase());
  }
  for (const e of entries("frm_signature_attachments")) {
    if (!retainedReferences.has(e.row.sig_att_uuid.toLowerCase()))
      remove(e, "Company Form/orphan signature attachment with no retained reference");
  }
  // Approved rule: preserve the complete dependency closure of every kept row.
  // Never repair or rewrite the referring row just to make deletion possible.
  const retentions = [];
  const retain = (entry, child) => {
    if (entry.decision !== "REMOVE") return false;
    entry.decision = "KEEP";
    entry.protected = true;
    const reason = `Approved dependency retention for kept ${child.table}`;
    entry.reasons.push(reason);
    retentions.push({ table: entry.table, index: entry.index,
      dependentTable: child.table, dependentIndex: child.index });
    return true;
  };
  do {
    changed = false;
    const keptAssignments = new Set(entries("crew_assignments")
      .filter(e => e.decision === "KEEP").map(e => e.row.assign_uuid));
    for (const context of entries("crew_assignment_rule_context"))
      if (keptAssignments.has(context.row.assign_uuid))
        changed = retain(context, { table: "crew_assignments", index: null }) || changed;
    for (const fk of fks) {
      const parents = new Map(entries(fk.parent).map(e =>
        [JSON.stringify(fk.parent_columns.map(key => e.row[key])), e]));
      for (const child of entries(fk.child).filter(e => e.decision === "KEEP")) {
        const values = fk.child_columns.map(key => child.row[key]);
        if (values.some(value => value == null)) continue;
        const parent = parents.get(JSON.stringify(values));
        if (parent) changed = retain(parent, child) || changed;
      }
    }
    const owners = new Map();
    for (const [table, rows] of data) for (const e of rows)
      for (const key of ownKeys.get(table) ?? []) {
        if (foreignColumns.get(table)?.has(key) ||
            ["crew_assign_uuid", "reliever_assign_uuid", "deployed_to_plan_uuid"].includes(key) ||
            (key === "crew_uuid" && table !== "crew_members_v2")) continue;
        const value = e.row[key];
        if (!uuid.test(String(value ?? ""))) continue;
        const normalized = value.toLowerCase();
        if (!owners.has(normalized)) owners.set(normalized, []);
        owners.get(normalized).push(e);
      }
    for (const rows of data.values()) for (const child of rows.filter(e => e.decision === "KEEP"))
      for (const value of JSON.stringify(child.row).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [])
        for (const parent of owners.get(value.toLowerCase()) ?? [])
          changed = retain(parent, child) || changed;
  } while (changed);
  const counts = Object.fromEntries([...data].map(([table, rows]) => [table, {
    total: rows.length, remove: rows.filter(e => e.decision === "REMOVE").length,
    keep: rows.filter(e => e.decision === "KEEP").length,
    review: rows.filter(e => e.decision === "REVIEW").length,
  }]));
  const manifest = {
    recordedAt: new Date().toISOString(), identity, schemasToRemove: schemas,
    criteria: { standardIds: [...standardIds], crewIdRange: [44, 170], crewCount: 127, vesselCount: 9 },
    counts, conflicts: [], resolvedConflicts: issues, retentions, foreignKeys: fks,
    tables: Object.fromEntries([...data].map(([table, rows]) => [table, rows.map(e => ({
      index: e.index, decision: e.decision, reasons: e.reasons,
      key: Object.fromEntries([...ownKeys.get(table) ?? []].map(key => [key, e.row[key]])),
      sha256: digest(e.row),
    }))])),
  };
  await fs.writeFile(`${out}/cleanup-dry-run.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await fs.writeFile(`${out}/cleanup-counts.json`, JSON.stringify({
    recordedAt: manifest.recordedAt, counts, schemasToRemove: schemas.length,
    conflicts: 0, dependencyRetentions: retentions.length,
  }, null, 2), { mode: 0o600 });
  await fs.writeFile("generated-artifacts/cleanup-dry-run-counts.csv",
    "Category,Total,Proposed remove,Keep,Review (not deleted)\n" +
    Object.entries(counts).map(([table, v]) => `${table},${v.total},${v.remove},${v.keep},${v.review}`).join("\n") +
    `\nRetained test schemas,${schemas.length},${schemas.length},0,0\n`);
  await c.query("COMMIT");
  console.log(JSON.stringify({
    recordedAt: manifest.recordedAt, schemasToRemove: schemas.length, publicTables: tables.length,
    conflicts: issues.length, counts: Object.fromEntries(Object.entries(counts).filter(([, v]) => v.remove)),
  }, null, 2));
} finally { await c.end(); }
