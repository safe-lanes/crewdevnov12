import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mocks = vi.hoisted(() => ({
  state: { allowed: true, mode: "name_bootstrap", eligibleManagerCount: 0, categoryReady: false, recoveryRoute: "interim_names" },
  grants: { reviewer: false, manager: true } as Record<string, boolean>,
  policy: { blockExpiringDuringContract: false, blockMissingExpiry: false },
  saveManagement: vi.fn(), request: vi.fn(), saveMenu: vi.fn(), toast: vi.fn(),
  roles: [
    { id: 1, ruid: "reviewer", assignedRole: "Fixture Reviewer", roletype: "Office", isActive: true },
    { id: 2, ruid: "manager", assignedRole: "Fixture Manager", roletype: "Office", isActive: true },
  ],
  menus: [{ id: 1, muid: "crew", name: "Crew Database", displayName: null, parentMenu: null }],
  permissions: [],
}));
vi.mock("@/contexts/PermissionsContext", () => ({ usePermissions: () => ({ accessControlManagement: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/admin/CompanyDocumentBranding", () => ({
  CompanyDocumentBranding: () => <button>Company PDF branding</button>,
}));
vi.mock("@/modules/admin/AccessAuditHistory", () => ({
  AccessAuditHistory: () => <button>Access audit history</button>,
}));
vi.mock("@/modules/admin/CompanyFormsPermissionEditor", () => ({ CompanyFormsPermissionEditor: () => <div>Company Forms permissions</div> }));
vi.mock("@/modules/admin/api/adminApiV2", () => ({
  adminApiV2: {
    getAccessControlState: async () => ({ ...mocks.state }),
    getRoleManagementGrant: async (id: string) => ({ allowed: mocks.grants[id] }),
    saveRoleManagementGrant: (...args: unknown[]) => mocks.saveManagement(...args),
  },
}));
vi.mock("@/modules/admin/hooks/useAdminV2", () => ({
  useAccessControlMenusV2: () => ({ data: mocks.menus, isLoading: false }),
  useAccessControlRolesV2: () => ({ data: mocks.roles, isLoading: false }),
  useAccessControlPermissionsV2: () => ({ data: mocks.permissions, isLoading: false }),
  useSaveAccessControlPermissionsV2: () => ({ mutate: mocks.saveMenu, isPending: false }),
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mocks.request(...args) }));
import AccessControlPage from "@/modules/admin/AccessControlPage";

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.state, { allowed: true, mode: "name_bootstrap", eligibleManagerCount: 0, categoryReady: false, recoveryRoute: "interim_names" });
  Object.assign(mocks.policy, { blockExpiringDuringContract: false, blockMissingExpiry: false });
  mocks.saveManagement.mockImplementation(async (role: string, allowed: boolean) => {
    mocks.grants[role] = allowed;
    return { allowed };
  });
  Object.assign(mocks.grants, { reviewer: false, manager: true });
  mocks.request.mockImplementation(async (method: string, url: string, body?: unknown) => {
    if (url.endsWith("/settings")) {
      if (method === "PUT") Object.assign(mocks.policy, body);
      return { json: async () => ({ ...mocks.policy }) };
    }
    return { json: async () => ({ allowed: false }) };
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });
async function boot(role = "reviewer") {
  render(<QueryClientProvider client={client}><AccessControlPage /></QueryClientProvider>);
  await screen.findByTestId("training-expiring-current-effect");
  await screen.findByRole("checkbox", { name: "Management access granted" });
  if (role !== "reviewer") {
    fireEvent.change(screen.getByLabelText("Choose role for management grant"), { target: { value: role } });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Management access granted" }))
      .toHaveAttribute("aria-checked", String(mocks.grants[role])));
  }
}
async function review(role = "reviewer") {
  await boot(role);
  fireEvent.click(screen.getByRole("checkbox", { name: "Management access granted" }));
  fireEvent.click(screen.getByTestId("button-review-management-grant"));
  return screen.findByRole("alertdialog");
}
describe("Access Control configure-once panels", () => {
  it("shows explanations in tooltips rather than inline while preserving accessible descriptions", async () => {
    await boot();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    for (const id of ["training-expiring", "training-missing-expiry"]) {
      const description = document.getElementById(`${id}-description`)!;
      expect(description).toHaveClass("sr-only");
      fireEvent.pointerMove(document.getElementById(`${id}-title`)!, { pointerType: "mouse" });
      expect(await screen.findByRole("tooltip")).toHaveTextContent(description.textContent!);
      fireEvent.pointerLeave(document.getElementById(`${id}-title`)!, { pointerType: "mouse" });
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    }
  });
  it("places both panels after the permission grid, retaining both top buttons", async () => {
    await boot();
    const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const grid = screen.getByTestId("access-control-permissions");
    const policy = screen.getByTestId("training-compliance-policy");
    const management = screen.getByTestId("management-grants-panel");
    expect(before(grid, policy)).toBe(true);
    expect(before(policy, management)).toBe(true);
    expect(before(screen.getByRole("button", { name: "Access audit history" }), grid)).toBe(true);
    expect(before(screen.getByRole("button", { name: "Company PDF branding" }), grid)).toBe(true);
  });
  it("pairs each checkbox with its own heading and describes saved effects, not unsaved selections", async () => {
    await boot();
    const block = screen.getByTestId("training-expiring-policy-block");
    expect(within(block).getByRole("checkbox")).toHaveAccessibleName("Block seafarer deployment when mandatory courses expiring during contract");
    expect(screen.getByTestId("training-expiring-current-effect")).toHaveTextContent("Warning only");
    fireEvent.click(within(block).getByRole("checkbox"));
    expect(screen.getByTestId("training-expiring-current-effect")).toHaveTextContent("Warning only");
    expect(screen.getByTestId("training-expiring-unsaved")).toBeVisible();
    const missing = screen.getByTestId("training-missing-expiry-policy-block");
    expect(within(missing).getByRole("checkbox")).toHaveAccessibleName("Block seafarer deployment when a mandatory certificate's expiry is not recorded");
    fireEvent.click(screen.getByTestId("save-training-compliance-policy"));
    await waitFor(() => expect(screen.getByTestId("training-expiring-current-effect")).toHaveTextContent("Blocking"));
    expect(mocks.request).toHaveBeenCalledWith("PUT", "/api/v2/admin/training-compliance/settings",
      { blockExpiringDuringContract: true, blockMissingExpiry: false });
    expect(mocks.saveManagement).not.toHaveBeenCalled();
    expect(mocks.saveMenu).not.toHaveBeenCalled();
  });
  it("explains the temporary name route and parent-owned category in plain words", async () => {
    await boot();
    expect(screen.getByTestId("management-mode-explanation")).toHaveTextContent("Admin, Super Admin or Sail Admin");
    expect(screen.getByTestId("management-recovery-banner")).toHaveTextContent("enable Management access and save");
    expect(screen.getByTestId("management-recovery-banner")).toHaveTextContent("name-based route closes");
    expect(screen.getByText(/Not supplied by the parent application/)).toBeVisible();
  });
  it.each([["reviewer", true, "Fixture Reviewer"], ["manager", false, "Fixture Manager"]] as const)(
    "requires confirmation before changing management for %s", async (role, allowed, name) => {
      const dialog = await review(role);
      expect(dialog).toHaveTextContent(name);
      expect(dialog).toHaveTextContent(allowed ? "Grant management access?" : "Remove management access?");
      expect(mocks.saveManagement).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByTestId("button-confirm-management-change"));
      await waitFor(() => expect(mocks.saveManagement).toHaveBeenCalledExactlyOnceWith(role, allowed));
      expect(mocks.saveMenu).not.toHaveBeenCalled();
    });
  it.each(["reviewer", "manager"])("Cancel does not save management for %s", async role => {
    const dialog = await review(role);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.saveManagement).not.toHaveBeenCalled();
  });
  it("keeps the confirmation's role and decision if the background selection changes", async () => {
    const dialog = await review();
    fireEvent.change(screen.getByLabelText("Choose role for management grant"), { target: { value: "manager" } });
    fireEvent.click(within(dialog).getByTestId("button-confirm-management-change"));
    await waitFor(() => expect(mocks.saveManagement).toHaveBeenCalledExactlyOnceWith("reviewer", true));
  });
  it("shows the server's last-manager refusal without changing grants locally", async () => {
    mocks.saveManagement.mockRejectedValueOnce(new Error("Cannot remove the last eligible Access Control manager."));
    const dialog = await review("manager");
    fireEvent.click(within(dialog).getByTestId("button-confirm-management-change"));
    expect(await screen.findByText("Cannot remove the last eligible Access Control manager.")).toBeVisible();
    expect(mocks.grants.manager).toBe(true);
  });
  it("does not enable management editing for a denied user", async () => {
    Object.assign(mocks.state, { allowed: false, mode: "denied", eligibleManagerCount: 1 });
    await boot();
    expect(screen.getByRole("checkbox", { name: "Management access granted" })).toBeDisabled();
    expect(screen.getByTestId("button-review-management-grant")).toBeDisabled();
    expect(screen.getByTestId("management-mode-explanation")).toHaveTextContent("Your role");
    expect(mocks.saveManagement).not.toHaveBeenCalled();
  });
  it("describes parent-category recovery as ready, not missing", async () => {
    Object.assign(mocks.state, { mode: "category_recovery", categoryReady: true, recoveryRoute: "parent_sail_admin" });
    await boot();
    expect(screen.getByTestId("management-mode-explanation")).toHaveTextContent("category is ready");
    expect(screen.getByText("Supplied by the parent application.")).toBeVisible();
  });
});
