export const WORKBOOK_RECOVERY = "Download the current template, copy your filled values into its white input boxes without changing the layout, and save it as an unencrypted .xlsx file. Choose that file and validate again.";

/** Only errors created explicitly by our validation rules may reach clients. */
export class WorkbookValidationError extends Error {
  readonly recovery = WORKBOOK_RECOVERY;
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "WorkbookValidationError";
  }
}

// Library/SQL messages can contain uploaded cell values or candidate data.
export function logImportFailure(stage: string, error: unknown) {
  console.error(`[Candidate import] ${stage} failed`, {
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
}

export function unreadableWorkbook(error?: unknown): WorkbookValidationError {
  if (error) logImportFailure("workbook reader", error);
  return new WorkbookValidationError("WORKBOOK_READ", "This workbook could not be opened. It may be incomplete, password-protected, or not a supported Excel workbook.");
}
