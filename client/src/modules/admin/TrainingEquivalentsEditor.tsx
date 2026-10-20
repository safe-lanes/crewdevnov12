import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type TrainingEquivalentsState = {
  vesselId: string;
  source: { kind: "draft" | "revision" | "none"; uuid: string | null; revision: string | null };
  latestRevisionUuid: string | null;
  links: { requiredCourseUuid: string; acceptedCourseUuid: string }[];
  courses: { courseUuid: string; name: string; code: string }[];
  requirements: { companyTrainingId: number; courseUuid: string; name: string }[];
  revisions: { uuid: string; revision: string }[];
};

type Link = TrainingEquivalentsState["links"][number];

const endpoint = (vesselId: string, revisionUuid?: string) =>
  `/api/v2/admin/training-matrix-equivalents/${encodeURIComponent(vesselId)}${
    revisionUuid ? `?revisionUuid=${encodeURIComponent(revisionUuid)}` : ""
  }`;

const normalizeLinks = (links: Link[]) =>
  [...links]
    .sort((a, b) =>
      `${a.requiredCourseUuid}:${a.acceptedCourseUuid}`.localeCompare(
        `${b.requiredCourseUuid}:${b.acceptedCourseUuid}`,
      ),
    )
    .map(({ requiredCourseUuid, acceptedCourseUuid }) => `${requiredCourseUuid}:${acceptedCourseUuid}`)
    .join("|");

function sourceLabel(state: TrainingEquivalentsState) {
  if (state.source.kind === "draft") return `Draft${state.source.revision ? ` · ${state.source.revision}` : ""}`;
  if (state.source.kind === "revision") return `Revision ${state.source.revision ?? "—"}`;
  return "No saved equivalences";
}

export type TrainingEquivalentsEditorProps = {
  vesselId: string;
  editable: boolean;
  onSaved?: () => void;
  draftData?: { applicableTrainingIds: number[] };
  onDirtyChange?: (dirty: boolean) => void;
};

