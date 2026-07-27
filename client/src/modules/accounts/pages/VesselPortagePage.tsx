/**
 * Vessel Portage — category-major monthly entry workspace.
 *
 * Restructured from crew-major + entry dialog to one tab per transaction
 * type (matching the paper portage workbook): choosing the tab fixes the
 * pay element, the row fixes the crew member, so an entry is just a number
 * typed into a cell. Explicit Save per tab batches the whole grid into ONE
 * request; auto-save runs on tab/period change and every 10 minutes while
 * dirty; browser close shows the native unsaved-changes warning.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Lock,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  accountsApiV2,
  parseApiError,
  ACCOUNTS_BASE,
} from "../api/accountsApiV2";
import { formatDate, formatMoney } from "../accountsFormat";
import VesselPeriodBar, { formatPeriod } from "./VesselPeriodBar";
import { useVesselPeriod } from "../vesselPeriodStore";
import EntryGrid, {
  type EntryColumn,
  type EntryRow,
} from "./VesselPortageGrids";

const MENU = "Account Vessel Portage";

const VESSEL_EDITABLE_STATUSES = ["open", "vessel_draft", "returned"];
const RETURNABLE_STATUSES = ["submitted", "office_review"];

const STATUS_STYLES: Record<string, string> = {
  open: "bg-slate-100 text-slate-700",
  vessel_draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-800",
  returned: "bg-amber-100 text-amber-800",
  office_review: "bg-violet-100 text-violet-800",
  approved: "bg-green-100 text-green-800",
  locked: "bg-gray-200 text-gray-700",
};

function StatusBadge({
  status,
  testId,
}: {
  status: string | null | undefined;
  testId?: string;
}) {
  const s = status ?? "open";
  return (
    <Badge
      variant="outline"
      className={`text-xs ${STATUS_STYLES[s] ?? ""}`}
      data-testid={testId}
    >
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

const ENTRY_CHIP_STYLES: Record<string, string> = {
  draft: "border-slate-300 bg-slate-50 text-slate-700",
  submitted: "border-blue-300 bg-blue-50 text-blue-800",
  accepted: "border-green-300 bg-green-50 text-green-800",
  rejected: "border-red-300 bg-red-50 text-red-800",
};

const CTM_LINE_TYPES = [
  { value: "cash_advance_to_crew", label: "Cash advance to crew" },
  { value: "receipt", label: "Receipt" },
  { value: "expense", label: "Expense" },
  { value: "adjustment", label: "Adjustment" },
];

// ---------------------------------------------------------------------------
// Entry-tab model
// ---------------------------------------------------------------------------

type TabKind = "overtime" | "dated" | "allotment" | "amountRemarks";

interface EntryTabDef {
  id: string;
  label: string;
  kind: TabKind;
  element: any; // bound pay element (fixed per tab)
  testId: string;
}

interface CtmLineForm {
  lineDate: string;
  lineType: string;
  crewUuid: string;
  amount: string;
  description: string;
}

const emptyLineForm: CtmLineForm = {
  lineDate: "",
  lineType: "expense",
  crewUuid: "",
  amount: "",
  description: "",
};

/** Pick the bound pay element for a built-in tab. */
function pickElement(
  payElements: any[],
  category: string,
  preferredCode?: string,
): any | null {
  const candidates = payElements.filter(
    (e) =>
      e.status === "active" &&
      e.category === category &&
      e.calcMethod !== "scale_lookup",
  );
  if (preferredCode) {
    const hit = candidates.find((c) => c.code === preferredCode);
    if (hit) return hit;
  }
  return candidates[0] ?? null;
}

const UNDATED = "undated";

