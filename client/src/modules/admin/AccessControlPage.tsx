import { CompanyDocumentBranding } from "@/components/admin/CompanyDocumentBranding";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { AccessAuditHistory } from "./AccessAuditHistory";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompanyFormsPermissionEditor } from "./CompanyFormsPermissionEditor";
import { TrainingCompliancePolicySetting, TrainingComplianceRolePermissionEditor } from "@/modules/vessel/components/TrainingComplianceAccessEditors";
import { usePermissions } from "@/contexts/PermissionsContext";
import { adminApiV2 } from "./api/adminApiV2";
import {
  useAccessControlMenusV2,
  useAccessControlRolesV2,
  useAccessControlPermissionsV2,
  useSaveAccessControlPermissionsV2,
} from "./hooks/useAdminV2";

interface Permission {
  canview: boolean;
  cancreate: boolean;
  canedit: boolean;
  candelete: boolean;
}

interface MenuItemApi {
  id: number;
  muid: string;
  name: string;
  displayName: string | null;
  route: string;
  parentMenu: string | null;
  isActive: boolean;
  sortOrder: number | null;
}

interface RoleApi {
  id: number;
  ruid: string;
  assignedRole: string;
  roletype: string;
  orderby: number | null;
  isActive: boolean;
  sortOrder: number | null;
}

interface AccessControlState {
  allowed: boolean;
  mode: "management" | "name_bootstrap" | "category_recovery" | "denied";
  eligibleManagerCount: number;
  categoryReady: boolean;
  recoveryRoute: "parent_sail_admin" | "interim_names";
}


interface PermissionApi {
  id: number;
  rauid: string;
  canview: boolean;
  cancreate: boolean;
  canedit: boolean;
  candelete: boolean;
  menuId: string;
  roleId: string;
}

interface MenuTreeItem {
  muid: string;
  name: string;
  displayName: string | null;
  children: MenuTreeItem[];
}

const PERMISSION_KEYS: (keyof Permission)[] = ["canview", "cancreate", "canedit", "candelete"];
const PERMISSION_LABELS: Record<keyof Permission, string> = {
  canview: "View",
  cancreate: "Create",
  canedit: "Edit",
  candelete: "Delete",
};

const LOCK_ACTION_MENUS = new Set(["rh lock", "rh unlock", "da lock / unlock"]);
const LOCK_ACTION_DISABLED_KEYS = new Set<keyof Permission>(["canedit", "candelete"]);

const CP_FORM_SECTION_MENUS = new Set([
  "cp dashboard", "cp travel id documents", "cp training certificates",
  "cp sea service", "cp medical"
]);
const CP_FORM_DISABLED_KEYS = new Set<keyof Permission>(["candelete"]);

const VIEW_ONLY_SECTION_MENUS = new Set([
  "pm criteria review", "pm approval", "pm execution",
  "ap seafarer info", "ap start info", "ap competence", "ap behavioural",
  "ap training needs", "ap summary", "ap office review",
  // Phase 1 RBAC additions (view-only until Phase 2 wires Create/Edit/Delete)
  "dashboard",
  "terminated",
  "training & ret.", "training", "retention"
]);
const VIEW_ONLY_DISABLED_KEYS = new Set<keyof Permission>(["cancreate", "canedit", "candelete"]);

