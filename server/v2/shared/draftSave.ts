import type { DraftSaveReceipt } from "../../../shared/v2/forms-engine/draftSave";

export function draftSaveMetadata(user: {
  id: number; userUuid?: string | null; fullname?: string | null;
  displayName?: string | null; firstname?: string | null; lastname?: string | null;
}) {
  return {
    lastDraftSavedAt: new Date(),
    lastDraftSavedByUuid: user.userUuid || String(user.id),
    lastDraftSavedByName: user.fullname?.trim() || user.displayName?.trim()
      || [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || null,
  };
}
export function draftSaveReceipt(metadata: ReturnType<typeof draftSaveMetadata>): DraftSaveReceipt {
  return { ...metadata, lastDraftSavedAt: metadata.lastDraftSavedAt.toISOString() };
}
