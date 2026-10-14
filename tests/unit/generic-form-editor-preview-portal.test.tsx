import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GenericFormEditor } from "@/components/GenericFormEditor";
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    isLoading: false,
    permissions: [{ menuName: "Forms", canview: true, canedit: true }],
  }),
}));

const queryResults = vi.hoisted(() => new Map<string, unknown>());
const emptyQueryResult = vi.hoisted((): unknown[] => []);
const partsForVersion = (versionUuid: string) => [
  { formPartUuid: `${versionUuid}-a`, formVersionUuid: versionUuid, partCode: "A", partTitle: "Preparation", partType: "fixed" },
  { formPartUuid: `${versionUuid}-b`, formVersionUuid: versionUuid, partCode: "B", partTitle: "Deck briefing", partType: "configurable" },
  { formPartUuid: `${versionUuid}-c`, formVersionUuid: versionUuid, partCode: "C", partTitle: "Office review", partType: "fixed" },
];

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: unknown[] }) => ({
      data: queryResults.get(String(options.queryKey?.[0])) ?? emptyQueryResult,
      isLoading: false,
      refetch: vi.fn(),
    }),
  };
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

function renderEditor(options: { rankGroupName?: string; companyForm?: boolean; formCategory?: string } = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const onClose = vi.fn();
  const onSave = vi.fn();
  act(() => {
    root?.render(
      <GenericFormEditor
        form={{
          id: 99,
          ...(options.companyForm ? { category: "dynamic", subjectType: "crew_assignment" } : {}),
          ...(options.formCategory ? { category: options.formCategory } : {}),
        } as any}
        formName="Safety review"
        rankGroupName={options.rankGroupName}
        configurableParts={[
          { formPartUuid: "part-a", partCode: "A", partTitle: "Preparation", partType: "fixed" },
          { formPartUuid: "part-b", partCode: "B", partTitle: "Deck briefing", partType: "configurable" },
          { formPartUuid: "part-c", partCode: "C", partTitle: "Office review", partType: "fixed" },
        ]}
        onClose={onClose}
        onSave={onSave}
      />,
    );
  });
  const editor = document.body.querySelector<HTMLElement>('[data-testid="generic-form-editor"]');
  const previewButton = document.body.querySelector<HTMLButtonElement>('[data-testid="button-preview-mode"]');
  if (!editor || !previewButton) throw new Error("Editor did not render");
  return { editor, previewButton, onClose, onSave };
}

function click(element: HTMLElement) {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

function pointerDown(element: HTMLElement) {
  const target = element as HTMLElement & {
    hasPointerCapture?: (pointerId: number) => boolean;
    releasePointerCapture?: (pointerId: number) => void;
  };
  target.hasPointerCapture ??= () => false;
  target.releasePointerCapture ??= () => undefined;
  act(() => element.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true,
    button: 0,
    pointerType: "mouse",
  })));
}

function portalOption(label: string): HTMLElement {
  const option = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!option) throw new Error(`Unable to find open option "${label}"`);
  return option;
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function loadEditableStructure() {
  queryResults.set("/api/v2/admin/forms/99/versions", [{
    fvUuid: "draft-version",
    versionNo: "01",
    versionDate: "01-Jan-2026",
    status: "draft",
  }]);
  queryResults.set("admin-form-version-parts", partsForVersion("draft-version"));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/parts?formVersionUuid=")) {
      return { ok: true, json: async () => partsForVersion("draft-version") };
    }
    if (url.endsWith("/structures") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      return {
        ok: true,
        json: async () => ({
          form_version_uuid: "draft-version",
          parts: body.parts.map((part: any) => ({
            form_version_uuid: "draft-version",
            form_part_uuid: part.form_part_uuid,
            ...part.structure,
          })),
        }),
      };
    }
    if (url.includes("/structure")) {
      return {
        ok: true,
        json: async () => ({
          sections: [{
            section_code: "B1",
            section_title: "Navigation readiness",
            applicable_vessel_types: [],
            responsible_mode: "not_applicable",
            comment_box_required: true,
            signature_required: false,
            questions: [{
              question_code: "B1.1",
              question_text: "Bridge team briefing completed",
              response_type: "single_select",
              is_mandatory: true,
              comment_enabled: true,
              options: [{ option_label: "Yes", option_value: "yes" }],
            }, {
              question_code: "B1.2",
              question_text: "Crew observations",
              response_type: "free_text",
              is_mandatory: false,
              comment_enabled: false,
              options: [],
            }, {
              question_code: "B1.3",
              question_text: "Crew count",
              response_type: "number",
              is_mandatory: false,
              comment_enabled: false,
              options: [],
            }],
          }],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  }));
}

function setControlValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setNativeValue = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setNativeValue) throw new Error("Native value setter is unavailable");
  act(() => {
    setNativeValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function echoSavedStructures(versionUuid: string, init?: RequestInit) {
  const body = JSON.parse(String(init?.body));
  return {
    ok: true,
    json: async () => ({
      form_version_uuid: versionUuid,
      parts: body.parts.map((part: any) => ({
        form_version_uuid: versionUuid,
        form_part_uuid: part.form_part_uuid,
        ...part.structure,
      })),
    }),
  };
}

function addValidSections(editor: HTMLElement, sectionCount: number, pointsPerSection: number) {
  for (let sectionIndex = 1; sectionIndex <= sectionCount; sectionIndex += 1) {
    const addSectionButton = editor.querySelector<HTMLElement>(
      sectionIndex === 1 ? '[data-testid="button-add-first-section"]' : '[data-testid="button-add-section"]',
    );
    if (!addSectionButton) throw new Error(`Add section button ${sectionIndex} did not render`);
    click(addSectionButton);
    const title = editor.querySelector<HTMLInputElement>(`[data-testid="input-section-title-${sectionIndex}"]`);
    if (!title) throw new Error(`Section title ${sectionIndex} did not render`);
    setControlValue(title, `Section ${sectionIndex}`);
    for (let pointIndex = 1; pointIndex <= pointsPerSection; pointIndex += 1) {
      const addPoint = editor.querySelector<HTMLElement>(`[data-testid="button-add-point-${sectionIndex}"]`);
      if (!addPoint) throw new Error(`Add point button ${sectionIndex} did not render`);
      click(addPoint);
      const point = editor.querySelector<HTMLTextAreaElement>(
        `[data-testid="textarea-point-text-${sectionIndex}-${pointIndex}"]`,
      );
      if (!point) throw new Error(`Point ${sectionIndex}.${pointIndex} did not render`);
      setControlValue(point, `Point ${sectionIndex}.${pointIndex}`);
    }
  }
}

async function typeContinuously(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setNativeValue = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setNativeValue) throw new Error("Native value setter is unavailable");

  act(() => input.focus());
  for (const character of text) {
    act(() => {
      setNativeValue.call(input, input.value + character);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flushAsyncWork();
    expect(document.activeElement).toBe(input);
  }
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.style.overflow = "";
  queryResults.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GenericFormEditor shared Preview shell", () => {
  it("shows the selected Company Form version and formats its persisted release timestamp in UTC", () => {
    queryResults.set("/api/v2/admin/forms/99/versions", [{
      fvUuid: "released-company-version",
      versionNo: "1",
      versionDate: "26-Sep-2026",
      status: "released",
      releasedAt: "2026-09-26T00:05:00+09:00",
    }]);
    const { editor } = renderEditor({ companyForm: true });
    expect(editor.querySelector('[data-testid="company-form-version-display"]')?.textContent).toContain("Version 01 · Released 25-Sep-2026");
  });

  it("does not add Company Form version metadata to a Standard Form title", () => {
    queryResults.set("/api/v2/admin/forms/99/versions", [{
      fvUuid: "released-standard-version",
      versionNo: "1",
      status: "released",
      releasedAt: "2026-09-26T00:00:00Z",
    }]);
    const { editor } = renderEditor();
    expect(editor.querySelector('[data-testid="company-form-version-display"]')).toBeNull();
  });

  it("offers System Field only for Company Forms and renders the selected field as read-only", async () => {
    loadEditableStructure();
    const { editor, previewButton } = renderEditor({ companyForm: true });
    await flushAsyncWork();
    await flushAsyncWork();

    const bulkType = editor.querySelector<HTMLElement>('[data-testid="select-bulk-response-type-1"]');
    if (!bulkType) throw new Error("Bulk response-type chooser did not render");
    pointerDown(bulkType);
    click(portalOption("System Field"));

    const responseType = editor.querySelector<HTMLElement>('[data-testid="select-response-type-1-1"]');
    if (!responseType) throw new Error("Point response-type chooser did not render");
    pointerDown(responseType);
    click(portalOption("System Field"));
    await flushAsyncWork();

    const fieldPicker = editor.querySelector<HTMLElement>('[data-testid="select-system-field-1-1"]');
    const pointText = editor.querySelector<HTMLTextAreaElement>('[data-testid="textarea-point-text-1-1"]');
    expect(fieldPicker).toBeTruthy();
    expect(pointText?.disabled).toBe(true);
    expect(editor.querySelector('[data-testid="checkbox-point-mandatory-1-1"]')).toBeNull();
    expect(editor.querySelector('[data-testid="checkbox-point-comment-1-1"]')).toBeNull();
    expect(editor.querySelector('[data-testid="option-editor-1-1"]')).toBeNull();

    click(previewButton);
    await flushAsyncWork();
    expect(editor.textContent).toContain("Form date");
    expect(editor.textContent).toContain("Filled from the record when opened");
  });

  it("omits System Field from both Standard Form response choosers", async () => {
    loadEditableStructure();
    const { editor } = renderEditor({ formCategory: "standard" });
    await flushAsyncWork();
    await flushAsyncWork();

    for (const testId of ["select-bulk-response-type-1", "select-response-type-1-1"]) {
      const trigger = editor.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!trigger) throw new Error(`${testId} did not render`);
      pointerDown(trigger);
      expect(Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
        .some((option) => option.textContent?.trim() === "System Field")).toBe(false);
      act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    }
  });

  it("keeps a first save authoritative while a structure write is delayed", async () => {
    queryResults.set("/api/v2/admin/rank-groups", [{ id: 7, name: "Deck", formId: 99 }]);
    queryResults.set("/api/v2/admin/forms/99/versions", [{
      id: 1, fvUuid: "created-draft", formId: 99, rankGroupId: 7,
      versionNo: "01", versionDate: "01-Jan-2026", status: "draft",
    }]);
    queryResults.set("admin-form-version-parts", partsForVersion("created-draft"));
    let finishStructureWrite: (() => void) | undefined;
    const structureWriteGate = new Promise<void>((resolve) => {
      finishStructureWrite = resolve;
    });
    const requestOrder: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/parts?formVersionUuid=")) {
        return { ok: true, json: async () => partsForVersion("created-draft") };
      }
      if (url.endsWith("/structures") && init?.method === "PUT") {
        requestOrder.push("structure-write-started");
        await structureWriteGate;
        requestOrder.push("structure-write-completed");
        return echoSavedStructures("created-draft", init);
      }
      if (url.includes("/structure")) {
        requestOrder.push("structure-loader");
        return { ok: true, json: async () => ({ sections: [] }) };
      }
      return { ok: true, json: async () => ({}) };
    }));

    const { editor, previewButton, onSave } = renderEditor({ rankGroupName: "Deck" });
    await flushAsyncWork();
    addValidSections(editor, 1, 2);
    click(editor.querySelector<HTMLElement>('[data-testid="button-save-form-structure"]')!);
    await flushAsyncWork();

    expect(requestOrder).toContain("structure-write-started");
    expect(onSave).not.toHaveBeenCalled();
    expect(editor.querySelectorAll('[data-testid^="card-section-"]')).toHaveLength(1);
    expect(editor.querySelectorAll('[data-testid^="card-point-"]')).toHaveLength(2);

    finishStructureWrite?.();
    await flushAsyncWork();
    await flushAsyncWork();

    expect(requestOrder.slice(-2)).toEqual(["structure-write-started", "structure-write-completed"]);
    expect(editor.querySelectorAll('[data-testid^="card-section-"]')).toHaveLength(1);
    expect(editor.querySelectorAll('[data-testid^="card-point-"]')).toHaveLength(2);
    expect(editor.querySelector('[data-testid="select-form-version"]')?.textContent).toContain("v01");
    expect(editor.querySelector('[data-testid="select-form-version"]')?.textContent).toContain("Draft");
    expect(editor.textContent).toContain("All changes saved");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      formId: 99,
      formVersionUuid: "created-draft",
      savedParts: 1,
    }));

    click(previewButton);
    expect(editor.querySelector('[data-testid="configured-form-preview"]')?.textContent).toContain("Section 1");
    expect(editor.querySelector('[data-testid="configured-form-preview"]')?.textContent).toContain("Point 1.2");
    click(editor.querySelector<HTMLElement>('[data-testid="button-configure-mode"]')!);
    click(editor.querySelector<HTMLElement>('[data-testid="button-add-section"]')!);
    setControlValue(
      editor.querySelector<HTMLInputElement>('[data-testid="input-section-title-2"]')!,
      "Second save section",
    );
    click(editor.querySelector<HTMLElement>('[data-testid="button-save-form-structure"]')!);
    await flushAsyncWork();
    await flushAsyncWork();

    expect((fetch as any).mock.calls.filter(([url, init]: [string, RequestInit]) =>
      url === "/api/v2/admin/forms/99/versions" && init?.method === "POST")).toHaveLength(0);
    expect((fetch as any).mock.calls.filter(([url, init]: [string, RequestInit]) =>
      url.endsWith("/structures") && init?.method === "PUT")).toHaveLength(2);
    expect(editor.querySelectorAll('[data-testid^="card-section-"]')).toHaveLength(2);
    expect(editor.textContent).toContain("All changes saved");
  });

  it("retains all 5 sections and 50 points from a fast save response", async () => {
    queryResults.set("/api/v2/admin/rank-groups", [{ id: 7, name: "Deck", formId: 99 }]);
    queryResults.set("/api/v2/admin/forms/99/versions", [{
      id: 1, fvUuid: "large-draft", formId: 99, rankGroupId: 7,
      versionNo: "01", versionDate: "01-Jan-2026", status: "draft",
    }]);
    queryResults.set("admin-form-version-parts", partsForVersion("large-draft"));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/parts?formVersionUuid=")) {
        return { ok: true, json: async () => partsForVersion("large-draft") };
      }
      if (url.endsWith("/structures") && init?.method === "PUT") {
        return echoSavedStructures("large-draft", init);
      }
      return { ok: true, json: async () => ({}) };
    }));

    const { editor, previewButton } = renderEditor({ rankGroupName: "Deck" });
    await flushAsyncWork();
    addValidSections(editor, 5, 10);
    click(editor.querySelector<HTMLElement>('[data-testid="button-save-form-structure"]')!);
    await flushAsyncWork();
    await flushAsyncWork();

    expect(editor.querySelectorAll('[data-testid^="card-section-"]')).toHaveLength(5);
    expect(editor.querySelectorAll('[data-testid^="card-point-"]')).toHaveLength(50);
    expect(editor.textContent).toContain("5 sections");
    expect(editor.textContent).toContain("50 points");
    expect(editor.textContent).toContain("All changes saved");
    click(previewButton);
    expect(editor.querySelector('[data-testid="configured-form-preview"]')?.textContent).toContain("Point 5.10");
  });

  it("keeps one mounted dialog while switching its content", () => {
    const { editor, previewButton } = renderEditor();
    expect(document.body.querySelectorAll('[role="dialog"][data-testid="generic-form-editor"]')).toHaveLength(1);
    click(previewButton);
    expect(document.body.querySelectorAll('[role="dialog"][data-testid="generic-form-editor"]')).toHaveLength(1);
    expect(editor.querySelector('[data-testid="configured-form-preview"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="configured-preview-portal"]')).toBeNull();
  });

  it("keeps page lock and returns from Preview with Escape", () => {
    const { editor, previewButton, onClose } = renderEditor();
    click(previewButton);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(onClose).not.toHaveBeenCalled();
    expect(editor.querySelector('[data-testid="configured-form-preview"]')).toBeNull();
  });

  it("yields Escape to an open portalled listbox", () => {
    const { editor, previewButton, onClose } = renderEditor();
    click(previewButton);
    const listbox = document.createElement("div");
    listbox.setAttribute("role", "listbox");
    document.body.appendChild(listbox);
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(editor.querySelector('[data-testid="configured-form-preview"]')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    listbox.remove();
  });

  it("renders editable Configure points as Preview-aligned table rows and retains save and dialog actions", async () => {
    loadEditableStructure();
    const { editor, previewButton, onSave } = renderEditor();
    await flushAsyncWork();
    await flushAsyncWork();

    const point = editor.querySelector<HTMLElement>('[data-testid="card-point-1-1"]');
    expect(point?.tagName).toBe("TR");
    expect(point?.closest("table")).toBeTruthy();
    expect(point?.querySelector('[data-testid="select-response-type-1-1"]')).toBeTruthy();
    expect(point?.querySelector('[data-testid="checkbox-point-mandatory-1-1"]')).toBeTruthy();
    expect(point?.querySelector('[data-testid="option-editor-1-1"]')).toBeTruthy();
    expect(point?.querySelector('[data-slot="badge"]')).toBeNull();
    expect(editor.textContent).toContain("No responsible party");

    const settingsButton = editor.querySelector<HTMLElement>('[data-testid="button-section-vessel-settings-1"]');
    if (!settingsButton) throw new Error("Section settings button did not render");
    click(settingsButton);
    expect(document.body.querySelector('[data-testid="section-settings-dialog"]')).toBeTruthy();

    const deleteButton = editor.querySelector<HTMLElement>('[data-testid="button-delete-point-1-1"]');
    if (!deleteButton) throw new Error("Point delete button did not render");
    click(deleteButton);
    expect(document.body.textContent).toContain("Delete point?");

    const cancelDelete = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Cancel");
    if (!cancelDelete) throw new Error("Delete confirmation cancel button did not render");
    click(cancelDelete);

    const saveButton = editor.querySelector<HTMLElement>('[data-testid="button-save-form-structure"]');
    if (!saveButton) throw new Error("Save button did not render");
    click(saveButton);
    await flushAsyncWork();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ formVersionUuid: "draft-version", savedParts: 1 }));

    click(previewButton);
    expect(editor.querySelector('[data-testid="configured-form-preview"]')).toBeTruthy();
  });

  it("keeps controlled Configure text focused while typing and preserves it when adding a point", async () => {
    loadEditableStructure();
    const { editor } = renderEditor();
    await flushAsyncWork();
    await flushAsyncWork();

    const sectionTitle = editor.querySelector<HTMLInputElement>('[data-testid="input-section-title-1"]');
    const pointText = editor.querySelector<HTMLTextAreaElement>('[data-testid="textarea-point-text-1-1"]');
    const optionLabel = editor.querySelector<HTMLInputElement>('[data-testid="input-option-label-1-1-1"]');
    if (!sectionTitle || !pointText || !optionLabel) throw new Error("Configure text controls did not render");

    await typeContinuously(sectionTitle, " continuous section title");
    await typeContinuously(pointText, " with a complete point sentence");
    await typeContinuously(optionLabel, " and a complete option label");

    expect(sectionTitle).toHaveValue("Navigation readiness continuous section title");
    expect(pointText).toHaveValue("Bridge team briefing completed with a complete point sentence");
    expect(optionLabel).toHaveValue("Yes and a complete option label");

    click(editor.querySelector<HTMLElement>('[data-testid="button-add-point-1"]')!);
    expect(sectionTitle).toHaveValue("Navigation readiness continuous section title");
    expect(pointText).toHaveValue("Bridge team briefing completed with a complete point sentence");
    expect(optionLabel).toHaveValue("Yes and a complete option label");
  });

  it("navigates every fixed part and shows the same placeholder in Configure and Preview", async () => {
    loadEditableStructure();
    const { editor, previewButton } = renderEditor();
    await flushAsyncWork();
    await flushAsyncWork();

    const partA = editor.querySelector<HTMLButtonElement>('[data-testid="button-step-draft-version-a"]');
    const partC = editor.querySelector<HTMLButtonElement>('[data-testid="button-step-draft-version-c"]');
    if (!partA || !partC) throw new Error("Fixed-part navigation controls did not render");

    expect(partA).not.toBeDisabled();
    expect(partC).not.toBeDisabled();

    click(partA);
    expect(editor.querySelector('[data-testid="preview-fixed-part-A"]')).toBeTruthy();
    click(partC);
    expect(editor.querySelector('[data-testid="preview-fixed-part-C"]')).toBeTruthy();

    click(previewButton);
    await flushAsyncWork();
    click(partA);
    expect(editor.querySelector('[data-testid="preview-fixed-part-A"]')).toBeTruthy();
    click(partC);
    expect(editor.querySelector('[data-testid="preview-fixed-part-C"]')).toBeTruthy();
  });

  it("keeps Preview response and comment inputs focused while typing", async () => {
    loadEditableStructure();
    const { editor, previewButton } = renderEditor();
    await flushAsyncWork();
    await flushAsyncWork();
    click(previewButton);
    await flushAsyncWork();

    const freeText = editor.querySelector<HTMLTextAreaElement>('textarea[data-testid^="preview-response-"]');
    const number = editor.querySelector<HTMLInputElement>('input[type="number"][data-testid^="preview-response-"]');
    const questionCommentButton = editor.querySelector<HTMLElement>('[data-testid^="button-preview-comment-"]');
    const sectionComment = editor.querySelector<HTMLTextAreaElement>('[data-testid^="preview-section-comment-input-"]');
    if (!freeText || !number || !questionCommentButton || !sectionComment) {
      throw new Error("Preview text controls did not render");
    }

    await typeContinuously(freeText, "free text response");
    await typeContinuously(number, "123");
    click(questionCommentButton);
    const questionComment = editor.querySelector<HTMLTextAreaElement>('textarea[data-testid^="preview-comment-"]');
    if (!questionComment) throw new Error("Preview question comment did not render");
    await typeContinuously(questionComment, "question comment");
    await typeContinuously(sectionComment, "section comment");

    expect(freeText).toHaveValue("free text response");
    expect(number).toHaveValue(123);
    expect(questionComment).toHaveValue("question comment");
    expect(sectionComment).toHaveValue("section comment");
  });
});