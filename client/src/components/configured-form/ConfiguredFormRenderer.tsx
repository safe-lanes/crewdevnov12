import React, { useMemo, useState } from "react";
import { z } from "zod";
import { AlertCircle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FormSection,
  FormTable,
  SAILButton,
  SAILFormField,
  SAILInput,
  SAILSelect,
  BaseSubmoduleForm,
} from "@/components/BaseSubmoduleForm";
import { getTableClasses, sailDesignSystem } from "@/config/sailDesignSystem";

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
  option_set_uuid?: string | null;
  low_end_label?: string | null;
  high_end_label?: string | null;
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
  default_option_set_uuid?: string | null;
  layout_preference?: "auto" | "list" | "matrix";
  effectiveLayout?: "list" | "matrix";
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
  onBack?: () => void;
  embedded?: boolean;
  selectedPartUuid?: string;
  onSelectedPartUuidChange?: (value: string) => void;
  expandedSections?: Record<string, boolean>;
  onExpandedSectionsChange?: (value: Record<string, boolean>) => void;
  live?: ConfiguredFormLiveProps;
  className?: string;
}

const MISSING_SECTION_TITLE = "Section title not configured";
const MISSING_OPTIONS = "No options configured";
const MISSING_POINT_TEXT = "Point text not configured";
const MISSING_RESPONSIBLE = "Responsible party not configured";

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

function endpointDescriptor(
  optionIndex: number,
  options: ConfiguredFormOption[],
  lowEndLabel?: string | null,
  highEndLabel?: string | null,
): string | null {
  if (optionIndex === 0 && lowEndLabel?.trim()) return lowEndLabel.trim();
  if (optionIndex === options.length - 1 && highEndLabel?.trim()) return highEndLabel.trim();
  return null;
}

