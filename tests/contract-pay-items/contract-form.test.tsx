import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({
  rows: [] as any[], failure: false, urls: [] as string[],
  create: vi.fn(), update: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock("@/contexts/PermissionsContext", () => ({ usePermissions: () => ({ canEdit: () => true }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/accounts/contracts", vi.fn()] }));
vi.mock("@/lib/queryClient", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});
vi.mock("../../client/src/modules/accounts/api/accountsApiV2", () => ({
  ACCOUNTS_BASE: "/api/v2/accounts",
  parseApiError: (error: any) => ({ message: String(error) }),
  accountsApiV2: { engagements: { createPayItem: state.create, updatePayItem: state.update } },
}));
// Native selects make enabled/disabled semantics observable without portal geometry.
vi.mock("@/components/ui/select", async () => {
  const R = await import("react");
  function SelectItem(props: any) { return <option {...props} />; }
  function SelectTrigger(props: any) { return <>{props.children}</>; }
  function SelectValue() { return null; }
  function Select(props: any) {
    const options: any[] = [];
    let testId: string | undefined;
    let placeholder = "Choose element";
    function walk(children: any) {
      R.Children.forEach(children, child => {
        if (!R.isValidElement(child)) return;
        const p = child.props as any;
        if (child.type === SelectTrigger) testId = p["data-testid"];
        if (child.type === SelectValue && p.placeholder) placeholder = p.placeholder;
        if (child.type === SelectItem) options.push(child);
        else walk(p.children);
      });
    }
    walk(props.children);
    return <select data-testid={testId} value={props.value} disabled={props.disabled}
      onChange={event => props.onValueChange(event.target.value)}>
      <option value="">{placeholder}</option>{options}
    </select>;
  }
  return { Select, SelectTrigger, SelectItem,
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectValue };
});

import { queryClient } from "@/lib/queryClient";
import ContractDetailPage from "../../client/src/modules/accounts/pages/ContractDetailPage";
const elements = [
  { payElementUuid: "basic", code: "Basic", name: "Basic", status: "active" },
  { payElementUuid: "allowance", code: "Allowance", name: "Allowance", status: "active" },
  { payElementUuid: "inactive", code: "Old", name: "Allowance", status: "inactive" },
];
beforeEach(() => {
  queryClient.clear();
  state.rows = []; state.failure = false; state.urls = [];
  state.create.mockReset().mockResolvedValue({});
  state.update.mockReset().mockResolvedValue({});
  state.toast.mockClear();
  queryClient.setDefaultOptions({ queries: {
    retry: false, gcTime: 0,
    queryFn: async ({ queryKey }) => {
      const url = String(queryKey[0]);
      if (url.includes("pay-item-options?")) {
        state.urls.push(url);
        if (state.failure) throw new Error("Unavailable");
        const params = new URLSearchParams(url.split("?")[1]);
        const add = params.get("overrideMode") === "add_element";
        const future = params.get("effectiveFrom") === "2091-01-01";
        return { options: {
          basic: { disabled: add || future, reason: add ? "Already added" : future ? "Not currently added" : null },
          allowance: { disabled: !add, reason: add ? null : "Not currently added" },
          inactive: { disabled: true, reason: "Inactive" },
        } };
      }
      if (url.endsWith("/detail")) return {
        engagement: { engagementUuid: "eng", crewUuid: "crew", startDate: "2090-01-01",
          status: "active", scaleYearAtStart: 1 },
        crewName: "Test crew", scaleName: "Test scale", overrides: state.rows, frozen: false,
      };
      if (url.endsWith("/pay-elements")) return elements;
      if (url.endsWith("/config")) return { allowManualSeniorityAnchor: false };
      return [];
    },
  } });
});
async function open(edit = false, chooseMode = true) {
  render(<QueryClientProvider client={queryClient}><ContractDetailPage engagementUuid="eng" /></QueryClientProvider>);
  fireEvent.click(await screen.findByTestId(edit ? "button-edit-pay-item-old" : "button-add-pay-item"));
  if (!edit) {
    if (!chooseMode) return;
    fireEvent.change(screen.getByTestId("select-pay-item-mode"), {
      target: { value: "add_element" },
    });
  }
  await waitFor(() => expect(state.urls.length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.getByRole("option", { name: /Inactive/ })).toBeDisabled());
}
describe("Add/Edit pay-item form", () => {
  it("starts with no mode, disables elements, and resets when reopened", async () => {
    await open(false, false);
    expect(screen.getByTestId("select-pay-item-mode")).toHaveValue("");
    expect(screen.getByRole("option", { name: "select a mode" })).toBeInTheDocument();
    expect(screen.getByTestId("select-pay-item-element")).toBeDisabled();
    expect(screen.getByTestId("button-save-pay-item")).toBeDisabled();
    expect(state.urls).toHaveLength(0);
    fireEvent.change(screen.getByTestId("select-pay-item-mode"), {
      target: { value: "add_element" },
    });
    await waitFor(() => expect(state.urls.length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const requestCount = state.urls.length;
    fireEvent.click(screen.getByTestId("button-add-pay-item"));
    expect(screen.getByTestId("select-pay-item-mode")).toHaveValue("");
    expect(screen.getByTestId("select-pay-item-element")).toHaveValue("");
    expect(screen.getByTestId("select-pay-item-element")).toBeDisabled();
    expect(screen.getByTestId("button-save-pay-item")).toBeDisabled();
    expect(state.urls).toHaveLength(requestCount);
  });
  it.each([
    "add_element",
    "replace_scale_value",
    "suppress_element",
  ])("enables the element dropdown after selecting %s", async (mode) => {
    await open(false, false);
    fireEvent.change(screen.getByTestId("select-pay-item-mode"), {
      target: { value: mode },
    });
    expect(screen.getByTestId("select-pay-item-element")).not.toBeDisabled();
    await waitFor(() => {
      expect(state.urls.some(url =>
        new URLSearchParams(url.split("?")[1]).get("overrideMode") === mode
      )).toBe(true);
    });
  });
  it("shows Mode first and keeps unavailable choices visible with reasons", async () => {
    await open();
    const mode = screen.getByTestId("select-pay-item-mode");
    const element = screen.getByTestId("select-pay-item-element");
    expect(mode.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("option", { name: /Basic.*Already added/ })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Allowance — Allowance" })).not.toBeDisabled();
    expect(screen.getByRole("option", { name: /Inactive/ })).toBeDisabled();
  });
  it("refreshes choices and clears an invalid selection after changing mode", async () => {
    await open();
    fireEvent.change(screen.getByTestId("select-pay-item-element"), { target: { value: "allowance" } });
    fireEvent.change(screen.getByTestId("select-pay-item-mode"), { target: { value: "replace_scale_value" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /Allowance.*Not currently added/ })).toBeDisabled());
    expect(screen.getByTestId("select-pay-item-element")).toHaveValue("");
    expect(screen.getByRole("option", { name: "Basic — Basic" })).not.toBeDisabled();
  });
  it("saves suppression without amount or rate", async () => {
    await open();
    fireEvent.change(screen.getByTestId("select-pay-item-mode"), { target: { value: "suppress_element" } });
    await waitFor(() => expect(screen.getByRole("option", { name: "Basic — Basic" })).not.toBeDisabled());
    fireEvent.change(screen.getByTestId("select-pay-item-element"), { target: { value: "basic" } });
    expect(screen.queryByTestId("input-pay-item-amount")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-save-pay-item"));
    await waitFor(() => expect(state.create).toHaveBeenCalledWith("eng", expect.objectContaining({
      payElementUuid: "basic", overrideMode: "suppress_element", amount: null, rate: null,
    })));
  });
  it("retains a legacy selection and permits remarks-only saves", async () => {
    state.rows = [{ epeUuid: "old", payElementUuid: "basic", overrideMode: "add_element",
      amount: "100.00", rate: null, effectiveFrom: null, effectiveTo: null, remarks: "" }];
    await open(true);
    expect(screen.getByTestId("select-pay-item-mode")).toHaveValue("add_element");
    expect(screen.getByTestId("select-pay-item-element")).not.toBeDisabled();
    expect(screen.getByTestId("select-pay-item-element")).toHaveValue("basic");
    expect(screen.getByTestId("button-save-pay-item")).not.toBeDisabled();
    fireEvent.change(screen.getByTestId("input-pay-item-amount"), { target: { value: "101" } });
    expect(screen.getByTestId("button-save-pay-item")).toBeDisabled();
    fireEvent.change(screen.getByTestId("input-pay-item-amount"), { target: { value: "100" } });
    fireEvent.click(screen.getByTestId("button-save-pay-item"));
    await waitFor(() => expect(state.update).toHaveBeenCalled());
  });
  it("fails closed when eligibility cannot be loaded", async () => {
    state.failure = true;
    render(<QueryClientProvider client={queryClient}><ContractDetailPage engagementUuid="eng" /></QueryClientProvider>);
    fireEvent.click(await screen.findByTestId("button-add-pay-item"));
    fireEvent.change(screen.getByTestId("select-pay-item-mode"), {
      target: { value: "add_element" },
    });
    await screen.findByRole("alert");
    expect(screen.getByTestId("button-save-pay-item")).toBeDisabled();
    expect(screen.getByRole("option", { name: "Allowance — Allowance" })).toBeDisabled();
  });
});
