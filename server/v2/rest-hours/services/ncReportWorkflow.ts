import type { InsertRhNcReportV2, RhNcReportV2 } from "../../../../shared/v2/rest-hours/types";

export class NCReportWorkflowError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 409) {
    super(message);
    this.name = "NCReportWorkflowError";
  }
}

// Call only with the persisted row locked in the same transaction as its update.
export function ncReportUpdatePatch(
  current: Pick<RhNcReportV2, "submissionStatus">,
  patch: Partial<InsertRhNcReportV2>,
): Partial<InsertRhNcReportV2> {
  if (current.submissionStatus === "office-submitted") {
    throw new NCReportWorkflowError(
      "This NC report has been submitted by office and is locked. Your changes were not saved. Reopen the report to review the saved version.",
      409,
    );
  }
  const requested = patch.submissionStatus;
  if (requested != null && !["draft", "vessel-submitted", "office-submitted"].includes(requested)) {
    throw new NCReportWorkflowError("Invalid NC report submission status.", 400);
  }
  // Omitted stage is a content save. Legacy Save sends draft: neither can undo
  // a completed Vessel submission. Existing forward paths remain supported.
  const next = requested === "office-submitted" || requested === "vessel-submitted"
    ? requested
    : current.submissionStatus || "draft";
  return {
    ...patch,
    submissionStatus: next,
    status: next === "office-submitted" ? "Closed" : "Open",
  };
}
