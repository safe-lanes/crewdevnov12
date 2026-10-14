import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompanyFormApplicabilityEditor } from "../../client/src/components/company-forms/CompanyFormApplicabilityEditor";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: mocks.api }));
vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ isLoading: false, permissions: [{ menuName: "Forms", canview: true, canedit: true }] }),
}));
vi.mock("@/components/company-forms/CompanyFormRuleTrial", () => ({
  CompanyFormRuleTrial: () => <div data-testid="company-form-rule-trial">Read-only trial</div>,
}));

const policy = { mode: "all", obligation: "mandatory", effectiveKind: "on_release", effectiveFrom: null, sets: [] };
const props = { formId: 1, versionId: 2, versionUuid: "fixture-version", status: "draft", stageKey: "before_joining" };
function Harness({ onRegisterSaveHandler }: { onRegisterSaveHandler?: (uuid: string, save: () => Promise<boolean>) => void }) {
  const [open, setOpen] = useState(true);
  return <>
    <button onClick={() => setOpen(true)}>Open policy</button>
    <CompanyFormApplicabilityEditor {...props} settingsOpen={open} onSettingsClose={() => setOpen(false)}
      onRegisterSaveHandler={onRegisterSaveHandler} />
  </>;
}

beforeEach(() => {
  Object.defineProperty(window, "confirm", { configurable: true, writable: true, value: vi.fn(() => true) });
  mocks.api.mockReset();
  mocks.api.mockImplementation(async (method: string, path: string, payload?: unknown) => new Response(
    JSON.stringify(path.endsWith("rule-dimensions") ? [] : method === "PUT" ? { ...policy, ...(payload as object) } : policy),
    { status: 200, headers: { "Content-Type": "application/json" } },
  ));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const ready = () => screen.findByText(/Policy saved/);

describe("Company Form applicability window state", () => {
  it.each(["released", "draft"])("keeps a %s version's read-only settings frozen", async (status) => {
    const register = vi.fn();
    render(<CompanyFormApplicabilityEditor {...props} status={status} readOnly settingsOpen
      onSettingsClose={vi.fn()} onRegisterSaveHandler={register} />);
    await screen.findByTestId("applicability-summary");
    expect(screen.getByRole("heading", { name: "Applicability settings — read only" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Applies to all", exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(/^optional$/i).closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.queryByTestId("company-form-rule-trial")).toBeNull();
    if (status === "released") expect(screen.queryByTestId("button-save-applicability")).toBeNull();
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });

  it("shows the draft trial inside the window only for conditional rules", async () => {
    render(<Harness />);
    await ready();
    expect(screen.queryByTestId("company-form-rule-trial")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Applies when conditions match", exact: true }));
    expect(screen.getByTestId("company-form-applicability-window").contains(screen.getByTestId("company-form-rule-trial"))).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Manual only", exact: true }));
    expect(screen.queryByTestId("company-form-rule-trial")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Applies to all", exact: true }));
    expect(screen.queryByTestId("company-form-rule-trial")).toBeNull();
  });

  it("asks before closing dirty settings and keeps edits when cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Harness />);
    await ready();
    fireEvent.click(screen.getByLabelText(/^optional$/i));
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(confirm).toHaveBeenCalledWith("Discard unsaved applicability changes and close this window?");
    expect(screen.getByTestId("company-form-applicability-window")).toBeTruthy();
    expect((screen.getByLabelText(/^optional$/i) as HTMLInputElement).checked).toBe(true);
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });

  it("discards only the unsaved local edits on confirmed close", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness />);
    await ready();
    fireEvent.click(screen.getByLabelText(/^optional$/i));
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    await waitFor(() => expect(screen.queryByTestId("company-form-applicability-window")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Open policy" }));
    expect((await screen.findByLabelText(/^mandatory$/i) as HTMLInputElement).checked).toBe(true);
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });

  it("keeps the registered save safeguard and saved policy after closing the window", async () => {
    const register = vi.fn();
    const confirm = vi.spyOn(window, "confirm");
    render(<Harness onRegisterSaveHandler={register} />);
    await ready();
    fireEvent.click(screen.getByLabelText(/^optional$/i));
    fireEvent.click(screen.getByTestId("button-save-applicability"));
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    await waitFor(() => expect(screen.queryByTestId("company-form-applicability-window")).toBeNull());
    expect(confirm).not.toHaveBeenCalled();
    const handler = register.mock.calls.at(-1)?.[1] as () => Promise<boolean>;
    expect(await handler()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Open policy" }));
    expect((await screen.findByLabelText(/^optional$/i) as HTMLInputElement).checked).toBe(true);
  });
});
