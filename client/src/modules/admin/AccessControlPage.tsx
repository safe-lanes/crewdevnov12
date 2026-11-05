import { CompanyDocumentBranding } from "@/components/admin/CompanyDocumentBranding";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AccessAuditHistory } from "./AccessAuditHistory";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CompanyFormsPermissionEditor } from "./CompanyFormsPermissionEditor";
import type { CompanyFormGrants } from "@shared/v2/admin/companyFormPermissions";
import { TrainingCompliancePermissionRow, TrainingCompliancePolicyDialog } from "@/modules/vessel/components/TrainingComplianceAccessEditors";
import { usePermissions } from "@/contexts/PermissionsContext";
import { adminApiV2 } from "./api/adminApiV2";
import {
  useAccessControlMenusV2,
  useAccessControlRolesV2,
  useAccessControlPermissionsV2,
  useRoleCompanyFormGrantsV2,
  useRoleTrainingComplianceGrantV2,
  useSaveCombinedAccessControlPermissionsV2,
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
  explicitManagers?: { roleId: string; roleName: string }[];
  currentRoleId?: string | null;
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

const EMPTY_PERMISSIONS: PermissionApi[] = [];

export default function AccessControlPage() {
  const { toast, dismiss } = useToast();
  const { accessControlManagement } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedRoleUuid, setSelectedRoleUuid] = useState<string | null>(null);
  const [managementOpen, setManagementOpen] = useState(false);
  const [managementRoleUuid, setManagementRoleUuid] = useState<string | null>(null);
  const [managementDraft, setManagementDraft] = useState(false);
  const [managementError, setManagementError] = useState("");
  const [managementConfirmation, setManagementConfirmation] = useState<{
    roleUuid: string;
    roleName: string;
    allowed: boolean;
  } | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Record<string, Permission>>({});
  const [menuPermissionsRoleUuid, setMenuPermissionsRoleUuid] = useState<string | null>(null);
  const [companyFormGrants, setCompanyFormGrants] = useState<CompanyFormGrants | null>(null);
  const [companyFormGrantsRoleUuid, setCompanyFormGrantsRoleUuid] = useState<string | null>(null);
  const [trainingComplianceAllowed, setTrainingComplianceAllowed] = useState(false);
  const [trainingComplianceRoleUuid, setTrainingComplianceRoleUuid] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [roleChangeRequest, setRoleChangeRequest] = useState<string | null>(null);
  const [combinedSaveError, setCombinedSaveError] = useState("");

  const { data: menusData = [], isLoading: menusLoading } = useAccessControlMenusV2();
  const { data: rolesData = [], isLoading: rolesLoading } = useAccessControlRolesV2();
  const permissionsQuery = useAccessControlPermissionsV2(selectedRoleUuid);
  const { data: permissionsData = EMPTY_PERMISSIONS, isLoading: permissionsLoading } = permissionsQuery;
  const companyFormsQuery = useRoleCompanyFormGrantsV2(selectedRoleUuid);
  const saveCombinedMutation = useSaveCombinedAccessControlPermissionsV2();
  const stateQuery = useQuery<AccessControlState>({
    queryKey: ["/api/v2/admin/access-control/state"],
    queryFn: () => adminApiV2.getAccessControlState(),
  });
  const trainingComplianceQuery = useRoleTrainingComplianceGrantV2(selectedRoleUuid, {
    enabled: !!stateQuery.data?.allowed,
  });
  const roleManagementUrl = managementRoleUuid
    ? `/api/v2/admin/access-control/roles/${encodeURIComponent(managementRoleUuid)}/management`
    : "";
  const managementQuery = useQuery<{ allowed: boolean }>({
    queryKey: [roleManagementUrl],
    queryFn: () => adminApiV2.getRoleManagementGrant(managementRoleUuid!),
    enabled: managementOpen && !!managementRoleUuid,
  });
  const saveManagementMutation = useMutation({
    mutationFn: ({ roleUuid, allowed }: { roleUuid: string; roleName: string; allowed: boolean }) =>
      adminApiV2.saveRoleManagementGrant(roleUuid, allowed),
    onSuccess: async (_data, variables) => {
      setManagementError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [`/api/v2/admin/access-control/roles/${encodeURIComponent(variables.roleUuid)}/management`] }),
        queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/state"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/audit"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/v2/admin/access-control/my-permissions"] }),
      ]);
      toast({ title: "Management grant saved", description: `Updated management access for “${variables.roleName}”.` });
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
    if (!isDirty && !permissionsLoading && !permissionsQuery.isError && selectedRoleUuid && permissionsQuery.data && Array.isArray(permissionsData)) {
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
      setMenuPermissionsRoleUuid(selectedRoleUuid);
    }
  }, [permissionsData, isDirty, permissionsLoading, permissionsQuery.isError, selectedRoleUuid]);

  useEffect(() => {
    if (!isDirty && companyFormsQuery.data?.grants) {
      setCompanyFormGrants(companyFormsQuery.data.grants);
      setCompanyFormGrantsRoleUuid(selectedRoleUuid);
    }
  }, [companyFormsQuery.data, isDirty, selectedRoleUuid]);

  useEffect(() => {
    if (!isDirty && trainingComplianceQuery.data && selectedRoleUuid) {
      setTrainingComplianceAllowed(trainingComplianceQuery.data.allowed);
      setTrainingComplianceRoleUuid(selectedRoleUuid);
    }
  }, [trainingComplianceQuery.data, isDirty, selectedRoleUuid]);

  useEffect(() => {
    if (managementQuery.data) setManagementDraft(managementQuery.data.allowed);
  }, [managementQuery.data]);

  const menuTree = useMemo(() => buildMenuTree(menusData as MenuItemApi[]), [menusData]);
  const allMenuMuids = useMemo(() => (menusData as MenuItemApi[]).map(m => m.muid), [menusData]);

  const selectedRole = useMemo(
    () => (rolesData as RoleApi[]).find(r => r.ruid === selectedRoleUuid),
    [rolesData, selectedRoleUuid]
  );
  const managementRole = (rolesData as RoleApi[]).find(r => r.ruid === managementRoleUuid);
  const openManagement = () => {
    setManagementRoleUuid(selectedRoleUuid);
    setManagementDraft(false);
    setManagementError("");
    setManagementOpen(true);
    if (selectedRoleUuid) {
      const cached = queryClient.getQueryData<{ allowed: boolean }>([
        `/api/v2/admin/access-control/roles/${encodeURIComponent(selectedRoleUuid)}/management`,
      ]);
      if (cached) setManagementDraft(cached.allowed);
    }
  };
  const explicitManagers = Array.isArray(stateQuery.data?.explicitManagers)
    ? stateQuery.data.explicitManagers
    : undefined;

  const applyRoleSelection = useCallback((ruid: string) => {
    setSelectedRoleUuid(ruid);
    setIsDirty(false);
    setCompanyFormGrants(null);
    setCompanyFormGrantsRoleUuid(null);
    setTrainingComplianceAllowed(false);
    setTrainingComplianceRoleUuid(null);
    setCombinedSaveError("");
    setRoleChangeRequest(null);
  }, []);

  const handleRoleSelect = useCallback((ruid: string) => {
    if (ruid === selectedRoleUuid || saveCombinedMutation.isPending) return;
    if (isDirty) {
      setRoleChangeRequest(ruid);
      return;
    }
    applyRoleSelection(ruid);
  }, [selectedRoleUuid, saveCombinedMutation.isPending, isDirty, applyRoleSelection]);

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
      setCombinedSaveError("");
    },
    []
  );

  const handleSelectAll = useCallback(
    (menuMuid: string, checked: boolean, restricted = false, noDelete = false, viewOnly = false, viewAndEditOnly = false) => {
      setLocalPermissions((prev) => ({
        ...prev,
        [menuMuid]: {
          canview: checked,
          cancreate: (viewOnly || viewAndEditOnly) ? false : checked,
          canedit: (restricted || viewOnly) ? false : checked,
          candelete: (restricted || noDelete || viewOnly || viewAndEditOnly) ? false : checked,
        },
      }));
      setIsDirty(true);
      setCombinedSaveError("");
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!selectedRoleUuid || menuPermissionsRoleUuid !== selectedRoleUuid || !companyFormGrants || companyFormGrantsRoleUuid !== selectedRoleUuid ||
      trainingComplianceRoleUuid !== selectedRoleUuid || !trainingComplianceQuery.data ||
      permissionsLoading || permissionsQuery.isFetching || permissionsQuery.isError ||
      companyFormsQuery.isLoading || companyFormsQuery.isFetching || companyFormsQuery.isError ||
      trainingComplianceQuery.isLoading || trainingComplianceQuery.isFetching || trainingComplianceQuery.isError ||
      saveCombinedMutation.isPending) return;

    const permissions = allMenuMuids.map((muid) => ({
      menuId: muid,
      canview: localPermissions[muid]?.canview ?? false,
      cancreate: localPermissions[muid]?.cancreate ?? false,
      canedit: localPermissions[muid]?.canedit ?? false,
      candelete: localPermissions[muid]?.candelete ?? false,
    }));

    setCombinedSaveError("");
    dismiss();
    try {
      await saveCombinedMutation.mutateAsync({
        ruid: selectedRoleUuid,
        permissions,
        companyFormGrants,
        trainingComplianceAllowed,
      });
    } catch (error) {
      // A transport failure can lose a successful response after commit.
      setCombinedSaveError(error instanceof Error && /^[45]\d\d:/.test(error.message)
        ? "None of the permission changes were saved. Please retry."
        : "Unable to confirm the save. Your edits are kept; retry. All three permission groups are saved together, never partly.");
      return;
    }
    setIsDirty(false);
    await Promise.all([permissionsQuery.refetch(), companyFormsQuery.refetch(), trainingComplianceQuery.refetch()]);
    toast({
      title: "Changes Saved",
      description: `Permissions for "${selectedRole?.assignedRole}" have been saved successfully.`,
    });
  }, [selectedRoleUuid, menuPermissionsRoleUuid, companyFormGrants, companyFormGrantsRoleUuid, trainingComplianceRoleUuid,
    trainingComplianceAllowed, trainingComplianceQuery, permissionsLoading, permissionsQuery,
    companyFormsQuery, saveCombinedMutation, allMenuMuids, localPermissions, toast, dismiss, selectedRole]);

  const renderMenuRow = (item: MenuTreeItem, depth: number = 0) => {
    const hasChildren = item.children.length > 0;
    const isExpanded = expandedMenus?.has(item.muid) ?? false;
    const isLockMenu = LOCK_ACTION_MENUS.has(item.name.toLowerCase());
    const isCpFormMenu = CP_FORM_SECTION_MENUS.has(item.name.toLowerCase());
    const isViewOnlyMenu = VIEW_ONLY_SECTION_MENUS.has(item.name.toLowerCase());
    const isTerminatedMenu = item.name.toLowerCase() === "terminated";
    const perms = localPermissions[item.muid] || {
      canview: false,
      cancreate: false,
      canedit: false,
      candelete: false,
    };
    const allSelected = isTerminatedMenu ? perms.canview && perms.canedit : isViewOnlyMenu
      ? perms.canview
      : isLockMenu
        ? perms.canview && perms.cancreate
        : isCpFormMenu
          ? perms.canview && perms.cancreate && perms.canedit
          : perms.canview && perms.cancreate && perms.canedit && perms.candelete;
    const someSelected = isTerminatedMenu ? !allSelected && (perms.canview || perms.canedit) : !allSelected && (perms.canview || (!isViewOnlyMenu && (perms.cancreate || (!isLockMenu && (perms.canedit || (!isCpFormMenu && perms.candelete))))));

    return (
      <div key={item.muid}>
        <div
          className={`grid grid-cols-[minmax(0,1fr)_repeat(5,minmax(32px,80px))] items-center border-b border-gray-200 ${
            depth > 0 ? "bg-gray-50/50" : "bg-white"
          } hover:bg-blue-50/30 transition-colors`}
          style={{ paddingLeft: depth > 0 ? `min(${depth * 24 + 16}px, 12vw)` : "8px" }}
          data-testid={`permission-row-${item.muid}`}
        >
          <div className="flex min-w-0 items-center gap-1 py-2.5 pr-1 sm:gap-2 sm:pr-2">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(item.muid)}
                disabled={grantControlsDisabled}
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
              <span className="w-4 shrink-0 sm:w-[20px]" />
            )}
            <span className="min-w-0 break-words text-xs text-gray-800 font-medium sm:text-sm" data-testid={`text-menu-name-${item.muid}`}>
              {item.displayName || item.name}
            </span>
          </div>
          <div className="flex items-center justify-center py-2.5">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              disabled={grantControlsDisabled}
              onCheckedChange={() =>
                handleSelectAll(item.muid, !allSelected, isLockMenu, isCpFormMenu, isViewOnlyMenu, isTerminatedMenu)
              }
              className="h-[18px] w-[18px] border-gray-300 data-[state=checked]:bg-[#52baf3] data-[state=checked]:border-[#52baf3] data-[state=indeterminate]:bg-[#52baf3] data-[state=indeterminate]:border-[#52baf3]"
              data-testid={`checkbox-select-all-${item.muid}`}
            />
          </div>
          {PERMISSION_KEYS.map((key) => {
            const isDisabledKey = (isTerminatedMenu && (key === "cancreate" || key === "candelete")) || (isLockMenu && LOCK_ACTION_DISABLED_KEYS.has(key)) || (isCpFormMenu && CP_FORM_DISABLED_KEYS.has(key)) || (isViewOnlyMenu && VIEW_ONLY_DISABLED_KEYS.has(key));
            return (
              <div
                key={key}
                className={`flex items-center justify-center py-2.5 ${isDisabledKey ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <Checkbox
                  checked={isDisabledKey ? false : perms[key]}
                  disabled={isDisabledKey || grantControlsDisabled}
                  onCheckedChange={isDisabledKey ? undefined : (checked) =>
                    handlePermissionChange(item.muid, key, !!checked)
                  }
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
  const combinedSavePending = saveCombinedMutation.isPending;
  // No group can become dirty before all three role-bound drafts are loaded.
  // Otherwise a late response could never initialize the remaining draft.
  const grantControlsDisabled = combinedSavePending || !selectedRoleUuid ||
    menuPermissionsRoleUuid !== selectedRoleUuid || companyFormGrantsRoleUuid !== selectedRoleUuid ||
    trainingComplianceRoleUuid !== selectedRoleUuid || permissionsLoading ||
    permissionsQuery.isFetching || permissionsQuery.isError ||
    companyFormsQuery.isLoading || companyFormsQuery.isFetching || companyFormsQuery.isError ||
    trainingComplianceQuery.isLoading || trainingComplianceQuery.isFetching || trainingComplianceQuery.isError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]" data-testid="access-control-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#52baf3]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 max-w-full overflow-hidden pb-2" data-testid="access-control-page">
      <div className="flex flex-wrap items-center justify-end gap-3" data-testid="access-control-top-actions">
        <Button variant="outline" onClick={openManagement} data-testid="button-management-grants">
          <ShieldCheck aria-hidden="true" className="mr-2 h-4 w-4" />Management grants
        </Button>
        {accessControlManagement && <TrainingCompliancePolicyDialog />}
        <AccessAuditHistory roles={rolesData as RoleApi[]} /><CompanyDocumentBranding />
      </div>
      <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-hidden" data-testid="access-control-grid-scroll">
      <div className="flex h-full min-h-0 min-w-0 gap-0" data-testid="access-control-permissions">
      <div className="flex w-[112px] min-w-[112px] flex-col overflow-hidden rounded-l-lg border border-gray-200 bg-white sm:w-[160px] sm:min-w-[160px] lg:w-[200px] lg:min-w-[200px]">
        <div className="bg-[#52baf3] text-white text-sm font-semibold px-4 py-2.5" data-testid="text-roles-header">
          Roles
        </div>
        {selectedRole && (
          <div
            className="shrink-0 border-b border-sky-200 bg-sky-50 px-3 py-2 text-xs text-gray-600"
            aria-live="polite"
            data-testid="selected-role-indicator"
          >
            Selected role
            <div className="truncate text-sm font-semibold text-[#16569e]" title={selectedRole.assignedRole}>
              {selectedRole.assignedRole}
            </div>
          </div>
        )}
        <ScrollArea className="flex-1">
          {(rolesData as RoleApi[]).map((role) => (
            <div
              key={role.ruid}
              onClick={() => handleRoleSelect(role.ruid)}
              aria-disabled={combinedSavePending}
              className={`px-4 py-2.5 text-sm border-b border-gray-100 transition-colors ${
                combinedSavePending ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              } ${
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-r-lg border border-l-0 border-gray-200 bg-white">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(5,minmax(32px,80px))] bg-[#52baf3] text-white text-[9px] font-semibold leading-tight sm:text-sm" data-testid="text-permissions-header">
          <div className="px-1 py-2.5 sm:px-4" data-testid="text-header-menu-name">Menu Name</div>
          <div className="px-0.5 py-2.5 text-center" data-testid="text-header-select-all"><span className="sm:hidden">Select<br />All</span><span className="hidden sm:inline">Select All</span></div>
          <div className="px-0.5 py-2.5 text-center" data-testid="text-header-view">View</div>
          <div className="px-0.5 py-2.5 text-center" data-testid="text-header-create">Create</div>
          <div className="px-0.5 py-2.5 text-center" data-testid="text-header-edit">Edit</div>
          <div className="px-0.5 py-2.5 text-center" data-testid="text-header-delete">Delete</div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="min-w-0">
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
          {selectedRoleUuid && stateQuery.data?.allowed && <div
            className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_repeat(5,minmax(32px,80px))] items-center border-b border-gray-200 bg-sky-50/70"
            data-testid="company-forms-permissions"
          >
            <div className="px-4 py-2.5 text-sm font-semibold text-gray-800">Company Forms</div>
            <div aria-hidden="true" />
            {companyFormsQuery.isLoading || companyFormGrantsRoleUuid !== selectedRoleUuid && !companyFormsQuery.isError ? (
              <div className="col-span-4 px-3 py-2.5">
                <div className="h-9 animate-pulse rounded-md bg-gray-100" aria-label="Loading Company Forms permissions" />
              </div>
            ) : companyFormsQuery.isError || !companyFormGrants ? (
              <div className="col-span-4 flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm text-red-700" role="alert">
                <span>Unable to load Company Forms permissions.</span>
                <button className="underline" onClick={() => companyFormsQuery.refetch()}>Retry</button>
              </div>
            ) : (
              <CompanyFormsPermissionEditor
                grants={companyFormGrants}
                disabled={grantControlsDisabled}
                onChange={nextGrants => {
                  setCompanyFormGrants(nextGrants);
                  setIsDirty(true);
                  setCombinedSaveError("");
                }}
              />
            )}
          </div>}
          {selectedRoleUuid && stateQuery.data?.allowed && <div
            className="grid min-h-[58px] grid-cols-[minmax(0,1fr)_repeat(5,minmax(32px,80px))] items-center border-b border-gray-200 bg-sky-50/70"
            data-testid="training-compliance-permissions"
          >
            <div className="px-4 py-2.5 text-sm font-semibold text-gray-800">Override deployment block</div>
            <div aria-hidden="true" />
            {trainingComplianceQuery.isLoading ||
              (trainingComplianceRoleUuid !== selectedRoleUuid &&
                (trainingComplianceQuery.isFetching || !trainingComplianceQuery.isError)) ? (
              <div className="col-span-4 px-3 py-2.5">
                <div className="h-9 animate-pulse rounded-md bg-gray-100" aria-label="Loading deployment override permission" />
              </div>
            ) : trainingComplianceQuery.isError || trainingComplianceRoleUuid !== selectedRoleUuid || !trainingComplianceQuery.data ? (
              <div className="col-span-4 flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm text-red-700" role="alert">
                <span>Unable to load deployment override permission.</span>
                <button className="underline" onClick={() => trainingComplianceQuery.refetch()}>Retry</button>
              </div>
            ) : (
              <TrainingCompliancePermissionRow
                allowed={trainingComplianceAllowed}
                disabled={grantControlsDisabled}
                onChange={nextAllowed => {
                  setTrainingComplianceAllowed(nextAllowed);
                  setIsDirty(true);
                  setCombinedSaveError("");
                }}
              />
            )}
          </div>}
          </div>
        </ScrollArea>
        </div>
        {combinedSaveError && (
          <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-right text-sm text-red-800 sm:text-left">
            {combinedSaveError}
          </p>
        )}
        <div className="flex justify-end p-3 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={handleSave}
            disabled={
              !isDirty || grantControlsDisabled || !selectedRoleUuid ||
              !companyFormGrants || companyFormGrantsRoleUuid !== selectedRoleUuid || companyFormsQuery.isLoading || companyFormsQuery.isFetching || companyFormsQuery.isError ||
              trainingComplianceRoleUuid !== selectedRoleUuid || !trainingComplianceQuery.data || trainingComplianceQuery.isLoading || trainingComplianceQuery.isFetching || trainingComplianceQuery.isError ||
              permissionsLoading || permissionsQuery.isFetching || permissionsQuery.isError
            }
            className="bg-[#16569e] hover:bg-[#0f4078] text-white px-6"
            data-testid="button-save-access-control"
          >
            {combinedSavePending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
      </div>
      </div>
      <AlertDialog open={!!roleChangeRequest} onOpenChange={open => { if (!open) setRoleChangeRequest(null); }}>
        <AlertDialogContent data-testid="unsaved-role-change-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved permission changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Menu, Company Forms, and Override deployment block permission edits are unsaved. Changing roles will discard all three sets of edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-role-change">Keep editing</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-role-change"
              onClick={event => {
                event.preventDefault();
                if (roleChangeRequest) applyRoleSelection(roleChangeRequest);
              }}
              disabled={combinedSavePending}
            >
              Discard and change role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={managementOpen} onOpenChange={setManagementOpen}>
      <DialogContent aria-describedby={undefined} className="max-h-[92vh] w-[min(960px,96vw)] max-w-none overflow-y-auto border-slate-200 bg-[#fbfcfd] p-0" data-testid="management-grants-dialog">
      <DialogHeader className="border-b px-6 py-4 pr-12">
        <DialogTitle>Management grants</DialogTitle>
      </DialogHeader>
      <div className="px-6 pb-5">
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden" aria-labelledby="management-grants-heading" data-testid="management-grants-panel">
        <div className="flex items-center gap-2 bg-[#16569e] px-4 py-3 text-white">
          <ShieldCheck size={18} aria-hidden="true" />
          <h2 id="management-grants-heading" className="font-semibold">Management grants</h2>
        </div>
        <p className="border-b border-gray-200 px-4 py-3 text-sm text-gray-700">This controls which roles may administer Access Control itself, including granting permissions to other roles.</p>
        <p className="border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-[#16569e]" data-testid="management-target-role">
          Management access applies to: {managementRole?.assignedRole || "Choose a role"}
        </p>
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
            <div className="grid gap-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(250px,1.2fr)_auto] md:items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600" htmlFor="management-role-select">Role</label>
                <select
                  id="management-role-select"
                  value={managementRoleUuid ?? ""}
                  onChange={event => {
                    setManagementRoleUuid(event.target.value);
                    setManagementDraft(false);
                    setManagementError("");
                  }}
                  disabled={saveManagementMutation.isPending}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  aria-label="Choose role for management grant"
                >
                  {(rolesData as RoleApi[]).map(role => <option key={role.ruid} value={role.ruid}>{role.assignedRole}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-gray-600">Parent category <span className="font-normal">(read-only)</span></div>
                <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
                  {managementRole?.roletype || "Not assigned"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {managementQuery.isLoading ? <div className="h-10 w-40 animate-pulse rounded bg-gray-100" /> : (
                  <label className={`flex min-h-10 items-center gap-2 text-sm ${stateQuery.data?.allowed ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                    <Checkbox
                      checked={managementDraft}
                      disabled={!stateQuery.data?.allowed || saveManagementMutation.isPending || managementQuery.isFetching || managementQuery.isError}
                      onCheckedChange={value => setManagementDraft(value === true)}
                      aria-label="Management access granted"
                    />
                    Management access
                  </label>
                )}
                <Button
                  onClick={() => {
                    setManagementError("");
                    if (managementRoleUuid && managementRole) {
                      setManagementConfirmation({ roleUuid: managementRoleUuid, roleName: managementRole.assignedRole, allowed: managementDraft });
                    }
                  }}
                  disabled={!stateQuery.data?.allowed || !managementRoleUuid || managementQuery.isLoading || managementQuery.isFetching || managementQuery.isError || managementDraft === managementQuery.data?.allowed || saveManagementMutation.isPending}
                  className="bg-[#16569e] text-white hover:bg-[#0f4078]"
                  data-testid="button-review-management-grant"
                >
                  {saveManagementMutation.isPending ? "Saving…" : "Save grant"}
                </Button>
              </div>
            </div>
            {!stateQuery.data?.allowed && <p className="mt-3 text-sm text-gray-600" role="status">Management grant editing is unavailable in the current server mode.</p>}
            {managementQuery.isError && <p className="mt-3 text-sm text-red-700" role="alert">Unable to load this role’s management grant. <button className="underline" onClick={() => managementQuery.refetch()}>Retry</button></p>}
            {managementError && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{managementError}</p>}
            <div className="mt-5 border-t border-gray-200 pt-4" data-testid="management-explicit-managers">
              <h3 className="text-sm font-semibold text-gray-800">Roles with management access</h3>
              {explicitManagers === undefined ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-3" role="status">
                  <p className="text-sm text-gray-600">Management role list is unavailable.</p>
                  <Button variant="outline" size="sm" onClick={() => stateQuery.refetch()}>
                    <RefreshCw className="mr-2 h-4 w-4" />Retry
                  </Button>
                </div>
              ) : stateQuery.data?.mode === "name_bootstrap" && explicitManagers.length === 0 ? (
                <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950" role="status" data-testid="management-fallback-warning">
                  <p>
                    Management access is currently granted by role name — Admin, Super Admin or Sail Admin — because no role holds an explicit grant.
                  </p>
                  <p className="mt-1">
                    This is a temporary setup state. Granting an explicit manager closes it, and the name-based route then stops working.
                  </p>
                  {!stateQuery.data.categoryReady && (
                    <p className="mt-1">
                      The parent SAIL Admin category has not been supplied. This is resolved in the parent application, not here.
                    </p>
                  )}
                </div>
              ) : explicitManagers.length > 0 ? (
                <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200" aria-label="Roles with explicit management access">
                  {explicitManagers.map(manager => (
                    <li key={manager.roleId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                      <span className="font-medium text-gray-800">{manager.roleName}</span>
                      {manager.roleId === stateQuery.data?.currentRoleId && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">Your role</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-600" role="status">
                  No explicit management grants are recorded.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
      </div>
      </DialogContent>
      </Dialog>
      <AlertDialog open={!!managementConfirmation} onOpenChange={open => { if (!open) setManagementConfirmation(null); }}>
        <AlertDialogContent data-testid="management-grant-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>{managementConfirmation?.allowed ? "Grant management access?" : "Remove management access?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {managementConfirmation?.allowed
                ? `Granting “${managementConfirmation.roleName}” management access lets this role administer Access Control and grant permissions to other roles.`
                : `Removing management access from “${managementConfirmation?.roleName ?? "this role"}” revokes its explicit permission to administer Access Control and grant permissions to other roles. The server still prevents removal of the last eligible manager, and recovery rules remain unchanged.`}
            </AlertDialogDescription>
            {!managementConfirmation?.allowed && managementConfirmation?.roleUuid === stateQuery.data?.currentRoleId && (
              <div className="mt-3 rounded-md border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" role="alert" data-testid="management-own-role-warning">
                This is your own role. Removing its management access may lock you out of Access Control, even if other manager roles remain. The server will decide whether this change is allowed.
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-management-confirmation">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-management-change"
              onClick={event => {
                event.preventDefault();
                const confirmation = managementConfirmation;
                if (!confirmation) return;
                setManagementConfirmation(null);
                saveManagementMutation.mutate({
                  roleUuid: confirmation.roleUuid,
                  roleName: confirmation.roleName,
                  allowed: confirmation.allowed,
                });
              }}
              disabled={saveManagementMutation.isPending}
            >
              Confirm {managementConfirmation?.allowed ? "grant" : "removal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
