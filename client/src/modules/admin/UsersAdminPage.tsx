import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Eye, EyeOff, ArrowLeft, X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useExternalVessels } from "@/hooks/useExternalVessels";
import {
  useAdminUserV2,
  useAdminUsersV2,
  useCreateAdminUserV2,
  useUpdateAdminUserV2,
  checkUsernameAvailable,
} from "./hooks/useAdminUsersV2";
import { useAccessControlRolesV2 } from "./hooks/useAdminV2";
import type {
  AdminUserDto,
  CreateUserPayload,
  UpdateUserPayload,
} from "./api/adminUsersApiV2";

function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function getApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return "Something went wrong.";
}

type UserType = "Office" | "Vessel";
type FilterType = "All" | UserType;
type Mode = "list" | "new" | "edit";

interface VesselOption {
  id?: string | number;
  vesselId?: string;
  vesselUuid?: string;
  vesselName?: string;
  name?: string;
}

interface RoleOption {
  ruid: string;
  assignedRole: string;
  roletype?: string;
}

const PASSWORD_RULES =
  "At least 12 characters, with uppercase, lowercase, and a digit.";

const passwordSchema = z
  .string()
  .min(12, "At least 12 characters")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[0-9]/, "Must include a digit");

const baseFields = {
  username: z.string().trim().min(1, "Username is required").max(128),
  firstName: z.string().trim().min(1, "First name is required").max(128),
  lastName: z.string().trim().max(128).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  designation: z.string().trim().max(256).optional().or(z.literal("")),
  department: z.string().trim().max(256).optional().or(z.literal("")),
  preferredAuthMethod: z.enum(["TOTP", "NA"]).default("NA"),
  userType: z.enum(["Office", "Vessel"]),
  roleId: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  assignedVesselIds: z.array(z.string()).default([]),
};

const newUserSchema = z.object({
  ...baseFields,
  password: passwordSchema,
});

const editUserSchema = z.object({
  ...baseFields,
  password: z.union([z.literal(""), passwordSchema]).optional(),
});

type NewUserForm = z.infer<typeof newUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;

function getVesselId(v: VesselOption): string {
  return String(v.vesselId ?? v.vesselUuid ?? v.id ?? "");
}
function getVesselName(v: VesselOption): string {
  return v.vesselName ?? v.name ?? "Unnamed vessel";
}


export default function UsersAdminPage() {
  const [mode, setMode] = useState<Mode>("list");
  const [editUuid, setEditUuid] = useState<string | null>(null);

  if (mode === "new") {
    return <UserForm mode="new" onClose={() => setMode("list")} />;
  }
  if (mode === "edit" && editUuid) {
    return (
      <UserForm
        mode="edit"
        userUuid={editUuid}
        onClose={() => {
          setMode("list");
          setEditUuid(null);
        }}
      />
    );
  }

  return (
    <UsersList
      onNew={() => setMode("new")}
      onEdit={(uuid) => {
        setEditUuid(uuid);
        setMode("edit");
      }}
    />
  );
}

