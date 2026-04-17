import React, { useEffect, useMemo, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  vesselUuid?: string | null;
  vessel?: string | null;
  vesselType?: string | null;
  imoNumber?: string | null;
}

function useMasterVessels() {
  return useQuery<VesselOption[]>({
    queryKey: ["/api/v2/vessel/list"],
    queryFn: async () => {
      const res = await fetch("/api/v2/vessel/list");
      if (!res.ok) throw new Error("Failed to load vessels");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
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
  return String(v.vesselUuid ?? v.id ?? "");
}
function getVesselName(v: VesselOption): string {
  return v.vessel ?? "Unnamed vessel";
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
        <Button
          onClick={onNew}
          className="bg-[#16569e] hover:bg-[#0f4078] text-white"
          data-testid="button-add-user"
        >
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
              className={
                filter === f
                  ? "bg-[#52baf3] hover:bg-[#3aa9e5] text-white"
                  : "text-gray-600"
              }
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
                <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                  <TableHead className="text-white font-semibold">First Name</TableHead>
                  <TableHead className="text-white font-semibold">Last Name</TableHead>
                  <TableHead className="text-white font-semibold">Role</TableHead>
                  <TableHead className="text-white font-semibold">Type</TableHead>
                  <TableHead className="text-white font-semibold">Designation</TableHead>
                  <TableHead className="text-white font-semibold">Preferred Auth Method</TableHead>
                  <TableHead className="text-white font-semibold">Status</TableHead>
                  <TableHead className="w-[80px] text-right text-white font-semibold">Actions</TableHead>
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
                            className="h-8 w-8 text-[#16569e] hover:text-[#0f4078] hover:bg-[#52baf3]/10"
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
  const { data: vessels = [], isLoading: loadingVessels } = useMasterVessels();
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
      assignedVesselIds: values.assignedVesselIds,
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

  const allVesselIds = (vessels as VesselOption[])
    .map(getVesselId)
    .filter((id) => !!id);
  const allVesselsSelected =
    allVesselIds.length > 0 &&
    allVesselIds.every((id) => assignedVesselIds.includes(id));
  const someVesselsSelected =
    !allVesselsSelected && assignedVesselIds.length > 0;

  return (
    <div className="bg-white rounded-lg p-6" data-testid="page-user-form">
      <div className="flex items-start gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back-users">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <p className="text-xs uppercase tracking-wider text-gray-400 mt-0.5">
            {isEdit ? "EDIT USER" : "NEW USER"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
            <div className="space-y-8 min-w-0">
              {/* Basic Details */}
              <section>
                <SectionHeader>Basic Details:</SectionHeader>

                <div className="mb-5">
                  <FormField
                    control={form.control}
                    name="userType"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-sm text-gray-700 mb-2 block">
                          User Type:
                        </Label>
                        <FormControl>
                          <RadioGroup
                            className="flex gap-8"
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v as UserType);
                              form.setValue("roleId", "");
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem
                                value="Office"
                                id="user-type-office"
                                data-testid="radio-user-type-office"
                                className="text-[#16569e] border-[#16569e]"
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FloatingField
                          id="input-username"
                          label="Username"
                          required
                          error={!!fieldState.error}
                          rightAdornment={
                            usernameStatus === "checking" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            ) : usernameStatus === "available" ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : usernameStatus === "taken" ? (
                              <X className="h-4 w-4 text-red-500" />
                            ) : null
                          }
                        >
                          <input
                            {...field}
                            data-testid="input-username"
                            placeholder=" "
                            onBlur={() => {
                              field.onBlur();
                              handleUsernameBlur();
                            }}
                            className={floatingInputCls(!!fieldState.error)}
                          />
                        </FloatingField>
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FloatingField
                          id="input-password"
                          label={isEdit ? "New Password" : "Password"}
                          required={!isEdit}
                          error={!!fieldState.error}
                          rightAdornment={
                            <button
                              type="button"
                              onClick={() => setShowPassword((s) => !s)}
                              data-testid="button-toggle-password"
                              className="text-gray-400 hover:text-gray-600"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              aria-pressed={showPassword}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          }
                        >
                          <input
                            {...field}
                            data-testid="input-password"
                            type={showPassword ? "text" : "password"}
                            placeholder=" "
                            className={floatingInputCls(!!fieldState.error)}
                          />
                        </FloatingField>
                        {!fieldState.error && (
                          <p className="text-[11px] text-gray-400 mt-1">{PASSWORD_RULES}</p>
                        )}
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FloatingField id="input-first-name" label="First Name" error={!!fieldState.error}>
                          <input
                            {...field}
                            data-testid="input-first-name"
                            placeholder=" "
                            className={floatingInputCls(!!fieldState.error)}
                          />
                        </FloatingField>
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FloatingField id="input-last-name" label="Last Name" error={!!fieldState.error}>
                          <input
                            {...field}
                            data-testid="input-last-name"
                            placeholder=" "
                            className={floatingInputCls(!!fieldState.error)}
                          />
                        </FloatingField>
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field, fieldState }) => (
                      <FormItem className="md:col-span-2">
                        <FloatingField id="input-email" label="Email" error={!!fieldState.error}>
                          <input
                            {...field}
                            type="email"
                            data-testid="input-email"
                            placeholder=" "
                            className={floatingInputCls(!!fieldState.error)}
                          />
                        </FloatingField>
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <Select
                          value={field.value ? "active" : "inactive"}
                          onValueChange={(v) => field.onChange(v === "active")}
                        >
                          <FloatingSelect label="User Status">
                            <SelectTrigger
                              data-testid="select-user-status"
                              className="h-12 pt-3 border-gray-300 focus:ring-0 focus:ring-offset-0 focus:border-[#16569e]"
                            >
                              <SelectValue placeholder=" " />
                            </SelectTrigger>
                          </FloatingSelect>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* Official Information */}
              <section>
                <SectionHeader>Official Information:</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FloatingSelect label="Role" required>
                            <SelectTrigger
                              data-testid="select-role"
                              className="h-12 pt-3 border-gray-300 focus:ring-0 focus:ring-offset-0 focus:border-[#16569e]"
                            >
                              <SelectValue placeholder=" " />
                            </SelectTrigger>
                          </FloatingSelect>
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
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="designation"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FloatingField id="input-designation" label="Designation" required error={!!fieldState.error}>
                          <input
                            {...field}
                            data-testid="input-designation"
                            placeholder=" "
                            className={floatingInputCls(!!fieldState.error)}
                          />
                        </FloatingField>
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field, fieldState }) => (
                      <FormItem className="md:col-span-2">
                        <FloatingField id="input-department" label="Departments" required error={!!fieldState.error}>
                          <input
                            {...field}
                            data-testid="input-department"
                            placeholder=" "
                            className={floatingInputCls(!!fieldState.error)}
                          />
                        </FloatingField>
                        <FormMessage className="text-[11px] mt-1" />
                      </FormItem>
                    )}
                  />
                </div>
              </section>
            </div>

            {/* Vessels right panel */}
            <aside className="lg:border-l lg:pl-6" data-testid="vessels-panel">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Vessels</h3>
              {loadingVessels ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : (vessels as VesselOption[]).length === 0 ? (
                <p className="text-sm text-gray-500">No vessels available.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    data-testid="row-vessel-all"
                  >
                    <Checkbox
                      checked={
                        allVesselsSelected
                          ? true
                          : someVesselsSelected
                          ? "indeterminate"
                          : false
                      }
                      onCheckedChange={(checked) => {
                        form.setValue(
                          "assignedVesselIds",
                          checked === true ? allVesselIds : [],
                          { shouldDirty: true },
                        );
                      }}
                      data-testid="checkbox-vessel-all"
                      className="data-[state=checked]:bg-[#52baf3] data-[state=checked]:border-[#52baf3] data-[state=indeterminate]:bg-[#52baf3] data-[state=indeterminate]:border-[#52baf3]"
                    />
                    <span className="text-sm text-gray-700">All</span>
                  </label>
                  {(vessels as VesselOption[]).map((v) => {
                    const id = getVesselId(v);
                    if (!id) return null;
                    const checked = assignedVesselIds.includes(id);
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 cursor-pointer"
                        data-testid={`row-vessel-${id}`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleVessel(id)}
                          data-testid={`checkbox-vessel-${id}`}
                          className="data-[state=checked]:bg-[#52baf3] data-[state=checked]:border-[#52baf3]"
                        />
                        <span className="text-sm text-gray-700">{getVesselName(v)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-user">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-[#16569e] hover:bg-[#0f4078] text-white"
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-[#52baf3] mb-1">{children}</h3>
      <div className="h-px bg-gray-200" />
    </div>
  );
}

function floatingInputCls(error: boolean) {
  return [
    "peer w-full h-12 px-3 pt-3 pb-1 text-sm bg-transparent rounded-md",
    "border focus:outline-none focus:ring-0 transition-colors",
    error
      ? "border-red-500 focus:border-red-500 text-red-600"
      : "border-gray-300 focus:border-[#16569e] text-gray-800",
  ].join(" ");
}

function FloatingField({
  id,
  label,
  required,
  error,
  rightAdornment,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: boolean;
  rightAdornment?: React.ReactNode;
  children: React.ReactElement;
}) {
  const child = React.cloneElement(children, {
    id,
    "aria-invalid": error || undefined,
  } as React.HTMLAttributes<HTMLElement>);
  return (
    <div className="relative">
      {child}
      <label
        htmlFor={id}
        className={[
          "pointer-events-none absolute left-2 -top-2 px-1 text-[11px] bg-white transition-all",
          "peer-placeholder-shown:top-3.5 peer-placeholder-shown:left-3 peer-placeholder-shown:text-sm",
          "peer-focus:-top-2 peer-focus:left-2 peer-focus:text-[11px]",
          error
            ? "text-red-500 peer-focus:text-red-500"
            : "text-gray-500 peer-focus:text-[#16569e]",
        ].join(" ")}
      >
        {label}{required ? " *" : ""}
      </label>
      {rightAdornment && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {rightAdornment}
        </div>
      )}
    </div>
  );
}

function FloatingSelect({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <FormControl>
      <div className="relative">
        {children}
        <span className="pointer-events-none absolute -top-2 left-2 px-1 text-[11px] bg-white text-gray-500">
          {label}{required ? " *" : ""}
        </span>
      </div>
    </FormControl>
  );
}
