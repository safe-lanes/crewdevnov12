import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { downloadXlsx, type SheetColumn } from "@/lib/xlsxExport";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CompanySubmissionRenderer, mapCompanySubmissionForm } from "@/components/configured-form/companySubmissionContract";
import { ConfiguredFormRenderer } from "@/components/configured-form/ConfiguredFormRenderer";
import { AssignmentFormRequirements } from "@/modules/crew-pool/components/AssignmentFormRequirements";
import type { CompanyFormSubmissionRenderContract } from "@shared/v2/forms-engine/submissionRenderContract";
import { AlertCircle, Download, RefreshCw } from "lucide-react";

type OutstandingRow = {
  seafarer: string; rank: string; vessel: string; stage: string; form: string; obligation: string;
  status: string; outstandingSince: string; assignmentState: string;
  rowKind: "requirement" | "check"; subjectRef: string; stageKey: string;
  requirementUuid?: string | null; eventUuid?: string | null; submissionUuid?: string | null;
  formVersionUuid?: string | null; reason?: string | null;
};
type OutstandingResponse = { rows: OutstandingRow[]; total: number; page: number; pageSize: number };
type FilterKey = "seafarer" | "rank" | "vessel" | "stage" | "form" | "obligation" | "status" | "sinceFrom" | "sinceTo" | "assignmentState";
const FILTERS: Array<{ key: FilterKey; label: string; type?: string }> = [
  { key: "seafarer", label: "Seafarer" }, { key: "rank", label: "Rank" }, { key: "vessel", label: "Vessel" },
  { key: "stage", label: "Stage" }, { key: "form", label: "Form" }, { key: "obligation", label: "Obligation" },
  { key: "status", label: "Status" }, { key: "sinceFrom", label: "Since from", type: "date" },
  { key: "sinceTo", label: "Since to", type: "date" }, { key: "assignmentState", label: "Assignment state" },
];
const COLUMNS: Array<{ key: keyof OutstandingRow; label: string }> = [
  { key: "seafarer", label: "Seafarer" }, { key: "rank", label: "Rank" }, { key: "vessel", label: "Vessel" },
  { key: "stage", label: "Stage" }, { key: "form", label: "Form" }, { key: "obligation", label: "Obligation" },
  { key: "status", label: "Status" }, { key: "outstandingSince", label: "Outstanding since" },
  { key: "assignmentState", label: "Assignment state" },
];
const exportColumns: SheetColumn[] = COLUMNS.map(({ key, label }) => ({ key, label }));

function paramsFor(filters: Record<FilterKey, string>, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  FILTERS.forEach(({ key }) => { if (filters[key].trim()) params.set(key, filters[key].trim()); });
  return params;
}

