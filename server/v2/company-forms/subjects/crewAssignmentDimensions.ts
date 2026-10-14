import type { RuleDimension, RuleMasterChoice, RuleDimensionValue, AssignmentDimensionReport } from "../../../../shared/v2/forms-engine/ruleDimensions";
import { sql } from "drizzle-orm";
import type { CrewAssignmentSubject } from "./crewAssignmentSubject";
import { readPriorServiceDecision } from "./crewAssignmentHistory";

const scalar = (key: string, label: string): RuleDimension =>
  ({ key, label, kind: "scalar", operators: ["in", "not_in"], available: true });
export const crewAssignmentRuleDimensions: readonly RuleDimension[] = [
  scalar("vessel_type", "Vessel type"),
  scalar("vessel", "Vessel"),
  { ...scalar("fleet_group", "Fleet group"), kind: "set", operators: ["contains_any", "contains_all"] },
  { ...scalar("additional_group", "Additional group"), kind: "set", operators: ["contains_any", "contains_all"] },
  scalar("nationality", "Nationality"),
  scalar("rank", "Contract rank"),
  scalar("manning_agent", "Manning agent"),
  scalar("crew_pool", "Crew pool"),
  { key: "first_ever", label: "First-ever with company", kind: "boolean", operators: ["is"], available: true },
  { key: "first_in_rank", label: "First-in-rank", kind: "boolean", operators: ["is"], available: true },
  ...["owner", "flag"].map(key => ({
    ...scalar(key, key === "owner" ? "Vessel owner" : "Flag"),
    available: false, unavailableReason: "Not yet available: the parent application has not supplied master data",
  })),
];

// Authoritative tenant master stores. Serialize existing primary keys exactly;
// current agent/pool keys are UUIDs. Never manufacture replacement identifiers.
const stores: Record<string, { table: string; id: string; label: string; filter: string }> = {
  vessel: { table: "master_vessels", id: "vessel_uuid", label: "vessel", filter: "NOT is_deleted AND is_active" },
  vessel_type: { table: "master_vessel_types", id: "vt_uuid", label: "vessel_type", filter: "NOT is_deleted AND is_active" },
  nationality: { table: "master_nationalities", id: "nat_uuid", label: "nationality", filter: "NOT is_deleted" },
  rank: { table: "adm_available_ranks_v2", id: "ar_uuid", label: "name", filter: "NOT is_deleted" },
  manning_agent: { table: "master_manning_agents", id: "id::text", label: "name", filter: "NOT is_deleted AND is_active" },
  crew_pool: { table: "master_crew_pools", id: "id::text", label: "name", filter: "NOT is_deleted AND is_active" },
  fleet_group: { table: "master_fleet_groups", id: "fg_uuid", label: "name", filter: "true" },
  additional_group: { table: "master_additional_groups", id: "ag_uuid", label: "name", filter: "true" },
};
export async function crewRuleMasterChoices(key: string, tx: any, lock = false): Promise<RuleMasterChoice[]> {
  const store = stores[key];
  if (!store) return [];
  const q = sql`SELECT ${sql.raw(store.id)} AS id,${sql.raw(store.label)} AS label
    FROM ${sql.raw(store.table)} WHERE ${sql.raw(store.filter)}`;
  const result = await tx.execute(lock ? sql`${q} FOR SHARE` : q);
  return result.rows.filter((r: any) => r.id != null && String(r.id).length && r.label != null)
    .map((r: any) => ({ id: String(r.id), label: String(r.label) }));
}

export function exactMasterValue(key: string, reference: unknown, choices: readonly RuleMasterChoice[], legacyText = false): RuleDimensionValue {
  const matches = choices.filter(c => c.id === reference || legacyText && c.label === reference);
  if (matches.length !== 1) return { key, status: "unresolved", value: null, labels: [],
    reason: reference == null || reference === "" ? "Source value is blank" : "Source reference has no unique eligible master match",
    source: { reference: reference ?? null } };
  return { key, status: "resolved", value: matches[0].id, labels: [matches[0].label], source: { reference } };
}

function membershipReferences(value: string | null): string[] {
  if (!value) return [];
  if (value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap(v => typeof v === "string" || typeof v === "number" ? [String(v)]
        : typeof v === "object" && v ? [v.vesselUuid ?? v.vessel_uuid ?? v.id ?? v.name].filter(x => x != null).map(String) : []);
    } catch { return []; }
  }
  return value.split(",").map(v => v.trim()).filter(Boolean);
}

