import { useEffect, useRef } from "react";
import { apiRequest } from "./queryClient";

export class StaleFormOperation extends Error {}

export function useFormOperationScope(key: string) {
  const scope = useRef({ key, alive: true });
  if (scope.current.key !== key) scope.current = { key, alive: true };
  useEffect(() => {
    scope.current.alive = true;
    return () => { scope.current.alive = false; };
  }, []);
  return () => {
    const captured = scope.current;
    return () => captured === scope.current && captured.alive;
  };
}

export function assertConfirmedDraft(value: any, formId: number, rankGroupId: number | null | undefined) {
  if (!value || !Number.isInteger(value.id) || value.id <= 0 ||
      value.formId !== formId || value.rankGroupId !== rankGroupId || value.status !== "draft") {
    throw new Error("Draft acknowledgement did not match the current form.");
  }
}

export function assertConfirmedRelease(value: any, id: number, formId: number, rankGroupId: number | null | undefined) {
  if (!value || value.id !== id || value.formId !== formId ||
      value.rankGroupId !== rankGroupId || value.status !== "released") {
    throw new Error("Release acknowledgement did not match the current form.");
  }
}

// Only editor entry reconciles ambiguous outcomes automatically. Explicit saves
// must not silently convert an uncertain write into a second replacement write.
export async function openStandardDraft(url: string, payload: any, isCurrent: () => boolean) {
  const ensureCurrent = () => { if (!isCurrent()) throw new StaleFormOperation(); };
  const readDraft = async () => {
    const response = await apiRequest("GET", url);
    const rows = await response.json();
    ensureCurrent();
    if (!Array.isArray(rows)) throw new Error("Unable to confirm the form versions.");
    return rows.find(v => v.formId === payload.formId && v.rankGroupId === payload.rankGroupId && v.status === "draft");
  };
  const existing = await readDraft();
  if (existing) return existing;
  const { formId, ...body } = payload;
  try {
    ensureCurrent();
    const response = await apiRequest("POST", url.split("?")[0], body);
    const saved = await response.json();
    ensureCurrent();
    return saved;
  } catch (error) {
    ensureCurrent();
    // A committed response may have been lost. A read is safe; a blind repeat
    // POST would otherwise risk replacing an already edited draft.
    try {
      const committed = await readDraft();
      if (committed) return committed;
    } catch (readError) {
      if (readError instanceof StaleFormOperation) throw readError;
    }
    throw error;
  }
}

export function standardDraftError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/^(401|403):/.test(message)) return "You do not have access to change this form. Check your sign-in and permissions.";
  if (/^409:/.test(message)) return "The draft could not be confirmed for this source version. Refresh the form versions or ask an administrator to check its configuration.";
  if (/^400:/.test(message)) return "The form configuration could not be saved. Check the highlighted settings and selected rank group, then try again.";
  return "The operation could not be confirmed. Your current selection has been kept. Refresh the form versions before retrying. No further release attempt was made.";
}

export function configurationObject(serialized: string | null | undefined): Record<string, any> {
  try {
    const value = serialized ? JSON.parse(serialized) : null;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
