import type { ComplianceResult } from "./types";

export type TrainingBlocker = {
  kind: "training"; status: string; courseName?: string; courseUuid?: string; reason: string;
};
export function trainingChecklistPolicy(check: ComplianceResult, blockExpiring: boolean, blockMissingExpiry = false) {
  const blockers: TrainingBlocker[] = [];
  const warnings: string[] = [];
  for (const course of check.courses) {
    const reason = course.issues.filter(i => i.blocking !== false).map(i => i.message).join(" ");
    if (course.obligation === "mandatory" && (!course.complete || course.state === "Not held" ||
        course.state === "Expired at joining" || (blockExpiring && course.state === "Expires during contract") ||
        (blockMissingExpiry && course.state === "Expiry not recorded"))) {
      blockers.push({ kind: "training", courseName: course.name, courseUuid: course.courseUuid,
        status: !course.complete ? "INCOMPLETE" : course.state!,
        reason: !course.complete ? reason || "The training check is incomplete. Correct the course record and retry."
          : `${course.state}. ${course.state === "Expires during contract"
            ? "Tenant policy requires full-contract validity." : course.state === "Expiry not recorded"
              ? "Enter the expiry date in crew profile → D3 Training Courses." : "Provide a valid certificate at joining."}` });
    } else if (course.state === "Expires during contract" || course.state === "Expiry not recorded" || course.obligation === "recommended" &&
        (!course.complete || ["Not held", "Expired at joining"].includes(course.state ?? ""))) {
      warnings.push(`${course.name}: ${course.state || "check incomplete"}.`);
    }
    for (const issue of course.issues.filter(i => i.blocking === false))
      warnings.push(`${course.name}: ${issue.message}`);
  }
  // Missing canonical facts/matrix or calculation failure could hide mandatory
  // requirements. Recommended-only certificate problems never block acceptance.
  for (const issue of check.issues.filter(i => i.blocking !== false && !i.courseUuid)) {
    blockers.push({ kind: "training", status: "INCOMPLETE", reason: issue.message });
  }
  if (check.status === "incomplete" && !blockers.length && !check.courses.length)
    blockers.push({ kind: "training", status: "INCOMPLETE",
      reason: "The training check could not establish the required courses. Verify the contract facts and matrix, then retry." });
  for (const issue of check.issues.filter(i => i.blocking === false && !i.courseUuid))
    warnings.push(issue.message);
  return { blockers, warnings: [...new Set(warnings)] };
}

export function trainingBlockerMessage(blockers: readonly TrainingBlocker[]) {
  return blockers.map(b => `${b.courseName ? `${b.courseName}: ` : ""}${b.reason} ` +
    "Override training compliance with a written reason is required to proceed without correcting this gap.").join(" ");
}