function buildMenuTree(menus: MenuItemApi[]): MenuTreeItem[] {
  const map = new Map<string, MenuTreeItem>();
  const roots: MenuTreeItem[] = [];

  for (const menu of menus) {
    map.set(menu.muid, {
      muid: menu.muid,
      name: menu.name,
      displayName: menu.displayName,
      children: [],
    });
  }

  for (const menu of menus) {
    const node = map.get(menu.muid)!;
    if (menu.parentMenu && map.has(menu.parentMenu)) {
      map.get(menu.parentMenu)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export default function AccessControlPage() {
  const { toast } = useToast();
  const { accessControlManagement } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedRoleUuid, setSelectedRoleUuid] = useState<string | null>(null);
  const [managementDraft, setManagementDraft] = useState(false);
  const [managementError, setManagementError] = useState("");
  const [localPermissions, setLocalPermissions] = useState<Record<string, Permission>>({});
  const [expandedMenus, setExpandedMenus] = useState<Set<string> | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const { data: menusData = [], isLoading: menusLoading } = useAccessControlMenusV2();
  const { data: rolesData = [], isLoading: rolesLoading } = useAccessControlRolesV2();
  const { data: permissionsData = [], isLoading: permissionsLoading } = useAccessControlPermissionsV2(selectedRoleUuid);
  const savePermissionsMutation = useSaveAccessControlPermissionsV2();
  const stateQuery = useQuery<AccessControlState>({
    queryKey: ["/api/v2/admin/access-control/state"],
    queryFn: () => adminApiV2.getAccessControlState(),
  });
  const roleManagementUrl = selectedRoleUuid
    ? `/api/v2/admin/access-control/roles/${encodeURIComponent(selectedRoleUuid)}/management`
    : "";
  const managementQuery = useQuery<{ allowed: boolean }>({
    queryKey: [roleManagementUrl],
    queryFn: () => adminApiV2.getRoleManagementGrant(selectedRoleUuid!),
    enabled: !!selectedRoleUuid,
  });
  const saveManagementMutation = useMutation({
    mutationFn: (allowed: boolean) => adminApiV2.saveRoleManagementGrant(selectedRoleUuid!, allowed),
    onSuccess: async () => {
      setManagementError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [roleManagementUrl] }),
        queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/state"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/audit"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/my-permissions"] }),
      ]);
      toast({ title: "Management grant saved", description: `Updated management access for “${selectedRole?.assignedRole ?? "role"}”.` });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to save management access.";
      setManagementError(message);
    },
  });

  useEffect(() => {
    if (rolesData.length > 0 && !selectedRoleUuid) {
      setSelectedRoleUuid(rolesData[0].ruid);
    }
  }, [rolesData, selectedRoleUuid]);

  useEffect(() => {
    if (menusData.length > 0 && expandedMenus === null) {
      const parentMuids = new Set(
        (menusData as MenuItemApi[])
          .filter(m => !m.parentMenu)
          .filter(m => (menusData as MenuItemApi[]).some(c => c.parentMenu === m.muid))
          .map(m => m.muid)
      );
      setExpandedMenus(parentMuids);
    }
  }, [menusData, expandedMenus]);

  useEffect(() => {
    if (permissionsData && Array.isArray(permissionsData)) {
      const permMap: Record<string, Permission> = {};
      for (const p of permissionsData as PermissionApi[]) {
        permMap[p.menuId] = {
          canview: p.canview,
          cancreate: p.cancreate,
          canedit: p.canedit,
          candelete: p.candelete,
        };
      }
      setLocalPermissions(permMap);
      setIsDirty(false);
    }
  }, [permissionsData]);

  useEffect(() => {
    if (managementQuery.data) setManagementDraft(managementQuery.data.allowed);
  }, [managementQuery.data]);

  const menuTree = useMemo(() => buildMenuTree(menusData as MenuItemApi[]), [menusData]);
  const allMenuMuids = useMemo(() => (menusData as MenuItemApi[]).map(m => m.muid), [menusData]);

  const selectedRole = useMemo(
    () => (rolesData as RoleApi[]).find((r) => r.ruid === selectedRoleUuid),
    [rolesData, selectedRoleUuid]
  );

  const handleRoleSelect = useCallback((ruid: string) => {
    setSelectedRoleUuid(ruid);
    setIsDirty(false);
  }, []);

  const toggleExpand = useCallback((menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  }, []);

  const handlePermissionChange = useCallback(
    (menuMuid: string, permKey: keyof Permission, checked: boolean) => {
      setLocalPermissions((prev) => ({
        ...prev,
        [menuMuid]: {
          ...(prev[menuMuid] ?? { canview: false, cancreate: false, canedit: false, candelete: false }),
          [permKey]: checked,
        },
      }));
      setIsDirty(true);
    },
    []
  );

  const handleSelectAll = useCallback(
    (menuMuid: string, checked: boolean, restricted = false, noDelete = false, viewOnly = false) => {
      setLocalPermissions((prev) => ({
        ...prev,
        [menuMuid]: {
          canview: checked,
          cancreate: viewOnly ? false : checked,
          canedit: (restricted || viewOnly) ? false : checked,
          candelete: (restricted || noDelete || viewOnly) ? false : checked,
        },
      }));
      setIsDirty(true);
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!selectedRoleUuid) return;

    const permissions = allMenuMuids.map((muid) => ({
      menuId: muid,
      canview: localPermissions[muid]?.canview ?? false,
      cancreate: localPermissions[muid]?.cancreate ?? false,
      canedit: localPermissions[muid]?.canedit ?? false,
      candelete: localPermissions[muid]?.candelete ?? false,
    }));

    savePermissionsMutation.mutate(
      { ruid: selectedRoleUuid, permissions },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast({
            title: "Changes Saved",
            description: `Permissions for "${selectedRole?.assignedRole}" have been saved successfully.`,
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to save permissions. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }, [selectedRoleUuid, allMenuMuids, localPermissions, savePermissionsMutation, selectedRole, toast]);

  const renderMenuRow = (item: MenuTreeItem, depth: number = 0) => {
    const hasChildren = item.children.length > 0;
    const isExpanded = expandedMenus?.has(item.muid) ?? false;
    const isLockMenu = LOCK_ACTION_MENUS.has(item.name.toLowerCase());
    const isCpFormMenu = CP_FORM_SECTION_MENUS.has(item.name.toLowerCase());
    const isViewOnlyMenu = VIEW_ONLY_SECTION_MENUS.has(item.name.toLowerCase());
    const perms = localPermissions[item.muid] || {
      canview: false,
      cancreate: false,
      canedit: false,
      candelete: false,
    };
    const allSelected = isViewOnlyMenu
      ? perms.canview
      : isLockMenu
        ? perms.canview && perms.cancreate
        : isCpFormMenu
          ? perms.canview && perms.cancreate && perms.canedit
          : perms.canview && perms.cancreate && perms.canedit && perms.candelete;
    const someSelected = !allSelected && (perms.canview || (!isViewOnlyMenu && (perms.cancreate || (!isLockMenu && (perms.canedit || (!isCpFormMenu && perms.candelete))))));

    return (
      <div key={item.muid}>
        <div
          className={`grid grid-cols-[1fr_80px_repeat(4,80px)] items-center border-b border-gray-200 ${
            depth > 0 ? "bg-gray-50/50" : "bg-white"
          } hover:bg-blue-50/30 transition-colors`}
          style={{ paddingLeft: depth > 0 ? `${depth * 24 + 16}px` : "16px" }}
          data-testid={`permission-row-${item.muid}`}
        >
          <div className="flex items-center gap-2 py-2.5 pr-2">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(item.muid)}
                className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                data-testid={`toggle-menu-${item.muid}`}
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
              </button>
            ) : (
              <span className="w-[20px]" />
            )}
            <span className="text-sm text-gray-800 font-medium" data-testid={`text-menu-name-${item.muid}`}>
              {item.displayName || item.name}
            </span>
          </div>
          <div className="flex items-center justify-center py-2.5">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={() =>
                handleSelectAll(item.muid, !allSelected, isLockMenu, isCpFormMenu, isViewOnlyMenu)
              }
              className="h-[18px] w-[18px] border-gray-300 data-[state=checked]:bg-[#52baf3] data-[state=checked]:border-[#52baf3] data-[state=indeterminate]:bg-[#52baf3] data-[state=indeterminate]:border-[#52baf3]"
              data-testid={`checkbox-select-all-${item.muid}`}
            />
          </div>
          {PERMISSION_KEYS.map((key) => {
            const isDisabledKey = (isLockMenu && LOCK_ACTION_DISABLED_KEYS.has(key)) || (isCpFormMenu && CP_FORM_DISABLED_KEYS.has(key)) || (isViewOnlyMenu && VIEW_ONLY_DISABLED_KEYS.has(key));
            return (
              <div
                key={key}
                className={`flex items-center justify-center py-2.5 ${isDisabledKey ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <Checkbox
                  checked={isDisabledKey ? false : perms[key]}
                  onCheckedChange={isDisabledKey ? undefined : (checked) =>
                    handlePermissionChange(item.muid, key, !!checked)
                  }
                  disabled={isDisabledKey}
                  className="h-[18px] w-[18px] border-gray-300 data-[state=checked]:bg-[#52baf3] data-[state=checked]:border-[#52baf3]"
                  data-testid={`checkbox-${item.muid}-${key}`}
                />
              </div>
            );
          })}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {item.children.map((child) => renderMenuRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isLoading = menusLoading || rolesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]" data-testid="access-control-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#52baf3]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-full pb-6" data-testid="access-control-page">
      <div className="flex flex-wrap items-center justify-end gap-3"><AccessAuditHistory roles={rolesData as RoleApi[]} /><CompanyDocumentBranding /></div>
      {accessControlManagement && <TrainingCompliancePolicySetting />}
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden" aria-labelledby="management-grants-heading">
        <div className="flex items-center gap-2 bg-[#16569e] px-4 py-3 text-white">
          <ShieldCheck size={18} aria-hidden="true" />
          <h2 id="management-grants-heading" className="font-semibold">Management grants</h2>
        </div>
        {stateQuery.isLoading ? (
          <div className="p-4 space-y-3" aria-label="Loading access control state">
            <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
            <div className="h-10 rounded bg-gray-100 animate-pulse" />
          </div>
        ) : stateQuery.isError ? (
          <div className="flex items-center justify-between gap-3 p-4" role="alert">
            <p className="text-sm text-red-700">Unable to load management access state.</p>
            <Button variant="outline" size="sm" onClick={() => stateQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Control mode</div>
                <div className="mt-1 font-medium text-gray-800">{stateQuery.data?.mode.replace(/_/g, " ")}</div>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Eligible managers</div>
                <div className="mt-1 font-medium text-gray-800">{stateQuery.data?.eligibleManagerCount ?? "—"} currently eligible</div>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-500">Category readiness</div>
                <div className="mt-1 font-medium text-gray-800">{stateQuery.data?.categoryReady ? "Ready" : "Not ready"}</div>
              </div>
            </div>
            {stateQuery.data?.eligibleManagerCount === 0 && (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
                <strong>No eligible managers.</strong> Recovery path: <strong>{stateQuery.data.recoveryRoute === "parent_sail_admin" ? "Parent SAIL admin" : "Interim named managers"}</strong>.
                {stateQuery.data.mode === "category_recovery" && " Grant editing is limited to recovery."}
              </div>
            )}
            {stateQuery.data?.eligibleManagerCount !== 0 && (stateQuery.data?.mode === "category_recovery" || stateQuery.data?.mode === "name_bootstrap") && (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
                Recovery path: <strong>{stateQuery.data.recoveryRoute === "parent_sail_admin" ? "Parent SAIL admin" : "Interim named managers"}</strong>.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(250px,1.2fr)_auto] md:items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600" htmlFor="management-role-select">Role</label>
                <select
                  id="management-role-select"
                  value={selectedRoleUuid ?? ""}
                  onChange={event => handleRoleSelect(event.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  aria-label="Choose role for management grant"
                >
                  {(rolesData as RoleApi[]).map(role => <option key={role.ruid} value={role.ruid}>{role.assignedRole}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-600">Parent category <span className="font-normal">(read-only)</span></div>
                <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                  {selectedRole?.roletype || "Not assigned"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {managementQuery.isLoading ? <div className="h-10 w-40 animate-pulse rounded bg-gray-100" /> : (
                  <label className={`flex min-h-10 items-center gap-2 text-sm ${stateQuery.data?.allowed ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <Checkbox
                      checked={managementDraft}
                      disabled={!stateQuery.data?.allowed || saveManagementMutation.isPending || managementQuery.isError}
                      onCheckedChange={value => setManagementDraft(value === true)}
                      aria-label="Management access granted"
                    />
                    Management access
                  </label>
                )}
                <Button
                  onClick={() => { setManagementError(""); saveManagementMutation.mutate(managementDraft); }}
                  disabled={!stateQuery.data?.allowed || !selectedRoleUuid || managementQuery.isLoading || managementDraft === managementQuery.data?.allowed || saveManagementMutation.isPending}
                  className="bg-[#16569e] text-white hover:bg-[#0f4078]"
                >
                  {saveManagementMutation.isPending ? "Saving…" : "Save grant"}
                </Button>
              </div>
            </div>
            {!stateQuery.data?.allowed && <p className="mt-3 text-sm text-gray-600" role="status">Management grant editing is unavailable in the current server mode.</p>}
            {managementQuery.isError && <p className="mt-3 text-sm text-red-700" role="alert">Unable to load this role’s management grant. <button className="underline" onClick={() => managementQuery.refetch()}>Retry</button></p>}
            {managementError && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{managementError}</p>}
          </div>
        )}
      </section>

      <div className="flex gap-0 min-h-[440px] h-[calc(100vh-370px)] max-w-full" data-testid="access-control-permissions">
      <div className="w-[200px] min-w-[200px] flex flex-col border border-gray-200 rounded-l-lg overflow-hidden bg-white">
        <div className="bg-[#52baf3] text-white text-sm font-semibold px-4 py-2.5" data-testid="text-roles-header">
          Roles
        </div>
        <ScrollArea className="flex-1">
          {(rolesData as RoleApi[]).map((role) => (
            <div
              key={role.ruid}
              onClick={() => handleRoleSelect(role.ruid)}
              className={`px-4 py-2.5 text-sm cursor-pointer border-b border-gray-100 transition-colors ${
                selectedRoleUuid === role.ruid
                  ? "bg-[#52baf3] text-white font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              data-testid={`role-item-${role.ruid}`}
            >
              {role.assignedRole}
            </div>
          ))}
          {rolesData.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center" data-testid="text-no-roles">
              No roles configured
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col border border-l-0 border-gray-200 rounded-r-lg overflow-hidden bg-white">
        <div className="grid grid-cols-[1fr_80px_repeat(4,80px)] bg-[#52baf3] text-white text-sm font-semibold" data-testid="text-permissions-header">
          <div className="px-4 py-2.5" data-testid="text-header-menu-name">Menu Name</div>
          <div className="text-center py-2.5" data-testid="text-header-select-all">Select All</div>
          <div className="text-center py-2.5" data-testid="text-header-view">View</div>
          <div className="text-center py-2.5" data-testid="text-header-create">Create</div>
          <div className="text-center py-2.5" data-testid="text-header-edit">Edit</div>
          <div className="text-center py-2.5" data-testid="text-header-delete">Delete</div>
        </div>
        <ScrollArea className="flex-1">
          {selectedRoleUuid && stateQuery.data?.allowed && <>
            <CompanyFormsPermissionEditor key={`forms-${selectedRoleUuid}`} roleId={selectedRoleUuid} />
            <TrainingComplianceRolePermissionEditor key={`training-${selectedRoleUuid}`} roleUuid={selectedRoleUuid} />
          </>}
          {permissionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#52baf3]" />
            </div>
          ) : menuTree.length > 0 ? (
            menuTree.map((item) => renderMenuRow(item))
          ) : (
            <div className="flex items-center justify-center py-12 text-sm text-gray-400" data-testid="text-no-menus">
              No menu items configured. Add menu items to set up access control.
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-end p-3 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={handleSave}
            disabled={!isDirty || savePermissionsMutation.isPending || !selectedRoleUuid}
            className="bg-[#16569e] hover:bg-[#0f4078] text-white px-6"
            data-testid="button-save-access-control"
          >
            {savePermissionsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}
