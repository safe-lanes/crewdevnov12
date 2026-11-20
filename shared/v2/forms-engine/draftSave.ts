/** Explicit saves are presentation metadata, never a new workflow status. */
export interface DraftSaveReceipt {
  lastDraftSavedAt: string;
  lastDraftSavedByUuid: string;
  lastDraftSavedByName: string | null;
}