export async function readCrewRuleDimensions(subject: CrewAssignmentSubject, tx: any): Promise<AssignmentDimensionReport> {
  const vessel = (await tx.execute(sql`SELECT * FROM master_vessels WHERE vessel_uuid=${subject.vesselUuid}
    AND NOT is_deleted AND is_active`)).rows[0];
  const crew = (await tx.execute(sql`SELECT nationality_uuid FROM crew_members_v2 WHERE crew_uuid=${subject.crewUuid} AND NOT is_deleted`)).rows[0];
  const personal = (await tx.execute(sql`SELECT manning_agent,crew_pool FROM crew_personal_details
    WHERE crew_uuid=${subject.crewUuid} AND NOT is_deleted ORDER BY id DESC`)).rows;
  const context = (await tx.execute(sql`SELECT * FROM crew_assignment_rule_context WHERE assign_uuid=${subject.assignUuid}`)).rows[0];
  const values: RuleDimensionValue[] = [];
  for (const [key, reference, legacy] of [
    ["vessel", subject.vesselUuid, false], ["vessel_type", vessel?.vessel_type, true],
    ["nationality", crew?.nationality_uuid, false], ["rank", context?.contract_rank_uuid, false],
    ["manning_agent", personal.length === 1 ? personal[0].manning_agent : null, true],
    ["crew_pool", personal.length === 1 ? personal[0].crew_pool : null, true],
  ] as const) {
    const v = exactMasterValue(key, reference, await crewRuleMasterChoices(key, tx), legacy);
    if (key === "rank") v.source = { ...v.source, planning: context?.rank_source ?? null, capturedAt: context?.captured_at ?? null };
    if (key === "rank" && context?.rank_reason) v.reason = context.rank_reason;
    if (["manning_agent", "crew_pool"].includes(key) && personal.length > 1) v.reason = "Multiple authoritative personal-detail records";
    values.push(v);
  }
  for (const key of ["fleet_group", "additional_group"]) {
    const store = stores[key];
    const rows = (await tx.execute(sql`SELECT ${sql.raw(store.id)} AS id,name,vessels FROM ${sql.raw(store.table)}`)).rows;
    const refs = vessel ? [String(vessel.id), vessel.vessel_uuid, vessel.vessel] : [];
    const matches = rows.filter((r: any) => membershipReferences(r.vessels).some(ref => refs.includes(ref)));
    const valid = matches.length && matches.every((r: any) => r.id && rows.filter((other: any) => other.name === r.name).length === 1);
    values.push({ key, status: valid ? "resolved" : "unresolved", value: valid ? matches.map((r: any) => r.id) : null,
      labels: valid ? matches.map((r: any) => r.name) : [],
      ...(valid ? {} : { reason: "Vessel stored membership has no unique eligible group master match" }),
      source: { master: store.table, membershipReferences: refs } });
  }
  let history = context?.joining_history;
  const verified = context?.joining_history_backfill;
  if (verified && !history) history = {
    ...verified, ...history,
    firstEver: history?.firstEver ?? verified.firstEver,
    firstInRank: history?.firstInRank ?? verified.firstInRank,
    firstEverReason: history?.firstEver != null ? history.firstEverReason : verified.firstEverReason,
    firstInRankReason: history?.firstInRank != null ? history.firstInRankReason : verified.firstInRankReason,
    verifiedBackfill: verified,
  };
  if (!history && subject.assignmentType === "Planned") {
    history = { ...await readPriorServiceDecision(subject.crewUuid, context?.contract_rank_uuid ?? null,
      subject.signOnDate ?? new Date().toISOString().slice(0, 10), tx), source: "live_planned_history", capturedAt: null };
  }
  for (const [key, field] of [["first_ever", "firstEver"], ["first_in_rank", "firstInRank"]] as const) {
    const value = history?.[field];
    values.push({ key, status: typeof value === "boolean" ? "resolved" : "unresolved",
      value: typeof value === "boolean" ? value : null, labels: [],
      ...(typeof value === "boolean" ? {} : { reason: history?.[`${field}Reason`] ?? "No reliable pre-sign-on joining-history capture" }),
      source: history ?? { capturedAt: null } });
  }
  for (const d of crewAssignmentRuleDimensions.filter(d => !d.available)) values.push({
    key: d.key, status: "not_yet_available", value: null, labels: [], reason: d.unavailableReason, source: {},
  });
  return { subjectRef: subject.assignUuid, dimensions: crewAssignmentRuleDimensions.map(d => ({ ...d, ...values.find(v => v.key === d.key)! })) };
}
