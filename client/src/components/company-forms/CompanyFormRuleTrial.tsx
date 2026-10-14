import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleHelp, LoaderCircle, Search, Sparkles } from "lucide-react";
import type { ApplicabilityDraft } from "@shared/v2/admin/applicabilityPreview";
import type { RuleAssignmentChoice, RulePreview, RuleOutcome } from "@shared/v2/admin/applicabilityPreview";
import { apiRequest } from "@/lib/queryClient";
import { companyFormErrorMessage, safeCompanyFormFactReason } from "@/lib/companyFormErrors";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CompanyFormRuleTrialProps {
  versionId: number;
  versionUuid: string;
  status: string;
  stageKey: string;
  stageBusy: boolean;
  policyBusy: boolean;
  policyDirty: boolean;
  policy: ApplicabilityDraft;
}

function outcomeLabel(outcome: RuleOutcome): string {
  switch (outcome) {
    case "applies": return "Applies";
    case "does_not_apply": return "Does not apply";
    case "unresolved": return "Needs more information";
    case "manual_only": return "Manual start only";
  }
}

function outcomeTone(outcome: RuleOutcome): string {
  switch (outcome) {
    case "applies": return "border-[#c6ddd5] bg-[#edf6f1] text-[#315f4d]";
    case "does_not_apply": return "border-[#d9e2e8] bg-[#f2f6f7] text-[#516c78]";
    case "unresolved": return "border-[#ead8b7] bg-[#fff8e9] text-[#765922]";
    case "manual_only": return "border-[#d9d5ca] bg-[#f6f4ef] text-[#6d6656]";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text();
    // Preserve structured codes for the allowlisted mapper; never display the
    // raw body or status to an operator.
    throw new Error(`${response.status}: ${raw}`);
  }
  return response.json() as Promise<T>;
}

