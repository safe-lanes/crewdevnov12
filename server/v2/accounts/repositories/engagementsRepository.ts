import { eq, and, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  accEngagementsV2,
  accWageScalesV2,
} from "../../../../shared/v2/accounts/schema";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterVessels } from "../../../../shared/schema";
import type {
  AccEngagementV2,
  InsertAccEngagementV2,
  AccWageScaleV2,
} from "../../../../shared/v2/accounts/types";

export type CrewAssignmentRow = typeof crewAssignments.$inferSelect;

export class EngagementsRepository {
  async findByUuid(engagementUuid: string): Promise<AccEngagementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          eq(accEngagementsV2.engagementUuid, engagementUuid),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
    return rows[0];
  }

  async findByAssignmentUuids(
    assignmentUuids: string[],
  ): Promise<AccEngagementV2[]> {
    if (assignmentUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(accEngagementsV2)
      .where(
        and(
          inArray(accEngagementsV2.assignmentUuid, assignmentUuids),
          eq(accEngagementsV2.isDeleted, false),
        ),
      );
  }

  async create(
    data: Omit<InsertAccEngagementV2, "engagementUuid">,
  ): Promise<AccEngagementV2> {
    const db = getDb();
    const rows = await db
      .insert(accEngagementsV2)
      .values({ ...data, engagementUuid: uuidv4() })
      .returning();
    return rows[0];
  }

  async update(
    engagementUuid: string,
    data: Partial<InsertAccEngagementV2>,
  ): Promise<AccEngagementV2 | undefined> {
    const db = getDb();
    const rows = await db
      .update(accEngagementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(accEngagementsV2.engagementUuid, engagementUuid),
          eq(accEngagementsV2.isDeleted, false),
        ),
      )
      .returning();
    return rows[0];
  }

  // ---- Sync inputs -------------------------------------------------------

  async findAssignmentsForVessel(
    vesselUuid: string,
  ): Promise<CrewAssignmentRow[]> {
    const db = getDb();
    return db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.vesselUuid, vesselUuid),
          eq(crewAssignments.isDeleted, false),
        ),
      );
  }

  /** crew_uuid -> present_rank for the given crew. */
  async findCrewRanks(crewUuids: string[]): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (crewUuids.length === 0) return map;
    const db = getDb();
    const rows = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
        presentRank: crewMembersV2.presentRank,
      })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, crewUuids));
    for (const r of rows) map.set(r.crewUuid, r.presentRank ?? null);
    return map;
  }

  async findVesselType(vesselUuid: string): Promise<string | null> {
    const db = getDb();
    const rows = await db
      .select({ vesselType: masterVessels.vesselType })
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, vesselUuid));
    return rows[0]?.vesselType ?? null;
  }

  async findActiveScales(): Promise<AccWageScaleV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accWageScalesV2)
      .where(
        and(
          eq(accWageScalesV2.status, "active"),
          eq(accWageScalesV2.isDeleted, false),
        ),
      );
  }
}
