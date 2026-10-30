import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { emptyCompanyFormGrants } from "@shared/v2/admin/companyFormPermissions";

const mocks = vi.hoisted(() => ({
  state: { allowed: true, mode: "name_bootstrap", eligibleManagerCount: 0, categoryReady: false, recoveryRoute: "interim_names",
    currentRoleId: "reviewer", explicitManagers: [] as { roleId: string; roleName: string }[] },
  grants: { reviewer: false, manager: true } as Record<string, boolean>,
  policy: { blockExpiringDuringContract: false, blockMissingExpiry: false },
  saveManagement: vi.fn(), request: vi.fn(), saveMenu: vi.fn(), toast: vi.fn(), dismiss: vi.fn(),
  roles: [
    { id: 1, ruid: "reviewer", assignedRole: "Fixture Reviewer", roletype: "Office", isActive: true },
    { id: 2, ruid: "manager", assignedRole: "Fixture Manager", roletype: "Office", isActive: true },
  ],
  menus: [{ id: 1, muid: "crew", name: "Crew Database", displayName: null, parentMenu: null }],
  permissions: [],
  formsData: { grants: { view: false, fill_in: false, witness: false, sign_representative: false, void: false, void_completed: false, override_checklist: false } },
  formsError: false, formsFetching: false, refetchForms: vi.fn(), refetchMenus: vi.fn(),
  trainingAllowed: false, trainingError: false,
}));
vi.mock("@/contexts/PermissionsContext", () => ({ usePermissions: () => ({ accessControlManagement: true }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast, dismiss: mocks.dismiss }) }));
vi.mock("@/components/admin/CompanyDocumentBranding", () => ({
  CompanyDocumentBranding: () => <button>Company PDF branding</button>,
}));
vi.mock("@/modules/admin/AccessAuditHistory", () => ({
  AccessAuditHistory: () => <button>Access audit history</button>,
}));
vi.mock("@/modules/admin/api/adminApiV2", () => ({
  adminApiV2: {
    getAccessControlState: async () => ({ ...mocks.state }),
    getRoleManagementGrant: async (id: string) => ({ allowed: mocks.grants[id] }),
    getRoleTrainingComplianceGrant: async () => {
      if (mocks.trainingError) throw new Error("training permission unavailable");
      return { allowed: mocks.trainingAllowed };
    },
    saveRoleManagementGrant: (...args: unknown[]) => mocks.saveManagement(...args),
  },
}));
vi.mock("@/modules/admin/hooks/useAdminV2", () => ({
  useAccessControlMenusV2: () => ({ data: mocks.menus, isLoading: false }),
  useAccessControlRolesV2: () => ({ data: mocks.roles, isLoading: false }),
  useAccessControlPermissionsV2: () => ({ data: mocks.permissions, isLoading: false, isFetching: false, isError: false, refetch: mocks.refetchMenus }),
  useRoleCompanyFormGrantsV2: () => ({ data: mocks.formsError ? undefined : mocks.formsData, isLoading: false, isFetching: mocks.formsFetching, isError: mocks.formsError, refetch: mocks.refetchForms }),
  useRoleTrainingComplianceGrantV2: (ruid: string) => useQuery({
    queryKey: [`/api/v2/admin/access-control/roles/${ruid}/training-compliance`],
    queryFn: async () => {
      if (mocks.trainingError) throw new Error("training permission unavailable");
      return { allowed: mocks.trainingAllowed };
    },
  }),
  useSaveCombinedAccessControlPermissionsV2: () => ({ mutateAsync: mocks.saveMenu, isPending: false }),
  useSaveAccessControlPermissionsV2: () => ({ mutate: mocks.saveMenu, isPending: false }),
}));
vi.mock("@/lib/queryClient", () => ({ apiRequest: (...args: unknown[]) => mocks.request(...args) }));
import AccessControlPage from "@/modules/admin/AccessControlPage";

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.formsData = { grants: emptyCompanyFormGrants() };
  mocks.formsError = false; mocks.formsFetching = false;
  mocks.refetchForms.mockResolvedValue({});
  mocks.refetchMenus.mockResolvedValue({});
  mocks.saveMenu.mockResolvedValue({});
  Object.assign(mocks.state, { allowed: true, mode: "name_bootstrap", eligibleManagerCount: 0, categoryReady: false, recoveryRoute: "interim_names",
    currentRoleId: "reviewer", explicitManagers: [] });
  Object.assign(mocks.policy, { blockExpiringDuringContract: false, blockMissingExpiry: false });
  mocks.trainingAllowed = false; mocks.trainingError = false;
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
  if (mocks.state.allowed && !mocks.trainingError) {
    await screen.findByRole("checkbox", { name: "Override deployment block" });
  } else if (mocks.state.allowed && mocks.trainingError) {
    await screen.findByText("Unable to load deployment override permission.");
  }
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
  it("saves menu, Company Forms, and deployment override edits through one combined mutation", async () => {
    await boot();
    fireEvent.click(await screen.findByTestId("company-form-permissions-trigger"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Witness", exact: true }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("checkbox-crew-canview"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Override deployment block" }));
    fireEvent.click(screen.getByTestId("button-save-access-control"));
    await waitFor(() => expect(mocks.saveMenu).toHaveBeenCalledExactlyOnceWith({
      ruid: "reviewer",
      permissions: [{ menuId: "crew", canview: true, cancreate: false, canedit: false, candelete: false }],
      companyFormGrants: { ...emptyCompanyFormGrants(), witness: true },
      trainingComplianceAllowed: true,
    }));
    expect(mocks.refetchForms).toHaveBeenCalled();
    expect(mocks.refetchMenus).toHaveBeenCalled();
    expect(screen.queryByTestId("save-company-form-permissions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("save-training-compliance-permission")).not.toBeInTheDocument();
  });
  it("keeps all three drafts on combined failure and refuses a silent role switch", async () => {
    mocks.saveMenu.mockRejectedValue(Error("500: Deliberate failure"));
    await boot();
    fireEvent.click(await screen.findByTestId("company-form-permissions-trigger"));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Witness", exact: true }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("checkbox-crew-canview"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Override deployment block" }));
    fireEvent.click(screen.getByTestId("button-save-access-control"));
    expect(await screen.findByText("None of the permission changes were saved. Please retry.")).toBeVisible();
    expect(screen.getByTestId("checkbox-crew-canview")).toBeChecked();
    expect(screen.getByTestId("company-form-permissions-trigger")).toHaveTextContent("Witness");
    expect(screen.getByRole("checkbox", { name: "Override deployment block" })).toBeChecked();
    expect(screen.getByTestId("button-save-access-control")).toBeEnabled();
    fireEvent.click(screen.getByTestId("role-item-manager"));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("all three sets of edits");
    fireEvent.click(screen.getByTestId("button-cancel-role-change"));
    expect(screen.getByTestId("company-form-permissions-trigger")).toHaveTextContent("Witness");
    expect(screen.getByRole("checkbox", { name: "Override deployment block" })).toBeChecked();
  });
  it("does not claim rollback when a network failure leaves the save outcome unknown", async () => {
    mocks.saveMenu.mockRejectedValue(Error("Failed to fetch"));
    await boot();
    fireEvent.click(screen.getByRole("checkbox", { name: "Override deployment block" }));
    fireEvent.click(screen.getByTestId("button-save-access-control"));
    expect(await screen.findByText(/Unable to confirm the save/)).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Override deployment block" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("button-save-access-control")).toBeEnabled();
    expect(screen.queryByText("None of the permission changes were saved. Please retry.")).not.toBeInTheDocument();
  });
  it("does not synthesize form grants when loading fails and offers Retry", async () => {
    mocks.formsError = true;
    await boot();
    expect(screen.getByTestId("button-save-access-control")).toBeDisabled();
    expect(screen.queryByTestId("company-form-permissions-trigger")).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("company-forms-permissions")).getByRole("button", { name: "Retry" }));
    expect(mocks.refetchForms).toHaveBeenCalled();
  });
  it("blocks combined saving until the training permission loads and offers Retry on failure", async () => {
    mocks.trainingError = true;
    await boot();
    expect(screen.getByTestId("button-save-access-control")).toBeDisabled();
    const row = screen.getByTestId("training-compliance-permissions");
    expect(within(row).queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Retry" }));
    expect(mocks.request).not.toHaveBeenCalledWith("PUT", expect.stringContaining("/combined-permissions"), expect.anything());
  });
  it("explains the deployment override on hover and tap and has no separate save control", async () => {
    await boot();
    const help = screen.getByRole("button", { name: "Help: Override deployment block" });
    const explanation = "Lets this role approve a deployment that training rules would otherwise block — for example a seafarer missing a mandatory certificate.";
    fireEvent.pointerMove(help, { pointerType: "mouse" });
    expect(await screen.findByRole("tooltip")).toHaveTextContent(explanation);
    fireEvent.pointerLeave(help, { pointerType: "mouse" });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(help);
    expect(await screen.findByRole("dialog")).toHaveTextContent(explanation);
    expect(screen.queryByTestId("save-training-compliance-permission")).not.toBeInTheDocument();
  });
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
  it("places both permission rows in the grid and policy after it, retaining both top buttons", async () => {
    await boot();
    const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const grid = screen.getByTestId("access-control-permissions");
    const policy = screen.getByTestId("training-compliance-policy");
    const management = screen.getByTestId("management-grants-panel");
    const companyForms = screen.getByTestId("company-forms-permissions");
    const training = screen.getByTestId("training-compliance-permissions");
    expect(grid.contains(companyForms)).toBe(true);
    expect(grid.contains(training)).toBe(true);
    expect(before(companyForms, training)).toBe(true);
    expect(before(policy, management)).toBe(true);
    expect(policy).toHaveTextContent("Blocking Seafarer Deployment Policy");
    expect(screen.queryByTestId("training-compliance-role-permission")).not.toBeInTheDocument();
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
    const strip = screen.getByTestId("management-fallback-warning");
    expect(strip).toHaveTextContent("Admin, Super Admin or Sail Admin");
    expect(strip).toHaveTextContent("temporary setup state");
    expect(strip).toHaveTextContent("parent application");
    expect(screen.queryByRole("list", { name: "Roles with explicit management access" })).not.toBeInTheDocument();
    expect(screen.queryByText("How access is assigned")).not.toBeInTheDocument();
    expect(screen.queryByText("Parent SAIL Admin category")).not.toBeInTheDocument();
  });
  it("lists every explicit holder by name, marks the server-resolved own role, and places the list after controls", async () => {
    Object.assign(mocks.state, { mode: "management", eligibleManagerCount: 1, currentRoleId: "manager",
      explicitManagers: [{ roleId: "manager", roleName: "Fixture Manager" }, { roleId: "unlinked", roleName: "Marine Manager" }] });
    await boot();
    const list = screen.getByTestId("management-explicit-managers");
    expect(list).toHaveTextContent("Fixture Manager");
    expect(list).toHaveTextContent("Marine Manager");
    expect(within(list).getByText("Your role").parentElement).toHaveTextContent("Fixture Manager");
    expect(screen.queryByTestId("management-fallback-warning")).not.toBeInTheDocument();
    expect(screen.queryByText(/not supplied by the parent/i)).not.toBeInTheDocument();
    expect(Boolean(screen.getByTestId("button-review-management-grant").compareDocumentPosition(list)
      & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
  it("warns plainly about removing one's own role without preventing the confirmed server request", async () => {
    Object.assign(mocks.state, { mode: "management", currentRoleId: "manager",
      explicitManagers: [{ roleId: "manager", roleName: "Fixture Manager" }] });
    const dialog = await review("manager");
    expect(within(dialog).getByTestId("management-own-role-warning")).toHaveTextContent(/lock you out/i);
    expect(mocks.saveManagement).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByTestId("button-confirm-management-change"));
    await waitFor(() => expect(mocks.saveManagement).toHaveBeenCalledExactlyOnceWith("manager", false));
  });
  it("does not show a self-removal warning for another role", async () => {
    const dialog = await review("manager");
    expect(within(dialog).queryByTestId("management-own-role-warning")).not.toBeInTheDocument();
  });
  it("does not claim bootstrap is empty when an explicit but ineligible holder exists", async () => {
    mocks.state.explicitManagers = [{ roleId: "unlinked", roleName: "Unlinked Manager" }];
    await boot();
    expect(screen.getByTestId("management-explicit-managers")).toHaveTextContent("Unlinked Manager");
    expect(screen.queryByTestId("management-fallback-warning")).not.toBeInTheDocument();
  });
  it("shows Retry instead of inventing an empty list when the display list is unavailable", async () => {
    delete (mocks.state as { explicitManagers?: unknown }).explicitManagers;
    await boot();
    expect(screen.queryByTestId("management-fallback-warning")).not.toBeInTheDocument();
    expect(screen.getByTestId("management-grants-panel")).toHaveTextContent(/unable|unavailable|could not/i);
    expect(within(screen.getByTestId("management-grants-panel")).getByRole("button", { name: "Retry" })).toBeVisible();
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
    expect(screen.getByText("Management grant editing is unavailable in the current server mode.")).toBeVisible();
    expect(mocks.saveManagement).not.toHaveBeenCalled();
  });
  it("describes parent-category recovery as ready, not missing", async () => {
    Object.assign(mocks.state, { mode: "category_recovery", categoryReady: true, recoveryRoute: "parent_sail_admin" });
    await boot();
    expect(screen.queryByTestId("management-fallback-warning")).not.toBeInTheDocument();
    expect(screen.queryByText(/not supplied by the parent/i)).not.toBeInTheDocument();
  });
});