export default function VesselPortagePage() {
  const { toast } = useToast();
  const { canCreate, canEdit, canDelete, userType, getVesselIds } =
    usePermissions();
  const mayCreate = canCreate(MENU);
  const mayEdit = canEdit(MENU);
  const mayDelete = canDelete(MENU);

  const isVessel = userType === "Ship";
  const fixedVesselUuid = isVessel ? (getVesselIds()[0] ?? "") : "";

  const { vesselUuid, setVesselUuid, period, setPeriod } = useVesselPeriod();
  useEffect(() => {
    if (isVessel && fixedVesselUuid) setVesselUuid(fixedVesselUuid);
  }, [isVessel, fixedVesselUuid]);
  const hasFilter = !!vesselUuid && !!period;

  // ---- queries -----------------------------------------------------------
  const statusKey = [
    `${ACCOUNTS_BASE}/vessel-portage/${vesselUuid}/${period}/status`,
  ];
  const { data: pkg, isLoading: pkgLoading } = useQuery<any>({
    queryKey: statusKey,
    enabled: hasFilter,
  });
  const ctmKey = [`${ACCOUNTS_BASE}/ctm/${vesselUuid}/${period}`];
  const { data: ctmDetail } = useQuery<any>({
    queryKey: ctmKey,
    enabled: hasFilter,
  });
  const txnsKey = [
    `${ACCOUNTS_BASE}/monthly-transactions?vesselUuid=${vesselUuid}&period=${period}`,
  ];
  const { data: txns = [] } = useQuery<any[]>({
    queryKey: txnsKey,
    enabled: hasFilter,
  });
  const { data: reviewRows = [] } = useQuery<any[]>({
    queryKey: [
      `${ACCOUNTS_BASE}/engagements/review?vesselUuid=${vesselUuid}&period=${period}`,
    ],
    enabled: hasFilter,
  });
  const workspaceKey = [
    `${ACCOUNTS_BASE}/portage?vesselUuid=${vesselUuid}&period=${period}`,
  ];
  const { data: workspace } = useQuery<any>({
    queryKey: workspaceKey,
    enabled: hasFilter,
  });
  const { data: payElements = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/pay-elements`],
  });
  const { data: tenantConfig } = useQuery<any>({
    queryKey: [`${ACCOUNTS_BASE}/config`],
  });
  const { data: allotments = [] } = useQuery<any[]>({
    queryKey: [`${ACCOUNTS_BASE}/allotments?status=active`],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: statusKey });
    queryClient.invalidateQueries({ queryKey: ctmKey });
    queryClient.invalidateQueries({ queryKey: txnsKey });
    queryClient.invalidateQueries({ queryKey: workspaceKey });
  };

  // ---- derived -----------------------------------------------------------
  const portage = pkg?.portage ?? null;
  const portageStatus: string = portage?.status ?? "open";
  const isLocked = portageStatus === "locked" || !!portage?.isLocked;
  const counts: Record<string, number> = pkg?.counts ?? {};

  const packageEditable =
    hasFilter && !isLocked && VESSEL_EDITABLE_STATUSES.includes(portageStatus);
  const canSubmit = packageEditable && mayEdit;
  const canReturn =
    !isVessel &&
    mayEdit &&
    !isLocked &&
    !!portage &&
    RETURNABLE_STATUSES.includes(portageStatus);
  const gridEditable = packageEditable && (mayEdit || mayCreate);

  const engagedRows = useMemo(
    () => reviewRows.filter((r) => r.engagement),
    [reviewRows],
  );
  const crewByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of reviewRows) m.set(r.crewUuid, r);
    return m;
  }, [reviewRows]);
  const elementByUuid = useMemo(() => {
    const m = new Map<string, any>();
    for (const e of payElements) m.set(e.payElementUuid, e);
    return m;
  }, [payElements]);
  const netByEngagement = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of workspace?.crewTotals ?? []) {
      m.set(t.engagementUuid, t.netOnBoard);
    }
    return m;
  }, [workspace]);

  const vesselTxns = useMemo(
    () => txns.filter((t) => t.origin === "vessel" && !t.isDeleted),
    [txns],
  );
  const txnsByCrew = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const t of vesselTxns) {
      const list = m.get(t.crewUuid);
      if (list) list.push(t);
      else m.set(t.crewUuid, [t]);
    }
    return m;
  }, [vesselTxns]);
  const txnByCtmLine = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of txns) if (t.ctmLineUuid) m.set(t.ctmLineUuid, t);
    return m;
  }, [txns]);
  /** office bond rollup per crew (sourceType='bond') */
  const bondRollupByCrew = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of txns) {
      if (t.sourceType === "bond") m.set(t.crewUuid, t.amount);
    }
    return m;
  }, [txns]);

  const ctm = ctmDetail?.ctm ?? null;
  const ctmLines: any[] = ctmDetail?.lines ?? [];
  const openingCarried = !!ctmDetail?.openingCarried;
  const imbalance = !!ctmDetail?.imbalance;

  // ---- wage-scale lookups for the Overtime tab ---------------------------
  const scaleUuids = useMemo(() => {
    const s = new Set<string>();
    for (const r of engagedRows) {
      if (r.engagement?.wageScaleUuid) s.add(r.engagement.wageScaleUuid);
    }
    return Array.from(s).sort();
  }, [engagedRows]);
  const { data: scaleDetails = {} } = useQuery<Record<string, any>>({
    queryKey: [`vessel-portage-scales`, scaleUuids.join(",")],
    enabled: scaleUuids.length > 0,
    queryFn: async () => {
      const out: Record<string, any> = {};
      await Promise.all(
        scaleUuids.map(async (uuid) => {
          const res = await apiRequest(
            "GET",
            `${ACCOUNTS_BASE}/wage-scales/${uuid}`,
          );
          out[uuid] = await res.json();
        }),
      );
      return out;
    },
  });

  // ---- entry tab definitions ---------------------------------------------
  const otElement = useMemo(
    () => pickElement(payElements, "overtime_variable", "OT"),
    [payElements],
  );
  const gotElement = useMemo(
    () =>
      payElements.find(
        (e) => e.status === "active" && e.category === "overtime_fixed",
      ) ?? null,
    [payElements],
  );
  const advanceElement = useMemo(
    () => pickElement(payElements, "advance_recovery", "ADVANCE"),
    [payElements],
  );
  const allotElement = useMemo(
    () => pickElement(payElements, "allotment", "ALLOT"),
    [payElements],
  );
  const bondElement = useMemo(
    () => pickElement(payElements, "bond_slop_chest", "BOND"),
    [payElements],
  );
  const otherElement = useMemo(
    () =>
      pickElement(payElements, "one_off") ?? pickElement(payElements, "other"),
    [payElements],
  );

  const entryTabs = useMemo<EntryTabDef[]>(() => {
    const tabs: EntryTabDef[] = [];
    if (otElement) {
      tabs.push({
        id: "overtime",
        label: "Overtime",
        kind: "overtime",
        element: otElement,
        testId: "tab-overtime",
      });
    }
    if (advanceElement) {
      tabs.push({
        id: "advances",
        label: "Cash advances",
        kind: "dated",
        element: advanceElement,
        testId: "tab-advances",
      });
    }
    if (allotElement) {
      tabs.push({
        id: "allotments",
        label: "Allotments",
        kind: "allotment",
        element: allotElement,
        testId: "tab-allotments",
      });
    }
    if (bondElement) {
      tabs.push({
        id: "bond",
        label: "Bond / slop chest",
        kind: "dated",
        element: bondElement,
        testId: "tab-bond",
      });
    }
    if (otherElement) {
      tabs.push({
        id: "other",
        label: "Other deductions",
        kind: "amountRemarks",
        element: otherElement,
        testId: "tab-other",
      });
    }
    for (const n of [1, 2] as const) {
      if (
        tenantConfig?.[`extraTab${n}Enabled`] &&
        tenantConfig?.[`extraTab${n}Label`] &&
        tenantConfig?.[`extraTab${n}PayElementUuid`]
      ) {
        const el = elementByUuid.get(tenantConfig[`extraTab${n}PayElementUuid`]);
        if (el) {
          tabs.push({
            id: `extra${n}`,
            label: tenantConfig[`extraTab${n}Label`],
            kind: "amountRemarks",
            element: el,
            testId: `tab-extra-${n}`,
          });
        }
      }
    }
    return tabs;
  }, [
    otElement,
    advanceElement,
    allotElement,
    bondElement,
    otherElement,
    tenantConfig,
    elementByUuid,
  ]);
  const tabById = useMemo(() => {
    const m = new Map<string, EntryTabDef>();
    for (const t of entryTabs) m.set(t.id, t);
    return m;
  }, [entryTabs]);

  // ---- unsaved-edit state --------------------------------------------------
  // edits["tabId::crewUuid::colId"] = typed value ("" = clear the entry)
  const [edits, setEdits] = useState<Record<string, string>>({});
  // user-added date columns per dated tab (YYYY-MM-DD)
  const [addedDates, setAddedDates] = useState<Record<string, string[]>>({});
  const [activeTab, setActiveTab] = useState("crew");
  const [saving, setSaving] = useState(false);

  // Reset unsaved state when the vessel-month context changes.
  useEffect(() => {
    setEdits({});
    setAddedDates({});
  }, [vesselUuid, period]);

  /** Per-tab saved transactions bound to the tab's element. */
  const tabTxns = useCallback(
    (tab: EntryTabDef) =>
      vesselTxns.filter(
        (t) =>
          t.payElementUuid === tab.element.payElementUuid &&
          t.sourceType !== "bond",
      ),
    [vesselTxns],
  );

  /** Saved cell value + txn for (tab, crew, col). */
  const savedCell = useCallback(
    (tab: EntryTabDef, crewUuid: string, colId: string) => {
      const list = tabTxns(tab).filter((t) => t.crewUuid === crewUuid);
      let txn: any | undefined;
      if (tab.kind === "dated") {
        txn = list.find((t) => (t.txnDate ?? UNDATED) === colId);
      } else {
        // single entry cell: bind the most recent transaction
        txn = list.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
      }
      if (!txn) return { txn: undefined, value: "" };
      const value =
        tab.kind === "overtime" ? (txn.qty ?? "") : (txn.amount ?? "");
      return { txn, value: value == null ? "" : String(value) };
    },
    [tabTxns],
  );

  /** Saved comparison value for a column — remarks columns compare remarks. */
  const savedValueFor = useCallback(
    (tab: EntryTabDef, crewUuid: string, colId: string): string => {
      if (tab.kind === "amountRemarks" && colId === "remarks") {
        return savedCell(tab, crewUuid, "amount").txn?.remarks ?? "";
      }
      return savedCell(tab, crewUuid, colId).value;
    },
    [savedCell],
  );

  /** Effective (edited or saved) value for a cell. */
  const cellValue = useCallback(
    (tab: EntryTabDef, crewUuid: string, colId: string) => {
      const k = `${tab.id}::${crewUuid}::${colId}`;
      if (k in edits) return edits[k];
      return savedCell(tab, crewUuid, colId).value;
    },
    [edits, savedCell],
  );

  /** Count of unsaved (differing) edits per tab. */
  const dirtyCount = useCallback(
    (tabId: string) => {
      const tab = tabById.get(tabId);
      if (!tab) return 0;
      let n = 0;
      for (const [k, v] of Object.entries(edits)) {
        const [tid, crewUuid, colId] = k.split("::");
        if (tid !== tabId) continue;
        if (savedValueFor(tab, crewUuid, colId) !== v) n++;
      }
      return n;
    },
    [edits, savedValueFor, tabById],
  );
  const totalDirty = useMemo(
    () => entryTabs.reduce((s, t) => s + dirtyCount(t.id), 0),
    [entryTabs, dirtyCount],
  );

  // ---- scale helpers (Overtime tab) ---------------------------------------
  const otScaleInfo = useCallback(
    (r: any): { rate: number | null; guaranteedHrs: number | null } => {
      const scale = scaleDetails[r.engagement?.wageScaleUuid ?? ""];
      const rankId = r.engagement?.rankIdAtStart;
      if (!scale || !rankId || !otElement) {
        return { rate: null, guaranteedHrs: null };
      }
      const lines: any[] = scale.lines ?? [];
      const rateLine = lines.find(
        (l) =>
          l.payElementUuid === otElement.payElementUuid &&
          l.rankId === rankId &&
          !l.isDeleted &&
          l.rate != null,
      );
      const rate = rateLine ? parseFloat(rateLine.rate) : null;
      let guaranteedHrs: number | null = null;
      if (gotElement && rate) {
        const gotLine = lines.find(
          (l) =>
            l.payElementUuid === gotElement.payElementUuid &&
            l.rankId === rankId &&
            !l.isDeleted &&
            l.amount != null,
        );
        if (gotLine) {
          // Fixed OT monthly amount ÷ OT hourly rate = implied guaranteed hours.
          guaranteedHrs = Math.round((parseFloat(gotLine.amount) / rate) * 10) / 10;
        }
      }
      return { rate: Number.isNaN(rate as number) ? null : rate, guaranteedHrs };
    },
    [scaleDetails, otElement, gotElement],
  );

  /** Standing (office register) allotment display for a crew member. */
  const standingAllotment = useCallback(
    (crewUuid: string): { display: string; fixedTotal: number | null } => {
      const active = allotments.filter(
        (a) => a.crewUuid === crewUuid && a.status === "active" && !a.isDeleted,
      );
      if (active.length === 0) return { display: "—", fixedTotal: null };
      let fixed = 0;
      let hasFixed = false;
      const pct: string[] = [];
      for (const a of active) {
        if (a.allotmentType === "percentage") pct.push(`${a.value}%`);
        else {
          fixed += parseFloat(a.value ?? "0") || 0;
          hasFixed = true;
        }
      }
      const parts: string[] = [];
      if (hasFixed) parts.push(fixed.toFixed(2));
      if (pct.length) parts.push(pct.join(" + "));
      return {
        display: parts.join(" + ") || "—",
        fixedTotal: hasFixed ? fixed : null,
      };
    },
    [allotments],
  );

  // ---- date columns for dated tabs -----------------------------------------
  const datedColumns = useCallback(
    (tab: EntryTabDef): string[] => {
      const dates = new Set<string>(addedDates[tab.id] ?? []);
      let hasUndated = false;
      for (const t of tabTxns(tab)) {
        if (t.txnDate) dates.add(t.txnDate);
        else hasUndated = true;
      }
      const sorted = Array.from(dates).sort();
      return hasUndated ? [UNDATED, ...sorted] : sorted;
    },
    [addedDates, tabTxns],
  );

  // ---- grid rows/columns per tab -------------------------------------------
  const buildColumns = useCallback(
    (tab: EntryTabDef): EntryColumn[] => {
      switch (tab.kind) {
        case "overtime":
          return [
            { id: "guaranteedHrs", header: "Guaranteed hrs", editable: false, isInfo: true },
            { id: "excessHrs", header: "Excess hrs", editable: true },
            { id: "rateHr", header: "Rate/hr", editable: false, isInfo: true },
            { id: "amount", header: "Amount", editable: false, isInfo: true },
          ];
        case "dated": {
          const cols: EntryColumn[] = datedColumns(tab).map((d) => ({
            id: d,
            header: d === UNDATED ? "Undated" : formatDate(d),
            editable: true,
          }));
          if (tab.id === "bond") {
            cols.push({
              id: "officeRollup",
              header: "Office rollup",
              editable: false,
              isInfo: true,
            });
          }
          cols.push({ id: "total", header: "Total", editable: false, isInfo: true });
          return cols;
        }
        case "allotment":
          return [
            { id: "standing", header: "Standing", editable: false, isInfo: true },
            { id: "extra", header: "This month extra", editable: true },
            { id: "total", header: "Total", editable: false, isInfo: true },
          ];
        case "amountRemarks":
          return [
            { id: "amount", header: "Amount", editable: true },
            { id: "remarks", header: "Remarks", editable: true, isText: true, width: 240 },
          ];
      }
    },
    [datedColumns],
  );

  const buildRows = useCallback(
    (tab: EntryTabDef): EntryRow[] => {
      return engagedRows.map((r) => {
        const row: EntryRow = {
          crewUuid: r.crewUuid,
          crewName: r.crewName,
          rank: r.presentRank ?? "—",
          engagementUuid: r.engagement.engagementUuid,
          cells: {},
          info: {},
        };
        const mkCell = (colId: string) => {
          const saved = savedCell(tab, r.crewUuid, colId);
          const k = `${tab.id}::${r.crewUuid}::${colId}`;
          const value = k in edits ? edits[k] : saved.value;
          row.cells[colId] = {
            txn: saved.txn,
            value,
            dirty: k in edits && edits[k] !== saved.value,
          };
          return value;
        };
        switch (tab.kind) {
          case "overtime": {
            const { rate, guaranteedHrs } = otScaleInfo(r);
            const excess = parseFloat(mkCell("excessHrs"));
            if (rate == null) {
              // No OT rate resolvable from the wage scale — block entry
              // rather than persisting a zero-amount transaction.
              row.cells.excessHrs = { ...row.cells.excessHrs, locked: true };
            }
            row.info.guaranteedHrs =
              guaranteedHrs != null ? String(guaranteedHrs) : "—";
            row.info.rateHr = rate != null ? rate.toFixed(2) : "—";
            row.info.amount =
              !Number.isNaN(excess) && rate != null
                ? (excess * rate).toFixed(2)
                : "";
            break;
          }
          case "dated": {
            let total = 0;
            for (const d of datedColumns(tab)) {
              const v = parseFloat(mkCell(d));
              if (!Number.isNaN(v)) total += v;
            }
            if (tab.id === "bond") {
              const rollup = bondRollupByCrew.get(r.crewUuid);
              row.info.officeRollup = rollup != null ? formatMoney(rollup) : "—";
            }
            row.info.total = total ? total.toFixed(2) : "";
            break;
          }
          case "allotment": {
            const standing = standingAllotment(r.crewUuid);
            const extra = parseFloat(mkCell("extra"));
            row.info.standing = standing.display;
            const total =
              (standing.fixedTotal ?? 0) + (Number.isNaN(extra) ? 0 : extra);
            row.info.total =
              standing.fixedTotal != null || !Number.isNaN(extra)
                ? total.toFixed(2)
                : "";
            break;
          }
          case "amountRemarks": {
            mkCell("amount");
            const saved = savedCell(tab, r.crewUuid, "amount");
            const rk = `${tab.id}::${r.crewUuid}::remarks`;
            row.cells.remarks = {
              txn: saved.txn,
              value: rk in edits ? edits[rk] : (saved.txn?.remarks ?? ""),
              dirty:
                rk in edits && edits[rk] !== (saved.txn?.remarks ?? ""),
            };
            break;
          }
        }
        return row;
      });
    },
    [
      engagedRows,
      savedCell,
      edits,
      otScaleInfo,
      datedColumns,
      bondRollupByCrew,
      standingAllotment,
    ],
  );

  const onCellEdited = useCallback(
    (tabId: string) => (crewUuid: string, colId: string, value: string) => {
      setEdits((e) => ({ ...e, [`${tabId}::${crewUuid}::${colId}`]: value }));
    },
    [],
  );

  // ---- rejected-cell comment dialog ---------------------------------------
  const [rejectedTxn, setRejectedTxn] = useState<any | null>(null);

  // ---- batch save -----------------------------------------------------------
  /** Build the ONE batch request for a tab from its unsaved edits. */
  const buildBatch = useCallback(
    (tab: EntryTabDef) => {
      const creates: Record<string, unknown>[] = [];
      const updates: Record<string, unknown>[] = [];
      const deletes: string[] = [];
      // Collect remarks edits first so an amount create/update in the same
      // batch picks up the remark typed alongside it.
      const remarksEdits = new Map<string, string>(); // crewUuid -> remarks
      if (tab.kind === "amountRemarks") {
        for (const [k, v] of Object.entries(edits)) {
          const [tid, crewUuid, colId] = k.split("::");
          if (tid === tab.id && colId === "remarks") remarksEdits.set(crewUuid, v);
        }
      }
      for (const [k, v] of Object.entries(edits)) {
        const [tid, crewUuid, colId] = k.split("::");
        if (tid !== tab.id) continue;
        if (colId === "remarks") continue;
        const saved = savedCell(tab, crewUuid, colId);
        if (v === saved.value) continue;
        const review = crewByUuid.get(crewUuid);
        if (!review?.engagement) continue;
        if (v === "") {
          if (saved.txn && saved.txn.status === "draft") {
            deletes.push(saved.txn.txnUuid);
          }
          continue;
        }
        const num = parseFloat(v);
        if (Number.isNaN(num)) continue;
        let fields: Record<string, unknown>;
        if (tab.kind === "overtime") {
          const { rate } = otScaleInfo(review);
          if (rate == null) continue; // no scale rate — cell is locked in UI
          fields = {
            qty: v,
            rate: String(rate),
            amount: (num * rate).toFixed(2),
          };
        } else {
          fields = { amount: num.toFixed(2) };
          if (tab.kind === "dated" && colId !== UNDATED) {
            fields.txnDate = colId;
          }
        }
        if (tab.kind === "amountRemarks") {
          fields.remarks =
            remarksEdits.get(crewUuid) ?? saved.txn?.remarks ?? null;
        }
        if (saved.txn) {
          updates.push({ txnUuid: saved.txn.txnUuid, ...fields });
        } else {
          creates.push({
            engagementUuid: review.engagement.engagementUuid,
            crewUuid,
            vesselUuid,
            period,
            payElementUuid: tab.element.payElementUuid,
            currency: tab.element.currency ?? "USD",
            origin: "vessel",
            status: "draft",
            sourceType: "manual",
            ...fields,
          });
        }
      }
      // remarks-only edits on existing rows
      if (tab.kind === "amountRemarks") {
        for (const [crewUuid, remarks] of remarksEdits) {
          const saved = savedCell(tab, crewUuid, "amount");
          if (remarks === (saved.txn?.remarks ?? "")) continue; // unchanged
          const amountKey = `${tab.id}::${crewUuid}::amount`;
          if (amountKey in edits && edits[amountKey] !== saved.value) continue; // handled above
          if (saved.txn && saved.txn.status === "draft") {
            updates.push({
              txnUuid: saved.txn.txnUuid,
              remarks: remarks.trim() || null,
            });
          }
        }
      }
      return { creates, updates, deletes };
    },
    [edits, savedCell, crewByUuid, otScaleInfo, vesselUuid, period],
  );

  /** Save one tab as a single batch request. Failed save keeps typed values. */
  const saveTab = useCallback(
    async (tabId: string, opts?: { silent?: boolean }): Promise<boolean> => {
      const tab = tabById.get(tabId);
      if (!tab || dirtyCount(tabId) === 0) return true;
      const batch = buildBatch(tab);
      if (
        batch.creates.length === 0 &&
        batch.updates.length === 0 &&
        batch.deletes.length === 0
      ) {
        // edits that net out to no-ops — just clear them
        setEdits((e) => {
          const next = { ...e };
          for (const k of Object.keys(next)) {
            if (k.startsWith(`${tabId}::`)) delete next[k];
          }
          return next;
        });
        return true;
      }
      setSaving(true);
      try {
        await accountsApiV2.monthlyTransactions.batchSave(batch);
        setEdits((e) => {
          const next = { ...e };
          for (const k of Object.keys(next)) {
            if (k.startsWith(`${tabId}::`)) delete next[k];
          }
          return next;
        });
        invalidateAll();
        if (!opts?.silent) {
          toast({ title: `${tab.label} saved` });
        }
        return true;
      } catch (err) {
        toast({
          title: `Save failed — ${tab.label}`,
          description: `${parseApiError(err).message}. Your entries are kept on screen; fix the issue and save again.`,
          variant: "destructive",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tabById, dirtyCount, buildBatch, toast],
  );

  const saveAllDirty = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      let allOk = true;
      for (const t of entryTabs) {
        if (dirtyCount(t.id) > 0) {
          const ok = await saveTab(t.id, opts);
          if (!ok) allOk = false;
        }
      }
      return allOk;
    },
    [entryTabs, dirtyCount, saveTab],
  );

  // Auto-save on tab switch (in-app navigation within the workspace).
  const handleTabChange = (next: string) => {
    if (activeTab !== next && dirtyCount(activeTab) > 0) {
      void saveTab(activeTab).then((ok) => {
        if (ok) toast({ title: "Changes auto-saved" });
      });
    }
    setActiveTab(next);
  };

  // Auto-save on period/vessel change. The save is awaited and the switch is
  // blocked on failure — the edits map is cleared when the context changes,
  // so switching before a successful save would silently drop entries.
  const handlePeriodChange = async (p: string) => {
    if (totalDirty > 0) {
      const ok = await saveAllDirty({ silent: true });
      if (!ok) {
        toast({
          title: "Period not changed",
          description:
            "Unsaved entries could not be saved. Fix the issue (or clear the cells) before changing the period.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Changes auto-saved" });
    }
    setPeriod(p);
    setSubmitWarnings(null);
  };
  const handleVesselChange = async (v: string) => {
    if (totalDirty > 0) {
      const ok = await saveAllDirty({ silent: true });
      if (!ok) {
        toast({
          title: "Vessel not changed",
          description:
            "Unsaved entries could not be saved. Fix the issue (or clear the cells) before switching vessel.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Changes auto-saved" });
    }
    setVesselUuid(v);
  };

  // Auto-save on in-app navigation away (component unmount).
  const latestSaveAll = useRef(saveAllDirty);
  const latestTotalDirty = useRef(totalDirty);
  useEffect(() => {
    latestSaveAll.current = saveAllDirty;
    latestTotalDirty.current = totalDirty;
  });
  useEffect(
    () => () => {
      if (latestTotalDirty.current > 0) {
        void latestSaveAll.current({ silent: true });
      }
    },
    [],
  );

  // Native browser close/refresh warning while dirty (no save attempt).
  useEffect(() => {
    if (totalDirty === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [totalDirty > 0]);

  // Timed save every 10 minutes while dirty (crash/power-loss net).
  useEffect(() => {
    if (totalDirty === 0) return;
    const id = setInterval(() => {
      void latestSaveAll.current({ silent: true });
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [totalDirty > 0]);

  // ---- date-column management (dated tabs) ---------------------------------
  const [addDateFor, setAddDateFor] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [deleteDateFor, setDeleteDateFor] = useState<{
    tabId: string;
    date: string;
  } | null>(null);

  const confirmAddDate = () => {
    if (!addDateFor || !newDate) return;
    setAddedDates((d) => ({
      ...d,
      [addDateFor]: Array.from(new Set([...(d[addDateFor] ?? []), newDate])),
    }));
    setAddDateFor(null);
    setNewDate("");
  };

  const confirmDeleteDate = async () => {
    if (!deleteDateFor) return;
    const tab = tabById.get(deleteDateFor.tabId);
    if (!tab) return;
    const victims = tabTxns(tab).filter(
      (t) => t.txnDate === deleteDateFor.date && t.status === "draft",
    );
    setSaving(true);
    try {
      if (victims.length > 0) {
        await accountsApiV2.monthlyTransactions.batchSave({
          deletes: victims.map((t) => t.txnUuid),
        });
      }
      setAddedDates((d) => ({
        ...d,
        [deleteDateFor.tabId]: (d[deleteDateFor.tabId] ?? []).filter(
          (x) => x !== deleteDateFor.date,
        ),
      }));
      setEdits((e) => {
        const next = { ...e };
        for (const k of Object.keys(next)) {
          const [tid, , colId] = k.split("::");
          if (tid === deleteDateFor.tabId && colId === deleteDateFor.date) {
            delete next[k];
          }
        }
        return next;
      });
      invalidateAll();
      toast({ title: "Date column removed" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
      setDeleteDateFor(null);
    }
  };

  // ---- CTM header + line dialogs (unchanged behaviour) ---------------------
  const [headerForm, setHeaderForm] = useState({ opening: "", received: "" });
  const [headerSaving, setHeaderSaving] = useState(false);
  useEffect(() => {
    setHeaderForm({
      opening: ctm?.openingBalance ?? "",
      received: ctm?.receivedAmount ?? "",
    });
  }, [ctm?.openingBalance, ctm?.receivedAmount]);

  const saveHeader = async () => {
    setHeaderSaving(true);
    try {
      const body: Record<string, unknown> = {
        receivedAmount: headerForm.received || "0",
      };
      if (!openingCarried) body.openingBalance = headerForm.opening || "0";
      await accountsApiV2.ctm.updateHeader(vesselUuid, period, body);
      invalidateAll();
      toast({ title: "CTM header updated" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setHeaderSaving(false);
    }
  };

  const [lineOpen, setLineOpen] = useState(false);
  const [lineEditing, setLineEditing] = useState<any | null>(null);
  const [lineForm, setLineForm] = useState<CtmLineForm>(emptyLineForm);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineDeleteTarget, setLineDeleteTarget] = useState<any | null>(null);

  const setLf = <K extends keyof CtmLineForm>(key: K, value: CtmLineForm[K]) =>
    setLineForm((f) => ({ ...f, [key]: value }));

  const openLineCreate = () => {
    setLineEditing(null);
    setLineForm(emptyLineForm);
    setLineOpen(true);
  };
  const openLineEdit = (line: any) => {
    setLineEditing(line);
    setLineForm({
      lineDate: line.lineDate ?? "",
      lineType: line.lineType ?? "expense",
      crewUuid: line.crewUuid ?? "",
      amount: line.amount ?? "",
      description: line.description ?? "",
    });
    setLineOpen(true);
  };

  const saveLine = async () => {
    if (!lineForm.amount) {
      toast({
        title: "Missing amount",
        description: "An amount is required.",
        variant: "destructive",
      });
      return;
    }
    setLineSaving(true);
    try {
      const body = {
        lineDate: lineForm.lineDate || null,
        lineType: lineForm.lineType,
        crewUuid: lineForm.crewUuid || null,
        amount: lineForm.amount,
        description: lineForm.description.trim() || null,
      };
      if (lineEditing) {
        await accountsApiV2.ctm.updateLine(lineEditing.ctmLineUuid, body);
      } else {
        await accountsApiV2.ctm.createLine(vesselUuid, period, body);
      }
      invalidateAll();
      setLineOpen(false);
      toast({ title: lineEditing ? "CTM line updated" : "CTM line added" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setLineSaving(false);
    }
  };

  const deleteLine = async () => {
    if (!lineDeleteTarget) return;
    setLineSaving(true);
    try {
      await accountsApiV2.ctm.removeLine(lineDeleteTarget.ctmLineUuid);
      invalidateAll();
      setLineDeleteTarget(null);
      toast({ title: "CTM line deleted" });
    } catch (err) {
      toast({
        title: "Delete failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setLineSaving(false);
    }
  };

  // ---- submit / return -----------------------------------------------------
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitWarnings, setSubmitWarnings] = useState<string[] | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnComment, setReturnComment] = useState("");
  const [returning, setReturning] = useState(false);

  const tryOpenSubmit = () => {
    if (totalDirty > 0) {
      toast({
        title: "Unsaved changes",
        description: `You have ${totalDirty} unsaved change${totalDirty === 1 ? "" : "s"}. Save every tab before submitting the month.`,
        variant: "destructive",
      });
      return;
    }
    setSubmitOpen(true);
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await accountsApiV2.vesselPortage.submit(
        vesselUuid,
        period,
      );
      setSubmitWarnings(result?.warnings ?? []);
      invalidateAll();
      setSubmitOpen(false);
      toast({
        title: "Month submitted",
        description: `${result?.transactionsSubmitted ?? 0} entries sent to office review.`,
      });
    } catch (err) {
      toast({
        title: "Submit failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const doReturn = async () => {
    if (!returnComment.trim()) {
      toast({
        title: "Comment required",
        description: "A comment is required to return the month.",
        variant: "destructive",
      });
      return;
    }
    setReturning(true);
    try {
      await accountsApiV2.vesselPortage.returnToVessel(
        portage.portageUuid,
        returnComment.trim(),
      );
      invalidateAll();
      setReturnOpen(false);
      setReturnComment("");
      toast({ title: "Month returned to vessel" });
    } catch (err) {
      toast({
        title: "Return failed",
        description: parseApiError(err).message,
        variant: "destructive",
      });
    } finally {
      setReturning(false);
    }
  };

  // ---- render ---------------------------------------------------------------
  const entryStatusCounts = ["draft", "submitted", "accepted", "rejected"].map(
    (s) => ({ status: s, count: counts[s] ?? 0 }),
  );

  const renderSaveBar = (tab: EntryTabDef) => {
    const n = dirtyCount(tab.id);
    return (
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-xs text-muted-foreground">
          Posts to{" "}
          <span className="font-medium">
            {tab.element.code} — {tab.element.name}
          </span>
          . Type into a cell and move on with Tab/Enter; blank means no entry.
        </div>
        <div className="flex items-center gap-2">
          {n > 0 && (
            <span
              className="text-xs text-amber-700"
              data-testid={`text-unsaved-${tab.id}`}
            >
              {n} unsaved change{n === 1 ? "" : "s"}
            </span>
          )}
          {gridEditable && (
            <Button
              size="sm"
              disabled={n === 0 || saving}
              onClick={() => void saveTab(tab.id)}
              data-testid={`button-save-${tab.id}`}
            >
              <Save size={13} className="mr-1" />
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderEntryTab = (tab: EntryTabDef) => (
    <TabsContent key={tab.id} value={tab.id} className="space-y-2">
      {isLocked && (
        <div
          className="border border-gray-300 bg-gray-50 rounded-md px-4 py-2 text-sm text-gray-700 flex items-center gap-1"
          data-testid={`banner-locked-${tab.id}`}
        >
          <Lock size={13} /> This month is locked — all entries are read-only.
        </div>
      )}
      {tab.id === "bond" && (
        <div
          className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-xs text-amber-800"
          data-testid="banner-bond-double-entry"
        >
          The office also maintains itemized bond entries that roll up into one
          monthly amount per crew (shown in the Office rollup column). Do not
          enter amounts here for purchases the office already tracks — that
          would double-post.
        </div>
      )}
      {renderSaveBar(tab)}
      {tab.kind === "dated" && gridEditable && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAddDateFor(tab.id);
              setNewDate("");
            }}
            data-testid={`button-add-date-${tab.id}`}
          >
            <Plus size={13} className="mr-1" /> Add date
          </Button>
          {datedColumns(tab)
            .filter((d) => d !== UNDATED)
            .map((d) => (
              <Button
                key={d}
                size="sm"
                variant="ghost"
                className="text-red-600 h-8 px-2"
                onClick={() => setDeleteDateFor({ tabId: tab.id, date: d })}
                data-testid={`button-delete-date-${tab.id}-${d}`}
              >
                <Trash2 size={12} className="mr-1" /> {formatDate(d)}
              </Button>
            ))}
        </div>
      )}
      <EntryGrid
        columns={buildColumns(tab)}
        rows={buildRows(tab)}
        editable={gridEditable}
        onCellEdited={onCellEdited(tab.id)}
        onRejectedCellClicked={setRejectedTxn}
        testId={`grid-${tab.id}`}
      />
    </TabsContent>
  );

  return (
    <div className="p-4 space-y-4" data-testid="vessel-portage-page">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0f172a]">
            Vessel Portage — Monthly Submission
          </h1>
          <p className="text-sm text-muted-foreground">
            Category entry sheets, CTM cash account and month-end submission to
            office
          </p>
        </div>
        {hasFilter && (
          <div className="flex items-center gap-2">
            {totalDirty > 0 && (
              <span
                className="text-xs text-amber-700"
                data-testid="text-total-unsaved"
              >
                {totalDirty} unsaved change{totalDirty === 1 ? "" : "s"}
              </span>
            )}
            <StatusBadge status={portageStatus} testId="badge-portage-status" />
            {isLocked && (
              <Badge
                variant="outline"
                className="gap-1"
                data-testid="badge-locked"
              >
                <Lock size={12} /> Locked
              </Badge>
            )}
            {canReturn && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReturnOpen(true)}
                data-testid="button-return-to-vessel"
              >
                <Undo2 size={14} className="mr-1" /> Return to Vessel
              </Button>
            )}
            {canSubmit && (
              <Button
                size="sm"
                className="bg-[#16569e] hover:bg-[#1e5fa8]"
                onClick={tryOpenSubmit}
                data-testid="button-submit-month"
              >
                <Send size={14} className="mr-1" /> Submit Month
              </Button>
            )}
          </div>
        )}
      </div>

      <VesselPeriodBar
        vesselUuid={vesselUuid}
        period={period}
        onVesselChange={isVessel ? () => {} : handleVesselChange}
        onPeriodChange={handlePeriodChange}
      />

      {!hasFilter && (
        <div
          className="border rounded-md bg-white p-8 text-center text-sm text-muted-foreground"
          data-testid="text-select-prompt"
        >
          {isVessel && !fixedVesselUuid
            ? "No vessel assignment found for your account."
            : "Select a vessel and period to open the monthly submission package."}
        </div>
      )}

      {hasFilter && pkgLoading && (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading package…
        </div>
      )}

      {hasFilter && !pkgLoading && (
        <>
          {submitWarnings && submitWarnings.length > 0 && (
            <div
              className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-sm text-amber-800 space-y-1"
              data-testid="banner-submit-warnings"
            >
              {submitWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList data-testid="tabs-vessel-portage" className="flex-wrap h-auto">
              <TabsTrigger value="crew" data-testid="tab-crew-wages">
                Crew &amp; wages
              </TabsTrigger>
              {entryTabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} data-testid={t.testId}>
                  {t.label}
                  {dirtyCount(t.id) > 0 && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                  )}
                </TabsTrigger>
              ))}
              <TabsTrigger value="ctm" data-testid="tab-ctm">
                CTM cash account
              </TabsTrigger>
              <TabsTrigger value="submission" data-testid="tab-submission">
                Submit month
              </TabsTrigger>
            </TabsList>

            {/* ------------- Tab 1: Crew & wages (read-only overview) ------------- */}
            <TabsContent value="crew">
              <div className="border rounded-md bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Crew</th>
                      <th className="px-3 py-2 font-medium">Rank</th>
                      <th className="px-3 py-2 font-medium">Sign On / Off</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Net On Board
                      </th>
                      <th className="px-3 py-2 font-medium">Month Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagedRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-muted-foreground"
                          data-testid="text-no-crew"
                        >
                          No engaged crew for this vessel-month.
                        </td>
                      </tr>
                    )}
                    {engagedRows.map((r) => {
                      const entries = txnsByCrew.get(r.crewUuid) ?? [];
                      const net = netByEngagement.get(
                        r.engagement.engagementUuid,
                      );
                      return (
                        <tr
                          key={r.crewUuid}
                          className="border-b last:border-0 align-top"
                          data-testid={`row-crew-${r.crewUuid}`}
                        >
                          <td className="px-3 py-2 font-medium whitespace-nowrap">
                            {r.crewName}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {r.presentRank ?? "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                            {formatDate(r.engagement.startDate)} →{" "}
                            {r.engagement.endDate
                              ? formatDate(r.engagement.endDate)
                              : "on board"}
                          </td>
                          <td
                            className="px-3 py-2 text-right whitespace-nowrap"
                            data-testid={`text-net-${r.crewUuid}`}
                          >
                            {net != null ? formatMoney(net) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {entries.length === 0 && (
                                <span className="text-xs text-muted-foreground">
                                  No entries
                                </span>
                              )}
                              {entries.map((t) => {
                                const el = elementByUuid.get(t.payElementUuid);
                                return (
                                  <button
                                    key={t.txnUuid}
                                    type="button"
                                    onClick={() =>
                                      t.status === "rejected" &&
                                      setRejectedTxn(t)
                                    }
                                    title={
                                      t.status === "rejected" && t.reviewComment
                                        ? `Rejected: ${t.reviewComment}`
                                        : `${t.status}`
                                    }
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                                      ENTRY_CHIP_STYLES[t.status] ?? ""
                                    }`}
                                    data-testid={`chip-entry-${t.txnUuid}`}
                                  >
                                    <span className="font-medium">
                                      {el?.code ?? "?"}
                                    </span>
                                    <span>{formatMoney(t.amount)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Read-only overview. Enter amounts on the category tabs above.
              </p>
            </TabsContent>

            {/* ------------- Category entry tabs ------------- */}
            {entryTabs.map(renderEntryTab)}

            {/* ------------- CTM Cash Account (unchanged) ------------- */}
            <TabsContent value="ctm" className="space-y-3">
              {imbalance && (
                <div
                  className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-sm text-amber-800 flex items-start gap-1"
                  data-testid="banner-ctm-imbalance"
                >
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span>
                    CTM does not reconcile: closing ≠ opening + received +
                    signed lines. Review the lines below.
                  </span>
                </div>
              )}
              <div className="border rounded-md bg-white p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      Opening Balance{openingCarried ? " (carried)" : ""}
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9 w-36"
                      value={headerForm.opening}
                      disabled={openingCarried || !packageEditable || !mayEdit}
                      onChange={(e) =>
                        setHeaderForm((f) => ({
                          ...f,
                          opening: e.target.value,
                        }))
                      }
                      data-testid="input-ctm-opening"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      Received This Month
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9 w-36"
                      value={headerForm.received}
                      disabled={!packageEditable || !mayEdit}
                      onChange={(e) =>
                        setHeaderForm((f) => ({
                          ...f,
                          received: e.target.value,
                        }))
                      }
                      data-testid="input-ctm-received"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">
                      Closing Balance (computed)
                    </Label>
                    <div
                      className="h-9 w-36 flex items-center px-3 border rounded-md bg-slate-50 font-medium"
                      data-testid="text-ctm-closing"
                    >
                      {ctm ? formatMoney(ctm.closingBalance) : "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Status</Label>
                    <div className="h-9 flex items-center">
                      <StatusBadge
                        status={ctm?.status}
                        testId="badge-ctm-status"
                      />
                    </div>
                  </div>
                  {packageEditable && mayEdit && (
                    <Button
                      size="sm"
                      onClick={saveHeader}
                      disabled={headerSaving}
                      data-testid="button-save-ctm-header"
                    >
                      {headerSaving ? "Saving…" : "Save Header"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="border rounded-md bg-white">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                  <h3 className="text-sm font-medium">CTM Lines</h3>
                  {packageEditable && mayCreate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openLineCreate}
                      data-testid="button-add-ctm-line"
                    >
                      <Plus size={13} className="mr-1" /> Add Line
                    </Button>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Crew</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Amount
                      </th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {ctmLines.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-muted-foreground"
                          data-testid="text-no-ctm-lines"
                        >
                          No CTM lines for this month.
                        </td>
                      </tr>
                    )}
                    {ctmLines.map((l) => {
                      const isAuto = txnByCtmLine.has(l.ctmLineUuid);
                      return (
                        <tr
                          key={l.ctmLineUuid}
                          className="border-b last:border-0"
                          data-testid={`row-ctm-line-${l.ctmLineUuid}`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {l.lineDate ? formatDate(l.lineDate) : "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {CTM_LINE_TYPES.find((t) => t.value === l.lineType)
                              ?.label ?? l.lineType}
                            {isAuto && (
                              <Badge
                                variant="outline"
                                className="ml-2 text-[10px]"
                                data-testid={`badge-auto-${l.ctmLineUuid}`}
                              >
                                auto
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {l.crewUuid
                              ? (crewByUuid.get(l.crewUuid)?.crewName ??
                                l.crewUuid)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {formatMoney(l.amount)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {l.description ?? ""}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {packageEditable && !isAuto && (
                              <>
                                {mayEdit && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => openLineEdit(l)}
                                    data-testid={`button-edit-ctm-line-${l.ctmLineUuid}`}
                                  >
                                    <Pencil size={13} />
                                  </Button>
                                )}
                                {mayDelete && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-red-600"
                                    onClick={() => setLineDeleteTarget(l)}
                                    data-testid={`button-delete-ctm-line-${l.ctmLineUuid}`}
                                  >
                                    <Trash2 size={13} />
                                  </Button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ------------- Submit month (unchanged + unsaved block) ------------- */}
            <TabsContent value="submission" className="space-y-3">
              <div className="border rounded-md bg-white p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Month Summary — {formatPeriod(period)}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {entryStatusCounts.map(({ status, count }) => (
                      <div
                        key={status}
                        className="border rounded-md px-4 py-2 text-center min-w-24"
                        data-testid={`count-${status}`}
                      >
                        <div className="text-lg font-semibold">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {status}
                        </div>
                      </div>
                    ))}
                    <div
                      className="border rounded-md px-4 py-2 text-center min-w-32"
                      data-testid="summary-ctm-closing"
                    >
                      <div className="text-lg font-semibold">
                        {ctm ? formatMoney(ctm.closingBalance) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        CTM Closing
                      </div>
                    </div>
                  </div>
                </div>

                {totalDirty > 0 && (
                  <div
                    className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-sm text-amber-800 flex items-start gap-1"
                    data-testid="warning-unsaved-changes"
                  >
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      {totalDirty} unsaved change
                      {totalDirty === 1 ? "" : "s"} on the entry tabs — save
                      them before submitting the month.
                    </span>
                  </div>
                )}

                {imbalance && (
                  <div
                    className="border border-amber-300 bg-amber-50 rounded-md px-4 py-2 text-sm text-amber-800 flex items-start gap-1"
                    data-testid="warning-imbalance"
                  >
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      CTM does not reconcile — you can still submit, but the
                      office will see this warning.
                    </span>
                  </div>
                )}

                {!packageEditable && !isLocked && (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-submission-readonly"
                  >
                    This month is {portageStatus.replace(/_/g, " ")} — the
                    package is read-only for the vessel until it is returned or
                    locked.
                  </p>
                )}

                {canSubmit && (
                  <Button
                    className="bg-[#16569e] hover:bg-[#1e5fa8]"
                    onClick={tryOpenSubmit}
                    disabled={totalDirty > 0}
                    data-testid="button-submit-month-tab"
                  >
                    <Send size={14} className="mr-1" /> Submit Month to Office
                  </Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ---------------- Rejected-cell comment dialog ---------------- */}
      <Dialog
        open={!!rejectedTxn}
        onOpenChange={(o) => !o && setRejectedTxn(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejected Entry</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>
              <span className="font-medium">
                {crewByUuid.get(rejectedTxn?.crewUuid)?.crewName ?? ""}
              </span>{" "}
              — {elementByUuid.get(rejectedTxn?.payElementUuid)?.code ?? ""}{" "}
              {formatMoney(rejectedTxn?.amount)}
            </p>
            <p
              className="text-red-700 border border-red-200 bg-red-50 rounded-md px-3 py-2"
              data-testid="text-entry-reject-comment"
            >
              Office: {rejectedTxn?.reviewComment ?? "No comment provided."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectedTxn(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Add date column dialog ---------------- */}
      <Dialog
        open={!!addDateFor}
        onOpenChange={(o) => !o && setAddDateFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Date Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              data-testid="input-new-date-column"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDateFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmAddDate}
              disabled={!newDate}
              data-testid="button-confirm-add-date"
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Delete date column confirm ---------------- */}
      <Dialog
        open={!!deleteDateFor}
        onOpenChange={(o) => !o && setDeleteDateFor(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Date Column</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Remove the {deleteDateFor ? formatDate(deleteDateFor.date) : ""}{" "}
            column? All draft entries under this date will be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDateFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmDeleteDate()}
              disabled={saving}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-date"
            >
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- CTM line dialog ---------------- */}
      <Dialog open={lineOpen} onOpenChange={setLineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lineEditing ? "Edit CTM Line" : "Add CTM Line"} —{" "}
              {formatPeriod(period)}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={lineForm.lineDate}
                onChange={(e) => setLf("lineDate", e.target.value)}
                data-testid="input-line-date"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={lineForm.lineType}
                onValueChange={(v) => setLf("lineType", v)}
              >
                <SelectTrigger data-testid="select-line-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CTM_LINE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lineForm.lineType === "cash_advance_to_crew" && (
              <div className="space-y-1 col-span-2">
                <Label>Crew</Label>
                <Select
                  value={lineForm.crewUuid}
                  onValueChange={(v) => setLf("crewUuid", v)}
                >
                  <SelectTrigger data-testid="select-line-crew">
                    <SelectValue placeholder="Select crew member" />
                  </SelectTrigger>
                  <SelectContent>
                    {engagedRows.map((r) => (
                      <SelectItem key={r.crewUuid} value={r.crewUuid}>
                        {r.crewName} ({r.presentRank ?? "—"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={lineForm.amount}
                onChange={(e) => setLf("amount", e.target.value)}
                data-testid="input-line-amount"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={lineForm.description}
                onChange={(e) => setLf("description", e.target.value)}
                data-testid="input-line-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveLine}
              disabled={lineSaving}
              data-testid="button-save-ctm-line"
            >
              {lineSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- CTM line delete confirm ---------------- */}
      <Dialog
        open={!!lineDeleteTarget}
        onOpenChange={(o) => !o && setLineDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete CTM Line</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Delete this {lineDeleteTarget?.lineType?.replace(/_/g, " ")} line of{" "}
            {formatMoney(lineDeleteTarget?.amount)}?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={deleteLine}
              disabled={lineSaving}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-ctm-line"
            >
              {lineSaving ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Submit confirm dialog ---------------- */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Month — {formatPeriod(period)}</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>
              Submitting sends all draft entries and the CTM cash account to the
              office for review. The package becomes read-only for the vessel
              until it is returned or locked.
            </p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>{counts.draft ?? 0} draft entries will be submitted</li>
              <li>
                CTM closing:{" "}
                {ctm
                  ? `${formatMoney(ctm.closingBalance)} ${ctm.currency ?? ""}`
                  : "—"}
              </li>
              {imbalance && (
                <li className="text-amber-700">
                  CTM does not reconcile — submitted with a warning
                </li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={doSubmit}
              disabled={submitting}
              className="bg-[#16569e] hover:bg-[#1e5fa8]"
              data-testid="button-confirm-submit"
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Return-to-vessel dialog ---------------- */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Month to Vessel</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Returning re-opens the month for the vessel: submitted entries
              revert to draft and the CTM re-opens. A comment is required.
            </p>
            <Textarea
              rows={3}
              placeholder="Reason for returning the month…"
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              data-testid="input-return-comment"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={doReturn}
              disabled={returning || !returnComment.trim()}
              data-testid="button-confirm-return"
            >
              {returning ? "Returning…" : "Return to Vessel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
