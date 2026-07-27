import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCompanyTrainings } from "@/hooks/useCompanyTrainings";
import { useVesselLookup } from "@/hooks/useVesselLookup";
import { getScoreColors } from "@/components/appraisal-form-parts/types";
import {
  generateAppraisalPDF,
  type AppraisalPDFPayload,
  type LabelValue,
} from "@/lib/generateAppraisalPDF";

interface TrainingEntry { id: string; training?: string; evaluation?: string; comment?: string }
interface TargetEntry { id: string; targetSetting?: string; evaluation?: string; comment?: string }
interface AssessmentEntry { id: string; assessmentCriteria?: string; weight?: number; effectiveness?: string; comment?: string }
interface TrainingNeedEntry { id: string; training?: string; comment?: string }
interface RecommendationEntry { id: string; question?: string; answer?: string; comment?: string }
interface CommentEntry { id: string; name?: string; rank?: string; comment?: string }
interface OfficeReviewEntry { id: string; name?: string; position?: string; feedback?: string }
interface TrainingFollowupEntry {
  id: string;
  training?: string;
  correspondingInDB?: string;
  category?: string;
  status?: string;
  targetDate?: string;
  comment?: string;
}

interface AppraisalDataShape {
  seafarersName?: string;
  seafarersRank?: string;
  nationality?: string;
  vessel?: string;
  signOn?: string;
  appraisalType?: string;
  appraisalPeriodFrom?: string;
  appraisalPeriodTo?: string;
  personalityIndexCategory?: string;
  primaryAppraiser?: string;
  trainings?: TrainingEntry[];
  targets?: TargetEntry[];
  competenceAssessments?: AssessmentEntry[];
  behaviouralAssessments?: AssessmentEntry[];
  trainingNeeds?: TrainingNeedEntry[];
  recommendations?: RecommendationEntry[];
  appraiserComments?: CommentEntry[];
  seafarerComments?: CommentEntry[];
  officeReviews?: OfficeReviewEntry[];
  trainingFollowups?: TrainingFollowupEntry[];
}

interface ExistingAppraisal {
  id: number;
  appraisalData: string | AppraisalDataShape;
  status: 'draft' | 'preliminary' | 'submitted' | 'stage2_submitted' | 'pending_review' | 'reviewed' | 'stage3_submitted';
  appraisalType?: string;
  appraisalDate?: string;
  formVersionId?: number | null;
  formVersionUuid?: string | null;
  competenceRating?: string;
  behavioralRating?: string;
  overallRating?: string;
}

interface RankGroupConfig {
  hiddenFields?: string[];
  hiddenSections?: string[];
}

interface PinnedFormConfigResponse {
  rankGroupName: string | null;
  rankGroupConfig: RankGroupConfig | null;
  formVersionId: number;
  formVersionUuid: string;
}

interface LatestFormConfigResponse {
  rankGroupName?: string | null;
  rankGroupConfig?: RankGroupConfig | null;
  noReleasedVersion?: boolean;
  noReleasedVersionReason?: string;
}

interface AppraisalViewProps {
  appraisalId: number;
  rank?: string;
  seafarerNameFallback?: string;
  onClose: () => void;
}

interface ApiError extends Error {
  status?: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DASH = "—";

function formatDate(value?: string): string {
  if (!value) return DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTHS[d.getMonth()];
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

function valueOr(v?: string | number | null): string {
  if (v === undefined || v === null || v === "") return DASH;
  return String(v);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    preliminary: "bg-blue-100 text-blue-700",
    submitted: "bg-amber-100 text-amber-700",
    reviewed: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-700",
  };
  const cls = map[status] || "bg-gray-100 text-gray-700";
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "N/A";
  return <Badge className={`rounded-md px-2.5 py-1 font-semibold ${cls}`}>{label}</Badge>;
}

function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <div className="mt-10 mb-5" data-testid={`section-${id}`}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#16569e] pb-2 border-b-2 border-[#16569e]">
        {title}
      </h2>
    </div>
  );
}

function SubHeader({ title }: { title: string }) {
  return (
    <h3 className="mt-6 mb-3 text-[12.5px] font-semibold text-[#16569e] tracking-wide">
      {title}
    </h3>
  );
}

