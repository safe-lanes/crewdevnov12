import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ReportResultsTable } from "@/components/reports/ReportResultsTable";
import type { ReportRunResponse } from "@shared/v2/reports/types";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  Maximize2,
  Minimize2,
  BarChart3,
  FileBarChart,
  UserPlus,
  Ship,
  Users,
  RefreshCw,
  TrendingUp,
  ClipboardList,
  FlaskConical,
  Clock,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import MainLayout from "@/components/main/MainLayout";
import { useViewport, getLayoutConfig } from "@/hooks/useViewport";
import { useToast } from "@/hooks/use-toast";
import { useCompanyRanks } from "@/hooks/useCompanyRanks";
import { useNationalitiesV2, useVesselsV2 } from "@/hooks/v2/useMasterDataV2";

interface ReportLeaf {
  id: string;
  label: string;
}

interface ReportCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  children: ReportLeaf[];
}

const REPORT_TREE: ReportCategory[] = [
  {
    id: "recruitment",
    label: "Recruitment",
    icon: UserPlus,
    children: [
      { id: "rec-recruited", label: "Recruited" },
      { id: "rec-waitlist", label: "Waitlist" },
      { id: "rec-rejected", label: "Rejected" },
      // Temporarily hidden from Reports sidebar (uncomment to restore)
      // { id: "rec-applications-by-source", label: "Applications by Source" },
      // { id: "rec-interview-pipeline", label: "Interview Pipeline" },
      // { id: "rec-offers-issued", label: "Offers Issued" },
      // { id: "rec-joining-status", label: "Joining Status" },
      // { id: "rec-medical-pending", label: "Medical Pending" },
      // { id: "rec-document-pending", label: "Document Pending" },
    ],
  },
  {
    id: "vessel",
    label: "Vessel",
    icon: Ship,
    children: [
      { id: "vsl-crew-on-board", label: "Crew on Board by Vessel" },
      { id: "vsl-crew-changes", label: "Crew Changes by Vessel" },
      // Temporarily hidden from Reports sidebar (uncomment to restore)
      // { id: "vsl-manning-status", label: "Vessel Manning Status" },
      // { id: "vsl-vacancies", label: "Vacancies by Vessel" },
      // { id: "vsl-owner-manning", label: "Owner-wise Manning" },
      // { id: "vsl-flag-manning", label: "Flag-wise Manning" },
      // { id: "vsl-visit-schedule", label: "Vessel Visit Schedule" },
      // { id: "vsl-signon-signoff", label: "Sign-on/Sign-off Log" },
      // { id: "vsl-compliance-summary", label: "Vessel Compliance Summary" },
    ],
  },
  {
    id: "crew-pool",
    label: "Crew Pool",
    icon: Users,
    children: [
      { id: "cp-active", label: "Active Crew" },
      { id: "cp-on-leave", label: "Crew on Leave" },
      { id: "cp-available-to-join", label: "Crew Available to Join" },
      { id: "cp-terminated", label: "Terminated Crew" },
      { id: "cp-not-for-rehire", label: "Not-for-Rehire List" },
      { id: "cp-by-rank", label: "Crew by Rank" },
      { id: "cp-by-nationality", label: "Crew by Nationality" },
      { id: "cp-contact-details", label: "Contact Details of Crew" },
      { id: "cp-contract-expiry", label: "Contract Expiry Within N Days" },
    ],
  },
  {
    id: "rotation",
    label: "Rotation",
    icon: RefreshCw,
    children: [
      // Temporarily hidden from Reports sidebar (uncomment to restore)
      // { id: "rot-overdue-relief", label: "Crew Overdue for Relief" },
      { id: "rot-planned-reliefs", label: "Planned Reliefs Within N Days" },
    ],
  },
  {
    id: "promotion",
    label: "Promotion",
    icon: TrendingUp,
    children: [
      // Temporarily hidden from Reports sidebar (uncomment to restore)
      // { id: "promo-meeting-criteria", label: "Crew Meeting Promotion Criteria" },
      { id: "promo-approved-ytd", label: "Promotions Approved YTD" },
    ],
  },
  {
    id: "appraisals",
    label: "Appraisals",
    icon: ClipboardList,
    children: [
      // Temporarily hidden from Reports sidebar (uncomment to restore)
      // { id: "appr-pending", label: "Pending Appraisals" },
      { id: "appr-scores-summary", label: "Appraisal Scores Summary" },
    ],
  },
  {
    id: "drug-alcohol",
    label: "Drug & Alcohol",
    icon: FlaskConical,
    children: [
      // Temporarily hidden from Reports sidebar (uncomment to restore)
      // { id: "da-tests-due", label: "D&A Tests Due" },
      { id: "da-violations", label: "D&A Violations" },
    ],
  },
  {
    id: "rest-hours",
    label: "Rest Hours",
    icon: Clock,
    children: [
      { id: "rh-violations", label: "Rest Hour Violations" },
      { id: "rh-compliance-summary", label: "Rest Hour Compliance Summary" },
    ],
  },
  {
    id: "training",
    label: "Training",
    icon: GraduationCap,
    children: [
      { id: "trn-certs-expiring", label: "Certificates Expiring Within N Days" },
    ],
  },
];

