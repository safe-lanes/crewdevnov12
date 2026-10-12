import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyFormApplicabilityEditor } from "../../../client/src/components/company-forms/CompanyFormApplicabilityEditor";
import type { VersionApplicability } from "../../../shared/v2/admin/applicability";

const testState = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  permissions: [] as Array<{ menuName: string; canview?: boolean; canedit?: boolean }>,
  permissionsLoading: false,
  summary: vi.fn(),
}));

vi.mock("../../../client/src/lib/queryClient", () => ({ apiRequest: testState.apiRequest }));
vi.mock("../../../client/src/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    permissions: testState.permissions,
    isLoading: testState.permissionsLoading,
  }),
}));

const crewDimension = {
  key: "nationality",
  label: "Nationality",
  kind: "scalar",
  operators: ["in"],
  available: true,
  choices: [{ id: "in", label: "Indian" }],
};

const conditionalPolicy: VersionApplicability = {
  versionUuid: "version-reference",
  mode: "conditional",
  obligation: "mandatory",
  effectiveKind: "on_release",
  specificDate: null,
  effectiveFrom: null,
  copiedFromVersionUuid: null,
  sets: [{
    setUuid: "set-reference",
    conditions: [{
      conditionUuid: "condition-reference",
      dimensionKey: "nationality",
      operator: "in",
      value: ["in"],
      valueLabels: [{ id: "in", label: "Indian" }],
    }],
  }],
};

function response(value: unknown): Response {
  return { ok: true, json: async () => value } as Response;
}

function configureApi(policy = conditionalPolicy) {
  testState.apiRequest.mockImplementation(async (_method: string, url: string) => (
    url.endsWith("/rule-dimensions")
      ? response([crewDimension])
      : response(policy)
  ));
}

function renderEditor(status = "draft") {
  return render(
    <CompanyFormApplicabilityEditor
      formId={8}
      versionId={82}
      versionUuid="version-reference"
      status={status}
      stageKey=""
      settingsOpen
      onSettingsClose={vi.fn()}
      onSummaryChange={testState.summary}
    />,
  );
}

describe("CompanyFormApplicabilityEditor permissions and frozen cards", () => {
  beforeEach(() => {
    testState.apiRequest.mockReset();
    testState.summary.mockReset();
    testState.permissionsLoading = false;
    testState.permissions = [{ menuName: "Forms", canview: true, canedit: true }];
  });

  it("fails closed when the Forms permission entry is missing", async () => {
    testState.permissions = [{ menuName: "Another menu", canview: true, canedit: true }];
    renderEditor();

    await waitFor(() => expect(testState.summary).toHaveBeenCalledWith(expect.any(String),
      expect.objectContaining({ canView: false, canEdit: false })));
    expect(screen.queryByTestId("company-form-applicability-window")).not.toBeInTheDocument();
    expect(testState.apiRequest).not.toHaveBeenCalled();
  });

  it("allows viewing but keeps policy controls read-only without explicit Forms edit permission", async () => {
    testState.permissions = [{ menuName: "Forms", canview: true, canedit: false }];
    configureApi({ ...conditionalPolicy, mode: "all", sets: [] });
    renderEditor();

    expect(await screen.findByText("You can view these settings, but Forms edit permission is needed to change them.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Applies when conditions match" })).toBeDisabled();
    expect(screen.queryByTestId("button-save-applicability")).not.toBeInTheDocument();
  });

  it("freezes released condition cards and omits the draft trial", async () => {
    configureApi();
    renderEditor("released");

    expect(await screen.findByText("Indian")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove crew group 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove condition" })).toBeDisabled();
    expect(screen.getByLabelText("Crew detail")).toBeDisabled();
    expect(screen.queryByTestId("company-form-rule-trial")).not.toBeInTheDocument();
  });

  it("registers an async save handler that reports the server save result", async () => {
    testState.apiRequest.mockImplementation(async (method: string, url: string, body?: any) => {
      if (method === "GET") {
        return url.endsWith("/rule-dimensions") ? response([crewDimension]) : response({ ...conditionalPolicy, mode: "all", sets: [] });
      }
      if (method === "PUT" && url.endsWith("/applicability")) {
        return response({
          ...conditionalPolicy,
          mode: body.mode,
          obligation: body.obligation ?? null,
          effectiveKind: body.effectiveKind ?? null,
          sets: body.sets ?? [],
        });
      }
      throw new Error("Unexpected request");
    });
    let registeredSave: (() => Promise<boolean>) | null = null;
    const onRegisterSaveHandler = vi.fn((_versionUuid: string, save: () => Promise<boolean>) => {
      registeredSave = save;
      return () => { registeredSave = null; };
    });
    const { unmount } = render(
      <CompanyFormApplicabilityEditor
        formId={8}
        versionId={82}
        versionUuid="version-reference"
        status="draft"
        stageKey=""
        settingsOpen
        onSettingsClose={vi.fn()}
        onRegisterSaveHandler={onRegisterSaveHandler}
      />,
    );
    await screen.findByText("Policy saved");
    fireEvent.click(screen.getByRole("radio", { name: "Manual only" }));
    await waitFor(() => expect(registeredSave).toBeTypeOf("function"));
    let saved = false;
    await act(async () => {
      saved = await registeredSave!();
    });

    expect(saved).toBe(true);
    expect(testState.apiRequest).toHaveBeenCalledWith(
      "PUT",
      "/api/v2/admin/form-versions/82/applicability",
      { mode: "manual_only" },
    );
    unmount();
    expect(registeredSave).toBeNull();
  });

  it("clarifies that a specific date is compared with the actual release date", async () => {
    configureApi({ ...conditionalPolicy, mode: "all", sets: [] });
    renderEditor();
    await screen.findByText("Policy saved");

    fireEvent.click(screen.getByRole("radio", { name: /On a specific date/ }));
    expect(screen.getByText("This date is checked against the actual release date, not the version date.")).toBeInTheDocument();
  });
});
