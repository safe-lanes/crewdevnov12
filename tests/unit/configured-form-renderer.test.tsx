import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfiguredFormRenderer,
  type ConfiguredFormPart,
  type ConfiguredFormSection,
} from "../../client/src/components/configured-form/ConfiguredFormRenderer";
import { sailDesignSystem } from "../../client/src/config/sailDesignSystem";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const parts: ConfiguredFormPart[] = [
  { formPartUuid: "part-a", partCode: "A", partTitle: "Preparation", partType: "fixed" },
  { formPartUuid: "part-b", partCode: "B", partTitle: "Crew discussion", partType: "configurable" },
  { formPartUuid: "part-c", partCode: "C", partTitle: "Office review", partType: "fixed" },
];

const configuredSection: ConfiguredFormSection = {
  clientKey: "section-one",
  section_code: "B1",
  section_title: "Safety readiness",
  applicable_vessel_types: ["tanker"],
  responsible_mode: "role",
  responsible_role_uuid: "master",
  responsible_department: null,
  comment_box_required: true,
  signature_required: true,
  questions: [
    { clientKey: "yes-no", question_code: "B1.1", question_text: "Is the vessel ready?", response_type: "yes_no", is_mandatory: true, comment_enabled: true, options: [] },
    { clientKey: "yes-no-na", question_code: "B1.2", question_text: "Is equipment available?", response_type: "yes_no_na", is_mandatory: false, comment_enabled: true, options: [] },
    { clientKey: "single", question_code: "B1.3", question_text: "Select readiness", response_type: "single_select", is_mandatory: false, comment_enabled: false, options: [{ clientKey: "ready", option_label: "Ready for work", option_value: "ready_for_work" }] },
    { clientKey: "multi", question_code: "B1.4", question_text: "Select equipment", response_type: "multi_select", is_mandatory: false, comment_enabled: false, options: [{ clientKey: "radio", option_label: "Radio checked", option_value: "radio_checked" }] },
    { clientKey: "text", question_code: "B1.5", question_text: "Add detail", response_type: "free_text", is_mandatory: false, comment_enabled: false, options: [] },
    { clientKey: "date", question_code: "B1.6", question_text: "Inspection date", response_type: "date", is_mandatory: false, comment_enabled: false, options: [] },
    { clientKey: "number", question_code: "B1.7", question_text: "Crew count", response_type: "number", is_mandatory: false, comment_enabled: false, options: [] },
    { clientKey: "checkbox", question_code: "B1.8", question_text: "Confirm briefing", response_type: "checkbox", is_mandatory: false, comment_enabled: false, options: [] },
    { clientKey: "info", question_code: "B1.9", question_text: "Read this guidance", response_type: "info_only", is_mandatory: false, comment_enabled: false, options: [] },
  ],
};

let activeContainer: HTMLDivElement | null = null;
let activeRoot: Root | null = null;

function findByTestId(testId: string): HTMLElement {
  const element = activeContainer?.querySelector(`[data-testid="${testId}"]`);
  if (!element) throw new Error(`Unable to find data-testid="${testId}"`);
  return element as HTMLElement;
}

function queryByTestId(testId: string): HTMLElement | null {
  return activeContainer?.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
}

function findByText(text: string): HTMLElement {
  const element = Array.from(activeContainer?.querySelectorAll("*") || [])
    .find((candidate) => candidate.textContent?.trim().includes(text));
  if (!element) throw new Error(`Unable to find text "${text}"`);
  return element as HTMLElement;
}

function queryByText(text: string): HTMLElement | null {
  const element = Array.from(activeContainer?.querySelectorAll("*") || [])
    .find((candidate) => candidate.textContent?.trim().includes(text));
  return element ? element as HTMLElement : null;
}

