import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronRight, FileText, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";

type CourseState = "Valid" | "Valid, no expiry" | "Expires during contract" | "Expired at joining" | "Not held" | "Expiry not recorded";
type GroupSummary = { status: "valid" | "warning" | "gap" | "incomplete"; count: number };
type TrainingCertificate = {
  certificateUuid: string;
  courseUuid: string | null;
  name: string;
  number: string | null;
  issued: string | null;
  expiry: string | null;
};
type CertificateAttachment = { uuid: string; fileName: string; url: string };
type CourseResult = {
  courseUuid: string;
  name: string;
  companyId: string | null;
  category?: string | null;
  categoryOrder?: number | null;
  matrixOrder?: number | null;
  obligation: "mandatory" | "recommended";
  calculationVersion: string;
  state: CourseState | null;
  complete: boolean;
  validAtJoining: boolean | null;
  validThroughContract: boolean | null;
  chosenCertificate: TrainingCertificate | null;
  isEquivalent: boolean | null;
  issues: { code: string; message: string; courseUuid?: string; certificateUuid?: string; blocking?: boolean }[];
  futureIssuedCertificateUuids: string[];
  certificates: {
    certificate: TrainingCertificate;
    isEquivalent: boolean;
    selected: boolean;
    disposition: "selected" | "not_selected" | "future_issued" | "invalid_expiry";
    flags: string[];
    attachments: CertificateAttachment[];
  }[];
};
type ComplianceResult = {
  calculationVersion: string;
  assignmentUuid: string;
  vesselUuid: string | null;
  contractRankUuid: string | null;
  joiningDate: string | null;
  contractEnd: string | null;
  contractEndStatus: "set" | "not_set" | "invalid";
  contractEndSource: "range_end" | "contract_period" | null;
  canonical?: { contractPeriodMonths: number | null };
  matrixRevisionUuid: string | null;
  matrixRevision: string | null;
  rankRequirementsSource: "current_company_rank_requirements";
  status: "complete" | "incomplete";
  issues: { code: string; message: string; courseUuid?: string; certificateUuid?: string; blocking?: boolean }[];
  courses: CourseResult[];
  summary: { mandatory: GroupSummary; recommended: GroupSummary };
  unlinkedCertificateUuids: string[];
  context: {
    crewUuid: string;
    crewName: string;
    contractRankLabel: string;
    vesselName: string;
  };
};

type TrainingMatrixComplianceProps = {
  planUuid?: string | null;
  assignmentUuid?: string | null;
  open: boolean;
};

const groupStatusLabel: Record<GroupSummary["status"], string> = {
  valid: "All clear",
  warning: "Review",
  gap: "Action needed",
  incomplete: "Incomplete",
};

function dateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  let year: number;
  let month: number;
  let day: number;
  if (dateOnly) {
    year = Number(dateOnly[1]);
    month = Number(dateOnly[2]);
    day = Number(dateOnly[3]);
    const check = new Date(0);
    check.setUTCFullYear(year, month - 1, day);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return "Invalid date";
  } else {
    return "Invalid date";
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(day).padStart(2, "0")}-${months[month - 1]}-${year}`;
}

function getStatusTone(state: CourseState | null, complete: boolean) {
  if (!complete || state === null) return "border-slate-300 bg-slate-100 text-slate-700";
  if (state === "Valid" || state === "Valid, no expiry") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (state === "Expires during contract" || state === "Expiry not recorded") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function summaryTone(status: GroupSummary["status"]) {
  if (status === "valid") return "text-emerald-800";
  if (status === "warning") return "text-amber-800";
  if (status === "gap") return "text-rose-800";
  return "text-slate-700";
}

function summaryLabel(
  label: "Mandatory" | "Recommended",
  summary: GroupSummary,
  resultStatus: ComplianceResult["status"],
  problemCount: number,
) {
  if (resultStatus === "complete" && summary.count === 0 && problemCount === 0) return `${label}: None required for this rank`;
  return `${label}: ${groupStatusLabel[summary.status]} (${problemCount} ${problemCount === 1 ? "problem" : "problems"})`;
}

function hasCorrectionFlags(course: CourseResult) {
  return course.certificates.some(entry => entry.flags.length > 0);
}

function needsAction(course: CourseResult) {
  return !course.complete
    || course.state === "Not held"
    || course.state === "Expired at joining"
    || course.state === "Expires during contract"
    || course.state === "Expiry not recorded"
    || hasCorrectionFlags(course);
}

function groupProblemCount(courses: CourseResult[], obligation: CourseResult["obligation"], summary: GroupSummary) {
  const visibleProblemCount = courses.filter(course => course.obligation === obligation && needsAction(course)).length;
  // Any non-clear summary is authoritative even if the detail payload omitted an affected course.
  return summary.status === "valid" ? visibleProblemCount : Math.max(1, visibleProblemCount);
}

function canExpand(course: CourseResult) {
  return course.certificates.length > 1
    || Boolean(course.isEquivalent || course.certificates.some(entry => entry.isEquivalent));
}

function issueAction(issue: CourseResult["issues"][number]) {
  if (issue.code === "ISSUE_DATE_NOT_RECORDED") return "Enter the issue date in crew profile → D3 Training Courses.";
  if (issue.code === "EXPIRY_NOT_RECORDED") return "Enter the expiry date in crew profile → D3 Training Courses.";
  if (issue.code === "INVALID_ISSUE_DATE" || issue.code === "INVALID_CERTIFICATE_DATES") return "Correct the certificate dates in crew profile → D3 Training Courses.";
  return issue.message;
}

function courseActions(course: CourseResult) {
  const actions = new Set<string>();
  if (course.state === "Not held") actions.add("Add the certificate in crew profile → D3.");
  if (course.state === "Expired at joining") actions.add("Add a current certificate in crew profile → D3.");
  if (course.state === "Expires during contract") actions.add("Renew the certificate in crew profile → D3 before the contract ends.");
  if (course.state === "Expiry not recorded") actions.add("Enter the expiry date in crew profile → D3 Training Courses.");
  if (!course.complete || course.state === null) actions.add("Complete the missing training information in crew profile → D3.");
  if (course.futureIssuedCertificateUuids.length) {
    const count = course.futureIssuedCertificateUuids.length;
    actions.add(`${count} ${count === 1 ? "certificate was" : "certificates were"} issued after planned joining and cannot be counted. Add a certificate valid on the joining date in crew profile → D3.`);
  }
  course.issues.forEach(issue => actions.add(issueAction(issue)));
  return [...actions];
}

function rowNextAction(course: CourseResult) {
  if (course.state === "Not held") return "Add the certificate in crew profile → D3.";
  if (course.state === "Expiry not recorded") return "Enter the expiry date in crew profile → D3.";
  if (course.state === "Expired at joining") return "Add a current certificate in crew profile → D3.";
  if (course.state === "Expires during contract") return "Renew in D3 before the contract ends.";
  if (!course.complete) return "Correct the missing information shown above, then retry.";
  if (course.issues.some(i => i.code.startsWith("INVALID_"))) return "Correct the certificate dates in D3.";
  if (course.issues.some(i => i.code === "ISSUE_DATE_NOT_RECORDED")) return "Enter the issue date in D3.";
  if (course.certificates.some(entry => entry.flags.length > 0)) return "Correct the flagged certificate record in D3.";
  return "";
}

function actionBanner(courses: CourseResult[]) {
  const certificateIssues = new Map<string, { uuids: Set<string>; names: Set<string> }>();
  const otherFlags = new Map<string, { uuids: Set<string>; names: Set<string> }>();
  const addCertificateIssue = (label: string, course: CourseResult, certificateUuid?: string) => {
    const item = certificateIssues.get(label) ?? { uuids: new Set<string>(), names: new Set<string>() };
    if (certificateUuid) item.uuids.add(certificateUuid);
    item.names.add(course.name);
    certificateIssues.set(label, item);
  };
  for (const course of courses) {
    for (const entry of course.certificates) for (const flag of entry.flags) {
      if (course.issues.some(issue => issue.certificateUuid === entry.certificate.certificateUuid && issue.message === flag)) continue;
      const item = otherFlags.get(flag) ?? { uuids: new Set<string>(), names: new Set<string>() };
      item.uuids.add(entry.certificate.certificateUuid); item.names.add(course.name);
      otherFlags.set(flag, item);
    }
    for (const issue of course.issues) {
      if (issue.code === "ISSUE_DATE_NOT_RECORDED") addCertificateIssue("missing issue date", course, issue.certificateUuid);
      else if (issue.code === "EXPIRY_NOT_RECORDED") addCertificateIssue("missing expiry date", course, issue.certificateUuid);
      else if (issue.code === "INVALID_ISSUE_DATE" || issue.code === "INVALID_CERTIFICATE_DATES") addCertificateIssue("invalid certificate dates", course, issue.certificateUuid);
    }
  }
  const items = [...certificateIssues].map(([label, item]) => {
    const count = item.uuids.size || item.names.size;
    const description = label === "missing issue date"
      ? `${count} ${count === 1 ? "certificate is missing its" : "certificates are missing their"} issue date`
      : label === "missing expiry date"
        ? `${count} ${count === 1 ? "certificate is missing its" : "certificates are missing their"} expiry date`
        : `${count} ${count === 1 ? "certificate has" : "certificates have"} invalid dates`;
    return { text: `${description}: ${[...item.names].join(", ")}. Correct in crew profile → D3 Training Courses.` };
  });
  const stateGroups = new Map<string, Set<string>>();
  for (const [flag, item] of otherFlags) {
    const count = item.uuids.size;
    items.push({ text: `${count} ${count === 1 ? "certificate needs" : "certificates need"} correction: ${[...item.names].join(", ")}. ${flag}. Correct in crew profile → D3 Training Courses.` });
  }
  for (const course of courses) {
    const action = courseActions(course).find(value => !course.issues.some(issue => issueAction(issue) === value));
    if (action) {
      const group = stateGroups.get(action) ?? new Set<string>();
      group.add(course.name);
      stateGroups.set(action, group);
    }
  }
  stateGroups.forEach((names, action) => items.push({ text: `${names.size} ${names.size === 1 ? "course" : "courses"} need action: ${[...names].join(", ")}. ${action}` }));
  return items;
}

function orderedCourses(courses: CourseResult[]) {
  return courses.map((course, index) => ({ course, index })).sort((a, b) => {
    const categoryOrderA = a.course.categoryOrder ?? Number.MAX_SAFE_INTEGER;
    const categoryOrderB = b.course.categoryOrder ?? Number.MAX_SAFE_INTEGER;
    const matrixOrderA = a.course.matrixOrder ?? Number.MAX_SAFE_INTEGER;
    const matrixOrderB = b.course.matrixOrder ?? Number.MAX_SAFE_INTEGER;
    return categoryOrderA - categoryOrderB || matrixOrderA - matrixOrderB || a.index - b.index;
  }).map(item => item.course);
}

async function fetchCompliance(url: string): Promise<ComplianceResult> {
  const response = await apiRequest("GET", url);
  return await response.json() as ComplianceResult;
}

export function TrainingMatrixCompliance({ planUuid, assignmentUuid, open }: TrainingMatrixComplianceProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({});
  const [onlyNeedsAction, setOnlyNeedsAction] = useState(false);
  const hasIds = Boolean(planUuid && assignmentUuid);
  const url = hasIds
    ? `/api/v2/vessel/planning/${encodeURIComponent(planUuid!)}/reliever-assignment/${encodeURIComponent(assignmentUuid!)}/training-compliance`
    : "";
  const query = useQuery({
    queryKey: ["training-matrix-compliance", planUuid ?? null, assignmentUuid ?? null],
    queryFn: () => fetchCompliance(url),
    enabled: open && hasIds,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const result = !query.isError && !query.isFetching && query.data?.assignmentUuid === assignmentUuid ? query.data : undefined;
  const sortedCourses = result ? orderedCourses(result.courses) : [];
  const mandatoryProblemCount = result ? groupProblemCount(sortedCourses, "mandatory", result.summary.mandatory) : 0;
  const recommendedProblemCount = result ? groupProblemCount(sortedCourses, "recommended", result.summary.recommended) : 0;
  const visibleCourses = onlyNeedsAction ? sortedCourses.filter(needsAction) : sortedCourses;
  const coursesByCategory = visibleCourses.reduce<Array<{ label: string; courses: CourseResult[] }>>((groups, course) => {
    const label = course.category ?? "Unassigned";
    const last = groups[groups.length - 1];
    if (last?.label === label) last.courses.push(course);
    else groups.push({ label, courses: [course] });
    return groups;
  }, []);

  const openAttachment = async (attachment: CertificateAttachment) => {
    const pendingWindow = window.open("about:blank", "_blank");
    try {
      const response = await apiRequest("GET", attachment.url);
      const objectUrl = URL.createObjectURL(await response.blob());
      if (pendingWindow) {
        pendingWindow.location.href = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else {
        URL.revokeObjectURL(objectUrl);
        window.alert("The attachment could not be opened. Please allow pop-ups and try again.");
      }
    } catch {
      pendingWindow?.close();
      window.alert("The attachment could not be opened. Please try again.");
    }
  };

  const toggleCourse = (courseUuid: string) => {
    setExpandedCourses(current => ({ ...current, [courseUuid]: !current[courseUuid] }));
  };

  return (
    <>
      <div className="grid grid-cols-3 items-center gap-4 border-t border-slate-200 pt-3" data-testid="training-matrix-compliance-line">
        <div className="text-sm font-medium text-slate-700">Training Matrix Compliance:</div>
        <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {!hasIds ? (
            <span className="text-sm text-slate-600">Unavailable — a linked reliever assignment is required.</span>
          ) : query.isFetching ? (
            <span className="inline-flex h-5 w-40 animate-pulse rounded bg-slate-200" aria-label="Loading training compliance" />
          ) : query.isError ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm text-rose-800">
                <AlertCircle className="h-4 w-4" aria-hidden="true" /> Training compliance could not be loaded.
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()} data-testid="training-compliance-retry">
                <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Retry
              </Button>
            </>
          ) : result ? (
            <>
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${summaryTone(result.summary.mandatory.status)}`}>
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                {summaryLabel("Mandatory", result.summary.mandatory, result.status, mandatoryProblemCount)}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${summaryTone(result.summary.recommended.status)}`}>
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                {summaryLabel("Recommended", result.summary.recommended, result.status, recommendedProblemCount)}
              </span>
              {result.contractEndStatus === "not_set" && (
                <span className="text-sm text-amber-900" role="status">
                  Contract end not set: enter Contract End Range to check validity for the whole contract
                </span>
              )}
              <Button type="button" variant="link" size="sm" className="h-auto px-0 py-0" onClick={() => { setOnlyNeedsAction(false); setDetailsOpen(true); }} data-testid="training-compliance-see-details">
                See Details
              </Button>
            </>
          ) : (
            <span className="text-sm text-slate-600">Training compliance is unavailable.</span>
          )}
        </div>
      </div>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[92vh] w-[min(1120px,96vw)] max-w-none overflow-y-auto border-slate-200 bg-[#fbfcfd] p-0">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
            <DialogTitle className="text-lg font-semibold text-slate-800">Training Matrix Compliance</DialogTitle>
          </DialogHeader>
          {!result && query.isFetching && (
            <div className="space-y-4 p-6" aria-label="Loading training compliance">
              <div className="h-20 animate-pulse rounded-md bg-slate-200" />
              <div className="h-8 animate-pulse rounded-md bg-slate-200" />
              <div className="h-52 animate-pulse rounded-md bg-slate-200" />
            </div>
          )}
          {!result && query.isError && (
            <div className="flex flex-wrap items-center gap-3 p-6" role="alert">
              <span className="text-sm text-rose-800">Training compliance could not be loaded.</span>
              <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()} data-testid="training-compliance-retry">
                <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Retry
              </Button>
            </div>
          )}
          {!result && !query.isFetching && !query.isError && (
            <p className="p-6 text-sm text-slate-600">Training compliance is unavailable for this reliever assignment.</p>
          )}
          {result && (
            <div className="space-y-5 p-4 sm:p-6">
              <section className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Assignment details">
                <ContextItem label="Seafarer" value={result.context.crewName} />
                <ContextItem label="Contract rank" value={result.context.contractRankLabel} />
                <ContextItem label="Vessel" value={result.context.vesselName} />
                <ContextItem label="Planned joining" value={dateLabel(result.joiningDate)} />
                <ContextItem
                  label={result.contractEndSource === "contract_period"
                    ? "Calculated contract end (based on contract period)"
                    : "Calculated contract end"}
                  value={result.contractEndStatus === "set" ? dateLabel(result.contractEnd) : result.contractEndStatus === "invalid" ? "Invalid date" : "Not set"}
                />
                <ContextItem label="Matrix revision" value={result.matrixRevision ?? "Not available"} />
              </section>
              {result.contractEndStatus === "not_set" && (
                <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Contract end not set: full-contract validity not checked. Enter Contract End Range to check validity for the whole contract.
                </p>
              )}

              {result.status === "incomplete" && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950" role="status">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Compliance calculation is incomplete. Results below may not cover every requirement.</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}
                    data-testid="training-compliance-recheck">Retry</Button>
                </div>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className={`font-medium ${summaryTone(result.summary.mandatory.status)}`}>{summaryLabel("Mandatory", result.summary.mandatory, result.status, mandatoryProblemCount)}</span>
                <span className={`font-medium ${summaryTone(result.summary.recommended.status)}`}>{summaryLabel("Recommended", result.summary.recommended, result.status, recommendedProblemCount)}</span>
              </div>
              {(actionBanner(sortedCourses).length > 0 || result.issues.length > 0) && (
                <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" aria-label="Training corrections needed">
                  <h3 className="font-semibold">What needs attention</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5">
                    {actionBanner(sortedCourses).map(item => <li key={item.text}>{item.text}</li>)}
                    {[...new Set(result.issues.filter(issue => !issue.courseUuid).map(issue => issue.message))].map(message => <li key={message}>{message}</li>)}
                  </ul>
                </section>
              )}
              <a
                href={`/crew-pool?crew=${encodeURIComponent(result.context.crewUuid)}&section=D3`}
                className="inline-flex rounded text-sm font-medium text-sky-800 underline underline-offset-2 hover:text-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
                data-testid="training-open-crew-profile"
              >Open crew profile (D3)</a>

              <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-4 py-3">
                <label htmlFor="training-only-needs-action" className="text-sm font-medium text-slate-700">Show only items needing action</label>
                <Switch id="training-only-needs-action" aria-label="Show only items needing action" checked={onlyNeedsAction} onCheckedChange={setOnlyNeedsAction} />
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full min-w-[1000px] table-fixed border-collapse text-left text-sm">
                  <colgroup>{[8, 20, 13, 9, 19, 9, 9, 13].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
                  <thead className="bg-sky-700 text-white">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Company ID</th>
                      <th className="px-3 py-2.5 font-semibold">Course</th>
                      <th className="px-3 py-2.5 font-semibold">Certificate No.</th>
                      <th className="px-3 py-2.5 font-semibold">Rank requirement</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-3 py-2.5 font-semibold">Issued</th>
                      <th className="px-3 py-2.5 font-semibold">Expiry</th>
                      <th className="px-3 py-2.5 font-semibold">Attachment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coursesByCategory.map(group => (
                      <React.Fragment key={group.label}>
                        <tr className="border-t border-slate-200 bg-slate-100" data-testid={`training-category-${group.label}`}>
                          <th colSpan={8} scope="colgroup" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{group.label}</th>
                        </tr>
                        {group.courses.map(course => {
                      const selected = course.certificates.find(entry => entry.selected);
                      const certificate = selected?.certificate ?? course.chosenCertificate;
                      const courseExpanded = Boolean(expandedCourses[course.courseUuid]);
                      const expandable = canExpand(course);
                      const statusText = !course.complete || course.state === null ? "Incomplete" : course.state;
                      return (
                        <React.Fragment key={course.courseUuid}>
                          <tr className="border-t border-slate-200 align-top" data-testid={`training-course-row-${course.courseUuid}`}>
                            <td className="px-3 py-3 text-slate-700">{course.companyId ?? "Not recorded"}</td>
                          <td className="px-3 py-3">
                              <div className="flex items-start gap-2">
                                {expandable ? (
                                  <button type="button" onClick={() => toggleCourse(course.courseUuid)} aria-expanded={courseExpanded} aria-label={`${courseExpanded ? "Collapse" : "Expand"} certificate details for ${course.name}`} className="mt-0.5 rounded p-0.5 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700" data-testid={`training-certificate-expand-${course.courseUuid}`}>
                                    {courseExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                ) : <span className="mt-0.5 w-5 shrink-0" aria-hidden="true" />}
                                <div>
                                  <div className="font-medium text-slate-800">{course.name}</div>
                                  {(selected?.isEquivalent || course.isEquivalent) && certificate && (
                                    <div className="mt-1 text-xs text-sky-800">Covered by {certificate.name} (accepted equivalent)</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="break-words px-3 py-3 text-slate-700" data-testid={`training-certificate-number-${course.courseUuid}`}>{certificate?.number || "—"}</td>
                            <td className="px-3 py-3 text-slate-700">{course.obligation === "mandatory" ? "Mandatory" : "Recommended"}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusTone(course.state, course.complete)}`}>{statusText}</span>
                              {rowNextAction(course) && <p className="mt-1.5 text-xs text-amber-900">{rowNextAction(course)}</p>}
                            </td>
                            <td className="px-3 py-3 text-slate-700">{certificate ? certificate.issued ? dateLabel(certificate.issued) : "Not recorded" : "—"}</td>
                            <td className="px-3 py-3 text-slate-700">{certificate ? certificate.expiry ? dateLabel(certificate.expiry) : course.state === "Expiry not recorded" ? "Not recorded" : "No expiry" : "—"}</td>
                            <td className="px-3 py-3">
                              {selected?.attachments.length ? (
                                <AttachmentButton attachment={selected.attachments[0]} onOpen={openAttachment} />
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                          {courseExpanded && expandable && (
                            <tr className="border-t border-slate-100 bg-slate-50">
                              <td colSpan={8} className="px-4 py-3">
                                {course.certificates.length ? (
                                  <div className="space-y-2">
                                    {course.certificates.map(entry => (
                                      <div key={entry.certificate.certificateUuid} className="grid gap-x-4 gap-y-2 rounded border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_minmax(150px,1fr)]">
                                        <div>
                                          <span className="font-medium text-slate-800">{entry.selected ? "Used: " : "Not used: "}{entry.certificate.name || "Unnamed certificate"}{entry.selected ? `, valid until ${entry.certificate.expiry ? dateLabel(entry.certificate.expiry) : "no expiry recorded"}` : `, expires ${entry.certificate.expiry ? dateLabel(entry.certificate.expiry) : "date not recorded"}`}</span>
                                          {entry.isEquivalent && <div className="mt-1 text-sky-800">Covered by {entry.certificate.name || "this course"} (accepted equivalent)</div>}
                                        </div>
                                        <span className="text-slate-600">Certificate No.: {entry.certificate.number || "Not recorded"}</span>
                                        <span className="text-slate-600">Issued: {dateLabel(entry.certificate.issued)}</span>
                                        <span className="text-slate-600">Expiry: {dateLabel(entry.certificate.expiry)}</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                          {entry.flags.map((flag, index) => <span key={`${flag}-${index}`} className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">{flag}</span>)}
                                          {entry.attachments.map(attachment => <AttachmentButton key={attachment.uuid} attachment={attachment} onOpen={openAttachment} />)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-600">{course.complete && course.state === "Not held" ? "Not held" : "No certificate records are available for this course."}</p>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}</React.Fragment>
                    ))}
                    {!visibleCourses.length && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600">{onlyNeedsAction ? "No items needing action." : "No rank requirements were returned for this assignment."}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                Dates reflect the last saved reliever assignment. Save changes to reliever dates and refresh this view to recalculate compliance.
                {" "}Calculation version: {result.calculationVersion}.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div><div className="mt-0.5 break-words text-sm text-slate-800">{value}</div></div>;
}

function AttachmentButton({ attachment, onOpen }: { attachment: CertificateAttachment; onOpen: (attachment: CertificateAttachment) => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-7 max-w-full justify-start gap-1.5 px-2 text-xs" onClick={() => onOpen(attachment)} data-testid={`training-attachment-${attachment.uuid}`}>
      <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{attachment.fileName}</span>
    </Button>
  );
}
