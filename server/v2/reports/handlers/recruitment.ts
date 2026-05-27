import { z } from "zod";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import {
  recruitmentCandidatesV2,
  candPersonalDetails,
  candDocuments,
  screeningB5Tests,
} from "../../../../shared/v2/recruitment/schema";
import { masterNationalities } from "../../../../shared/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn, ReportResultRow } from "../../../../shared/v2/reports/types";
import { dateFilter, fullNameExpr } from "./_shared";

const candNameExpr = fullNameExpr(
  recruitmentCandidatesV2.firstName,
  recruitmentCandidatesV2.middleName,
  recruitmentCandidatesV2.familyName,
);

const updatedDate = sql<string>`to_char(${recruitmentCandidatesV2.updatedAt}, 'YYYY-MM-DD')`;
const createdDate = sql<string>`to_char(${recruitmentCandidatesV2.createdAt}, 'YYYY-MM-DD')`;

// Generic "list candidates by status" handler factory keeps the four
// status-driven reports identical except for their target status set.
function makeStatusReport(
  reportId: string,
  title: string,
  matchStatuses: string[],
  dateLabel: string,
): ReportHandler<{ rank?: string; dateFrom?: string; dateTo?: string }> {
  const filterSchema = z
    .object({
      rank: z.string().trim().min(1).optional(),
      dateFrom: dateFilter,
      dateTo: dateFilter,
    })
    .strict();

  const columns: ReportColumn[] = [
    { key: "fileNo", label: "File No", type: "text", width: 110 },
    { key: "name", label: "Name", type: "text" },
    { key: "rankAppliedFor", label: "Rank Applied", type: "text" },
    { key: "nationalityName", label: "Nationality", type: "text" },
    { key: "status", label: "Status", type: "status", width: 130 },
    { key: "lastUpdated", label: dateLabel, type: "date", width: 140 },
  ];

  const sortMap: Record<string, PgColumn | SQL> = {
    fileNo: recruitmentCandidatesV2.fileNo,
    name: recruitmentCandidatesV2.firstName,
    rankAppliedFor: recruitmentCandidatesV2.rankAppliedFor,
    nationalityName: masterNationalities.nationality,
    status: recruitmentCandidatesV2.status,
    lastUpdated: recruitmentCandidatesV2.updatedAt,
  };

  return {
    reportId,
    title,
    columns,
    filterSchema,
    async run(filters, ctx) {
      const db = getDb();
      const lowered = matchStatuses.map((s) => s.toLowerCase());
      const conds: SQL[] = [
        eq(recruitmentCandidatesV2.isDeleted, false),
        inArray(
          sql<string>`LOWER(COALESCE(${recruitmentCandidatesV2.status}, ''))`,
          lowered,
        ),
      ];
      if (filters.rank) conds.push(eq(recruitmentCandidatesV2.rankAppliedFor, filters.rank));
      if (filters.dateFrom) conds.push(sql`${recruitmentCandidatesV2.updatedAt} >= ${filters.dateFrom}::date`);
      if (filters.dateTo) conds.push(sql`${recruitmentCandidatesV2.updatedAt} <= (${filters.dateTo}::date + INTERVAL '1 day')`);
      const where = and(...conds);

      const totalRes = await db
        .select({ c: sql<number>`count(*)` })
        .from(recruitmentCandidatesV2)
        .leftJoin(masterNationalities, eq(recruitmentCandidatesV2.nationalityUuid, masterNationalities.natUuid))
        .where(where);
      const total = Number(totalRes[0]?.c ?? 0);

      const sortKey = ctx.sort?.key ?? "lastUpdated";
      const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.lastUpdated);

      const rows = await db
        .select({
          fileNo: recruitmentCandidatesV2.fileNo,
          name: candNameExpr,
          rankAppliedFor: recruitmentCandidatesV2.rankAppliedFor,
          nationalityName: masterNationalities.nationality,
          status: recruitmentCandidatesV2.status,
          lastUpdated: updatedDate,
        })
        .from(recruitmentCandidatesV2)
        .leftJoin(masterNationalities, eq(recruitmentCandidatesV2.nationalityUuid, masterNationalities.natUuid))
        .where(where)
        .orderBy(order, asc(recruitmentCandidatesV2.recCanUuid))
        .limit(ctx.pageSize)
        .offset((ctx.page - 1) * ctx.pageSize);

      const mapped: ReportResultRow[] = rows.map((r: (typeof rows)[number]) => ({
        fileNo: r.fileNo ?? null,
        name: r.name ?? null,
        rankAppliedFor: r.rankAppliedFor ?? null,
        nationalityName: r.nationalityName ?? null,
        status: r.status ?? null,
        lastUpdated: r.lastUpdated ?? null,
      }));
      return { rows: mapped, total };
    },
  };
}

