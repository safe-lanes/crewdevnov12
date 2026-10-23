import React, { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { TrainingMatrixCompliance, type TrainingComplianceResponse } from "./TrainingMatrixCompliance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DueInChips, type DueInWindow } from "@/components/common/DueInChips";

type Dot = {
  courseUuid: string;
  color: "green" | "amber" | "red" | "grey";
  outline: boolean;
  label: string;
  reasons: string[];
};
type UrgencyWindow = DueInWindow;

type MatrixRow = {
  companyTrainingId: number;
  courseUuid: string;
  companyId: string;
  name: string;
  category: string;
};

type OnboardCrew = Omit<TrainingComplianceResponse, "courses"> & {
  courses: Array<TrainingComplianceResponse["courses"][number] & { urgencyWindows: UrgencyWindow[] }>;
  referenceKind: "on_board";
  plannedReliefDate: string | null;
  effectiveReliefDate: string | null;
  dots: Dot[];
};

type VesselTrainingCompliance = {
  referenceDate: string;
  twoMonthDate: string;
  trialReliefDate: string | null;
  matrixRevision: string | null;
  rows: MatrixRow[];
  crew: OnboardCrew[];
};

type Props = { vesselUuid: string | null };

function hasCapturedContractRank(crew: OnboardCrew) {
  return crew.contractRankUuid !== null && crew.contractRankUuid !== undefined;
}

const vocabulary = (value: string) => value
  .replaceAll("Expires before planned relief", "Expires during contract")
  .replace(/\bExpired\b(?! at joining)/g, "Expired at joining");

type EvidenceStyle = { color: "green" | "amber" | "red"; outline: boolean };
type MatrixCourse = OnboardCrew["courses"][number];
type MatrixCheck = Pick<OnboardCrew, "status" | "issues">;

const matrixVocabulary = (value: string) => value
  .replaceAll("Expires before planned relief", "Expires during contract")
  .replace(/\bExpired\b(?! at joining)/g, "Expired at joining");

function titleCaseName(value: string) {
  return value.toLocaleLowerCase().replace(/(^|[\s.'’-])([\p{L}\p{N}])/gu, (_match, separator: string, initial: string) =>
    `${separator}${initial.toLocaleUpperCase()}`);
}

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

type PlacementSide = "left" | "right" | "top" | "bottom";

function placementFor(trigger: HTMLElement, boundary: HTMLElement | null): PlacementSide {
  const triggerRect = trigger.getBoundingClientRect();
  const bounds = boundary?.getBoundingClientRect();
  const leftEdge = Math.max(bounds?.left ?? 0, 0);
  const rightEdge = Math.min(bounds?.right ?? window.innerWidth, window.innerWidth);
  const topEdge = Math.max(bounds?.top ?? 0, 0);
  const bottomEdge = Math.min(bounds?.bottom ?? window.innerHeight, window.innerHeight);
  const above = triggerRect.top - topEdge;
  const below = bottomEdge - triggerRect.bottom;
  const popupWidth = Math.max(0, Math.min(320, rightEdge - leftEdge - 16));
  const roomOnLeft = triggerRect.left - leftEdge;
  const roomOnRight = rightEdge - triggerRect.right;
  const verticalSide = below >= above ? "bottom" : "top";
  if (below < 150 && above > below) return "top";
  // Radix flips left/right, but cannot shift a right-facing card horizontally.
  // Prefer a vertical card when neither horizontal side can fit inside evidence.
  if (roomOnLeft < 170) return roomOnRight >= popupWidth + 8 ? "right" : verticalSide;
  if (roomOnRight < 170) return roomOnLeft >= popupWidth + 8 ? "left" : verticalSide;
  if (above < 150 && below > above) return "bottom";
  return roomOnLeft >= popupWidth + 8 ? "left" : verticalSide;
}

function MatrixCell({ requirement, course, dot, showStatus, check, boundary, rankMissing, hideCell = false }: {
  requirement: "Mandatory" | "Recommended" | "Not required for this rank" | "Contract rank not captured";
  course: MatrixCourse | undefined;
  check: MatrixCheck;
  dot: Dot | undefined;
  showStatus: boolean;
  boundary: HTMLDivElement | null;
  rankMissing: boolean;
  hideCell?: boolean;
}) {
  const hasRequirement = course?.obligation === "mandatory" || course?.obligation === "recommended";
  const relevantCourse = hasRequirement ? course : undefined;
  const relevantDot = hasRequirement ? dot : undefined;
  const style = showStatus
    ? rankMissing ? { color: "amber" as const, outline: true } : resolveEvidenceStyle(relevantCourse, relevantDot, check)
    : undefined;
  const labels = hasRequirement ? evidenceText(relevantCourse, relevantDot, check) : [];
  const missingRankText = "Contract rank was not captured for this assignment; requirement could not be checked.";
  const meaning = rankMissing ? missingRankText : [requirement, ...labels].join(" — ");
  const [placementSide, setPlacementSide] = useState<PlacementSide>("left");
  const boundaryRect = boundary?.getBoundingClientRect();
  const popupStyle = boundaryRect ? {
    maxWidth: Math.max(0, Math.min(320, boundaryRect.width - 16)),
    maxHeight: Math.max(0, boundaryRect.height - 16),
    overflowY: "auto" as const,
  } : undefined;
  const bgClass = requirement === "Mandatory" ? "bg-green-50"
    : requirement === "Recommended" ? "bg-blue-100" : "bg-white";
  if (hideCell) return <div className={`flex h-9 min-w-[142px] items-center justify-center ${bgClass}`} aria-hidden="true" />;
  return (
    <div className={`flex h-9 min-w-[142px] items-center justify-center ${bgClass}`}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button type="button" className="flex h-9 w-full items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-sky-700"
                aria-label={meaning} data-testid={style ? "vessel-training-dot" : "vessel-training-cell-info"}
                data-color={style?.color} data-outline={style?.outline}
                onPointerMove={event => setPlacementSide(placementFor(event.currentTarget, boundary))}
                onPointerEnter={event => setPlacementSide(placementFor(event.currentTarget, boundary))}
                onMouseEnter={event => setPlacementSide(placementFor(event.currentTarget, boundary))}
                onFocus={event => setPlacementSide(placementFor(event.currentTarget, boundary))}
                onClick={event => setPlacementSide(placementFor(event.currentTarget, boundary))}>
                {style && <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full border-2 ${evidenceDotClass(style)}`} />}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side={placementSide} align={placementSide === "top" || placementSide === "bottom" ? "start" : "center"}
            collisionBoundary={boundary ?? undefined} collisionPadding={8} style={popupStyle}
            data-testid="vessel-training-tooltip" data-evidence-boundary="visible-evidence-region" data-preferred-side={placementSide}
            className="max-w-[min(20rem,calc(100vw-1rem))] text-left">{meaning}</TooltipContent>
        </Tooltip>
        <PopoverContent side={placementSide} align={placementSide === "top" || placementSide === "bottom" ? "start" : "center"}
          collisionBoundary={boundary ?? undefined} collisionPadding={8} style={popupStyle}
          data-testid="vessel-training-popover" data-evidence-boundary="visible-evidence-region" data-preferred-side={placementSide}
          className="w-[min(20rem,calc(100vw-1rem))] text-sm" role="status">{meaning}</PopoverContent>
      </Popover>
    </div>
  );
}

function TrialAndUrgencyControls({ trialDate, setTrialDate, selectedWindows, toggleWindow, showMandatory, showRecommended, toggleMandatory, toggleRecommended }: {
  trialDate: string;
  setTrialDate: (value: string) => void;
  selectedWindows: UrgencyWindow[];
  toggleWindow: (value: UrgencyWindow) => void;
  showMandatory: boolean;
  showRecommended: boolean;
  toggleMandatory: () => void;
  toggleRecommended: () => void;
}) {
  return (
    <TooltipProvider delayDuration={150}>
    <div aria-label="Training compliance legend" className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <DueInChips
          className="flex flex-wrap items-center gap-2"
          overdueLabel="O/D"
          selected={selectedWindows}
          onToggle={toggleWindow}
          compact
          helperText="Show cells matching any selected window. None selected shows everything."
        />
      </div>
      <span className="hidden h-5 border-l border-slate-300 sm:block" aria-hidden="true" />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label htmlFor="training-trial-relief-date" className="font-semibold text-slate-700">
          Check against a different relief date
        </label>
        <input
          id="training-trial-relief-date"
          type="date"
          value={trialDate}
          onChange={event => setTrialDate(event.currentTarget.value)}
          className="h-6 rounded border border-slate-300 bg-white px-2 text-[11px] leading-normal text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
          aria-label="Check against a different relief date"
        />
        {trialDate && (
          <>
            <span className="rounded bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900" role="status">
              Trial date active — no changes saved
            </span>
            <button type="button" onClick={() => setTrialDate("")}
              className="rounded px-2 py-1 text-[11px] font-bold text-sky-800 underline underline-offset-2 hover:text-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700">
              Clear trial date
            </button>
          </>
        )}
      </div>
      <span className="hidden h-5 border-l border-slate-300 sm:block" aria-hidden="true" />
      <span role="group" aria-label="Requirement filters" className="inline-flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-700">Requirement:</span>
        <button type="button" aria-pressed={showMandatory} onClick={toggleMandatory}
          className={`rounded px-2 py-1 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${showMandatory ? "bg-green-100 text-green-900" : "bg-white text-slate-600"}`}>
          Mandatory
        </button>
        <button type="button" aria-pressed={showRecommended} onClick={toggleRecommended}
          className={`rounded px-2 py-1 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700 ${showRecommended ? "bg-blue-100 text-blue-900" : "bg-white text-slate-600"}`}>
          Recommended
        </button>
      </span>
      <span className="hidden h-5 border-l border-slate-300 sm:block" aria-hidden="true" />
      <span role="group" aria-label="Evidence states" className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
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
      </span>
    </div>
    </TooltipProvider>
  );
}

export function VesselTrainingMatrix({ vesselUuid }: Props) {
  const [selectedCrewUuid, setSelectedCrewUuid] = useState<string | null>(null);
  const [showMandatory, setShowMandatory] = useState(true);
  const [showRecommended, setShowRecommended] = useState(false);
  const [trialDate, setTrialDate] = useState("");
  const [selectedWindows, setSelectedWindows] = useState<UrgencyWindow[]>([]);
  const [evidenceBoundary, setEvidenceBoundary] = useState<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const [evidenceBounds, setEvidenceBounds] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const query = useQuery<VesselTrainingCompliance>({
    queryKey: ["vessel-training-compliance", vesselUuid, trialDate || null],
    queryFn: async () => {
      const queryString = trialDate ? `?trialReliefDate=${encodeURIComponent(trialDate)}` : "";
      const response = await apiRequest("GET", `/api/v2/vessel/${encodeURIComponent(vesselUuid!)}/training-compliance${queryString}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.rows) || !Array.isArray(payload?.crew)) throw new Error("Training Matrix unavailable");
      return payload as VesselTrainingCompliance;
    },
    enabled: Boolean(vesselUuid),
    retry: false,
  });

  useLayoutEffect(() => {
    if (!query.data) return;
    const updateEvidenceBounds = () => {
      const frame = scrollFrameRef.current?.getBoundingClientRect();
      const viewport = scrollViewportRef.current?.getBoundingClientRect();
      const trainingColumn = scrollViewportRef.current?.querySelector<HTMLElement>('[data-testid="vessel-training-fixed-column"]')
        ?.getBoundingClientRect();
      if (!frame || !viewport) return;
      const right = Math.min(frame.right, viewport.right, window.innerWidth);
      const left = Math.min(right, Math.max(frame.left, viewport.left, trainingColumn?.right ?? viewport.left, 0));
      const top = Math.max(frame.top, viewport.top, 0);
      const bottom = Math.max(top, Math.min(frame.bottom, viewport.bottom, window.innerHeight));
      const next = { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      setEvidenceBounds(previous =>
        previous.top === next.top && previous.left === next.left
          && previous.width === next.width && previous.height === next.height ? previous : next);
    };
    updateEvidenceBounds();
    const frame = scrollFrameRef.current;
    const viewport = scrollViewportRef.current;
    frame?.addEventListener("scroll", updateEvidenceBounds);
    viewport?.addEventListener("scroll", updateEvidenceBounds);
    window.addEventListener("scroll", updateEvidenceBounds, true);
    window.addEventListener("resize", updateEvidenceBounds);
    return () => {
      frame?.removeEventListener("scroll", updateEvidenceBounds);
      viewport?.removeEventListener("scroll", updateEvidenceBounds);
      window.removeEventListener("scroll", updateEvidenceBounds, true);
      window.removeEventListener("resize", updateEvidenceBounds);
    };
  }, [query.data]);

  const toggleUrgencyWindow = (window: UrgencyWindow) => setSelectedWindows(current =>
    current.includes(window) ? current.filter(item => item !== window) : [...current, window]);
  const controls = (
    <TrialAndUrgencyControls trialDate={trialDate} selectedWindows={selectedWindows}
      setTrialDate={value => {
        setSelectedCrewUuid(null);
        setTrialDate(value);
      }}
      toggleWindow={toggleUrgencyWindow}
      showMandatory={showMandatory}
      showRecommended={showRecommended}
      toggleMandatory={() => setShowMandatory(value => !value)}
      toggleRecommended={() => setShowRecommended(value => !value)} />
  );
  if (!vesselUuid) return <p className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Select a vessel to view onboard training evidence.</p>;
  if (query.isLoading) return (
    <div className="space-y-3" aria-label="Loading onboard training compliance">
      {controls}
      <div className="h-12 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded bg-slate-100" />
      <div className="h-64 animate-pulse rounded bg-slate-100" />
    </div>
  );
  if (query.isError) return (
    <div className="space-y-3">
      {controls}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <span>Onboard training compliance could not be loaded.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>
          <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Retry
        </Button>
      </div>
    </div>
  );

  const payload = query.data;
  if (!payload) return null;
  const responseMatchesTrial = (payload.trialReliefDate ?? null) === (trialDate || null);
  if (!responseMatchesTrial || (Boolean(trialDate) && query.isFetching)) {
    return (
      <div className="space-y-3" aria-label="Loading onboard training compliance">
        {controls}
        <div className="h-12 animate-pulse rounded bg-slate-200" />
        <div className="h-24 animate-pulse rounded bg-slate-100" />
        <div className="h-64 animate-pulse rounded bg-slate-100" />
      </div>
    );
  }
  const selectedCrew = selectedCrewUuid
    ? payload.crew.find(crew => crew.assignmentUuid === selectedCrewUuid) ?? null
    : null;
  const dotsByCrew = payload.crew.map(crew => new Map((crew.dots ?? []).map(dot => [dot.courseUuid, dot])));
  const filteredRows = payload.rows.filter(row => (showMandatory || showRecommended) && payload.crew.some(crew => {
    const course = crew.courses.find(item => item.courseUuid === row.courseUuid);
    const urgencyMatches = selectedWindows.length === 0
      || Boolean(course?.urgencyWindows?.some((window: UrgencyWindow) => selectedWindows.includes(window)));
    if (!urgencyMatches) return false;
    if (!hasCapturedContractRank(crew)) return selectedWindows.length === 0;
    return course?.obligation === "mandatory" ? showMandatory
      : course?.obligation === "recommended" ? showRecommended
        : false;
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
        {controls}
        {!showMandatory && !showRecommended && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
            Choose Mandatory and/or Recommended to show requirement evidence.
          </p>
        )}
        <div ref={scrollFrameRef} className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <div ref={scrollViewportRef} className="relative max-h-[calc(100vh-300px)] min-h-48 overflow-auto">
            <div ref={setEvidenceBoundary} aria-hidden="true" data-testid="vessel-training-evidence-boundary"
              className="pointer-events-none fixed z-0"
              style={{ top: evidenceBounds.top, left: evidenceBounds.left, width: evidenceBounds.width, height: evidenceBounds.height }} />
            <Table className="min-w-max">
              <TableHeader className="sticky top-0 z-20">
                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                  <TableHead className="sticky left-0 top-0 z-30 w-24 border-r border-white/20 bg-[#52baf3] text-xs text-white">Company ID</TableHead>
                  <TableHead data-testid="vessel-training-fixed-column" className="sticky left-24 top-0 z-30 w-72 border-r border-white/20 bg-[#52baf3] text-xs text-white">Training</TableHead>
                    {payload.crew.map((crew, index) => (
                      <TableHead key={`${crew.assignmentUuid}-${index}`} className="sticky top-0 z-20 w-[142px] min-w-[142px] max-w-[142px] bg-[#52baf3] px-2 text-center text-white">
                        <div className="truncate text-xs font-semibold text-white">{sentenceCaseLabel(crew.context.contractRankLabel || "Captured rank not recorded")}</div>
                      <button type="button" aria-label={crew.context.crewName || "Crew member"} title={crew.context.crewName || "Crew member"} className="mx-auto mt-0.5 block max-w-full truncate text-center text-[10px] font-medium underline decoration-white/60 underline-offset-2 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                        onClick={() => setSelectedCrewUuid(crew.assignmentUuid)} data-testid={`onboard-training-details-${index}`}>
                        {titleCaseName(crew.context.crewName || "Crew member")}
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
                          const rankMissing = !hasCapturedContractRank(crew);
                           const urgencyMatches = selectedWindows.length === 0
                             || Boolean(course?.urgencyWindows?.some(window => selectedWindows.includes(window)));
                          const requirement = rankMissing ? "Contract rank not captured"
                            : course?.obligation === "mandatory" ? "Mandatory"
                              : course?.obligation === "recommended" ? "Recommended" : "Not required for this rank";
                          const showStatus = rankMissing ? showMandatory || showRecommended
                            : course?.obligation === "mandatory" ? showMandatory
                              : course?.obligation === "recommended" ? showRecommended : false;
                          return <MatrixCell requirement={requirement} course={course} dot={dotsByCrew[index].get(row.courseUuid)} check={crew}
                             showStatus={showStatus && urgencyMatches} boundary={evidenceBoundary} rankMissing={rankMissing}
                             hideCell={!urgencyMatches} />;
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
          Evidence is evaluated against the server-recorded reference date and each assignment’s planned relief date. {trialDate
            ? "This trial uses the server-evaluated effective relief date; actual planned relief dates remain unchanged."
            : null} Matrix revision: {payload.matrixRevision ?? "Not available"}.
        </p>
      </section>
      {selectedCrew && responseMatchesTrial && (
        <TrainingMatrixCompliance
          embeddedResult={embeddedResult ? {
            ...embeddedResult,
            contractEnd: selectedCrew.effectiveReliefDate ?? selectedCrew.contractEnd,
          } : undefined}
          open={Boolean(selectedCrew)}
          onDetailsClose={() => setSelectedCrewUuid(null)}
        />
      )}
    </TooltipProvider>
  );
}
