import React, { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { AlertCircle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { apiRequest } from "@/lib/queryClient";

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
  responsible_role_name?: string | null;
  responsible_department: string | null;
  comment_box_required: boolean;
  /** @deprecated retained only so older released structures remain readable. */
  signature_required?: boolean;
  signature_officer_required?: boolean;
  signature_seafarer_required?: boolean;
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
export type ConfiguredSignatureType = "officer" | "seafarer";
export interface ConfiguredSignature {
  signatureAttUuid?: string | null;
  signatureName?: string | null;
  signatureRank?: string | null;
  witnessedByName?: string | null;
  signedAt?: string | null;
  signatureUrl?: string | null;
}

/**
 * Phase 3 contract. Preview deliberately does not consume these values: live
 * answer persistence, ownership, submit, and lock behavior will be added here
 * rather than replacing the shared renderer.
 */
export interface ConfiguredFormLiveProps {
  answers: Record<string, ConfiguredFormAnswerValue>;
  onAnswerChange: (questionId: string, value: ConfiguredFormAnswerValue) => void;
  answerComments?: Record<string, string | null>;
  onAnswerCommentChange?: (questionId: string, comment: string) => void;
  sectionComments?: Record<string, string>;
  onSectionCommentChange?: (sectionId: string, comment: string) => void;
  sectionOwnership?: Record<string, { ownerLabel: string; canEdit: boolean }>;
  sectionStates?: Record<string, { status: "not_started" | "submitted" | "not_applicable"; sectionComment?: string | null; submittedByName?: string | null; submittedAt?: string | null; signatures?: Partial<Record<ConfiguredSignatureType, ConfiguredSignature>>; /** Legacy single signature state. */ signatureAttUuid?: string | null; signatureName?: string | null; signedAt?: string | null; signatureUrl?: string | null }>;
  signatureDefaults?: Partial<Record<ConfiguredSignatureType, { name?: string | null; rank?: string | null }>>;
  onSaveDraft?: (sectionId: string) => void | Promise<void>;
  onSubmitSection?: (sectionId: string, comment: string) => void | Promise<void>;
  onSignatureChange?: (sectionId: string, type: ConfiguredSignatureType, pngDataUrl: string, signerName?: string, signerRank?: string) => void | Promise<void>;
  onDeleteSignature?: (sectionId: string, type: ConfiguredSignatureType) => void | Promise<void>;
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
  fixedParts?: Record<string, React.ReactNode>;
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

type QuestionCommentState = {
  text: string;
  isExpanded: boolean;
  isEditing: boolean;
  setText: (value: string) => void;
  open: () => void;
  edit: () => void;
  finishEditing: () => void;
};

function useQuestionComment(initial = ""): QuestionCommentState {
  const [text, setText] = useState(initial);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const hasComment = text.trim().length > 0;
  const hydrated = useRef(initial);
  useEffect(() => {
    if (!isEditing && initial !== hydrated.current) {
      hydrated.current = initial;
      setText(initial);
    }
  }, [initial, isEditing]);

  return {
    text,
    isExpanded,
    isEditing,
    setText,
    open: () => {
      setIsExpanded(true);
      setIsEditing(!hasComment);
    },
    edit: () => {
      setIsExpanded(true);
      setIsEditing(true);
    },
    finishEditing: () => setIsEditing(false),
  };
}

function SignaturePad({ sectionId, type, onSave }: { sectionId: string; type: ConfiguredSignatureType; onSave: (data: string) => void | Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (saveState === "pending") return; const canvas = canvasRef.current; const p = point(event); if (!canvas || !p) return;
    drawing.current = true; canvas.setPointerCapture?.(event.pointerId);
    const context = canvas.getContext("2d"); context?.beginPath(); context?.moveTo(p.x, p.y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || saveState === "pending") return; const p = point(event); const context = canvasRef.current?.getContext("2d"); if (!p || !context) return;
    context.lineTo(p.x, p.y); context.strokeStyle = "#172033"; context.lineWidth = 2; context.lineCap = "round"; context.stroke(); setHasInk(true);
  };
  const clear = () => { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height); setHasInk(false); };
  const save = async () => {
    const png = canvasRef.current?.toDataURL("image/png");
    if (!png) return;
    setSaveState("pending");
    try {
      await onSave(png);
      setSaveState("success");
    } catch {
      setSaveState("error");
    }
  };
  return <div className="space-y-2" data-testid={`live-signature-${type}-${sectionId}`}>
    <canvas ref={canvasRef} width={700} height={180} className="h-32 w-full touch-none rounded border bg-white" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} aria-label="Signature canvas" />
    <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={saveState === "pending"} onClick={clear}>Clear</Button><Button type="button" size="sm" disabled={!hasInk || saveState === "pending"} onClick={() => void save()}>{saveState === "pending" ? "Saving signature…" : "Save signature"}</Button></div>
    {saveState === "success" && <p className="text-sm text-emerald-700" role="status">Signature saved.</p>}
    {saveState === "error" && <p className="text-sm text-destructive" role="alert">Signature could not be saved. Please try again.</p>}
  </div>;
}

function SignatureBlock({
  sectionId, type, state, live, readOnly, legacy = false,
}: {
  sectionId: string;
  type: ConfiguredSignatureType;
  state?: ConfiguredSignature;
  live?: ConfiguredFormLiveProps;
  readOnly: boolean;
  legacy?: boolean;
}) {
  const defaults = live?.signatureDefaults?.[type];
  const [name, setName] = useState(defaults?.name || "");
  const [rank, setRank] = useState(defaults?.rank || "");
  useEffect(() => { setName(defaults?.name || ""); setRank(defaults?.rank || ""); }, [defaults?.name, defaults?.rank]);
  const label = legacy ? "Signature" : type === "officer" ? "Officer signature" : "Seafarer signature";
  if (state?.signatureUrl) {
    return <div className="flex flex-wrap items-center gap-2 text-sm" data-testid={legacy ? `preview-signature-${sectionId}` : `preview-signature-${type}-${sectionId}`}>
      <span className="font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>{label}:</span>
      <AuthenticatedSignatureImage url={state.signatureUrl} signerName={state.signatureName} compact />
      <span className="whitespace-nowrap">{state.signatureName || "Signer name unavailable"}{type === "seafarer" && state.signatureRank ? ` · ${state.signatureRank}` : ""}</span>
      {type === "seafarer" && <span className="whitespace-nowrap text-muted-foreground">Signed in the presence of {state.witnessedByName || "the witnessing officer"}</span>}
      <span className="ml-1 whitespace-nowrap font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>Date:</span>
      <span className="whitespace-nowrap" data-testid={legacy ? `preview-signature-date-${sectionId}` : undefined}>{formatSignatureDate(state.signedAt)}</span>
    </div>;
  }
  return <div className="space-y-3 rounded-md border border-dashed px-4 py-4" style={{ borderColor: sailDesignSystem.colors.headerText }} data-testid={`preview-signature-${type}-${sectionId}`}>
    <p className="text-sm font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>{label}</p>
    {type === "seafarer" && <div className="grid gap-3 sm:grid-cols-2">
      <SAILInput value={name} onChange={(event) => setName(event.target.value)} readOnly={readOnly} placeholder="NAME" aria-label="Seafarer name" data-testid={`signature-seafarer-name-${sectionId}`} />
      <SAILInput value={rank} onChange={(event) => setRank(event.target.value)} readOnly={readOnly} placeholder="RANK" aria-label="Seafarer rank" data-testid={`signature-seafarer-rank-${sectionId}`} />
    </div>}
    {readOnly ? <p className="text-sm text-muted-foreground">Awaiting signature</p> : <SignaturePad sectionId={sectionId} type={type} onSave={(data) => live?.onSignatureChange?.(sectionId, type, data, type === "seafarer" ? name : defaults?.name || undefined, type === "seafarer" ? rank : defaults?.rank || undefined)} />}
    <SAILFormField label="Date"><p className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm">{formatSignatureDate(state?.signedAt)}</p></SAILFormField>
  </div>;
}

function AuthenticatedSignatureImage({ url, signerName, compact = false }: { url: string; signerName?: string | null; compact?: boolean }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    setObjectUrl(null);
    setError(false);
    void apiRequest("GET", url)
      .then((response) => response.blob())
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => { if (active) setError(true); });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);
  if (error) return <p className="text-sm text-destructive" role="alert">Signature image could not be loaded.</p>;
  if (!objectUrl) return <p className="text-sm text-muted-foreground">Loading signature…</p>;
  return (
    <img
      src={objectUrl}
      alt={`Signature of ${signerName || "submitter"}`}
      className={compact ? "h-auto max-h-10 w-auto max-w-[min(14rem,35vw)] shrink object-contain" : "max-h-32 rounded border bg-white"}
    />
  );
}

