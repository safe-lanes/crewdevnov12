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

const vocabulary = (value: string) => value
  .replaceAll("Expires before planned relief", "Expires during contract")
  .replace(/\bExpired\b(?! at joining)/g, "Expired at joining");

type EvidenceStyle = { color: "green" | "amber" | "red"; outline: boolean };
type MatrixCourse = TrainingComplianceResponse["courses"][number];
type MatrixCheck = Pick<OnboardCrew, "status" | "issues">;

const matrixVocabulary = (value: string) => value
  .replaceAll("Expires before planned relief", "Expires during contract")
  .replace(/\bExpired\b(?! at joining)/g, "Expired at joining");

function sentenceCaseLabel(value: string) {
  return value.toLocaleLowerCase().replace(/^(\s*[\p{L}\p{N}])/u, match => match.toLocaleUpperCase());
}

function evidenceText(course: MatrixCourse | undefined, dot: Dot | undefined, check?: MatrixCheck) {
  const items = [
    course?.state,
    course?.displayStatus,
    dot?.label,
    ...(dot?.reasons ?? []),
    ...(course?.issues ?? []).map((issue: { message?: string }) => issue.message),
    ...(check?.status === "incomplete" ? check.issues.filter(issue => issue.blocking !== false).map(issue => issue.message) : []),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(matrixVocabulary);
  const incomplete = check?.status === "incomplete" || course?.complete === false || dot?.color === "grey"
    || /^(incomplete|calculation failed)$/i.test(String(course?.state ?? ""));
  if (incomplete) {
    const relatedIssues = (course?.issues ?? [])
      .map((issue: { message?: string }) => issue.message)
      .filter((message: unknown): message is string => typeof message === "string" && message.trim().length > 0);
    const relatedDotReasons = (dot?.reasons ?? []).filter(reason => !/^(incomplete|calculation failed)$/i.test(reason));
    const specific = [...relatedIssues, ...relatedDotReasons].map(matrixVocabulary);
    if (specific.length) items.push(...specific.map(reason => /^incomplete:/i.test(reason) ? reason : `Incomplete: ${reason}`));
    else items.push("Incomplete: Training evidence could not be fully evaluated.");
  }
  const unique = [...new Set(items.map(item => item
    .replace(/expires within 2 months/gi, "")
    .replace(/\s*;\s*;/g, ";")
    .replace(/^[\s;]+|[\s;]+$/g, "")
    .trim()).filter(Boolean))];
  return unique;
}

function resolveEvidenceStyle(course: MatrixCourse | undefined, dot: Dot | undefined, check?: MatrixCheck): EvidenceStyle | undefined {
  if (!course || (course.obligation !== "mandatory" && course.obligation !== "recommended")) return undefined;
  const labels = evidenceText(course, dot, check);
  const joined = labels.join(" ; ");
  const canonical = matrixVocabulary(String(course.state ?? ""));
  const rawLabels = [
    course.state,
    course.displayStatus,
    dot?.label,
    ...(dot?.reasons ?? []),
  ].filter((value): value is string => typeof value === "string").map(matrixVocabulary).join(" ; ");
  const retiredOnlyRawDot = dot?.color === "amber"
    && /expires within 2 months/i.test([dot.label, ...(dot.reasons ?? [])].join(" ; "))
    && ![dot.label, ...(dot.reasons ?? [])].join(" ; ").replace(/expires within 2 months/gi, "").replace(/[;\s]/g, "");
  const incomplete = check?.status === "incomplete" || course.complete === false || dot?.color === "grey"
    || /^(incomplete|calculation failed)$/i.test(canonical);
  const redFilled = /expired at joining/i.test(joined)
    || (dot?.color === "red" && !dot.outline && !/not held/i.test(joined));
  const redHollow = /not held/i.test(joined) || (dot?.color === "red" && dot.outline);
  const amberFilled = /expires during contract/i.test(joined)
    || (dot?.color === "amber" && !dot.outline && !/expires within 2 months/i.test(rawLabels)
      && !/expiry not recorded/i.test(joined));
  const amberHollow = /expiry not recorded/i.test(joined) || incomplete
    || (dot?.color === "amber" && dot.outline && !retiredOnlyRawDot);
  const valid = /^valid(?:\b|,)/i.test(canonical)
    || labels.some(label => /^valid(?:\b|,)/i.test(label))
    || (dot?.color === "green" && !incomplete);
  if (redFilled) return { color: "red", outline: false };
  if (redHollow) return { color: "red", outline: true };
  if (amberFilled) return { color: "amber", outline: false };
  if (amberHollow) return { color: "amber", outline: true };
  if (valid && !incomplete) return { color: "green", outline: false };
  return undefined;
}

function evidenceDotClass(style: EvidenceStyle) {
  if (style.color === "green") return "border-[#16A34A] bg-[#16A34A]";
  if (style.color === "amber") return style.outline
    ? "border-[#F59E0B] bg-transparent"
    : "border-[#F59E0B] bg-[#F59E0B]";
  return style.outline
    ? "border-[#DC2626] bg-transparent"
    : "border-[#DC2626] bg-[#DC2626]";
}

function MatrixCell({ requirement, course, dot, showStatus, check }: {
  requirement: "Mandatory" | "Recommended" | "Not required for this rank";
  course: MatrixCourse | undefined;
  check: MatrixCheck;
  dot: Dot | undefined;
  showStatus: boolean;
}) {
  const hasRequirement = course?.obligation === "mandatory" || course?.obligation === "recommended";
  const relevantCourse = hasRequirement ? course : undefined;
  const relevantDot = hasRequirement ? dot : undefined;
  const style = showStatus ? resolveEvidenceStyle(relevantCourse, relevantDot, check) : undefined;
  const labels = hasRequirement ? evidenceText(relevantCourse, relevantDot, check) : [];
  const meaning = [requirement, ...labels].join(" — ");
  const bgClass = requirement === "Mandatory" ? "bg-green-50"
    : requirement === "Recommended" ? "bg-blue-100" : "bg-white";
  return (
    <div className={`flex h-9 min-w-[142px] items-center justify-center ${bgClass}`}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-9 w-full items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-700"
                aria-label={meaning} data-testid={style ? "vessel-training-dot" : "vessel-training-cell-info"}
                data-color={style?.color} data-outline={style?.outline}>
                {style && <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full border-2 ${evidenceDotClass(style)}`} />}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-80 text-left">{meaning}</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-80 text-sm" role="status">{meaning}</PopoverContent>
      </Popover>
    </div>
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
    return course?.obligation === "mandatory" ? showMandatory
      : course?.obligation === "recommended" ? showRecommended : false;
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
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2" aria-label="Training compliance legend">
          <div className="flex w-max min-w-full items-center gap-4 whitespace-nowrap text-[11px]">
            <span role="group" aria-label="Requirement filters" className="inline-flex items-center gap-2">
              <span className="font-semibold text-slate-700">Requirement:</span>
              <button type="button" aria-pressed={showMandatory} onClick={() => setShowMandatory(value => !value)}
                className={`rounded px-2 py-1 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${showMandatory ? "bg-green-100 text-green-900" : "bg-white text-slate-600"}`}>
                Mandatory
              </button>
              <button type="button" aria-pressed={showRecommended} onClick={() => setShowRecommended(value => !value)}
                className={`rounded px-2 py-1 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${showRecommended ? "bg-blue-100 text-blue-900" : "bg-white text-slate-600"}`}>
                Recommended
              </button>
            </span>
            <span className="h-4 border-l border-slate-300" aria-hidden="true" />
            <span className="font-semibold text-slate-700">Evidence:</span>
            {[
              { label: "Valid", className: "border-[#16A34A] bg-[#16A34A]" },
              { label: "Expires during contract", className: "border-[#F59E0B] bg-[#F59E0B]" },
              { label: "Expired at joining", className: "border-[#DC2626] bg-[#DC2626]" },
              { label: "Not held", className: "border-[#DC2626] bg-transparent" },
              { label: "Expiry not recorded", className: "border-[#F59E0B] bg-transparent" },
            ].map(item => (
              <span key={item.label} className="inline-flex items-center gap-1.5 text-slate-700">
                <span className={`inline-block h-2.5 w-2.5 rounded-full border-2 ${item.className}`} aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        {!showMandatory && !showRecommended && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
            Choose Mandatory and/or Recommended to show requirement evidence.
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
                      <TableHead key={`${crew.assignmentUuid}-${index}`} className="sticky top-0 z-20 w-[142px] min-w-[142px] max-w-[142px] bg-[#52baf3] px-2 text-center text-white">
                      <div className="truncate text-xs font-semibold text-white">{sentenceCaseLabel(crew.context.contractRankLabel || "Captured rank not recorded")}</div>
                      <button type="button" aria-label={crew.context.crewName || "Crew member"} title={crew.context.crewName || "Crew member"} className="mt-0.5 block max-w-full truncate text-[10px] font-medium underline decoration-white/60 underline-offset-2 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        onClick={() => setSelectedCrew(crew)} data-testid={`onboard-training-details-${index}`}>
                        {sentenceCaseLabel(crew.context.crewName || "Crew member")}
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
                     <TableRow className="bg-blue-100"><TableCell colSpan={payload.crew.length + 2} className="py-1 text-xs font-semibold">{row.category}</TableCell></TableRow>
                  )}
                   <TableRow className="h-9 border-b border-slate-100">
                     <TableCell className="sticky left-0 z-10 h-9 w-24 border-r border-slate-200 bg-white px-2 py-0 text-xs text-slate-600">{row.companyId}</TableCell>
                     <TableCell className="sticky left-24 z-10 h-9 w-72 border-r border-slate-200 bg-white px-2 py-0 text-xs font-medium text-slate-800">
                        <span className="block whitespace-normal break-words leading-tight">{row.name}</span>
                    </TableCell>
                    {payload.crew.map((crew, index) => (
                      <TableCell key={`${crew.assignmentUuid}-${row.courseUuid}`} className="h-9 p-0 text-center">
                        {(() => {
                          const course = crew.courses.find(item => item.courseUuid === row.courseUuid);
                          const requirement = course?.obligation === "mandatory" ? "Mandatory"
                            : course?.obligation === "recommended" ? "Recommended" : "Not required for this rank";
                          const showStatus = course?.obligation === "mandatory" ? showMandatory
                            : course?.obligation === "recommended" ? showRecommended : false;
                          return <MatrixCell requirement={requirement} course={course} dot={dotsByCrew[index].get(row.courseUuid)} check={crew}
                            showStatus={showStatus} />;
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
