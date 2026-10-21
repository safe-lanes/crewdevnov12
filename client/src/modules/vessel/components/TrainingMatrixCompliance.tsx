import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronRight, FileText, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";

type CourseState = "Valid" | "Valid, no expiry" | "Expires during contract" | "Expired at joining" | "Not held";
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
  if (state === "Expires during contract") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

function summaryTone(status: GroupSummary["status"]) {
  if (status === "valid") return "text-emerald-800";
  if (status === "warning") return "text-amber-800";
  if (status === "gap") return "text-rose-800";
  return "text-slate-700";
}

function summaryLabel(label: "Mandatory" | "Recommended", summary: GroupSummary, resultStatus: ComplianceResult["status"]) {
  if (resultStatus === "complete" && summary.count === 0) return `${label}: None required for this rank`;
  return `${label}: ${groupStatusLabel[summary.status]} (${summary.count})`;
}

function hasCorrectionFlags(course: CourseResult) {
  return course.certificates.some(entry => entry.flags.length > 0);
}

function needsAction(course: CourseResult) {
  return !course.complete
    || course.state === "Not held"
    || course.state === "Expired at joining"
    || course.state === "Expires during contract"
    || hasCorrectionFlags(course);
}

function canExpand(course: CourseResult) {
  return course.certificates.length > 1
    || Boolean(course.isEquivalent || course.certificates.some(entry => entry.selected && entry.isEquivalent))
    || hasCorrectionFlags(course);
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
                {summaryLabel("Mandatory", result.summary.mandatory, result.status)}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${summaryTone(result.summary.recommended.status)}`}>
                <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                {summaryLabel("Recommended", result.summary.recommended, result.status)}
              </span>
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
                <ContextItem label="Calculated contract end" value={result.contractEndStatus === "set" ? dateLabel(result.contractEnd) : result.contractEndStatus === "invalid" ? "Invalid date" : "Not set"} />
                <ContextItem label="Matrix revision" value={result.matrixRevision ?? "Not available"} />
              </section>

              {result.status === "incomplete" && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950" role="status">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Compliance calculation is incomplete. Results below may not cover every requirement.</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}
                    data-testid="training-compliance-recheck">Retry</Button>
                </div>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className={`font-medium ${summaryTone(result.summary.mandatory.status)}`}>{summaryLabel("Mandatory", result.summary.mandatory, result.status)}</span>
                <span className={`font-medium ${summaryTone(result.summary.recommended.status)}`}>{summaryLabel("Recommended", result.summary.recommended, result.status)}</span>
              </div>
              {result.issues.length > 0 && (
                <ul className="space-y-1 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  aria-label="Training check notes">
                  {[...new Set(result.issues.map(issue => issue.message))].map(message => <li key={message}>{message}</li>)}
                </ul>
              )}

              <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-4 py-3">
                <label htmlFor="training-only-needs-action" className="text-sm font-medium text-slate-700">Show only items needing action</label>
                <Switch id="training-only-needs-action" aria-label="Show only items needing action" checked={onlyNeedsAction} onCheckedChange={setOnlyNeedsAction} />
              </div>

              <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                  <thead className="bg-sky-700 text-white">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Course</th>
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
                          <th colSpan={6} scope="colgroup" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{group.label}</th>
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
                            <td className="px-3 py-3">
                              <div className="flex items-start gap-2">
                                {expandable ? (
                                  <button type="button" onClick={() => toggleCourse(course.courseUuid)} aria-expanded={courseExpanded} aria-label={`${courseExpanded ? "Collapse" : "Expand"} certificate details for ${course.name}`} className="mt-0.5 rounded p-0.5 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700" data-testid={`training-certificate-expand-${course.courseUuid}`}>
                                    {courseExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </button>
                                ) : <span className="mt-0.5 w-5 shrink-0" aria-hidden="true" />}
                                <div>
                                  <div className="font-medium text-slate-800">{course.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-slate-700">{course.obligation === "mandatory" ? "Mandatory" : "Recommended"}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusTone(course.state, course.complete)}`}>{statusText}</span>
                              {certificate && (
                                <div className="mt-1.5 max-w-[200px] text-xs text-slate-700" data-testid={`training-selected-certificate-${course.courseUuid}`}>
                                  <span className="font-medium">{certificate.number ? `${certificate.number} — ` : ""}{certificate.name}</span>
                                  {selected?.isEquivalent || course.isEquivalent ? <span className="ml-1 text-sky-800">Equivalent</span> : null}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-700">{certificate ? certificate.issued ? dateLabel(certificate.issued) : "Not recorded" : "—"}</td>
                            <td className="px-3 py-3 text-slate-700">{certificate ? certificate.expiry ? dateLabel(certificate.expiry) : "No expiry" : "—"}</td>
                            <td className="px-3 py-3">
                              {selected?.attachments.length ? (
                                <AttachmentButton attachment={selected.attachments[0]} onOpen={openAttachment} />
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                          {courseExpanded && expandable && (
                            <tr className="border-t border-slate-100 bg-slate-50">
                              <td colSpan={6} className="px-4 py-3">
                                {course.certificates.length ? (
                                  <div className="space-y-2">
                                    <p className="text-xs text-slate-600">
                                      Selection rule: use the certificate counted at joining with no expiry,
                                      otherwise the latest expiry. Ties prefer the required course itself,
                                      then the latest issue date.
                                    </p>
                                    {course.certificates.map(entry => (
                                      <div key={entry.certificate.certificateUuid} className="grid gap-x-4 gap-y-2 rounded border border-slate-200 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto_minmax(150px,1fr)]">
                                        <div>
                                          <span className="font-medium text-slate-800">{entry.certificate.number ? `${entry.certificate.number} — ` : ""}{entry.certificate.name || "Unnamed certificate"}</span>
                                          {entry.selected && <span className="ml-2 text-emerald-800">Selected</span>}
                                          {entry.isEquivalent && <span className="ml-2 text-sky-800">Equivalent</span>}
                                        </div>
                                        <span className="text-slate-600">{{
                                          selected: "Selected by the compliance calculation",
                                          not_selected: "Not used: another certificate was preferred by the calculation",
                                          future_issued: "Issued after planned joining: not counted",
                                          invalid_expiry: "Expiry date invalid: certificate set aside",
                                        }[entry.disposition]}</span>
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
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-600">{onlyNeedsAction ? "No items needing action." : "No rank requirements were returned for this assignment."}</td></tr>
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
