import { z } from "zod";
import { and, asc, desc, eq, gt, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { rhCrewRecordsV2, rhVesselRecordsV2 } from "../../../../shared/v2/rest-hours/schema";
import { masterVessels } from "../../../../shared/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn } from "../../../../shared/v2/reports/types";
import { dateFilter } from "./_shared";
import { calculateVesselReviewStatus, calculateOfficeReviewStatus } from "../../rest-hours/utils/reviewStatusUtils";
import { enrichVesselRecordsWithLiveCounts } from "../../rest-hours/services/vesselRecordsService";
import { DailyRecordsRepository } from "../../rest-hours/repositories";
import { getViolationDates, calculateNCs } from "../../rest-hours/utils/violationHelpers";

const dailyRecordsRepository = new DailyRecordsRepository();

// month_value is text "YYYY-MM"; cast to a date for range filtering.
const monthAsDate = sql`to_date(${rhCrewRecordsV2.monthValue} || '-01', 'YYYY-MM-DD')`;
const vMonthAsDate = sql`to_date(${rhVesselRecordsV2.monthValue} || '-01', 'YYYY-MM-DD')`;

// ============================================================
// rh-violations : crew records with totalViolations > 0.
// ============================================================
const violFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
    granularity: z.enum(["date"]).optional(),
  })
  .strict();

const violCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "monthValue", label: "Month", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "rank", label: "Rank", type: "text" },
  { key: "totalViolations", label: "Violations", type: "number", align: "right", width: 110 },
  { key: "totalNCs", label: "NCs", type: "number", align: "right", width: 80 },
];