function UsersList({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (uuid: string) => void;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [filter, setFilter] = useState<FilterType>("All");

  const { data: users = [], isLoading } = useAdminUsersV2({
    search: debouncedSearch || undefined,
    type: filter === "All" ? undefined : filter,
  });

  return (
    <div className="bg-white rounded-lg p-6 space-y-4" data-testid="page-users">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800" data-testid="text-users-title">
            Users
          </h2>
          <p className="text-sm text-gray-500">
            Manage office and vessel user accounts.
          </p>
        </div>
        <Button onClick={onNew} data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            data-testid="input-search-users"
            placeholder="Search by username, name, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md w-fit">
          {(["All", "Office", "Vessel"] as FilterType[]).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              onClick={() => setFilter(f)}
              data-testid={`button-filter-${f.toLowerCase()}`}
              className={filter === f ? "" : "text-gray-600"}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Preferred Auth Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      <Loader2 className="h-4 w-4 mx-auto animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  users.map((u: AdminUserDto) => {
                    const rowKey = u.uuid ?? String(u.id);
                    return (
                      <TableRow key={rowKey} data-testid={`row-user-${rowKey}`}>
                        <TableCell data-testid={`text-firstname-${rowKey}`}>
                          {u.firstName || "—"}
                        </TableCell>
                        <TableCell data-testid={`text-lastname-${rowKey}`}>
                          {u.lastName || "—"}
                        </TableCell>
                        <TableCell>
                          {u.roleName || <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" data-testid={`badge-type-${rowKey}`}>
                            {u.userType === "Office" ? "Office" : "Vessel"}
                          </Badge>
                        </TableCell>
                        <TableCell>{u.designation || "—"}</TableCell>
                        <TableCell data-testid={`text-auth-method-${rowKey}`}>
                          {u.preferredAuthMethod === "TOTP" ? "TOTP" : "None"}
                        </TableCell>
                        <TableCell>
                          {u.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => u.uuid && onEdit(u.uuid)}
                            disabled={!u.uuid}
                            data-testid={`button-edit-user-${rowKey}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function UserForm({
  mode,
  userUuid,
  onClose,
}: {
  mode: "new" | "edit";
  userUuid?: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = mode === "edit";
  const { data: existing, isLoading: loadingUser } = useAdminUserV2(
    isEdit ? userUuid ?? null : null,
  );
  const { data: vessels = [], isLoading: loadingVessels } = useExternalVessels();
  const { data: roles = [] } = useAccessControlRolesV2();

  const createMutation = useCreateAdminUserV2();
  const updateMutation = useUpdateAdminUserV2();

  type FormValues = EditUserForm; // superset of NewUserForm (password optional)
  const schema = isEdit ? editUserSchema : newUserSchema;
  const resolver = zodResolver(schema) as Resolver<FormValues>;

  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      designation: "",
      department: "",
      preferredAuthMethod: "NA",
      userType: "Office",
      roleId: "",
      isActive: true,
      assignedVesselIds: [],
    },
  });

  const userType = form.watch("userType");
  const assignedVesselIds = form.watch("assignedVesselIds") || [];

  const filteredRoles = useMemo<RoleOption[]>(() => {
    const list: RoleOption[] = (roles as RoleOption[]) || [];
    return list.filter((r) => {
      if (!r.roletype) return true;
      if (userType === "Office") return r.roletype === "Office";
      return r.roletype === "Ship" || r.roletype === "Vessel";
    });
  }, [roles, userType]);

  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  // Hydrate form when editing
  useEffect(() => {
    if (!isEdit || !existing) return;
    form.reset({
      username: existing.username || "",
      password: "",
      firstName: existing.firstName || "",
      lastName: existing.lastName || "",
      email: existing.email || "",
      designation: existing.designation || "",
      department: existing.department || "",
      preferredAuthMethod: (existing.preferredAuthMethod as "TOTP" | "NA") || "NA",
      userType: (existing.userType === "Vessel" ? "Vessel" : "Office") as UserType,
      roleId: existing.roleId || "",
      isActive: !!existing.isActive,
      assignedVesselIds: existing.assignedVesselIds || [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, isEdit]);

  async function handleUsernameBlur() {
    const v = form.getValues("username")?.trim();
    if (!v) return setUsernameStatus("idle");
    if (isEdit && existing && v.toLowerCase() === existing.username.toLowerCase()) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    try {
      const ok = await checkUsernameAvailable(v, isEdit ? userUuid : undefined);
      setUsernameStatus(ok ? "available" : "taken");
      if (!ok) {
        form.setError("username", {
          type: "manual",
          message: "This username is already taken",
        });
      } else {
        form.clearErrors("username");
      }
    } catch {
      setUsernameStatus("idle");
    }
  }

  function toggleVessel(vid: string) {
    const cur = new Set(form.getValues("assignedVesselIds") || []);
    if (cur.has(vid)) cur.delete(vid);
    else cur.add(vid);
    form.setValue("assignedVesselIds", Array.from(cur), { shouldDirty: true });
  }

  async function onSubmit(values: FormValues) {
    if (usernameStatus === "taken") {
      form.setError("username", {
        type: "manual",
        message: "This username is already taken",
      });
      return;
    }
    const username = values.username.trim();
    const basePayload: UpdateUserPayload = {
      username,
      firstName: values.firstName.trim(),
      lastName: values.lastName?.trim() || null,
      email: values.email?.trim() || null,
      designation: values.designation?.trim() || null,
      department: values.department?.trim() || null,
      preferredAuthMethod: values.preferredAuthMethod,
      userType: values.userType,
      roleId: values.roleId || null,
      isActive: values.isActive,
      assignedVesselIds:
        values.userType === "Vessel" ? values.assignedVesselIds : [],
    };
    const password = values.password?.trim() || "";

    try {
      if (isEdit && userUuid) {
        const updatePayload: UpdateUserPayload = password
          ? { ...basePayload, password }
          : basePayload;
        await updateMutation.mutateAsync({ uuid: userUuid, payload: updatePayload });
        toast({ title: "User updated", description: `${username} has been saved.` });
      } else {
        const createPayload: CreateUserPayload = {
          ...basePayload,
          firstName: basePayload.firstName ?? "",
          username,
          password,
          userType: values.userType,
        };
        await createMutation.mutateAsync(createPayload);
        toast({ title: "User created", description: `${username} has been added.` });
      }
      onClose();
    } catch (err: unknown) {
      toast({
        title: "Save failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  }

  if (isEdit && loadingUser) {
    return (
      <div className="bg-white rounded-lg p-10 flex justify-center" data-testid="page-user-form-loading">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 space-y-6" data-testid="page-user-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back-users">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              {isEdit ? "Edit User" : "New User"}
            </h2>
            <p className="text-sm text-gray-500">
              {isEdit
                ? "Update account details, role, and vessel access."
                : "Create a new account with the appropriate role and access."}
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Details */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          data-testid="input-username"
                          placeholder="e.g. jdoe"
                          onBlur={() => {
                            field.onBlur();
                            handleUsernameBlur();
                          }}
                        />
                        {usernameStatus === "checking" && (
                          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                        )}
                        {usernameStatus === "available" && (
                          <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                        )}
                        {usernameStatus === "taken" && (
                          <X className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-email" type="email" placeholder="user@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      {isEdit ? "New Password" : "Password *"}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          data-testid="input-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={isEdit ? "Leave blank to keep current password" : "Choose a strong password"}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowPassword((s) => !s)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">{PASSWORD_RULES}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Official Information */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Official Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-designation" placeholder="e.g. Crewing Manager" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-department" placeholder="e.g. Crewing" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Type *</FormLabel>
                    <FormControl>
                      <RadioGroup
                        className="flex gap-6 pt-1"
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v as UserType);
                          // Clear role on type change to avoid mismatched filter
                          form.setValue("roleId", "");
                          if (v === "Office") {
                            form.setValue("assignedVesselIds", []);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            value="Office"
                            id="user-type-office"
                            data-testid="radio-user-type-office"
                          />
                          <Label htmlFor="user-type-office" className="cursor-pointer text-sm">
                            Office
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            value="Vessel"
                            id="user-type-vessel"
                            data-testid="radio-user-type-vessel"
                          />
                          <Label htmlFor="user-type-vessel" className="cursor-pointer text-sm">
                            Vessel
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredRoles.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-gray-500">
                            No roles available
                          </div>
                        )}
                        {filteredRoles.map((r) => (
                          <SelectItem key={r.ruid} value={r.ruid}>
                            {r.assignedRole}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preferredAuthMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Auth Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-auth-method">
                          <SelectValue placeholder="Select auth method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NA">None (password only)</SelectItem>
                        <SelectItem value="TOTP">TOTP (Authenticator app)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border px-4 py-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Account Active</Label>
                      <p className="text-xs text-gray-500">
                        Inactive users cannot log in.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* Vessels panel */}
          {userType === "Vessel" && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Assigned Vessels
              </h3>
              {loadingVessels ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (vessels as VesselOption[]).length === 0 ? (
                <p className="text-sm text-gray-500">No vessels available.</p>
              ) : (
                <ScrollArea className="max-h-72 border rounded-md">
                  <div
                    className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50 sticky top-0"
                    data-testid="row-vessel-all"
                  >
                    {(() => {
                      const allIds = (vessels as VesselOption[])
                        .map(getVesselId)
                        .filter((id) => !!id);
                      const allSelected =
                        allIds.length > 0 &&
                        allIds.every((id) => assignedVesselIds.includes(id));
                      const someSelected =
                        !allSelected && assignedVesselIds.length > 0;
                      return (
                        <>
                          <Checkbox
                            id="vessel-all"
                            checked={
                              allSelected
                                ? true
                                : someSelected
                                ? "indeterminate"
                                : false
                            }
                            onCheckedChange={(checked) => {
                              form.setValue(
                                "assignedVesselIds",
                                checked === true ? allIds : [],
                                { shouldDirty: true },
                              );
                            }}
                            data-testid="checkbox-vessel-all"
                          />
                          <Label
                            htmlFor="vessel-all"
                            className="text-sm font-medium cursor-pointer"
                          >
                            All vessels
                          </Label>
                          <span className="ml-auto text-xs text-gray-500">
                            {assignedVesselIds.length} / {allIds.length}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <ul className="divide-y" data-testid="list-vessels">
                    {(vessels as VesselOption[]).map((v) => {
                      const id = getVesselId(v);
                      if (!id) return null;
                      const checked = assignedVesselIds.includes(id);
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleVessel(id)}
                          data-testid={`row-vessel-${id}`}
                        >
                          <span className="text-sm text-gray-700">{getVesselName(v)}</span>
                          <Switch
                            checked={checked}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleVessel(id)}
                            data-testid={`switch-vessel-${id}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {assignedVesselIds.length} vessel(s) selected.
              </p>
            </section>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-user">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-user"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isEdit ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
