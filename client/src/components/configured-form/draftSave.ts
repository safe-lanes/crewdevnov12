import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DraftSaveReceipt } from "@shared/v2/forms-engine/draftSave";

export class DraftSaveUnconfirmedError extends Error {
  constructor() { super("Draft save could not be confirmed. Reopen the record to check its saved state before retrying."); }
}
export async function explicitDraftRequest(url: string, body: unknown): Promise<Response> {
  try { return await apiRequest("PUT", url, body); }
  catch (error) {
    // A known HTTP rejection is different from a lost response after commit.
    if (error instanceof Error && /^\d{3}:/.test(error.message)) throw error;
    throw new DraftSaveUnconfirmedError();
  }
}
export async function readDraftSaveReceipt(response: Response): Promise<DraftSaveReceipt> {
  const value = await response.json().catch(() => null);
  if (!value || typeof value.lastDraftSavedAt !== "string"
    || !Number.isFinite(Date.parse(value.lastDraftSavedAt))
    || typeof value.lastDraftSavedByUuid !== "string" || !value.lastDraftSavedByUuid
    || (value.lastDraftSavedByName !== null && typeof value.lastDraftSavedByName !== "string")) {
    throw new DraftSaveUnconfirmedError();
  }
  return value;
}

export function useStandardSectionDraftSave(
  base: string, submissionUuid: string, states: Record<string, any> | undefined,
  data: any, flush: () => Promise<void>,
) {
  const client = useQueryClient();
  const active = useRef<string | null>(submissionUuid);
  const operations = useRef(new Set<string>());
  const [sectionSubmitting, setSectionSubmitting] = useState<Record<string, boolean>>({});
  active.current = submissionUuid;
  useEffect(() => { active.current = submissionUuid; return () => { active.current = null; }; }, [submissionUuid]);
  const sectionStates = Object.fromEntries(Object.entries(states ?? {}).map(([id, state]) => {
    const saved = data?.section_states?.find((s: any) => s.section_uuid === id);
    return [id, { ...state,
      lastDraftSavedAt: saved?.last_draft_saved_at,
      lastDraftSavedByName: saved?.last_draft_saved_by_name,
    }];
  }));
  const save = async (sectionUuid: string) => {
    const key = `${submissionUuid}:${sectionUuid}`;
    if (operations.current.has(key)) throw new Error("A section action is already in progress.");
    operations.current.add(key);
    try {
      await flush();
      if (active.current !== submissionUuid) return;
      const receipt = await readDraftSaveReceipt(await explicitDraftRequest(
        `${base}/submissions/${submissionUuid}/sections/${sectionUuid}/answers`,
        { answers: [], explicitDraftSave: true }));
    // The write receipt is authoritative; no follow-up GET is needed to
    // acknowledge it, nor can a failed GET turn it into a reported failed save.
      client.setQueryData([base, submissionUuid], (current: any) => current ? {
      ...current, section_states: current.section_states.map((s: any) => s.section_uuid === sectionUuid ? {
        ...s, last_draft_saved_at: receipt.lastDraftSavedAt,
        last_draft_saved_by_uuid: receipt.lastDraftSavedByUuid,
        last_draft_saved_by_name: receipt.lastDraftSavedByName,
      } : s),
      } : current);
    } finally { operations.current.delete(key); }
  };
  const submit = async (sectionUuid: string, action: () => Promise<void>) => {
    const key = `${submissionUuid}:${sectionUuid}`;
    if (operations.current.has(key)) return;
    operations.current.add(key);
    setSectionSubmitting(current => ({ ...current, [sectionUuid]: true }));
    try { await action(); }
    finally {
      operations.current.delete(key);
      if (active.current === submissionUuid) setSectionSubmitting(current => ({ ...current, [sectionUuid]: false }));
    }
  };
  return { sectionStates, save, submit, sectionSubmitting };
}
