import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { downloadXlsxMultiSheet, type XlsxSheet } from "@/lib/xlsxExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Download, FileText } from "lucide-react";
import { usePermissions } from "@/contexts/PermissionsContext";

const MENU_NAME = "Test Cases";

const MODULES = [
  "Crew Pool",
  "Vessel",
  "Rest Hours",
  "Promotions",
  "Appraisals",
  "Drugs & Alcohol",
  "Recruitment",
  "Rotation",
  "Admin & Masters",
] as const;

const CATEGORIES = ["Functional", "UAT"] as const;
const PRIORITIES = ["High", "Medium", "Low"] as const;

interface TestCase {
  id: number;
  tcUuid: string;
  module: string;
  reference: string | null;
  title: string;
  areaFeature: string | null;
  category: string;
  priority: string;
  preconditions: string | null;
  steps: string | null;
  expectedResult: string | null;
}

const formSchema = z.object({
  module: z.enum(MODULES, { errorMap: () => ({ message: "Module is required" }) }),
  reference: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  areaFeature: z.string().optional(),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  preconditions: z.string().optional(),
  steps: z.string().optional(),
  expectedResult: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  module: "" as unknown as (typeof MODULES)[number],
  reference: "",
  title: "",
  areaFeature: "",
  category: "Functional",
  priority: "Medium",
  preconditions: "",
  steps: "",
  expectedResult: "",
};

function priorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "High") return "destructive";
  if (priority === "Low") return "outline";
  return "secondary";
}