export const restHourViolationsReport: ReportHandler<z.infer<typeof violFilters>> = {
  reportId: "rh-violations",
  title: "Rest Hour Violations",
  columns: violCols,
  filterSchema: violFilters,
  async run(filters, ctx) {
    const db = getDb();

    // ── Date-accurate branch (opt-in via granularity: "date") ──────────────
    // Computes violations/NCs per crew per month-portion from daily records,
    // using the same engine the RH module uses. The monthly path below is
    // completely untouched when the flag is absent.
    if (filters.granularity === "date" && filters.dateFrom && filters.dateTo) {
      const [fy, fm, fd] = filters.dateFrom.split("-").map(Number);
      const [ty, tm, td] = filters.dateTo.split("-").map(Number);

      // Vessel name map (+ optional vessel-name filter, same matching as monthly path)
      const vessels = await db
        .select({ vesselUuid: masterVessels.vesselUuid, vessel: masterVessels.vessel })
        .from(masterVessels);
      const vesselNameById = new Map<string, string>(
        vessels.map((v: (typeof vessels)[number]) => [v.vesselUuid, v.vessel])
      );
      const allowedVesselIds = filters.vessel
        ? new Set(
            vessels
              .filter((v: (typeof vessels)[number]) => v.vessel === filters.vessel)
              .map((v: (typeof vessels)[number]) => v.vesselUuid)
          )
        : null;

      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      type ViolRow = {
        vesselName: string | null;
        monthValue: string | null;
        name: string | null;
        rank: string | null;
        totalViolations: number;
        totalNCs: number;
      };
      // _sortMonth ("YYYY-MM") + _dayFrom keep chronological ordering for the
      // month column; they are stripped before returning rows.
      type InternalRow = ViolRow & { _sortMonth: string; _dayFrom: number };
      const allRows: InternalRow[] = [];

      // Enumerate months covered by the range
      let y = fy;
      let m = fm;
      while (y < ty || (y === ty && m <= tm)) {
        const monthYear = `${y}-${String(m).padStart(2, "0")}`;
        const daysInMonth = new Date(y, m, 0).getDate();
        // Portion of this month inside the selected range
        const rangeFrom = y === fy && m === fm ? fd : 1;
        const rangeTo = y === ty && m === tm ? td : daysInMonth;

        const records = await dailyRecordsRepository.findAll({ monthYear });
        for (const rec of records) {
          if (allowedVesselIds && !allowedVesselIds.has(rec.vesselId)) continue;

          // Intersect with the record's applicable window (sign-on/promotion), same
          // day-number conversion the RH module uses (YYYY-MM-DD within this month).
          let dayFrom = rangeFrom;
          let dayTo = rangeTo;
          if (rec.applicableFrom && rec.applicableFrom.startsWith(monthYear)) {
            dayFrom = Math.max(dayFrom, parseInt(rec.applicableFrom.split("-")[2], 10));
          }
          if (rec.applicableTo && rec.applicableTo.startsWith(monthYear)) {
            dayTo = Math.min(dayTo, parseInt(rec.applicableTo.split("-")[2], 10));
          }
          if (dayFrom > dayTo) continue;

          const dayRange = { from: dayFrom, to: dayTo };
          const totalViolations = getViolationDates(rec.dailyRecords, "Rest", false, false, dayRange).length;
          if (totalViolations === 0) continue;
          const { totalNCs } = calculateNCs(rec.dailyRecords, "Rest", false, dayRange);

          allRows.push({
            vesselName: vesselNameById.get(rec.vesselId) ?? null,
            monthValue: `${MON[m - 1]}-${y} (${dayFrom}–${dayTo})`,
            name: rec.name ?? null,
            rank: rec.rank ?? null,
            totalViolations,
            totalNCs,
            _sortMonth: monthYear,
            _dayFrom: dayFrom,
          });
        }

        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }

      // In-memory sort + pagination (same defaults as the monthly path).
      // The month column sorts chronologically via _sortMonth/_dayFrom, not by
      // its display label; vessel/name tie-breakers keep pagination stable.
      const sortKey = (ctx.sort?.key ?? "monthValue") as keyof ViolRow;
      const dir = ctx.sort?.direction === "desc" ? -1 : 1;
      const cmp = (av: unknown, bv: unknown): number => {
        if (av == null && bv == null) return 0;
        if (av == null) return -1;
        if (bv == null) return 1;
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av).localeCompare(String(bv));
      };
      allRows.sort((a, b) => {
        const primary =
          sortKey === "monthValue"
            ? cmp(a._sortMonth, b._sortMonth) || a._dayFrom - b._dayFrom
            : cmp(a[sortKey], b[sortKey]);
        if (primary !== 0) return primary * dir;
        // Deterministic tie-breakers (not direction-dependent) for stable pages
        return (
          cmp(a._sortMonth, b._sortMonth) ||
          a._dayFrom - b._dayFrom ||
          cmp(a.vesselName, b.vesselName) ||
          cmp(a.name, b.name) ||
          cmp(a.rank, b.rank)
        );
      });

      const start = (ctx.page - 1) * ctx.pageSize;
      return {
        total: allRows.length,
        rows: allRows
          .slice(start, start + ctx.pageSize)
          .map(({ _sortMonth, _dayFrom, ...row }) => row),
      };
    }
    // ── End date-accurate branch ────────────────────────────────────────────

    const conds: SQL[] = [
      eq(rhCrewRecordsV2.isDeleted, false),
      gt(rhCrewRecordsV2.totalViolations, 0),
    ];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    if (filters.dateFrom) conds.push(sql`${monthAsDate} >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`${monthAsDate} <= ${filters.dateTo}::date`);
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(rhCrewRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhCrewRecordsV2.vesselId))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      vesselName: masterVessels.vessel,
      monthValue: rhCrewRecordsV2.monthValue,
      name: rhCrewRecordsV2.name,
      rank: rhCrewRecordsV2.rank,
      totalViolations: rhCrewRecordsV2.totalViolations,
      totalNCs: rhCrewRecordsV2.totalNCs,
    };
    const sortKey = ctx.sort?.key ?? "monthValue";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.monthValue);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        monthValue: sql<string>`to_char(${monthAsDate}, 'Mon-YYYY')`,
        name: rhCrewRecordsV2.name,
        rank: rhCrewRecordsV2.rank,
        totalViolations: rhCrewRecordsV2.totalViolations,
        totalNCs: rhCrewRecordsV2.totalNCs,
      })
      .from(rhCrewRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhCrewRecordsV2.vesselId))
      .where(where)
      .orderBy(order, asc(rhCrewRecordsV2.rhCrewRecordUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        vesselName: r.vesselName ?? null,
        monthValue: r.monthValue ?? null,
        name: r.name ?? null,
        rank: r.rank ?? null,
        totalViolations: Number(r.totalViolations ?? 0),
        totalNCs: Number(r.totalNCs ?? 0),
      })),
    };
  },
};

// ============================================================
// rh-compliance-summary : per-vessel-month totals from rh_vessel_records_v2.
// ============================================================
const compFilters = z
  .object({
    vessel: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const compCols: ReportColumn[] = [
  { key: "vesselName", label: "Vessel", type: "text" },
  { key: "monthValue", label: "Month", type: "text", width: 110 },
  { key: "totalCrew", label: "Crew", type: "number", align: "right", width: 80 },
  { key: "recordingStatusPercent", label: "Recording %", type: "number", align: "right", width: 120 },
  { key: "totalViolations", label: "Violations", type: "number", align: "right", width: 110 },
  { key: "totalNCs", label: "NCs", type: "number", align: "right", width: 80 },
  { key: "vesselReviewStatus", label: "Vessel Review", type: "status", width: 130 },
  { key: "officeReviewStatus", label: "Office Review", type: "status", width: 130 },
];

export const restHourComplianceReport: ReportHandler<z.infer<typeof compFilters>> = {
  reportId: "rh-compliance-summary",
  title: "Rest Hour Compliance Summary",
  columns: compCols,
  filterSchema: compFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [eq(rhVesselRecordsV2.isDeleted, false)];
    if (filters.vessel) conds.push(eq(masterVessels.vessel, filters.vessel));
    if (filters.dateFrom) conds.push(sql`${vMonthAsDate} >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`${vMonthAsDate} <= ${filters.dateTo}::date`);
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(rhVesselRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhVesselRecordsV2.vesselId))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      vesselName: masterVessels.vessel,
      monthValue: rhVesselRecordsV2.monthValue,
      totalCrew: rhVesselRecordsV2.totalCrew,
      recordingStatusPercent: rhVesselRecordsV2.recordingStatusPercent,
      totalViolations: rhVesselRecordsV2.totalViolations,
      totalNCs: rhVesselRecordsV2.totalNCs,
      vesselReviewStatus: rhVesselRecordsV2.vesselReviewStatus,
      officeReviewStatus: rhVesselRecordsV2.officeReviewStatus,
    };
    const sortKey = ctx.sort?.key ?? "monthValue";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.monthValue);

    const rows = await db
      .select({
        vesselName: masterVessels.vessel,
        monthValue: sql<string>`to_char(${vMonthAsDate}, 'Mon-YYYY')`,
        totalCrew: rhVesselRecordsV2.totalCrew,
        recordingStatusPercent: rhVesselRecordsV2.recordingStatusPercent,
        totalViolations: rhVesselRecordsV2.totalViolations,
        totalNCs: rhVesselRecordsV2.totalNCs,
        vesselId: rhVesselRecordsV2.vesselId,
        rawMonth: rhVesselRecordsV2.monthValue,
        vesselReviewSubmittedDate: rhVesselRecordsV2.vesselReviewSubmittedDate,
        officeReviewSubmittedDate: rhVesselRecordsV2.officeReviewSubmittedDate,
      })
      .from(rhVesselRecordsV2)
      .leftJoin(masterVessels, eq(masterVessels.vesselUuid, rhVesselRecordsV2.vesselId))
      .where(where)
      .orderBy(order, asc(rhVesselRecordsV2.rhVesselUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    // Reuse the same live-count enrichment the RH Overview uses so the
    // report numbers always match the RH module (default Rest mode).
    const enriched = await enrichVesselRecordsWithLiveCounts(
      rows.map((r: (typeof rows)[number]) => ({
        vesselId: r.vesselId,
        monthValue: r.rawMonth,
        totalCrew: Number(r.totalCrew ?? 0),
        recordingStatusPercent: Number(r.recordingStatusPercent ?? 0),
        totalViolations: Number(r.totalViolations ?? 0),
        totalNCs: Number(r.totalNCs ?? 0),
      })) as any
    );
    const enrichedMap = new Map(
      enriched.map(e => [`${e.vesselId}|${e.monthValue}`, e])
    );

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => {
        const e = enrichedMap.get(`${r.vesselId}|${r.rawMonth}`);
        return {
          vesselName: r.vesselName ?? null,
          monthValue: r.monthValue ?? null,
          totalCrew: Number(e?.totalCrew ?? r.totalCrew ?? 0),
          recordingStatusPercent: Number(e?.recordingStatusPercent ?? r.recordingStatusPercent ?? 0),
          totalViolations: Number(e?.totalViolations ?? r.totalViolations ?? 0),
          totalNCs: Number(e?.totalNCs ?? r.totalNCs ?? 0),
          vesselReviewStatus: calculateVesselReviewStatus(r.rawMonth, r.vesselReviewSubmittedDate),
          officeReviewStatus: calculateOfficeReviewStatus(r.rawMonth, r.vesselReviewSubmittedDate, r.officeReviewSubmittedDate),
        };
      }),
    };
  },
};
