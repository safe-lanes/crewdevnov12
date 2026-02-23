import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Permission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  children?: MenuItem[];
}

interface RolePermissions {
  [menuId: string]: Permission;
}

interface RoleData {
  id: string;
  name: string;
  permissions: RolePermissions;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "report", name: "Report" },
  {
    id: "history",
    name: "History",
    children: [
      { id: "inspections", name: "Inspections" },
      { id: "officers", name: "Officers" },
    ],
  },
  { id: "port", name: "Port" },
  { id: "preparation", name: "Preparation" },
  {
    id: "planning",
    name: "Planning",
    children: [
      { id: "schedule", name: "Schedule" },
      { id: "budget", name: "Budget" },
    ],
  },
  { id: "inspectors", name: "Inspectors" },
  { id: "fleet-notification", name: "Fleet Notification" },
];

const ROLES: RoleData[] = [
  {
    id: "sail-admin",
    name: "Sail Admin",
    permissions: {
      report: { view: true, create: true, edit: true, delete: true },
      history: { view: true, create: true, edit: true, delete: true },
      inspections: { view: true, create: false, edit: false, delete: false },
      officers: { view: true, create: true, edit: true, delete: true },
      port: { view: false, create: false, edit: false, delete: false },
      preparation: { view: true, create: true, edit: true, delete: true },
      planning: { view: true, create: true, edit: true, delete: true },
      schedule: { view: true, create: true, edit: true, delete: true },
      budget: { view: true, create: true, edit: true, delete: true },
      inspectors: { view: true, create: true, edit: true, delete: true },
      "fleet-notification": { view: true, create: true, edit: true, delete: true },
    },
  },
  {
    id: "super-admin",
    name: "Super Admin",
    permissions: {
      report: { view: true, create: true, edit: true, delete: true },
      history: { view: true, create: true, edit: true, delete: true },
      inspections: { view: true, create: true, edit: true, delete: true },
      officers: { view: true, create: true, edit: true, delete: true },
      port: { view: true, create: true, edit: true, delete: true },
      preparation: { view: true, create: true, edit: true, delete: true },
      planning: { view: true, create: true, edit: true, delete: true },
      schedule: { view: true, create: true, edit: true, delete: true },
      budget: { view: true, create: true, edit: true, delete: true },
      inspectors: { view: true, create: true, edit: true, delete: true },
      "fleet-notification": { view: true, create: true, edit: true, delete: true },
    },
  },
  {
    id: "admin",
    name: "Admin",
    permissions: {
      report: { view: true, create: true, edit: true, delete: false },
      history: { view: true, create: true, edit: true, delete: false },
      inspections: { view: true, create: false, edit: false, delete: false },
      officers: { view: true, create: true, edit: true, delete: false },
      port: { view: true, create: true, edit: true, delete: false },
      preparation: { view: true, create: true, edit: true, delete: false },
      planning: { view: true, create: true, edit: true, delete: false },
      schedule: { view: true, create: true, edit: true, delete: false },
      budget: { view: true, create: true, edit: true, delete: false },
      inspectors: { view: true, create: true, edit: true, delete: false },
      "fleet-notification": { view: true, create: true, edit: true, delete: false },
    },
  },
  {
    id: "user",
    name: "User",
    permissions: {
      report: { view: true, create: false, edit: false, delete: false },
      history: { view: true, create: false, edit: false, delete: false },
      inspections: { view: true, create: false, edit: false, delete: false },
      officers: { view: true, create: false, edit: false, delete: false },
      port: { view: false, create: false, edit: false, delete: false },
      preparation: { view: true, create: false, edit: false, delete: false },
      planning: { view: true, create: false, edit: false, delete: false },
      schedule: { view: true, create: false, edit: false, delete: false },
      budget: { view: true, create: false, edit: false, delete: false },
      inspectors: { view: true, create: false, edit: false, delete: false },
      "fleet-notification": { view: true, create: false, edit: false, delete: false },
    },
  },
  {
    id: "vessel-admin",
    name: "Vessel Admin",
    permissions: {
      report: { view: true, create: true, edit: true, delete: false },
      history: { view: true, create: true, edit: true, delete: false },
      inspections: { view: true, create: true, edit: false, delete: false },
      officers: { view: true, create: true, edit: true, delete: false },
      port: { view: true, create: false, edit: false, delete: false },
      preparation: { view: true, create: true, edit: true, delete: false },
      planning: { view: true, create: true, edit: true, delete: false },
      schedule: { view: true, create: true, edit: false, delete: false },
      budget: { view: true, create: false, edit: false, delete: false },
      inspectors: { view: true, create: false, edit: false, delete: false },
      "fleet-notification": { view: true, create: false, edit: false, delete: false },
    },
  },
  {
    id: "vessel-user",
    name: "Vessel User",
    permissions: {
      report: { view: true, create: false, edit: false, delete: false },
      history: { view: true, create: false, edit: false, delete: false },
      inspections: { view: true, create: false, edit: false, delete: false },
      officers: { view: true, create: false, edit: false, delete: false },
      port: { view: false, create: false, edit: false, delete: false },
      preparation: { view: true, create: false, edit: false, delete: false },
      planning: { view: true, create: false, edit: false, delete: false },
      schedule: { view: true, create: false, edit: false, delete: false },
      budget: { view: true, create: false, edit: false, delete: false },
      inspectors: { view: true, create: false, edit: false, delete: false },
      "fleet-notification": { view: true, create: false, edit: false, delete: false },
    },
  },
  {
    id: "external-1",
    name: "External 1",
    permissions: {
      report: { view: true, create: false, edit: false, delete: false },
      history: { view: true, create: false, edit: false, delete: false },
      inspections: { view: false, create: false, edit: false, delete: false },
      officers: { view: false, create: false, edit: false, delete: false },
      port: { view: false, create: false, edit: false, delete: false },
      preparation: { view: false, create: false, edit: false, delete: false },
      planning: { view: false, create: false, edit: false, delete: false },
      schedule: { view: false, create: false, edit: false, delete: false },
      budget: { view: false, create: false, edit: false, delete: false },
      inspectors: { view: false, create: false, edit: false, delete: false },
      "fleet-notification": { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    id: "external-2",
    name: "External 2",
    permissions: {
      report: { view: true, create: false, edit: false, delete: false },
      history: { view: false, create: false, edit: false, delete: false },
      inspections: { view: false, create: false, edit: false, delete: false },
      officers: { view: false, create: false, edit: false, delete: false },
      port: { view: false, create: false, edit: false, delete: false },
      preparation: { view: false, create: false, edit: false, delete: false },
      planning: { view: false, create: false, edit: false, delete: false },
      schedule: { view: false, create: false, edit: false, delete: false },
      budget: { view: false, create: false, edit: false, delete: false },
      inspectors: { view: false, create: false, edit: false, delete: false },
      "fleet-notification": { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    id: "external-3",
    name: "External 3",
    permissions: {
      report: { view: false, create: false, edit: false, delete: false },
      history: { view: false, create: false, edit: false, delete: false },
      inspections: { view: false, create: false, edit: false, delete: false },
      officers: { view: false, create: false, edit: false, delete: false },
      port: { view: false, create: false, edit: false, delete: false },
      preparation: { view: false, create: false, edit: false, delete: false },
      planning: { view: false, create: false, edit: false, delete: false },
      schedule: { view: false, create: false, edit: false, delete: false },
      budget: { view: false, create: false, edit: false, delete: false },
      inspectors: { view: false, create: false, edit: false, delete: false },
      "fleet-notification": { view: false, create: false, edit: false, delete: false },
    },
  },
];

const PERMISSION_KEYS: (keyof Permission)[] = ["view", "create", "edit", "delete"];

export default function AccessControlPage() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>("sail-admin");
  const [rolesData, setRolesData] = useState<RoleData[]>(ROLES);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  const currentRole = rolesData.find((r) => r.id === selectedRole);

  const toggleExpand = useCallback((menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  }, []);

  const handlePermissionChange = useCallback(
    (menuId: string, permKey: keyof Permission, checked: boolean) => {
      setRolesData((prev) =>
        prev.map((role) => {
          if (role.id !== selectedRole) return role;
          return {
            ...role,
            permissions: {
              ...role.permissions,
              [menuId]: {
                ...role.permissions[menuId],
                [permKey]: checked,
              },
            },
          };
        })
      );
    },
    [selectedRole]
  );

  const handleSave = useCallback(() => {
    toast({
      title: "Changes Saved",
      description: `Permissions for "${currentRole?.name}" have been saved successfully.`,
    });
  }, [currentRole, toast]);

  const renderMenuRow = (item: MenuItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.has(item.id);
    const perms = currentRole?.permissions[item.id] || {
      view: false,
      create: false,
      edit: false,
      delete: false,
    };

    return (
      <div key={item.id}>
        <div
          className={`grid grid-cols-[1fr_repeat(4,80px)] items-center border-b border-gray-200 ${
            depth > 0 ? "bg-gray-50/50" : "bg-white"
          } hover:bg-blue-50/30 transition-colors`}
          style={{ paddingLeft: depth > 0 ? `${depth * 24 + 16}px` : "16px" }}
          data-testid={`permission-row-${item.id}`}
        >
          <div className="flex items-center gap-2 py-2.5 pr-2">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(item.id)}
                className="p-0.5 rounded hover:bg-gray-200 transition-colors"
                data-testid={`toggle-menu-${item.id}`}
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
            <span className="text-sm text-gray-800 font-medium" data-testid={`text-menu-name-${item.id}`}>
              {item.name}
            </span>
          </div>
          {PERMISSION_KEYS.map((key) => (
            <div
              key={key}
              className="flex items-center justify-center py-2.5"
            >
              <Checkbox
                checked={perms[key]}
                onCheckedChange={(checked) =>
                  handlePermissionChange(item.id, key, !!checked)
                }
                className="h-[18px] w-[18px] border-gray-300 data-[state=checked]:bg-[#4a90d9] data-[state=checked]:border-[#4a90d9]"
                data-testid={`checkbox-${item.id}-${key}`}
              />
            </div>
          ))}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {item.children!.map((child) => renderMenuRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-140px)] max-w-full" data-testid="access-control-page">
      <div className="w-[200px] min-w-[200px] flex flex-col border border-gray-200 rounded-l-lg overflow-hidden bg-white">
        <div className="bg-[#4a90d9] text-white text-sm font-semibold px-4 py-2.5" data-testid="text-roles-header">
          Roles
        </div>
        <ScrollArea className="flex-1">
          {rolesData.map((role) => (
            <div
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`px-4 py-2.5 text-sm cursor-pointer border-b border-gray-100 transition-colors ${
                selectedRole === role.id
                  ? "bg-[#52baf3] text-white font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              data-testid={`role-item-${role.id}`}
            >
              {role.name}
            </div>
          ))}
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col border border-l-0 border-gray-200 rounded-r-lg overflow-hidden bg-white">
        <div className="grid grid-cols-[1fr_repeat(4,80px)] bg-[#4a90d9] text-white text-sm font-semibold" data-testid="text-permissions-header">
          <div className="px-4 py-2.5" data-testid="text-header-menu-name">Menu Name</div>
          <div className="text-center py-2.5" data-testid="text-header-view">View</div>
          <div className="text-center py-2.5" data-testid="text-header-create">Create</div>
          <div className="text-center py-2.5" data-testid="text-header-edit">Edit</div>
          <div className="text-center py-2.5" data-testid="text-header-delete">Delete</div>
        </div>
        <ScrollArea className="flex-1">
          {MENU_ITEMS.map((item) => renderMenuRow(item))}
        </ScrollArea>
        <div className="flex justify-end p-3 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={handleSave}
            className="bg-[#16569e] hover:bg-[#0f4078] text-white px-6"
            data-testid="button-save-access-control"
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