type FilterKind =
  | "rank"
  | "vessel"
  | "nationality"
  | "source"
  | "dateRange"
  | "testType"
  | "withinDays"
  | "byDays"
  | "onBoard"
  | "onLeave"
  | "status";

interface FilterDescriptor {
  kind: FilterKind;
  label: string;
  defaultValue?: string | number;
}

const DEFAULT_FILTERS: FilterDescriptor[] = [
  { kind: "rank", label: "Filter by Rank" },
];

const REPORT_FILTERS: Record<string, FilterDescriptor[]> = {
  // Recruitment
  "rec-recruited": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "dateRange", label: "Joining Date Range" },
  ],
  "rec-waitlist": [
    { kind: "rank", label: "Filter by Rank" },
  ],
  "rec-rejected": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "dateRange", label: "Rejection Date Range" },
  ],
  "rec-applications-by-source": [
    { kind: "source", label: "Application Source" },
    { kind: "dateRange", label: "Date Range" },
  ],
  "rec-interview-pipeline": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "status", label: "Interview Stage" },
  ],
  "rec-offers-issued": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "dateRange", label: "Offer Date Range" },
  ],
  "rec-joining-status": [
    { kind: "rank", label: "Filter by Rank" },
  ],
  "rec-medical-pending": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "withinDays", label: "Within", defaultValue: 30 },
  ],
  "rec-document-pending": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "withinDays", label: "Within", defaultValue: 30 },
  ],

  // Vessel
  "vsl-crew-on-board": [
    { kind: "vessel", label: "Select Vessel" },
    { kind: "rank", label: "Filter by Rank" },
  ],
  "vsl-manning-status": [
    { kind: "vessel", label: "Select Vessel" },
  ],
  "vsl-vacancies": [
    { kind: "vessel", label: "Select Vessel" },
    { kind: "rank", label: "Filter by Rank" },
  ],
  "vsl-crew-changes": [
    { kind: "vessel", label: "Select Vessel" },
    { kind: "dateRange", label: "Date Range" },
  ],
  "vsl-owner-manning": [
    { kind: "status", label: "Select Owner" },
  ],
  "vsl-flag-manning": [
    { kind: "status", label: "Select Flag" },
  ],
  "vsl-visit-schedule": [
    { kind: "vessel", label: "Select Vessel" },
    { kind: "dateRange", label: "Date Range" },
  ],
  "vsl-signon-signoff": [
    { kind: "vessel", label: "Select Vessel" },
    { kind: "dateRange", label: "Date Range" },
  ],
  "vsl-compliance-summary": [
    { kind: "vessel", label: "Select Vessel" },
  ],

  // Crew Pool
  "cp-active": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "nationality", label: "Filter by Nationality" },
  ],
  "cp-on-leave": [
    { kind: "rank", label: "Filter by Rank" },
  ],
  "cp-available-to-join": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "withinDays", label: "Within", defaultValue: 30 },
  ],
  "cp-terminated": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "dateRange", label: "Termination Date Range" },
  ],
  "cp-not-for-rehire": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "nationality", label: "Filter by Nationality" },
  ],
  "cp-by-rank": [
    { kind: "rank", label: "Filter by Rank" },
  ],
  "cp-by-nationality": [
    { kind: "nationality", label: "Filter by Nationality" },
  ],
  "cp-contact-details": [
    { kind: "vessel", label: "Filter by Vessel" },
    { kind: "rank", label: "Filter by Rank" },
  ],
  "cp-contract-expiry": [
    { kind: "withinDays", label: "Within", defaultValue: 30 },
    { kind: "rank", label: "Filter by Rank" },
  ],

  // Rotation
  "rot-overdue-relief": [
    { kind: "byDays", label: "By", defaultValue: 30 },
    { kind: "rank", label: "Filter by Rank" },
  ],
  "rot-planned-reliefs": [
    { kind: "withinDays", label: "Within", defaultValue: 30 },
    { kind: "vessel", label: "Filter by Vessel" },
  ],

  // Promotion
  "promo-meeting-criteria": [
    { kind: "rank", label: "Filter by Rank" },
  ],
  "promo-approved-ytd": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "dateRange", label: "Date Range" },
  ],

  // Appraisals
  "appr-pending": [
    { kind: "vessel", label: "Filter by Vessel" },
    { kind: "rank", label: "Filter by Rank" },
  ],
  "appr-scores-summary": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "dateRange", label: "Date Range" },
  ],

  // Drug & Alcohol
  "da-tests-due": [
    { kind: "rank", label: "Filter by Rank" },
    { kind: "withinDays", label: "Within", defaultValue: 30 },
  ],
  "da-violations": [
    { kind: "vessel", label: "Filter by Vessel" },
    { kind: "testType", label: "Test Type" },
    { kind: "dateRange", label: "Test Date Range" },
  ],

  // Rest Hours
  "rh-violations": [
    { kind: "vessel", label: "Filter by Vessel" },
    { kind: "dateRange", label: "Date Range" },
  ],
  "rh-compliance-summary": [
    { kind: "vessel", label: "Filter by Vessel" },
    { kind: "dateRange", label: "Date Range" },
  ],

  // Training
  "trn-certs-expiring": [
    { kind: "withinDays", label: "Within", defaultValue: 30 },
    { kind: "rank", label: "Filter by Rank" },
    { kind: "onBoard", label: "On Board" },
  ],
};

