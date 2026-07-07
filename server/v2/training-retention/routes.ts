import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  crewMembersV2,
  crewTerminations,
  crewPersonalDetails,
} from "../../../shared/v2/crew-pool/schema";

const router = Router();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s)), "invalid calendar date");

const querySchema = z
  .object({
    periodFrom: isoDate,
    periodTo: isoDate,
    rankIds: z.array(z.string()).optional().default([]),
    poolIds: z.array(z.string()).optional().default([]),
    agentIds: z.array(z.string()).optional().default([]),
    nationalityIds: z.array(z.string()).optional().default([]),
  })
  .refine((d) => d.periodFrom <= d.periodTo, {
    message: "periodFrom must be <= periodTo",
    path: ["periodFrom"],
  });

function toArrayParam(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v.length > 0) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

router.get("/retention", async (req: Request, res: Response) => {
  try {
    const parsed = querySchema.safeParse({
      periodFrom: req.query.periodFrom,
      periodTo: req.query.periodTo,
      rankIds: toArrayParam(req.query.rankIds ?? req.query["rankIds[]"]),
      poolIds: toArrayParam(req.query.poolIds ?? req.query["poolIds[]"]),
      agentIds: toArrayParam(req.query.agentIds ?? req.query["agentIds[]"]),
      nationalityIds: toArrayParam(req.query.nationalityIds ?? req.query["nationalityIds[]"]),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
    }
    const { periodFrom, periodTo, rankIds, poolIds, agentIds, nationalityIds } = parsed.data;
    const db = getDb();

    // ---- Termination counts (S, UT, BT) -----------------------------------
    // Filter by snapshot fields captured at termination time so historic
    // moves between ranks/pools/agents do not distort the cohort numbers.
    // Boundaries are inclusive on both ends per task requirement.
    const termConditions = [
      eq(crewTerminations.isDeleted, false),
      gte(crewTerminations.terminationDate, periodFrom),
      lte(crewTerminations.terminationDate, periodTo),
    ];
    if (rankIds.length > 0) termConditions.push(inArray(crewTerminations.rankIdSnapshot, rankIds));
    if (poolIds.length > 0) termConditions.push(inArray(crewTerminations.poolIdSnapshot, poolIds));
    if (agentIds.length > 0) termConditions.push(inArray(crewTerminations.manningAgentIdSnapshot, agentIds));
    if (nationalityIds.length > 0) termConditions.push(inArray(crewMembersV2.nationalityUuid, nationalityIds));

    const termBaseQuery = db
      .select({
        category: crewTerminations.category,
        count: sql<number>`count(*)::int`,
      })
      .from(crewTerminations);

    const termRows = await (
      nationalityIds.length > 0
        ? termBaseQuery.innerJoin(
            crewMembersV2,
            eq(crewMembersV2.crewUuid, crewTerminations.crewUuid),
          )
        : termBaseQuery
    )
      .where(and(...termConditions))
      .groupBy(crewTerminations.category);

    let S = 0;
    let UT = 0;
    let BT = 0;
    for (const r of termRows) {
      const c = Number(r.count) || 0;
      S += c;
      if (r.category === "UT") UT += c;
      else if (r.category === "BT") BT += c;
    }

    // ---- Average Employees (AE) -------------------------------------------
    // Period-based headcount: a crew member is "active on date D" when
    //   recruitment_date <= D
    //   AND (no termination
    //        OR last_termination_date >= D
    //        OR last_termination_date < recruitment_date  -- re-hired after an
    //           old termination; the mirror column holds the latest termination
    //           which predates the current engagement)
    // Crew with NULL recruitment_date are excluded entirely (per user
    // decision) — otherwise the boundary comparison cannot be evaluated.
    // Dates are stored as YYYY-MM-DD text, so lexicographic comparison is
    // chronologically correct. AE = (activeAtStart + activeAtEnd) / 2.
    const countActiveOn = async (boundaryDate: string): Promise<number> => {
      const conds = [
        eq(crewMembersV2.isDeleted, false),
        // NULLIF treats empty-string dates the same as NULL (legacy rows
        // store '' instead of NULL).
        sql`NULLIF(${crewMembersV2.recruitmentDate}, '') IS NOT NULL AND ${crewMembersV2.recruitmentDate} <= ${boundaryDate}`,
        sql`(NULLIF(${crewMembersV2.lastTerminationDate}, '') IS NULL OR ${crewMembersV2.lastTerminationDate} >= ${boundaryDate} OR ${crewMembersV2.lastTerminationDate} < ${crewMembersV2.recruitmentDate})`,
      ];
      if (rankIds.length > 0) conds.push(inArray(crewMembersV2.presentRank, rankIds));
      if (nationalityIds.length > 0) conds.push(inArray(crewMembersV2.nationalityUuid, nationalityIds));

      const needsPersonalJoin = poolIds.length > 0 || agentIds.length > 0;
      if (needsPersonalJoin) {
        const personalConds = [];
        if (poolIds.length > 0) personalConds.push(inArray(crewPersonalDetails.crewPool, poolIds));
        if (agentIds.length > 0) personalConds.push(inArray(crewPersonalDetails.manningAgent, agentIds));
        const rows = await db
          .select({ count: sql<number>`count(distinct ${crewMembersV2.crewUuid})::int` })
          .from(crewMembersV2)
          .innerJoin(crewPersonalDetails, eq(crewPersonalDetails.crewUuid, crewMembersV2.crewUuid))
          .where(and(...conds, ...personalConds));
        return Number(rows[0]?.count ?? 0);
      }
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(crewMembersV2)
        .where(and(...conds));
      return Number(rows[0]?.count ?? 0);
    };

    const [startCount, endCount] = await Promise.all([
      countActiveOn(periodFrom),
      countActiveOn(periodTo),
    ]);
    const AE = (startCount + endCount) / 2;

    // ---- Retention rate ---------------------------------------------------
    let retentionRate: number | null = null;
    if (AE > 0) {
      const raw = 100 - ((S - (UT + BT)) * 100) / AE;
      // Clamp to a sensible display range so a malformed cohort does not
      // print -3400% etc. The math itself is preserved server-side.
      const clamped = Math.max(-100, Math.min(100, raw));
      retentionRate = Math.round(clamped * 10) / 10;
    }

    return res.json({ S, UT, BT, AE, retentionRate });
  } catch (err: any) {
    console.error("[training-retention] /retention error:", err);
    return res.status(500).json({ error: err?.message || "Failed to compute retention" });
  }
});

export default router;
