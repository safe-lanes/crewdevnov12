import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { Form } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getCrewUserId } from "@/lib/crewUser";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface QuestionModel {
  clientKey: string;
  question_uuid?: string;
  question_code: string;
  question_text: string;
  response_type: string;
  is_mandatory: boolean;
  comment_enabled: boolean;
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

function emptyQuestion(sectionCode: string, questionIndex: number): QuestionModel {
  return {
    clientKey: clientKey("question"),
    question_code: `${sectionCode}.${questionIndex + 1}`,
    question_text: "",
    response_type: "yes_no",
    is_mandatory: false,
    comment_enabled: true,
    options: [],
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

function normalizeTree(data: any, partCode: string): SectionModel[] {
  const sections = Array.isArray(data?.sections) ? data.sections : [];
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
    questions: Array.isArray(section.questions) ? section.questions.map((question: any) => ({
      clientKey: clientKey("question"),
      question_uuid: question.question_uuid,
      question_code: question.question_code || "",
      question_text: question.question_text || "",
      response_type: question.response_type || "yes_no",
      is_mandatory: !!question.is_mandatory,
      comment_enabled: question.comment_enabled !== false,
      options: Array.isArray(question.options) ? question.options.map((option: any) => ({
        clientKey: clientKey("option"),
        option_uuid: option.option_uuid,
        option_label: option.option_label || "",
        // Existing values are loaded verbatim and are never regenerated on label edits.
        option_value: option.option_value || slugOptionValue(option.option_label || "option"),
      })) : [],
    })) : [],
  })));
}