// Static fallback option lists for filter kinds without a master data source.
// Rank / vessel / nationality lists are loaded from the live master data hooks
// (see ReportsContent) and supplied to FilterControl via the `options` prop.
const SOURCE_OPTIONS = ["Direct", "Agency", "Referral", "Job Portal", "Walk-in"];
// Same test types (values + labels) as the dashboard D&A Violations drilldown.
const TEST_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "annual", label: "Annual" },
  { value: "periodic", label: "Periodic" },
  { value: "monthly", label: "Monthly" },
  { value: "post-incident", label: "Post-Incident" },
  { value: "others", label: "Others" },
];
const STATUS_OPTIONS = ["All", "Pending", "In Progress", "Completed"];

interface DynamicOptions {
  ranks: string[];
  vessels: string[];
  nationalities: string[];
  ranksLoading: boolean;
  vesselsLoading: boolean;
  nationalitiesLoading: boolean;
}

function findReport(id: string): { leaf: ReportLeaf; category: ReportCategory } | null {
  for (const cat of REPORT_TREE) {
    const leaf = cat.children.find((l) => l.id === id);
    if (leaf) return { leaf, category: cat };
  }
  return null;
}

function getAllCategoryIds(): Set<string> {
  return new Set(REPORT_TREE.map((c) => c.id));
}

function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

interface FilterResult {
  visibleIds: Set<string>;
  forcedExpandedIds: Set<string>;
}

function computeFilter(query: string): FilterResult | null {
  const q = query.trim();
  if (!q) return null;
  const visible = new Set<string>();
  const expanded = new Set<string>();
  REPORT_TREE.forEach((cat) => {
    const catMatch = matchesSearch(cat.label, q);
    let anyLeafMatch = false;
    cat.children.forEach((leaf) => {
      if (matchesSearch(leaf.label, q)) {
        visible.add(leaf.id);
        anyLeafMatch = true;
      }
    });
    if (catMatch || anyLeafMatch) {
      visible.add(cat.id);
      expanded.add(cat.id);
      if (catMatch && !anyLeafMatch) {
        cat.children.forEach((leaf) => visible.add(leaf.id));
      }
    }
  });
  return { visibleIds: visible, forcedExpandedIds: expanded };
}

