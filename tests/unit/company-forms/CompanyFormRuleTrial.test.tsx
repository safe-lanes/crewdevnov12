import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyFormRuleTrial } from "../../../client/src/components/company-forms/CompanyFormRuleTrial";
import type { ApplicabilityDraft, RulePreview } from "../../../shared/v2/admin/applicabilityPreview";

const { mockApiRequest } = vi.hoisted(() => ({ mockApiRequest: vi.fn() }));

vi.mock("../../../client/src/lib/queryClient", () => ({ apiRequest: mockApiRequest }));
vi.mock("../../../client/src/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    permissions: [{ menuName: "Forms", canview: true, canedit: false }],
    isLoading: false,
  }),
}));

const currentDraft: ApplicabilityDraft = {
  mode: "conditional",
  obligation: "mandatory",
  effectiveKind: "on_release",
  sets: [{
    setUuid: "saved-set",
    conditions: [{
      conditionUuid: "saved-condition",
      dimensionKey: "nationality",
      operator: "in",
      value: ["saved-value"],
    }],
  }],
};

function response(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe("CompanyFormRuleTrial", () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  it("checks the current displayed policy for a friendly crew assignment, even without edit permission", async () => {
    const preview: RulePreview = {
      outcome: "unresolved",
      explanation: "Nationality is not recorded for this assignment.",
      stageLabel: "Joining",
      timing: "From release",
      sets: [{
        outcome: "unresolved",
        conditions: [{
          label: "Nationality",
          outcome: "unresolved",
          observed: "Not recorded",
          explanation: "The source fact is not available.",
        }],
      }],
    };
    mockApiRequest.mockImplementation(async (method: string) => (
      method === "GET"
        ? response([{ subjectRef: "internal-subject-reference", label: "Asha Kaur — MV Silver Heron" }])
        : response(preview)
    ));
    render(
      <CompanyFormRuleTrial
        versionId={82}
        versionUuid="internal-version-reference"
        status="draft"
        stageKey="joining"
        stageBusy={false}
        policyBusy={false}
        policyDirty
        policy={currentDraft}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search by crew name or assignment"), {
      target: { value: "Asha" },
    });
    const assignment = await screen.findByRole("button", { name: "Asha Kaur — MV Silver Heron" });
    fireEvent.click(assignment);
    fireEvent.click(screen.getByRole("button", { name: "Check this draft" }));

    expect(await screen.findByText("Result: Needs more information")).toBeInTheDocument();
    expect(screen.getByText("This crew fact could not be verified. Ask an administrator to check the source record or master data.")).toBeInTheDocument();
    expect(screen.queryByText("The source fact is not available.")).not.toBeInTheDocument();
    expect(screen.getByText(/Stage: Joining · Timing: From release/)).toBeInTheDocument();
    expect(screen.getByText(/does not assess retrospective stage applicability/i)).toBeInTheDocument();
    expect(screen.queryByText("internal-subject-reference")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/v2/admin/form-versions/82/applicability/preview",
        { subjectRef: "internal-subject-reference", policy: currentDraft },
      );
    });
  });

  it("blocks a trial while the subject stage is being saved and hides trials outside draft status", () => {
    const { rerender } = render(
      <CompanyFormRuleTrial
        versionId={82}
        versionUuid="internal-version-reference"
        status="draft"
        stageKey="joining"
        stageBusy
        policyBusy={false}
        policyDirty={false}
        policy={currentDraft}
      />,
    );
    expect(screen.getByRole("button", { name: "Check this draft" })).toBeDisabled();
    expect(screen.getByText(/subject stage to finish saving/i)).toBeInTheDocument();

    rerender(
      <CompanyFormRuleTrial
        versionId={82}
        versionUuid="internal-version-reference"
        status="released"
        stageKey="joining"
        stageBusy={false}
        policyBusy={false}
        policyDirty={false}
        policy={currentDraft}
      />,
    );
    expect(screen.queryByTestId("company-form-rule-trial")).not.toBeInTheDocument();
  });
});
