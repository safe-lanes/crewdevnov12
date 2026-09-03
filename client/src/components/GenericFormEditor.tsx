import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Copy, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { Form } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getCrewUserId } from "@/lib/crewUser";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfiguredFormRenderer } from "@/components/configured-form/ConfiguredFormRenderer";
import { SharedFormShell } from "@/components/SharedFormShell";
import { FormTable } from "@/components/BaseSubmoduleForm";
import { getTableClasses, sailDesignSystem } from "@/config/sailDesignSystem";

export interface ConfigurableFormPart {
  formPartUuid: string;
  formUuid?: string;
  partCode: string;
  partTitle: string;
  partType: string;
  isOfficeOnly?: boolean;
}

interface GenericFormEditorProps {
  form: Form & { originalFormId?: number };
  formName: string;
  rankGroupName?: string;
  rankGroupId?: number;
  rankGroupConfig?: unknown;
  configurableParts?: ConfigurableFormPart[];
  onClose: () => void;
  onSave: (data: unknown) => void;
}

interface VersionRow {
  id: number;
  fvUuid: string;
  formId: number;
  rankGroupId: number | null;
  versionNo: string;
  versionDate: string;
  status: string;
  configuration?: string | null;
}

interface SavedStructuresResponse {
  form_version_uuid: string;
  parts: Array<{
    form_version_uuid: string;
    form_part_uuid: string;
    option_sets?: unknown[];
    sections: unknown[];
  }>;
}

interface RoleRow {
  ruid: string;
  assignedRole?: string;
  name?: string;
  roleName?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

type RoleStatus = "inactive" | "deleted" | "missing" | null;
type EditorViewMode = "configure" | "preview";

interface RoleSummary {
  title: string;
  status: RoleStatus;
}

type DepartmentRow = string | {
  uuid?: string;
  departmentUuid?: string;
  name?: string;
  departmentName?: string;
};

interface VesselTypeRow {
  vtUuid?: string;
  vtuid?: string;
  name?: string;
  vesselType?: string;
  label?: string;
}

interface OptionModel {
  clientKey: string;
  option_uuid?: string;
  option_label: string;
  option_value: string;
}

interface OptionSetModel {
  clientKey: string;
  option_set_uuid?: string;
  option_set_name: string | null;
  low_end_label: string | null;
  high_end_label: string | null;
  options: OptionModel[];
}

interface QuestionModel {
  clientKey: string;
  question_uuid?: string;
  question_code: string;
  question_text: string;
  response_type: string;
  is_mandatory: boolean;
  comment_enabled: boolean;
  option_set_uuid: string | null;
  low_end_label?: string | null;
  high_end_label?: string | null;
  options: OptionModel[];
}

interface SectionModel {
  clientKey: string;
  section_uuid?: string;
  section_code: string;
  section_title: string;
  applicable_vessel_types: string[];
  responsible_mode: "role" | "department" | "not_applicable";
  responsible_role_uuid: string | null;
  responsible_department: string | null;
  comment_box_required: boolean;
  signature_required: boolean;
  default_option_set_uuid: string | null;
  layout_preference: "auto" | "list" | "matrix";
  effectiveLayout?: "list" | "matrix";
  questions: QuestionModel[];
}

const RESPONSE_TYPES = [
  ["yes_no", "Yes / No"],
  ["yes_no_na", "Yes / No / NA"],
  ["single_select", "Single Selection"],
  ["multi_select", "Multi Selection"],
  ["free_text", "Free Text"],
  ["date", "Date"],
  ["number", "Number"],
  ["checkbox", "Checkbox"],
  ["info_only", "Information Only"],
] as const;

let clientKeyCounter = 0;
function clientKey(prefix: string): string {
  clientKeyCounter += 1;
  return `${prefix}-${clientKeyCounter}`;
}

function slugOptionValue(label: string): string {
  const value = label.trim().toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return value || "option";
}

function createOption(label = "New option", existing: OptionModel[] = []): OptionModel {
  const base = slugOptionValue(label);
  const used = new Set(existing.map((option) => option.option_value));
  let value = base;
  let suffix = 2;
  while (used.has(value)) {
    value = `${base}_${suffix}`;
    suffix += 1;
  }
  return {
    clientKey: clientKey("option"),
    option_label: label,
    option_value: value,
  };
}

function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function cloneOption(option: OptionModel, omitOptionUuid = false): OptionModel {
  const { option_uuid, ...optionWithoutUuid } = option;
  return {
    ...optionWithoutUuid,
    clientKey: clientKey("option"),
    ...(omitOptionUuid ? {} : (option_uuid ? { option_uuid } : {})),
  };
}

function cloneOptions(options: OptionModel[], omitOptionUuid = false): OptionModel[] {
  return options.map((option) => cloneOption(option, omitOptionUuid));
}

function isNamedOptionSet(set: Pick<OptionSetModel, "option_set_name">): boolean {
  return set.option_set_name !== null;
}

function buildNumericScaleOptions(
  startInput: string,
  endInput: string,
  firstLabel = "",
  lastLabel = "",
): { options?: OptionModel[]; lowEndLabel?: string | null; highEndLabel?: string | null; error?: string } {
  const start = Number(startInput);
  const end = Number(endInput);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isInteger(start) || !Number.isInteger(end)) {
    return { error: "Enter whole-number start and end values." };
  }
  if (end < start) return { error: "End must be greater than start." };
  if (end === start) return { error: "A scale needs at least two values." };
  return {
    options: Array.from({ length: end - start + 1 }, (_, index) => {
      const value = String(start + index);
      return {
        clientKey: clientKey("option"),
        option_label: value,
        option_value: value,
      };
    }),
    lowEndLabel: firstLabel.trim() || null,
    highEndLabel: lastLabel.trim() || null,
  };
}

function resolveDraftEffectiveLayout(section: SectionModel): "list" | "matrix" {
  if (section.layout_preference === "list") return "list";
  if (section.questions.length === 0) return "list";
  if (section.questions.some((question) => question.response_type !== "single_select" && question.response_type !== "multi_select")) {
    return "list";
  }
  const setUuids = new Set(section.questions.map((question) => question.option_set_uuid || section.default_option_set_uuid || ""));
  if (setUuids.size !== 1 || !setUuids.values().next().value) return "list";
  const options = section.questions[0].options;
  if (options.length === 0 || options.length > 12) return "list";
  if (options.length <= 6) return "matrix";
  if (options.length <= 12 && options.every((option) => option.option_label.trim().length <= 4)) return "matrix";
  return "list";
}

function matrixIneligibilityReason(section: SectionModel): string | null {
  if (section.questions.length === 0) return "the section has no points";
  if (section.questions.some((question) => question.response_type !== "single_select" && question.response_type !== "multi_select")) {
    return "the section includes a non-select point";
  }
  const setUuids = new Set(section.questions.map((question) => question.option_set_uuid || section.default_option_set_uuid || ""));
  if (setUuids.size > 1) return "points use mixed option sets";
  if (!setUuids.values().next().value) return "points do not have a shared option set";
  const options = section.questions[0].options;
  if (options.length === 0) return "the shared option set has no options";
  if (options.length > 12) return "the shared option set has more than 12 options";
  if (options.length > 6 && options.some((option) => option.option_label.trim().length > 4)) {
    return "the shared option set has labels longer than four characters";
  }
  return null;
}

function emptyQuestion(
  sectionCode: string,
  questionIndex: number,
  inheritedOptions: OptionModel[] = [],
  inheritedSetUuid: string | null = null,
): QuestionModel {
  return {
    clientKey: clientKey("question"),
    question_code: `${sectionCode}.${questionIndex + 1}`,
    question_text: "",
    response_type: "yes_no",
    is_mandatory: false,
    comment_enabled: true,
    option_set_uuid: inheritedSetUuid,
    options: cloneOptions(inheritedOptions),
  };
}

function emptySection(partCode: string, sectionIndex: number): SectionModel {
  return {
    clientKey: clientKey("section"),
    section_code: `${partCode}${sectionIndex + 1}`,
    section_title: "",
    applicable_vessel_types: [],
    responsible_mode: "not_applicable",
    responsible_role_uuid: null,
    responsible_department: null,
    comment_box_required: false,
    signature_required: false,
    default_option_set_uuid: null,
    layout_preference: "auto",
    questions: [],
  };
}

function renumberSections(partCode: string, sections: SectionModel[]): SectionModel[] {
  return sections.map((section, sectionIndex) => {
    const sectionCode = `${partCode}${sectionIndex + 1}`;
    return {
      ...section,
      section_code: sectionCode,
      questions: section.questions.map((question, questionIndex) => ({
        ...question,
        question_code: `${sectionCode}.${questionIndex + 1}`,
      })),
    };
  });
}

function normalizeOptionSets(data: any): OptionSetModel[] {
  const optionSets = Array.isArray(data?.option_sets) ? data.option_sets : [];
  return optionSets.map((set: any) => ({
    clientKey: clientKey("option-set"),
    option_set_uuid: set.option_set_uuid,
    option_set_name: set.option_set_name ?? null,
    low_end_label: set.low_end_label ?? null,
    high_end_label: set.high_end_label ?? null,
    options: Array.isArray(set.options) ? set.options.map((option: any) => ({
      clientKey: clientKey("option"),
      option_uuid: option.option_uuid,
      option_label: option.option_label || "",
      option_value: option.option_value || slugOptionValue(option.option_label || "option"),
    })) : [],
  }));
}

function normalizeTree(
  data: any,
  partCode: string,
  optionSets: OptionSetModel[] = normalizeOptionSets(data),
): SectionModel[] {
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const optionSetsByUuid = new Map(optionSets.map((set) => [set.option_set_uuid, set]));
  return renumberSections(partCode, sections.map((section: any) => ({
    clientKey: clientKey("section"),
    section_uuid: section.section_uuid,
    section_code: section.section_code || "",
    section_title: section.section_title || "",
    applicable_vessel_types: Array.isArray(section.applicable_vessel_types)
      ? section.applicable_vessel_types.map(String)
      : [],
    responsible_mode: section.responsible_mode || "not_applicable",
    responsible_role_uuid: section.responsible_role_uuid ?? null,
    responsible_department: section.responsible_department ?? null,
    comment_box_required: !!section.comment_box_required,
    signature_required: !!section.signature_required,
    default_option_set_uuid: section.default_option_set_uuid ?? null,
    layout_preference: section.layout_preference || "auto",
    effectiveLayout: section.effectiveLayout,
    questions: Array.isArray(section.questions) ? section.questions.map((question: any) => ({
      clientKey: clientKey("question"),
      question_uuid: question.question_uuid,
      question_code: question.question_code || "",
      question_text: question.question_text || "",
      response_type: question.response_type || "yes_no",
      is_mandatory: !!question.is_mandatory,
      comment_enabled: question.comment_enabled !== false,
      // The repository persists resolved question references. A question that
      // comes back with the same set as its section default is represented in
      // the editor as inherited, so changing that default after a reload
      // updates it while a different set remains an explicit override.
      option_set_uuid: question.option_set_uuid === section.default_option_set_uuid
        ? null
        : question.option_set_uuid ?? null,
      low_end_label: question.low_end_label ?? optionSetsByUuid.get(question.option_set_uuid || section.default_option_set_uuid)?.low_end_label ?? null,
      high_end_label: question.high_end_label ?? optionSetsByUuid.get(question.option_set_uuid || section.default_option_set_uuid)?.high_end_label ?? null,
      options: ((Array.isArray(question.options) && question.options.length > 0)
        ? question.options
        : (optionSetsByUuid.get(question.option_set_uuid || section.default_option_set_uuid)?.options || [])
      ).map((option: any) => ({
        clientKey: clientKey("option"),
        option_uuid: option.option_uuid,
        option_label: option.option_label || "",
        // Existing values are loaded verbatim and are never regenerated on label edits.
        option_value: option.option_value || slugOptionValue(option.option_label || "option"),
      })),
    })) : [],
  })));
}

