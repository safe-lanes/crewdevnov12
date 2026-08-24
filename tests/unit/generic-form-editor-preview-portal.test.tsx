import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenericFormEditor } from "../../client/src/components/GenericFormEditor";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    }),
  };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let activeContainer: HTMLDivElement | null = null;
let activeRoot: Root | null = null;

function renderEditor() {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);
  activeRoot = createRoot(activeContainer);
  const onClose = vi.fn();

  act(() => {
    activeRoot?.render(
      <GenericFormEditor
        form={{ id: 99 } as any}
        formName="Crew Briefing"
        configurableParts={[
          { formPartUuid: "part-b", partCode: "B", partTitle: "Crew discussion", partType: "configurable" },
        ]}
        onClose={onClose}
        onSave={vi.fn()}
      />,
    );
  });

  const editor = document.querySelector<HTMLElement>('[data-testid="generic-form-editor"]');
  const previewButton = document.querySelector<HTMLElement>('[data-testid="button-preview-mode"]');
  if (!editor || !previewButton) throw new Error("Generic Form Editor did not render");

  return { editor, previewButton, onClose };
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function previewPortal(): HTMLElement {
  const portal = document.body.querySelector<HTMLElement>('[data-testid="configured-preview-portal"]');
  if (!portal) throw new Error("Preview portal did not render");
  return portal;
}

function editorOverlay(): HTMLElement {
  const overlay = Array.from(document.body.querySelectorAll<HTMLElement>('[data-state="open"]'))
    .find((element) => element.className.includes("bg-black/80"));
  if (!overlay) throw new Error("Editor overlay did not render");
  return overlay;
}

function openPreview() {
  const rendered = renderEditor();
  const overlay = editorOverlay();
  click(rendered.previewButton);
  return { ...rendered, overlay, portal: previewPortal() };
}

afterEach(() => {
  act(() => {
    activeRoot?.unmount();
  });
  activeContainer?.remove();
  activeRoot = null;
  activeContainer = null;
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

describe("GenericFormEditor Preview portal", () => {
  it("PASS: keeps the editor mounted while Preview is a visible body-level sibling and hides its overlay", () => {
    const { editor, overlay, portal } = openPreview();

    expect(portal.parentElement).toBe(document.body);
    expect(editor.parentElement).toBe(document.body);
    expect(portal).toHaveAttribute("data-preview-visible", "true");
    expect(portal).not.toHaveClass("z-[201]");
    expect(editor).toHaveClass("invisible", "pointer-events-none");
    expect(editor).toHaveAttribute("aria-hidden", "true");
    expect(editor).toHaveAttribute("inert");
    expect(overlay).toHaveClass("hidden");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("PASS: Preview pointer activity does not dismiss the hidden editor", () => {
    const { editor, onClose, portal } = openPreview();

    click(portal);

    expect(onClose).not.toHaveBeenCalled();
    expect(editor).toBeInTheDocument();
  });

  it("PASS: Tab focus stays within Preview controls", () => {
    const { editor, portal } = openPreview();
    const focusable = Array.from(portal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getAttribute("aria-hidden") !== "true");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) throw new Error("Preview did not expose focusable controls");

    act(() => {
      last.focus();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(first);
    expect(editor.contains(document.activeElement)).toBe(false);
  });

  it("PASS: Escape restores Configure instead of dismissing the editor", () => {
    const { editor, overlay, onClose, portal } = openPreview();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(portal).toHaveAttribute("data-preview-visible", "false");
    expect(editor).not.toHaveClass("invisible", "pointer-events-none");
    expect(editor).not.toHaveAttribute("inert");
    expect(overlay).not.toHaveClass("hidden");
    expect(document.body.style.overflow).toBe("");
  });

  it("PASS: Preview Back restores the mounted editor", () => {
    const { editor, overlay, portal } = openPreview();
    const backButton = portal.querySelector<HTMLElement>("button");
    if (!backButton) throw new Error("Preview Back button did not render");

    click(backButton);

    expect(portal).toHaveAttribute("data-preview-visible", "false");
    expect(editor).toBeInTheDocument();
    expect(editor).not.toHaveClass("invisible");
    expect(overlay).not.toHaveClass("hidden");
  });
});