export const recRecruitedReport = makeStatusReport(
  "rec-recruited",
  "Recruited",
  ["recruited"],
  "Joining Date",
);

export const recWaitlistReport = makeStatusReport(
  "rec-waitlist",
  "Waitlist",
  ["waitlisted", "waitlist"],
  "Updated",
);

export const recRejectedReport = makeStatusReport(
  "rec-rejected",
  "Rejected",
  ["rejected"],
  "Rejection Date",
);

export const recOffersIssuedReport = makeStatusReport(
  "rec-offers-issued",
  "Offers Issued",
  ["offered", "offer issued", "recruited"],
  "Offer Date",
);

export const recJoiningStatusReport = makeStatusReport(
  "rec-joining-status",
  "Joining Status",
  ["recruited", "transferred", "offered", "offer issued"],
  "Updated",
);

// ============================================================
// rec-applications-by-source : group by manning agent.
// ============================================================
const sourceFilters = z
  .object({
    source: z.string().trim().min(1).optional(),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .strict();

const sourceCols: ReportColumn[] = [
  { key: "source", label: "Source", type: "text" },
  { key: "applications", label: "Applications", type: "number", align: "right", width: 140 },
];

const candidateSourceExpr = sql<string>`COALESCE(NULLIF(TRIM((
  SELECT cand_personal_details.manning_agent
  FROM cand_personal_details
  WHERE cand_personal_details.rec_can_uuid = recruitment_candidates_v2.rec_can_uuid
    AND cand_personal_details.is_deleted = FALSE
  ORDER BY cand_personal_details.id ASC
  LIMIT 1
)), ''), 'Unknown')`;
const appCountExpr = sql<number>`COUNT(*)`;
const totalGroupsExpr = sql<number>`COUNT(*) OVER ()`;

export const recApplicationsBySourceReport: ReportHandler<z.infer<typeof sourceFilters>> = {
  reportId: "rec-applications-by-source",
  title: "Applications by Source",
  columns: sourceCols,
  filterSchema: sourceFilters,
  async run(filters, ctx) {
    const db = getDb();
    const conds: SQL[] = [eq(recruitmentCandidatesV2.isDeleted, false)];
    if (filters.source) conds.push(sql`${candidateSourceExpr} = ${filters.source}`);
    if (filters.dateFrom) conds.push(sql`${recruitmentCandidatesV2.createdAt} >= ${filters.dateFrom}::date`);
    if (filters.dateTo) conds.push(sql`${recruitmentCandidatesV2.createdAt} <= (${filters.dateTo}::date + INTERVAL '1 day')`);
    const where = and(...conds);

    const sortKey = ctx.sort?.key ?? "applications";
    const orderFn = ctx.sort?.direction === "desc" ? desc : asc;
    const orderExpr = sortKey === "source" ? orderFn(candidateSourceExpr) : orderFn(appCountExpr);

    const rows = await db
      .select({ source: candidateSourceExpr, applications: appCountExpr, totalGroups: totalGroupsExpr })
      .from(recruitmentCandidatesV2)
      .where(where)
      .groupBy(candidateSourceExpr)
      .orderBy(orderExpr)
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    const total = Number(rows[0]?.totalGroups ?? 0);
    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({ source: r.source, applications: Number(r.applications) })),
    };
  },
};