function ReportsSideBar(): JSX.Element {
  const viewport = useViewport();
  const layoutConfig = getLayoutConfig(viewport);
  const isCompact = layoutConfig.sidebarMode === "compact";
  const sidebarWidth = layoutConfig.sidebarWidth;

  return (
    <TooltipProvider>
      <aside
        className="fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50 flex flex-col transition-all duration-200"
        style={{ width: `${sidebarWidth}px` }}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className="w-full flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 bg-[#52baf3]"
              style={{ height: isCompact ? "56px" : "79px" }}
              data-testid="sidebar-reports"
            >
              <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica] flex flex-col items-center justify-center text-center">
                <div className={isCompact ? "" : "mb-1"}>
                  <FileBarChart size={20} className="text-white" />
                </div>
                {!isCompact && (
                  <div className="leading-tight break-words hyphens-auto max-w-full">
                    Reports
                  </div>
                )}
              </div>
            </div>
          </TooltipTrigger>
          {isCompact && (
            <TooltipContent side="right" className="bg-[#16569e] text-white border-none">
              Reports
            </TooltipContent>
          )}
        </Tooltip>
        <div className="w-full flex-1 bg-[#16569e]" />
      </aside>
    </TooltipProvider>
  );
}

// Captured filter values are normalised by FilterKind.
// Single-select filters store a string; dateRange stores {from,to};
// numeric "within/by days" stores a number.
export type FilterValue =
  | string
  | number
  | { from: string; to: string }
  | undefined;