export default function TrainingEquivalentsEditor({
  vesselId,
  editable,
  onSaved,
  draftData,
  onDirtyChange,
}: TrainingEquivalentsEditorProps) {
  const queryClient = useQueryClient();
  const [activeVesselId, setActiveVesselId] = useState(vesselId);
  const [revisionUuid, setRevisionUuid] = useState("");
  const [links, setLinks] = useState<Link[]>([]);
  const [baseline, setBaseline] = useState("");
  const [openCourseUuid, setOpenCourseUuid] = useState<string | null>(null);
  const previousPropVessel = useRef(vesselId);
  const initializedForKey = useRef("");
  const stateKey = `${activeVesselId}:${revisionUuid || "draft"}`;

  const stateQuery = useQuery<TrainingEquivalentsState>({
    queryKey: ["training-matrix-equivalents", activeVesselId, revisionUuid || null],
    queryFn: async () =>
      (await apiRequest("GET", endpoint(activeVesselId, revisionUuid || undefined))).json(),
    enabled: Boolean(activeVesselId),
  });

  const state = stateQuery.data;
  const historical = Boolean(revisionUuid);
  const canEdit = editable && !historical && activeVesselId === vesselId;
  const dirty = normalizeLinks(links) !== baseline;
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (previousPropVessel.current === vesselId) return;
    previousPropVessel.current = vesselId;
    if (activeVesselId === vesselId) return;
    const approved = !dirty || window.confirm("Discard unsaved equivalence changes and switch vessel?");
    if (approved) {
      setActiveVesselId(vesselId);
      setRevisionUuid("");
      setOpenCourseUuid(null);
    }
  }, [vesselId, dirty, activeVesselId]);

  useEffect(() => {
    if (!state || (initializedForKey.current === stateKey && dirty)) return;
    if (initializedForKey.current === stateKey && normalizeLinks(state.links) === baseline) return;
    initializedForKey.current = stateKey;
    const nextLinks = state.links.map((link) => ({ ...link }));
    setLinks(nextLinks);
    setBaseline(normalizeLinks(nextLinks));
    setOpenCourseUuid(null);
  }, [state, stateKey, dirty, baseline]);

  const requirements = useMemo(() => {
    if (!state) return [];
    const byCourse = new Map<string, { courseUuid: string; name: string; trainingIds: number[] }>();
    state.requirements.forEach((requirement) => {
      const current = byCourse.get(requirement.courseUuid);
      if (current) current.trainingIds.push(requirement.companyTrainingId);
      else byCourse.set(requirement.courseUuid, {
        courseUuid: requirement.courseUuid,
        name: requirement.name || state.courses.find((course) => course.courseUuid === requirement.courseUuid)?.name || "Unnamed course",
        trainingIds: [requirement.companyTrainingId],
      });
    });
    return [...byCourse.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [state]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!state) throw new Error("Training equivalences are not loaded.");
      const response = await apiRequest("PUT", endpoint(activeVesselId), {
        links,
        expectedDraftUuid: state.source.kind === "draft" ? state.source.uuid : null,
        expectedRevisionUuid: state.latestRevisionUuid,
        ...(draftData ? { draftData } : {}),
      });
      return (await response.json()) as TrainingEquivalentsState;
    },
    onSuccess: async (savedState) => {
      queryClient.setQueryData(
        ["training-matrix-equivalents", savedState.vesselId, null],
        savedState,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["training-matrix-equivalents", savedState.vesselId] }),
        queryClient.invalidateQueries({ queryKey: ["tm-vessel-draft", savedState.vesselId] }),
      ]);
      if (savedState.vesselId === activeVesselId) setBaseline(normalizeLinks(savedState.links));
      onSaved?.();
    },
  });

  const errorMessage = (error: unknown) => {
    if (error instanceof Error) {
      try {
        const body = JSON.parse(error.message.replace(/^\d{3}:\s*/, ""));
        if (typeof body.message === "string") return body.message;
      } catch { /* Transport details are not user-facing instructions. */ }
    }
    return "The accepted courses could not be loaded or saved. Check your connection, reload the matrix and try again.";
  };

  const updateAccepted = (requiredCourseUuid: string, acceptedCourseUuid: string) => {
    if (saveMutation.isPending) return;
    setLinks((current) => {
      const exists = current.some(
        (link) => link.requiredCourseUuid === requiredCourseUuid && link.acceptedCourseUuid === acceptedCourseUuid,
      );
      return exists
        ? current.filter(
            (link) => !(link.requiredCourseUuid === requiredCourseUuid && link.acceptedCourseUuid === acceptedCourseUuid),
          )
        : [...current, { requiredCourseUuid, acceptedCourseUuid }];
    });
  };

  const chooseRevision = (nextUuid: string) => {
    if (nextUuid === revisionUuid) return;
    if (dirty && !window.confirm("Discard unsaved equivalence changes and view another revision?")) return;
    setRevisionUuid(nextUuid);
  };

  const courses = state?.courses ?? [];

  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm" data-testid="training-equivalents-editor">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-[#f7fafc] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a]">Training course equivalents</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-600">
            Directional only: a selected course satisfies this required course. Equivalences do not carry over transitively.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="equivalents-revision" className="text-xs text-gray-600">Source</label>
          <select
            id="equivalents-revision"
            value={revisionUuid}
            onChange={(event) => chooseRevision(event.target.value)}
            disabled={!state || state.revisions.length === 0 || saveMutation.isPending}
            className="h-8 max-w-[190px] rounded-md border border-gray-300 bg-white px-2 text-xs text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-sky-500"
            data-testid="training-equivalents-revision-select"
          >
            <option value="">{state ? (canEdit && state.source.kind === "revision" ? `Draft from ${state.source.revision}` : sourceLabel(state)) : "Loading source…"}</option>
            {state?.revisions.map((revision) => (
              <option key={revision.uuid} value={revision.uuid}>Revision {revision.revision}</option>
            ))}
          </select>
        </div>
      </header>

      {activeVesselId !== vesselId && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900" data-testid="vessel-switch-pending">
          <span>Unsaved changes belong to your previous vessel selection. Switch back to continue editing, or discard them.</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-amber-300 bg-white text-[11px]"
            onClick={() => {
              setActiveVesselId(vesselId);
              setRevisionUuid("");
              setOpenCourseUuid(null);
            }}
            data-testid="training-equivalents-confirm-vessel-switch"
          >
            Discard and switch
          </Button>
        </div>
      )}
      {stateQuery.isLoading ? (
        <div className="space-y-3 p-4" aria-label="Loading training equivalents" data-testid="training-equivalents-loading">
          {[0, 1, 2].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-gray-100" />)}
        </div>
      ) : stateQuery.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-xs text-red-700" data-testid="training-equivalents-error">
          <span>{errorMessage(stateQuery.error)}</span>
          <Button variant="outline" size="sm" onClick={() => stateQuery.refetch()} data-testid="training-equivalents-retry">Retry</Button>
        </div>
      ) : !state ? (
        <div className="p-4 text-xs text-gray-600">No training-equivalence data is available.</div>
      ) : requirements.length === 0 ? (
        <div className="p-5 text-center text-xs text-gray-500" data-testid="training-equivalents-empty">
          No required master courses are configured for this vessel.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(180px,0.85fr)_minmax(260px,1.4fr)] border-b border-gray-200 bg-[#52baf3] px-4 py-2 text-xs font-medium text-white max-sm:grid-cols-1">
            <div>Required master course</div>
            <div className="max-sm:hidden">Also satisfied by</div>
          </div>
          <div className="divide-y divide-gray-100" data-testid="training-equivalents-rows">
            {requirements.map((required) => {
              const selected = links
                .filter((link) => link.requiredCourseUuid === required.courseUuid)
                .map((link) => link.acceptedCourseUuid);
              const acceptedNames = selected.map((uuid) => courses.find((course) => course.courseUuid === uuid)?.name || "Unavailable course");
              return (
                <div key={required.courseUuid} className="grid grid-cols-[minmax(180px,0.85fr)_minmax(260px,1.4fr)] items-start gap-4 px-4 py-3 max-sm:grid-cols-1 max-sm:gap-2" data-testid={`training-equivalent-row-${required.courseUuid}`}>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#0f172a]">{required.name}</div>
                    <div className="mt-1 text-[10px] text-gray-500">
                      Required · {required.trainingIds.length} matrix item{required.trainingIds.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 hidden text-[10px] font-medium uppercase tracking-wide text-gray-500 max-sm:block">Also satisfied by</div>
                    {canEdit ? (
                      <Popover open={openCourseUuid === required.courseUuid} onOpenChange={(open) => setOpenCourseUuid(open ? required.courseUuid : null)}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            disabled={saveMutation.isPending}
                            aria-expanded={openCourseUuid === required.courseUuid}
                            className="h-auto min-h-9 w-full justify-between gap-2 px-2 py-1.5 text-left text-xs font-normal"
                            data-testid={`training-equivalents-picker-${required.courseUuid}`}
                          >
                            <span className="flex min-w-0 flex-wrap gap-1">
                              {acceptedNames.length ? acceptedNames.map((name, index) => (
                                <span key={`${selected[index]}-${index}`} className="rounded bg-sky-50 px-1.5 py-0.5 text-[#15569e]">{name}</span>
                              )) : <span className="text-gray-500">Select equivalent courses…</span>}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-0">
                          <Command>
                            <CommandInput placeholder="Search courses by name or code…" />
                            <CommandList data-testid={`training-equivalents-options-${required.courseUuid}`}>
                              <CommandEmpty>No matching courses.</CommandEmpty>
                              <CommandGroup>
                                {courses.filter((course) => course.courseUuid !== required.courseUuid).map((course) => {
                                  const checked = selected.includes(course.courseUuid);
                                  return (
                                    <CommandItem
                                      key={course.courseUuid}
                                      value={`${course.name} ${course.code}`}
                                      onSelect={() => updateAccepted(required.courseUuid, course.courseUuid)}
                                      className="text-xs"
                                      data-testid={`training-equivalent-option-${required.courseUuid}-${course.courseUuid}`}
                                    >
                                      <Checkbox checked={checked} className="pointer-events-none h-4 w-4" />
                                      <span className="min-w-0 flex-1 truncate">{course.name}</span>
                                      <span className="text-[10px] text-gray-500">{course.code}</span>
                                      {checked && <Check className="h-4 w-4 text-[#15569e]" />}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs" data-testid={`training-equivalents-readonly-${required.courseUuid}`}>
                        {acceptedNames.length ? acceptedNames.map((name, index) => (
                          <span key={`${selected[index]}-${index}`} className="rounded bg-white px-1.5 py-0.5 text-gray-700">{name}</span>
                        )) : <span className="text-gray-500">No equivalent courses</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-[#f7fafc] px-4 py-3">
            <div className="text-[11px] text-gray-600" data-testid="training-equivalents-source">
              {canEdit && state.source.kind === "revision" ? `Draft from ${state.source.revision}` : sourceLabel(state)}
              {historical && <span className="ml-2 text-amber-700">Historical view · read-only</span>}
              {dirty && canEdit && <span className="ml-2 font-medium text-amber-700">Unsaved changes</span>}
              {saveMutation.isError && <span className="ml-2 text-red-700" data-testid="training-equivalents-save-error">{errorMessage(saveMutation.error)}</span>}
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                {dirty && (
                  <Button
                    variant="ghost"
                    size="sm"
                     disabled={saveMutation.isPending}
                    onClick={() => { setLinks(state.links.map((link) => ({ ...link }))); setBaseline(normalizeLinks(state.links)); }}
                    className="h-8 text-xs"
                    data-testid="training-equivalents-discard"
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Discard
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={!dirty || saveMutation.isPending}
                  className="h-8 bg-[#15569e] text-xs text-white hover:bg-[#0f4078]"
                  data-testid="training-equivalents-save"
                >
                  {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save draft
                </Button>
              </div>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