// ============================================================
// "Pending" reports: candidate is active and is missing a record.
// medical = no screening B5 test entry; document = no cand_documents row.
// ============================================================
type PendingFilters = { rank?: string; withinDays: number };
const pendingFilterSchema = z
  .object({
    rank: z.string().trim().min(1).optional(),
    withinDays: z.coerce.number().int().min(0).max(3650).default(30),
  })
  .strict();

const pendingCols: ReportColumn[] = [
  { key: "fileNo", label: "File No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "rankAppliedFor", label: "Rank Applied", type: "text" },
  { key: "createdAt", label: "Created", type: "date", width: 130 },
  { key: "daysOpen", label: "Days Open", type: "number", align: "right", width: 110 },
];

function makePendingReport(
  reportId: string,
  title: string,
  missingNotExists: SQL,
): ReportHandler<PendingFilters> {
  const sortMap: Record<string, PgColumn | SQL> = {
    fileNo: recruitmentCandidatesV2.fileNo,
    name: recruitmentCandidatesV2.firstName,
    rankAppliedFor: recruitmentCandidatesV2.rankAppliedFor,
    createdAt: recruitmentCandidatesV2.createdAt,
  };
  return {
    reportId,
    title,
    columns: pendingCols,
    filterSchema: pendingFilterSchema,
    async run(filters, ctx) {
      const db = getDb();
      const n = filters.withinDays;
      const conds: SQL[] = [
        eq(recruitmentCandidatesV2.isDeleted, false),
        sql`LOWER(COALESCE(${recruitmentCandidatesV2.status}, '')) NOT IN ('rejected', 'transferred')`,
        missingNotExists,
        sql`${recruitmentCandidatesV2.createdAt} >= NOW() - (${n} || ' days')::interval`,
      ];
      if (filters.rank) conds.push(eq(recruitmentCandidatesV2.rankAppliedFor, filters.rank));
      const where = and(...conds);

      const totalRes = await db
        .select({ c: sql<number>`count(*)` })
        .from(recruitmentCandidatesV2)
        .where(where);
      const total = Number(totalRes[0]?.c ?? 0);

      const sortKey = ctx.sort?.key ?? "createdAt";
      const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.createdAt);

      const daysOpenExpr = sql<number>`EXTRACT(DAY FROM NOW() - ${recruitmentCandidatesV2.createdAt})::int`;

      const rows = await db
        .select({
          fileNo: recruitmentCandidatesV2.fileNo,
          name: candNameExpr,
          rankAppliedFor: recruitmentCandidatesV2.rankAppliedFor,
          createdAt: createdDate,
          daysOpen: daysOpenExpr,
        })
        .from(recruitmentCandidatesV2)
        .where(where)
        .orderBy(order, asc(recruitmentCandidatesV2.recCanUuid))
        .limit(ctx.pageSize)
        .offset((ctx.page - 1) * ctx.pageSize);

      return {
        total,
        rows: rows.map((r: (typeof rows)[number]) => ({
          fileNo: r.fileNo ?? null,
          name: r.name ?? null,
          rankAppliedFor: r.rankAppliedFor ?? null,
          createdAt: r.createdAt ?? null,
          daysOpen: Number(r.daysOpen ?? 0),
        })),
      };
    },
  };
}

const noB5TestExists = sql`NOT EXISTS (
  SELECT 1 FROM screening_b5_tests
  WHERE screening_b5_tests.rec_can_uuid = recruitment_candidates_v2.rec_can_uuid
    AND screening_b5_tests.is_deleted = FALSE
    AND COALESCE(screening_b5_tests.submitted_date, '') <> ''
)`;

const noDocsExists = sql`NOT EXISTS (
  SELECT 1 FROM cand_documents
  WHERE cand_documents.rec_can_uuid = recruitment_candidates_v2.rec_can_uuid
    AND cand_documents.is_deleted = FALSE
)`;

export const recMedicalPendingReport = makePendingReport(
  "rec-medical-pending",
  "Medical Pending",
  noB5TestExists,
);

export const recDocumentPendingReport = makePendingReport(
  "rec-document-pending",
  "Document Pending",
  noDocsExists,
);
