import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
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

const LOCK_ACTION_MENUS = new Set(["rh lock", "rh unlock"]);
const LOCK_ACTION_DISABLED_KEYS = new Set<keyof Permission>(["canedit", "candelete"]);

const CP_FORM_SECTION_MENUS = new Set([
  "cp dashboard", "cp travel id documents", "cp training certificates",
  "cp sea service", "cp medical"
]);
const CP_FORM_DISABLED_KEYS = new Set<keyof Permission>(["candelete"]);

const VIEW_ONLY_SECTION_MENUS = new Set([
  "pm criteria review", "pm approval", "pm execution",
  "ap seafarer info", "ap start info", "ap competence", "ap behavioural",
  "ap training needs", "ap summary", "ap office review"
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
  const [selectedRoleUuid, setSelectedRoleUuid] = useState<string | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Record<string, Permission>>({});
  const [expandedMenus, setExpandedMenus] = useState<Set<string> | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const { data: menusData = [], isLoading: menusLoading } = useAccessControlMenusV2();
  const { data: rolesData = [], isLoading: rolesLoading } = useAccessControlRolesV2();
  const { data: permissionsData = [], isLoading: permissionsLoading } = useAccessControlPermissionsV2(selectedRoleUuid);
  const savePermissionsMutation = useSaveAccessControlPermissionsV2();

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
          canview: false,
          cancreate: false,
          canedit: false,
          candelete: false,
          ...prev[menuMuid],
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
    <div className="flex gap-0 h-[calc(100vh-140px)] max-w-full" data-testid="access-control-page">
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
  );
}
