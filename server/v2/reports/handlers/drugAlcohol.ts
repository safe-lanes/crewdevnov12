import { z } from "zod";
import { TestRecordsRepository } from "../../drugs-alcohol/repositories/testRecordsRepository";
import { pickRelevantDate } from "../../drugs-alcohol/services/testRecordsService";
import type { ReportHandler } from "../types";
import type { ReportColumn, ReportResultRow } from "../../../../shared/v2/reports/types";
import { dateFilter } from "./_shared";

const testRecordsRepository = new TestRecordsRepository();

// Mirrors TEST_TYPE_LABELS in the dashboard drilldown
// (client/src/modules/dashboard/DAViolationsDrilldownDialog.tsx).
const TEST_TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  periodic: "Periodic",
  monthly: "Monthly",
  "post-incident": "Post-Incident",
  others: "Others",
};

function formatTestType(testType: string | null, otherTestType: string | null): string {
  const tt = testType ?? "";
  const base = TEST_TYPE_LABELS[tt] ?? (tt || "—");
  if (tt === "others" && otherTestType) return `${base} – ${otherTestType}`;
  return base;
}

const filterSchema = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    testType: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

type Filters = z.infer<typeof filterSchema>;

const COLUMNS: ReportColumn[] = [
  { key: "testType", label: "Test Type", type: "text" },
  { key: "testDate", label: "Test Date", type: "date", width: 130 },
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "alcoholViolations", label: "Alcohol Violations", type: "number", align: "right", width: 150 },
  { key: "drugViolations", label: "Drug Violations", type: "number", align: "right", width: 150 },
];

interface FormRow {
  testType: string;
  testDate: string;
  vesselName: string;
  alcoholViolations: number;
  drugViolations: number;
}

export const daViolationsReport: ReportHandler<Filters> = {
  reportId: "da-violations",
  title: "D&A Violations",
  columns: COLUMNS,
  filterSchema,
  async run(filters, ctx) {
    // Same source as the dashboard "D&A Violations" drilldown: finalized
    // (non-draft) test forms joined with tested personnel; violations are
    // the alcohol/drug violation flags per personnel row, grouped per form.
    const rows = await testRecordsRepository.findFinalizedViolatingPersonnelDetailed();

    // De-duplicate leftJoin fan-out on crew_personal_details, mirroring
    // testRecordsService._getFilteredViolatingPersonnel.
    const seen = new Set<string>();
    const byForm = new Map<
      string,
      FormRow & { rawTestType: string | null }
    >();
    let idx = 0;
    for (const row of rows) {
      idx++;
      const dedupKey = `${row.daUuid}::${row.crewId ?? `__row_${idx}`}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const dateStr = pickRelevantDate(row.testType, {
        dateTimeTestCompleted: row.dateTimeTestCompleted,
        incidentDateTime: row.incidentDateTime,
        testDateTime: row.testDateTime,
      });
      if (!dateStr) continue;
      if (filters.dateFrom && dateStr < filters.dateFrom) continue;
      if (filters.dateTo && dateStr > filters.dateTo) continue;
      if (filters.vessel && row.vesselName !== filters.vessel) continue;
      if (filters.testType && (row.testType ?? "") !== filters.testType) continue;

      const existing = byForm.get(row.daUuid);
      if (existing) {
        if (row.alcoholViolation) existing.alcoholViolations++;
        if (row.drugViolation) existing.drugViolations++;
      } else {
        byForm.set(row.daUuid, {
          rawTestType: row.testType,
          testType: formatTestType(row.testType, row.otherTestType),
          testDate: dateStr,
          vesselName: row.vesselName || "—",
          alcoholViolations: row.alcoholViolation ? 1 : 0,
          drugViolations: row.drugViolation ? 1 : 0,
        });
      }
    }

    // One row per form that has at least one violation (dashboard shows
    // alcohol- or drug-filtered lists; the report combines both).
    const forms: FormRow[] = Array.from(byForm.values())
      .filter((f) => f.alcoholViolations > 0 || f.drugViolations > 0)
      .map(({ rawTestType, ...rest }) => rest);

    const sortKey = (ctx.sort?.key ?? "testDate") as keyof FormRow;
    const dir = ctx.sort ? (ctx.sort.direction === "desc" ? -1 : 1) : -1;
    forms.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * dir;
    });

    const total = forms.length;
    const start = (ctx.page - 1) * ctx.pageSize;
    const paged = forms.slice(start, start + ctx.pageSize);
    const mapped: ReportResultRow[] = paged.map((f) => ({ ...f }));
    return { rows: mapped, total };
  },
};