export function CompanyFormRuleTrial({
  versionId,
  versionUuid,
  status,
  stageKey,
  stageBusy,
  policyBusy,
  policyDirty,
  policy,
}: CompanyFormRuleTrialProps) {
  const { permissions, isLoading: permissionsLoading } = usePermissions();
  const canViewForms = !permissionsLoading && permissions.some((permission) =>
    permission.menuName.trim().toLowerCase() === "forms" && permission.canview === true,
  );
  const [searchText, setSearchText] = useState("");
  const [assignments, setAssignments] = useState<RuleAssignmentChoice[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<RuleAssignmentChoice | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [preview, setPreview] = useState<RulePreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const searchGeneration = useRef(0);
  const trialGeneration = useRef(0);
  const policyKey = useMemo(() => JSON.stringify(policy), [policy]);
  const contextKey = JSON.stringify([
    versionId,
    versionUuid,
    status,
    selectedAssignment?.subjectRef ?? "",
    policyKey,
    stageKey,
    stageBusy,
    policyBusy,
  ]);
  const activeContextKey = useRef(contextKey);
  activeContextKey.current = contextKey;

  useEffect(() => {
    setPreview(null);
    setPreviewError("");
    trialGeneration.current += 1;
    setPreviewBusy(false);
  }, [contextKey]);

  useEffect(() => () => {
    searchGeneration.current += 1;
    trialGeneration.current += 1;
  }, []);

  useEffect(() => {
    setSelectedAssignment(null);
    setPreview(null);
    setPreviewError("");
    trialGeneration.current += 1;
    searchGeneration.current += 1;
  }, [versionId, versionUuid]);

  useEffect(() => {
    const generation = ++searchGeneration.current;
    const query = searchText.trim();
    setSearchError("");
    if (!canViewForms || status !== "draft" || query.length < 2) {
      setAssignments([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query });
        const response = await apiRequest(
          "GET",
          `/api/v2/admin/form-versions/${versionId}/applicability/assignments?${params.toString()}`,
        );
        const matches = await parseResponse<RuleAssignmentChoice[]>(response);
        if (
          searchGeneration.current !== generation
          || activeContextKey.current !== contextKey
        ) return;
        setAssignments(Array.isArray(matches) ? matches : []);
      } catch (error) {
        if (searchGeneration.current !== generation || activeContextKey.current !== contextKey) return;
        setAssignments([]);
        setSearchError(companyFormErrorMessage(error, "ruleSearch"));
      } finally {
        if (searchGeneration.current === generation && activeContextKey.current === contextKey) {
          setSearching(false);
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      searchGeneration.current += 1;
    };
  }, [canViewForms, contextKey, searchText, status, versionId]);

  if (status !== "draft" || !canViewForms) return null;

  const disabled = stageBusy || policyBusy || previewBusy || permissionsLoading;

  const selectAssignment = (assignment: RuleAssignmentChoice) => {
    searchGeneration.current += 1;
    trialGeneration.current += 1;
    setSelectedAssignment(assignment);
    setPreview(null);
    setPreviewError("");
  };

  const runTrial = async () => {
    if (!selectedAssignment || disabled) return;
    const generation = ++trialGeneration.current;
    const keyAtStart = activeContextKey.current;
    setPreview(null);
    setPreviewError("");
    setPreviewBusy(true);
    try {
      const response = await apiRequest(
        "POST",
        `/api/v2/admin/form-versions/${versionId}/applicability/preview`,
        { subjectRef: selectedAssignment.subjectRef, policy },
      );
      const result = await parseResponse<RulePreview>(response);
      if (trialGeneration.current !== generation || activeContextKey.current !== keyAtStart) return;
      setPreview(result);
    } catch (error) {
      if (trialGeneration.current !== generation || activeContextKey.current !== keyAtStart) return;
      setPreviewError(companyFormErrorMessage(error, "rulePreview"));
    } finally {
      if (trialGeneration.current === generation && activeContextKey.current === keyAtStart) {
        setPreviewBusy(false);
      }
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-[#d9e2e8] bg-[#f4f8f9] p-4 sm:p-5" aria-labelledby="company-form-rule-trial-title" data-testid="company-form-rule-trial">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-[#e4eef1] p-2 text-[#396d7d]"><Sparkles className="h-4 w-4" aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <h3 id="company-form-rule-trial-title" className="text-sm font-semibold text-[#18374a]">Try this draft with a crew assignment</h3>
          <p className="mt-1 text-sm leading-5 text-[#59707d]">
            This checks the current policy as shown, including unsaved edits. It does not save the policy or decide crew facts in the browser.
          </p>
          {policyDirty && <p className="mt-2 text-xs font-medium text-[#77551b]" role="status">Using the current unsaved draft.</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="block text-sm font-medium text-[#365461]">
          Search by crew name or assignment
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#78909a]" aria-hidden="true" />
            <Input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Type at least two letters"
              className="h-10 border-[#cfdde2] bg-white pl-9"
              aria-describedby="company-form-rule-trial-search-help"
            />
          </div>
        </label>
        <Button
          type="button"
          onClick={() => void runTrial()}
          disabled={!selectedAssignment || disabled}
          className="self-end bg-[#315f70] text-white hover:bg-[#244b5a]"
          data-testid="button-run-company-form-trial"
        >
          {previewBusy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Check this draft
        </Button>
      </div>
      <p id="company-form-rule-trial-search-help" className="mt-1 text-xs text-[#718892]">
        Choose a listed crew assignment. Internal references are never shown.
      </p>

      {(searching || assignments.length > 0 || searchError || (searchText.trim().length >= 2 && !searching)) && (
        <div className="mt-3 rounded-lg border border-[#dce5e9] bg-white p-2" aria-label="Crew assignments">
          {searching ? (
            <div className="space-y-2 p-2" aria-busy="true" aria-label="Searching assignments">
              <div className="h-8 animate-pulse rounded bg-[#e8eef1]" />
              <div className="h-8 w-4/5 animate-pulse rounded bg-[#e8eef1]" />
            </div>
          ) : searchError ? (
            <p role="alert" className="p-2 text-sm text-[#9a4e42]">{searchError}</p>
          ) : assignments.length > 0 ? (
            <ul className="max-h-52 space-y-1 overflow-y-auto">
              {assignments.map((assignment) => (
                <li key={assignment.subjectRef}>
                  <button
                    type="button"
                    onClick={() => selectAssignment(assignment)}
                    aria-pressed={selectedAssignment?.subjectRef === assignment.subjectRef}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527b8a] ${selectedAssignment?.subjectRef === assignment.subjectRef ? "bg-[#eaf2f4] font-medium text-[#244b5a]" : "text-[#365461] hover:bg-[#f3f7f8]"}`}
                  >
                    {assignment.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-2 text-sm text-[#718892]">No matching crew assignments.</p>
          )}
        </div>
      )}

      {selectedAssignment && (
        <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-[#365461]">
          Selected: <span className="font-medium">{selectedAssignment.label}</span>
        </p>
      )}
      {disabled && !previewBusy && (
        <p className="mt-3 text-xs text-[#718892]" role="status">
          {stageBusy ? "Wait for the subject stage to finish saving before checking this draft." : "Wait for the policy to finish loading or saving before checking this draft."}
        </p>
      )}
      {previewError && <p className="mt-3 rounded-md bg-[#fff5f2] px-3 py-2 text-sm text-[#9a4e42]" role="alert">{previewError}</p>}

      {preview && (
        <div className="mt-4 space-y-3" data-testid="company-form-rule-trial-result">
          <article className={`rounded-lg border p-4 ${outcomeTone(preview.outcome)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Result: {outcomeLabel(preview.outcome)}</h4>
              <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium">Draft check</span>
            </div>
            <p className="mt-2 text-sm leading-5">{preview.explanation}</p>
            <p className="mt-3 text-xs leading-5">
              Stage: {preview.stageLabel || "No subject stage selected"} · Timing: {preview.timing || "Not available"}
            </p>
            <p className="mt-2 text-xs font-medium">This hypothetical draft check does not assess retrospective stage applicability.</p>
          </article>

          {preview.sets.map((set, index) => (
            <article key={`${index}-${set.outcome}`} className="rounded-lg border border-[#dce5e9] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[#284959]">Crew group {index + 1}</h4>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${outcomeTone(set.outcome)}`}>{outcomeLabel(set.outcome)}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {set.conditions.map((condition, conditionIndex) => (
                  <li key={`${conditionIndex}-${condition.outcome}`} className="border-l-2 border-[#d9e5e9] pl-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#365461]">{condition.label}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${outcomeTone(condition.outcome)}`}>{outcomeLabel(condition.outcome)}</span>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-[#637985]">{condition.outcome === "unresolved" ? safeCompanyFormFactReason(condition.explanation) : condition.explanation}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
      {!preview && !previewError && !selectedAssignment && (
        <p className="mt-3 flex items-center gap-2 text-xs text-[#718892]">
          <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />A missing source fact will stay unresolved; no value is guessed.
        </p>
      )}
    </section>
  );
}

export default CompanyFormRuleTrial;
