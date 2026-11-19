import { useEffect, useRef, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface InitialStandardVersion {
  id: number;
  fvUuid: string;
  formId: number;
  rankGroupId: number | null;
  versionNo: string;
  versionDate: string;
  status: string;
}

export function readInitialStandardVersions(value: unknown, formId: number, rankGroupId: number): InitialStandardVersion[] {
  if (!Array.isArray(value) || value.some(v => !v || !Number.isInteger(v.id)
    || typeof v.fvUuid !== "string" || !v.fvUuid || v.formId !== formId || v.rankGroupId !== rankGroupId
    || typeof v.versionNo !== "string" || typeof v.versionDate !== "string"
    || (v.status !== "draft" && v.status !== "released"))) {
    throw new Error("The form versions could not be verified. Refresh before editing.");
  }
  return value;
}

/** Automatic only after a confirmed empty query and an explicit writable Configure entry. */
export function useInitialStandardDraft(options: {
  enabled: boolean;
  formId: number;
  rankGroupId: number | null;
  onReady: (version: InitialStandardVersion) => void;
}) {
  const { enabled, formId, rankGroupId, onReady } = options;
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ key: string; subscribers: Set<object>; promise: Promise<InitialStandardVersion> } | null>(null);
  useEffect(() => {
    if (!enabled || !rankGroupId) return;
    const key = `${formId}:${rankGroupId}:${attempt}`;
    const subscriber = {};
    let request = pending.current;
    if (!request || request.key !== key) {
      const subscribers = new Set<object>();
      const versionsUrl = `/api/v2/admin/forms/${formId}/versions?rankGroupId=${rankGroupId}`;
      const read = async () => {
        const response = await apiRequest("GET", versionsUrl);
        const versions = readInitialStandardVersions(await response.json(), formId, rankGroupId);
        return versions.find(v => v.status === "draft")
          ?? [...versions].sort((a, b) => Number(b.versionNo) - Number(a.versionNo))[0];
      };
      const promise = (async () => {
        const existing = await read(); // Reconcile first, including a previous lost response.
        if (existing) return existing;
        if (!subscribers.size) throw new Error("Editor closed");
        try {
          const response = await apiRequest("POST", `/api/v2/admin/forms/${formId}/initial-draft`, { rankGroupId });
          return readInitialStandardVersions([await response.json()], formId, rankGroupId)[0];
        } catch (cause) {
          const confirmed = await read().catch(() => undefined);
          if (confirmed) return confirmed;
          throw cause;
        }
      })();
      request = { key, subscribers, promise };
      pending.current = request;
    }
    request.subscribers.add(subscriber);
    setBusy(true);
    setError("");
    void request.promise.then(version => {
      if (!request.subscribers.has(subscriber)) return;
      onReady(version);
      void queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/forms"] });
    }).catch(() => {
      if (request.subscribers.has(subscriber)) {
        setError("The initial draft could not be confirmed. Refresh the versions and retry. No success has been reported.");
      }
    }).finally(() => {
      if (request.subscribers.has(subscriber)) setBusy(false);
    });
    return () => { request.subscribers.delete(subscriber); };
  }, [enabled, formId, rankGroupId, attempt, onReady]);
  return { busy, error, retry: () => setAttempt(value => value + 1) };
}
