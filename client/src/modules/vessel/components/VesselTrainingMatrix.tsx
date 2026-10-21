import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { TrainingMatrixCompliance, type TrainingComplianceResponse } from "./TrainingMatrixCompliance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Dot = {
  courseUuid: string;
  color: "green" | "amber" | "red" | "grey";
  outline: boolean;
  label: string;
  reasons: string[];
};

type MatrixRow = {
  companyTrainingId: number;
  courseUuid: string;
  companyId: string;
  name: string;
  category: string;
};

type OnboardCrew = TrainingComplianceResponse & {
  referenceKind: "on_board";
  plannedReliefDate: string | null;
  dots: Dot[];
};

type VesselTrainingCompliance = {
  referenceDate: string;
  twoMonthDate: string;
  matrixRevision: string | null;
  rows: MatrixRow[];
  crew: OnboardCrew[];
};

type Props = { vesselUuid: string | null };

const legend = [
  { color: "green", outline: false, label: "Valid" },
  { color: "green", outline: false, label: "Valid, no expiry" },
  { color: "amber", outline: false, label: "Expires during contract" },
  { color: "amber", outline: false, label: "Expires within 2 months" },
  { color: "red", outline: false, label: "Expired at joining" },
  { color: "red", outline: true, label: "Not held" },
  { color: "amber", outline: true, label: "Expiry not recorded" },
  { color: "grey", outline: false, label: "Incomplete — hover or tap for reasons" },
] as const;

const toneClass: Record<Dot["color"], string> = {
  green: "border-emerald-700 bg-emerald-600 text-white",
  amber: "border-amber-700 bg-amber-500 text-amber-950",
  red: "border-rose-700 bg-rose-600 text-white",
  grey: "border-slate-500 bg-slate-400 text-slate-950",
};
const outlineClass: Record<Dot["color"], string> = {
  green: "border-emerald-700 bg-transparent", amber: "border-amber-700 bg-transparent",
  red: "border-rose-700 bg-transparent", grey: "border-slate-500 bg-transparent",
};

const vocabulary = (value: string) => value
  .replaceAll("Expires before planned relief", "Expires during contract")
  .replace(/\bExpired\b(?! at joining)/g, "Expired at joining");

function dotToneClass(dot: Dot) {
  const meaning = vocabulary(dot.reasons?.join("; ") || dot.label);
  if (dot.color === "green" && /no expiry/i.test(meaning)) {
    return "border-[#022C22] bg-[#064E3B] text-white";
  }
  if (dot.color === "green") return "border-[#15803D] bg-[#16A34A] text-white";
  if (dot.color === "amber" && /Expires during contract/i.test(meaning)) {
    return "border-[#9A3412] bg-[#C2410C] text-white";
  }
  if (dot.color === "amber" && /Expires within 2 months/i.test(meaning)) {
    return "border-[#A16207] bg-[#FACC15] text-[#422006]";
  }
  return toneClass[dot.color];
}

// Use server-owned rank/revision identifiers and explicit reader failures, never
// a display label or another course's certificate problem, to identify unknown
// applicability. This classifies presentation only; it does not resolve rules.
function requirementUndetermined(crew: OnboardCrew) {
  return !crew.contractRankUuid || !crew.matrixRevisionUuid || crew.issues.some(issue =>
    issue.blocking !== false && ["MISSING_RANK", "MISSING_MATRIX", "INVALID_MATRIX",
      "MATRIX_COURSE_UNAVAILABLE", "INVALID_REQUIREMENT", "CALCULATION_FAILED"].includes(issue.code));
}

function MatrixDot({ dot }: { dot: Dot | undefined }) {
  if (!dot) return null;
  const meaning = vocabulary(dot.reasons?.join("; ") || dot.label);
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-sky-700"
              aria-label={meaning} data-testid="vessel-training-dot" data-color={dot.color} data-outline={dot.outline}>
              <span aria-hidden="true" className={`h-3 w-3 rounded-full border-2 ${dot.outline ? outlineClass[dot.color] : dotToneClass(dot)}`} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-72">{meaning}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 text-sm" role="status">{meaning}</PopoverContent>
    </Popover>
  );
}