interface FilterControlProps {
  filter: FilterDescriptor;
  reportId: string;
  index: number;
  options: DynamicOptions;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

function FilterControl({
  filter,
  reportId,
  index,
  options,
  value,
  onChange,
}: FilterControlProps): JSX.Element {
  const testIdBase = `filter-${reportId}-${index}`;

  const renderSelect = (
    placeholder: string,
    items: string[],
    loading: boolean = false,
    emptyLabel?: string,
  ) => {
    const isEmpty = !loading && items.length === 0;
    const computedPlaceholder = loading
      ? "Loading…"
      : isEmpty
        ? (emptyLabel ?? "No options available")
        : placeholder;
    const current = typeof value === "string" ? value : undefined;
    return (
      <Select
        value={current}
        onValueChange={(v) => onChange(v)}
        disabled={loading || isEmpty}
      >
        <SelectTrigger className="h-8 w-[180px]" data-testid={testIdBase}>
          <SelectValue placeholder={computedPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((opt) => (
            <SelectItem
              key={opt}
              value={opt}
              data-testid={`${testIdBase}-option-${opt}`}
            >
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  switch (filter.kind) {
    case "rank":
      return renderSelect(filter.label, options.ranks, options.ranksLoading, "No ranks");
    case "vessel":
      return renderSelect(filter.label, options.vessels, options.vesselsLoading, "No vessels");
    case "nationality":
      return renderSelect(filter.label, options.nationalities, options.nationalitiesLoading, "No nationalities");
    case "source":
      return renderSelect(filter.label, SOURCE_OPTIONS);
    case "status":
      return renderSelect(filter.label, STATUS_OPTIONS);
    case "testType": {
      const current = typeof value === "string" ? value : undefined;
      return (
        <Select value={current} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8 w-[180px]" data-testid={testIdBase}>
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            {TEST_TYPE_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                data-testid={`${testIdBase}-option-${opt.value}`}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case "dateRange": {
      const range =
        value && typeof value === "object" && "from" in value
          ? (value as { from: string; to: string })
          : { from: "", to: "" };
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 whitespace-nowrap">{filter.label}:</span>
          <Input
            type="date"
            value={range.from}
            onChange={(e) => onChange({ from: e.target.value, to: range.to })}
            className="h-8 w-[150px]"
            data-testid={`${testIdBase}-from`}
          />
          <span className="text-xs text-gray-500">to</span>
          <Input
            type="date"
            value={range.to}
            onChange={(e) => onChange({ from: range.from, to: e.target.value })}
            className="h-8 w-[150px]"
            data-testid={`${testIdBase}-to`}
          />
        </div>
      );
    }
    case "withinDays":
    case "byDays": {
      const num =
        typeof value === "number"
          ? value
          : Number(filter.defaultValue ?? 30);
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 whitespace-nowrap font-medium">
            {filter.label}
          </span>
          <Input
            type="number"
            value={Number.isFinite(num) ? num : 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-8 w-[80px] bg-yellow-50"
            data-testid={`${testIdBase}-days`}
          />
          <span className="text-xs text-gray-600">Days</span>
        </div>
      );
    }
    case "onBoard": {
      const current = typeof value === "string" ? value : undefined;
      return (
        <Select value={current} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="h-8 w-[140px]" data-testid={testIdBase}>
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="onboard">On Board</SelectItem>
            <SelectItem value="onleave">On Leave</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    case "onLeave":
      return renderSelect(filter.label, ["All", "On Leave", "On Board"]);
    default:
      return renderSelect(filter.label, ["Option 1", "Option 2"]);
  }
}

// Build the filters object that goes to /api/v2/reports/run.
// Maps positional FilterDescriptors to a kind-keyed payload that
// the server-side report handlers' Zod schemas understand.
function buildFiltersPayload(
  descriptors: FilterDescriptor[],
  values: Record<number, FilterValue>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  descriptors.forEach((d, idx) => {
    const v = values[idx];
    if (v === undefined || v === null || v === "") return;
    switch (d.kind) {
      case "dateRange": {
        const range = v as { from: string; to: string };
        if (range.from) out.dateFrom = range.from;
        if (range.to) out.dateTo = range.to;
        break;
      }
      case "withinDays":
        out.withinDays = v;
        break;
      case "byDays":
        out.byDays = v;
        break;
      case "rank":
      case "vessel":
      case "nationality":
      case "source":
      case "status":
      case "testType":
      case "onBoard":
      case "onLeave":
        out[d.kind] = v;
        break;
    }
  });
  return out;
}

function ReportsContent(): JSX.Element {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  // Filter values keyed by report id, then positional descriptor index.
  const [filterValuesByReport, setFilterValuesByReport] = useState<
    Record<string, Record<number, FilterValue>>
  >({});
  // Per-report results cache so switching back to a report keeps its last result.
  const [resultsByReport, setResultsByReport] = useState<
    Record<string, ReportRunResponse>
  >({});

  const filter = useMemo(() => computeFilter(searchQuery), [searchQuery]);

  const isExpanded = (id: string): boolean => {
    if (filter) return filter.forcedExpandedIds.has(id);
    return expandedIds.has(id);
  };

  const isVisible = (id: string): boolean => {
    if (!filter) return true;
    return filter.visibleIds.has(id);
  };

  const toggleExpand = (id: string) => {
    if (filter) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => setExpandedIds(getAllCategoryIds());
  const handleCollapseAll = () => setExpandedIds(new Set());

  // Live master data for filter dropdowns. These same hooks are used across
  // Recruitment / Crew Pool / Vessel / D&A modules.
  const { rankOptions, isLoading: ranksLoading } = useCompanyRanks();
  const { data: vesselsRaw, isLoading: vesselsLoading } = useVesselsV2();
  const { data: nationalitiesRaw, isLoading: nationalitiesLoading } = useNationalitiesV2();

  const dynamicOptions = useMemo<DynamicOptions>(() => {
    const ranks = Array.from(
      new Set(
        (rankOptions ?? [])
          .map((r) => r.label)
          .filter((s): s is string => !!s && s.trim().length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const vesselsArr =
      ((vesselsRaw as any)?.vessels as any[]) ||
      ((vesselsRaw as any[]) ?? []);
    const vessels = Array.from(
      new Set(
        vesselsArr
          .map((v: any) => (v?.vessel ?? v?.name ?? "") as string)
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const nationalitiesArr =
      ((nationalitiesRaw as any)?.nationalities as any[]) ||
      ((nationalitiesRaw as any[]) ?? []);
    const nationalities = Array.from(
      new Set(
        nationalitiesArr
          .map(
            (n: any) =>
              (n?.nationality ?? n?.name ?? n?.label ?? "") as string,
          )
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return {
      ranks,
      vessels,
      nationalities,
      ranksLoading,
      vesselsLoading,
      nationalitiesLoading,
    };
  }, [
    rankOptions,
    vesselsRaw,
    nationalitiesRaw,
    ranksLoading,
    vesselsLoading,
    nationalitiesLoading,
  ]);

  // Clear selection if the active search hides the currently selected report,
  // so the right pane never shows a report missing from the filtered tree.
  useEffect(() => {
    if (selectedReportId && filter && !filter.visibleIds.has(selectedReportId)) {
      setSelectedReportId(null);
    }
  }, [filter, selectedReportId]);

  const selected = selectedReportId ? findReport(selectedReportId) : null;
  const selectedFilters = selected
    ? REPORT_FILTERS[selected.leaf.id] ?? DEFAULT_FILTERS
    : [];

  const currentFilterValues = selectedReportId
    ? filterValuesByReport[selectedReportId] ?? {}
    : {};

  const setFilterValue = (idx: number, value: FilterValue) => {
    if (!selectedReportId) return;
    setFilterValuesByReport((prev) => ({
      ...prev,
      [selectedReportId]: {
        ...(prev[selectedReportId] ?? {}),
        [idx]: value,
      },
    }));
  };

  const runReportMutation = useMutation<
    ReportRunResponse,
    Error,
    {
      reportId: string;
      filters: Record<string, unknown>;
      page: number;
      pageSize: number;
      sort: { key: string; direction: "asc" | "desc" } | null;
    }
  >({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", "/api/v2/reports/run", payload);
      const first = (await res.json()) as ReportRunResponse;
      // Server caps pageSize at 500; fetch remaining pages so AG Grid has the
      // full dataset for client-side sorting/filtering/pagination and exports.
      const totalPages = Math.ceil(first.total / payload.pageSize);
      if (totalPages <= 1) return first;
      const rows = [...first.rows];
      for (let p = 2; p <= totalPages; p++) {
        const pageRes = await apiRequest("POST", "/api/v2/reports/run", {
          ...payload,
          page: p,
        });
        const pageData = (await pageRes.json()) as ReportRunResponse;
        rows.push(...pageData.rows);
      }
      return { ...first, rows };
    },
    onSuccess: (data) => {
      setResultsByReport((prev) => ({ ...prev, [data.reportId]: data }));
    },
    onError: (err) => {
      toast({
        title: "Failed to generate report",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const runReport = () => {
    if (!selected) return;
    const reportId = selected.leaf.id;
    const filters = buildFiltersPayload(selectedFilters, currentFilterValues);
    // Fetch the maximum allowed page in one request; AG Grid handles
    // sorting, filtering, and pagination client-side.
    runReportMutation.mutate({
      reportId,
      filters,
      page: 1,
      pageSize: 500,
      sort: null,
    });
  };

  const handleGenerate = () => {
    runReport();
  };

  const currentResult = selectedReportId
    ? resultsByReport[selectedReportId]
    : undefined;
  const isRunningCurrent =
    runReportMutation.isPending &&
    runReportMutation.variables?.reportId === selectedReportId;

  return (
    <div data-testid="page-reports">
      {/* Page title */}
      <div className="mb-4">
        <h1
          className="font-bold text-black text-2xl"
          data-testid="text-reports-title"
        >
          Reports Generator
        </h1>
      </div>

      {/* Search bar */}
      <div className="mb-3">
        <div className="relative max-w-full">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="pl-9 h-10 bg-white"
            data-testid="input-reports-search"
          />
        </div>
      </div>

      {/* Two-column area */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* LEFT: Tree panel */}
        <div
          className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden"
          data-testid="panel-reports-tree"
        >
          {/* Header strip */}
          <div className="bg-[#52baf3] text-white px-3 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
            <span>Reports</span>
            <div className="flex items-center gap-3 normal-case font-normal">
              <button
                type="button"
                className="flex items-center gap-1 hover:underline"
                data-testid="button-reports-edit"
              >
                <Pencil size={12} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={handleExpandAll}
                className="flex items-center gap-1 hover:underline"
                data-testid="button-reports-expand"
              >
                <Maximize2 size={12} />
                <span>Expand</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="flex items-center gap-1 hover:underline"
                data-testid="button-reports-collapse"
              >
                <Minimize2 size={12} />
                <span>Collapse</span>
              </button>
            </div>
          </div>

          {/* Tree body */}
          <div className="py-1 max-h-[70vh] overflow-y-auto">
            {REPORT_TREE.map((cat) => {
              if (!isVisible(cat.id)) return null;
              const expanded = isExpanded(cat.id);
              const Icon = cat.icon;
              return (
                <div key={cat.id}>
                  <div
                    onClick={() => toggleExpand(cat.id)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50/40 transition-colors"
                    data-testid={`tree-category-${cat.id}`}
                  >
                    {expanded ? (
                      <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-500 flex-shrink-0" />
                    )}
                    <Icon size={16} className="text-[#52baf3] flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-800 flex-1 truncate">
                      {cat.label}
                    </span>
                    <span
                      className="text-xs text-gray-500 ml-2"
                      data-testid={`tree-category-count-${cat.id}`}
                    >
                      {cat.children.length}
                    </span>
                  </div>

                  {expanded &&
                    cat.children.map((leaf) => {
                      if (!isVisible(leaf.id)) return null;
                      const isSelected = selectedReportId === leaf.id;
                      return (
                        <div
                          key={leaf.id}
                          onClick={() => setSelectedReportId(leaf.id)}
                          className={`flex items-center gap-2 pl-10 pr-3 py-2 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-[#eaf4fb] border-l-2 border-[#52baf3]"
                              : "hover:bg-blue-50/40"
                          }`}
                          data-testid={`tree-report-${leaf.id}`}
                        >
                          <FileBarChart
                            size={12}
                            className={`flex-shrink-0 ${
                              isSelected ? "text-[#16569e]" : "text-gray-400"
                            }`}
                          />
                          <span
                            className={`text-sm flex-1 truncate ${
                              isSelected
                                ? "text-[#16569e] font-medium"
                                : "text-gray-700"
                            }`}
                          >
                            {leaf.label}
                          </span>
                        </div>
                      );
                    })}
                </div>
              );
            })}
            {filter && filter.visibleIds.size === 0 && (
              <div
                className="px-4 py-8 text-center text-sm text-gray-500"
                data-testid="text-reports-no-results"
              >
                No reports match your search.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        <div
          className="bg-white border border-gray-200 rounded shadow-sm min-h-[60vh] p-4"
          data-testid="panel-reports-detail"
        >
          {!selected ? (
            <div
              className="flex flex-col items-center text-center justify-center min-h-[55vh]"
              data-testid="empty-reports"
            >
              <div className="w-14 h-14 rounded-full bg-[#eaf4fb] flex items-center justify-center mb-4">
                <BarChart3 size={28} className="text-[#52baf3]" />
              </div>
              <div className="text-base font-semibold text-gray-800">
                Select a Report
              </div>
              <div className="text-sm text-gray-500 mt-1 max-w-xs">
                Select a report from the tree on the left to view its filters.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3" data-testid="detail-reports-selected">
              {/* Heading */}
              <div className="flex items-baseline gap-2">
                <div
                  className="text-lg font-bold text-gray-800"
                  data-testid="text-reports-selected-label"
                >
                  {selected.leaf.label}
                </div>
                <div className="text-xs uppercase tracking-wide text-[#52baf3] font-semibold">
                  {selected.category.label}
                </div>
              </div>

              {/* Filter row */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded">
                {selectedFilters.map((f, idx) => (
                  <FilterControl
                    key={`${selected.leaf.id}-${idx}`}
                    filter={f}
                    reportId={selected.leaf.id}
                    index={idx}
                    options={dynamicOptions}
                    value={currentFilterValues[idx]}
                    onChange={(v) => setFilterValue(idx, v)}
                  />
                ))}
                <div className="ml-auto">
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isRunningCurrent}
                    className="h-8 bg-[#52baf3] hover:bg-[#16569e] text-white"
                    data-testid="button-reports-generate"
                  >
                    {isRunningCurrent ? "Generating…" : "Generate"}
                  </Button>
                </div>
              </div>

              {/* Results area */}
              {currentResult ? (
                <ReportResultsTable
                  title={currentResult.title}
                  columns={currentResult.columns}
                  rows={currentResult.rows}
                  total={currentResult.total}
                  isLoading={isRunningCurrent && !currentResult}
                  isFetching={isRunningCurrent}
                  exportFilename={currentResult.title}
                />
              ) : isRunningCurrent ? (
                <ReportResultsTable
                  title={selected.leaf.label}
                  columns={[]}
                  rows={[]}
                  total={0}
                  isLoading
                />
              ) : (
                <div
                  className="text-sm text-gray-500 text-center py-12 border border-dashed border-gray-200 rounded"
                  data-testid="text-reports-results-placeholder"
                >
                  Set the filters above and click Generate to view the report.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage(): JSX.Element {
  return (
    <div data-testid="reports-container">
      <ReportsSideBar />
      <MainLayout hasSidebar={true}>
        <ReportsContent />
      </MainLayout>
    </div>
  );
}
