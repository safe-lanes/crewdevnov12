import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sailDesignSystem } from "@/config/sailDesignSystem";

export type ConfiguredFormMode = "preview" | "live";

export interface ConfiguredFormPart {
  formPartUuid: string;
  formUuid?: string;
  partCode: string;
  partTitle: string;
  partType: string;
  isOfficeOnly?: boolean;
}

export interface ConfiguredFormOption {
  option_uuid?: string;
  option_label: string;
  option_value: string;
  clientKey?: string;
}

export interface ConfiguredFormQuestion {
  question_uuid?: string;
  question_code: string;
  question_text: string;
  response_type: string;
  is_mandatory: boolean;
  comment_enabled: boolean;
  options: ConfiguredFormOption[];
  clientKey?: string;
}

export interface ConfiguredFormSection {
  section_uuid?: string;
  section_code: string;
  section_title: string;
  applicable_vessel_types: string[];
  responsible_mode: "role" | "department" | "not_applicable";
  responsible_role_uuid: string | null;
  responsible_department: string | null;
  comment_box_required: boolean;
  signature_required: boolean;
  questions: ConfiguredFormQuestion[];
  clientKey?: string;
}

export interface ConfiguredFormRole {
  ruid: string;
  assignedRole?: string;
  name?: string;
  roleName?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export type ConfiguredFormDepartment =
  | string
  | {
      uuid?: string;
      departmentUuid?: string;
      name?: string;
      departmentName?: string;
    };

export interface ConfiguredFormVesselType {
  vtUuid?: string;
  vtuid?: string;
  name?: string;
  vesselType?: string;
  label?: string;
}

export type ConfiguredFormAnswerValue = string | string[] | boolean;

/**
 * Phase 3 contract. Preview deliberately does not consume these values: live
 * answer persistence, ownership, submit, and lock behavior will be added here
 * rather than replacing the shared renderer.
 */
export interface ConfiguredFormLiveProps {
  answers: Record<string, ConfiguredFormAnswerValue>;
  onAnswerChange: (questionId: string, value: ConfiguredFormAnswerValue) => void;
  sectionOwnership?: Record<string, { ownerLabel: string; canEdit: boolean }>;
  isLocked?: boolean;
  onSubmit?: () => void | Promise<void>;
}

export interface ConfiguredFormRendererProps {
  mode: ConfiguredFormMode;
  formTitle?: string;
  parts: ConfiguredFormPart[];
  structures: Record<string, ConfiguredFormSection[]>;
  roles?: ConfiguredFormRole[];
  departments?: ConfiguredFormDepartment[];
  vesselTypes?: ConfiguredFormVesselType[];
  selectedVesselTypeUuid?: string;
  onSelectedVesselTypeUuidChange?: (value: string) => void;
  live?: ConfiguredFormLiveProps;
  className?: string;
}

const MISSING_SECTION_TITLE = "Section title not configured";
const MISSING_OPTIONS = "No options configured";
const MISSING_POINT_TEXT = "Point text not configured";
const MISSING_RESPONSIBLE = "Responsible party not configured";

const responseLabels: Record<string, string> = {
  yes_no: "Yes / No",
  yes_no_na: "Yes / No / NA",
  single_select: "Single Selection",
  multi_select: "Multi Selection",
  free_text: "Free Text",
  date: "Date",
  number: "Number",
  checkbox: "Checkbox",
  info_only: "Information Only",
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function roleName(role: ConfiguredFormRole): string {
  return role.assignedRole?.trim() || role.name?.trim() || role.roleName?.trim() || "Unnamed role";
}

function vesselTypeName(type: ConfiguredFormVesselType): string {
  return type.name?.trim() || type.vesselType?.trim() || type.label?.trim() || "Unnamed vessel type";
}

function departmentName(department: ConfiguredFormDepartment): string {
  if (typeof department === "string") return department.trim();
  return department.name?.trim() || department.departmentName?.trim() || "";
}

function departmentMatches(department: ConfiguredFormDepartment, value: string): boolean {
  if (typeof department === "string") return department.trim() === value;
  return [department.uuid, department.departmentUuid, department.name, department.departmentName]
    .filter(Boolean)
    .some((candidate) => candidate === value);
}

function optionLabel(option: ConfiguredFormOption): string {
  return option.option_label.trim() || "Option label not configured";
}

function InlineMissing({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
      data-testid={testId}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function PartStepper({
  parts,
  selectedPartUuid,
  onSelect,
  mobile = false,
}: {
  parts: ConfiguredFormPart[];
  selectedPartUuid: string;
  onSelect: (partUuid: string) => void;
  mobile?: boolean;
}) {
  return (
    <nav className={mobile ? "flex gap-2 overflow-x-auto pb-1" : "space-y-1"} aria-label="Form parts">
      {parts.map((part, index) => {
        const isSelected = selectedPartUuid === part.formPartUuid;
        const partTitle = part.partTitle.trim() || `Part ${part.partCode || index + 1}`;
        return (
          <button
            key={part.formPartUuid}
            type="button"
            onClick={() => onSelect(part.formPartUuid)}
            className={mobile
              ? `flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                  isSelected ? "text-white shadow-sm" : "bg-white text-gray-700"
                }`
              : `group flex w-full items-center gap-3 rounded-md border-l-4 px-3 py-3 text-left transition-colors ${
                  isSelected ? "text-white shadow-sm" : "border-transparent text-gray-700 hover:bg-white"
                }`}
            style={isSelected ? {
              backgroundColor: sailDesignSystem.colors.headerText,
              borderColor: sailDesignSystem.colors.headerText,
            } : { borderColor: sailDesignSystem.colors.border }}
            data-testid={`button-preview-part-${part.partCode || index + 1}`}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : sailDesignSystem.colors.background,
                color: isSelected ? sailDesignSystem.colors.cardBackground : sailDesignSystem.colors.headerText,
              }}
            >
              {part.partCode || index + 1}
            </span>
            <span className={mobile ? "whitespace-nowrap" : "min-w-0 flex-1"}>
              <span className="block truncate text-sm font-semibold">{partTitle}</span>
              {!mobile && (
                <span className={`block text-[11px] ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                  {part.partType === "fixed" ? "Purpose-built part" : "Configured structure"}
                </span>
              )}
            </span>
            {!mobile && <ChevronRight className="h-4 w-4 opacity-60" />}
          </button>
        );
      })}
    </nav>
  );
}

function SectionResponsibility({
  section,
  roles,
  departments,
  sectionId,
}: {
  section: ConfiguredFormSection;
  roles: ConfiguredFormRole[];
  departments: ConfiguredFormDepartment[];
  sectionId: string;
}) {
  if (section.responsible_mode === "role") {
    if (!section.responsible_role_uuid) {
      return <InlineMissing testId={`missing-responsible-${sectionId}`}>{MISSING_RESPONSIBLE}</InlineMissing>;
    }
    const role = roles.find((candidate) => candidate.ruid === section.responsible_role_uuid);
    if (!role) {
      return <InlineMissing testId={`missing-responsible-${sectionId}`}>Responsible role not found</InlineMissing>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid={`responsible-role-${sectionId}`}>
        <Badge variant="outline">Responsible role: {roleName(role)}</Badge>
        {role.isDeleted && <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Deleted role</Badge>}
        {!role.isDeleted && role.isActive === false && (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Inactive role</Badge>
        )}
      </div>
    );
  }

  if (section.responsible_mode === "department") {
    const value = section.responsible_department?.trim() || "";
    const department = value ? departments.find((candidate) => departmentMatches(candidate, value)) : undefined;
    if (!value) {
      return <InlineMissing testId={`missing-responsible-${sectionId}`}>{MISSING_RESPONSIBLE}</InlineMissing>;
    }
    if (!department && isUuid(value)) {
      return <InlineMissing testId={`missing-responsible-${sectionId}`}>Responsible department not found</InlineMissing>;
    }
    return (
      <Badge variant="outline" data-testid={`responsible-department-${sectionId}`}>
        Responsible department: {department ? departmentName(department) : value}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-gray-600" data-testid={`responsible-not-applicable-${sectionId}`}>
      No responsible party · Not applicable
    </Badge>
  );
}

function ConfiguredPoint({
  question,
  questionId,
  sectionId,
  answers,
  setAnswer,
}: {
  question: ConfiguredFormQuestion;
  questionId: string;
  sectionId: string;
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
}) {
  const [commentExpanded, setCommentExpanded] = useState(false);
  const answer = answers[questionId];
  const hasText = question.question_text.trim().length > 0;
  const labels = question.response_type === "yes_no_na" ? ["Yes", "No", "NA"] : ["Yes", "No"];
  const options = question.options || [];
  const selectedOptions = Array.isArray(answer) ? answer : [];

  const responseControl = (() => {
    switch (question.response_type) {
      case "yes_no":
      case "yes_no_na":
        return (
          <RadioGroup
            value={typeof answer === "string" ? answer : ""}
            onValueChange={(value) => setAnswer(questionId, value)}
            className="flex flex-wrap gap-4"
            data-testid={`preview-response-${questionId}`}
          >
            {labels.map((label) => (
              <label key={label} className="flex items-center gap-2 text-sm text-gray-700">
                <RadioGroupItem value={label} />
                {label}
              </label>
            ))}
          </RadioGroup>
        );
      case "single_select":
        if (options.length === 0) {
          return <InlineMissing testId={`missing-options-${questionId}`}>{MISSING_OPTIONS}</InlineMissing>;
        }
        return (
          <Select value={typeof answer === "string" ? answer : ""} onValueChange={(value) => setAnswer(questionId, value)}>
            <SelectTrigger className="max-w-sm bg-white" data-testid={`preview-response-${questionId}`}>
              <SelectValue placeholder="Choose an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={option.clientKey || option.option_uuid || `${questionId}-option-${index}`} value={option.option_value || `option-${index}`}>
                  {optionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "multi_select":
        if (options.length === 0) {
          return <InlineMissing testId={`missing-options-${questionId}`}>{MISSING_OPTIONS}</InlineMissing>;
        }
        return (
          <div className="space-y-2" data-testid={`preview-response-${questionId}`}>
            {options.map((option, index) => {
              const value = option.option_value || `option-${index}`;
              return (
                <label key={option.clientKey || option.option_uuid || `${questionId}-option-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
                  <Checkbox
                    checked={selectedOptions.includes(value)}
                    onCheckedChange={(checked) => setAnswer(
                      questionId,
                      checked === true
                        ? [...selectedOptions, value]
                        : selectedOptions.filter((selected) => selected !== value),
                    )}
                  />
                  {optionLabel(option)}
                </label>
              );
            })}
          </div>
        );
      case "free_text":
        return (
          <Textarea
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => setAnswer(questionId, event.target.value)}
            placeholder="Enter a response"
            className="min-h-[74px] max-w-2xl resize-y bg-white"
            data-testid={`preview-response-${questionId}`}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => setAnswer(questionId, event.target.value)}
            className="max-w-xs bg-white"
            data-testid={`preview-response-${questionId}`}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => setAnswer(questionId, event.target.value)}
            placeholder="Enter a number"
            className="max-w-xs bg-white"
            data-testid={`preview-response-${questionId}`}
          />
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 text-sm text-gray-700" data-testid={`preview-response-${questionId}`}>
            <Checkbox
              checked={answer === true}
              onCheckedChange={(checked) => setAnswer(questionId, checked === true)}
            />
            Confirm
          </label>
        );
      case "info_only":
        return (
          <div
            className="rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: sailDesignSystem.colors.border,
              backgroundColor: sailDesignSystem.colors.background,
              color: sailDesignSystem.colors.textPrimary,
            }}
            data-testid={`preview-response-${questionId}`}
          >
            Information only — no response required.
          </div>
        );
      default:
        return <InlineMissing testId={`unsupported-response-${questionId}`}>Response type not supported in preview</InlineMissing>;
    }
  })();

  return (
    <div className="rounded-md border p-4" style={{ borderColor: sailDesignSystem.colors.border }} data-testid={`preview-point-${questionId}`}>
      <div className="flex gap-3">
        <Badge variant="secondary" className="mt-1 shrink-0 font-mono">
          {question.question_code.trim() || "Point code not configured"}
        </Badge>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start gap-2">
            <div className="text-sm font-semibold leading-6" data-testid={`preview-point-label-${questionId}`}>
              {hasText ? question.question_text : MISSING_POINT_TEXT}
            </div>
            {question.is_mandatory && (
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700" data-testid={`preview-required-${questionId}`}>
                Required
              </Badge>
            )}
          </div>
          {responseControl}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{responseLabels[question.response_type] || question.response_type || "Response type not configured"}</span>
            {question.comment_enabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2"
                onClick={() => setCommentExpanded((expanded) => !expanded)}
                aria-expanded={commentExpanded}
                data-testid={`button-preview-comment-${questionId}`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Comment
              </Button>
            )}
          </div>
          {question.comment_enabled && commentExpanded && (
            <Textarea
              placeholder="Preview comment — not saved"
              className="min-h-[66px] bg-white"
              data-testid={`preview-comment-${questionId}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ConfiguredSection({
  section,
  sectionId,
  roles,
  departments,
  vesselTypeLabel,
  isApplicable,
  isExpanded,
  onToggleExpanded,
  answers,
  setAnswer,
}: {
  section: ConfiguredFormSection;
  sectionId: string;
  roles: ConfiguredFormRole[];
  departments: ConfiguredFormDepartment[];
  vesselTypeLabel: string;
  isApplicable: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
}) {
  const sectionTitle = section.section_title.trim() || MISSING_SECTION_TITLE;
  const sectionCode = section.section_code.trim() || "Section code not configured";

  return (
    <Card className="border shadow-sm" style={{ borderColor: sailDesignSystem.colors.border }} data-testid={`preview-section-${sectionId}`}>
      <CardHeader className="border-b px-5 py-4" style={{ backgroundColor: sailDesignSystem.colors.background }}>
        <div className="flex items-start gap-3">
          <Badge className="mt-1" style={{ backgroundColor: sailDesignSystem.colors.headerText }}>
            {sectionCode}
          </Badge>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-xl" style={{ color: sailDesignSystem.colors.headerText }}>
                {sectionTitle}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={onToggleExpanded}
                aria-expanded={isExpanded}
                data-testid={`button-preview-section-toggle-${sectionId}`}
              >
                {isExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>
            {!section.section_title.trim() && (
              <p className="mt-1 text-xs text-amber-700" data-testid={`missing-section-title-${sectionId}`}>
                {MISSING_SECTION_TITLE}
              </p>
            )}
            <div className="mt-2 h-0.5 w-full" style={{ backgroundColor: sailDesignSystem.colors.headerText }} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SectionResponsibility
                section={section}
                roles={roles}
                departments={departments}
                sectionId={sectionId}
              />
              {section.comment_box_required && <Badge variant="outline">Comment required</Badge>}
              {section.signature_required && <Badge variant="outline">Signature required</Badge>}
            </div>
          </div>
        </div>
      </CardHeader>
      {isExpanded && <CardContent className="space-y-3 p-5">
        {!isApplicable ? (
          <div
            className="rounded-md border border-dashed px-4 py-3 text-sm text-gray-600"
            data-testid={`preview-section-not-applicable-${sectionId}`}
          >
            This section is not applicable to {vesselTypeLabel}.
          </div>
        ) : (
          <>
            {section.questions.length === 0 && (
              <div className="rounded-md border border-dashed px-4 py-3 text-sm text-gray-500" data-testid={`preview-no-points-${sectionId}`}>
                No points configured.
              </div>
            )}
            {section.questions.map((question, questionIndex) => {
              const questionId = question.clientKey || question.question_uuid || `${sectionId}-point-${questionIndex + 1}`;
              return (
                <ConfiguredPoint
                  key={questionId}
                  question={question}
                  questionId={questionId}
                  sectionId={sectionId}
                  answers={answers}
                  setAnswer={setAnswer}
                />
              );
            })}
            {section.comment_box_required && (
              <div className="space-y-2 pt-2" data-testid={`preview-section-comment-${sectionId}`}>
                <label className="text-sm font-semibold text-gray-700">
                  Section comment <span className="text-red-600">*</span>
                </label>
                <Textarea placeholder="Preview comment — not saved" className="min-h-[84px] bg-white" />
              </div>
            )}
            {section.signature_required && (
              <div
                className="rounded-md border border-dashed px-4 py-4"
                style={{ borderColor: sailDesignSystem.colors.headerText }}
                data-testid={`preview-signature-${sectionId}`}
              >
                <div className="text-sm font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>
                  Electronic signature required
                </div>
                <div className="mt-1 text-xs text-gray-500">Signature placeholder — live signing is not available in Preview.</div>
              </div>
            )}
          </>
        )}
      </CardContent>}
    </Card>
  );
}

function FixedPartPlaceholder({ part }: { part: ConfiguredFormPart }) {
  return (
    <Card className="border-dashed" data-testid={`preview-fixed-part-${part.partCode}`}>
      <CardContent className="p-8">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: sailDesignSystem.colors.headerText }}
          >
            {part.partCode}
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>
              {part.partTitle.trim() || `Part ${part.partCode}`}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This part is purpose-built and is not yet implemented in the shared configurable-form renderer.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ConfiguredFormRenderer({
  mode,
  formTitle,
  parts,
  structures,
  roles = [],
  departments = [],
  vesselTypes = [],
  selectedVesselTypeUuid,
  onSelectedVesselTypeUuidChange,
  className = "",
}: ConfiguredFormRendererProps) {
  const [selectedPartUuid, setSelectedPartUuid] = useState(parts[0]?.formPartUuid || "");
  const [internalVesselTypeUuid, setInternalVesselTypeUuid] = useState("all");
  const [answers, setAnswers] = useState<Record<string, ConfiguredFormAnswerValue>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const selectedVessel = selectedVesselTypeUuid ?? internalVesselTypeUuid;
  const selectedPart = parts.find((part) => part.formPartUuid === selectedPartUuid) ?? parts[0];
  const selectedSections = selectedPart ? structures[selectedPart.formPartUuid] || [] : [];
  const selectedVesselLabel = selectedVessel === "all"
    ? "all vessel types"
    : vesselTypes.find((type) => (type.vtUuid || type.vtuid) === selectedVessel)
      ? vesselTypeName(vesselTypes.find((type) => (type.vtUuid || type.vtuid) === selectedVessel)!)
      : "the selected vessel type";

  const vesselOptions = useMemo(
    () => vesselTypes
      .map((type) => {
        const uuid = type.vtUuid || type.vtuid || "";
        return uuid ? { uuid, label: vesselTypeName(type) } : null;
      })
      .filter((option): option is { uuid: string; label: string } => option !== null),
    [vesselTypes],
  );

  useEffect(() => {
    if (!selectedPartUuid || !parts.some((part) => part.formPartUuid === selectedPartUuid)) {
      setSelectedPartUuid(parts[0]?.formPartUuid || "");
    }
  }, [parts, selectedPartUuid]);

  const setAnswer = (questionId: string, value: ConfiguredFormAnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const setVesselType = (value: string) => {
    setInternalVesselTypeUuid(value);
    onSelectedVesselTypeUuidChange?.(value);
  };

  if (mode === "live") {
    return (
      <div className={className} data-testid="configured-form-live-unimplemented">
        <InlineMissing testId="configured-form-live-mode-message">
          Live configured-form rendering is reserved for Phase 3.
        </InlineMissing>
      </div>
    );
  }

  return (
    <div className={`min-h-full ${className}`} data-testid="configured-form-preview">
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
        style={{
          borderColor: sailDesignSystem.colors.accent,
          backgroundColor: sailDesignSystem.colors.background,
        }}
        data-testid="preview-only-banner"
      >
        <div>
          <div className="text-sm font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>
            Preview only
          </div>
          <div className="text-xs text-gray-600">Inputs are interactive for review, but nothing is saved.</div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="preview-vessel-type" className="text-xs font-semibold text-gray-600">Vessel type</label>
          <Select value={selectedVessel} onValueChange={setVesselType}>
            <SelectTrigger id="preview-vessel-type" className="w-[210px] bg-white" data-testid="select-preview-vessel-type">
              <SelectValue placeholder="All vessel types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vessel types</SelectItem>
              {vesselOptions.map((option) => (
                <SelectItem key={option.uuid} value={option.uuid}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mb-3 sm:hidden">
        <PartStepper
          parts={parts}
          selectedPartUuid={selectedPart?.formPartUuid || ""}
          onSelect={setSelectedPartUuid}
          mobile
        />
      </div>

      <div className="flex min-h-0 gap-5">
        <aside className="hidden w-56 shrink-0 rounded-lg border p-3 sm:block" style={{ backgroundColor: sailDesignSystem.colors.background }} data-testid="preview-part-stepper">
          <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Form parts</div>
          <PartStepper
            parts={parts}
            selectedPartUuid={selectedPart?.formPartUuid || ""}
            onSelect={setSelectedPartUuid}
          />
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Configured form preview</div>
            <h2 className="mt-1 text-2xl font-bold" style={{ color: sailDesignSystem.colors.headerText }}>
              {formTitle || "Configured form"}
            </h2>
            {selectedPart && (
              <p className="mt-1 text-sm text-gray-600">
                {selectedPart.partCode} · {selectedPart.partTitle.trim() || `Part ${selectedPart.partCode}`}
              </p>
            )}
          </div>

          {!selectedPart && (
            <InlineMissing testId="preview-no-form-parts">No form parts are configured.</InlineMissing>
          )}
          {selectedPart && selectedPart.partType === "fixed" && <FixedPartPlaceholder part={selectedPart} />}
          {selectedPart && selectedPart.partType !== "fixed" && (
            <div className="space-y-5">
              <div className="text-xs text-gray-500">
                Showing sections for {selectedVesselLabel}. Sections restricted to another vessel type remain marked as not applicable.
              </div>
              {selectedSections.length === 0 && (
                <InlineMissing testId={`preview-no-sections-${selectedPart.partCode}`}>
                  No sections configured for this part.
                </InlineMissing>
              )}
              {selectedSections.map((section, sectionIndex) => {
                const sectionId = section.clientKey || section.section_uuid || `${selectedPart.formPartUuid}-section-${sectionIndex + 1}`;
                const isApplicable = selectedVessel === "all"
                  || section.applicable_vessel_types.length === 0
                  || section.applicable_vessel_types.includes(selectedVessel);
                return (
                  <ConfiguredSection
                    key={sectionId}
                    section={section}
                    sectionId={sectionId}
                    roles={roles}
                    departments={departments}
                    vesselTypeLabel={selectedVesselLabel}
                    isApplicable={isApplicable}
                    isExpanded={expandedSections[sectionId] !== false}
                    onToggleExpanded={() => setExpandedSections((current) => ({
                      ...current,
                      [sectionId]: !(current[sectionId] !== false),
                    }))}
                    answers={answers}
                    setAnswer={setAnswer}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default ConfiguredFormRenderer;