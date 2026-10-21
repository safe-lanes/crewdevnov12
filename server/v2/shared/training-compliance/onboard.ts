import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { calculateTrainingCompliance, incompleteTrainingCheck } from "./calculator";
import { civilDate, contractEndDate } from "./dates";
import { readSavedTrainingMatrix, readTrainingCertificates, type CanonicalReliever } from "./reader";
import type { ComplianceInput, ComplianceResult, CourseResult } from "./types";

export type MatrixDot = {
  courseUuid: string; color: "green" | "amber" | "red" | "grey";
  outline: boolean; label: string; reasons: string[];
};
export type OnboardAssignment = CanonicalReliever & {
  plannedReliefDate: string | null; planningCount: number; crewName: string;
};

/** Only exact assignment provenance; never rank/crew/date guesses. */
export async function readOnboardAssignments(db: ReturnType<typeof getDb>, vesselUuid: string) {
  return (await db.execute(sql`SELECT a.assign_uuid AS "assignmentUuid",a.crew_uuid AS "crewUuid",
    a.vessel_uuid AS "vesselUuid",x.contract_rank_uuid AS "contractRankUuid",r.id AS "rankRowId",
    NULL::text AS "plannedJoiningDate",NULL::integer AS "contractRangeEndMonths",
    NULL::integer AS "contractPeriodMonths",
    btrim(concat_ws(' ',nullif(c.first_name,''),nullif(c.middle_name,''),nullif(c.family_name,''))) AS "crewName",
    p.n::integer AS "planningCount",
    CASE WHEN p.n=1 THEN nullif(btrim(p.relief),'') ELSE NULL END AS "plannedReliefDate"
    FROM crew_assignments a
    JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid AND NOT c.is_deleted
    JOIN master_vessels v ON v.vessel_uuid=a.vessel_uuid AND NOT v.is_deleted
    LEFT JOIN crew_assignment_rule_context x ON x.assign_uuid=a.assign_uuid
    LEFT JOIN adm_available_ranks_v2 r ON r.ar_uuid=x.contract_rank_uuid AND NOT r.is_deleted
    LEFT JOIN LATERAL (SELECT count(*) AS n,max(p.sign_off_date) AS relief
      FROM vessel_planning_v2 p WHERE p.crew_assign_uuid=a.assign_uuid
        AND p.crew_uuid=a.crew_uuid AND p.vessel_uuid=a.vessel_uuid
        AND NOT p.is_deleted AND NOT p.is_archived) p ON TRUE
    WHERE a.vessel_uuid=${vesselUuid} AND NOT a.is_deleted
      AND a.assignment_type='OnBoard' AND a.sign_off_date IS NULL
    ORDER BY a.id`)).rows as OnboardAssignment[];
}

/** Same engine as the reliever. Only its server-owned reference dates differ. */
export function calculateOnboardCompliance(input: Omit<ComplianceInput, "plannedJoiningDate"
  | "contractRangeEndMonths" | "plannedContractEndDate"> & {
    referenceDate: string; plannedReliefDate: string | null;
  }): ComplianceResult {
  return calculateTrainingCompliance({ ...input, plannedJoiningDate: input.referenceDate,
    contractRangeEndMonths: null, contractPeriodMonths: null,
    plannedContractEndDate: input.plannedReliefDate });
}

/** Pure display adapter. Selection, validity and equivalents stay in the engine. */
export function onboardDot(course: CourseResult, check: ComplianceResult, today: string): MatrixDot {
  const base = { courseUuid: course.courseUuid, outline: false };
  const blockers = check.issues.filter(i => i.blocking !== false).map(i => i.message);
  if (check.status === "incomplete" || !course.complete || !course.state) {
    const reasons = [...new Set([...blockers, ...course.issues.filter(i => i.blocking !== false).map(i => i.message)])];
    const label = `Incomplete: ${reasons.join("; ") || "The training check could not finish. Retry it."}`;
    return { ...base, color: "grey", label, reasons: [label] };
  }
  if (course.state === "Not held") return { ...base, color: "red", outline: true, label: "Not held", reasons: ["Not held"] };
  if (course.state === "Expired at joining") return { ...base, color: "red", label: "Expired", reasons: ["Expired"] };
  if (course.state === "Expiry not recorded")
    return { ...base, color: "amber", outline: true, label: "Expiry not recorded", reasons: ["Expiry not recorded"] };
  if (course.state === "Valid, no expiry")
    return { ...base, color: "green", label: "Valid, no expiry", reasons: ["Valid, no expiry"] };
  const reasons: string[] = [];
  if (course.state === "Expires during contract") reasons.push("Expires before planned relief");
  const expiry = civilDate(course.chosenCertificate?.expiry ?? null);
  const boundary = contractEndDate(today, 2);
  if ((!check.contractEnd || course.state === "Expires during contract")
    && expiry && boundary && expiry >= today && expiry <= boundary) reasons.push("Expires within 2 months");
  return { ...base, color: reasons.length ? "amber" : "green", label: reasons[0] ?? "Valid",
    reasons: reasons.length ? reasons : ["Valid"] };
}

export async function readOnboardCompliance(db: ReturnType<typeof getDb>,
  canonical: OnboardAssignment, referenceDate: string) {
  const { matrix, issues } = await readSavedTrainingMatrix(db, canonical);
  if (canonical.contractRankUuid && !canonical.rankRowId) issues.push({ code: "MISSING_RANK",
    message: "The captured contract rank is unavailable in the rank master. Ask the office to review it." });
  if (canonical.planningCount > 1) issues.push({ code: "AMBIGUOUS_PLANNING",
    message: "More than one active planning row refers to this contract. Ask the office to confirm its planned relief date." });
  let check: ComplianceResult;
  try {
    check = calculateOnboardCompliance({ ...canonical, referenceDate, matrix,
      certificates: await readTrainingCertificates(db, canonical.crewUuid), issues });
  } catch {
    check = incompleteTrainingCheck(canonical, [{ code: "CALCULATION_FAILED",
      message: "The training check could not finish. Retry it; if it fails again, contact your office." }]);
  }
  return { check, matrix };
}
