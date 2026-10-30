import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emptyCompanyFormGrants } from "@shared/v2/admin/companyFormPermissions";

const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mock.request(...args) }));
import { CompanyFormsPermissionEditor } from "@/modules/admin/CompanyFormsPermissionEditor";

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  mock.request.mockImplementation(async () => ({ json: async () => ({ grants: emptyCompanyFormGrants() }) }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });
async function boot() {
  render(<QueryClientProvider client={client}><CompanyFormsPermissionEditor roleId="fixture-role" /></QueryClientProvider>);
  await screen.findByRole("checkbox", { name: "Witness", exact: true });
}
describe("Company Forms permission card presentation", () => {
  it("explains the actions and category/vessel limits, retaining seven checkboxes and the separate Save", async () => {
    await boot();
    const card = screen.getByTestId("company-forms-permissions");
    expect(within(card).getByRole("heading", { name: "Company Forms" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Office or Vessel category");
    expect(card).toHaveTextContent("vessels they may access");
    expect(within(card).getAllByRole("checkbox")).toHaveLength(7);
    expect(screen.getByTestId("save-company-form-permissions")).toBeDisabled();
  });
  it.each([
    ["Witness", "acting user’s own identity recorded as the witness"],
    ["Sign as Company Representative", "office user"],
    ["Void", "has not been completed"],
    ["Void completed", "has already been completed"],
    ["Override checklist", "does not allow overriding unfinished required forms"],
  ])("opens tap help for %s without changing its permission or saving", async (label, text) => {
    await boot();
    fireEvent.click(screen.getByRole("button", { name: `Help: ${label}`, exact: true }));
    const explanation = await screen.findByRole("dialog");
    expect(explanation).toHaveTextContent(text);
    expect(screen.getByRole("checkbox", { name: label, exact: true })).not.toBeChecked();
    expect(screen.getByTestId("save-company-form-permissions")).toBeDisabled();
    expect(mock.request.mock.calls.filter(([method]) => method !== "GET")).toHaveLength(0);
  });
  it("shows hover help without changing the permission", async () => {
    await boot();
    fireEvent.pointerMove(screen.getByRole("button", { name: "Help: Witness" }), { pointerType: "mouse" });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("recorded as the witness");
    expect(screen.getByRole("checkbox", { name: "Witness", exact: true })).not.toBeChecked();
  });
  it("keeps the existing independent payload and retains edits on failed save", async () => {
    await boot();
    mock.request.mockImplementation(async (method: string) => {
      if (method === "PUT") throw Error("deliberate test failure");
      return { json: async () => ({ grants: emptyCompanyFormGrants() }) };
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Witness", exact: true }));
    fireEvent.click(screen.getByTestId("save-company-form-permissions"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to save Company Forms permissions. Please retry."));
    expect(mock.request).toHaveBeenCalledWith("PUT", "/api/v2/admin/access-control/roles/fixture-role/action-permissions",
      { grants: { ...emptyCompanyFormGrants(), witness: true } });
    expect(screen.getByRole("checkbox", { name: "Witness", exact: true })).toBeChecked();
    expect(screen.getByTestId("save-company-form-permissions")).toBeEnabled();
  });
});