export function VesselTrainingMatrix({ vesselUuid }: Props) {
  const [selectedCrew, setSelectedCrew] = useState<OnboardCrew | null>(null);
  const [showMandatory, setShowMandatory] = useState(true);
  const [showRecommended, setShowRecommended] = useState(false);
  const query = useQuery<VesselTrainingCompliance>({
    queryKey: ["vessel-training-compliance", vesselUuid],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/v2/vessel/${encodeURIComponent(vesselUuid!)}/training-compliance`);
      const payload = await response.json();
      if (!Array.isArray(payload?.rows) || !Array.isArray(payload?.crew)) throw new Error("Training Matrix unavailable");
      return payload as VesselTrainingCompliance;
    },
    enabled: Boolean(vesselUuid),
    retry: false,
  });

  if (!vesselUuid) return <p className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Select a vessel to view onboard training evidence.</p>;
  if (query.isLoading) return (
    <div className="space-y-3" aria-label="Loading onboard training compliance">
      <div className="h-12 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded bg-slate-100" />
      <div className="h-64 animate-pulse rounded bg-slate-100" />
    </div>
  );
  if (query.isError) return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <span>Onboard training compliance could not be loaded.</span>
      <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>
        <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Retry
      </Button>
    </div>
  );

  const payload = query.data;
  if (!payload) return null;
  const dotsByCrew = payload.crew.map(crew => new Map((crew.dots ?? []).map(dot => [dot.courseUuid, dot])));
  const filteredRows = payload.rows.filter(row => payload.crew.some(crew => {
    const course = crew.courses.find(item => item.courseUuid === row.courseUuid);
    if (!course) return requirementUndetermined(crew);
    return course.obligation === "mandatory" ? showMandatory : showRecommended;
  }));
  const embeddedResult = selectedCrew ? {
    ...selectedCrew,
    courses: selectedCrew.courses.map(course => ({
      ...course,
      displayStatus: course.displayStatus ? vocabulary(course.displayStatus) : course.displayStatus,
      issues: course.issues.map(issue => ({ ...issue, message: vocabulary(issue.message) })),
    })),
    dots: selectedCrew.dots?.map(dot => ({
      ...dot,
      label: vocabulary(dot.label),
      reasons: dot.reasons.map(vocabulary),
    })),
    issues: selectedCrew.issues.map(issue => ({ ...issue, message: vocabulary(issue.message) })),
  } : null;

  return (
    <TooltipProvider delayDuration={150}>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs" aria-label="Requirement filters">
          <span className="font-semibold text-slate-700">Show</span>
          <button type="button" aria-pressed={showMandatory} onClick={() => setShowMandatory(value => !value)}
            className={`rounded-full border px-3 py-1 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${showMandatory ? "border-green-700 bg-green-100 text-green-900" : "border-slate-300 bg-white text-slate-600"}`}>
            Mandatory
          </button>
          <button type="button" aria-pressed={showRecommended} onClick={() => setShowRecommended(value => !value)}
            className={`rounded-full border px-3 py-1 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${showRecommended ? "border-blue-700 bg-blue-100 text-blue-900" : "border-slate-300 bg-white text-slate-600"}`}>
            Recommended
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs" aria-label="Training compliance legend">
          <span className="font-semibold text-slate-700">Requirement</span>
          <span className="rounded bg-green-50 px-2 py-1 font-medium text-green-900">Mandatory</span>
          <span className="rounded bg-blue-100 px-2 py-1 font-medium text-blue-900">Recommended</span>
          <span className="rounded border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700">Not required for this rank</span>
          <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">Requirement not determined</span>
          <span className="hidden h-5 border-l border-slate-300 sm:inline-block" aria-hidden="true" />
          <span className="font-semibold text-slate-700">Evidence status</span>
          {legend.map((item, index) => (
            <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2 text-slate-700">
              <span className={`inline-block h-3 w-3 rounded-full border-2 ${
                item.outline ? outlineClass[item.color]
                  : item.label === "Valid, no expiry" ? "border-[#022C22] bg-[#064E3B]"
                  : item.label === "Valid" ? "border-[#15803D] bg-[#16A34A]"
                  : item.label === "Expires during contract" ? "border-[#9A3412] bg-[#C2410C]"
                  : item.label === "Expires within 2 months" ? "border-[#A16207] bg-[#FACC15]"
                  : toneClass[item.color]
              }`} aria-hidden="true" />
              {vocabulary(item.label)}
            </span>
          ))}
        </div>
        {!showMandatory && !showRecommended && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
            Choose Mandatory and/or Recommended to show requirement evidence. Requirement not determined cases remain visible.
          </p>
        )}
        <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-300px)] min-h-48 overflow-auto">
            <Table className="min-w-max">
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                  <TableHead className="sticky left-0 top-0 z-30 w-24 border-r border-white/20 bg-[#52baf3] text-xs text-white">Company ID</TableHead>
                  <TableHead className="sticky left-24 top-0 z-30 w-72 border-r border-white/20 bg-[#52baf3] text-xs text-white">Training</TableHead>
                  {payload.crew.map((crew, index) => (
                    <TableHead key={`${crew.assignmentUuid}-${index}`} className="sticky top-0 z-20 min-w-[190px] bg-[#52baf3] text-center text-white">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-sky-100">{crew.context.contractRankLabel || "Captured rank not recorded"}</div>
                      <button type="button" className="mt-1 text-xs font-semibold underline decoration-white/60 underline-offset-2 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        onClick={() => setSelectedCrew(crew)} data-testid={`onboard-training-details-${index}`}>
                        {crew.context.crewName || "Crew member"}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {!payload.rows.length ? (
                  <TableRow><TableCell colSpan={Math.max(2, payload.crew.length + 2)} className="py-10 text-center text-sm text-slate-600">
                    {payload.crew.some(crew => crew.status === "incomplete")
                      ? "Training requirements could not be determined. Open a crew member to review the missing information."
                      : "No training requirements are configured for this vessel."}
                  </TableCell></TableRow>
                 ) : filteredRows.length === 0 ? (
                   <TableRow><TableCell colSpan={Math.max(2, payload.crew.length + 2)} className="py-10 text-center text-sm text-slate-600">
                     No rows match the selected requirement filters.
                   </TableCell></TableRow>
                 ) : filteredRows.map((row, rowIndex) => (
                  <React.Fragment key={row.companyTrainingId}>
                   {(rowIndex === 0 || row.category !== filteredRows[rowIndex - 1].category) && (
                    <TableRow className="bg-blue-100"><TableCell colSpan={payload.crew.length + 2} className="text-xs font-semibold">{row.category}</TableCell></TableRow>
                  )}
                  <TableRow className="border-b border-slate-100">
                    <TableCell className="sticky left-0 z-10 border-r border-slate-200 bg-white text-xs text-slate-600">{row.companyId}</TableCell>
                    <TableCell className="sticky left-24 z-10 border-r border-slate-200 bg-white text-xs font-medium text-slate-800">
                      <span>{row.name}</span>
                    </TableCell>
                    {payload.crew.map((crew, index) => (
                      <TableCell key={`${crew.assignmentUuid}-${row.courseUuid}`} className="text-center">
                        {(() => {
                          const course = crew.courses.find(item => item.courseUuid === row.courseUuid);
                           const unknown = !course && requirementUndetermined(crew);
                          const requirement = course?.obligation === "mandatory" ? "Mandatory"
                            : course?.obligation === "recommended" ? "Recommended"
                            : unknown ? "Requirement not determined" : "Not required for this rank";
                          const visible = unknown || !course
                            || (course.obligation === "mandatory" ? showMandatory : showRecommended);
                          const bgClass = requirement === "Mandatory" ? "bg-green-50"
                            : requirement === "Recommended" ? "bg-blue-100"
                             : requirement === "Requirement not determined" ? "bg-slate-100" : "bg-white";
                           const dot = dotsByCrew[index].get(row.courseUuid) ?? (unknown ? {
                            courseUuid: row.courseUuid, color: "grey" as const, outline: false, label: "Incomplete",
                            reasons: [`Incomplete: ${crew.issues.filter(issue => issue.blocking !== false).map(issue => vocabulary(issue.message)).join("; ") || "The training check could not finish. Retry it."}`],
                          } : undefined);
                          return (
                            <div className={`flex min-h-[76px] min-w-[150px] flex-col items-center justify-center gap-1 ${bgClass}`}>
                              <span className="text-[10px] font-semibold leading-tight text-slate-700">{requirement}</span>
                              {visible ? <MatrixDot dot={dot} /> : <span className="text-[10px] text-slate-400">Hidden by filter</span>}
                            </div>
                          );
                        })()}
                      </TableCell>
                    ))}
                  </TableRow>
                  </React.Fragment>
                ))}
                {payload.crew.length === 0 && payload.rows.length > 0 && (
                  <TableRow><TableCell colSpan={2} className="py-10 text-center text-sm text-slate-600">No onboard assignments to review.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          Evidence is evaluated against the server-recorded reference date and each assignment’s planned relief date. Matrix revision: {payload.matrixRevision ?? "Not available"}.
        </p>
      </section>
      {selectedCrew && (
        <TrainingMatrixCompliance
          embeddedResult={embeddedResult ?? undefined}
          open={Boolean(selectedCrew)}
          onDetailsClose={() => setSelectedCrew(null)}
        />
      )}
    </TooltipProvider>
  );
}
