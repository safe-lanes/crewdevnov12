import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, CircleHelp, LoaderCircle, LockKeyhole, Plus, Save } from "lucide-react";
import type { VersionApplicability } from "@shared/v2/admin/applicability";
import type { ApplicabilityDraft } from "@shared/v2/admin/applicabilityPreview";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CompanyFormConditionCard,
  createCondition,
  isApplicabilitySetValid,
  type ApplicabilityEditorDimension,
} from "./CompanyFormConditionCard";
import type { EditableApplicabilityPolicy, EditableApplicabilitySet } from "./companyFormApplicabilityTypes";
import { summarizeApplicability } from "./applicabilitySummary";
import { CompanyFormRuleTrial } from "./CompanyFormRuleTrial";

export interface CompanyFormApplicabilityEditorProps {
  formId: number;
  versionId: number;
  versionUuid: string;
  status: string;
  stageKey: string;
  readOnly?: boolean;
  stageBusy?: boolean;
  navigationBusy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterSaveHandler?: (
    versionUuid: string,
    handler: () => Promise<boolean>,
  ) => (() => void) | void;
  onSaved?: () => void | Promise<void>;
}

type PolicyDraft = EditableApplicabilityPolicy;

const defaultDraft = (): PolicyDraft => ({
  mode: "all",
  obligation: "mandatory",
  effectiveKind: "on_release",
  specificDate: "",
  effectiveFrom: null,
  sets: [],
});

function asDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function policyFromResponse(policy: VersionApplicability, nextUiKey: () => string): PolicyDraft {
  return {
    mode: policy.mode,
    obligation: policy.obligation ?? "mandatory",
    effectiveKind: policy.effectiveKind ?? "on_release",
    specificDate: asDateInput(policy.specificDate),
    effectiveFrom: policy.effectiveFrom,
    sets: (policy.sets ?? []).map((set) => ({
      uiKey: nextUiKey(),
      setUuid: set.setUuid,
      conditions: set.conditions.map((condition) => ({
        uiKey: nextUiKey(),
        conditionUuid: condition.conditionUuid,
        dimensionKey: condition.dimensionKey,
        operator: condition.operator,
        value: condition.value,
        valueLabels: condition.valueLabels,
      })),
    })),
  };
}

