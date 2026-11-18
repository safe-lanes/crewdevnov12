import { useEffect, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const root = "/api/v2/admin/training-matrix-vessel-";
type RecordData = { id?: number; tmvrUuid?: string; tmvdUuid?: string; revision?: string; revisionDate?: string; revisionData?: unknown; draftData?: unknown };
export type MatrixBaseline = { ids: Set<number>; revisions: RecordData[]; draft: RecordData | null; nextRevision: string };
type Outcome = "pending" | "saved" | "failed" | "uncertain";
type Kind = "draft" | "submit";
type Target = { vesselId: string; ids: number[]; before: MatrixBaseline; outcome: Outcome };
type Operation = { kind: Kind; date: string; targets: Target[] };

// Preserve the formats already supported by Admin's vessel matrix.
// Malformed data is an error, never an empty baseline that can overwrite a vessel.
export function matrixIds(raw: unknown): Set<number> {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object") throw new Error("The saved training matrix could not be read.");
  if (Array.isArray(data)) return new Set(data.filter(id => typeof id === "number"));
  if ("applicableTrainingIds" in data) {
    const ids = (data as { applicableTrainingIds: unknown }).applicableTrainingIds;
    if (!Array.isArray(ids)) throw new Error("The saved training matrix could not be read.");
    return new Set(ids.filter(id => typeof id === "number"));
  }
  return new Set(Object.entries(data)
    .filter(([key, value]) => !isNaN(Number.parseInt(key)) && (value === "M" || value === "R" || value === true))
    .map(([key]) => Number.parseInt(key)));
}

export function applyMatrixChanges(baseline: Set<number>, changes: Map<number, boolean>): Set<number> {
  const next = new Set(baseline);
  changes.forEach((checked, id) => checked ? next.add(id) : next.delete(id));
  return next;
}

async function readJson(url: string) {
  return (await apiRequest("GET", url)).json();
}

export async function readMatrixBaseline(vesselId: string): Promise<MatrixBaseline> {
  const id = encodeURIComponent(vesselId);
  const [drafts, revisions, next] = await Promise.all([
    readJson(`${root}drafts/by-vessel/${id}`),
    readJson(`${root}revisions/by-vessel/${id}`),
    readJson(`${root}revisions/next-revision/${id}`),
  ]);
  if (!Array.isArray(drafts) || !Array.isArray(revisions) || typeof next?.nextRevision !== "string")
    throw new Error("The vessel matrix response is incomplete. Retry loading it.");
  const draft = drafts[0] || null;
  const latest = [...revisions].sort((a, b) =>
    Number.parseInt((b.revision || "R0").slice(1)) - Number.parseInt((a.revision || "R0").slice(1)))[0];
  // Null legacy configuration historically represents no applicable courses.
  const raw = draft?.draftData ?? latest?.revisionData;
  return { ids: raw == null ? new Set() : matrixIds(raw), revisions, draft, nextRevision: next.nextRevision };
}

const sameIds = (a: Set<number>, b: number[]) => a.size === b.length && b.every(id => a.has(id));
const revisionIdentity = (r: RecordData) => r.tmvrUuid ?? r.id;

// A read proving the intended state exists resolves a lost response without another write.
// Absence does not prove failure (the original request may still be committing).
export async function matrixWriteConfirmed(target: Target, kind: Kind, date: string): Promise<boolean> {
  const current = await readMatrixBaseline(target.vesselId);
  if (kind === "draft") return !!current.draft && sameIds(matrixIds(current.draft.draftData), target.ids);
  const beforeIds = new Set(target.before.revisions.map(revisionIdentity));
  const added = current.revisions.filter(r => revisionIdentity(r) != null && !beforeIds.has(revisionIdentity(r)));
  return added.length === 1 &&
    added[0].revisionDate?.slice(0, 10) === date &&
    sameIds(matrixIds(added[0].revisionData), target.ids);
}

export function useTrainingMatrixVessels(selected: string[], enabled: boolean) {
  const vesselIds = [...new Set(selected)];
  const queries = useQueries({
    queries: vesselIds.map(vesselId => ({
      queryKey: ["tm-vessel-baseline", vesselId],
      queryFn: () => readMatrixBaseline(vesselId),
      enabled,
      staleTime: 0,
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });
  const client = useQueryClient();
  const { toast } = useToast();
  const [revisionMode, setRevisionMode] = useState(false);
  const [snapshots, setSnapshots] = useState(new Map<string, MatrixBaseline>());
  const [changes, setChanges] = useState(new Map<number, boolean>());
  const [busy, setBusy] = useState(false);
  const operation = useRef<Operation | null>(null);
  const busyRef = useRef(false);
  const [outcomes, setOutcomes] = useState<{ vesselId: string; outcome: Outcome }[]>([]);
  const selectionKey = JSON.stringify(vesselIds);
  useEffect(() => { setOutcomes([]); }, [selectionKey]);
  const ready = enabled && vesselIds.length > 0 && queries.every(q => q.isSuccess && !q.isFetching);
  const loadErrors = vesselIds.filter((_, i) => queries[i].isError);
  const baselines = revisionMode ? snapshots : new Map(vesselIds.flatMap((id, i) =>
    queries[i].data ? [[id, queries[i].data!] as const] : []));
  const applicable = new Map(vesselIds.map(id => [
    id, applyMatrixChanges(baselines.get(id)?.ids || new Set(), changes),
  ]));
  const editable = revisionMode && !busy && !operation.current;
  const publishOutcomes = () => setOutcomes((operation.current?.targets || []).map(({ vesselId, outcome }) => ({ vesselId, outcome })));
  const invalidate = (id: string) => {
    void client.invalidateQueries({ predicate: q =>
      ["tm-vessel-baseline", "tm-vessel-revisions", "tm-next-revision", "tm-vessel-draft", "training-matrix-equivalents"]
        .includes(String(q.queryKey[0])) && q.queryKey[1] === id,
    }).catch(() => { /* A refresh failure must not change a confirmed save outcome. */ });
  };
  const start = () => {
    if (!ready || busyRef.current) return false;
    setSnapshots(new Map(vesselIds.map((id, i) => [id, queries[i].data!])));
    setChanges(new Map());
    setOutcomes([]);
    operation.current = null;
    setRevisionMode(true);
    return true;
  };
  const cancel = () => {
    if (busyRef.current) return;
    operation.current = null;
    setChanges(new Map());
    setOutcomes([]);
    setSnapshots(new Map());
    setRevisionMode(false);
    vesselIds.forEach(invalidate);
  };
  const setChecked = (id: number, checked: boolean) => {
    if (!editable) return;
    setChanges(prev => {
      const next = new Map(prev);
      if (vesselIds.every(v => snapshots.get(v)?.ids.has(id) === checked)) next.delete(id);
      else next.set(id, checked);
      return next;
    });
  };
  const checkboxState = (id: number) => {
    const count = vesselIds.filter(v => applicable.get(v)?.has(id)).length;
    return { checked: count > 0 && count === vesselIds.length, mixed: count > 0 && count < vesselIds.length };
  };
  const save = async (kind: Kind, date = "") => {
    if (busyRef.current || !revisionMode || (kind === "submit" && !date)) return;
    if (operation.current && operation.current.kind !== kind) return;
    if (!operation.current) {
      if (!vesselIds.every(id => snapshots.has(id))) return;
      operation.current = {
        kind, date,
        targets: vesselIds.map(vesselId => ({
          vesselId, before: snapshots.get(vesselId)!,
          ids: Array.from(applicable.get(vesselId) || []), outcome: "pending",
        })),
      };
    }
    busyRef.current = true;
    setBusy(true);
    const op = operation.current;
    publishOutcomes();
    try {
      // Sequential processing bounds load and snapshots targets for the entire operation.
      for (const target of op.targets) {
        if (target.outcome === "saved") continue;
        if (target.outcome === "uncertain") {
          try {
            if (await matrixWriteConfirmed(target, op.kind, op.date)) {
              target.outcome = "saved";
              invalidate(target.vesselId);
            }
          } catch { /* Keep the uncertain outcome blocked; never automatically replay it. */ }
          publishOutcomes();
          continue;
        }
        try {
          const data = { applicableTrainingIds: target.ids };
          await apiRequest("POST", `${root}${kind === "draft" ? "drafts/upsert" : "revisions/submit"}`,
            kind === "draft" ? { vesselId: target.vesselId, draftData: data } :
              { vesselId: target.vesselId, revisionDate: op.date, revisionData: data });
          target.outcome = "saved";
          invalidate(target.vesselId);
        } catch (error) {
          // Validation/authorization rejection cannot have committed a matrix.
          // Treat timeouts, network errors and server errors conservatively.
          target.outcome = /^(400|401|403|404|409|422|429):/.test(String((error as Error)?.message))
            ? "failed" : "uncertain";
          if (target.outcome === "uncertain") {
            try {
              if (await matrixWriteConfirmed(target, op.kind, op.date)) {
                target.outcome = "saved";
                invalidate(target.vesselId);
              }
            } catch { /* Retain an explicit uncertain outcome for safe reconciliation. */ }
          }
        }
        publishOutcomes();
      }
      const saved = op.targets.filter(t => t.outcome === "saved").length;
      const complete = saved === op.targets.length;
      toast({
        title: complete ? (kind === "draft" ? "Drafts saved" : "Revisions submitted") : "Some vessels need attention",
        description: `${saved} of ${op.targets.length} vessel(s) saved.${complete ? "" : " Review the per-vessel results before retrying."}`,
        variant: complete ? "default" : "destructive",
      });
      if (complete) {
        if (op.kind === "submit") {
          setRevisionMode(false);
          setSnapshots(new Map());
        } else {
          setSnapshots(new Map(op.targets.map(t => [t.vesselId, { ...t.before, ids: new Set(t.ids) }])));
        }
        setChanges(new Map());
        operation.current = null;
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return {
    revisionMode, ready, loadErrors, applicable, checkboxState, setChecked, start, cancel, save,
    busy, editable, outcomes, operationKind: operation.current?.kind,
    retryLoads: () => queries.forEach(q => { void q.refetch(); }),
    nextRevision: vesselIds.length > 1 ? "Auto (per vessel)" : baselines.get(vesselIds[0])?.nextRevision || "—",
  };
}
