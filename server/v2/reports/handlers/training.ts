import { z } from "zod";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { crewLicenses, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import type { ReportHandler } from "../types";
import type { ReportColumn } from "../../../../shared/v2/reports/types";
import { dateExpr, fullNameExpr } from "./_shared";

const nameExpr = fullNameExpr(crewMembersV2.firstName, crewMembersV2.middleName, crewMembersV2.familyName);
const expiryDate = dateExpr(crewLicenses.expiry);

const currentVesselNameExpr = sql<string | null>`(
  SELECT master_vessels.vessel
  FROM vessel_planning_v2
  LEFT JOIN master_vessels
    ON master_vessels.vessel_uuid = vessel_planning_v2.vessel_uuid
  WHERE vessel_planning_v2.crew_uuid = crew_members_v2.crew_uuid
    AND vessel_planning_v2.is_deleted = FALSE
    AND vessel_planning_v2.is_archived = FALSE
    AND vessel_planning_v2.sign_off_date IS NULL
  LIMIT 1
)`;

const certFilters = z
  .object({
    withinDays: z.coerce.number().int().min(0).max(3650).default(30),
    rank: z.string().trim().min(1).optional(),
    onBoard: z.string().trim().optional(),
  })
  .strict();

const certCols: ReportColumn[] = [
  { key: "empNo", label: "Emp No", type: "text", width: 110 },
  { key: "name", label: "Name", type: "text" },
  { key: "presentRank", label: "Rank", type: "text" },
  { key: "certificate", label: "Certificate", type: "text" },
  { key: "certificateNo", label: "Certificate No", type: "text" },
  { key: "expiry", label: "Expiry", type: "date", width: 130 },
  { key: "vesselName", label: "Vessel", type: "text" },
];

export const certsExpiringReport: ReportHandler<z.infer<typeof certFilters>> = {
  reportId: "trn-certs-expiring",
  title: "Certificates Expiring Within N Days",
  columns: certCols,
  filterSchema: certFilters,
  async run(filters, ctx) {
    const db = getDb();
    const n = filters.withinDays;
    const conds: SQL[] = [
      eq(crewLicenses.isDeleted, false),
      eq(crewMembersV2.isDeleted, false),
      sql`${expiryDate} IS NOT NULL`,
      sql`${expiryDate} <= CURRENT_DATE + (${n} || ' days')::interval`,
    ];
    if (filters.rank) conds.push(eq(crewMembersV2.presentRank, filters.rank));
    if (filters.onBoard === "onboard") conds.push(sql`${currentVesselNameExpr} IS NOT NULL`);
    if (filters.onBoard === "onleave") conds.push(sql`${currentVesselNameExpr} IS NULL`);
    const where = and(...conds);

    const totalRes = await db
      .select({ c: sql<number>`count(*)` })
      .from(crewLicenses)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, crewLicenses.crewUuid))
      .where(where);
    const total = Number(totalRes[0]?.c ?? 0);

    const sortMap: Record<string, PgColumn | SQL> = {
      empNo: crewMembersV2.empNo,
      name: crewMembersV2.firstName,
      presentRank: crewMembersV2.presentRank,
      certificate: crewLicenses.abbr,
      certificateNo: crewLicenses.certificateNo,
      expiry: expiryDate,
      vesselName: currentVesselNameExpr,
    };
    const sortKey = ctx.sort?.key ?? "expiry";
    const order = (ctx.sort?.direction === "desc" ? desc : asc)(sortMap[sortKey] ?? sortMap.expiry);

    const rows = await db
      .select({
        empNo: crewMembersV2.empNo,
        name: nameExpr,
        presentRank: crewMembersV2.presentRank,
        certificate: crewLicenses.abbr,
        certificateNo: crewLicenses.certificateNo,
        expiry: crewLicenses.expiry,
        vesselName: currentVesselNameExpr,
      })
      .from(crewLicenses)
      .innerJoin(crewMembersV2, eq(crewMembersV2.crewUuid, crewLicenses.crewUuid))
      .where(where)
      .orderBy(order, asc(crewLicenses.licUuid))
      .limit(ctx.pageSize)
      .offset((ctx.page - 1) * ctx.pageSize);

    return {
      total,
      rows: rows.map((r: (typeof rows)[number]) => ({
        empNo: r.empNo ?? null,
        name: r.name ?? null,
        presentRank: r.presentRank ?? null,
        certificate: r.certificate ?? null,
        certificateNo: r.certificateNo ?? null,
        expiry: r.expiry ?? null,
        vesselName: r.vesselName ?? null,
      })),
    };
  },
};