const screen = {
  getByTestId: findByTestId,
  queryByTestId,
  getByText: findByText,
  queryByText,
};

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setNativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (!setNativeValue) throw new Error("Native textarea value setter is unavailable");
  act(() => {
    setNativeValue.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function finishEditing(textarea: HTMLTextAreaElement) {
  act(() => {
    textarea.focus();
    textarea.blur();
  });
}

function pointerDown(element: HTMLElement) {
  const pointerTarget = element as HTMLElement & {
    hasPointerCapture?: (pointerId: number) => boolean;
    releasePointerCapture?: (pointerId: number) => void;
  };
  // happy-dom does not currently implement the pointer-capture methods that
  // Radix Select's native pointer handler calls in real browsers.
  pointerTarget.hasPointerCapture ??= () => false;
  pointerTarget.releasePointerCapture ??= () => undefined;

  act(() => {
    element.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerType: "mouse",
    }));
  });
}

function portalOption(label: string): HTMLElement {
  const option = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!option) throw new Error(`Unable to find open option "${label}"`);
  return option;
}

function render(element: React.ReactElement) {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);
  activeRoot = createRoot(activeContainer);
  act(() => {
    activeRoot?.render(element);
  });
  return {
    rerender(next: React.ReactElement) {
      act(() => {
        activeRoot?.render(next);
      });
    },
  };
}

function renderPreview(
  sections: ConfiguredFormSection[] = [configuredSection],
  vesselType = "all",
) {
  return render(
    <ConfiguredFormRenderer
      mode="preview"
      formTitle="Crew Briefing"
      parts={parts}
      structures={{ "part-b": sections }}
      roles={[{ ruid: "master", assignedRole: "Master", isActive: true, isDeleted: false }]}
      departments={["Marine Operations"]}
      vesselTypes={[
        { vtUuid: "tanker", name: "Tanker" },
        { vtUuid: "bulk", name: "Bulk Carrier" },
      ]}
      selectedVesselTypeUuid={vesselType}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    activeRoot?.unmount();
  });
  activeContainer?.remove();
  activeContainer = null;
  activeRoot = null;
});