function toPayload(sections: SectionModel[], optionSets: OptionSetModel[] = []) {
  return {
    option_sets: optionSets.map((set) => ({
      ...(set.option_set_uuid ? { option_set_uuid: set.option_set_uuid } : {}),
      option_set_name: set.option_set_name,
      low_end_label: set.low_end_label,
      high_end_label: set.high_end_label,
      options: set.options.map((option) => ({
        ...(option.option_uuid ? { option_uuid: option.option_uuid } : {}),
        option_label: option.option_label.trim(),
        option_value: option.option_value,
      })),
    })),
    sections: sections.map((section) => ({
      ...(section.section_uuid ? { section_uuid: section.section_uuid } : {}),
      section_code: section.section_code,
      section_title: section.section_title.trim(),
      applicable_vessel_types: section.applicable_vessel_types,
      responsible_mode: section.responsible_mode,
      responsible_role_uuid: section.responsible_mode === "role" ? section.responsible_role_uuid : null,
      responsible_department: section.responsible_mode === "department" ? section.responsible_department : null,
      comment_box_required: section.comment_box_required,
      signature_required: section.signature_required,
      default_option_set_uuid: section.default_option_set_uuid,
      layout_preference: section.layout_preference,
      questions: section.questions.map((question) => ({
        ...(question.question_uuid ? { question_uuid: question.question_uuid } : {}),
        question_code: question.question_code,
        question_text: question.question_text.trim(),
        response_type: question.response_type,
        is_mandatory: question.is_mandatory,
        comment_enabled: question.comment_enabled,
        option_set_uuid: question.option_set_uuid,
        options: (question.option_set_uuid || section.default_option_set_uuid ? [] : question.options).map((option) => ({
          ...(option.option_uuid ? { option_uuid: option.option_uuid } : {}),
          option_label: option.option_label.trim(),
          // This is intentionally preserved on edits and only created for new options.
          option_value: option.option_value,
        })),
      })),
    })),
  };
}

function formatVersionDate(date = new Date()): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

function responseLabel(responseType: string): string {
  return RESPONSE_TYPES.find(([value]) => value === responseType)?.[1] || responseType;
}

function departmentOption(department: DepartmentRow): { value: string; label: string } | null {
  if (typeof department === "string") {
    const value = department.trim();
    return value ? { value, label: value } : null;
  }
  const value = department.name || department.departmentName || department.uuid || department.departmentUuid || "";
  return value ? { value, label: department.name || department.departmentName || value } : null;
}

function roleTitle(role: RoleRow): string {
  return role.assignedRole?.trim() || role.name?.trim() || role.roleName?.trim() || role.ruid;
}

function selectableRoles(roles: RoleRow[]): RoleRow[] {
  return roles
    .filter((role) => role.isActive === true && role.isDeleted === false)
    .sort((left, right) =>
      roleTitle(left).localeCompare(roleTitle(right), undefined, { sensitivity: "base" }) ||
      left.ruid.localeCompare(right.ruid),
    );
}

function roleSummary(roles: RoleRow[], uuid: string | null): RoleSummary {
  if (!uuid) return { title: "Not set", status: null };

  const role = roles.find((item) => item.ruid === uuid);
  if (!role) return { title: `Unknown role (${uuid})`, status: "missing" };

  if (role.isDeleted) return { title: roleTitle(role), status: "deleted" };
  if (!role.isActive) return { title: roleTitle(role), status: "inactive" };
  return { title: roleTitle(role), status: null };
}

