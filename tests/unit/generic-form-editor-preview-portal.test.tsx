import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenericFormEditor } from "@/components/GenericFormEditor";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) };
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderEditor() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const onClose = vi.fn();
  act(() => {
    root?.render(
      <GenericFormEditor
        form={{ id: 99 } as any}
        formName="Safety review"
        configurableParts={[{ formPartUuid: "part-b", partCode: "B", partTitle: "Deck briefing", partType: "configurable" }]}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );
  });
  const editor = document.body.querySelector<HTMLElement>('[data-testid="generic-form-editor"]');
  const previewButton = document.body.querySelector<HTMLButtonElement>('[data-testid="button-preview-mode"]');
  if (!editor || !previewButton) throw new Error("Editor did not render");
  return { editor, previewButton, onClose };
}

function click(element: HTMLElement) {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.body.style.overflow = "";
  vi.restoreAllMocks();
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
});