import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

type HistoryEntry = {
  snapshotUuid: string;
  recordedAt: string;
  fingerprint: string;
  actor: unknown;
  evidence: {
    check?: {
      calculationVersion?: string;
      joiningDate?: string | null;
      contractEnd?: string | null;
      contractEndSource?: string | null;
      contractRankUuid?: string | null;
      matrixRevision?: string | null;
      courses?: Array<{
        name: string;
        state: string | null;
        chosenCertificate?: { name?: string; number?: string | null; issued?: string | null; expiry?: string | null } | null;
        isEquivalent?: boolean;
      }>;
    };
    overrides?: Array<{ kind?: string; reason?: string; actor?: string; recordedAt?: string }> |
      Record<string, { reason?: string; actor?: string; recordedAt?: string } | null>;
    blockExpiringDuringContract?: boolean;
    blockMissingExpiry?: boolean;
    canonical?: unknown;
    header?: { crewName?: string; vesselName?: string; contractRankLabel?: string } | null;
  };
};

function utcDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getUTCDate()).padStart(2, "0")}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

function actorLabel(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const actor = value as Record<string, unknown>;
    const name = [actor.name, actor.displayName, actor.fullName, actor.email].find(item => typeof item === "string" && item.trim());
    if (typeof name === "string") return name;
    if (typeof actor.masterUserId === "number") return `${typeof actor.roleName === "string" ? actor.roleName : "User"} · user ${actor.masterUserId}`;
  }
  return "Not recorded";
}

export function AcceptedChecklistHistory({ planUuid, open, onOpenChange }: {
  planUuid?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const url = planUuid ? `/api/v2/vessel/planning/${encodeURIComponent(planUuid)}/checklist-history` : "";
  const query = useQuery<HistoryEntry[]>({
    queryKey: ["accepted-checklist-history", planUuid ?? null],
    queryFn: async () => (await apiRequest("GET", url)).json(),
    enabled: open && Boolean(planUuid),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle>Accepted checklist history</DialogTitle></DialogHeader>
      {!planUuid ? <p className="text-sm text-slate-600">A saved planning record is needed to view checklist history.</p> :
        query.isLoading ? <div className="space-y-3" aria-label="Loading checklist history">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-md bg-slate-100" />)}</div> :
          query.isError ? <div className="flex items-center gap-3" role="alert"><AlertCircle className="h-4 w-4 text-rose-700" /><span className="text-sm">Checklist history could not be loaded.</span><Button variant="outline" size="sm" onClick={() => query.refetch()}><RotateCw className="mr-2 h-4 w-4" />Retry</Button></div> :
            !query.data?.length ? <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No accepted checklist snapshots have been recorded for this plan.</p> :
              <div className="space-y-4">
                {query.data.map((entry, index) => {
                  const check = entry.evidence?.check;
                  const recordedOverrides = Array.isArray(entry.evidence?.overrides)
                    ? entry.evidence.overrides
                    : Object.entries(entry.evidence?.overrides ?? {}).flatMap(([kind, item]) => item ? [{ ...item, kind }] : []);
                  return <article key={entry.snapshotUuid} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4" data-testid={`checklist-history-${index}`}>
                    <header className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-3">
      <div><h3 className="font-semibold text-slate-800">Accepted checklist</h3><p className="text-sm text-slate-600">Saved {utcDate(entry.recordedAt)} {new Date(entry.recordedAt).toISOString().slice(11,16)} UTC by {actorLabel(entry.actor)}</p></div>
                      <span className="text-xs text-slate-500">Fingerprint: <span className="break-all font-mono">{entry.fingerprint || "Not available"}</span></span>
                    </header>
                    <section className="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2" aria-label="Saved checklist inputs">
                      <HistoryField label="Matrix revision" value={check?.matrixRevision || "Not recorded"} />
                      <HistoryField label="Calculation version" value={check?.calculationVersion || "Not recorded"} />
                      <HistoryField label="Planned joining" value={utcDate(check?.joiningDate)} />
                      <HistoryField label={check?.contractEndSource === "contract_period" ? "Contract end (based on contract period)" : "Contract end"} value={utcDate(check?.contractEnd)} />
                      <HistoryField label="Seafarer" value={entry.evidence.header?.crewName || "Not recorded"} />
                      <HistoryField label="Vessel" value={entry.evidence.header?.vesselName || "Not recorded"} />
                      <HistoryField label="Contract rank" value={entry.evidence.header?.contractRankLabel || "Not recorded"} />
                      <HistoryField label="Expiring certificates block deployment" value={entry.evidence?.blockExpiringDuringContract === undefined ? "Not recorded" : entry.evidence.blockExpiringDuringContract ? "Yes" : "No"} />
                      <HistoryField label="Missing expiry blocks deployment" value={entry.evidence.blockMissingExpiry == null ? "Not recorded" : entry.evidence.blockMissingExpiry ? "Yes" : "No"} />
                    </section>
                    <section>
                      <h4 className="mb-2 text-sm font-semibold text-slate-800">Training results</h4>
                      {!check?.courses?.length ? <p className="text-sm text-slate-600">No course results were saved.</p> :
                        <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
                          {check.courses.map((course, courseIndex) => <div key={`${course.name}-${courseIndex}`} className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[1.2fr_0.8fr_1.4fr]">
                            <span className="font-medium text-slate-800">{course.name}</span><span className="text-slate-700">{course.state || "No result"}{course.isEquivalent ? " · Equivalent" : ""}</span>
                            <span className="text-slate-600">{course.chosenCertificate ? `${course.chosenCertificate.number ? `${course.chosenCertificate.number} — ` : ""}${course.chosenCertificate.name || "Certificate"} · issued ${utcDate(course.chosenCertificate.issued)} · expiry ${course.chosenCertificate.expiry ? utcDate(course.chosenCertificate.expiry) : course.state === "Valid, no expiry" ? "No expiry" : "Not recorded"}` : "No certificate counted"}</span>
                          </div>)}
                        </div>}
                    </section>
                    <section>
                      <h4 className="mb-2 text-sm font-semibold text-slate-800">Recorded overrides</h4>
                      {recordedOverrides.length ? <ul className="space-y-2">{recordedOverrides.map((override, overrideIndex) =>
                        <li key={overrideIndex} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
                          <span className="font-medium">{override.kind?.toLowerCase().includes("training") ? "Training compliance" : "Company Forms checklist"}</span>
                          {override.reason ? ` — ${override.reason}` : ""}{override.actor ? ` · ${override.actor}` : ""}{override.recordedAt ? ` · ${utcDate(override.recordedAt)}` : ""}
                        </li>)}</ul> : <p className="text-sm text-slate-600">No overrides were recorded.</p>}
                    </section>
                  </article>;
                })}
              </div>}
    </DialogContent>
  </Dialog>;
}

function HistoryField({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div><div className="break-words text-slate-800">{value}</div></div>;
}
