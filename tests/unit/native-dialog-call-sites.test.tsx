import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ElementLineRow from "../../client/src/components/wage/ElementLineRow";
import { PartG } from "../../client/src/components/form-editor-parts/PartG";
import { PlaceholderChart } from "../../client/src/modules/rest-hours/components/PlaceholderChart";
import CbaReferencePage from "../../client/src/modules/accounts/pages/CbaReferencePage";
import { queryClient } from "../../client/src/lib/queryClient";

const mocks = vi.hoisted(() => ({
  upsertLine: vi.fn(),
  deleteLine: vi.fn(),
  removeCba: vi.fn(),
}));

vi.mock("../../client/src/store/wageRuns", () => ({
  useWageRun: () => ({
    upsertLine: mocks.upsertLine,
    deleteLine: mocks.deleteLine,
    isSaving: false,
  }),
}));

vi.mock("../../client/src/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("../../client/src/components/charts/ChartToolbar", () => ({
  ChartToolbar: ({ onDownload }: { onDownload?: () => void }) => (
    <button type="button" onClick={onDownload}>Trigger chart download</button>
  ),
}));

vi.mock("../../client/src/contexts/PermissionsContext", () => ({
  usePermissions: () => ({
    canCreate: () => true,
    canEdit: () => true,
    canDelete: () => true,
  }),
}));

vi.mock("../../client/src/modules/accounts/api/accountsApiV2", () => ({
  ACCOUNTS_BASE: "/api/v2/accounts",
  accountsApiV2: {
    cbaReference: {
      remove: mocks.removeCba,
    },
  },
  parseApiError: (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
  }),
}));

vi.mock("../../client/src/modules/accounts/pages/AccountsGridTable", () => ({
  default: ({ rowData = [], columnDefs = [] }: any) => {
    const actionColumn = columnDefs.find((column: any) => column.headerName === "Actions");
    if (!actionColumn) return null;
    const ActionCell = actionColumn.cellRenderer;
    return (
      <div>
        {rowData.map((row: any) => (
          <ActionCell key={row.cbaRefUuid} data={row} />
        ))}
      </div>
    );
  },
}));

const line = {
  id: "line-1",
  name: "Sea allowance",
  code: "SEA",
  basis: "fixed",
  amount: 125,
  type: "EARNING",
  isManual: false,
} as any;

const followup = {
  id: "training-1",
  training: "Bridge Resource Management",
  correspondingInDB: "",
  category: "",
  status: "Proposed",
  targetDate: "",
  comment: "Existing note",
};

const partGProps = (overrides: Record<string, unknown> = {}) => ({
  formMethods: { register: () => ({}) } as any,
  isConfigMode: false,
  getDynamicSectionLetter: (section: string) => section,
  trainingFollowups: [followup],
  trainingFollowupComments: {},
  setTrainingFollowupComments: vi.fn(),
  trainingCategoryOptions: [],
  trainingStatusOptions: ["Proposed"],
  addTrainingFollowup: vi.fn(),
  updateTrainingFollowup: vi.fn(),
  deleteTrainingFollowup: vi.fn(),
  ...overrides,
});

const cbaRow = {
  cbaRefUuid: "cba-fixture-1",
  cbaName: "Atlantic Officers Agreement",
  rankId: null,
  payElementUuid: null,
  category: null,
  minimumAmount: "2400.00",
  currency: "USD",
  effectiveFrom: null,
  effectiveTo: null,
  sourceNote: null,
};

const renderCbaPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Infinity } },
  });
  client.setQueryData(["/api/v2/accounts/cba-reference"], [cbaRow]);
  client.setQueryData(["/api/v2/admin/company-ranks"], []);
  client.setQueryData(["/api/v2/accounts/pay-elements"], []);
  return render(
    <QueryClientProvider client={client}>
      <CbaReferencePage />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  mocks.upsertLine.mockReset();
  mocks.deleteLine.mockReset();
  mocks.removeCba.mockReset();
  mocks.deleteLine.mockResolvedValue(undefined);
  mocks.removeCba.mockResolvedValue(undefined);
  for (const method of ["confirm", "prompt", "alert"] as const) {
    Object.defineProperty(window, method, {
      configurable: true,
      writable: true,
      value: vi.fn(() => {
        throw new Error(`Native window.${method} must not be called`);
      }),
    });
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("native dialog call-site replacements", () => {
  it("ElementLineRow preserves the exact delete question and performs no delete on cancel", async () => {
    const { container } = render(<ElementLineRow line={line} crewId="crew-1" editable />);
    const deleteButton = container.querySelector("button.text-red-600");
    expect(deleteButton).not.toBeNull();
    fireEvent.click(deleteButton!);

    expect(await screen.findByText("Are you sure you want to delete Sea allowance?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep pay element" }));
    await waitFor(() => expect(mocks.deleteLine).not.toHaveBeenCalled());
  });

  it("ElementLineRow deletes only after the AlertDialog action is accepted", async () => {
    const { container } = render(<ElementLineRow line={line} crewId="crew-1" editable />);
    fireEvent.click(container.querySelector("button.text-red-600")!);
    await screen.findByText("Are you sure you want to delete Sea allowance?");
    fireEvent.click(screen.getByRole("button", { name: "Delete pay element" }));

    await waitFor(() => expect(mocks.deleteLine).toHaveBeenCalledWith("crew-1", "line-1"));
  });

  it("PartG keeps the exact comment prompt and its initial text; cancel leaves the comment untouched", async () => {
    const updateTrainingFollowup = vi.fn();
    const props = partGProps({
      trainingFollowupComments: { "training-1": "Current note" },
      updateTrainingFollowup,
    });
    render(<PartG {...(props as any)} />);
    fireEvent.click(screen.getByTestId("button-followup-comment-0"));

    const input = await screen.findByRole("textbox", { name: "Enter comment:" });
    expect(input).toHaveValue("Current note");
    fireEvent.click(screen.getByRole("button", { name: "Keep comment" }));
    expect(updateTrainingFollowup).not.toHaveBeenCalled();
    expect(props.setTrainingFollowupComments).not.toHaveBeenCalled();
  });

  it("PartG accepts an empty comment as a real value rather than treating it as cancellation", async () => {
    const updateTrainingFollowup = vi.fn();
    const setTrainingFollowupComments = vi.fn();
    render(<PartG {...(partGProps({
      trainingFollowupComments: { "training-1": "Existing note" },
      setTrainingFollowupComments,
      updateTrainingFollowup,
    }) as any)} />);
    fireEvent.click(screen.getByTestId("button-followup-comment-0"));

    const input = await screen.findByRole("textbox", { name: "Enter comment:" });
    expect(input).toHaveValue("Existing note");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save comment" }));

    await waitFor(() => expect(setTrainingFollowupComments).toHaveBeenCalledWith(expect.any(Function)));
    expect(updateTrainingFollowup).toHaveBeenCalledWith("training-1", "comment", "");
  });

  it("PlaceholderChart renders the exact download notice and closes it through the product dialog", async () => {
    render(<PlaceholderChart title="Monthly rest hours" />);
    fireEvent.click(screen.getByRole("button", { name: "Trigger chart download" }));

    expect(await screen.findByText("Download functionality will be implemented for Monthly rest hours chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => {
      expect(screen.queryByText("Download functionality will be implemented for Monthly rest hours chart")).not.toBeInTheDocument();
    });
  });

  it("PlaceholderChart notice can be dismissed without calling a browser alert", async () => {
    render(<PlaceholderChart title="Annual rest hours" />);
    fireEvent.click(screen.getByRole("button", { name: "Trigger chart download" }));
    expect(await screen.findByText("Download functionality will be implemented for Annual rest hours chart")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Download functionality will be implemented for Annual rest hours chart")).not.toBeInTheDocument();
    });
  });

  it("CBA reference deletion is not sent on cancel and uses the exact row-specific prompt", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined as any);
    renderCbaPage();
    fireEvent.click(await screen.findByTestId("button-delete-cba-cba-fixture-1"));

    expect(await screen.findByText('Delete CBA reference "Atlantic Officers Agreement"?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep reference" }));
    expect(mocks.removeCba).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("CBA reference deletion occurs only after the AlertDialog action is accepted", async () => {
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined as any);
    renderCbaPage();
    fireEvent.click(await screen.findByTestId("button-delete-cba-cba-fixture-1"));

    expect(await screen.findByText('Delete CBA reference "Atlantic Officers Agreement"?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete reference" }));
    await waitFor(() => expect(mocks.removeCba).toHaveBeenCalledWith("cba-fixture-1"));
  });
});
