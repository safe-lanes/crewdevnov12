export const workbookRecovery = "Download the current template, copy your filled values into its white input boxes without changing the layout, and save it as an unencrypted .xlsx file. Choose that file and validate again.";

export class ImportUiError extends Error {}

const workbookCodes = new Set(["FILE_FORMAT", "FILE_SIZE", "FILE_DATA", "WORKBOOK_READ", "UNSUPPORTED_CONTENT", "TEMPLATE_VERSION", "EXTRA_SHEETS", "MODIFIED_LAYOUT", "MODIFIED_HEADING"]);
const safeCodes = new Set([...workbookCodes, "ACCESS_DENIED", "AUTH_UNAVAILABLE", "TEMPLATE_UNAVAILABLE", "CELL_VALIDATION", "DUPLICATE_IMPORT", "SERVICE_UNAVAILABLE"]);

export async function readImportFailure(response: Response) {
  let body: any;
  try { body = await response.json(); } catch { /* HTML gateways and broken JSON are not user messages. */ }
  const code = typeof body?.code === "string" ? body.code : "";
  let fallback = "The service is unavailable. Please try again later.";
  if (response.status === 401) fallback = "Your session has expired. Sign in again before importing.";
  else if (response.status === 403) fallback = "You do not have permission to import candidates for this company.";
  else if (response.status === 409) fallback = "This candidate was already imported. Check the candidate list before trying again.";
  else if (response.status === 422) fallback = "Correct the workbook issues below, then upload the updated file.";
  else if (response.status === 413) fallback = "This workbook is too large. Choose a .xlsx file smaller than 5 MB.";
  else if (response.status === 400) fallback = "This workbook could not be read. Use the current downloaded .xlsx template.";
  const errors = Array.isArray(body?.errors) ? body.errors.filter(isCellError) : [];
  return {
    message: safeCodes.has(code) && typeof body?.message === "string" ? body.message : fallback,
    recovery: workbookCodes.has(code) || response.status === 400 || response.status === 413 ? workbookRecovery : "",
    errors,
  };
}

export function isCellError(item: any): boolean {
  return item && ["sheet", "cell", "field", "message"].every(key => typeof item[key] === "string");
}