function SectionScore({ label, value, testId }: { label: string; value?: string | null; testId?: string }) {
  if (!value || !String(value).trim()) return null;
  const numeric = parseFloat(String(value));
  const colors = Number.isNaN(numeric)
    ? { bgColor: "bg-gray-200", textColor: "text-gray-700" }
    : getScoreColors(numeric);
  return (
    <div className="flex items-center gap-3 mt-3 mb-4">
      <span className="text-[12.5px] text-gray-600">{label}</span>
      <span
        data-testid={testId}
        className={`px-3 py-1 rounded text-[13px] font-semibold min-w-[56px] text-center ${colors.bgColor} ${colors.textColor}`}
      >
        {value}
      </span>
    </div>
  );
}

function Field({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-12 gap-4 py-2 border-b border-gray-100 last:border-0">
      <div className="col-span-5 md:col-span-5 text-[12.5px] text-gray-600">
        {label}
      </div>
      <div className="col-span-7 md:col-span-7 text-[12.5px] text-gray-900 font-medium" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

interface Col<T> {
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

function DataTable<T extends { id: string }>({
  rows,
  columns,
  sectionId,
  emptyText = "No entries.",
}: {
  rows: T[] | undefined;
  columns: Col<T>[];
  sectionId: string;
  emptyText?: string;
}) {
  if (!rows || rows.length === 0) {
    return <div className="text-[12px] italic text-gray-400 py-2">{emptyText}</div>;
  }
  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((c, i) => (
              <th
                key={i}
                className="text-left font-semibold text-gray-700 uppercase tracking-wider text-[11px] py-2.5 px-3 border-b border-gray-300 align-bottom"
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className={`align-top ${idx % 2 === 1 ? "bg-gray-50/40" : "bg-white"}`}
              data-testid={`row-${sectionId}-${row.id}`}
            >
              {columns.map((c, i) => (
                <td key={i} className="py-2.5 px-3 text-gray-900 border-t border-gray-100">
                  {c.render(row) || <span className="text-gray-400">{DASH}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ViewSkeleton() {
  return (
    <div className="space-y-6" data-testid="text-view-loading">
      <Skeleton className="h-6 w-2/3 mx-auto" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-5 w-full" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      <Skeleton className="h-5 w-full mt-8" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-5 w-full mt-4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export const AppraisalView: React.FC<AppraisalViewProps> = ({
  appraisalId,
  rank,
  seafarerNameFallback,
  onClose,
}) => {
  const { data: existingAppraisal, isLoading, error } = useQuery<ExistingAppraisal | undefined>({
    queryKey: [`/api/v2/appraisals/${appraisalId}`],
    enabled: !!appraisalId,
  });

  const { getName: getDbTrainingName } = useCompanyTrainings();
  const { getVesselName } = useVesselLookup();
  const { toast } = useToast();

  const formVersionId = existingAppraisal?.formVersionId ?? null;

  const { data: pinnedFormConfig } = useQuery<PinnedFormConfigResponse>({
    queryKey: [`/api/v2/admin/form-versions/${formVersionId}/configuration`],
    enabled: !!formVersionId,
  });

  const { data: latestFormConfig } = useQuery<LatestFormConfigResponse>({
    queryKey: [`/api/v2/admin/forms/for-rank/${encodeURIComponent(rank || "")}?category=appraisal`],
    enabled: !!rank && !formVersionId && existingAppraisal !== undefined,
  });

  const rankGroupConfig: RankGroupConfig | null | undefined = formVersionId
    ? pinnedFormConfig?.rankGroupConfig
    : latestFormConfig?.rankGroupConfig;

  const rankGroupName: string | null | undefined = formVersionId
    ? pinnedFormConfig?.rankGroupName
    : latestFormConfig?.rankGroupName;

  const hiddenFields: string[] = Array.isArray(rankGroupConfig?.hiddenFields)
    ? (rankGroupConfig?.hiddenFields as string[])
    : [];
  const hiddenSections: string[] = Array.isArray(rankGroupConfig?.hiddenSections)
    ? (rankGroupConfig?.hiddenSections as string[])
    : [];
  const isFieldVisible = (k: string) => !hiddenFields.includes(k);
  const isSectionVisible = (k: string) => !hiddenSections.includes(k);

  const data: AppraisalDataShape = useMemo(() => {
    if (!existingAppraisal) return {};
    const raw = existingAppraisal.appraisalData;
    if (typeof raw === "string") {
      try { return JSON.parse(raw || "{}") as AppraisalDataShape; } catch { return {}; }
    }
    return (raw || {}) as AppraisalDataShape;
  }, [existingAppraisal]);

  // Inject print stylesheet that hides everything except the view sheet
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "appraisal-view-print-style";
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        .appraisal-view-print, .appraisal-view-print * { visibility: visible !important; }
        .appraisal-view-print {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-height: none !important;
          overflow: visible !important;
          box-shadow: none !important;
          border-radius: 0 !important;
          padding: 16px !important;
        }
        .print\\:hidden { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const fullName = data.seafarersName || seafarerNameFallback || "";
  const appraisalDateLabel = formatDate(existingAppraisal?.appraisalDate);
  const appraisalNo = existingAppraisal ? `#${existingAppraisal.id}` : DASH;
  const appraisalTypeLabel = existingAppraisal?.appraisalType || data.appraisalType || DASH;
  const headerFormName = (rankGroupName && rankGroupName.trim()) || "Crew Appraisal";

  const apiError = error as ApiError | null;

  const handleExport = async () => {
    try {
      const payload: AppraisalPDFPayload = {
        headerFormName,
        docContext:
          appraisalDateLabel !== DASH
            ? `${fullName || DASH} · ${appraisalDateLabel}`
            : (fullName || DASH),
        appraisalNo,
        basicFields: [
          isFieldVisible("seafarersName") && { label: "Seafarer's Name", value: valueOr(data.seafarersName) },
          isFieldVisible("seafarersRank") && { label: "Rank", value: valueOr(data.seafarersRank) },
          isFieldVisible("nationality") && { label: "Nationality", value: valueOr(data.nationality) },
          isFieldVisible("vessel") && { label: "Vessel", value: valueOr(data.vessel ? getVesselName(data.vessel) || data.vessel : data.vessel) },
          isFieldVisible("signOn") && { label: "Sign On", value: formatDate(data.signOn) },
          isFieldVisible("appraisalType") && { label: "Appraisal Type", value: valueOr(data.appraisalType || appraisalTypeLabel) },
          isFieldVisible("appraisalPeriodFrom") && { label: "Appraisal Period (From)", value: formatDate(data.appraisalPeriodFrom) },
          isFieldVisible("appraisalPeriodTo") && { label: "Appraisal Period (To)", value: formatDate(data.appraisalPeriodTo) },
          isFieldVisible("personalityIndexCategory") && { label: "Personality Index Category", value: valueOr(data.personalityIndexCategory) },
          isFieldVisible("primaryAppraiser") && { label: "Primary Appraiser", value: valueOr(data.primaryAppraiser) },
        ].filter(Boolean) as LabelValue[],
        statusFields: [
          { label: "Current Status", value: (() => { const s = existingAppraisal?.status || "draft"; return s.charAt(0).toUpperCase() + s.slice(1); })() },
          { label: "Last Appraisal Date", value: formatDate(existingAppraisal?.appraisalDate) },
        ],
        showB: isSectionVisible("partB"),
        showB1: isSectionVisible("partB1"),
        showB2: isSectionVisible("partB2"),
        showC: isSectionVisible("partC"),
        showD: isSectionVisible("partD"),
        showE: isSectionVisible("partE"),
        showF: isSectionVisible("partF"),
        showG: isSectionVisible("partG"),
        trainings: {
          headers: ["Training", "Evaluation", "Comment"],
          widths: [0.40, 0.25, 0.35],
          rows: (data.trainings ?? []).map((r) => [r.training ?? "", r.evaluation ?? "", r.comment ?? ""]),
        },
        targets: {
          headers: ["Target Setting", "Evaluation", "Comment"],
          widths: [0.40, 0.25, 0.35],
          rows: (data.targets ?? []).map((r) => [r.targetSetting ?? "", r.evaluation ?? "", r.comment ?? ""]),
        },
        competenceScore: existingAppraisal?.competenceRating,
        competence: {
          headers: ["Assessment Criteria", "Weight", "Effectiveness", "Comment"],
          widths: [0.45, 0.10, 0.20, 0.25],
          rows: (data.competenceAssessments ?? []).map((r) => [r.assessmentCriteria ?? "", r.weight !== undefined ? String(r.weight) : "", r.effectiveness ?? "", r.comment ?? ""]),
        },
        behaviouralScore: existingAppraisal?.behavioralRating,
        behavioural: {
          headers: ["Assessment Criteria", "Weight", "Effectiveness", "Comment"],
          widths: [0.45, 0.10, 0.20, 0.25],
          rows: (data.behaviouralAssessments ?? []).map((r) => [r.assessmentCriteria ?? "", r.weight !== undefined ? String(r.weight) : "", r.effectiveness ?? "", r.comment ?? ""]),
        },
        trainingNeeds: {
          headers: ["Training", "Comment"],
          widths: [0.45, 0.55],
          rows: (data.trainingNeeds ?? []).map((r) => [r.training ?? "", r.comment ?? ""]),
        },
        overallScore: existingAppraisal?.overallRating,
        recommendations: {
          headers: ["Question", "Answer", "Comment"],
          widths: [0.55, 0.15, 0.30],
          rows: (data.recommendations ?? []).map((r) => [r.question ?? "", r.answer ?? "", r.comment ?? ""]),
        },
        appraiserComments: {
          headers: ["Name", "Rank", "Comment"],
          widths: [0.25, 0.20, 0.55],
          rows: (data.appraiserComments ?? []).map((r) => [r.name ?? "", r.rank ?? "", r.comment ?? ""]),
        },
        seafarerComments: {
          headers: ["Name", "Rank", "Comment"],
          widths: [0.25, 0.20, 0.55],
          rows: (data.seafarerComments ?? []).map((r) => [r.name ?? "", r.rank ?? "", r.comment ?? ""]),
        },
        officeReviews: {
          headers: ["Name", "Position", "Feedback"],
          widths: [0.25, 0.20, 0.55],
          rows: (data.officeReviews ?? []).map((r) => [r.name ?? "", r.position ?? "", r.feedback ?? ""]),
        },
        trainingFollowups: {
          headers: ["Training", "DB Mapping", "Category", "Status", "Target Date", "Comment"],
          widths: [0.25, 0.20, 0.15, 0.12, 0.15, 0.13],
          rows: (data.trainingFollowups ?? []).map((r) => [
            r.training ?? "",
            r.correspondingInDB ? (getDbTrainingName(r.correspondingInDB) ?? r.correspondingInDB) : "",
            r.category ?? "",
            r.status ?? "",
            formatDate(r.targetDate),
            r.comment ?? "",
          ]),
        },
      };
      await generateAppraisalPDF(payload, fullName || "Appraisal");
      toast({ title: "Export Successful", description: `Appraisal exported as PDF for ${fullName || "seafarer"}` });
    } catch (err) {
      console.error("Failed to export PDF:", err);
      toast({ title: "Export Failed", description: "Failed to generate PDF. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
      data-testid="appraisal-view-modal"
    >
      <div className="appraisal-view-print bg-white rounded-md w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Sticky toolbar (non-print) */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-2.5 border-b border-gray-200 bg-white print:hidden">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider">Read-only view</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading || !!apiError || !existingAppraisal}
              className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-white border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50 h-8 rounded-md px-3 text-xs hidden sm:flex"
              data-testid="button-export"
              onClick={handleExport}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
              data-testid="button-close-view"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-10 pt-8 pb-10">
        {isLoading ? (
          <ViewSkeleton />
        ) : apiError || !existingAppraisal ? (
          <div className="py-20 text-center">
            <div className="text-red-600 mb-4" data-testid="text-view-error">Failed to load appraisal.</div>
            <Button onClick={onClose} variant="outline">Close</Button>
          </div>
        ) : (
          <>
            {/* Document header (matches MoC-style printed doc) */}
            <div className="flex items-start justify-between text-[11px] text-gray-500 uppercase tracking-wider mb-4">
              <div data-testid="text-doc-context">
                {fullName || DASH}
                {appraisalDateLabel !== DASH ? ` · ${appraisalDateLabel}` : ""}
              </div>
              <div>
                APPRAISAL NO:{" "}
                <span className="text-gray-800 font-semibold tracking-wide" data-testid="text-appraisal-no">
                  {appraisalNo}
                </span>
              </div>
            </div>
            <div className="border-y-2 border-[#16569e] py-3 text-center">
              <h1
                className="text-[16px] font-bold uppercase tracking-[0.18em] text-[#16569e]"
                data-testid="text-form-name"
              >
                {headerFormName}
              </h1>
            </div>

            {/* Section A */}
            <SectionHeader id="A" title="A. Seafarer Information" />
            <SubHeader title="A1. Basic" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {isFieldVisible("seafarersName") && (
                <Field label="Seafarer's Name" value={valueOr(data.seafarersName)} testId="text-seafarersName" />
              )}
              {isFieldVisible("seafarersRank") && (
                <Field label="Rank" value={valueOr(data.seafarersRank)} testId="text-seafarersRank" />
              )}
              {isFieldVisible("nationality") && (
                <Field label="Nationality" value={valueOr(data.nationality)} testId="text-nationality" />
              )}
              {isFieldVisible("vessel") && (
                <Field label="Vessel" value={valueOr(data.vessel ? getVesselName(data.vessel) || data.vessel : data.vessel)} testId="text-vessel" />
              )}
              {isFieldVisible("signOn") && (
                <Field label="Sign On" value={formatDate(data.signOn)} testId="text-signOn" />
              )}
              {isFieldVisible("appraisalType") && (
                <Field label="Appraisal Type" value={valueOr(data.appraisalType || appraisalTypeLabel)} testId="text-appraisalType" />
              )}
              {isFieldVisible("appraisalPeriodFrom") && (
                <Field label="Appraisal Period (From)" value={formatDate(data.appraisalPeriodFrom)} testId="text-appraisalPeriodFrom" />
              )}
              {isFieldVisible("appraisalPeriodTo") && (
                <Field label="Appraisal Period (To)" value={formatDate(data.appraisalPeriodTo)} testId="text-appraisalPeriodTo" />
              )}
              {isFieldVisible("personalityIndexCategory") && (
                <Field label="Personality Index Category" value={valueOr(data.personalityIndexCategory)} testId="text-personalityIndexCategory" />
              )}
              {isFieldVisible("primaryAppraiser") && (
                <Field label="Primary Appraiser" value={valueOr(data.primaryAppraiser)} testId="text-primaryAppraiser" />
              )}
            </div>

            <SubHeader title="A2. Status" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <Field
                label="Current Status"
                value={<StatusBadge status={existingAppraisal.status || "draft"} />}
                testId="text-status"
              />
              <Field label="Last Appraisal Date" value={formatDate(existingAppraisal.appraisalDate)} testId="text-appraisalDate" />
            </div>

            {/* Section B */}
            {isSectionVisible("partB") && (
              <>
                <SectionHeader id="B" title="B. Information at Start of Appraisal Period" />
                {isSectionVisible("partB1") && (
                  <>
                    <SubHeader title="B1. Trainings" />
                    <DataTable
                      rows={data.trainings}
                      sectionId="B1"
                      columns={[
                        { header: "Training", render: (r) => r.training, width: "40%" },
                        { header: "Evaluation", render: (r) => r.evaluation, width: "25%" },
                        { header: "Comment", render: (r) => r.comment },
                      ]}
                    />
                  </>
                )}
                {isSectionVisible("partB2") && (
                  <>
                    <SubHeader title="B2. Targets" />
                    <DataTable
                      rows={data.targets}
                      sectionId="B2"
                      columns={[
                        { header: "Target Setting", render: (r) => r.targetSetting, width: "40%" },
                        { header: "Evaluation", render: (r) => r.evaluation, width: "25%" },
                        { header: "Comment", render: (r) => r.comment },
                      ]}
                    />
                  </>
                )}
              </>
            )}

            {/* Section C */}
            {isSectionVisible("partC") && (
              <>
                <SectionHeader id="C" title="C. Competence Assessment" />
                <SectionScore
                  label="Competence Section Score"
                  value={existingAppraisal.competenceRating}
                  testId="text-competenceRating"
                />
                <DataTable
                  rows={data.competenceAssessments}
                  sectionId="C"
                  columns={[
                    { header: "Assessment Criteria", render: (r) => r.assessmentCriteria, width: "45%" },
                    { header: "Weight", render: (r) => (r.weight !== undefined ? String(r.weight) : ""), width: "10%" },
                    { header: "Effectiveness", render: (r) => r.effectiveness, width: "20%" },
                    { header: "Comment", render: (r) => r.comment },
                  ]}
                />
              </>
            )}

            {/* Section D */}
            {isSectionVisible("partD") && (
              <>
                <SectionHeader id="D" title="D. Behavioural Assessment" />
                <SectionScore
                  label="Behavioural Section Score"
                  value={existingAppraisal.behavioralRating}
                  testId="text-behavioralRating"
                />
                <DataTable
                  rows={data.behaviouralAssessments}
                  sectionId="D"
                  columns={[
                    { header: "Assessment Criteria", render: (r) => r.assessmentCriteria, width: "45%" },
                    { header: "Weight", render: (r) => (r.weight !== undefined ? String(r.weight) : ""), width: "10%" },
                    { header: "Effectiveness", render: (r) => r.effectiveness, width: "20%" },
                    { header: "Comment", render: (r) => r.comment },
                  ]}
                />
              </>
            )}

            {/* Section E */}
            {isSectionVisible("partE") && (
              <>
                <SectionHeader id="E" title="E. Training Needs & Development" />
                <DataTable
                  rows={data.trainingNeeds}
                  sectionId="E"
                  columns={[
                    { header: "Training", render: (r) => r.training, width: "45%" },
                    { header: "Comment", render: (r) => r.comment },
                  ]}
                />
              </>
            )}

            {/* Section F */}
            {isSectionVisible("partF") && (
              <>
                <SectionHeader id="F" title="F. Comments & Recommendations" />
                <SubHeader title="F1. Overall Score" />
                <SectionScore
                  label="Final Overall Score"
                  value={existingAppraisal.overallRating}
                  testId="text-overallRating"
                />
                <SubHeader title="F2. Appraiser's Recommendations" />
                <DataTable
                  rows={data.recommendations}
                  sectionId="F2"
                  columns={[
                    { header: "Question", render: (r) => r.question, width: "55%" },
                    { header: "Answer", render: (r) => r.answer, width: "15%" },
                    { header: "Comment", render: (r) => r.comment },
                  ]}
                />
                <SubHeader title="F3. Appraiser Comments" />
                <DataTable
                  rows={data.appraiserComments}
                  sectionId="F3"
                  columns={[
                    { header: "Name", render: (r) => r.name, width: "25%" },
                    { header: "Rank", render: (r) => r.rank, width: "20%" },
                    { header: "Comment", render: (r) => r.comment },
                  ]}
                />
                <SubHeader title="F4. Seafarer Comments" />
                <DataTable
                  rows={data.seafarerComments}
                  sectionId="F4"
                  columns={[
                    { header: "Name", render: (r) => r.name, width: "25%" },
                    { header: "Rank", render: (r) => r.rank, width: "20%" },
                    { header: "Comment", render: (r) => r.comment },
                  ]}
                />
              </>
            )}

            {/* Section G */}
            {isSectionVisible("partG") && (
              <>
                <SectionHeader id="G" title="G. Office Review & Followup" />
                <SubHeader title="G1. Office Reviews" />
                <DataTable
                  rows={data.officeReviews}
                  sectionId="G1"
                  columns={[
                    { header: "Name", render: (r) => r.name, width: "25%" },
                    { header: "Position", render: (r) => r.position, width: "20%" },
                    { header: "Feedback", render: (r) => r.feedback },
                  ]}
                />
                <SubHeader title="G2. Training Followups" />
                <DataTable
                  rows={data.trainingFollowups}
                  sectionId="G2"
                  columns={[
                    { header: "Training", render: (r) => r.training, width: "25%" },
                    { header: "DB Mapping", render: (r) => (r.correspondingInDB ? (getDbTrainingName(r.correspondingInDB) ?? r.correspondingInDB) : ""), width: "20%" },
                    { header: "Category", render: (r) => r.category, width: "15%" },
                    { header: "Status", render: (r) => r.status, width: "12%" },
                    { header: "Target Date", render: (r) => formatDate(r.targetDate), width: "15%" },
                    { header: "Comment", render: (r) => r.comment },
                  ]}
                />
              </>
            )}

            {/* Footer toolbar */}
            <div className="mt-10 pt-4 border-t border-gray-200 flex justify-end gap-2 print:hidden">
              <Button onClick={onClose} className="bg-[#16569e] hover:bg-[#0d4a8f]" data-testid="button-close-view-footer">
                Close
              </Button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default AppraisalView;
