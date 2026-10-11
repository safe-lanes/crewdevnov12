import { sql } from "drizzle-orm";

export type PriorService = { sea_uuid: string; rank: string | null; from_date: string | null; service_type: string };
export type RankReference = { reference: string; rankUuid: string };

export function decideFirstService(rows: PriorService[], rankUuid: string | null, references: RankReference[], cutoff: string) {
  const company = rows.filter(r => r.service_type === "company");
  const validDate = (date: string | null): date is string => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  const badDates = company.filter(r => !validDate(r.from_date));
  const sameDay = company.filter(r => r.from_date === cutoff);
  const prior = company.filter(r => validDate(r.from_date) && r.from_date < cutoff);
  const matches = (rank: string | null) => [...new Set(references.filter(r => r.reference === rank).map(r => r.rankUuid))];
  const knownMatching = prior.filter(r => { const ids = matches(r.rank); return ids.length === 1 && ids[0] === rankUuid; });
  const unknownRanks = prior.filter(r => matches(r.rank).length !== 1);
  const uncertainHistory = badDates.length > 0 || sameDay.length > 0;
  if (!validDate(cutoff)) return {
    firstEver: null, firstInRank: null, cutoff, firstEverReason: "Invalid joining cutoff",
    firstInRankReason: "Invalid joining cutoff", sourceSeaServiceUuids: [] as string[],
    matchingRankSeaServiceUuids: [] as string[], excludedFutureServiceUuids: [] as string[],
    uncertainServiceUuids: company.map(r => r.sea_uuid), contractRankUuid: rankUuid,
  };
  const firstEver = prior.length ? false : uncertainHistory ? null : true;
  const firstInRank = !rankUuid ? null : knownMatching.length ? false
    : uncertainHistory || unknownRanks.length ? null : true;
  return {
    firstEver, firstInRank, cutoff,
    firstEverReason: firstEver === null ? "Missing/invalid service date or same-day service whose contract ordering cannot be proven" : null,
    firstInRankReason: firstInRank === null ? !rankUuid ? "Contract rank is UNRESOLVED"
      : "Missing/ambiguous historical rank or contract ordering" : null,
    sourceSeaServiceUuids: prior.map(r => r.sea_uuid),
    matchingRankSeaServiceUuids: knownMatching.map(r => r.sea_uuid),
    excludedFutureServiceUuids: company.filter(r => validDate(r.from_date) && r.from_date > cutoff).map(r => r.sea_uuid),
    uncertainServiceUuids: [...badDates, ...sameDay, ...unknownRanks].map(r => r.sea_uuid),
    contractRankUuid: rankUuid,
  };
}

export async function readPriorServiceDecision(crewUuid: string, rankUuid: string | null, cutoff: string, tx: any) {
  const rows = (await tx.execute(sql`SELECT sea_uuid,rank,from_date,service_type FROM crew_sea_service
    WHERE crew_uuid=${crewUuid} AND NOT is_deleted AND service_type='company' FOR SHARE`)).rows;
  const roots = (await tx.execute(sql`SELECT ar_uuid,rank_id,name,label FROM adm_available_ranks_v2 WHERE NOT is_deleted FOR SHARE`)).rows;
  const aliases = (await tx.execute(sql`SELECT cr_uuid,rank,role,rank_id,original_rank_id FROM adm_company_ranks_v2
    WHERE NOT is_deleted FOR SHARE`)).rows;
  const references: RankReference[] = [];
  for (const r of roots) for (const value of [r.ar_uuid, r.rank_id, r.name, r.label]) {
    if (value) references.push({ reference: value, rankUuid: r.ar_uuid });
  }
  for (const a of aliases) {
    const key = a.original_rank_id || a.rank_id;
    const mapped = roots.filter((r: any) => r.rank_id === key || r.ar_uuid === key);
    if (mapped.length !== 1) continue;
    for (const value of [a.cr_uuid, a.rank, a.role, a.rank_id]) {
      if (value) references.push({ reference: value, rankUuid: mapped[0].ar_uuid });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  return decideFirstService(rows as PriorService[], rankUuid, references, cutoff > today ? today : cutoff);
}

export async function captureJoiningHistory(assignUuid: string, signOnDate: string, tx: any) {
  const a = (await tx.execute(sql`SELECT crew_uuid,assignment_type FROM crew_assignments
    WHERE assign_uuid=${assignUuid} AND NOT is_deleted FOR UPDATE`)).rows[0];
  if (!a || a.assignment_type !== "Planned") throw new Error("Joining history capture requires the exact Planned assignment");
  const context = (await tx.execute(sql`SELECT * FROM crew_assignment_rule_context WHERE assign_uuid=${assignUuid} FOR UPDATE`)).rows[0];
  if (context?.joining_history) return;
  const history = await readPriorServiceDecision(a.crew_uuid, context?.contract_rank_uuid ?? null, signOnDate, tx);
  const capture = { ...history, capturedAt: new Date().toISOString(), source: "before_sign_on_E1",
    currentContractExclusion: "Captured before this contract's E1 insertion; unidentifiable same-day history stays UNRESOLVED" };
  await tx.execute(sql`INSERT INTO crew_assignment_rule_context(assign_uuid,rank_source,rank_reason,joining_history)
    VALUES(${assignUuid},'{"method":"no_recorded_deploy_capture"}'::jsonb,'No recorded Deploy rank capture',${JSON.stringify(capture)}::jsonb)
    ON CONFLICT(assign_uuid) DO UPDATE SET joining_history=EXCLUDED.joining_history
    WHERE crew_assignment_rule_context.joining_history IS NULL`);
}