export function TestCasesModule() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, permissions } = usePermissions();
  const noPerms = permissions.length === 0;
  const mayCreate = noPerms || canCreate(MENU_NAME);
  const mayEdit = noPerms || canEdit(MENU_NAME);
  const mayDelete = noPerms || canDelete(MENU_NAME);

  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TestCase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null);

  const { data: testCases = [], isLoading } = useQuery<TestCase[]>({
    queryKey: ["/api/v2/test-cases"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/v2/test-cases"] });

  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest("POST", "/api/v2/test-cases", values);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "Test case added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add test case", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ uuid, values }: { uuid: string; values: FormValues }) => {
      const res = await apiRequest("PATCH", `/api/v2/test-cases/${uuid}`, values);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "Test case updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update test case", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (uuid: string) => {
      const res = await apiRequest("DELETE", `/api/v2/test-cases/${uuid}`);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Test case deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete test case", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return testCases.filter((tc) => {
      if (moduleFilter !== "all" && tc.module !== moduleFilter) return false;
      if (!q) return true;
      return (
        tc.title.toLowerCase().includes(q) ||
        (tc.reference || "").toLowerCase().includes(q) ||
        (tc.areaFeature || "").toLowerCase().includes(q) ||
        (tc.steps || "").toLowerCase().includes(q) ||
        (tc.expectedResult || "").toLowerCase().includes(q)
      );
    });
  }, [testCases, moduleFilter, search]);

  const openCreate = () => {
    setEditing(null);
    form.reset({
      ...emptyValues,
      module:
        moduleFilter !== "all"
          ? (moduleFilter as (typeof MODULES)[number])
          : ("" as unknown as (typeof MODULES)[number]),
    });
    setDialogOpen(true);
  };

  const openEdit = (tc: TestCase) => {
    setEditing(tc);
    form.reset({
      module: tc.module as (typeof MODULES)[number],
      reference: tc.reference || "",
      title: tc.title,
      areaFeature: tc.areaFeature || "",
      category: tc.category as (typeof CATEGORIES)[number],
      priority: tc.priority as (typeof PRIORITIES)[number],
      preconditions: tc.preconditions || "",
      steps: tc.steps || "",
      expectedResult: tc.expectedResult || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: FormValues) => {
    if (editing) {
      updateMutation.mutate({ uuid: editing.tcUuid, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleExport = () => {
    const sorted = [...testCases].sort((a, b) =>
      a.module === b.module ? a.id - b.id : a.module.localeCompare(b.module),
    );

    const byModule = new Map<string, TestCase[]>();
    for (const tc of sorted) {
      const arr = byModule.get(tc.module) || [];
      arr.push(tc);
      byModule.set(tc.module, arr);
    }

    const summaryRows = Array.from(byModule.entries()).map(([module, items], i) => ({
      no: i + 1,
      module,
      total: items.length,
      functional: items.filter((t) => t.category === "Functional").length,
      uat: items.filter((t) => t.category === "UAT").length,
    }));
    summaryRows.push({
      no: summaryRows.length + 1,
      module: "TOTAL",
      total: sorted.length,
      functional: sorted.filter((t) => t.category === "Functional").length,
      uat: sorted.filter((t) => t.category === "UAT").length,
    });

    const detailColumns = [
      { key: "reference", label: "Reference" },
      { key: "title", label: "Title" },
      { key: "areaFeature", label: "Area / Feature" },
      { key: "category", label: "Category" },
      { key: "priority", label: "Priority" },
      { key: "preconditions", label: "Preconditions" },
      { key: "steps", label: "Steps" },
      { key: "expectedResult", label: "Expected Result" },
    ];

    const sheets: XlsxSheet[] = [
      {
        sheetName: "Summary",
        columns: [
          { key: "no", label: "#" },
          { key: "module", label: "Module" },
          { key: "total", label: "Total" },
          { key: "functional", label: "Functional" },
          { key: "uat", label: "UAT" },
        ],
        rows: summaryRows,
      },
      ...Array.from(byModule.entries()).map(([module, items]) => ({
        sheetName: module,
        columns: detailColumns,
        rows: items as unknown as Array<Record<string, unknown>>,
      })),
    ];

    const date = new Date().toISOString().slice(0, 10);
    downloadXlsxMultiSheet(`Crewing_Test_Cases_${date}.xlsx`, sheets);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto" data-testid="test-cases-module">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-[#16569e]" />
          <div>
            <h1 className="text-xl font-semibold text-gray-800" data-testid="text-page-title">
              Crewing Test Case Manager
            </h1>
            <p className="text-sm text-gray-500">
              Manage functional and UAT test cases grouped by module.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={testCases.length === 0}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          {mayCreate && (
            <Button onClick={openCreate} data-testid="button-add-test-case">
              <Plus className="h-4 w-4 mr-2" />
              Add Test Case
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-module-filter">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {MODULES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search title, reference, steps..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
          data-testid="input-search"
        />
      </div>

      <div className="border rounded-md overflow-hidden bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500" data-testid="text-empty-state">
            No test cases found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Reference</TableHead>
                <TableHead className="w-[150px]">Module</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[170px]">Area / Feature</TableHead>
                <TableHead className="w-[110px]">Category</TableHead>
                <TableHead className="w-[100px]">Priority</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tc) => (
                <TableRow key={tc.tcUuid} data-testid={`row-test-case-${tc.tcUuid}`}>
                  <TableCell className="font-mono text-xs" data-testid={`text-reference-${tc.tcUuid}`}>
                    {tc.reference || "-"}
                  </TableCell>
                  <TableCell className="text-sm">{tc.module}</TableCell>
                  <TableCell className="text-sm font-medium" data-testid={`text-title-${tc.tcUuid}`}>
                    {tc.title}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600" data-testid={`text-area-feature-${tc.tcUuid}`}>
                    {tc.areaFeature || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{tc.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(tc.priority)}>{tc.priority}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {mayEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(tc)}
                          data-testid={`button-edit-${tc.tcUuid}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {mayDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(tc)}
                          data-testid={`button-delete-${tc.tcUuid}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3" data-testid="text-count">
        {filtered.length} test case{filtered.length === 1 ? "" : "s"} shown
        {moduleFilter !== "all" || search ? ` (of ${testCases.length} total)` : ""}
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editing ? "Edit Test Case" : "Add Test Case"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="module"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Module</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-module">
                            <SelectValue placeholder="Select module" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MODULES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
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
                  name="reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CP-001" {...field} data-testid="input-reference" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Test case title" {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="areaFeature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area / Feature</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Document Management"
                        {...field}
                        data-testid="input-area-feature"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
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
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="preconditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preconditions</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Preconditions" {...field} data-testid="input-preconditions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="steps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steps</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Test steps" {...field} data-testid="input-steps" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectedResult"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Result</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Expected result" {...field} data-testid="input-expected-result" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} data-testid="button-save">
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editing ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete test case?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deleteTarget?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.tcUuid)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
