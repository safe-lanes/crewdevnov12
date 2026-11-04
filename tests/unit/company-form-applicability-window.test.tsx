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
  Object.defineProperty(window, "confirm", { configurable: true, writable: true, value: vi.fn(() => { throw Error("Native confirmation must not be used"); }) });
  mocks.api.mockReset();
  mocks.api.mockImplementation(async (method: string, path: string, payload?: unknown) => new Response(
    JSON.stringify(path.endsWith("rule-dimensions") ? [] : method === "PUT" ? { ...policy, ...(payload as object) } : policy),
    { status: 200, headers: { "Content-Type": "application/json" } },
  ));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const ready = () => screen.findByText(/Policy saved/);

describe("Company Form applicability window state", () => {
  it("cancel preserves conditions, obligation and date together; Escape cancels only the confirmation", async () => {
    render(<Harness />);
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Applies when conditions match", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Add crew group" }));
    fireEvent.click(screen.getByLabelText(/^optional$/i));
    fireEvent.click(screen.getByLabelText("On a specific date"));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: "2030-11-02" } });
    fireEvent.click(screen.getByRole("radio", { name: "Manual only", exact: true }));
    expect(await screen.findByText("Changing this mode will discard configured conditions and completion obligation and effective-date settings. Continue?")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getAllByText(/^Crew group \d$/)).toHaveLength(2);
    expect((screen.getByLabelText(/^optional$/i) as HTMLInputElement).checked).toBe(true);
    expect((document.querySelector('input[type="date"]') as HTMLInputElement).value).toBe("2030-11-02");
    expect(screen.getByTestId("company-form-applicability-window")).toBeTruthy();
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });
  it.each(["released", "draft"])("keeps a %s version's read-only settings frozen", async (status) => {
    const register = vi.fn();
    render(<CompanyFormApplicabilityEditor {...props} status={status} readOnly settingsOpen
      onSettingsClose={vi.fn()} onRegisterSaveHandler={register} />);
    await screen.findByTestId("applicability-summary");
    expect(screen.getByRole("heading", { name: "When this form applies — read only" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Applies to all", exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(/^optional$/i).closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.queryByTestId("company-form-rule-trial")).toBeNull();
    if (status === "released") expect(screen.queryByTestId("button-save-applicability")).toBeNull();
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });

  it("shows the draft trial inside the window only for conditional rules", async () => {
    render(<Harness />);
    await ready();
    expect(screen.getByRole("heading", { name: "When this form applies", exact: true })).toBeTruthy();
    expect(screen.getByText("Set the completion obligation, effective date and crew scope, then save these settings before releasing this version.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save settings" })).toBeTruthy();
    expect(screen.queryByTestId("company-form-rule-trial")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Applies when conditions match", exact: true }));
    expect(screen.getByText("The stage is set using the selector in the configuration header.")).toBeTruthy();
    expect(screen.getByTestId("company-form-applicability-window").contains(screen.getByTestId("company-form-rule-trial"))).toBe(true);
    const trial = screen.getByTestId("company-form-rule-trial");
    expect(screen.getByTestId("applicability-summary").compareDocumentPosition(trial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const conditions = screen.getByRole("heading", { name: "Conditions", exact: true });
    const obligation = screen.getByText("Completion obligation", { exact: true });
    expect(conditions.compareDocumentPosition(obligation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(obligation.compareDocumentPosition(screen.getByTestId("applicability-summary")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trial.compareDocumentPosition(screen.getByText("The stage is set using the selector in the configuration header.")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Manual only", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard conditions", exact: true }));
    await waitFor(() => expect(screen.queryByTestId("company-form-rule-trial")).toBeNull());
    expect(screen.queryByRole("heading", { name: "Conditions", exact: true })).toBeNull();
    expect(screen.queryByText("Completion obligation", { exact: true })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Applies to all", exact: true }));
    expect(screen.queryByTestId("company-form-rule-trial")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Conditions", exact: true })).toBeNull();
  });

  it("still confirms before discarding groups; cancel preserves them and accepting clears them", async () => {
    render(<Harness />);
    await ready();
    fireEvent.click(screen.getByRole("radio", { name: "Applies when conditions match", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Add crew group" }));
    expect(screen.getAllByText(/^Crew group \d$/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: "Applies to all", exact: true }));
    expect(await screen.findByText("Changing this mode will discard configured conditions. Continue?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing", exact: true }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getAllByText(/^Crew group \d$/)).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Applies when conditions match", exact: true }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Applies to all", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard conditions", exact: true }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Conditions", exact: true })).toBeNull());
    fireEvent.click(screen.getByRole("radio", { name: "Applies when conditions match", exact: true }));
    expect(screen.getAllByText(/^Crew group \d$/)).toHaveLength(1);
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });

  it("still confirms Manual only resets obligation and effective-date settings, with no retained state", async () => {
    render(<Harness />);
    await ready();
    fireEvent.click(screen.getByLabelText(/^optional$/i));
    fireEvent.click(screen.getByLabelText("On a specific date"));
    const date = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(date, { target: { value: "2030-11-02" } });
    fireEvent.click(screen.getByRole("radio", { name: "Manual only", exact: true }));
    expect(await screen.findByText("Changing this mode will discard completion obligation and effective-date settings. Continue?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing", exact: true }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect((screen.getByLabelText(/^optional$/i) as HTMLInputElement).checked).toBe(true);
    expect(date.value).toBe("2030-11-02");
    fireEvent.click(screen.getByRole("radio", { name: "Manual only", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard settings", exact: true }));
    await waitFor(() => expect(screen.queryByText("Completion obligation", { exact: true })).toBeNull());
    fireEvent.click(screen.getByRole("radio", { name: "Applies to all", exact: true }));
    expect((screen.getByLabelText(/^mandatory$/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("On release") as HTMLInputElement).checked).toBe(true);
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });

  it("asks before closing dirty settings and keeps edits when cancelled", async () => {
    render(<Harness />);
    await ready();
    fireEvent.click(screen.getByLabelText(/^optional$/i));
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    expect(await screen.findByText("Discard unsaved applicability changes and close this window?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing", exact: true }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByTestId("company-form-applicability-window")).toBeTruthy();
    expect((screen.getByLabelText(/^optional$/i) as HTMLInputElement).checked).toBe(true);
    expect(mocks.api.mock.calls.filter(([method]) => method === "PUT")).toHaveLength(0);
  });

  it("discards only the unsaved local edits on confirmed close", async () => {
    render(<Harness />);
    await ready();
    fireEvent.click(screen.getByLabelText(/^optional$/i));
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes", exact: true }));
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
