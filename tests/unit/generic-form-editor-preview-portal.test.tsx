import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenericFormEditor } from "@/components/GenericFormEditor";

const queryResults = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: unknown[] }) => ({
      data: queryResults.get(String(options.queryKey?.[0])) ?? [],
      isLoading: false,
      refetch: vi.fn(),
    }),
  };
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderEditor() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const onClose = vi.fn();
  const onSave = vi.fn();
  act(() => {
    root?.render(
      <GenericFormEditor
        form={{ id: 99 } as any}
        formName="Safety review"
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
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
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

    const partA = editor.querySelector<HTMLButtonElement>('[data-testid="button-step-part-a"]');
    const partC = editor.querySelector<HTMLButtonElement>('[data-testid="button-step-part-c"]');
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