function toPayload(draft: PolicyDraft): ApplicabilityDraft {
  if (draft.mode === "manual_only") return { mode: "manual_only" };
  return {
    mode: draft.mode,
    obligation: draft.obligation,
    effectiveKind: draft.effectiveKind,
    ...(draft.effectiveKind === "specific_date" ? { specificDate: draft.specificDate } : {}),
    ...(draft.mode === "conditional"
      ? {
          sets: draft.sets.map((set) => ({
            setUuid: set.setUuid,
            conditions: set.conditions.map((condition) => ({
              conditionUuid: condition.conditionUuid,
              dimensionKey: condition.dimensionKey,
              operator: condition.operator,
              value: condition.value,
            })),
          })),
        }
      : {}),
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text();
    let message = raw || "The request could not be completed.";
    try {
      const parsed = JSON.parse(raw);
      message = parsed.error || parsed.message || message;
    } catch {
      // Preserve the server's plain-text error.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function CompanyFormApplicabilityEditor({
  formId,
  versionId,
  versionUuid,
  status,
  stageKey,
  readOnly = false,
  stageBusy = false,
  navigationBusy = false,
  onBusyChange,
  onDirtyChange,
  onRegisterSaveHandler,
  onSaved,
}: CompanyFormApplicabilityEditorProps) {
  const { permissions, isLoading: permissionsLoading } = usePermissions();
  const formsPermission = permissions.find((permission) => permission.menuName.trim().toLowerCase() === "forms");
  const permissionToView = formsPermission?.canview === true;
  const permissionToEdit = formsPermission?.canedit === true;
  const isReleased = status !== "draft";
  const policySaveForbidden = readOnly || isReleased || permissionsLoading || !permissionToEdit || !permissionToView;
  const locked = policySaveForbidden || navigationBusy;
  const [draft, setDraft] = useState<PolicyDraft>(defaultDraft);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [dimensions, setDimensions] = useState<ApplicabilityEditorDimension[]>([]);
  const requestGeneration = useRef(0);
  const uiKeySequence = useRef(0);
  const onBusyRef = useRef(onBusyChange);
  const onDirtyRef = useRef(onDirtyChange);
  const onSavedRef = useRef(onSaved);
  const saveForNavigationRef = useRef<() => Promise<boolean>>(async () => false);
  const nextUiKey = useCallback(() => `policy-input-${++uiKeySequence.current}`, []);
  onBusyRef.current = onBusyChange;
  onDirtyRef.current = onDirtyChange;
  onSavedRef.current = onSaved;

  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  const isDirty = !loading && baseline !== "" && serializedDraft !== baseline;
  const dirtyForNavigationRef = useRef(isDirty);
  const lockedForNavigationRef = useRef(locked || loading || saving);
  dirtyForNavigationRef.current = isDirty;
  lockedForNavigationRef.current = policySaveForbidden || loading || saving;

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setLoadError("");
    setSaveError("");
    try {
      const [policyResponse, dimensionsResponse] = await Promise.all([
        apiRequest("GET", `/api/v2/admin/form-versions/${versionId}/applicability`),
        apiRequest("GET", `/api/v2/admin/forms/${formId}/rule-dimensions`),
      ]);
      const [policy, dimensions] = await Promise.all([
        parseResponse<VersionApplicability>(policyResponse),
        parseResponse<ApplicabilityEditorDimension[]>(dimensionsResponse),
      ]);
      if (requestGeneration.current !== generation) return;
      const next = policyFromResponse(policy, nextUiKey);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setDimensions(Array.isArray(dimensions) ? dimensions : []);
    } catch {
      if (requestGeneration.current !== generation) return;
      setLoadError("We couldn’t load applicability settings. Refresh the editor and try again.");
    } finally {
      if (requestGeneration.current === generation) setLoading(false);
    }
  }, [formId, nextUiKey, versionId]);

  useEffect(() => {
    if (permissionsLoading || !permissionToView) {
      setLoading(permissionsLoading);
      return;
    }
    void load();
    return () => {
      requestGeneration.current += 1;
      onBusyRef.current?.(false);
      onDirtyRef.current?.(false);
    };
  }, [load, permissionToView, permissionsLoading, status, versionUuid]);

  useEffect(() => {
    onBusyRef.current?.(loading || saving);
  }, [loading, saving]);

  useEffect(() => {
    onDirtyRef.current?.(isDirty);
  }, [isDirty]);

  const changeMode = (nextMode: PolicyDraft["mode"]) => {
    if (locked || saving || nextMode === draft.mode) return;
    const discardsConditional = draft.mode === "conditional" && nextMode !== "conditional" && draft.sets.length > 0;
    const discardsAutomaticSettings = nextMode === "manual_only"
      && (draft.obligation !== "mandatory" || draft.effectiveKind !== "on_release" || !!draft.specificDate);
    if ((discardsConditional || discardsAutomaticSettings)
      && !window.confirm("Changing this mode will discard some conditional or due-date settings. Continue?")) return;
    setDraft((current) => ({
      ...current,
      mode: nextMode,
      sets: nextMode === "conditional"
        ? current.sets.length > 0
          ? current.sets
          : [{ uiKey: nextUiKey(), conditions: [createCondition(nextUiKey(), dimensions)] }]
        : [],
      obligation: nextMode === "manual_only" ? "mandatory" : current.obligation,
      effectiveKind: nextMode === "manual_only" ? "on_release" : current.effectiveKind,
      specificDate: nextMode === "manual_only" ? "" : current.specificDate,
    }));
    setSaveError("");
  };

  const save = async (): Promise<boolean> => {
    if (policySaveForbidden || saving || loading) return false;
    if (!isDirty) return true;
    if (
      !conditionSetsValid
      || (draft.mode !== "manual_only" && draft.effectiveKind === "specific_date" && !draft.specificDate)
    ) {
      setSaveError("Complete every condition and choose an effective date before saving.");
      return false;
    }
    const versionAtSave = versionUuid;
    const generationAtSave = requestGeneration.current;
    setSaving(true);
    setSaveError("");
    try {
      const response = await apiRequest(
        "PUT",
        `/api/v2/admin/form-versions/${versionId}/applicability`,
        toPayload(draft),
      );
      const savedPolicy = await parseResponse<VersionApplicability>(response);
      if (requestGeneration.current !== generationAtSave) return;
      const normalized = policyFromResponse(savedPolicy, nextUiKey);
      setDraft(normalized);
      setBaseline(JSON.stringify(normalized));
      await onSavedRef.current?.();
      return true;
    } catch {
      if (requestGeneration.current !== generationAtSave) return false;
      setSaveError("We couldn’t save applicability settings. Check the draft and try again.");
      return false;
    } finally {
      if (requestGeneration.current === generationAtSave && versionUuid === versionAtSave) setSaving(false);
    }
  };
  saveForNavigationRef.current = save;
  const registeredSaveHandler = useCallback(async () => {
    if (!dirtyForNavigationRef.current) return true;
    if (lockedForNavigationRef.current) return false;
    return saveForNavigationRef.current();
  }, []);

  useEffect(() => {
    if (status !== "draft") return;
    return onRegisterSaveHandler?.(versionUuid, registeredSaveHandler);
  }, [onRegisterSaveHandler, registeredSaveHandler, status, versionUuid]);

  const conditionSetsValid = draft.mode !== "conditional"
    || (draft.sets.length > 0 && draft.sets.every((set) => isApplicabilitySetValid(set, dimensions)));
  const summary = summarizeApplicability(draft, dimensions, { status });

  const updateSet = (setKey: string, nextSet: EditableApplicabilitySet) => {
    setDraft((current) => ({
      ...current,
      sets: current.sets.map((set) => set.uiKey === setKey ? nextSet : set),
    }));
  };

  const addSet = () => {
    setDraft((current) => ({
      ...current,
      sets: [...current.sets, { uiKey: nextUiKey(), conditions: [createCondition(nextUiKey(), dimensions)] }],
    }));
  };

  const addCondition = (setKey: string) => {
    setDraft((current) => ({
      ...current,
      sets: current.sets.map((set) => set.uiKey === setKey
        ? { ...set, conditions: [...set.conditions, createCondition(nextUiKey(), dimensions)] }
        : set),
    }));
  };

  const removeCondition = (setKey: string, conditionKey: string) => {
    setDraft((current) => ({
      ...current,
      sets: current.sets.map((set) => set.uiKey === setKey
        ? { ...set, conditions: set.conditions.filter((condition) => condition.uiKey !== conditionKey) }
        : set),
    }));
  };

  if (!permissionToView) {
    return (
      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600" aria-label="Company Form applicability">
        You do not have permission to view Company Form applicability settings.
      </section>
    );
  }

  return (
    <section
      className="mt-4 rounded-xl border border-[#d9e2e8] bg-[#f7fafb] p-4 sm:p-5"
      aria-labelledby="company-form-applicability-title"
      data-testid="company-form-applicability-editor"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 id="company-form-applicability-title" className="text-sm font-semibold text-[#18374a]">Who this version applies to</h3>
            {isReleased && <span className="inline-flex items-center gap-1 rounded-full bg-[#e7eef1] px-2 py-0.5 text-xs text-[#536c79]"><LockKeyhole className="h-3 w-3" /> Read only</span>}
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#59707d]">
            Choose how crew enter this Company Form’s completion process.
          </p>
        </div>
        {isDirty && !locked && <span className="rounded-full bg-[#fff1d7] px-2.5 py-1 text-xs font-medium text-[#77551b]" role="status">Unsaved policy</span>}
      </div>

      {loading ? (
        <div className="mt-5 space-y-3" aria-label="Loading applicability settings" aria-busy="true">
          <div className="h-12 animate-pulse rounded-lg bg-[#e8eef1]" />
          <div className="h-24 animate-pulse rounded-lg bg-[#e8eef1]" />
        </div>
      ) : loadError ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-[#e6c5bb] bg-[#fff9f6] p-4 text-sm text-[#784539]" role="alert">
          <p>{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Try again</Button>
        </div>
      ) : (
        <>
          {permissionsLoading ? (
            <p className="mt-3 text-xs text-[#637985]" role="status">Checking Forms permissions…</p>
          ) : locked && !isReleased && (
            <p className="mt-3 text-xs text-[#637985]">You can view these settings, but Forms edit permission is needed to change them.</p>
          )}
          <RadioGroup
            value={draft.mode}
            onValueChange={(value) => changeMode(value as PolicyDraft["mode"])}
            className="mt-4 grid gap-2 md:grid-cols-3"
            aria-label="Applicability mode"
          >
            <div className={`flex gap-3 rounded-lg border p-3.5 transition-colors ${draft.mode === "all" ? "border-[#4e8193] bg-white shadow-sm" : "border-[#d9e2e8] bg-white/65"} ${locked || saving ? "opacity-70" : ""}`}>
              <RadioGroupItem id="applicability-all" value="all" disabled={locked || saving} className="mt-0.5" />
              <label htmlFor="applicability-all" className={`min-w-0 flex-1 ${locked || saving ? "cursor-not-allowed" : "cursor-pointer"}`}><span className="block text-sm font-semibold text-[#203f50]">All crew</span><span className="mt-1 block text-xs leading-4 text-[#637985]">Every crew member in scope is included.</span></label>
            </div>
            <div className={`flex gap-3 rounded-lg border p-3.5 transition-colors ${draft.mode === "conditional" ? "border-[#4e8193] bg-white shadow-sm" : "border-[#d9e2e8] bg-white/65"} ${locked || saving ? "opacity-70" : ""}`}>
              <RadioGroupItem id="applicability-conditional" value="conditional" disabled={locked || saving} className="mt-0.5" />
              <label htmlFor="applicability-conditional" className={`min-w-0 flex-1 ${locked || saving ? "cursor-not-allowed" : "cursor-pointer"}`}><span className="block text-sm font-semibold text-[#203f50]">When conditions match</span><span className="mt-1 block text-xs leading-4 text-[#637985]">Apply only to crew meeting configured conditions.</span></label>
            </div>
            <div className={`flex gap-3 rounded-lg border p-3.5 transition-colors ${draft.mode === "manual_only" ? "border-[#4e8193] bg-white shadow-sm" : "border-[#d9e2e8] bg-white/65"} ${locked || saving ? "opacity-70" : ""}`}>
              <RadioGroupItem id="applicability-manual" value="manual_only" disabled={locked || saving} className="mt-0.5" />
              <label htmlFor="applicability-manual" className={`min-w-0 flex-1 ${locked || saving ? "cursor-not-allowed" : "cursor-pointer"}`}><span className="block text-sm font-semibold text-[#203f50]">Manual start only</span><span className="mt-1 block text-xs leading-4 text-[#637985]">Crew start it only by choosing it; this policy does not start it automatically.</span></label>
            </div>
          </RadioGroup>

          {draft.mode !== "manual_only" ? (
            <div className="mt-4 grid gap-4 rounded-lg border border-[#dce5e9] bg-white p-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.2fr)]">
              <fieldset disabled={locked || saving} className="min-w-0">
                <legend className="text-sm font-semibold text-[#284959]">Completion obligation</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["mandatory", "optional"] as const).map((obligation) => (
                    <label key={obligation} className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize ${draft.obligation === obligation ? "border-[#6d96a4] bg-[#edf5f6] text-[#274a59]" : "border-[#dce5e9] text-[#617783]"} ${locked || saving ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <input
                        type="radio"
                        name="company-form-obligation"
                        value={obligation}
                        checked={draft.obligation === obligation}
                        onChange={() => setDraft((current) => ({ ...current, obligation }))}
                        className="accent-[#3e7386]"
                      />
                      {obligation}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset disabled={locked || saving} className="min-w-0">
                <legend className="text-sm font-semibold text-[#284959]">When it becomes effective</legend>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${draft.effectiveKind === "on_release" ? "border-[#6d96a4] bg-[#edf5f6] text-[#274a59]" : "border-[#dce5e9] text-[#617783]"} ${locked || saving ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <input type="radio" name="company-form-effective" checked={draft.effectiveKind === "on_release"} onChange={() => setDraft((current) => ({ ...current, effectiveKind: "on_release", specificDate: "" }))} className="accent-[#3e7386]" />
                    On release
                  </label>
                  <label className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${draft.effectiveKind === "specific_date" ? "border-[#6d96a4] bg-[#edf5f6] text-[#274a59]" : "border-[#dce5e9] text-[#617783]"} ${locked || saving ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <input type="radio" name="company-form-effective" checked={draft.effectiveKind === "specific_date"} onChange={() => setDraft((current) => ({ ...current, effectiveKind: "specific_date" }))} className="accent-[#3e7386]" />
                    On a specific date
                  </label>
                  {draft.effectiveKind === "specific_date" && (
                    <label className="flex min-w-[190px] flex-1 items-center gap-2">
                      <CalendarDays className="h-4 w-4 shrink-0 text-[#708994]" aria-hidden="true" />
                      <span className="sr-only">Effective date</span>
                      <Input type="date" value={draft.specificDate} onChange={(event) => setDraft((current) => ({ ...current, specificDate: event.target.value }))} disabled={locked || saving} required aria-label="Effective date" className="h-9 border-[#d7e1e5]" />
                    </label>
                  )}
                </div>
                {draft.effectiveKind === "specific_date" && (
                  <p className="mt-2 text-xs leading-5 text-[#718892]">
                    This date is checked against the actual release date, not the version date.
                  </p>
                )}
              </fieldset>
            </div>
          ) : (
            <div className="mt-4 flex gap-2 rounded-lg border border-[#dce5e9] bg-white p-4 text-sm text-[#5d7480]">
              <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-[#527b8a]" aria-hidden="true" />
              <p>Manual start only. This does not make the form mandatory, block progress, satisfy another requirement, or skip a requirement.</p>
            </div>
          )}

          {draft.mode === "conditional" && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-[#284959]">Who this applies to</h4>
                  <p className="mt-0.5 text-xs text-[#637985]">Each group joins conditions with “and”. Groups join with “or”.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSet} disabled={locked || saving} className="border-[#cad9df] text-[#315f70]">
                  <Plus className="mr-1.5 h-4 w-4" />Add crew group
                </Button>
              </div>
              {draft.sets.map((set, index) => (
                <div key={set.uiKey}>
                  {index > 0 && <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[#718892]" aria-label="Or">Or</p>}
                  <CompanyFormConditionCard
                    set={set}
                    index={index}
                    dimensions={dimensions}
                    disabled={locked || saving}
                    onChange={(nextSet) => updateSet(set.uiKey, nextSet)}
                    onRemove={() => setDraft((current) => ({ ...current, sets: current.sets.filter((item) => item.uiKey !== set.uiKey) }))}
                    onAddCondition={() => addCondition(set.uiKey)}
                    onRemoveCondition={(conditionKey) => removeCondition(set.uiKey, conditionKey)}
                  />
                </div>
              ))}
              {!conditionSetsValid && (
                <p className="rounded-md bg-[#fff5f2] px-3 py-2 text-sm text-[#9a4e42]" role="alert">
                  Add a crew group with valid available values before saving. Unavailable or no-longer-listed selections stay visible until removed or replaced.
                </p>
              )}
              <p className="text-xs leading-5 text-[#637985]">
                {stageKey ? "This policy is evaluated in the context of the selected subject stage." : "No subject stage is selected for this version."}
              </p>
            </div>
          )}
          <div className="mt-4 rounded-lg border border-[#dce5e9] bg-white px-4 py-3" aria-live="polite" data-testid="applicability-summary">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#718892]">Policy summary</p>
            <p className="mt-1 text-sm leading-5 text-[#294655]">{summary}</p>
          </div>
          {status === "draft" && (
            <CompanyFormRuleTrial
              versionId={versionId}
              versionUuid={versionUuid}
              status={status}
              stageKey={stageKey}
              stageBusy={stageBusy}
              policyBusy={loading || saving || navigationBusy}
              policyDirty={isDirty}
              policy={toPayload(draft)}
            />
          )}
          {saveError && <p className="mt-3 text-sm text-[#a44738]" role="alert">{saveError}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#dce5e9] pt-4">
            <p className="text-xs text-[#6a808b]">
              {isReleased ? "Released applicability is read only." : saving ? <><LoaderCircle className="mr-1 inline h-3 w-3 animate-spin" />Saving policy…</> : isDirty ? "Changes are local until saved." : <><Check className="mr-1 inline h-3 w-3" />Policy saved</>}
            </p>
            <Button type="button" onClick={() => void save()} disabled={locked || saving || !isDirty || !conditionSetsValid || (draft.mode !== "manual_only" && draft.effectiveKind === "specific_date" && !draft.specificDate)} className="bg-[#315f70] text-white hover:bg-[#244b5a]" data-testid="button-save-applicability">
              <Save className="mr-2 h-4 w-4" />Save applicability
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

export default CompanyFormApplicabilityEditor;
