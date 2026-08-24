import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ConfiguredFormRenderer,
  type ConfiguredFormPart,
  type ConfiguredFormSection,
} from "../../client/src/components/configured-form/ConfiguredFormRenderer";

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

function renderPreview(sections: ConfiguredFormSection[] = [configuredSection], vesselType = "all") {
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
  it("navigates every part and renders a fixed-part placeholder", () => {
    renderPreview();

    expect(screen.getByTestId("preview-fixed-part-A")).toHaveTextContent("purpose-built");
    click(screen.getByTestId("button-preview-part-B"));
    expect(screen.getByTestId("preview-section-section-one")).toBeInTheDocument();
    click(screen.getByTestId("button-preview-part-C"));
    expect(screen.getByTestId("preview-fixed-part-C")).toHaveTextContent("purpose-built");
  });

  it("renders every configured response type with option labels only", () => {
    renderPreview();
    click(screen.getByTestId("button-preview-part-B"));

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
  });

  it("shows preview-only comments, signatures, and stable required indicators without fetches", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    renderPreview();
    click(screen.getByTestId("button-preview-part-B"));

    click(screen.getByTestId("button-preview-comment-yes-no"));
    expect(screen.getByTestId("preview-comment-yes-no")).toBeInTheDocument();
    expect(screen.getByTestId("preview-section-comment-section-one")).toBeInTheDocument();
    expect(screen.getByTestId("preview-signature-section-one")).toHaveTextContent("Signature placeholder");
    expect(screen.getByTestId("preview-required-yes-no")).toHaveTextContent("Required");
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
    click(screen.getByTestId("button-preview-part-B"));

    expect(screen.getByTestId("missing-section-title-incomplete")).toHaveTextContent("Section title not configured");
    expect(screen.getByTestId("missing-responsible-incomplete")).toHaveTextContent("Responsible party not configured");
    expect(screen.getByTestId("preview-point-label-missing-text")).toHaveTextContent("Point text not configured");
    expect(screen.getByTestId("missing-options-missing-options")).toHaveTextContent("No options configured");
  });

  it("renders a neutral responsibility state when responsibility is not applicable", () => {
    const noResponsibleParty: ConfiguredFormSection = {
      ...configuredSection,
      clientKey: "not-applicable",
      responsible_mode: "not_applicable",
      responsible_role_uuid: null,
      responsible_department: null,
    };
    renderPreview([noResponsibleParty]);
    click(screen.getByTestId("button-preview-part-B"));

    expect(screen.getByTestId("responsible-not-applicable-not-applicable")).toHaveTextContent("No responsible party");
    expect(screen.queryByTestId("missing-responsible-not-applicable")).toBeNull();
  });

  it("marks vessel-restricted sections as not applicable and preserves preview section state", () => {
    const { rerender } = renderPreview([configuredSection], "bulk");
    click(screen.getByTestId("button-preview-part-B"));
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
    click(screen.getByTestId("button-preview-section-toggle-section-one"));
    expect(screen.getByTestId("preview-point-yes-no")).toBeInTheDocument();
  });
});