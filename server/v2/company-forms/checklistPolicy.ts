export type ChecklistBlocker = {
  kind: "requirement" | "check";
  status: string;
  formName?: string;
  reason?: string;
  requirementUuid?: string;
  eventUuid?: string;
};

/** An exception is never a substitute for completing a known required form. */
export function checklistOverrideEligible(blockers: readonly ChecklistBlocker[]): boolean {
  return blockers.length > 0 && blockers.every(blocker =>
    blocker.kind === "requirement" ? blocker.status === "UNRESOLVED" :
      ["PENDING", "FAILED"].includes(blocker.status));
}

export function checklistBlockerMessage(blockers: readonly ChecklistBlocker[]): string {
  return blockers.map(blocker => blocker.kind === "requirement"
    ? blocker.status === "UNRESOLVED"
      ? `${blocker.formName}: ${blocker.reason || "A required contract fact is missing. Verify the fact and retry the form check."}`
      : `${blocker.formName}: this mandatory form must be completed.`
    : blocker.status === "NOT_CHECKED"
      ? "The before-joining rules check has not run. Deploy the seafarer and run the check."
      : `The before-joining rules check ${blocker.status === "FAILED" ? "failed" : "is pending"}. Retry the check.`).join(" ");
}

export class ChecklistGateError extends Error {
  readonly status = 409;
  readonly code = "company_forms_checklist_blocked";
  constructor(message: string, readonly blockers: ChecklistBlocker[] = [], readonly canOverride = false) {
    super(message);
  }
}
