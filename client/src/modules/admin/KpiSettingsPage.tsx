import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Target,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useAppDialog } from "@/hooks/use-app-dialog";
import { normalizeKpiDecimal } from "@shared/v2/admin/kpiTargets";
import type { KpiDefinition, KpiTargetPanel } from "@shared/v2/admin/kpiTargets";

interface KpiCatalogueResponse {
  kpis: KpiDefinition[];
  canSetTargets: boolean;
}

interface SaveTargetRequest {
  code: string;
  year: number;
  revision: number;
  values: Record<string, string | null>;
}

const CATALOGUE_KEY = ["/api/v2/admin/kpis"];
const DETAIL_KEY = (code: string, year: number) => ["/api/v2/admin/kpis", code, "targets", year];
const GROUP_LABEL = "Training & Retention";

async function readJson<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await apiRequest(method, url, body);
  return response.json() as Promise<T>;
}

function formatUnit(unit: KpiDefinition["unit"]): string {
  switch (unit) {
    case "percentage": return "Percentage (%)";
    case "count": return "Count";
    case "score": return "Score";
    case "rate": return "Rate";
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function KpiSettingsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { ask, dialog } = useAppDialog();
  const [search, setSearch] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()));
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const catalogue = useQuery({
    queryKey: CATALOGUE_KEY,
    queryFn: () => readJson<KpiCatalogueResponse>("/api/v2/admin/kpis"),
    staleTime: 60_000,
  });
  const kpis = catalogue.data?.kpis ?? [];
  const selected = kpis.find((kpi) => kpi.code === selectedCode) ?? null;
  const detail = useQuery({
    queryKey: selected ? DETAIL_KEY(selected.code, year) : [...CATALOGUE_KEY, "no-selection"],
    queryFn: () => selected
      ? readJson<KpiTargetPanel>(`/api/v2/admin/kpis/${encodeURIComponent(selected.code)}/targets/${year}`)
      : Promise.reject(new Error("No KPI selected")),
    enabled: !!selected,
    staleTime: 0,
  });
  const panel = detail.data;

  const saveMutation = useMutation({
    mutationFn: ({ code, year: targetYear, revision, values }: SaveTargetRequest) =>
      readJson<KpiTargetPanel>(
        `/api/v2/admin/kpis/${encodeURIComponent(code)}/targets/${targetYear}`,
        "PUT",
        { revision, values },
      ),
    onSuccess: (freshPanel, variables) => {
      queryClient.setQueryData(DETAIL_KEY(variables.code, variables.year), freshPanel);
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.some((part) =>
          typeof part === "string" && (part.includes("audit") || part.includes("Audit")),
        ),
      });
      if (selectedCode === variables.code && year === variables.year) {
        setDraft({});
        setEditing(false);
        setValidationMessage(null);
      }
    },
  });

  const filteredKpis = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return kpis;
    return kpis.filter((kpi) =>
      `${kpi.label} ${kpi.code} ${kpi.menuGroup} ${kpi.components.map((component) => component.label).join(" ")}`
        .toLocaleLowerCase().includes(term),
    );
  }, [kpis, search]);
  const groupMatches = filteredKpis.length > 0;
  const groupExpanded = expanded || !!search.trim();
  const changed = useMemo(() => {
    if (!panel || !editing) return false;
    return panel.kpi.components.some((component) => {
      const value = draft[component.componentUuid] ?? "";
      const original = panel.values[component.componentUuid] ?? "";
      return value !== original;
    });
  }, [draft, editing, panel]);

  const discardEdits = async (): Promise<boolean> => {
    if (!editing || !changed) {
      setEditing(false);
      setDraft({});
      setValidationMessage(null);
      return true;
    }
    const confirmed = await ask("Discard the unsaved target changes?", {
      title: "Discard changes?",
      actionLabel: "Discard changes",
      cancelLabel: "Keep editing",
    });
    if (!confirmed) return false;
    setEditing(false);
    setDraft({});
    setValidationMessage(null);
    return true;
  };

  const chooseKpi = async (code: string) => {
    if (code === selectedCode || saveMutation.isPending) return;
    if (!(await discardEdits())) return;
    setSelectedCode(code);
    saveMutation.reset();
  };

  const changeYear = async (nextYear: number): Promise<boolean> => {
    if (!Number.isInteger(nextYear) || nextYear < 1900 || nextYear > 9999 || saveMutation.isPending) return false;
    if (nextYear === year) return true;
    if (!(await discardEdits())) return false;
    setYear(nextYear);
    setYearInput(String(nextYear));
    saveMutation.reset();
    return true;
  };

  const beginEdit = () => {
    if (!panel || !catalogue.data?.canSetTargets || !panel.canSetTargets || saveMutation.isPending) return;
    setDraft(Object.fromEntries(panel.kpi.components.map((component) => [
      component.componentUuid,
      panel.values[component.componentUuid] ?? "",
    ])));
    setEditing(true);
    setValidationMessage(null);
  };

  const cancelEdit = () => { void discardEdits(); };

  const save = () => {
    if (!panel || !selected || saveMutation.isPending) return;
    const values: Record<string, string | null> = {};
    try {
      for (const component of panel.kpi.components) {
        const value = (draft[component.componentUuid] ?? "").trim();
        if (value === "") {
          values[component.componentUuid] = null;
          continue;
        }
        const normalized = normalizeKpiDecimal(value);
        if (panel.kpi.unit === "count" && normalized.includes(".")) {
          throw new Error("Count targets must be whole numbers.");
        }
        if (panel.kpi.unit === "percentage" && Number(normalized) > 100) {
          throw new Error("Percentage targets cannot exceed 100.");
        }
        values[component.componentUuid] = normalized;
      }
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : "Check the target values and try again.");
      return;
    }
    setValidationMessage(null);
    saveMutation.mutate({ code: selected.code, year, revision: panel.revision, values });
  };

  const retryDetail = () => { void detail.refetch(); };

  return (
    <div className="min-h-[60vh] text-slate-800" data-testid="page-kpi-settings">
      {dialog}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2876a8]">
            <Target size={14} aria-hidden="true" /> Company-wide planning
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#173b5d]" data-testid="text-kpi-settings-title">KPI targets</h1>
          <p className="mt-1 text-sm text-slate-500">Annual targets · One company scope · Values remain independent by year</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-[#d5e5ef] bg-[#f3f8fb] px-3 py-2 text-xs text-[#315c78]">
          <LockKeyhole size={14} aria-hidden="true" />
          <span>Target access is permission-controlled</span>
        </div>
      </div>

      <div className="mb-3">
        <label className="relative block max-w-full" htmlFor="kpi-search">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <Input
            id="kpi-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search KPIs or components"
            className="h-10 border-[#d8e2e9] bg-white pl-9 focus-visible:ring-[#52baf3]"
            aria-label="Search KPIs or components"
            data-testid="input-kpi-search"
          />
        </label>
      </div>

      {catalogue.isLoading ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]" aria-label="Loading KPI settings">
          <div className="h-48 animate-pulse rounded border border-[#dce7ee] bg-[#edf4f8]" />
          <div className="h-[360px] animate-pulse rounded border border-[#dce7ee] bg-[#edf4f8]" />
        </div>
      ) : catalogue.isError ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded border border-[#e2e8ed] bg-white px-6 text-center" role="alert">
          <AlertCircle size={28} className="mb-3 text-[#b44c4c]" aria-hidden="true" />
          <p className="font-semibold text-slate-800">KPI settings could not be loaded</p>
          <p className="mt-1 text-sm text-slate-500">The catalogue is temporarily unavailable. Please try again.</p>
          <button type="button" onClick={() => void catalogue.refetch()} className="mt-4 inline-flex items-center gap-2 rounded bg-[#1769a6] px-3 py-2 text-sm font-medium text-white hover:bg-[#125887] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769a6]">
            <RotateCcw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded border border-[#d8e2e9] bg-white shadow-[0_1px_3px_rgba(21,53,76,0.06)]" aria-label="KPI tree" data-testid="panel-kpi-tree">
            <div className="flex min-h-10 items-center justify-between gap-2 bg-[#52baf3] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white">
              <span>KPI catalogue</span>
              <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={groupExpanded} className="inline-flex items-center gap-1 rounded px-1.5 py-1 normal-case font-medium hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label={groupExpanded ? "Collapse KPI group" : "Expand KPI group"}>
                {groupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>{groupExpanded ? "Collapse" : "Expand"}</span>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {!groupMatches ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500" role="status">No KPIs match your search.</div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={groupExpanded}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f2f8fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#52baf3]"
                    data-testid="tree-kpi-group-training-retention"
                  >
                    {groupExpanded ? <ChevronDown size={16} className="shrink-0 text-slate-500" /> : <ChevronRight size={16} className="shrink-0 text-slate-500" />}
                    <GraduationCap size={16} className="shrink-0 text-[#287eae]" aria-hidden="true" />
                    <span className="flex-1 truncate text-sm font-semibold text-slate-800">{GROUP_LABEL}</span>
                    <span className="text-xs tabular-nums text-slate-500">{filteredKpis.length}</span>
                  </button>
                  {groupExpanded && filteredKpis.map((kpi) => {
                    const isSelected = selectedCode === kpi.code;
                    const isDrugAlcohol = /alcohol|drug/i.test(kpi.label);
                    const Icon = isDrugAlcohol ? FlaskConical : ClipboardList;
                    return (
                      <button
                        key={kpi.code}
                        type="button"
                        onClick={() => void chooseKpi(kpi.code)}
                        disabled={saveMutation.isPending}
                        aria-current={isSelected ? "true" : undefined}
                        className={`flex w-full items-center gap-2 py-2 pl-11 pr-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#52baf3] disabled:cursor-wait ${
                          isSelected ? "border-l-2 border-[#2782b5] bg-[#eaf4fb] pl-[42px]" : "hover:bg-[#f4f9fc]"
                        }`}
                        data-testid={`tree-kpi-${kpi.code}`}
                      >
                        <Icon size={13} className={`shrink-0 ${isSelected ? "text-[#1769a6]" : "text-slate-400"}`} aria-hidden="true" />
                        <span className={`flex-1 truncate text-sm ${isSelected ? "font-semibold text-[#165b8c]" : "text-slate-700"}`}>{kpi.label}</span>
                        <span className="text-[11px] text-slate-400">{kpi.components.length === 1 ? "1 target" : `${kpi.components.length} targets`}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            <div className="border-t border-[#edf1f4] px-3 py-2 text-[11px] text-slate-500">
              {kpis.length} company-wide measures
            </div>
          </section>

          <section className="min-h-[390px] overflow-hidden rounded border border-[#d8e2e9] bg-white shadow-[0_1px_3px_rgba(21,53,76,0.06)]" aria-label="Selected KPI target details" data-testid="panel-kpi-detail">
            {!selected ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf4fb] text-[#3b9bc9]"><Target size={27} aria-hidden="true" /></div>
                <h2 className="font-semibold text-slate-800">Select a KPI</h2>
                <p className="mt-1 max-w-xs text-sm text-slate-500">Choose a measure from the catalogue to view or update its annual targets.</p>
              </div>
            ) : detail.isLoading ? (
              <div className="p-6" aria-label="Loading target details">
                <div className="mb-5 h-7 w-56 animate-pulse rounded bg-[#edf4f8]" />
                <div className="mb-4 h-14 animate-pulse rounded bg-[#f1f6f9]" />
                <div className="h-36 animate-pulse rounded bg-[#f1f6f9]" />
              </div>
            ) : detail.isError ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center px-6 text-center" role="alert">
                <AlertCircle size={28} className="mb-3 text-[#b44c4c]" aria-hidden="true" />
                <h2 className="font-semibold text-slate-800">Targets could not be loaded</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">The selected year’s target details are unavailable. Your existing values have not been changed.</p>
                <button type="button" onClick={retryDetail} className="mt-4 inline-flex items-center gap-2 rounded bg-[#1769a6] px-3 py-2 text-sm font-medium text-white hover:bg-[#125887] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769a6]">
                  <RotateCcw size={14} aria-hidden="true" /> Retry
                </button>
              </div>
            ) : panel ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e4edf2] bg-[#f8fbfd] px-5 py-4">
                  <div className="min-w-0">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4480a2]">Annual target · {panel.year}</div>
                    <h2 className="text-lg font-semibold text-[#173b5d]" data-testid="text-selected-kpi">{panel.kpi.label}</h2>
                    <p className="mt-1 text-xs text-slate-500">Direction: <span className="font-medium text-slate-700">{panel.kpi.direction === "minimum" ? "Minimum — meet or exceed" : "Maximum — stay at or below"}</span></p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span>Year</span>
                    <Input
                      type="number"
                      min={1900}
                      max={9999}
                      step={1}
                      value={yearInput}
                      onChange={(event) => setYearInput(event.currentTarget.value)}
                      onBlur={(event) => {
                        const raw = event.currentTarget.value;
                        const value = Number(raw);
                        if (!/^\d{4}$/.test(raw) || !Number.isInteger(value) || value < 1900 || value > 9999) {
                          setYearInput(String(year));
                        } else {
                          void changeYear(value).then((accepted) => {
                            if (!accepted) setYearInput(String(year));
                          });
                        }
                      }}
                      disabled={saveMutation.isPending}
                      aria-label="Target year"
                      className="h-9 w-28 border-[#cbdce7] bg-white text-sm tabular-nums focus-visible:ring-[#52baf3]"
                      data-testid="input-kpi-year"
                    />
                  </label>
                </div>

                <div className="p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Target values</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{formatUnit(panel.kpi.unit)} <span className="mx-1 text-slate-300">·</span> Set each component independently</p>
                    </div>
                    {!editing ? (
                      panel.canSetTargets && catalogue.data?.canSetTargets ? (
                        <button type="button" onClick={beginEdit} className="inline-flex h-9 items-center gap-2 rounded border border-[#247caf] bg-[#247caf] px-3 text-sm font-semibold text-white hover:bg-[#176895] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769a6]" data-testid="button-kpi-edit">
                          <Pencil size={14} aria-hidden="true" /> Edit targets
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded border border-[#e1e8ed] bg-[#f8fafb] px-2.5 py-1.5 text-xs text-slate-500" aria-label="View only">
                          <LockKeyhole size={13} aria-hidden="true" /> View only
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={cancelEdit} disabled={saveMutation.isPending} className="inline-flex h-9 items-center gap-1.5 rounded border border-[#ccd9e1] bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52baf3] disabled:opacity-50" data-testid="button-kpi-cancel">
                          <X size={14} aria-hidden="true" /> Cancel
                        </button>
                        <button type="button" onClick={save} disabled={saveMutation.isPending || !changed} className="inline-flex h-9 items-center gap-1.5 rounded bg-[#1769a6] px-3 text-sm font-semibold text-white hover:bg-[#125887] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769a6] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-kpi-save">
                          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                          {saveMutation.isPending ? "Saving…" : "Save targets"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-[#edf1f4] rounded border border-[#e0e8ed]">
                    {panel.kpi.components.map((component) => {
                      const value = editing ? (draft[component.componentUuid] ?? "") : (panel.values[component.componentUuid] ?? "");
                      return (
                        <div key={component.componentUuid} className="grid grid-cols-1 items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,280px)]">
                          <label htmlFor={`kpi-value-${component.componentUuid}`} className="text-sm font-medium text-slate-700">{component.label}</label>
                          <div className="relative">
                            <Input
                              id={`kpi-value-${component.componentUuid}`}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={value}
                              onChange={(event) => {
                                setDraft((current) => ({ ...current, [component.componentUuid]: event.target.value }));
                                setValidationMessage(null);
                              }}
                              readOnly={!editing}
                              aria-label={`${component.label} target${editing ? "" : " (read only)"}`}
                              placeholder={editing ? "Leave blank to unset" : "Not set"}
                              className={`h-10 border-[#ccd9e1] bg-white pr-16 text-sm tabular-nums ${editing ? "focus-visible:ring-[#52baf3]" : "read-only:bg-[#f8fafb] read-only:text-slate-800"}`}
                              data-testid={`input-kpi-target-${component.code}`}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">
                              {panel.kpi.unit === "percentage" ? "%" : panel.kpi.unit === "count" ? "count" : panel.kpi.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#eaf4fb] text-[10px] font-bold text-[#2679a8]" aria-hidden="true">i</span>
                    <p>{editing ? "Blank values clear a target; enter 0 to save an explicit zero." : "An empty field means no target is set. A displayed 0 is an explicit target."}</p>
                  </div>

                  {validationMessage && <p className="mt-3 text-sm text-[#a33d3d]" role="alert">{validationMessage}</p>}
                  {saveMutation.isError && (
                    <div className="mt-3 flex items-start gap-2 rounded border border-[#efd4d1] bg-[#fff7f5] px-3 py-2.5 text-sm text-[#923c35]" role="alert">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>Targets were not saved. Your edits are still here; check your connection and try again.</span>
                    </div>
                  )}
                  {saveMutation.isSuccess && !editing && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#31735b]" role="status">
                      <Check size={14} aria-hidden="true" /> Targets saved
                    </div>
                  )}
                  {panel.lastChanged && (
                    <p className="mt-5 border-t border-[#edf1f4] pt-3 text-xs text-slate-500" data-testid="text-kpi-last-changed">
                      Last changed by <span className="font-medium text-slate-700">{panel.lastChanged.name}</span> on {formatDate(panel.lastChanged.recordedAt)}
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

export default KpiSettingsPage;