function captureViewScrollPosition(
  positions: Record<EditorViewMode, number>,
  viewMode: EditorViewMode,
  scrollTop: number,
): Record<EditorViewMode, number> {
  return { ...positions, [viewMode]: scrollTop };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

function hasOpenPortalledListbox(): boolean {
  return document.querySelector('[role="listbox"]') !== null;
}

function shouldConfirmVersionChange(isDirty: boolean, currentVersionUuid: string, nextVersionUuid: string): boolean {
  return isDirty && currentVersionUuid !== nextVersionUuid;
}

export const GenericFormEditor: React.FC<GenericFormEditorProps> = ({
  form,
  formName,
  rankGroupName,
  rankGroupId: providedRankGroupId,
  rankGroupConfig,
  configurableParts: partsFromParent = [],
  onClose,
  onSave,
}) => {
  const { toast } = useToast();
  const realFormId = form.originalFormId ?? form.id;
  const [selectedPartUuid, setSelectedPartUuid] = useState("");
  const [selectedVersionUuid, setSelectedVersionUuid] = useState("");
  const [authoritativeVersion, setAuthoritativeVersion] = useState<VersionRow | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<EditorViewMode>("configure");
  const [previewVesselTypeUuid, setPreviewVesselTypeUuid] = useState("all");
  const [trees, setTrees] = useState<Record<string, SectionModel[]>>({});
  const [optionSets, setOptionSets] = useState<Record<string, OptionSetModel[]>>({});
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [selectedSection, setSelectedSection] = useState<{ partUuid: string; index: number } | null>(null);
  const [settingsDialog, setSettingsDialog] = useState<"vessel" | "responsible" | "comment" | "signature" | null>(null);
  const [settingsValues, setSettingsValues] = useState({
    vesselTypes: [] as string[],
    responsibleMode: "not_applicable" as SectionModel["responsible_mode"],
    responsibleRoleUuid: "",
    responsibleDepartment: "",
    commentRequired: false,
    signatureRequired: false,
  });
  const [confirmDelete, setConfirmDelete] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [scaleDialog, setScaleDialog] = useState<{ partUuid: string; setUuid: string } | null>(null);
  const [scaleValues, setScaleValues] = useState({ start: "", end: "", firstLabel: "", lastLabel: "" });
  const [scaleError, setScaleError] = useState("");
  const [bulkResponseTypes, setBulkResponseTypes] = useState<Record<string, string>>({});
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [pendingVersionUuid, setPendingVersionUuid] = useState<string | null>(null);
  const baselineRef = useRef<string | null>(null);
  const treeLoadGenerationRef = useRef(0);
  const saveTransitionRef = useRef(false);
  const skipNextTreeLoadVersionRef = useRef<string | null>(null);
  const draftCreationRef = useRef<Promise<VersionRow> | null>(null);
  const editorContentRef = useRef<HTMLElement | null>(null);
  const editorDialogRef = useRef<HTMLDivElement | null>(null);
  const editorScrollTopRef = useRef<Record<EditorViewMode, number>>({ configure: 0, preview: 0 });
  const focusLifecycleRef = useRef<{
    isPreview: boolean;
    settingsDialog: typeof settingsDialog;
    confirmDelete: typeof confirmDelete;
    showLeaveDialog: boolean;
    releaseConfirmOpen: boolean;
    handleClose: () => void;
  }>({
    isPreview: false,
    settingsDialog: null,
    confirmDelete: null,
    showLeaveDialog: false,
    releaseConfirmOpen: false,
    handleClose: () => undefined,
  });

  const { data: formPartsData = [], isLoading: isLoadingParts } = useQuery<ConfigurableFormPart[]>({
    queryKey: [`/api/v2/admin/forms/${realFormId}/parts`],
    queryFn: async () => {
      const response = await fetch(`/api/v2/admin/forms/${realFormId}/parts`);
      if (!response.ok) throw new Error("Failed to load form parts");
      return response.json();
    },
    enabled: !!realFormId,
  });

  const allParts = useMemo(
    () => (partsFromParent.length > 0 ? partsFromParent : formPartsData),
    [partsFromParent, formPartsData],
  );
  const configurableParts = useMemo(
    () => allParts.filter((part) => part.partType === "configurable"),
    [allParts],
  );

  const { data: rankGroups = [] } = useQuery<Array<{ id: number; name: string; formId: number }>>({
    queryKey: ["/api/v2/admin/rank-groups", realFormId],
    queryFn: async () => {
      const response = await fetch(`/api/v2/admin/rank-groups/form/${realFormId}?includeArchived=true`);
      if (!response.ok) throw new Error("Failed to load rank groups");
      return response.json();
    },
    enabled: !!realFormId,
  });

  const rankGroupId = useMemo(
    () => providedRankGroupId ?? rankGroups.find((group) => group.name === rankGroupName)?.id ?? null,
    [providedRankGroupId, rankGroups, rankGroupName],
  );

  const { data: versions = [], isLoading: isLoadingVersions, refetch: refetchVersions } = useQuery<VersionRow[]>({
    queryKey: [`/api/v2/admin/forms/${realFormId}/versions`, rankGroupId],
    queryFn: async () => {
      const query = rankGroupId ? `?rankGroupId=${rankGroupId}` : "";
      const response = await fetch(`/api/v2/admin/forms/${realFormId}/versions${query}`);
      if (!response.ok) throw new Error("Failed to load form versions");
      return response.json();
    },
    enabled: !!realFormId && rankGroupId !== null,
  });

  const { data: roles = [] } = useQuery<RoleRow[]>({
    queryKey: ["/api/v2/admin/access-control/roles", "includeInactive"],
    queryFn: async () => {
      const response = await fetch("/api/v2/admin/access-control/roles?includeInactive=true");
      if (!response.ok) return [];
      return response.json();
    },
  });
  const activeRoles = useMemo(() => selectableRoles(roles), [roles]);
  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["/api/v2/masters/departments"],
    queryFn: async () => {
      const response = await fetch("/api/v2/masters/departments");
      if (!response.ok) return [];
      return response.json();
    },
  });
  const { data: vesselTypes = [] } = useQuery<VesselTypeRow[]>({
    queryKey: ["/api/v2/masters/vessel-types"],
    queryFn: async () => {
      const response = await fetch("/api/v2/masters/vessel-types");
      if (!response.ok) return [];
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
    },
  });

  const availableVersions = useMemo(() => {
    if (!authoritativeVersion) {
      return versions;
    }
    const hasAuthoritativeVersion = versions.some((version) => version.fvUuid === authoritativeVersion.fvUuid);
    if (!hasAuthoritativeVersion) return [authoritativeVersion, ...versions];
    return versions.map((version) => (
      version.fvUuid === authoritativeVersion.fvUuid ? authoritativeVersion : version
    ));
  }, [authoritativeVersion, versions]);
  const sortedVersions = useMemo(
    () => [...availableVersions].sort((a, b) => {
      const numberDiff = Number(b.versionNo) - Number(a.versionNo);
      if (numberDiff !== 0) return numberDiff;
      return a.status === "draft" ? -1 : 1;
    }),
    [availableVersions],
  );
  const selectedVersion = useMemo(
    () => availableVersions.find((version) => version.fvUuid === selectedVersionUuid) ?? sortedVersions[0],
    [availableVersions, selectedVersionUuid, sortedVersions],
  );
  // Navigation includes every part. Only configurable parts have editable
  // trees; fixed parts are rendered as their purpose-built placeholder in
  // both Configure and Preview.
  const selectedPart = allParts.find((part) => part.formPartUuid === selectedPartUuid) ?? configurableParts[0];
  const currentSections = selectedPart?.partType === "configurable"
    ? (trees[selectedPart.formPartUuid] || [])
    : [];
  const previewStructures = useMemo(() => Object.fromEntries(Object.entries(trees).map(([partUuid, sections]) => [
    partUuid,
    sections.map((section) => ({ ...section, effectiveLayout: resolveDraftEffectiveLayout(section) })),
  ])), [trees]);
  const serializedState = JSON.stringify({ trees, optionSets });
  const isDirty = baselineRef.current !== null && baselineRef.current !== serializedState;
  const canEdit = isEditing && (!selectedVersion || selectedVersion.status === "draft");
  const canModify = canEdit && !isSaving;
  const isPreview = viewMode === "preview";

  useEffect(() => {
    if (!selectedPartUuid && configurableParts[0]) {
      setSelectedPartUuid(configurableParts[0].formPartUuid);
    }
  }, [configurableParts, selectedPartUuid]);

  useEffect(() => {
    if (selectedVersionUuid) return;
    if (sortedVersions[0]) {
      setSelectedVersionUuid(sortedVersions[0].fvUuid);
      setIsEditing(sortedVersions[0].status === "draft");
    } else if (!isLoadingVersions && rankGroupId !== null) {
      setIsEditing(true);
    }
  }, [rankGroupId, selectedVersionUuid, sortedVersions, isLoadingVersions]);

  useEffect(() => {
    if (saveTransitionRef.current) return;
    if (!selectedVersion?.fvUuid || configurableParts.length === 0) {
      setTrees({});
      setOptionSets({});
      baselineRef.current = null;
      return;
    }
    if (skipNextTreeLoadVersionRef.current === selectedVersion.fvUuid) {
      skipNextTreeLoadVersionRef.current = null;
      setIsLoadingTree(false);
      return;
    }
    let cancelled = false;
    const loadGeneration = ++treeLoadGenerationRef.current;
    setIsLoadingTree(true);
    setSaveError("");
    Promise.all(configurableParts.map(async (part) => {
      const response = await fetch(
        `/api/v2/admin/form-versions/${selectedVersion.fvUuid}/parts/${part.formPartUuid}/structure`,
      );
      if (!response.ok) throw new Error(`Failed to load ${part.partTitle}`);
      const data = await response.json();
      const normalizedOptionSets = normalizeOptionSets(data);
      return [part.formPartUuid, {
        sections: normalizeTree(data, part.partCode, normalizedOptionSets),
        optionSets: normalizedOptionSets,
      }] as const;
    }))
      .then((entries) => {
        if (cancelled || saveTransitionRef.current || loadGeneration !== treeLoadGenerationRef.current) return;
        const loadedTrees = Object.fromEntries(entries.map(([partUuid, value]) => [partUuid, value.sections]));
        const loadedOptionSets = Object.fromEntries(entries.map(([partUuid, value]) => [partUuid, value.optionSets]));
        setTrees(loadedTrees);
        setOptionSets(loadedOptionSets);
        baselineRef.current = JSON.stringify({ trees: loadedTrees, optionSets: loadedOptionSets });
      })
      .catch((error: Error) => {
        if (!cancelled && !saveTransitionRef.current && loadGeneration === treeLoadGenerationRef.current) {
          const emptyTrees = Object.fromEntries(configurableParts.map((part) => [part.formPartUuid, []]));
          const emptyOptionSets = Object.fromEntries(configurableParts.map((part) => [part.formPartUuid, []]));
          setTrees(emptyTrees);
          setOptionSets(emptyOptionSets);
          baselineRef.current = JSON.stringify({ trees: emptyTrees, optionSets: emptyOptionSets });
          setSaveError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled && loadGeneration === treeLoadGenerationRef.current) setIsLoadingTree(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configurableParts, selectedVersion?.fvUuid]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const section = selectedSection ? trees[selectedSection.partUuid]?.[selectedSection.index] : undefined;
    if (!section) return;
    setSettingsValues({
      vesselTypes: section.applicable_vessel_types,
      responsibleMode: section.responsible_mode,
      responsibleRoleUuid: section.responsible_role_uuid || "",
      responsibleDepartment: section.responsible_department || "",
      commentRequired: section.comment_box_required,
      signatureRequired: section.signature_required,
    });
  }, [selectedSection, trees]);

  const updatePartTree = useCallback((partUuid: string, updater: (sections: SectionModel[]) => SectionModel[]) => {
    if (saveTransitionRef.current) return;
    const part = configurableParts.find((item) => item.formPartUuid === partUuid);
    if (!part) return;
    setTrees((previous) => ({
      ...previous,
      [partUuid]: renumberSections(part.partCode, updater(previous[partUuid] || [])),
    }));
  }, [configurableParts]);

  const updateSection = (partUuid: string, sectionIndex: number, updater: (section: SectionModel) => SectionModel) => {
    updatePartTree(partUuid, (sections) => sections.map((section, index) => index === sectionIndex ? updater(section) : section));
  };

  const updateQuestion = (
    partUuid: string,
    sectionIndex: number,
    questionIndex: number,
    updater: (question: QuestionModel) => QuestionModel,
  ) => {
    updateSection(partUuid, sectionIndex, (section) => ({
      ...section,
      questions: section.questions.map((question, index) => index === questionIndex ? updater(question) : question),
    }));
  };

  const updatePartOptionSets = useCallback((partUuid: string, updater: (sets: OptionSetModel[]) => OptionSetModel[]) => {
    if (saveTransitionRef.current) return;
    setOptionSets((previous) => {
      const nextSets = updater(previous[partUuid] || []);
      return {
        ...previous,
        ...Object.fromEntries(configurableParts.map((part) => [part.formPartUuid, nextSets])),
      };
    });
  }, [configurableParts]);

  const optionSetFor = (partUuid: string, uuid: string | null | undefined): OptionSetModel | undefined =>
    uuid ? (optionSets[partUuid] || []).find((set) => set.option_set_uuid === uuid) : undefined;

  const namedOptionSetsFor = (partUuid: string): OptionSetModel[] =>
    (optionSets[partUuid] || []).filter(isNamedOptionSet);

  const pointSetUuid = (partUuid: string, section: SectionModel, question: QuestionModel): string | null =>
    question.option_set_uuid || section.default_option_set_uuid || null;

  const createCustomSet = (partUuid: string, options: OptionModel[] = [createOption()]) => {
    const uuid = newUuid();
    const set: OptionSetModel = {
      clientKey: clientKey("option-set"),
      option_set_uuid: uuid,
      option_set_name: null,
      low_end_label: null,
      high_end_label: null,
      options: cloneOptions(options, true),
    };
    updatePartOptionSets(partUuid, (sets) => [...sets, set]);
    return set;
  };

  const addSection = (partUuid: string) => {
    updatePartTree(partUuid, (sections) => [...sections, emptySection(
      configurableParts.find((part) => part.formPartUuid === partUuid)?.partCode || "B",
      sections.length,
    )]);
  };

  const addQuestion = (partUuid: string, sectionIndex: number) => {
    updateSection(partUuid, sectionIndex, (section) => ({
      ...section,
      questions: [...section.questions, (() => {
        const inherited = optionSetFor(partUuid, section.default_option_set_uuid);
        const question = emptyQuestion(
          section.section_code,
          section.questions.length,
          inherited?.options || [],
          null,
        );
        return inherited ? { ...question, response_type: "single_select" } : question;
      })()],
    }));
  };

  const addOption = (partUuid: string, sectionIndex: number, questionIndex: number) => {
    updateQuestion(partUuid, sectionIndex, questionIndex, (question) => {
      const currentSet = optionSetFor(partUuid, question.option_set_uuid || trees[partUuid]?.[sectionIndex]?.default_option_set_uuid);
      const nextOption = createOption("New option", question.options);
      if (currentSet && isNamedOptionSet(currentSet) && currentSet.option_set_uuid) {
        updateOptionSet(partUuid, currentSet.option_set_uuid, (set) => ({ ...set, options: [...set.options, nextOption] }));
        return { ...question, options: [...question.options, nextOption] };
      }
      if (currentSet?.option_set_uuid) {
        updatePartOptionSets(partUuid, (sets) => sets.map((set) => set.option_set_uuid === currentSet.option_set_uuid
          ? { ...set, options: [...set.options, nextOption] }
          : set));
        return { ...question, options: [...question.options, nextOption] };
      }
      const customSet = createCustomSet(partUuid, [...question.options, nextOption]);
      return {
        ...question,
        option_set_uuid: customSet.option_set_uuid || null,
        options: customSet.options,
        low_end_label: customSet.low_end_label,
        high_end_label: customSet.high_end_label,
      };
    });
  };

  const changeResponseType = (partUuid: string, sectionIndex: number, questionIndex: number, responseType: string) => {
    const previousQuestion = trees[partUuid]?.[sectionIndex]?.questions[questionIndex];
    const previousSet = optionSetFor(partUuid, previousQuestion?.option_set_uuid);
    updateQuestion(partUuid, sectionIndex, questionIndex, (question) => {
      const isSelect = responseType === "single_select" || responseType === "multi_select";
      if (!isSelect) {
        return { ...question, response_type: responseType, option_set_uuid: null, options: [] };
      }
      const section = trees[partUuid]?.[sectionIndex];
      const inherited = section?.default_option_set_uuid
        ? optionSetFor(partUuid, section.default_option_set_uuid)
        : undefined;
      if (inherited) {
        return {
          ...question,
          response_type: responseType,
          option_set_uuid: null,
          options: cloneOptions(inherited.options),
          low_end_label: inherited.low_end_label,
          high_end_label: inherited.high_end_label,
        };
      }
      const currentOptions = question.options.length > 0 ? question.options : [createOption()];
      const currentSet = optionSetFor(partUuid, question.option_set_uuid);
      if (currentSet) {
        return {
          ...question,
          response_type: responseType,
          options: cloneOptions(currentSet.options),
          low_end_label: currentSet.low_end_label,
          high_end_label: currentSet.high_end_label,
        };
      }
      const customSet = createCustomSet(partUuid, currentOptions);
      return {
        ...question,
        response_type: responseType,
        option_set_uuid: customSet.option_set_uuid || null,
        options: customSet.options,
        low_end_label: customSet.low_end_label,
        high_end_label: customSet.high_end_label,
      };
    });
    if (
      (responseType !== "single_select" && responseType !== "multi_select")
      && previousSet?.option_set_uuid
      && previousSet
      && !isNamedOptionSet(previousSet)
    ) {
      const isStillUsed = (trees[partUuid] || []).some((section, currentSectionIndex) =>
        section.questions.some((question, currentQuestionIndex) =>
          !(currentSectionIndex === sectionIndex && currentQuestionIndex === questionIndex)
          && question.option_set_uuid === previousSet.option_set_uuid,
        ));
      if (!isStillUsed) {
        updatePartOptionSets(partUuid, (sets) => sets.filter((set) => set.option_set_uuid !== previousSet.option_set_uuid));
      }
    }
  };

  const setSectionDefault = (partUuid: string, sectionIndex: number, value: string) => {
    const nextUuid = value === "none" ? null : value;
    const nextSet = optionSetFor(partUuid, nextUuid);
    updateSection(partUuid, sectionIndex, (section) => ({
      ...section,
      default_option_set_uuid: nextUuid,
      questions: section.questions.map((question) => question.option_set_uuid || (
        question.response_type !== "single_select" && question.response_type !== "multi_select"
      )
        ? question
        : {
            ...question,
            options: nextSet ? cloneOptions(nextSet.options) : question.options,
            low_end_label: nextSet?.low_end_label ?? null,
            high_end_label: nextSet?.high_end_label ?? null,
          }),
    }));
  };

  const setQuestionOptionSet = (
    partUuid: string,
    sectionIndex: number,
    questionIndex: number,
    value: string,
  ) => {
    const section = trees[partUuid]?.[sectionIndex];
    const question = section?.questions[questionIndex];
    if (!section || !question) return;
    if (value === "section-default") {
      updateQuestion(partUuid, sectionIndex, questionIndex, (current) => ({
        ...current,
        response_type: current.response_type === "single_select" || current.response_type === "multi_select"
          ? current.response_type
          : "single_select",
        option_set_uuid: null,
        options: cloneOptions(optionSetFor(partUuid, section.default_option_set_uuid)?.options || []),
        low_end_label: optionSetFor(partUuid, section.default_option_set_uuid)?.low_end_label ?? null,
        high_end_label: optionSetFor(partUuid, section.default_option_set_uuid)?.high_end_label ?? null,
      }));
      return;
    }
    if (value === "custom") {
      const currentSet = optionSetFor(partUuid, question.option_set_uuid);
      if (currentSet && !isNamedOptionSet(currentSet)) return;
      const customSet = createCustomSet(partUuid, question.options.length > 0 ? question.options : [createOption()]);
      updateQuestion(partUuid, sectionIndex, questionIndex, (current) => ({
        ...current,
        response_type: current.response_type === "single_select" || current.response_type === "multi_select"
          ? current.response_type
          : "single_select",
        option_set_uuid: customSet.option_set_uuid || null,
        options: cloneOptions(customSet.options),
        low_end_label: customSet.low_end_label,
        high_end_label: customSet.high_end_label,
      }));
      return;
    }
    const selectedSet = optionSetFor(partUuid, value);
    if (!selectedSet) return;
    updateQuestion(partUuid, sectionIndex, questionIndex, (current) => ({
      ...current,
      response_type: current.response_type === "single_select" || current.response_type === "multi_select"
        ? current.response_type
        : "single_select",
      option_set_uuid: value,
      options: cloneOptions(selectedSet.options),
      low_end_label: selectedSet.low_end_label,
      high_end_label: selectedSet.high_end_label,
    }));
  };

  const updateOptionSet = (
    partUuid: string,
    setUuid: string,
    updater: (set: OptionSetModel) => OptionSetModel,
  ) => {
    updatePartOptionSets(partUuid, (sets) => sets.map((set) => set.option_set_uuid === setUuid ? updater(set) : set));
    setTrees((previous) => ({
      ...previous,
      ...Object.fromEntries(Object.entries(previous).map(([treePartUuid, sections]) => [treePartUuid, sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {
          if ((question.option_set_uuid || section.default_option_set_uuid) !== setUuid) return question;
          const set = optionSetFor(partUuid, setUuid);
          const next = set ? updater(set) : undefined;
          return next ? {
            ...question,
            options: cloneOptions(next.options),
            low_end_label: next.low_end_label,
            high_end_label: next.high_end_label,
          } : question;
        }),
      }))])),
    }));
  };

  const addNamedOptionSet = (partUuid: string) => {
    updatePartOptionSets(partUuid, (sets) => [...sets, {
      clientKey: clientKey("option-set"),
      option_set_uuid: newUuid(),
      option_set_name: "New option set",
      low_end_label: null,
      high_end_label: null,
      options: [createOption("Option 1")],
    }]);
  };

  const duplicateOptionSet = (partUuid: string, set: OptionSetModel) => {
    updatePartOptionSets(partUuid, (sets) => [...sets, {
      clientKey: clientKey("option-set"),
      option_set_uuid: newUuid(),
      option_set_name: `${set.option_set_name || "Option set"} (copy)`,
      low_end_label: set.low_end_label,
      high_end_label: set.high_end_label,
      options: cloneOptions(set.options, true),
    }]);
  };

  const optionSetUsage = (_partUuid: string, setUuid: string): string[] =>
    Object.values(trees).flatMap((sections) => sections.flatMap((section) => section.questions
      .filter((question) => (question.option_set_uuid || section.default_option_set_uuid) === setUuid)
      .map((question) => `${question.question_code}${question.question_text.trim() ? ` — ${question.question_text.trim()}` : ""}`)));

  const deleteNamedOptionSet = (partUuid: string, set: OptionSetModel) => {
    const usage = optionSetUsage(partUuid, set.option_set_uuid || "");
    if (usage.length > 0) {
      const message = `Cannot delete "${set.option_set_name}": used by ${usage.join(", ")}.`;
      setSaveError(message);
      toast({ title: "Option set is in use", description: message, variant: "destructive" });
      return;
    }
    const message = "Deleting unused named option sets is not available through the current structure API, so the set was left unchanged.";
    setSaveError(message);
    toast({ title: "Deletion is unavailable", description: message, variant: "destructive" });
  };

  const duplicateSection = (partUuid: string, sectionIndex: number) => {
    updatePartTree(partUuid, (sections) => {
      const source = sections[sectionIndex];
      if (!source) return sections;
      const copy: SectionModel = {
        ...source,
        clientKey: clientKey("section"),
        section_uuid: undefined,
        section_title: `${source.section_title || "Untitled section"} (copy)`,
        effectiveLayout: undefined,
        questions: source.questions.map((question) => ({
          ...question,
          clientKey: clientKey("question"),
          question_uuid: undefined,
          options: cloneOptions(question.options),
        })),
      };
      return [...sections.slice(0, sectionIndex + 1), copy, ...sections.slice(sectionIndex + 1)];
    });
  };

  const applyNumericScale = () => {
    if (!scaleDialog) return;
    const result = buildNumericScaleOptions(
      scaleValues.start,
      scaleValues.end,
      scaleValues.firstLabel,
      scaleValues.lastLabel,
    );
    if (result.error || !result.options) {
      setScaleError(result.error || "Unable to generate this scale.");
      return;
    }
    updateOptionSet(scaleDialog.partUuid, scaleDialog.setUuid, (set) => ({
      ...set,
      options: result.options || [],
      low_end_label: result.lowEndLabel ?? null,
      high_end_label: result.highEndLabel ?? null,
    }));
    setScaleDialog(null);
    setScaleValues({ start: "", end: "", firstLabel: "", lastLabel: "" });
    setScaleError("");
  };

  const moveSection = (partUuid: string, index: number, direction: -1 | 1) => {
    updatePartTree(partUuid, (sections) => {
      const target = index + direction;
      if (target < 0 || target >= sections.length) return sections;
      const next = [...sections];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const moveQuestion = (partUuid: string, sectionIndex: number, index: number, direction: -1 | 1) => {
    updateSection(partUuid, sectionIndex, (section) => {
      const target = index + direction;
      if (target < 0 || target >= section.questions.length) return section;
      const questions = [...section.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...section, questions };
    });
  };

  const moveOption = (partUuid: string, sectionIndex: number, questionIndex: number, index: number, direction: -1 | 1) => {
    updateQuestion(partUuid, sectionIndex, questionIndex, (question) => {
      const target = index + direction;
      if (target < 0 || target >= question.options.length) return question;
      const currentSet = optionSetFor(partUuid, question.option_set_uuid || trees[partUuid]?.[sectionIndex]?.default_option_set_uuid);
      const options = [...question.options];
      [options[index], options[target]] = [options[target], options[index]];
      if (currentSet?.option_set_uuid) {
        updateOptionSet(partUuid, currentSet.option_set_uuid, (set) => ({ ...set, options }));
      }
      return { ...question, options };
    });
  };

  const requestDelete = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDelete({ title, description, onConfirm });
  };

  const createDraft = async (): Promise<VersionRow> => {
    if (selectedVersion?.status === "draft") return selectedVersion;
    const existingDraft = availableVersions.find((version) => version.status === "draft");
    if (existingDraft) return existingDraft;
    if (draftCreationRef.current) return draftCreationRef.current;
    const maxVersion = versions.reduce((max, version) => Math.max(max, Number(version.versionNo) || 0), 0);
    const sourceConfiguration = selectedVersion?.configuration
      || (typeof rankGroupConfig === "string" ? rankGroupConfig : JSON.stringify(rankGroupConfig || {}));
    draftCreationRef.current = (async () => {
      const response = await apiRequest("POST", `/api/v2/admin/forms/${realFormId}/versions`, {
        versionNo: String(maxVersion + 1).padStart(2, "0"),
        versionDate: formatVersionDate(),
        status: "draft",
        rankGroupId,
        configuration: sourceConfiguration,
        auditUserUuid: getCrewUserId(),
      });
      return response.json() as Promise<VersionRow>;
    })();
    try {
      return await draftCreationRef.current;
    } finally {
      draftCreationRef.current = null;
    }
  };

  const validateTrees = (): string | null => {
    for (const part of configurableParts) {
      const namedSets = namedOptionSetsFor(part.formPartUuid);
      if (namedSets.some((set) => !set.option_set_name?.trim())) return "Named option sets need a name";
      if (namedSets.some((set) => set.options.length === 0)) return "Named option sets need at least one option";
      if (namedSets.some((set) => set.options.some((option) => !option.option_label.trim()))) {
        return "Named option-set option labels cannot be empty";
      }
      for (const section of trees[part.formPartUuid] || []) {
        if (!section.section_title.trim()) return `${section.section_code}: section title is required`;
        if (section.responsible_mode === "role" && !section.responsible_role_uuid) {
          return `${section.section_code}: select a responsible role`;
        }
        if (section.responsible_mode === "department" && !section.responsible_department) {
          return `${section.section_code}: select a responsible department`;
        }
        for (const question of section.questions) {
          if (!question.question_text.trim()) return `${question.question_code}: point text is required`;
          if ((question.response_type === "single_select" || question.response_type === "multi_select") && question.options.length === 0) {
            return `${question.question_code}: add at least one option`;
          }
          if (question.option_set_uuid && !optionSetFor(part.formPartUuid, question.option_set_uuid)) {
            return `${question.question_code}: selected option set is unavailable`;
          }
          if (question.options.some((option) => !option.option_label.trim())) {
            return `${question.question_code}: option labels cannot be empty`;
          }
        }
      }
    }
    return null;
  };

  const save = async (): Promise<VersionRow | null> => {
    if (!canEdit || saveTransitionRef.current) return null;
    const validationError = validateTrees();
    if (validationError) {
      setSaveError(validationError);
      toast({ title: "Check the highlighted entry", description: validationError, variant: "destructive" });
      return null;
    }
    setIsSaving(true);
    setSaveError("");
    saveTransitionRef.current = true;
    treeLoadGenerationRef.current += 1;
    const startedAt = performance.now();
    try {
      const treesAtSave = trees;
      const optionSetsAtSave = optionSets;
      const draft = await createDraft();
      const response = await apiRequest(
        "PUT",
        `/api/v2/admin/form-versions/${draft.fvUuid}/structures`,
        {
          parts: configurableParts.map((part) => ({
            form_part_uuid: part.formPartUuid,
            structure: toPayload(
              treesAtSave[part.formPartUuid] || [],
              optionSetsAtSave[part.formPartUuid] || [],
            ),
          })),
          auditUserUuid: getCrewUserId(),
        },
      );
      if (!response.ok) throw new Error("Form structure save failed");
      const savedResponse = await response.json() as SavedStructuresResponse;
      if (savedResponse.form_version_uuid !== draft.fvUuid || !Array.isArray(savedResponse.parts)) {
        throw new Error("Form structure save returned an invalid response");
      }
      const savedEntries = configurableParts.map((part) => {
        const savedPart = savedResponse.parts.find((item) => item.form_part_uuid === part.formPartUuid);
        if (!savedPart) throw new Error(`Form structure save omitted ${part.partTitle}`);
        const savedOptionSets = normalizeOptionSets(savedPart);
        return [part.formPartUuid, {
          sections: normalizeTree(savedPart, part.partCode, savedOptionSets),
          optionSets: savedOptionSets,
        }] as const;
      });
      const savedTrees = Object.fromEntries(savedEntries.map(([partUuid, value]) => [partUuid, value.sections]));
      const savedOptionSets = Object.fromEntries(savedEntries.map(([partUuid, value]) => [partUuid, value.optionSets]));
      if (selectedVersion?.fvUuid !== draft.fvUuid) {
        skipNextTreeLoadVersionRef.current = draft.fvUuid;
      }
      setAuthoritativeVersion(draft);
      setSelectedVersionUuid(draft.fvUuid);
      setIsEditing(true);
      setTrees(savedTrees);
      setOptionSets(savedOptionSets);
      baselineRef.current = JSON.stringify({ trees: savedTrees, optionSets: savedOptionSets });
      saveTransitionRef.current = false;
      onSave({
        formId: realFormId,
        formVersionUuid: draft.fvUuid,
        savedParts: configurableParts.length,
        durationMs: Math.round(performance.now() - startedAt),
      });
      toast({ title: "Draft saved", description: "The complete form structure has been saved." });
      await refetchVersions();
      return draft;
    } catch (error: any) {
      const message = error?.message || "Failed to save form structure";
      setSaveError(message);
      toast({ title: "Unable to save form", description: message, variant: "destructive" });
      return null;
    } finally {
      saveTransitionRef.current = false;
      setIsSaving(false);
    }
  };

  const releaseSelectedVersion = async () => {
    const versionToRelease = selectedVersion;
    if (
      isReleasing
      || isSaving
      || !versionToRelease?.id
      || versionToRelease.status !== "draft"
    ) {
      return;
    }

    setIsReleasing(true);
    setSaveError("");
    try {
      const draft = isDirty ? await save() : versionToRelease;
      if (!draft) return;

      const response = await apiRequest(
        "POST",
        `/api/v2/admin/form-versions/${draft.id}/release`,
      );
      const releasedVersion = await response.json() as VersionRow;
      const released = {
        ...draft,
        ...releasedVersion,
        status: "released",
      };
      setAuthoritativeVersion(released);
      setSelectedVersionUuid(released.fvUuid);
      setIsEditing(false);
      await refetchVersions();
      toast({
        title: "Version released",
        description: "The version has been released successfully.",
      });
    } catch (error: any) {
      const message = error?.message || "Failed to release form version";
      setSaveError(message);
      toast({ title: "Unable to release form", description: message, variant: "destructive" });
    } finally {
      setIsReleasing(false);
    }
  };

  const requestRelease = () => {
    if (
      isReleasing
      || isSaving
      || !selectedVersion?.id
      || selectedVersion.status !== "draft"
    ) {
      return;
    }
    setReleaseConfirmOpen(true);
  };

  const handleClose = () => {
    if (isDirty) {
      setPendingVersionUuid(null);
      setShowLeaveDialog(true);
    } else {
      onClose();
    }
  };
  focusLifecycleRef.current = {
    isPreview,
    settingsDialog,
    confirmDelete,
    showLeaveDialog,
    releaseConfirmOpen,
    handleClose,
  };

  const applyVersionChange = (versionUuid: string) => {
    setSelectedVersionUuid(versionUuid);
    const version = availableVersions.find((item) => item.fvUuid === versionUuid);
    setIsEditing(version?.status === "draft");
  };

  const requestVersionChange = (versionUuid: string) => {
    if (shouldConfirmVersionChange(isDirty, selectedVersion?.fvUuid || "", versionUuid)) {
      setPendingVersionUuid(versionUuid);
      setShowLeaveDialog(true);
      return;
    }
    applyVersionChange(versionUuid);
  };

  const startEditing = async () => {
    try {
      const draft = await createDraft();
      setAuthoritativeVersion(draft);
      setSelectedVersionUuid(draft.fvUuid);
      setIsEditing(true);
      await refetchVersions();
      toast({ title: "Draft ready", description: "You can now edit this form version." });
    } catch (error: any) {
      toast({ title: "Unable to create draft", description: error?.message || "Please try again.", variant: "destructive" });
    }
  };

  const openSettings = (partUuid: string, index: number, dialog: typeof settingsDialog) => {
    setSelectedSection({ partUuid, index });
    setSettingsDialog(dialog);
  };

  const saveSettings = () => {
    if (!selectedSection) return;
    const { partUuid, index } = selectedSection;
    if (settingsDialog === "vessel") {
      updateSection(partUuid, index, (section) => ({ ...section, applicable_vessel_types: settingsValues.vesselTypes }));
    } else if (settingsDialog === "responsible") {
      updateSection(partUuid, index, (section) => ({
        ...section,
        responsible_mode: settingsValues.responsibleMode,
        responsible_role_uuid: settingsValues.responsibleMode === "role" ? settingsValues.responsibleRoleUuid || null : null,
        responsible_department: settingsValues.responsibleMode === "department" ? settingsValues.responsibleDepartment || null : null,
      }));
    } else if (settingsDialog === "comment") {
      updateSection(partUuid, index, (section) => ({ ...section, comment_box_required: settingsValues.commentRequired }));
    } else if (settingsDialog === "signature") {
      updateSection(partUuid, index, (section) => ({ ...section, signature_required: settingsValues.signatureRequired }));
    }
    setSettingsDialog(null);
  };

  const sectionForSettings = selectedSection ? trees[selectedSection.partUuid]?.[selectedSection.index] : undefined;
  const vesselLabel = (uuid: string) => {
    const type = vesselTypes.find((item) => (item.vtUuid || item.vtuid) === uuid);
    return type?.name || type?.vesselType || type?.label || uuid;
  };

  const toggleViewMode = () => {
    if (editorContentRef.current) {
      editorScrollTopRef.current = captureViewScrollPosition(
        editorScrollTopRef.current,
        viewMode,
        editorContentRef.current.scrollTop,
      );
    }
    setViewMode((current) => current === "configure" ? "preview" : "configure");
  };

  useLayoutEffect(() => {
    const element = editorContentRef.current;
    if (!element) return;
    element.scrollTop = editorScrollTopRef.current[viewMode];
  }, [viewMode]);

  const closePreview = useCallback(() => {
    setViewMode("configure");
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const hadInert = appRoot?.hasAttribute("inert") ?? false;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden") ?? null;

    document.body.style.overflow = "hidden";
    appRoot?.setAttribute("inert", "");
    appRoot?.setAttribute("aria-hidden", "true");

    return () => {
      document.body.style.overflow = previousOverflow;
      if (!appRoot) return;
      if (hadInert) appRoot.setAttribute("inert", "");
      else appRoot.removeAttribute("inert");
      if (previousAriaHidden === null) appRoot.removeAttribute("aria-hidden");
      else appRoot.setAttribute("aria-hidden", previousAriaHidden);
    };
  }, []);

  useEffect(() => {
    const focusEditor = () => {
      const lifecycle = focusLifecycleRef.current;
      if (lifecycle.settingsDialog || lifecycle.confirmDelete || lifecycle.showLeaveDialog || lifecycle.releaseConfirmOpen) return;
      const editor = editorDialogRef.current;
      if (!editor) return;
      const [firstFocusable] = getFocusableElements(editor);
      (firstFocusable || editor).focus();
    };
    const focusTimer = window.setTimeout(focusEditor, 0);
    const handleConfigureKeys = (event: KeyboardEvent) => {
      const lifecycle = focusLifecycleRef.current;
      if (lifecycle.settingsDialog || lifecycle.confirmDelete || lifecycle.showLeaveDialog || lifecycle.releaseConfirmOpen) return;
      const editor = editorDialogRef.current;
      if (!editor) return;
      if (hasOpenPortalledListbox()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (lifecycle.isPreview) closePreview();
        else lifecycle.handleClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(editor);
      if (focusable.length === 0) {
        event.preventDefault();
        editor.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (!editor.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleConfigureKeys, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleConfigureKeys, true);
    };
  }, [closePreview, isPreview]);

  const editorHeader = (
    <div className="sticky top-0 bg-white border-b px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold leading-none tracking-tight text-[#16569e]">{formName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rankGroupName || "All rank groups"} · configure the form structure and response points
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center rounded-md border bg-white p-0.5" role="group" aria-label="Form editor view">
            <Button type="button" variant={viewMode === "configure" ? "default" : "ghost"} size="sm" className="h-8 px-3 text-xs" onClick={viewMode === "preview" ? toggleViewMode : undefined} aria-pressed={viewMode === "configure"} data-testid="button-configure-mode">
              Configure
            </Button>
            <Button type="button" variant={viewMode === "preview" ? "default" : "ghost"} size="sm" className="h-8 px-3 text-xs" onClick={viewMode === "configure" ? toggleViewMode : undefined} aria-pressed={viewMode === "preview"} data-testid="button-preview-mode">
              Preview
            </Button>
          </div>
          <span className="text-gray-500">Version</span>
          <Select value={selectedVersion?.fvUuid || ""} onValueChange={requestVersionChange}>
            <SelectTrigger className="w-[180px] h-9 bg-white" data-testid="select-form-version">
              <SelectValue placeholder={isLoadingVersions ? "Loading..." : "No version"} />
            </SelectTrigger>
            <SelectContent>
              {sortedVersions.map((version) => (
                <SelectItem value={version.fvUuid} key={version.fvUuid}>
                  v{version.versionNo} · {version.status === "draft" ? "Draft" : "Released"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVersion && <Badge variant={selectedVersion.status === "draft" ? "secondary" : "outline"}>{selectedVersion.status === "draft" ? "Draft" : "Released"}</Badge>}
          <Button type="button" variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  const editorFooter = (
    <div className="border-t bg-[#f8fafc] px-6 py-3 flex items-center justify-between">
      <Button variant="ghost" onClick={handleClose} data-testid="button-close-generic-editor"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
      <div className="text-xs text-gray-500">{isDirty ? "Unsaved changes" : "All changes saved"} · option values stay hidden and stable after creation</div>
    </div>
  );
  const tableClasses = getTableClasses();

  return (
    <>
      {typeof document !== "undefined" && createPortal(
        <SharedFormShell
          title={`${formName} form editor`}
          sections={allParts.map((part) => ({
            id: part.formPartUuid,
            title: part.partTitle || `Part ${part.partCode}`,
            letter: part.partCode,
          }))}
          activeSection={selectedPart?.formPartUuid || selectedPartUuid}
          onActiveSectionChange={setSelectedPartUuid}
          onClose={handleClose}
          header={editorHeader}
          footer={editorFooter}
          dialogRef={editorDialogRef}
          contentRef={(node) => { editorContentRef.current = node; }}
          testId="generic-form-editor"
        >
          <div className="min-w-0 space-y-5">
            {isPreview ? (
              <ConfiguredFormRenderer
                mode="preview"
                embedded
                formTitle={formName}
                parts={allParts}
                structures={previewStructures}
                roles={roles}
                departments={departments}
                vesselTypes={vesselTypes}
                selectedPartUuid={selectedPart?.formPartUuid || selectedPartUuid}
                selectedVesselTypeUuid={previewVesselTypeUuid}
                onSelectedVesselTypeUuidChange={setPreviewVesselTypeUuid}
              />
            ) : (
               <>
                 <div className="sticky top-0 z-10 border-b bg-white/95 px-6 py-4 backdrop-blur">
                   <div className="flex flex-wrap items-start justify-between gap-3">
                     <div className="min-w-0 flex-1">
                       <div className="text-xl font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>
                         {selectedPart?.partCode} · {selectedPart?.partTitle}
                       </div>
                       <div className="mt-1 text-sm" style={{ color: sailDesignSystem.colors.textSecondary }}>
                         {currentSections.length} section{currentSections.length === 1 ? "" : "s"} ·
                         {" "}{currentSections.reduce((sum, section) => sum + section.questions.length, 0)} points
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                   <Button
                     onClick={requestRelease}
                     className="bg-green-600 hover:bg-green-700 text-white"
                     size="sm"
                     disabled={!selectedVersion || selectedVersion.status !== "draft" || isSaving || isReleasing}
                     data-testid="button-release-version"
                   >
                     Release Ver
                   </Button>
                   {viewMode === "configure" && !canEdit && (
                    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="released-read-only-message">
                      <AlertCircle className="h-4 w-4" />
                      Released versions are read-only. Create a new draft to make changes.
                    </div>
                  )}
                   {viewMode === "configure" && !canEdit && (
                    <Button onClick={startEditing} data-testid="button-edit-as-new-draft">
                      <Plus className="h-4 w-4 mr-2" /> Edit as new draft
                    </Button>
                  )}
                   {viewMode === "configure" && canEdit && (
                    <Button onClick={save} disabled={isSaving || isLoadingTree} className="bg-[#16569e] hover:bg-[#0f4078]" data-testid="button-save-form-structure">
                      <Save className="h-4 w-4 mr-2" /> {isSaving ? "Saving..." : "Save"}
                    </Button>
                  )}
                     </div>
                   </div>
                   <div className="mt-3 h-0.5 w-full" style={{ backgroundColor: sailDesignSystem.colors.headerText }} />
                 </div>

              {saveError && (
                <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2" data-testid="text-form-save-error">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

                <div>
                 {isLoadingTree ? (
                   <div className="p-10 text-center text-sm text-gray-500">Loading form structure…</div>
                 ) : (
                   <div className="p-6 space-y-5">
                   {selectedPart?.partType === "configurable" && (
                     <Card className="border-[#b7cce4] bg-[#f8fbff]" data-testid="option-set-builder">
                       <CardContent className="p-5">
                         <div className="flex flex-wrap items-center justify-between gap-3">
                           <div>
                             <h3 className="font-semibold text-[#173f70]">Named option sets</h3>
                             <p className="mt-1 text-xs text-gray-600">Reusable choices for this version. Option values stay stable when labels change.</p>
                           </div>
                           {canModify && <Button size="sm" onClick={() => addNamedOptionSet(selectedPart.formPartUuid)} data-testid="button-add-option-set"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add named set</Button>}
                         </div>
                         {namedOptionSetsFor(selectedPart.formPartUuid).length === 0 ? (
                           <div className="mt-4 rounded border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">No named option sets yet.</div>
                         ) : (
                           <div className="mt-4 space-y-3">
                             {namedOptionSetsFor(selectedPart.formPartUuid).map((set) => {
                               const usage = optionSetUsage(selectedPart.formPartUuid, set.option_set_uuid || "");
                               return (
                                 <div key={set.clientKey} className="rounded-md border bg-white p-4" data-testid={`card-option-set-${set.option_set_uuid}`}>
                                   <div className="flex flex-wrap items-center gap-2">
                                     <Input
                                       value={set.option_set_name || ""}
                                       disabled={!canModify}
                                       onChange={(event) => updateOptionSet(selectedPart.formPartUuid, set.option_set_uuid || "", (current) => ({ ...current, option_set_name: event.target.value }))}
                                       className="h-8 max-w-sm font-medium"
                                       aria-label="Option set name"
                                     />
                                     <Badge variant="outline" className="text-[10px]">{usage.length} point{usage.length === 1 ? "" : "s"} use this set</Badge>
                                     <div className="ml-auto flex items-center gap-1">
                                       {canModify && <Button variant="ghost" size="sm" onClick={() => duplicateOptionSet(selectedPart.formPartUuid, set)}><Copy className="mr-1 h-3.5 w-3.5" /> Duplicate</Button>}
                                       {canModify && <Button variant="ghost" size="sm" className="text-red-600" onClick={() => deleteNamedOptionSet(selectedPart.formPartUuid, set)}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>}
                                     </div>
                                   </div>
                                   <div className="mt-3 space-y-2">
                                     {set.options.map((option, optionIndex) => (
                                       <div className="flex items-center gap-2" key={option.clientKey}>
                                         <span className="w-5 text-center text-xs text-gray-400">{optionIndex + 1}</span>
                                         <Input
                                           value={option.option_label}
                                           disabled={!canModify}
                                           onChange={(event) => updateOptionSet(selectedPart.formPartUuid, set.option_set_uuid || "", (current) => ({
                                             ...current,
                                             options: current.options.map((item, index) => index === optionIndex ? { ...item, option_label: event.target.value } : item),
                                           }))}
                                           className="h-8 text-sm"
                                           placeholder="Option label"
                                           aria-label={`Option ${optionIndex + 1} label`}
                                         />
                                         <span className="min-w-[88px] text-right font-mono text-[10px] text-gray-400" title="Stored value">value: {option.option_value}</span>
                                         {canModify && <>
                                           <Button variant="ghost" size="icon" className="h-8 w-8" disabled={optionIndex === 0} onClick={() => updateOptionSet(selectedPart.formPartUuid, set.option_set_uuid || "", (current) => {
                                             const options = [...current.options]; [options[optionIndex], options[optionIndex - 1]] = [options[optionIndex - 1], options[optionIndex]]; return { ...current, options };
                                           })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                           <Button variant="ghost" size="icon" className="h-8 w-8" disabled={optionIndex === set.options.length - 1} onClick={() => updateOptionSet(selectedPart.formPartUuid, set.option_set_uuid || "", (current) => {
                                             const options = [...current.options]; [options[optionIndex], options[optionIndex + 1]] = [options[optionIndex + 1], options[optionIndex]]; return { ...current, options };
                                           })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                           <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => updateOptionSet(selectedPart.formPartUuid, set.option_set_uuid || "", (current) => ({ ...current, options: current.options.filter((_, index) => index !== optionIndex) }))}><X className="h-3.5 w-3.5" /></Button>
                                         </>}
                                       </div>
                                     ))}
                                   </div>
                                   {canModify && <div className="mt-3 flex flex-wrap gap-2">
                                     <Button variant="outline" size="sm" onClick={() => updateOptionSet(selectedPart.formPartUuid, set.option_set_uuid || "", (current) => ({ ...current, options: [...current.options, createOption("New option", current.options)] }))}><Plus className="mr-1 h-3.5 w-3.5" /> Add option</Button>
                                     <Button variant="outline" size="sm" onClick={() => { setScaleDialog({ partUuid: selectedPart.formPartUuid, setUuid: set.option_set_uuid || "" }); setScaleError(""); }} data-testid={`button-generate-numeric-scale-${set.option_set_uuid}`}>Generate numeric scale</Button>
                                   </div>}
                                 </div>
                               );
                             })}
                           </div>
                         )}
                       </CardContent>
                     </Card>
                   )}
                  {selectedPart?.partType === "fixed" ? (
                    <ConfiguredFormRenderer
                      mode="preview"
                      embedded
                      formTitle={formName}
                      parts={allParts}
                      structures={previewStructures}
                      roles={roles}
                      departments={departments}
                      vesselTypes={vesselTypes}
                      selectedPartUuid={selectedPart.formPartUuid}
                      selectedVesselTypeUuid={previewVesselTypeUuid}
                      onSelectedVesselTypeUuidChange={setPreviewVesselTypeUuid}
                    />
                  ) : (
                  <>
                  {currentSections.map((section, sectionIndex) => (
                     <Card key={section.clientKey} className="bg-white shadow-md" data-testid={`card-section-${sectionIndex + 1}`}>
                       <CardContent className="p-6">
                         <div className="pb-4 mb-6">
                           <div className="flex items-start justify-between gap-3">
                             <div className="min-w-0 flex-1">
                               <div className="flex items-center gap-2">
                                 <span className="shrink-0 text-xl font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>{section.section_code}</span>
                                 <Input
                                   value={section.section_title}
                                   disabled={!canModify}
                                   onChange={(event) => updateSection(selectedPart.formPartUuid, sectionIndex, (value) => ({ ...value, section_title: event.target.value }))}
                                   placeholder="Section title"
                                   className={`h-9 border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0 ${!section.section_title.trim() && canModify ? "border-b border-red-300" : ""}`}
                                   data-testid={`input-section-title-${sectionIndex + 1}`}
                                 />
                               </div>
                               {!section.section_title.trim() && canModify && <p className="mt-1 text-[11px] text-red-600">Section title is required.</p>}
                               <div className="mt-2 flex flex-wrap gap-1.5">
                                 <Badge variant="outline" className="text-[10px] font-normal">
                                   {section.applicable_vessel_types.length === 0 ? "All vessel types" : `${section.applicable_vessel_types.length} vessel type(s)`}
                                 </Badge>
                                 {section.responsible_mode === "role" ? (() => {
                                   const summary = roleSummary(roles, section.responsible_role_uuid);
                                   const statusClassName = summary.status === "missing"
                                     ? "border-red-300 bg-red-50 text-red-700"
                                     : "border-amber-300 bg-amber-50 text-amber-800";
                                   const statusLabel = summary.status === "inactive"
                                     ? "Inactive role"
                                     : summary.status === "deleted"
                                       ? "Deleted role"
                                       : "Role not found";
                                   return (
                                     <>
                                       <Badge variant="outline" className="text-[10px] font-normal">{`Role: ${summary.title}`}</Badge>
                                       {summary.status && (
                                         <Badge variant="outline" className={`text-[10px] font-medium ${statusClassName}`} data-testid={`badge-responsible-role-status-${sectionIndex + 1}`}>
                                           <AlertCircle className="mr-1 h-3 w-3" />{statusLabel}
                                         </Badge>
                                       )}
                                     </>
                                   );
                                 })() : (
                                   <Badge variant="outline" className="text-[10px] font-normal">
                                     {section.responsible_mode === "department" ? `Dept: ${section.responsible_department || "Not set"}` : "No responsible party"}
                                   </Badge>
                                 )}
                                 {section.comment_box_required && <Badge variant="outline" className="text-[10px] font-normal">Comment required</Badge>}
                                 {section.signature_required && <Badge variant="outline" className="text-[10px] font-normal">Signature required</Badge>}
                                  {section.default_option_set_uuid && <Badge variant="outline" className="text-[10px] font-normal">Default: {optionSetFor(selectedPart.formPartUuid, section.default_option_set_uuid)?.option_set_name || "Custom set"}</Badge>}
                                  <Badge variant="outline" className="text-[10px] font-normal">Layout: {section.layout_preference}</Badge>
                               </div>
                             </div>
                             {canModify && (
                               <div className="flex items-center gap-1">
                                 <Button variant="ghost" size="icon" className="h-8 w-8" disabled={sectionIndex === 0} onClick={() => moveSection(selectedPart.formPartUuid, sectionIndex, -1)} data-testid={`button-move-section-up-${sectionIndex + 1}`}><ArrowUp className="h-4 w-4" /></Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8" disabled={sectionIndex === currentSections.length - 1} onClick={() => moveSection(selectedPart.formPartUuid, sectionIndex, 1)} data-testid={`button-move-section-down-${sectionIndex + 1}`}><ArrowDown className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateSection(selectedPart.formPartUuid, sectionIndex)} aria-label="Duplicate section" data-testid={`button-duplicate-section-${sectionIndex + 1}`}><Copy className="h-4 w-4" /></Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => requestDelete("Delete section?", "This will also remove all points in the section.", () => updatePartTree(selectedPart.formPartUuid, (sections) => sections.filter((_, index) => index !== sectionIndex)))} data-testid={`button-delete-section-${sectionIndex + 1}`}><Trash2 className="h-4 w-4" /></Button>
                               </div>
                             )}
                           </div>
                           {canModify && (
                             <div className="mt-4 flex flex-wrap gap-2">
                               <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "vessel")} data-testid={`button-section-vessel-settings-${sectionIndex + 1}`}><Settings2 className="h-3.5 w-3.5 mr-1.5" /> Vessel types</Button>
                               <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "responsible")} data-testid={`button-section-responsible-settings-${sectionIndex + 1}`}>Responsible party</Button>
                               <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "comment")} data-testid={`button-section-comment-settings-${sectionIndex + 1}`}>Comment box</Button>
                               <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "signature")} data-testid={`button-section-signature-settings-${sectionIndex + 1}`}>Signature</Button>
                                <div className="flex items-center gap-2 rounded-md border bg-white px-2 py-1">
                                  <span className="text-xs text-gray-600">Default set</span>
                                  <Select value={section.default_option_set_uuid || "none"} onValueChange={(value) => setSectionDefault(selectedPart.formPartUuid, sectionIndex, value)}>
                                    <SelectTrigger className="h-7 w-[175px] text-xs" data-testid={`select-section-default-set-${sectionIndex + 1}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No default</SelectItem>
                                      {namedOptionSetsFor(selectedPart.formPartUuid).map((set) => <SelectItem key={set.option_set_uuid} value={set.option_set_uuid || ""}>{set.option_set_name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2 rounded-md border bg-white px-2 py-1">
                                  <span className="text-xs text-gray-600">Layout</span>
                                  <Select value={section.layout_preference} onValueChange={(value: "auto" | "list" | "matrix") => updateSection(selectedPart.formPartUuid, sectionIndex, (current) => ({ ...current, layout_preference: value }))}>
                                    <SelectTrigger className="h-7 w-[105px] text-xs" data-testid={`select-section-layout-${sectionIndex + 1}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="auto">Auto</SelectItem>
                                      <SelectItem value="list">List</SelectItem>
                                      <SelectItem value="matrix">Matrix</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-2 rounded-md border bg-white px-2 py-1">
                                  <Select value={bulkResponseTypes[section.clientKey] || "single_select"} onValueChange={(value) => setBulkResponseTypes((current) => ({ ...current, [section.clientKey]: value }))}>
                                    <SelectTrigger className="h-7 w-[155px] text-xs" data-testid={`select-bulk-response-type-${sectionIndex + 1}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>{RESPONSE_TYPES.map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <Button variant="ghost" size="sm" onClick={() => {
                                    const type = bulkResponseTypes[section.clientKey] || "single_select";
                                    requestDelete(
                                      "Change response type for all points?",
                                      `${section.questions.length} point${section.questions.length === 1 ? "" : "s"} will change to ${responseLabel(type)}.`,
                                      () => section.questions.forEach((_, questionIndex) => changeResponseType(selectedPart.formPartUuid, sectionIndex, questionIndex, type)),
                                    );
                                  }} disabled={section.questions.length === 0}>Apply to all</Button>
                                </div>
                             </div>
                           )}
                             {section.layout_preference !== "list" && resolveDraftEffectiveLayout(section) === "list" && (
                              <p className="mt-3 text-xs text-amber-700" data-testid={`text-auto-layout-reason-${sectionIndex + 1}`}>
                                 {section.layout_preference === "auto" ? "Auto resolved to list" : "Matrix falls back to list"} because {matrixIneligibilityReason(section) || "the section is not eligible for a matrix"}.
                              </p>
                            )}
                           <div className="mt-4 h-0.5 w-full" style={{ backgroundColor: sailDesignSystem.colors.headerText }} />
                         </div>
                         {section.questions.length > 0 ? (
                           <FormTable headers={["Point", "Response type / options", "Flags", "Actions"]}>
                             {section.questions.map((question, questionIndex) => (
                               <tr key={question.clientKey} className={tableClasses.row} data-testid={`card-point-${sectionIndex + 1}-${questionIndex + 1}`}>
                                 <td className={`${tableClasses.cell} align-top`}>
                                   <div className="mb-1 text-xs font-semibold" style={{ color: sailDesignSystem.colors.headerText }}>{question.question_code}</div>
                                   <Textarea
                                     value={question.question_text}
                                     disabled={!canModify}
                                     onChange={(event) => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, question_text: event.target.value }))}
                                     onKeyDown={(event) => {
                                       if (event.key === "Enter" && !event.shiftKey && canModify) {
                                         event.preventDefault();
                                         addQuestion(selectedPart.formPartUuid, sectionIndex);
                                       }
                                     }}
                                     placeholder="Enter point text, then press Enter for the next point"
                                     className={`min-h-[42px] resize-y border-0 bg-transparent px-0 text-sm font-semibold text-[#4f5863] shadow-none focus-visible:ring-0 ${!question.question_text.trim() && canModify ? "border-b border-red-300" : ""}`}
                                     data-testid={`textarea-point-text-${sectionIndex + 1}-${questionIndex + 1}`}
                                   />
                                   {!question.question_text.trim() && canModify && <p className="text-[11px] text-red-600">Point text is required.</p>}
                                 </td>
                                 <td className={`${tableClasses.cell} align-top`}>
                                   <Select value={question.response_type} disabled={!canModify} onValueChange={(value) => changeResponseType(selectedPart.formPartUuid, sectionIndex, questionIndex, value)}>
                                     <SelectTrigger className="h-9 w-full min-w-[160px]" data-testid={`select-response-type-${sectionIndex + 1}-${questionIndex + 1}`}><SelectValue /></SelectTrigger>
                                     <SelectContent>{RESPONSE_TYPES.map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent>
                                   </Select>
                                    <div className="mt-2 text-[11px] text-gray-500">Single Selection allows one answer, Multi Selection allows several.</div>
                                   {(question.response_type === "single_select" || question.response_type === "multi_select") && (
                                      <div className="mt-3 space-y-2 border-t pt-3" data-testid={`option-editor-${sectionIndex + 1}-${questionIndex + 1}`}>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-xs font-semibold text-gray-700">Option source</span>
                                          <Select
                                            value={question.option_set_uuid
                                              ? (isNamedOptionSet(optionSetFor(selectedPart.formPartUuid, question.option_set_uuid) || { option_set_name: null }) ? question.option_set_uuid : "custom")
                                              : (section.default_option_set_uuid ? "section-default" : "custom")}
                                            disabled={!canModify}
                                            onValueChange={(value) => setQuestionOptionSet(selectedPart.formPartUuid, sectionIndex, questionIndex, value)}
                                          >
                                            <SelectTrigger className="h-8 min-w-[180px] flex-1 text-xs" data-testid={`select-point-option-set-${sectionIndex + 1}-${questionIndex + 1}`}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              {section.default_option_set_uuid && <SelectItem value="section-default">Section default — {optionSetFor(selectedPart.formPartUuid, section.default_option_set_uuid)?.option_set_name || "set"}</SelectItem>}
                                              {namedOptionSetsFor(selectedPart.formPartUuid).map((set) => <SelectItem value={set.option_set_uuid || ""} key={set.option_set_uuid}>{set.option_set_name}</SelectItem>)}
                                              <SelectItem value="custom">Custom options for this point</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="text-[11px] text-[#16569e]">
                                          Using: {optionSetFor(selectedPart.formPartUuid, pointSetUuid(selectedPart.formPartUuid, section, question))?.option_set_name || "Custom options"}
                                        </div>
                                       <div className="flex items-center justify-between gap-2">
                                         <div className="text-xs font-semibold text-gray-700">Options</div>
                                         {canModify && <Button variant="outline" size="sm" onClick={() => addOption(selectedPart.formPartUuid, sectionIndex, questionIndex)} data-testid={`button-add-option-${sectionIndex + 1}-${questionIndex + 1}`}><Plus className="h-3.5 w-3.5 mr-1" /> Add option</Button>}
                                       </div>
                                       {question.options.map((option, optionIndex) => (
                                         <div className="flex items-center gap-2" key={option.clientKey}>
                                           <span className="w-5 text-center text-xs text-gray-400">{optionIndex + 1}</span>
                                           <Input
                                             value={option.option_label}
                                             disabled={!canModify}
                                              onChange={(event) => {
                                                const activeSet = optionSetFor(selectedPart.formPartUuid, question.option_set_uuid || section.default_option_set_uuid);
                                                if (activeSet?.option_set_uuid) {
                                                  updateOptionSet(selectedPart.formPartUuid, activeSet.option_set_uuid, (value) => ({
                                                    ...value,
                                                    options: value.options.map((item, index) => index === optionIndex ? { ...item, option_label: event.target.value } : item),
                                                  }));
                                                } else {
                                                  updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({
                                                    ...value,
                                                    options: value.options.map((item, index) => index === optionIndex ? { ...item, option_label: event.target.value } : item),
                                                  }));
                                                }
                                              }}
                                             className="h-8 bg-white text-sm"
                                             placeholder="Option label"
                                             data-testid={`input-option-label-${sectionIndex + 1}-${questionIndex + 1}-${optionIndex + 1}`}
                                           />
                                           {canModify && (
                                             <>
                                               <Button variant="ghost" size="icon" className="h-8 w-8" disabled={optionIndex === 0} onClick={() => moveOption(selectedPart.formPartUuid, sectionIndex, questionIndex, optionIndex, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                               <Button variant="ghost" size="icon" className="h-8 w-8" disabled={optionIndex === question.options.length - 1} onClick={() => moveOption(selectedPart.formPartUuid, sectionIndex, questionIndex, optionIndex, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => {
                                                  const activeSet = optionSetFor(selectedPart.formPartUuid, question.option_set_uuid || section.default_option_set_uuid);
                                                  if (activeSet?.option_set_uuid) {
                                                    updateOptionSet(selectedPart.formPartUuid, activeSet.option_set_uuid, (value) => ({ ...value, options: value.options.filter((_, index) => index !== optionIndex) }));
                                                  } else {
                                                    updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, options: value.options.filter((_, index) => index !== optionIndex) }));
                                                  }
                                                }}><X className="h-3.5 w-3.5" /></Button>
                                             </>
                                           )}
                                         </div>
                                       ))}
                                     </div>
                                   )}
                                 </td>
                                 <td className={`${tableClasses.cell} align-top`}>
                                   <div className="space-y-2">
                                     <label className="flex items-center gap-2 text-xs text-gray-700">
                                       <Checkbox checked={question.is_mandatory} disabled={!canModify} onCheckedChange={(checked) => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, is_mandatory: checked === true }))} data-testid={`checkbox-point-mandatory-${sectionIndex + 1}-${questionIndex + 1}`} />
                                       Mandatory
                                     </label>
                                     <label className="flex items-center gap-2 text-xs text-gray-700">
                                       <Checkbox checked={question.comment_enabled} disabled={!canModify} onCheckedChange={(checked) => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, comment_enabled: checked === true }))} data-testid={`checkbox-point-comment-${sectionIndex + 1}-${questionIndex + 1}`} />
                                       Comment enabled
                                     </label>
                                   </div>
                                 </td>
                                 <td className={`${tableClasses.cell} align-top`}>
                                   {canModify && (
                                     <div className="flex items-center gap-1">
                                       <Button variant="ghost" size="icon" className="h-8 w-8" disabled={questionIndex === 0} onClick={() => moveQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, -1)} data-testid={`button-move-point-up-${sectionIndex + 1}-${questionIndex + 1}`}><ArrowUp className="h-4 w-4" /></Button>
                                       <Button variant="ghost" size="icon" className="h-8 w-8" disabled={questionIndex === section.questions.length - 1} onClick={() => moveQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, 1)} data-testid={`button-move-point-down-${sectionIndex + 1}-${questionIndex + 1}`}><ArrowDown className="h-4 w-4" /></Button>
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => requestDelete("Delete point?", "This point and its options will be removed.", () => updateSection(selectedPart.formPartUuid, sectionIndex, (value) => ({ ...value, questions: value.questions.filter((_, index) => index !== questionIndex) })))} data-testid={`button-delete-point-${sectionIndex + 1}-${questionIndex + 1}`}><Trash2 className="h-4 w-4" /></Button>
                                     </div>
                                   )}
                                 </td>
                               </tr>
                             ))}
                           </FormTable>
                         ) : (
                           <div className="border border-dashed border-gray-300 py-6 text-center text-sm text-gray-400">No points yet. Add the first point below.</div>
                         )}
                         {canModify && <Button variant="outline" className="mt-4" onClick={() => addQuestion(selectedPart.formPartUuid, sectionIndex)} data-testid={`button-add-point-${sectionIndex + 1}`}><Plus className="h-4 w-4 mr-2" /> Add New Point</Button>}
                       </CardContent>
                    </Card>
                  ))}
                  {currentSections.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
                      <div className="text-sm text-gray-500 mb-4">This configurable part has no sections yet.</div>
                      {canModify && <Button onClick={() => addSection(selectedPart.formPartUuid)} data-testid="button-add-first-section"><Plus className="h-4 w-4 mr-2" /> Add New Section</Button>}
                    </div>
                  )}
                  {canModify && currentSections.length > 0 && <Button onClick={() => addSection(selectedPart.formPartUuid)} variant="outline" className="w-full border-dashed" data-testid="button-add-section"><Plus className="h-4 w-4 mr-2" /> Add New Section</Button>}
                  </>
                  )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </SharedFormShell>,
        document.body,
      )}

      <Dialog open={settingsDialog !== null} onOpenChange={(open) => !open && setSettingsDialog(null)}>
        <DialogContent className="max-w-lg" data-testid="section-settings-dialog">
          <DialogHeader>
            <DialogTitle>
              {settingsDialog === "vessel" ? "Vessel Type Applicability" : settingsDialog === "responsible" ? "Responsible Role / Department" : settingsDialog === "comment" ? "Section Comment Box" : "Electronic Signature"}
            </DialogTitle>
            <DialogDescription>
              {sectionForSettings?.section_code} · {sectionForSettings?.section_title || "Untitled section"}
            </DialogDescription>
          </DialogHeader>
          {settingsDialog === "vessel" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={settingsValues.vesselTypes.length === 0} onCheckedChange={(checked) => checked === true && setSettingsValues((value) => ({ ...value, vesselTypes: [] }))} data-testid="checkbox-all-vessel-types" />
                All vessel types
              </label>
              <div className="max-h-56 overflow-y-auto rounded-md border p-3 space-y-2">
                {vesselTypes.map((type) => {
                  const uuid = type.vtUuid || type.vtuid || "";
                  const label = type.name || type.vesselType || type.label || uuid;
                  if (!uuid) return null;
                  return <label key={uuid} className="flex items-center gap-2 text-sm"><Checkbox checked={settingsValues.vesselTypes.includes(uuid)} onCheckedChange={(checked) => setSettingsValues((value) => ({ ...value, vesselTypes: checked === true ? [...value.vesselTypes, uuid] : value.vesselTypes.filter((item) => item !== uuid) }))} />{label}</label>;
                })}
              </div>
              <p className="text-xs text-gray-500">{settingsValues.vesselTypes.length === 0 ? "This section applies to every vessel type." : `${settingsValues.vesselTypes.length} vessel type(s) selected.`}</p>
            </div>
          )}
          {settingsDialog === "responsible" && (
            <div className="space-y-4">
              <RadioGroup value={settingsValues.responsibleMode} onValueChange={(value) => setSettingsValues((current) => ({ ...current, responsibleMode: value as SectionModel["responsible_mode"] }))} className="gap-3">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="role" /> Responsible Role</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="department" /> Responsible Department</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="not_applicable" /> Not Applicable</label>
              </RadioGroup>
              {settingsValues.responsibleMode === "role" && (
                <Select value={settingsValues.responsibleRoleUuid} onValueChange={(value) => setSettingsValues((current) => ({ ...current, responsibleRoleUuid: value }))}>
                  <SelectTrigger data-testid="select-responsible-role"><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>{activeRoles.map((role) => <SelectItem value={role.ruid} key={role.ruid}>{roleTitle(role)}</SelectItem>)}</SelectContent>
                </Select>
              )}
              {settingsValues.responsibleMode === "department" && (
                <Select value={settingsValues.responsibleDepartment} onValueChange={(value) => setSettingsValues((current) => ({ ...current, responsibleDepartment: value }))}>
                  <SelectTrigger data-testid="select-responsible-department"><SelectValue placeholder="Select a department" /></SelectTrigger>
                  <SelectContent>{departments.map((department) => {
                    const option = departmentOption(department);
                    return option ? <SelectItem value={option.value} key={option.value}>{option.label}</SelectItem> : null;
                  })}</SelectContent>
                </Select>
              )}
            </div>
          )}
          {settingsDialog === "comment" && (
            <RadioGroup value={settingsValues.commentRequired ? "required" : "not_required"} onValueChange={(value) => setSettingsValues((current) => ({ ...current, commentRequired: value === "required" }))}>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="required" /> Required</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="not_required" /> Not Required</label>
            </RadioGroup>
          )}
          {settingsDialog === "signature" && (
            <RadioGroup value={settingsValues.signatureRequired ? "required" : "not_required"} onValueChange={(value) => setSettingsValues((current) => ({ ...current, signatureRequired: value === "required" }))}>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="required" /> Required</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="not_required" /> Not Required</label>
            </RadioGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialog(null)} data-testid="button-cancel-section-settings">Cancel</Button>
            <Button onClick={saveSettings} data-testid="button-save-section-settings"><Check className="h-4 w-4 mr-2" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={scaleDialog !== null} onOpenChange={(open) => {
        if (!open) {
          setScaleDialog(null);
          setScaleError("");
        }
      }}>
        <DialogContent className="max-w-md" data-testid="numeric-scale-dialog">
          <DialogHeader>
            <DialogTitle>Generate numeric scale</DialogTitle>
          <DialogDescription>Creates an inclusive, whole-number scale. Values and headers remain numeric; optional endpoint descriptors appear alongside the scale.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm">Start
              <Input value={scaleValues.start} onChange={(event) => setScaleValues((value) => ({ ...value, start: event.target.value }))} inputMode="numeric" placeholder="1" data-testid="input-scale-start" />
            </label>
            <label className="space-y-1 text-sm">End
              <Input value={scaleValues.end} onChange={(event) => setScaleValues((value) => ({ ...value, end: event.target.value }))} inputMode="numeric" placeholder="10" data-testid="input-scale-end" />
            </label>
            <label className="space-y-1 text-sm">First label (optional)
              <Input value={scaleValues.firstLabel} onChange={(event) => setScaleValues((value) => ({ ...value, firstLabel: event.target.value }))} placeholder="Poor" data-testid="input-scale-first-label" />
            </label>
            <label className="space-y-1 text-sm">Last label (optional)
              <Input value={scaleValues.lastLabel} onChange={(event) => setScaleValues((value) => ({ ...value, lastLabel: event.target.value }))} placeholder="Excellent" data-testid="input-scale-last-label" />
            </label>
          </div>
          {scaleError && <p className="text-sm text-red-600" data-testid="text-scale-error">{scaleError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScaleDialog(null)}>Cancel</Button>
            <Button onClick={applyNumericScale} data-testid="button-apply-numeric-scale">Generate scale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirmDelete?.title}</AlertDialogTitle><AlertDialogDescription>{confirmDelete?.description}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmDelete?.onConfirm(); setConfirmDelete(null); }} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={releaseConfirmOpen} onOpenChange={setReleaseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release this version permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This version will become permanent and cannot be edited. Any future changes will require creating a new draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReleaseConfirmOpen(false);
                void releaseSelectedVersion();
              }}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-release"
            >
              Release Ver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLeaveDialog} onOpenChange={(open) => {
        setShowLeaveDialog(open);
        if (!open) setPendingVersionUuid(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingVersionUuid ? "Switch without saving?" : "Leave without saving?"}</AlertDialogTitle>
            <AlertDialogDescription>{pendingVersionUuid ? "Your changes will be discarded before loading the selected version." : "Your changes will be discarded if you leave this editor."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingVersionUuid) {
                applyVersionChange(pendingVersionUuid);
                setPendingVersionUuid(null);
                setShowLeaveDialog(false);
                return;
              }
              onClose();
            }} className="bg-red-600 hover:bg-red-700" data-testid="button-discard-unsaved">Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const genericFormEditorTestUtils = {
  buildNumericScaleOptions,
  createOption,
  cloneOptions,
  departmentOption,
  isNamedOptionSet,
  normalizeTree,
  resolveDraftEffectiveLayout,
  matrixIneligibilityReason,
  roleSummary,
  selectableRoles,
  renumberSections,
  captureViewScrollPosition,
  getFocusableElements,
  shouldConfirmVersionChange,
  toPayload,
};