describe("configured form renderer preview", () => {
  it("separates the preview banner from content using section spacing", () => {
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));

    const banner = screen.getByTestId("preview-only-banner");
    const content = screen.getByTestId("configured-form-content");
    const sectionStack = screen.getByTestId("configured-section-stack");

    expect(banner.nextElementSibling).toBe(content);
    expect(content.style.marginTop).toBe(sailDesignSystem.spacing.sectionSpacing);
    expect(sectionStack.style.gap).toBe(sailDesignSystem.spacing.sectionSpacing);
  });

  it("navigates every part and renders a fixed-part placeholder", () => {
    renderPreview();

    expect(screen.getByTestId("preview-fixed-part-A")).toHaveTextContent("purpose-built");
    click(screen.getByTestId("button-step-part-b"));
    expect(screen.getByTestId("preview-section-section-one")).toBeInTheDocument();
    click(screen.getByTestId("button-step-part-c"));
    expect(screen.getByTestId("preview-fixed-part-C")).toHaveTextContent("purpose-built");
  });

  it("PASS: Preview stepper controls switch between configured and fixed parts", () => {
    renderPreview();

    click(screen.getByTestId("button-step-part-b"));
    expect(screen.getByTestId("preview-section-section-one")).toBeInTheDocument();

    click(screen.getByTestId("button-step-part-c"));
    expect(screen.getByTestId("preview-fixed-part-C")).toBeInTheDocument();
  });

  it("PASS: Preview vessel selector opens and changes the applicable sections", () => {
    render(
      <ConfiguredFormRenderer
        mode="preview"
        formTitle="Crew Briefing"
        parts={parts}
        structures={{ "part-b": [configuredSection] }}
        vesselTypes={[
          { vtUuid: "tanker", name: "Tanker" },
          { vtUuid: "bulk", name: "Bulk Carrier" },
        ]}
      />,
    );
    click(screen.getByTestId("button-step-part-b"));
    const trigger = screen.getByTestId("select-preview-vessel-type").querySelector<HTMLElement>('[role="combobox"]');
    if (!trigger) throw new Error("Preview vessel selector did not render a combobox");

    pointerDown(trigger);
    expect(document.body.querySelector('[role="listbox"]')).toBeInTheDocument();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(document.body.querySelector('[role="listbox"]')).toBeNull();

    pointerDown(trigger);
    expect(document.body.querySelector('[role="listbox"]')).toBeInTheDocument();
    click(portalOption("Bulk Carrier"));

    expect(screen.getByTestId("preview-section-not-applicable-section-one")).toHaveTextContent("Bulk Carrier");
  });

  it("PASS: Preview response controls accept checkbox and single-select answers", () => {
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));

    const checkbox = screen.getByTestId("preview-response-checkbox").querySelector<HTMLElement>('[role="checkbox"]');
    if (!checkbox) throw new Error("Preview checkbox did not render");
    click(checkbox);
    expect(checkbox).toHaveAttribute("data-state", "checked");

    const trigger = screen.getByTestId("preview-response-single").querySelector<HTMLElement>('[role="combobox"]');
    if (!trigger) throw new Error("Preview single-select did not render a combobox");
    pointerDown(trigger);
    expect(document.body.querySelector('[role="listbox"]')).toBeInTheDocument();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(document.body.querySelector('[role="listbox"]')).toBeNull();

    pointerDown(trigger);
    expect(document.body.querySelector('[role="listbox"]')).toBeInTheDocument();
    click(portalOption("Ready for work"));

    expect(trigger).toHaveTextContent("Ready for work");
  });

  it("PASS: Preview comment controls open and accept typed text", () => {
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));
    click(screen.getByTestId("button-preview-comment-yes-no"));
    const comment = screen.getByTestId("preview-comment-yes-no") as HTMLTextAreaElement;

    act(() => {
      comment.value = "Reviewed during preview";
      comment.dispatchEvent(new Event("input", { bubbles: true }));
      comment.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(comment).toHaveValue("Reviewed during preview");
  });

  it("PASS: Preview sections collapse and expand", () => {
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));
    const toggle = screen.getByTestId("button-preview-section-toggle-section-one");

    click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("preview-point-yes-no")).toBeNull();

    click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("preview-point-yes-no")).toBeInTheDocument();
  });

  it("renders every configured response type with option labels only", () => {
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));

    expect(screen.getByTestId("preview-response-yes-no")).toBeInTheDocument();
    expect(screen.getByTestId("preview-response-yes-no-na")).toBeInTheDocument();
    expect(screen.getByTestId("preview-response-single")).toBeInTheDocument();
    expect(screen.getByTestId("preview-response-multi")).toHaveTextContent("Radio checked");
    expect(screen.getByTestId("preview-response-text")).toHaveAttribute("placeholder", "Enter a response");
    expect(screen.getByTestId("preview-response-date")).toHaveAttribute("type", "date");
    expect(screen.getByTestId("preview-response-number")).toHaveAttribute("type", "number");
    expect(screen.getByTestId("preview-response-checkbox")).toHaveTextContent("Confirm");
    expect(screen.getByTestId("preview-response-info")).toHaveTextContent("Information only");
    expect(screen.getByText("Master")).toBeInTheDocument();
    expect(screen.queryByText("ready_for_work")).not.toBeInTheDocument();
    expect(screen.queryByText("Single Selection")).toBeNull();
    expect(screen.getByText("Crew Briefing · Preview")).toBeInTheDocument();
  });

  it("renders through the Base form stepper with no save controls or fetches", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));

    expect(activeContainer?.querySelectorAll('[data-testid^="button-step-"]')).toHaveLength(6);
    expect(activeContainer?.querySelector('[data-testid="button-save-draft"]')).toBeNull();
    expect(screen.getByTestId("preview-point-yes-no").tagName).toBe("TR");
    click(screen.getByTestId("button-preview-comment-yes-no"));
    expect(screen.getByTestId("preview-comment-yes-no")).toBeInTheDocument();
    expect(screen.getByTestId("preview-comment-row-yes-no").tagName).toBe("TR");
    expect(screen.getByTestId("preview-comment-row-yes-no").previousElementSibling).toBe(screen.getByTestId("preview-point-yes-no"));
    expect(screen.getByTestId("preview-section-comment-section-one")).toBeInTheDocument();
    expect(screen.getByTestId("preview-signature-section-one")).toHaveTextContent("Signature placeholder");
    expect(screen.getByTestId("preview-signature-name-section-one")).toHaveAttribute("placeholder", "Name");
    expect(screen.getByTestId("preview-section-footer-section-one")).toHaveTextContent("To be completed by: Master");
    expect(screen.getByTestId("preview-required-yes-no")).toHaveTextContent("*");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders explicit inline messages for incomplete configuration", () => {
    const incomplete: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "incomplete",
      section_title: "",
      responsible_mode: "role",
      responsible_role_uuid: null,
      questions: [
        { clientKey: "missing-text", question_code: "B1.1", question_text: "", response_type: "yes_no", is_mandatory: false, comment_enabled: false, options: [] },
        { clientKey: "missing-options", question_code: "B1.2", question_text: "Choose an option", response_type: "single_select", is_mandatory: false, comment_enabled: false, options: [] },
      ],
    };
    renderPreview([incomplete]);
    click(screen.getByTestId("button-step-part-b"));

    expect(screen.getByTestId("missing-section-title-incomplete")).toHaveTextContent("Section title not configured");
    expect(screen.getByTestId("missing-responsible-incomplete")).toHaveTextContent("Responsible party not configured");
    expect(screen.getByTestId("missing-point-text-missing-text")).toHaveTextContent("Point text not configured");
    expect(screen.getByTestId("missing-options-missing-options")).toHaveTextContent("No options configured");
  });

  it("omits the responsibility line when responsibility is not applicable", () => {
    const noResponsibleParty: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "not-applicable",
      responsible_mode: "not_applicable",
      responsible_role_uuid: null,
      responsible_department: null,
    };
    renderPreview([noResponsibleParty]);
    click(screen.getByTestId("button-step-part-b"));

    expect(screen.queryByTestId("responsible-not-applicable-not-applicable")).toBeNull();
    expect(screen.getByTestId("preview-section-footer-not-applicable")).toBeInTheDocument();
    expect(screen.queryByTestId("missing-responsible-not-applicable")).toBeNull();
  });

  it("collapses the footer when no footer content is configured", () => {
    const noFooter: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "empty-footer",
      responsible_mode: "not_applicable",
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
    };
    renderPreview([noFooter]);
    click(screen.getByTestId("button-step-part-b"));

    expect(screen.queryByTestId("preview-section-footer-empty-footer")).toBeNull();
    expect(screen.queryByText("No responsible party · Not applicable")).toBeNull();
  });

  it("keeps the department responsibility line in the footer", () => {
    const departmentSection: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "department",
      responsible_mode: "department",
      responsible_role_uuid: null,
      responsible_department: "Marine Operations",
      comment_box_required: false,
      signature_required: false,
    };
    renderPreview([departmentSection]);
    click(screen.getByTestId("button-step-part-b"));

    expect(screen.getByTestId("responsible-department-department")).toHaveTextContent(
      "To be completed by: Marine Operations",
    );
    expect(screen.getByTestId("preview-section-footer-department")).toBeInTheDocument();
  });

  it("retains local collapsed state when the shared shell rerenders", () => {
    const { rerender } = renderPreview();
    click(screen.getByTestId("button-step-part-b"));
    click(screen.getByTestId("button-preview-section-toggle-section-one"));
    rerender(
      <ConfiguredFormRenderer
        mode="preview"
        formTitle="Crew Briefing"
        parts={parts}
        structures={{ "part-b": [configuredSection] }}
      />,
    );
    expect(screen.getByTestId("preview-section-section-one")).toBeInTheDocument();
    expect(screen.queryByTestId("preview-point-yes-no")).toBeNull();
  });

  it("marks vessel-restricted sections as not applicable and preserves preview section state", () => {
    const { rerender } = renderPreview([configuredSection], "bulk");
    click(screen.getByTestId("button-step-part-b"));
    expect(screen.getByTestId("preview-section-not-applicable-section-one")).toHaveTextContent("Bulk Carrier");

    rerender(
      <ConfiguredFormRenderer
        mode="preview"
        formTitle="Crew Briefing"
        parts={parts}
        structures={{ "part-b": [configuredSection] }}
        roles={[{ ruid: "master", assignedRole: "Master" }]}
        departments={["Marine Operations"]}
        vesselTypes={[{ vtUuid: "tanker", name: "Tanker" }]}
        selectedVesselTypeUuid="tanker"
      />,
    );
    expect(screen.getByTestId("preview-point-yes-no")).toBeInTheDocument();

    click(screen.getByTestId("button-preview-section-toggle-section-one"));
    expect(screen.queryByTestId("preview-point-yes-no")).not.toBeInTheDocument();
    expect(screen.queryByTestId("preview-section-footer-section-one")).toBeNull();
    expect(screen.queryByTestId("preview-signature-section-one")).toBeNull();
    click(screen.getByTestId("button-preview-section-toggle-section-one"));
    expect(screen.getByTestId("preview-point-yes-no")).toBeInTheDocument();
  });

  it("renders a server-resolved matrix with option headers and select controls", () => {
    const scale = [
      { clientKey: "one", option_label: "1", option_value: "1" },
      { clientKey: "two", option_label: "2", option_value: "2" },
    ];
    const matrixSection: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "matrix",
      effectiveLayout: "matrix",
      questions: [
        { clientKey: "matrix-single", question_code: "B1.1", question_text: "Rate readiness", response_type: "single_select", is_mandatory: false, comment_enabled: true, options: scale },
        { clientKey: "matrix-multi", question_code: "B1.2", question_text: "Choose evidence", response_type: "multi_select", is_mandatory: false, comment_enabled: false, options: scale },
      ],
    };
    renderPreview([matrixSection]);
    click(screen.getByTestId("button-step-part-b"));

    expect(screen.getByTestId("preview-matrix-section-matrix")).toHaveTextContent("1");
    expect(screen.getByTestId("preview-matrix-section-matrix")).toHaveTextContent("2");
    expect(screen.getByTestId("matrix-option-matrix-single-1")).toHaveAttribute("type", "radio");
    expect(screen.getByTestId("matrix-option-matrix-multi-1")).toHaveAttribute("type", "checkbox");
    expect(screen.queryByTestId("preview-point-matrix-single")).toBeNull();
  });

  it("uses regular Appraisal-style point text and shared header typography in list and matrix layouts", () => {
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));

    const listPoint = screen.getByTestId("preview-point-yes-no");
    const listPointCell = listPoint.querySelector("td");
    if (!listPointCell) throw new Error("List point cell did not render");
    const listPointCode = listPointCell.querySelector("label");
    if (!listPointCode) throw new Error("List point code did not render");
    expect(listPointCode).toHaveClass("text-gray-500");
    expect(listPointCode).not.toHaveClass("font-semibold", "font-bold");

    const listPointText = Array.from(listPointCell.querySelectorAll("span"))
      .find((span) => span.textContent?.includes("Is the vessel ready?"));
    if (!listPointText) throw new Error("List point text did not render");
    expect(listPointText).toHaveClass("text-[#4f5863]", "text-[13px]", "font-normal");
    expect(listPointText).not.toHaveClass("font-semibold", "font-bold");

    const listHeaders = Array.from(activeContainer?.querySelectorAll("th") || []);
    expect(listHeaders).toHaveLength(3);
    const listHeaderRow = activeContainer?.querySelector("thead");
    if (!listHeaderRow) throw new Error("List header row did not render");
    expect(listHeaderRow).toHaveClass("bg-gray-100");
    for (const header of listHeaders) {
      expect(header).toHaveClass("text-gray-600", "text-xs", "font-normal");
      expect(header).not.toHaveClass("font-semibold", "font-bold");
    }

    const matrixSection: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "typography-matrix",
      effectiveLayout: "matrix",
      questions: [{
        clientKey: "typography-matrix-question",
        question_code: "B1.1",
        question_text: "Rate readiness",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: false,
        options: [
          { clientKey: "one", option_label: "1", option_value: "1" },
          { clientKey: "two", option_label: "2", option_value: "2" },
        ],
      }],
    };
    renderPreview([matrixSection]);
    click(screen.getByTestId("button-step-part-b"));

    const matrixPoint = screen.getByTestId("preview-matrix-point-typography-matrix-question");
    const matrixPointSpans = Array.from(matrixPoint.querySelectorAll("span"));
    const matrixPointCode = matrixPointSpans.find((span) => span.textContent === "B1.1");
    const matrixPointText = matrixPointSpans.find((span) => span.textContent === "Rate readiness");
    if (!matrixPointCode || !matrixPointText) throw new Error("Matrix point typography did not render");
    expect(matrixPointCode).toHaveClass("text-gray-600", "text-xs", "font-normal");
    expect(matrixPointCode).not.toHaveClass("font-semibold", "font-bold");
    expect(matrixPointText).toHaveClass("text-[#4f5863]", "text-[13px]", "font-normal");
    expect(matrixPointText).not.toHaveClass("font-semibold", "font-bold");

    const matrixHeaders = Array.from(activeContainer?.querySelectorAll("th") || []);
    expect(matrixHeaders).toHaveLength(4);
    for (const header of matrixHeaders) {
      expect(header).toHaveClass("bg-gray-100", "text-gray-600", "text-xs", "font-normal");
      expect(header).not.toHaveClass("font-semibold", "font-bold");
    }
  });

  it("shows numeric-scale endpoint descriptors separately from matrix headers and list choices", () => {
    const scale = [
      { clientKey: "one", option_label: "1", option_value: "1" },
      { clientKey: "two", option_label: "2", option_value: "2" },
    ];
    const matrixSection: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "described-matrix",
      effectiveLayout: "matrix",
      questions: [{
        clientKey: "described-matrix-question",
        question_code: "B1.1",
        question_text: "Rate readiness",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: false,
        low_end_label: "Poor",
        high_end_label: "Excellent",
        options: scale,
      }],
    };
    renderPreview([matrixSection]);
    click(screen.getByTestId("button-step-part-b"));
    expect(screen.getByTestId("matrix-end-label-described-matrix-low")).toHaveTextContent("Poor");
    expect(screen.getByTestId("matrix-end-label-described-matrix-high")).toHaveTextContent("Excellent");

    const listSection: ConfiguredFormSection = {
      ...matrixSection,
      clientKey: "described-list",
      effectiveLayout: "list",
      questions: [{ ...matrixSection.questions[0], clientKey: "described-list-question" }],
    };
    renderPreview([listSection]);
    click(screen.getByTestId("button-step-part-b"));
    const trigger = screen.getByTestId("preview-response-described-list-question").querySelector<HTMLElement>('[role="combobox"]');
    if (!trigger) throw new Error("List-scale select did not render a combobox");
    pointerDown(trigger);
    expect(portalOption("1 — Poor")).toBeInTheDocument();
    expect(portalOption("2 — Excellent")).toBeInTheDocument();
  });

  it("uses Appraisal-style muted comment icons and distinguishes entered list and matrix comments", () => {
    renderPreview();
    click(screen.getByTestId("button-step-part-b"));

    const listCommentButton = screen.getByTestId("button-preview-comment-yes-no");
    expect(listCommentButton).toHaveClass("h-6", "w-6", "text-gray-500", "hover:bg-transparent", "hover:text-gray-700");
    expect(listCommentButton).not.toHaveClass("bg-blue-600", "border");
    click(listCommentButton);
    const listComment = screen.getByTestId("preview-comment-yes-no") as HTMLTextAreaElement;
    setTextareaValue(listComment, "Bridge team confirmed the checklist.");
    finishEditing(listComment);
    const listCommentDisplay = screen.getByTestId("preview-comment-display-yes-no");
    expect(listCommentDisplay).toHaveTextContent("Bridge team confirmed the checklist.");
    expect(listCommentDisplay).toHaveClass("text-blue-600", "italic");

    const matrixSection: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "comment-matrix",
      effectiveLayout: "matrix",
      questions: [{
        clientKey: "comment-matrix-question",
        question_code: "B1.1",
        question_text: "Rate readiness",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: true,
        options: [{ clientKey: "one", option_label: "1", option_value: "1" }],
      }],
    };
    renderPreview([matrixSection]);
    click(screen.getByTestId("button-step-part-b"));

    const matrixCommentButton = screen.getByTestId("button-preview-comment-comment-matrix-question");
    expect(matrixCommentButton).toHaveClass("h-6", "w-6", "text-gray-500", "hover:bg-transparent", "hover:text-gray-700");
    expect(matrixCommentButton).not.toHaveClass("bg-blue-600", "border");
    click(matrixCommentButton);
    const matrixComment = screen.getByTestId("preview-comment-comment-matrix-question") as HTMLTextAreaElement;
    setTextareaValue(matrixComment, "Observed during the toolbox talk.");
    finishEditing(matrixComment);
    const matrixCommentDisplay = screen.getByTestId("preview-comment-display-comment-matrix-question");
    expect(matrixCommentDisplay).toHaveTextContent("Observed during the toolbox talk.");
    expect(matrixCommentDisplay).toHaveClass("text-blue-600", "italic");
  });

  it("uses the same matrix rendering branch for live hosts", () => {
    const onAnswerChange = vi.fn();
    const liveSection: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "live-matrix",
      effectiveLayout: "matrix",
      questions: [{
        clientKey: "live-single",
        question_code: "B1.1",
        question_text: "Rate readiness",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: false,
        options: [{ clientKey: "one", option_label: "1", option_value: "1" }],
      }],
    };
    render(
      <ConfiguredFormRenderer
        mode="live"
        embedded
        parts={[parts[1]]}
        structures={{ "part-b": [liveSection] }}
        selectedPartUuid="part-b"
        live={{ answers: {}, onAnswerChange }}
      />,
    );

    const choice = screen.getByTestId("matrix-option-live-single-1");
    click(choice);
    expect(screen.getByTestId("configured-form-live")).toBeInTheDocument();
    expect(onAnswerChange).toHaveBeenCalledWith("live-single", "1");
  });

  it("keeps live save and submit actions available without optional footer content", () => {
    const onAnswerChange = vi.fn();
    const liveSection: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "live-no-responsibility",
      responsible_mode: "not_applicable",
      responsible_role_uuid: null,
      responsible_department: null,
      comment_box_required: false,
      signature_required: false,
      questions: [{
        clientKey: "live-no-responsibility-question",
        question_code: "B1.1",
        question_text: "Confirm readiness",
        response_type: "yes_no",
        is_mandatory: false,
        comment_enabled: false,
        options: [],
      }],
    };
    render(
      <ConfiguredFormRenderer
        mode="live"
        embedded
        parts={[parts[1]]}
        structures={{ "part-b": [liveSection] }}
        selectedPartUuid="part-b"
        live={{ answers: {}, onAnswerChange }}
      />,
    );

    expect(screen.getByTestId("configured-form-live")).toBeInTheDocument();
    expect(screen.queryByTestId("responsible-not-applicable-live-no-responsibility")).toBeNull();
    expect(screen.getByTestId("preview-section-footer-live-no-responsibility")).toBeInTheDocument();
    expect(screen.getByText("Save draft")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });

  it("disables every matrix response for a live section the user does not own", () => {
    const onAnswerChange = vi.fn();
    const section: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "readonly-live",
      effectiveLayout: "matrix",
      questions: [{
        clientKey: "readonly-question",
        question_code: "B1.1",
        question_text: "Rate readiness",
        response_type: "single_select",
        is_mandatory: false,
        comment_enabled: false,
        options: [{ clientKey: "one", option_label: "1", option_value: "1" }],
      }],
    };
    render(<ConfiguredFormRenderer mode="live" embedded parts={[parts[1]]} structures={{ "part-b": [section] }} selectedPartUuid="part-b" live={{ answers: {}, onAnswerChange, sectionOwnership: { "readonly-live": { ownerLabel: "Other role", canEdit: false } } }} />);
    const option = screen.getByTestId("matrix-option-readonly-question-1") as HTMLInputElement;
    expect(option.disabled).toBe(true);
    expect(screen.queryByText("Submit")).toBeNull();
  });
});