function InlineMissing({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
      style={{
        borderColor: sailDesignSystem.colors.accent,
        backgroundColor: sailDesignSystem.colors.background,
        color: sailDesignSystem.colors.headerText,
      }}
      data-testid={testId}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
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
        <p className="text-sm font-semibold">To be completed by: {roleName(role)}</p>
        {role.isDeleted && <Badge variant="outline">Deleted role</Badge>}
        {!role.isDeleted && role.isActive === false && (
          <Badge variant="outline">Inactive role</Badge>
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
      <p className="text-sm font-semibold" data-testid={`responsible-department-${sectionId}`}>
        To be completed by: {department ? departmentName(department) : value}
      </p>
    );
  }

  return null;
}

function ConfiguredPoint({
  question,
  questionId,
  answers,
  setAnswer,
}: {
  question: ConfiguredFormQuestion;
  questionId: string;
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
}) {
  const [commentExpanded, setCommentExpanded] = useState(false);
  const answer = answers[questionId];
  const hasText = question.question_text.trim().length > 0;
  const labels = question.response_type === "yes_no_na" ? ["Yes", "No", "NA"] : ["Yes", "No"];
  const options = question.options || [];
  const selectedOptions = Array.isArray(answer) ? answer : [];
  const tableClasses = getTableClasses();

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
              <label key={label} className="flex items-center gap-2 text-sm">
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
          <div data-testid={`preview-response-${questionId}`}>
            <SAILSelect
              value={typeof answer === "string" ? answer : ""}
              onValueChange={(value) => setAnswer(questionId, value)}
              placeholder="Choose an option"
            >
              {options.map((option, index) => (
                <SelectItem key={option.clientKey || option.option_uuid || `${questionId}-option-${index}`} value={option.option_value || `option-${index}`}>
                  {optionLabel(option)}{endpointDescriptor(index, options, question.low_end_label, question.high_end_label) ? ` — ${endpointDescriptor(index, options, question.low_end_label, question.high_end_label)}` : ""}
                </SelectItem>
              ))}
            </SAILSelect>
          </div>
        );
      case "multi_select":
        if (options.length === 0) {
          return <InlineMissing testId={`missing-options-${questionId}`}>{MISSING_OPTIONS}</InlineMissing>;
        }
        return (
          <div className="space-y-2" data-testid={`preview-response-${questionId}`}>
            {options.map((option, index) => {
              const value = option.option_value || `option-${index}`;
              const descriptor = endpointDescriptor(index, options, question.low_end_label, question.high_end_label);
              return (
                <label key={option.clientKey || option.option_uuid || `${questionId}-option-${index}`} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedOptions.includes(value)}
                    onCheckedChange={(checked) => setAnswer(
                      questionId,
                      checked === true
                        ? [...selectedOptions, value]
                        : selectedOptions.filter((selected) => selected !== value),
                    )}
                  />
                  {optionLabel(option)}{descriptor ? <span className="text-xs text-muted-foreground">— {descriptor}</span> : null}
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
            className="min-h-[74px] max-w-2xl resize-y"
            data-testid={`preview-response-${questionId}`}
          />
        );
      case "date":
        return (
          <SAILInput
            type="date"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => setAnswer(questionId, event.target.value)}
            className="max-w-xs"
            data-testid={`preview-response-${questionId}`}
          />
        );
      case "number":
        return (
          <SAILInput
            type="number"
            value={typeof answer === "string" ? answer : ""}
            onChange={(event) => setAnswer(questionId, event.target.value)}
            placeholder="Enter a number"
            className="max-w-xs"
            data-testid={`preview-response-${questionId}`}
          />
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 text-sm" data-testid={`preview-response-${questionId}`}>
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
    <>
      <tr className={tableClasses.row} data-testid={`preview-point-${questionId}`}>
        <td className={tableClasses.cell} data-testid={`preview-point-label-${questionId}`}>
          <SAILFormField label={question.question_code.trim() || "Point code not configured"}>
            <span className="font-semibold" data-testid={!hasText ? `missing-point-text-${questionId}` : undefined}>
              {hasText ? question.question_text : MISSING_POINT_TEXT}
              {question.is_mandatory && (
                <span className="ml-1 font-bold" style={{ color: sailDesignSystem.colors.accent }} aria-label="Mandatory" data-testid={`preview-required-${questionId}`}>
                  *
                </span>
              )}
            </span>
          </SAILFormField>
        </td>
        <td className={tableClasses.cell}>{responseControl}</td>
        <td className={`${tableClasses.cell} text-center`}>
          {question.comment_enabled && (
            <SAILButton
              type="button"
              variant="secondary"
              className="h-8 w-8 px-2"
              onClick={() => setCommentExpanded((expanded) => !expanded)}
              aria-expanded={commentExpanded}
              aria-label="Comment"
              title="Comment"
              data-testid={`button-preview-comment-${questionId}`}
            >
              <MessageSquare className="h-4 w-4" />
            </SAILButton>
          )}
        </td>
      </tr>
      {question.comment_enabled && commentExpanded && (
        <tr className={tableClasses.row} data-testid={`preview-comment-row-${questionId}`}>
          <td colSpan={3} className={tableClasses.cell}>
            <SAILFormField label="Comment">
              <Textarea placeholder="Preview comment — not saved" data-testid={`preview-comment-${questionId}`} />
            </SAILFormField>
          </td>
        </tr>
      )}
    </>
  );
}

function ConfiguredMatrixPoint({
  question,
  questionId,
  options,
  answers,
  setAnswer,
}: {
  question: ConfiguredFormQuestion;
  questionId: string;
  options: ConfiguredFormOption[];
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
}) {
  const [commentExpanded, setCommentExpanded] = useState(false);
  const answer = answers[questionId];
  const selectedOptions = Array.isArray(answer) ? answer : [];
  const tableClasses = getTableClasses();

  return (
    <>
      <tr className={tableClasses.row} data-testid={`preview-matrix-point-${questionId}`}>
        <td className={`${tableClasses.cell} min-w-[220px]`}>
          <span className="mr-2 text-xs font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>{question.question_code || "Point code not configured"}</span>
          <span className="text-sm font-semibold">{question.question_text.trim() || MISSING_POINT_TEXT}</span>
          {question.is_mandatory && <span className="ml-1 font-bold" style={{ color: sailDesignSystem.colors.accent }} aria-label="Mandatory">*</span>}
        </td>
        {options.map((option, index) => {
          const value = option.option_value || `option-${index}`;
          const label = optionLabel(option);
          const isSingle = question.response_type === "single_select";
          const checked = isSingle ? answer === value : selectedOptions.includes(value);
          return (
            <td className={`${tableClasses.cell} min-w-[84px] text-center`} key={option.clientKey || option.option_uuid || value}>
              <input
                type={isSingle ? "radio" : "checkbox"}
                name={`matrix-${questionId}`}
                checked={checked}
                onChange={(event) => setAnswer(
                  questionId,
                  isSingle
                    ? value
                    : event.target.checked
                      ? [...selectedOptions, value]
                      : selectedOptions.filter((selected) => selected !== value),
                )}
                aria-label={`${question.question_code}: ${label}`}
                data-testid={`matrix-option-${questionId}-${index + 1}`}
              />
            </td>
          );
        })}
        <td className={`${tableClasses.cell} min-w-[56px] text-center`}>
          {question.comment_enabled && (
            <SAILButton
              type="button"
              variant="secondary"
              className="h-8 w-8 px-2"
              onClick={() => setCommentExpanded((expanded) => !expanded)}
              aria-expanded={commentExpanded}
              aria-label="Comment"
              title="Comment"
              data-testid={`button-preview-comment-${questionId}`}
            >
              <MessageSquare className="h-4 w-4" />
            </SAILButton>
          )}
        </td>
      </tr>
      {question.comment_enabled && commentExpanded && (
        <tr className={tableClasses.row} data-testid={`preview-comment-row-${questionId}`}>
          <td colSpan={options.length + 2} className={tableClasses.cell}>
            <SAILFormField label="Comment">
              <Textarea placeholder="Preview comment — not saved" data-testid={`preview-comment-${questionId}`} />
            </SAILFormField>
          </td>
        </tr>
      )}
    </>
  );
}

function ConfiguredMatrixSection({
  section,
  sectionId,
  answers,
  setAnswer,
}: {
  section: ConfiguredFormSection;
  sectionId: string;
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
}) {
  const options = section.questions[0]?.options || [];
  const tableClasses = getTableClasses();

  return (
    <div className="w-full overflow-x-auto" data-testid={`preview-matrix-section-${sectionId}`}>
      <table className="min-w-max w-full border-collapse">
        <thead>
          <tr>
            <th className={`${tableClasses.header} min-w-[220px] text-left`}>Point</th>
            {options.map((option, index) => {
              const descriptor = endpointDescriptor(index, options, section.questions[0]?.low_end_label, section.questions[0]?.high_end_label);
              return (
              <th className={`${tableClasses.header} min-w-[84px] text-center text-xs`} key={option.clientKey || option.option_uuid || `${sectionId}-header-${index}`}>
                {optionLabel(option)}
                {descriptor && (
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight opacity-90" data-testid={`matrix-end-label-${sectionId}-${index === 0 ? "low" : "high"}`}>
                    {descriptor}
                  </span>
                )}
              </th>
              );
            })}
            <th className={`${tableClasses.header} min-w-[56px] text-center`}>Comment</th>
          </tr>
        </thead>
        <tbody>
          {section.questions.map((question, questionIndex) => {
            const questionId = question.clientKey || question.question_uuid || `${sectionId}-point-${questionIndex + 1}`;
            return <ConfiguredMatrixPoint key={questionId} question={question} questionId={questionId} options={options} answers={answers} setAnswer={setAnswer} />;
          })}
        </tbody>
      </table>
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
  const hasFooterContent = section.comment_box_required
    || section.signature_required
    || section.responsible_mode !== "not_applicable";

  const footer = isApplicable && isExpanded && hasFooterContent ? (
    <div className="mt-6 space-y-5 border-t pt-5" style={{ borderColor: sailDesignSystem.colors.border }} data-testid={`preview-section-footer-${sectionId}`}>
      {section.comment_box_required && (
        <div data-testid={`preview-section-comment-${sectionId}`}>
          <SAILFormField label="Section comment">
            <Textarea placeholder="Preview comment — not saved" data-testid={`preview-section-comment-input-${sectionId}`} />
          </SAILFormField>
        </div>
      )}
      {section.signature_required && (
        <div className="space-y-4 rounded-md border border-dashed px-4 py-4" style={{ borderColor: sailDesignSystem.colors.headerText }} data-testid={`preview-signature-${sectionId}`}>
          <p className="text-sm font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>Signature</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <SAILFormField label="Name"><SAILInput readOnly placeholder="Name" data-testid={`preview-signature-name-${sectionId}`} /></SAILFormField>
            <SAILFormField label="Signature"><SAILInput readOnly placeholder="Signature" data-testid={`preview-signature-mark-${sectionId}`} /></SAILFormField>
            <SAILFormField label="Date"><SAILInput readOnly placeholder="Date" data-testid={`preview-signature-date-${sectionId}`} /></SAILFormField>
          </div>
          <p className="text-xs">Signature placeholder — live signing is not available in Preview.</p>
        </div>
      )}
      <SectionResponsibility section={section} roles={roles} departments={departments} sectionId={sectionId} />
    </div>
  ) : undefined;

  return (
    <div data-testid={`preview-section-${sectionId}`}>
      <FormSection
        title={`${sectionCode} ${sectionTitle}`}
        headerActions={
          <SAILButton type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={onToggleExpanded} aria-expanded={isExpanded} data-testid={`button-preview-section-toggle-${sectionId}`}>
            {isExpanded ? "Collapse" : "Expand"}
          </SAILButton>
        }
        headerNotice={!section.section_title.trim() && (
          <p className="mt-1 text-sm" style={{ color: sailDesignSystem.colors.accent }} data-testid={`missing-section-title-${sectionId}`}>
            <AlertCircle className="mr-1 inline-block h-3.5 w-3.5" />{MISSING_SECTION_TITLE}
          </p>
        )}
        footer={footer}
      >
        {!isExpanded ? null : !isApplicable ? (
          <InlineMissing testId={`preview-section-not-applicable-${sectionId}`}>
            This section is not applicable to {vesselTypeLabel}.
          </InlineMissing>
        ) : section.questions.length === 0 ? (
          <InlineMissing testId={`preview-no-points-${sectionId}`}>No points configured.</InlineMissing>
        ) : section.effectiveLayout === "matrix" ? (
          <ConfiguredMatrixSection section={section} sectionId={sectionId} answers={answers} setAnswer={setAnswer} />
        ) : (
          <FormTable headers={["Point", "Response", "Comment"]}>
            {section.questions.map((question, questionIndex) => {
              const questionId = question.clientKey || question.question_uuid || `${sectionId}-point-${questionIndex + 1}`;
              return <ConfiguredPoint key={questionId} question={question} questionId={questionId} answers={answers} setAnswer={setAnswer} />;
            })}
          </FormTable>
        )}
      </FormSection>
    </div>
  );
}

function FixedPartPlaceholder({ part }: { part: ConfiguredFormPart }) {
  return (
    <div data-testid={`preview-fixed-part-${part.partCode}`}>
      <FormSection title={`${part.partCode} ${part.partTitle.trim() || `Part ${part.partCode}`}`}>
        <InlineMissing testId={`preview-fixed-part-message-${part.partCode}`}>
          This part is purpose-built and is not yet implemented in the shared configurable-form renderer.
        </InlineMissing>
      </FormSection>
    </div>
  );
}

export function ConfiguredFormRenderer({
  mode,
  formTitle = "Configured form",
  parts,
  structures,
  roles = [],
  departments = [],
  vesselTypes = [],
  selectedVesselTypeUuid,
  onSelectedVesselTypeUuidChange,
  onBack,
  embedded = false,
  selectedPartUuid,
  live,
  className = "",
}: ConfiguredFormRendererProps) {
  const [internalVesselTypeUuid, setInternalVesselTypeUuid] = useState("all");
  const [internalAnswers, setInternalAnswers] = useState<Record<string, ConfiguredFormAnswerValue>>({});
  const [internalExpandedSections, setInternalExpandedSections] = useState<Record<string, boolean>>({});

  const selectedVessel = selectedVesselTypeUuid ?? internalVesselTypeUuid;
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

  const answers = mode === "live" && live ? live.answers : internalAnswers;
  const setAnswer = (questionId: string, value: ConfiguredFormAnswerValue) => {
    if (mode === "live" && live) {
      live.onAnswerChange(questionId, value);
      return;
    }
    setInternalAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const setVesselType = (value: string) => {
    setInternalVesselTypeUuid(value);
    onSelectedVesselTypeUuidChange?.(value);
  };

  const previewSchema = z.object({});
  const baseSections = parts.map((part, index) => ({
    id: part.formPartUuid,
    title: part.partTitle.trim() || `Part ${part.partCode || index + 1}`,
    letter: part.partCode || String(index + 1),
  }));

  const renderFormContent = (activeSection: string) => {
    const selectedPart = parts.find((part) => part.formPartUuid === activeSection);
    const selectedSections = selectedPart ? structures[selectedPart.formPartUuid] || [] : [];

    return (
      <>
        <div className="flex flex-wrap items-end justify-between gap-4" data-testid={mode === "preview" ? "preview-only-banner" : "configured-form-live-banner"}>
          <div>
            <p className="text-sm font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>{mode === "preview" ? "Preview only" : "Configured form"}</p>
            <p className="text-xs">{mode === "preview" ? "Inputs are interactive for review, but nothing is saved." : "Responses are managed by the live form host."}</p>
          </div>
          <SAILFormField label="Vessel type" className="min-w-[210px]" >
            <div data-testid="select-preview-vessel-type">
              <SAILSelect value={selectedVessel} onValueChange={setVesselType} placeholder="All vessel types">
                <SelectItem value="all">All vessel types</SelectItem>
                {vesselOptions.map((option) => <SelectItem key={option.uuid} value={option.uuid}>{option.label}</SelectItem>)}
              </SAILSelect>
            </div>
          </SAILFormField>
        </div>

        {!selectedPart ? (
          <InlineMissing testId="preview-no-form-parts">No form parts are configured.</InlineMissing>
        ) : selectedPart.partType === "fixed" ? (
          <FixedPartPlaceholder part={selectedPart} />
        ) : (
          <div className="space-y-5">
            {selectedVessel !== "all" && (
              <p className="text-xs">
                Sections restricted to another vessel type remain marked as not applicable for {selectedVesselLabel}.
              </p>
            )}
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
                  isExpanded={internalExpandedSections[sectionId] !== false}
                  onToggleExpanded={() => setInternalExpandedSections((current) => ({
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
      </>
    );
  };

  if (embedded) {
    return (
      <div className={className} data-testid={mode === "preview" ? "configured-form-preview" : "configured-form-live"} style={{ fontFamily: sailDesignSystem.typography.fontFamily }}>
        {renderFormContent(selectedPartUuid || baseSections[0]?.id || "")}
      </div>
    );
  }

  return (
    <div className={className} data-testid={mode === "preview" ? "configured-form-preview" : "configured-form-live"} style={{ fontFamily: sailDesignSystem.typography.fontFamily }}>
      <BaseSubmoduleForm
        title={`${formTitle} · ${mode === "preview" ? "Preview" : "Live"}`}
        sections={baseSections}
        schema={previewSchema}
        defaultValues={{}}
        onClose={onBack || (() => undefined)}
        onSubmit={() => undefined}
        hideSaveDraft
      >
        {({ activeSection }) => renderFormContent(activeSection)}
      </BaseSubmoduleForm>
    </div>
  );
}

export default ConfiguredFormRenderer;