function toPayload(sections: SectionModel[]) {
  return {
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
      questions: section.questions.map((question) => ({
        ...(question.question_uuid ? { question_uuid: question.question_uuid } : {}),
        question_code: question.question_code,
        question_text: question.question_text.trim(),
        response_type: question.response_type,
        is_mandatory: question.is_mandatory,
        comment_enabled: question.comment_enabled,
        options: question.options.map((option) => ({
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

function shouldConfirmVersionChange(isDirty: boolean, currentVersionUuid: string, nextVersionUuid: string): boolean {
  return isDirty && currentVersionUuid !== nextVersionUuid;
}

export const GenericFormEditor: React.FC<GenericFormEditorProps> = ({
  form,
  formName,
  rankGroupName,
  rankGroupConfig,
  configurableParts: partsFromParent = [],
  onClose,
  onSave,
}) => {
  const { toast } = useToast();
  const realFormId = form.originalFormId ?? form.id;
  const [selectedPartUuid, setSelectedPartUuid] = useState("");
  const [selectedVersionUuid, setSelectedVersionUuid] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<EditorViewMode>("configure");
  const [previewVesselTypeUuid, setPreviewVesselTypeUuid] = useState("all");
  const [trees, setTrees] = useState<Record<string, SectionModel[]>>({});
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingVersionUuid, setPendingVersionUuid] = useState<string | null>(null);
  const baselineRef = useRef<string | null>(null);
  const editorContentRef = useRef<HTMLElement | null>(null);
  const editorDialogRef = useRef<HTMLDivElement | null>(null);
  const previewPortalRef = useRef<HTMLDivElement | null>(null);
  const editorScrollTopRef = useRef<Record<EditorViewMode, number>>({ configure: 0, preview: 0 });

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
    () => rankGroups.find((group) => group.name === rankGroupName)?.id ?? null,
    [rankGroups, rankGroupName],
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

  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => {
      const numberDiff = Number(b.versionNo) - Number(a.versionNo);
      if (numberDiff !== 0) return numberDiff;
      return a.status === "draft" ? -1 : 1;
    }),
    [versions],
  );
  const selectedVersion = useMemo(
    () => versions.find((version) => version.fvUuid === selectedVersionUuid) ?? sortedVersions[0],
    [selectedVersionUuid, sortedVersions, versions],
  );
  const selectedPart = configurableParts.find((part) => part.formPartUuid === selectedPartUuid) ?? configurableParts[0];
  const currentSections = selectedPart ? (trees[selectedPart.formPartUuid] || []) : [];
  const serializedTrees = JSON.stringify(trees);
  const isDirty = baselineRef.current !== null && baselineRef.current !== serializedTrees;
  const canEdit = isEditing && (!selectedVersion || selectedVersion.status === "draft");
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
    if (!selectedVersion?.fvUuid || configurableParts.length === 0) {
      setTrees({});
      baselineRef.current = null;
      return;
    }
    let cancelled = false;
    setIsLoadingTree(true);
    setSaveError("");
    Promise.all(configurableParts.map(async (part) => {
      const response = await fetch(
        `/api/v2/admin/form-versions/${selectedVersion.fvUuid}/parts/${part.formPartUuid}/structure`,
      );
      if (!response.ok) throw new Error(`Failed to load ${part.partTitle}`);
      return [part.formPartUuid, normalizeTree(await response.json(), part.partCode)] as const;
    }))
      .then((entries) => {
        if (cancelled) return;
        const loaded = Object.fromEntries(entries);
        setTrees(loaded);
        baselineRef.current = JSON.stringify(loaded);
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setTrees(Object.fromEntries(configurableParts.map((part) => [part.formPartUuid, []])));
          baselineRef.current = JSON.stringify({});
          setSaveError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTree(false);
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

  const addSection = (partUuid: string) => {
    updatePartTree(partUuid, (sections) => [...sections, emptySection(
      configurableParts.find((part) => part.formPartUuid === partUuid)?.partCode || "B",
      sections.length,
    )]);
  };

  const addQuestion = (partUuid: string, sectionIndex: number) => {
    updateSection(partUuid, sectionIndex, (section) => ({
      ...section,
      questions: [...section.questions, emptyQuestion(section.section_code, section.questions.length)],
    }));
  };

  const addOption = (partUuid: string, sectionIndex: number, questionIndex: number) => {
    updateQuestion(partUuid, sectionIndex, questionIndex, (question) => ({
      ...question,
      options: [...question.options, createOption("New option", question.options)],
    }));
  };

  const changeResponseType = (partUuid: string, sectionIndex: number, questionIndex: number, responseType: string) => {
    updateQuestion(partUuid, sectionIndex, questionIndex, (question) => ({
      ...question,
      response_type: responseType,
      options: responseType === "single_select" || responseType === "multi_select"
        ? (question.options.length > 0 ? question.options : [createOption()])
        : [],
    }));
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
      const options = [...question.options];
      [options[index], options[target]] = [options[target], options[index]];
      return { ...question, options };
    });
  };

  const requestDelete = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDelete({ title, description, onConfirm });
  };

  const createDraft = async (): Promise<VersionRow> => {
    if (selectedVersion?.status === "draft") return selectedVersion;
    const existingDraft = versions.find((version) => version.status === "draft");
    if (existingDraft) {
      setSelectedVersionUuid(existingDraft.fvUuid);
      setIsEditing(true);
      return existingDraft;
    }
    const maxVersion = versions.reduce((max, version) => Math.max(max, Number(version.versionNo) || 0), 0);
    const sourceConfiguration = selectedVersion?.configuration
      || (typeof rankGroupConfig === "string" ? rankGroupConfig : JSON.stringify(rankGroupConfig || {}));
    const response = await apiRequest("POST", `/api/v2/admin/forms/${realFormId}/versions`, {
      versionNo: String(maxVersion + 1).padStart(2, "0"),
      versionDate: formatVersionDate(),
      status: "draft",
      rankGroupId,
      configuration: sourceConfiguration,
      auditUserUuid: getCrewUserId(),
    });
    const created = await response.json() as VersionRow;
    setSelectedVersionUuid(created.fvUuid);
    setIsEditing(true);
    await refetchVersions();
    return created;
  };

  const validateTrees = (): string | null => {
    for (const part of configurableParts) {
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
          if (question.options.some((option) => !option.option_label.trim())) {
            return `${question.question_code}: option labels cannot be empty`;
          }
        }
      }
    }
    return null;
  };

  const save = async () => {
    if (!canEdit) return;
    const validationError = validateTrees();
    if (validationError) {
      setSaveError(validationError);
      toast({ title: "Check the highlighted entry", description: validationError, variant: "destructive" });
      return;
    }
    setIsSaving(true);
    setSaveError("");
    const startedAt = performance.now();
    try {
      const draft = await createDraft();
      const response = await apiRequest(
        "PUT",
        `/api/v2/admin/form-versions/${draft.fvUuid}/structures`,
        {
          parts: configurableParts.map((part) => ({
            form_part_uuid: part.formPartUuid,
            structure: toPayload(trees[part.formPartUuid] || []),
          })),
          auditUserUuid: getCrewUserId(),
        },
      );
      if (!response.ok) throw new Error("Form structure save failed");
      baselineRef.current = JSON.stringify(trees);
      onSave({ formVersionUuid: draft.fvUuid, savedParts: configurableParts.length, durationMs: Math.round(performance.now() - startedAt) });
      toast({ title: "Draft saved", description: "The complete form structure has been saved." });
      await refetchVersions();
    } catch (error: any) {
      const message = error?.message || "Failed to save form structure";
      setSaveError(message);
      toast({ title: "Unable to save form", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      setPendingVersionUuid(null);
      setShowLeaveDialog(true);
    } else {
      onClose();
    }
  };

  const applyVersionChange = (versionUuid: string) => {
    setSelectedVersionUuid(versionUuid);
    const version = versions.find((item) => item.fvUuid === versionUuid);
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
      await createDraft();
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
    const editorDialog = editorDialogRef.current;
    if (!editorDialog) return;

    if (isPreview) {
      editorDialog.setAttribute("inert", "");
    } else {
      editorDialog.removeAttribute("inert");
    }

    return () => editorDialog.removeAttribute("inert");
  }, [isPreview]);

  useEffect(() => {
    if (!isPreview) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusPreview = () => {
      const preview = previewPortalRef.current;
      if (!preview) return;
      const [firstFocusable] = getFocusableElements(preview);
      (firstFocusable || preview).focus();
    };

    const focusTimer = window.setTimeout(focusPreview, 0);
    const handlePreviewKeys = (event: KeyboardEvent) => {
      const preview = previewPortalRef.current;
      if (!preview) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePreview();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(preview);
      if (focusable.length === 0) {
        event.preventDefault();
        preview.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (!preview.contains(activeElement)) {
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

    document.addEventListener("keydown", handlePreviewKeys, true);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handlePreviewKeys, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [closePreview, isPreview]);

  return (
    <>
      <Dialog open={!isPreview} onOpenChange={(open) => {
        if (!open && !isPreview) handleClose();
      }}>
        <DialogContent
          ref={editorDialogRef}
          forceMount
          overlayClassName={isPreview ? "hidden" : undefined}
          className={`max-w-[1440px] w-[98vw] h-[94vh] p-0 gap-0 overflow-hidden${isPreview ? " invisible pointer-events-none" : ""}`}
          aria-hidden={isPreview}
          onEscapeKeyDown={(event) => {
            if (isPreview) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isPreview) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isPreview) event.preventDefault();
          }}
          data-testid="generic-form-editor"
        >
          <DialogHeader className="border-b bg-[#f7fafc] px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4 pr-8">
              <div>
                <DialogTitle className="text-[#16569e] text-xl">{formName}</DialogTitle>
                <DialogDescription className="mt-1">
                  {rankGroupName || "All rank groups"} · configure the form structure and response points
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center rounded-md border bg-white p-0.5" role="group" aria-label="Form editor view">
                  <Button
                    type="button"
                    variant={viewMode === "configure" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={viewMode === "preview" ? toggleViewMode : undefined}
                    aria-pressed={viewMode === "configure"}
                    data-testid="button-configure-mode"
                  >
                    Configure
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === "preview" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={viewMode === "configure" ? toggleViewMode : undefined}
                    aria-pressed={viewMode === "preview"}
                    data-testid="button-preview-mode"
                  >
                    Preview
                  </Button>
                </div>
                <span className="text-gray-500">Version</span>
                <Select
                  value={selectedVersion?.fvUuid || ""}
                  onValueChange={requestVersionChange}
                >
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
                {selectedVersion && (
                  <Badge variant={selectedVersion.status === "draft" ? "secondary" : "outline"}>
                    {selectedVersion.status === "draft" ? "Draft" : "Released"}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex min-h-0 flex-1">
              <>
            <aside className="w-64 shrink-0 border-r bg-[#f8fafc] p-4 overflow-y-auto">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Form parts</div>
              <div className="space-y-1" data-testid="form-part-navigator">
                {allParts.map((part) => {
                  const isConfigurable = part.partType === "configurable";
                  const isSelected = part.formPartUuid === selectedPart?.formPartUuid;
                  return (
                    <button
                      type="button"
                      key={part.formPartUuid}
                      disabled={!isConfigurable}
                      onClick={() => isConfigurable && setSelectedPartUuid(part.formPartUuid)}
                      className={`w-full flex items-center gap-3 rounded-md px-3 py-3 text-left transition-colors ${
                        isSelected ? "bg-[#16569e] text-white shadow-sm" : isConfigurable ? "hover:bg-white text-gray-700" : "text-gray-400"
                      }`}
                      data-testid={`button-part-${part.partCode}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected ? "bg-white/20" : isConfigurable ? "bg-[#dbeafe] text-[#16569e]" : "bg-gray-200"
                      }`}>{part.partCode}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{part.partTitle || `Part ${part.partCode}`}</span>
                        <span className={`block text-[11px] ${isSelected ? "text-blue-100" : "text-gray-400"}`}>
                          {isConfigurable ? "Editable structure" : "Fixed part"}
                        </span>
                      </span>
                      {isConfigurable && <ChevronRight className="h-4 w-4 opacity-60" />}
                    </button>
                  );
                })}
              </div>
              {allParts.length === 0 && !isLoadingParts && (
                <div className="text-xs text-gray-500 p-2">No form parts are configured.</div>
              )}
            </aside>

             <main ref={editorContentRef} className="min-w-0 flex-1 overflow-y-auto bg-white">
              <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-gray-800">{selectedPart?.partCode} · {selectedPart?.partTitle}</div>
                  <div className="text-xs text-gray-500">
                    {currentSections.length} section{currentSections.length === 1 ? "" : "s"} ·
                    {" "}{currentSections.reduce((sum, section) => sum + section.questions.length, 0)} points
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  {currentSections.map((section, sectionIndex) => (
                    <Card key={section.clientKey} className="border-gray-200 shadow-sm" data-testid={`card-section-${sectionIndex + 1}`}>
                      <CardHeader className="py-4 px-5 bg-[#f8fafc] border-b">
                        <div className="flex items-start gap-3">
                          <Badge className="mt-1 bg-[#16569e] hover:bg-[#16569e]">{section.section_code}</Badge>
                          <div className="flex-1 min-w-0">
                            <Input
                              value={section.section_title}
                              disabled={!canEdit}
                              onChange={(event) => updateSection(selectedPart.formPartUuid, sectionIndex, (value) => ({ ...value, section_title: event.target.value }))}
                              placeholder="Section title"
                              className={`h-9 bg-white font-semibold ${!section.section_title.trim() && canEdit ? "border-red-300" : ""}`}
                              data-testid={`input-section-title-${sectionIndex + 1}`}
                            />
                            {!section.section_title.trim() && canEdit && <p className="text-[11px] text-red-600 mt-1">Section title is required.</p>}
                            <div className="flex flex-wrap gap-1.5 mt-2">
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
                                    <Badge variant="outline" className="text-[10px] font-normal">
                                      {`Role: ${summary.title}`}
                                    </Badge>
                                    {summary.status && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] font-medium ${statusClassName}`}
                                        data-testid={`badge-responsible-role-status-${sectionIndex + 1}`}
                                      >
                                        <AlertCircle className="mr-1 h-3 w-3" />
                                        {statusLabel}
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
                            </div>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={sectionIndex === 0} onClick={() => moveSection(selectedPart.formPartUuid, sectionIndex, -1)} data-testid={`button-move-section-up-${sectionIndex + 1}`}><ArrowUp className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={sectionIndex === currentSections.length - 1} onClick={() => moveSection(selectedPart.formPartUuid, sectionIndex, 1)} data-testid={`button-move-section-down-${sectionIndex + 1}`}><ArrowDown className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => requestDelete("Delete section?", "This will also remove all points in the section.", () => updatePartTree(selectedPart.formPartUuid, (sections) => sections.filter((_, index) => index !== sectionIndex)))} data-testid={`button-delete-section-${sectionIndex + 1}`}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap gap-2 pt-3">
                            <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "vessel")} data-testid={`button-section-vessel-settings-${sectionIndex + 1}`}><Settings2 className="h-3.5 w-3.5 mr-1.5" /> Vessel types</Button>
                            <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "responsible")} data-testid={`button-section-responsible-settings-${sectionIndex + 1}`}>Responsible party</Button>
                            <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "comment")} data-testid={`button-section-comment-settings-${sectionIndex + 1}`}>Comment box</Button>
                            <Button variant="outline" size="sm" onClick={() => openSettings(selectedPart.formPartUuid, sectionIndex, "signature")} data-testid={`button-section-signature-settings-${sectionIndex + 1}`}>Signature</Button>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="p-5 space-y-3">
                        {section.questions.map((question, questionIndex) => (
                          <div key={question.clientKey} className="rounded-md border border-gray-200 p-4" data-testid={`card-point-${sectionIndex + 1}-${questionIndex + 1}`}>
                            <div className="flex gap-3">
                              <Badge variant="secondary" className="mt-1 shrink-0 font-mono">{question.question_code}</Badge>
                              <div className="min-w-0 flex-1 space-y-3">
                                <Textarea
                                  value={question.question_text}
                                  disabled={!canEdit}
                                  onChange={(event) => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, question_text: event.target.value }))}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey && canEdit) {
                                      event.preventDefault();
                                      addQuestion(selectedPart.formPartUuid, sectionIndex);
                                    }
                                  }}
                                  placeholder="Enter point text, then press Enter for the next point"
                                  className={`min-h-[42px] resize-y ${!question.question_text.trim() && canEdit ? "border-red-300" : ""}`}
                                  data-testid={`textarea-point-text-${sectionIndex + 1}-${questionIndex + 1}`}
                                />
                                {!question.question_text.trim() && canEdit && <p className="text-[11px] text-red-600">Point text is required.</p>}
                                <div className="flex flex-wrap items-center gap-3">
                                  <Select value={question.response_type} disabled={!canEdit} onValueChange={(value) => changeResponseType(selectedPart.formPartUuid, sectionIndex, questionIndex, value)}>
                                    <SelectTrigger className="w-[180px] h-9" data-testid={`select-response-type-${sectionIndex + 1}-${questionIndex + 1}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>{RESPONSE_TYPES.map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent>
                                  </Select>
                                  <label className="flex items-center gap-2 text-xs text-gray-700">
                                    <Checkbox checked={question.is_mandatory} disabled={!canEdit} onCheckedChange={(checked) => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, is_mandatory: checked === true }))} data-testid={`checkbox-point-mandatory-${sectionIndex + 1}-${questionIndex + 1}`} />
                                    Mandatory
                                  </label>
                                  <label className="flex items-center gap-2 text-xs text-gray-700">
                                    <Checkbox checked={question.comment_enabled} disabled={!canEdit} onCheckedChange={(checked) => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, comment_enabled: checked === true }))} data-testid={`checkbox-point-comment-${sectionIndex + 1}-${questionIndex + 1}`} />
                                    Comment enabled
                                  </label>
                                  <span className="text-[11px] text-gray-400">{responseLabel(question.response_type)}</span>
                                </div>
                                {(question.response_type === "single_select" || question.response_type === "multi_select") && (
                                  <div className="rounded-md bg-gray-50 p-3 space-y-2" data-testid={`option-editor-${sectionIndex + 1}-${questionIndex + 1}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs font-semibold text-gray-700">Options</div>
                                      {canEdit && <Button variant="outline" size="sm" onClick={() => addOption(selectedPart.formPartUuid, sectionIndex, questionIndex)} data-testid={`button-add-option-${sectionIndex + 1}-${questionIndex + 1}`}><Plus className="h-3.5 w-3.5 mr-1" /> Add option</Button>}
                                    </div>
                                    {question.options.map((option, optionIndex) => (
                                      <div className="flex items-center gap-2" key={option.clientKey}>
                                        <span className="w-5 text-center text-xs text-gray-400">{optionIndex + 1}</span>
                                        <Input
                                          value={option.option_label}
                                          disabled={!canEdit}
                                          onChange={(event) => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({
                                            ...value,
                                            options: value.options.map((item, index) => index === optionIndex ? { ...item, option_label: event.target.value } : item),
                                          }))}
                                          className="h-8 bg-white text-sm"
                                          placeholder="Option label"
                                          data-testid={`input-option-label-${sectionIndex + 1}-${questionIndex + 1}-${optionIndex + 1}`}
                                        />
                                        {canEdit && (
                                          <>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={optionIndex === 0} onClick={() => moveOption(selectedPart.formPartUuid, sectionIndex, questionIndex, optionIndex, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={optionIndex === question.options.length - 1} onClick={() => moveOption(selectedPart.formPartUuid, sectionIndex, questionIndex, optionIndex, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => updateQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, (value) => ({ ...value, options: value.options.filter((_, index) => index !== optionIndex) }))}><X className="h-3.5 w-3.5" /></Button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {canEdit && (
                                <div className="flex flex-col gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={questionIndex === 0} onClick={() => moveQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, -1)} data-testid={`button-move-point-up-${sectionIndex + 1}-${questionIndex + 1}`}><ArrowUp className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={questionIndex === section.questions.length - 1} onClick={() => moveQuestion(selectedPart.formPartUuid, sectionIndex, questionIndex, 1)} data-testid={`button-move-point-down-${sectionIndex + 1}-${questionIndex + 1}`}><ArrowDown className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => requestDelete("Delete point?", "This point and its options will be removed.", () => updateSection(selectedPart.formPartUuid, sectionIndex, (value) => ({ ...value, questions: value.questions.filter((_, index) => index !== questionIndex) })))} data-testid={`button-delete-point-${sectionIndex + 1}-${questionIndex + 1}`}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {section.questions.length === 0 && <div className="text-sm text-gray-400 py-3 text-center border border-dashed rounded-md">No points yet. Add the first point below.</div>}
                        {canEdit && <Button variant="outline" onClick={() => addQuestion(selectedPart.formPartUuid, sectionIndex)} data-testid={`button-add-point-${sectionIndex + 1}`}><Plus className="h-4 w-4 mr-2" /> Add New Point</Button>}
                      </CardContent>
                    </Card>
                  ))}
                  {currentSections.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 p-12 text-center">
                      <div className="text-sm text-gray-500 mb-4">This configurable part has no sections yet.</div>
                      {canEdit && <Button onClick={() => addSection(selectedPart.formPartUuid)} data-testid="button-add-first-section"><Plus className="h-4 w-4 mr-2" /> Add New Section</Button>}
                    </div>
                  )}
                  {canEdit && currentSections.length > 0 && <Button onClick={() => addSection(selectedPart.formPartUuid)} variant="outline" className="w-full border-dashed" data-testid="button-add-section"><Plus className="h-4 w-4 mr-2" /> Add New Section</Button>}
                   </div>
                 )}
               </div>
             </main>
              </>
          </div>
          <div className="border-t bg-[#f8fafc] px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={handleClose} data-testid="button-close-generic-editor"><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <div className="text-xs text-gray-500">{isDirty ? "Unsaved changes" : "All changes saved"} · option values stay hidden and stable after creation</div>
          </div>
        </DialogContent>
      </Dialog>

      {typeof document !== "undefined" && createPortal(
        <div
          ref={previewPortalRef}
          className={isPreview ? "relative" : "hidden"}
          role="dialog"
          aria-label={`${formName} preview`}
          aria-modal={isPreview}
          aria-hidden={!isPreview}
          tabIndex={-1}
          data-testid="configured-preview-portal"
          data-preview-visible={isPreview}
        >
          <ConfiguredFormRenderer
            mode="preview"
            formTitle={formName}
            parts={allParts}
            structures={trees}
            roles={roles}
            departments={departments}
            vesselTypes={vesselTypes}
            selectedVesselTypeUuid={previewVesselTypeUuid}
            onSelectedVesselTypeUuidChange={setPreviewVesselTypeUuid}
            onBack={closePreview}
          />
        </div>,
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

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirmDelete?.title}</AlertDialogTitle><AlertDialogDescription>{confirmDelete?.description}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmDelete?.onConfirm(); setConfirmDelete(null); }} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
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
  createOption,
  departmentOption,
  roleSummary,
  selectableRoles,
  renumberSections,
  captureViewScrollPosition,
  getFocusableElements,
  shouldConfirmVersionChange,
  toPayload,
};