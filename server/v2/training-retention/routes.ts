import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq, gte, lte, inArray, isNull, sql } from "drizzle-orm";
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
    });
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
    }
    const { periodFrom, periodTo, rankIds, poolIds, agentIds } = parsed.data;
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

    const termRows = await db
      .select({
        category: crewTerminations.category,
        count: sql<number>`count(*)::int`,
      })
      .from(crewTerminations)
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
    // Approximation: count of currently isActive=true crew matching the
    // cohort filters. AE is computed as `(startCount + endCount) / 2`; until
    // a historical employment-snapshot table exists we use the current count
    // for both ends. Swap the two queries below for daily/period-boundary
    // snapshots once available.
    const activeConditions = [
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
      eq(crewMembersV2.isActive, true),
    ];
    if (rankIds.length > 0) activeConditions.push(inArray(crewMembersV2.presentRank, rankIds));

    const needsPersonalJoin = poolIds.length > 0 || agentIds.length > 0;
    let activeCount = 0;
    if (needsPersonalJoin) {
      const personalConds = [];
      if (poolIds.length > 0) personalConds.push(inArray(crewPersonalDetails.crewPool, poolIds));
      if (agentIds.length > 0) personalConds.push(inArray(crewPersonalDetails.manningAgent, agentIds));
      const rows = await db
        .select({ count: sql<number>`count(distinct ${crewMembersV2.crewUuid})::int` })
        .from(crewMembersV2)
        .innerJoin(crewPersonalDetails, eq(crewPersonalDetails.crewUuid, crewMembersV2.crewUuid))
        .where(and(...activeConditions, ...personalConds));
      activeCount = Number(rows[0]?.count ?? 0);
    } else {
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(crewMembersV2)
        .where(and(...activeConditions));
      activeCount = Number(rows[0]?.count ?? 0);
    }

    const startCount = activeCount;
    const endCount = activeCount;
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