function formatSignatureDate(value?: string | null) {
  if (!value) return "Auto-filled when signed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Signing date unavailable";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function QuestionCommentControl({
  questionId,
  comment,
}: {
  questionId: string;
  comment: QuestionCommentState;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-gray-500 hover:bg-transparent hover:text-gray-700"
      onClick={comment.open}
      aria-expanded={comment.isExpanded}
      aria-label="Comment"
      title="Comment"
      data-testid={`button-preview-comment-${questionId}`}
    >
      <MessageSquare className="h-[18px] w-[18px]" />
    </Button>
  );
}

function QuestionCommentRow({
  questionId,
  colSpan,
  comment,
  onChange,
}: {
  questionId: string;
  colSpan: number;
  comment: QuestionCommentState;
  onChange?: (value: string) => void;
}) {
  if (!comment.isExpanded) return null;

  return (
    <tr className={getTableClasses().row} data-testid={`preview-comment-row-${questionId}`}>
      <td colSpan={colSpan} className={getTableClasses().cell}>
        {comment.isEditing ? (
          <Textarea
            value={comment.text}
            onChange={(event) => { comment.setText(event.target.value); onChange?.(event.target.value); }}
            onBlur={comment.finishEditing}
            placeholder="Comment: Add your observations here..."
            className="text-blue-600 italic border-blue-200"
            rows={2}
            autoFocus
            data-testid={`preview-comment-${questionId}`}
          />
        ) : (
          <button
            type="button"
            className="w-full rounded p-2 text-left text-[13px] italic text-blue-600 hover:bg-gray-50"
            onClick={comment.edit}
            data-testid={`preview-comment-display-${questionId}`}
          >
            {comment.text || "Click to add comment..."}
          </button>
        )}
      </td>
    </tr>
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
    const resolvedRoleName = section.responsible_role_name?.trim() || (role ? roleName(role) : "");
    if (!resolvedRoleName) {
      return <InlineMissing testId={`missing-responsible-${sectionId}`}>Responsible role not found</InlineMissing>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid={`responsible-role-${sectionId}`}>
        <p className="text-sm font-semibold">To be completed by: {resolvedRoleName}</p>
        {role?.isDeleted && <Badge variant="outline">Deleted role</Badge>}
        {!role?.isDeleted && role?.isActive === false && (
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
  live,
  readOnly: sectionReadOnly,
}: {
  question: ConfiguredFormQuestion;
  questionId: string;
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
  live?: ConfiguredFormLiveProps;
  readOnly?: boolean;
}) {
  const comment = useQuestionComment(live?.answerComments?.[questionId] || "");
  const answer = answers[questionId];
  const hasText = question.question_text.trim().length > 0;
  const labels = question.response_type === "yes_no_na" ? ["Yes", "No", "NA"] : ["Yes", "No"];
  const options = question.options || [];
  const selectedOptions = Array.isArray(answer) ? answer : [];
  const tableClasses = getTableClasses();
  const readOnly = !!live?.isLocked || !!sectionReadOnly;

  const responseControl = (() => {
    switch (question.response_type) {
      case "yes_no":
      case "yes_no_na":
        return (
          <RadioGroup
            value={typeof answer === "string" ? answer : ""}
            onValueChange={(value) => !readOnly && setAnswer(questionId, value)}
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
                    onValueChange={(value) => !readOnly && setAnswer(questionId, value)}
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
                    disabled={readOnly} onCheckedChange={(checked) => setAnswer(
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
            readOnly={readOnly} onChange={(event) => setAnswer(questionId, event.target.value)}
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
            readOnly={readOnly} onChange={(event) => setAnswer(questionId, event.target.value)}
            className="max-w-xs"
            data-testid={`preview-response-${questionId}`}
          />
        );
      case "number":
        return (
          <SAILInput
            type="number"
            value={typeof answer === "string" ? answer : ""}
            readOnly={readOnly} onChange={(event) => setAnswer(questionId, event.target.value)}
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
              disabled={readOnly} onCheckedChange={(checked) => setAnswer(questionId, checked === true)}
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
            <span
              className="ml-2 text-[#4f5863] text-[13px] font-normal"
              data-testid={!hasText ? `missing-point-text-${questionId}` : undefined}
            >
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
          {question.comment_enabled && !readOnly && (
            <QuestionCommentControl questionId={questionId} comment={comment} />
          )}
        </td>
      </tr>
      {question.comment_enabled && <QuestionCommentRow questionId={questionId} colSpan={3} comment={comment} onChange={(value) => live?.onAnswerCommentChange?.(questionId, value)} />}
    </>
  );
}

function ConfiguredMatrixPoint({
  question,
  questionId,
  options,
  answers,
  setAnswer,
  live,
  readOnly,
}: {
  question: ConfiguredFormQuestion;
  questionId: string;
  options: ConfiguredFormOption[];
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
  live?: ConfiguredFormLiveProps;
  readOnly?: boolean;
}) {
  const comment = useQuestionComment(live?.answerComments?.[questionId] || "");
  const answer = answers[questionId];
  const selectedOptions = Array.isArray(answer) ? answer : [];
  const tableClasses = getTableClasses();

  return (
    <>
      <tr className={tableClasses.row} data-testid={`preview-matrix-point-${questionId}`}>
        <td className={`${tableClasses.cell} min-w-[220px]`}>
          <span className="mr-2 text-gray-600 text-xs font-normal">{question.question_code || "Point code not configured"}</span>
          <span className="text-[#4f5863] text-[13px] font-normal">{question.question_text.trim() || MISSING_POINT_TEXT}</span>
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
                disabled={!!live?.isLocked || !!readOnly}
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
          {question.comment_enabled && !live?.isLocked && !readOnly && (
            <QuestionCommentControl questionId={questionId} comment={comment} />
          )}
        </td>
      </tr>
      {question.comment_enabled && (
        <QuestionCommentRow questionId={questionId} colSpan={options.length + 2} comment={comment} onChange={(value) => live?.onAnswerCommentChange?.(questionId, value)} />
      )}
    </>
  );
}

function ConfiguredMatrixSection({
  section,
  sectionId,
  answers,
  setAnswer,
  live,
  readOnly,
}: {
  section: ConfiguredFormSection;
  sectionId: string;
  answers: Record<string, ConfiguredFormAnswerValue>;
  setAnswer: (questionId: string, value: ConfiguredFormAnswerValue) => void;
  live?: ConfiguredFormLiveProps;
  readOnly?: boolean;
}) {
  const options = section.questions[0]?.options || [];
  const tableClasses = getTableClasses();

  return (
    <div className="w-full overflow-x-auto" data-testid={`preview-matrix-section-${sectionId}`}>
      <table className="min-w-max w-full border-collapse">
        <thead>
          <tr>
            <th className={`${tableClasses.header} ${tableClasses.headerCell} min-w-[220px] text-left`}>Point</th>
            {options.map((option, index) => {
              const descriptor = endpointDescriptor(index, options, section.questions[0]?.low_end_label, section.questions[0]?.high_end_label);
              return (
              <th className={`${tableClasses.header} ${tableClasses.headerCell} min-w-[84px] text-center`} key={option.clientKey || option.option_uuid || `${sectionId}-header-${index}`}>
                {optionLabel(option)}
                {descriptor && (
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight opacity-90" data-testid={`matrix-end-label-${sectionId}-${index === 0 ? "low" : "high"}`}>
                    {descriptor}
                  </span>
                )}
              </th>
              );
            })}
            <th className={`${tableClasses.header} ${tableClasses.headerCell} min-w-[56px] text-center`}>Comment</th>
          </tr>
        </thead>
        <tbody>
          {section.questions.map((question, questionIndex) => {
            const questionId = question.clientKey || question.question_uuid || `${sectionId}-point-${questionIndex + 1}`;
            return <ConfiguredMatrixPoint key={questionId} question={question} questionId={questionId} options={options} answers={answers} setAnswer={setAnswer} live={live} readOnly={readOnly} />;
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
  live,
  mode,
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
  live?: ConfiguredFormLiveProps;
  mode: ConfiguredFormMode;
}) {
  const sectionTitle = section.section_title.trim() || MISSING_SECTION_TITLE;
  const sectionCode = section.section_code.trim() || "Section code not configured";
  // signature_required is intentionally a read-only legacy fallback. New
  // structures independently declare the officer and seafarer requirements.
  const officerSignatureRequired = !!section.signature_officer_required || (!!section.signature_required && !section.signature_seafarer_required);
  const seafarerSignatureRequired = !!section.signature_seafarer_required;
  const hasFooterContent = section.comment_box_required
    || officerSignatureRequired || seafarerSignatureRequired
    || section.responsible_mode !== "not_applicable";
  const state = live?.sectionStates?.[sectionId];
  const readOnly = !!live?.isLocked || state?.status === "submitted" || state?.status === "not_applicable" || live?.sectionOwnership?.[sectionId]?.canEdit === false;
  const [sectionComment, setSectionComment] = useState(state?.sectionComment || "");
  const [sectionDialog, setSectionDialog] = useState<{
    kind: "validation" | "submit";
    title: string;
    description: string;
  } | null>(null);
  const currentSectionComment = live?.sectionComments?.[sectionId] ?? sectionComment;
  const submitSection = () => {
    const missing = section.questions.find((question, index) => {
      if (!question.is_mandatory || question.response_type === "info_only") return false;
      const id = question.clientKey || question.question_uuid || `${sectionId}-point-${index + 1}`;
      const value = answers[id];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missing) {
      const questionId = missing.clientKey || missing.question_uuid;
      const selector = questionId ? `[data-testid="preview-point-${questionId}"] input, [data-testid="preview-point-${questionId}"] textarea, [data-testid="preview-matrix-point-${questionId}"] input` : "";
      document.querySelector<HTMLElement>(selector)?.focus();
      setSectionDialog({
        kind: "validation",
        title: "Complete this section before submitting",
        description: `Please answer mandatory point ${missing.question_code || missing.question_text}.`,
      });
      return;
    }
    if (section.comment_box_required && !currentSectionComment.trim()) {
      setSectionDialog({
        kind: "validation",
        title: "Complete this section before submitting",
        description: "A section comment is required.",
      });
      return;
    }
    const signatures = state?.signatures || {};
    const missingSignature = (officerSignatureRequired && !(signatures.officer?.signatureAttUuid || state?.signatureAttUuid))
      ? "Officer"
      : seafarerSignatureRequired && !signatures.seafarer?.signatureAttUuid
        ? "Seafarer"
        : null;
    if (missingSignature) {
      setSectionDialog({
        kind: "validation",
        title: "Complete this section before submitting",
        description: `A ${missingSignature.toLowerCase()} signature is required.`,
      });
      return;
    }
    setSectionDialog({
      kind: "submit",
      title: `Submit ${sectionCode} ${sectionTitle}?`,
      description: "Submitted sections cannot be changed. This action is permanent.",
    });
  };

  const footer = isApplicable && isExpanded && (hasFooterContent || mode === "live") ? (
    <div className="mt-6 space-y-5 border-t pt-5" style={{ borderColor: sailDesignSystem.colors.border }} data-testid={`preview-section-footer-${sectionId}`}>
      {section.comment_box_required && (
        <div data-testid={`preview-section-comment-${sectionId}`}>
          <SAILFormField label="Section comment">
            {mode === "live" && readOnly
              ? <p className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" data-testid={`preview-section-comment-readonly-${sectionId}`}>{currentSectionComment || "No section comment"}</p>
              : <Textarea value={mode === "live" ? currentSectionComment : undefined} onChange={(event) => { setSectionComment(event.target.value); live?.onSectionCommentChange?.(sectionId, event.target.value); }} placeholder={mode === "live" ? "Add section comment" : "Preview comment — not saved"} data-testid={`preview-section-comment-input-${sectionId}`} />}
          </SAILFormField>
        </div>
      )}
      {officerSignatureRequired && (
        <div>
          {mode === "preview" ? <div className="space-y-4 rounded-md border border-dashed px-4 py-4" style={{ borderColor: sailDesignSystem.colors.headerText }} data-testid={section.signature_required ? `preview-signature-${sectionId}` : `preview-signature-officer-${sectionId}`}>
            <p className="text-sm font-semibold">Officer signature</p><p className="text-xs">Signature placeholder — live signing is not available in Preview.</p>
            <SAILFormField label="Date"><p className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid={section.signature_required ? `preview-signature-date-${sectionId}` : undefined}>Auto-filled when signed</p></SAILFormField>
          </div> : <SignatureBlock sectionId={sectionId} type="officer" readOnly={readOnly} live={live} legacy={!!section.signature_required} state={state?.signatures?.officer || (state?.signatureAttUuid ? { signatureAttUuid: state.signatureAttUuid, signatureName: state.signatureName, signedAt: state.signedAt, signatureUrl: state.signatureUrl } : undefined)} />}
        </div>
      )}
      {seafarerSignatureRequired && (
        mode === "preview"
          ? <div className="space-y-4 rounded-md border border-dashed px-4 py-4" style={{ borderColor: sailDesignSystem.colors.headerText }} data-testid={`preview-signature-seafarer-${sectionId}`}><p className="text-sm font-semibold">Seafarer signature</p><p className="text-xs">Signature placeholder — live signing is not available in Preview.</p><SAILFormField label="Date"><p className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm">Auto-filled when signed</p></SAILFormField></div>
          : <SignatureBlock sectionId={sectionId} type="seafarer" readOnly={readOnly} live={live} state={state?.signatures?.seafarer} />
      )}
      <SectionResponsibility section={section} roles={roles} departments={departments} sectionId={sectionId} />
       {mode === "live" && <div className="flex flex-wrap items-center gap-2 border-t pt-3"><Badge variant="outline">{state?.status === "submitted" ? "Submitted" : state?.status === "not_applicable" ? "Not applicable" : "In progress"}</Badge>{live?.sectionOwnership?.[sectionId] && <span className="text-xs">Owner: {live.sectionOwnership[sectionId].ownerLabel}</span>}{state?.submittedByName && <span className="text-xs">Submitted by {state.submittedByName}</span>}{!readOnly && <><Button type="button" variant="outline" size="sm" onClick={() => void live?.onSaveDraft?.(sectionId)}>Save draft</Button><Button type="button" size="sm" onClick={submitSection}>Submit</Button></>}</div>}
    </div>
  ) : undefined;

  return (
    <div
      className="[&>div]:bg-gray-100 [&>div]:shadow-none"
      data-testid={`preview-section-${sectionId}`}
    >
      <FormSection
        title={`${sectionCode} ${sectionTitle}`}
        headerActions={
          <SAILButton type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={onToggleExpanded} aria-expanded={isExpanded} disabled={mode === "live" && !isApplicable} data-testid={`button-preview-section-toggle-${sectionId}`}>
            {!isApplicable && mode === "live" ? "Not applicable" : isExpanded ? "Collapse" : "Expand"}
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
          <ConfiguredMatrixSection section={section} sectionId={sectionId} answers={answers} setAnswer={setAnswer} live={live} readOnly={readOnly} />
        ) : (
          <FormTable headers={["Point", "Response", "Comment"]}>
            {section.questions.map((question, questionIndex) => {
              const questionId = question.clientKey || question.question_uuid || `${sectionId}-point-${questionIndex + 1}`;
              return <ConfiguredPoint key={questionId} question={question} questionId={questionId} answers={answers} setAnswer={setAnswer} live={live} readOnly={readOnly} />;
            })}
          </FormTable>
        )}
      </FormSection>
      <AlertDialog open={sectionDialog !== null} onOpenChange={(open) => !open && setSectionDialog(null)}>
        <AlertDialogContent data-testid={`briefing-section-dialog-${sectionId}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>{sectionDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{sectionDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {sectionDialog?.kind === "submit" && <AlertDialogCancel>Cancel</AlertDialogCancel>}
            <AlertDialogAction
              onClick={() => {
                if (sectionDialog?.kind === "submit") {
                  void live?.onSubmitSection?.(sectionId, currentSectionComment);
                }
                setSectionDialog(null);
              }}
            >
              {sectionDialog?.kind === "submit" ? "Submit" : "OK"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function fixedPartContent(part: ConfiguredFormPart, fixedParts?: ConfiguredFormRendererProps["fixedParts"]) {
  const normalizedCode = part.partCode.trim().toUpperCase();
  return Object.entries(fixedParts || {}).find(([code]) => code.trim().toUpperCase() === normalizedCode)?.[1];
}

function FixedPartRenderer({ part, fixedParts }: { part: ConfiguredFormPart; fixedParts?: ConfiguredFormRendererProps["fixedParts"] }) {
  const content = fixedPartContent(part, fixedParts);
  return (
    <div data-testid={`preview-fixed-part-${part.partCode}`}>
      {content || <InlineMissing testId={`preview-fixed-part-message-${part.partCode}`}>This fixed part is not configured for this form.</InlineMissing>}
    </div>
  );
}

function PartCard({
  part,
  subtitle,
  progress,
  children,
}: {
  part: ConfiguredFormPart;
  subtitle: React.ReactNode;
  progress?: React.ReactNode;
  children: React.ReactNode;
}) {
  const code = part.partCode.trim() || "—";
  const title = part.partTitle.trim() || `Part ${code}`;

  return (
    <section
      className="min-w-0"
      style={{
        backgroundColor: sailDesignSystem.components.card.background,
        border: `1px solid ${sailDesignSystem.colors.border}`,
        borderRadius: sailDesignSystem.components.card.borderRadius,
        boxShadow: sailDesignSystem.components.card.shadow,
        padding: sailDesignSystem.components.card.padding,
      }}
      data-testid={`configured-part-card-${part.partCode}`}
    >
      <header className="pb-4 mb-6">
        <h3
          className="text-xl font-semibold mb-2"
          style={{ color: sailDesignSystem.colors.headerText }}
        >
          Part {code}: {title}
        </h3>
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
          style={{ color: sailDesignSystem.colors.textSecondary }}
        >
          <span>{subtitle}</span>
          {progress}
        </div>
        <div
          className="w-full h-0.5 mt-2"
          style={{ backgroundColor: sailDesignSystem.colors.headerText }}
        />
      </header>
      {children}
    </section>
  );
}

export function ConfiguredFormRenderer({
  mode,
  formTitle = "Form",
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
  fixedParts,
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
    const applicableSections = selectedSections.filter((section, index) => {
      const id = section.clientKey || section.section_uuid || `${selectedPart?.formPartUuid}-section-${index + 1}`;
      return live?.sectionStates?.[id]?.status !== "not_applicable";
    });
    const submittedCount = applicableSections.filter((section, index) => {
      const id = section.clientKey || section.section_uuid || `${selectedPart?.formPartUuid}-section-${index + 1}`;
      return live?.sectionStates?.[id]?.status === "submitted";
    }).length;

    const isPartB = selectedPart?.partCode.trim().toUpperCase() === "B";
    const partSubtitle = mode === "preview"
      ? "Inputs are interactive for review, but nothing is saved."
      : "Complete each section as applicable.";
    const progressCaption = mode === "live" && isPartB ? (
      <span data-testid="live-progress">
        {submittedCount === applicableSections.length && applicableSections.length > 0 ? "Complete" : `${submittedCount} of ${applicableSections.length} applicable sections submitted`}
      </span>
    ) : undefined;

    return (
      <>
        <div className="flex flex-wrap items-end justify-end gap-4" data-testid={mode === "preview" ? "preview-only-banner" : "configured-form-live-banner"}>
          <SAILFormField label="Vessel type" className="min-w-[210px]" >
            <div data-testid="select-preview-vessel-type">
              <SAILSelect value={selectedVessel} onValueChange={setVesselType} placeholder="All vessel types">
                <SelectItem value="all">All vessel types</SelectItem>
                {vesselOptions.map((option) => <SelectItem key={option.uuid} value={option.uuid}>{option.label}</SelectItem>)}
              </SAILSelect>
            </div>
          </SAILFormField>
        </div>

        <div
          style={{ marginTop: sailDesignSystem.spacing.sectionSpacing }}
          data-testid="configured-form-content"
        >
          {!selectedPart ? (
            <InlineMissing testId="preview-no-form-parts">No form parts are configured.</InlineMissing>
          ) : selectedPart.partType === "fixed" ? (
            fixedPartContent(selectedPart, fixedParts) ? (
              <FixedPartRenderer part={selectedPart} fixedParts={fixedParts} />
            ) : (
              <PartCard part={selectedPart} subtitle={partSubtitle}>
                <FixedPartRenderer part={selectedPart} fixedParts={fixedParts} />
              </PartCard>
            )
          ) : (
            <PartCard part={selectedPart} subtitle={partSubtitle} progress={progressCaption}>
              <div
                className="flex flex-col"
                style={{ gap: sailDesignSystem.spacing.sectionSpacing }}
                data-testid="configured-section-stack"
              >
                {selectedSections.length === 0 && (
                  <InlineMissing testId={`preview-no-sections-${selectedPart.partCode}`}>
                    No sections configured for this part.
                  </InlineMissing>
                )}
                {selectedSections.map((section, sectionIndex) => {
                  const sectionId = section.clientKey || section.section_uuid || `${selectedPart.formPartUuid}-section-${sectionIndex + 1}`;
                  const isApplicable = live?.sectionStates?.[sectionId]?.status === "not_applicable"
                    ? false
                    : selectedVessel === "all"
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
                      isExpanded={mode === "live" && live?.sectionStates?.[sectionId]?.status === "not_applicable" ? false : internalExpandedSections[sectionId] !== false}
                      onToggleExpanded={() => setInternalExpandedSections((current) => ({
                        ...current,
                        [sectionId]: !(current[sectionId] !== false),
                      }))}
                      answers={answers}
                      setAnswer={setAnswer}
                      live={live}
                      mode={mode}
                    />
                  );
                })}
              </div>
            </PartCard>
          )}
        </div>
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