function PinnedDefinition({ row }: { row: OutstandingRow }) {
  const query = useQuery({
    queryKey: ["company-form-pinned-requirement", row.subjectRef, row.requirementUuid],
    enabled: Boolean(row.subjectRef && row.requirementUuid),
    retry: false,
    queryFn: async () => await (await apiRequest("GET",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(row.subjectRef)}/requirements/${encodeURIComponent(row.requirementUuid!)}/definition`))
      .json() as CompanyFormSubmissionRenderContract,
  });
  if (query.isLoading) return <div className="space-y-3 p-5"><div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-24 animate-pulse rounded bg-slate-100" /></div>;
  if (query.isError || !query.data) return <div role="alert" className="p-5 text-sm text-destructive">The pinned form preview is unavailable. Retry the request or ask an office administrator to review this obligation.<Button variant="outline" className="ml-2" onClick={() => void query.refetch()}>Retry</Button></div>;
  try {
    const model = mapCompanySubmissionForm(query.data);
    return <ConfiguredFormRenderer mode="preview" companyForm formTitle={model.title} formVersionLabel={model.versionLabel}
      subjectType={model.subjectType} parts={model.parts} structures={model.structures} roles={model.roles}
      departments={model.departments} vesselTypes={model.vesselTypes} className="max-h-[68vh] overflow-y-auto" />;
  } catch {
    return <p role="alert" className="p-5 text-sm text-destructive">This pinned form version could not be displayed safely.</p>;
  }
}

export function CompanyFormsOutstandingReport() {
  const { canCompanyFormAction, isLoading: permissionsLoading } = usePermissions();
  const allowed = canCompanyFormAction("view");
  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    seafarer: "", rank: "", vessel: "", stage: "", form: "", obligation: "", status: "",
    sinceFrom: "", sinceTo: "", assignmentState: "",
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OutstandingRow | null>(null);
  const [activeSubmission, setActiveSubmission] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);
  const query = useQuery<OutstandingResponse>({
    queryKey: ["company-forms-outstanding", filters, page],
    enabled: allowed,
    retry: false,
    queryFn: async () => (await apiRequest("GET", `/api/v2/company-form-submissions/outstanding?${paramsFor(filters, page, 50)}`)).json(),
  });
  async function exportAll() {
    setExportError(false);
    try {
      const first = await (await apiRequest("GET", `/api/v2/company-form-submissions/outstanding?${paramsFor(filters, 1, 500)}`)).json() as OutstandingResponse;
      const all = [...first.rows];
      const pages = Math.ceil(first.total / 500);
      for (let next = 2; next <= pages; next++) {
        const part = await (await apiRequest("GET", `/api/v2/company-form-submissions/outstanding?${paramsFor(filters, next, 500)}`)).json() as OutstandingResponse;
        all.push(...part.rows);
      }
      downloadXlsx("Company Forms Outstanding", exportColumns, all as unknown as Array<Record<string, unknown>>);
    } catch {
      setExportError(true);
    }
  }
  if (permissionsLoading) return <div className="space-y-3 p-6"><div className="h-8 w-1/3 animate-pulse rounded bg-slate-100" /><div className="h-40 animate-pulse rounded bg-slate-100" /></div>;
  if (!allowed) return <div className="m-4 rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">Company Forms View permission is required to access outstanding forms.</div>;
  if (activeSubmission) return <div className="min-h-0 flex-1"><CompanySubmissionRenderer submissionUuid={activeSubmission} onBack={() => setActiveSubmission(null)} /></div>;
  return <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4" data-testid="company-forms-outstanding">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-[#16569e]">Outstanding forms</h2><p className="text-sm text-muted-foreground">Required obligations and stage checks that still need attention.</p></div>
      <Button variant="outline" onClick={() => void exportAll()} disabled={query.isFetching}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
    </div>
    <div className="grid grid-cols-2 gap-2 rounded-md border bg-[#f7f9fb] p-3 sm:grid-cols-3 lg:grid-cols-5">
      {FILTERS.map(({ key, label, type }) => <label key={key} className="space-y-1 text-xs font-medium text-slate-600">
        <span>{label}</span><Input type={type ?? "search"} value={filters[key]} className="h-8 bg-white text-sm" aria-label={`Filter ${label}`}
          onChange={(event) => { setFilters((old) => ({ ...old, [key]: event.target.value })); setPage(1); }} />
      </label>)}
    </div>
    {query.isError && /(?:^|\b)403(?:\b|:)/.test(query.error instanceof Error ? query.error.message : "") ? (
      <div role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">You do not have permission to view Company Forms outstanding records.</div>
    ) : query.isError && <div role="alert" className="flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />Unable to load outstanding forms. Please retry.</span><Button variant="outline" size="sm" onClick={() => void query.refetch()}><RefreshCw className="mr-1 h-3 w-3" />Retry</Button></div>}
    {exportError && <p role="alert" className="text-sm text-destructive">Unable to export the complete report. Please retry.</p>}
    <div className="min-h-0 flex-1 overflow-auto rounded-md border">
      <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-[#eaf4fb] text-xs uppercase tracking-wide text-[#16569e]"><tr>{COLUMNS.map((column) => <th key={column.key} className="border-b px-3 py-2 font-semibold">{column.label}</th>)}</tr></thead>
        <tbody>{query.isLoading ? Array.from({ length: 5 }, (_, row) => <tr key={row}>{COLUMNS.map((column) => <td key={column.key} className="p-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>)}</tr>)
          : query.data?.rows.map((row, index) => <tr key={`${row.rowKind}-${row.requirementUuid ?? row.eventUuid ?? index}`} className="cursor-pointer border-b hover:bg-blue-50/50" tabIndex={0}
            onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(row); } }}
            onClick={() => { setSelected(row); setActiveSubmission(null); }}>
            {COLUMNS.map((column) => <td key={column.key} className="max-w-56 px-3 py-2 align-top">{String(row[column.key] ?? "—")}</td>)}
          </tr>)}
          {!query.isLoading && query.isSuccess && query.data.rows.length === 0 && <tr><td colSpan={COLUMNS.length} className="p-10 text-center"><div className="font-medium text-slate-800">No outstanding forms match these filters</div><p className="mt-1 text-sm text-slate-500">Clear a filter or check again after new assignment activity.</p></td></tr>}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>{query.data ? `${query.data.total.toLocaleString()} outstanding rows` : "Loading report…"}</span>
      <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} of {Math.max(1, Math.ceil((query.data?.total ?? 0) / 50))}</span><Button variant="outline" size="sm" disabled={!query.data || page * 50 >= query.data.total || query.isFetching} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setActiveSubmission(null); } }}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{selected?.form || "Company Form"} · {selected?.status}</DialogTitle></DialogHeader>
        {selected?.rowKind === "check" && <div className="space-y-3"><p className="text-sm text-slate-600">{selected.reason || "The recorded stage check needs attention."}</p>
          <AssignmentFormRequirements key={`${selected.subjectRef}-${selected.stageKey}`} subjectRef={selected.subjectRef} stageKey={selected.stageKey} allowStart={false} />
        </div>}
        {selected?.rowKind === "requirement" && (selected.submissionUuid
          ? <CompanySubmissionRenderer submissionUuid={selected.submissionUuid} onBack={() => setSelected(null)} />
          : <><PinnedDefinition row={selected} /><AssignmentFormRequirements subjectRef={selected.subjectRef}
            stageKey={selected.stageKey} requirementUuid={selected.requirementUuid ?? undefined}
            allowStart={canCompanyFormAction("fill_in")}
            onOpenSubmission={uuid => { setSelected(null); setActiveSubmission(uuid); }} /></>)}
      </DialogContent>
    </Dialog>
  </section>;
}
