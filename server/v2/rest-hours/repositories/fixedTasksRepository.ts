import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhFixedTasksV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhFixedTaskV2,
  InsertRhFixedTaskV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";

export class FixedTasksRepository {
  async findAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthYear?: string;
  }): Promise<RhFixedTaskV2[]> {
    const db = getDb();
    let conditions = [eq(rhFixedTasksV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhFixedTasksV2.vesselId, filters.vesselId));
    }
    if (filters?.crewMemberId) {
      conditions.push(eq(rhFixedTasksV2.crewMemberId, filters.crewMemberId));
    }
    if (filters?.monthYear) {
      conditions.push(eq(rhFixedTasksV2.monthYear, filters.monthYear));
    }

    const results = await db
      .select()
      .from(rhFixedTasksV2)
      .where(and(...conditions))
      .orderBy(desc(rhFixedTasksV2.createdAt));

    return results;
  }

  async findByUuid(fixedTaskUuid: string): Promise<RhFixedTaskV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhFixedTasksV2)
      .where(
        and(
          eq(rhFixedTasksV2.fixedTaskUuid, fixedTaskUuid),
          eq(rhFixedTasksV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RhFixedTaskV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhFixedTasksV2)
      .where(
        and(
          eq(rhFixedTasksV2.crewMemberId, crewMemberId),
          eq(rhFixedTasksV2.vesselId, vesselId),
          eq(rhFixedTasksV2.monthYear, monthYear),
          eq(rhFixedTasksV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhFixedTaskV2, "fixedTaskUuid">
  ): Promise<RhFixedTaskV2> {
    const db = getDb();
    const results = await db
      .insert(rhFixedTasksV2)
      .values({
        ...data,
        fixedTaskUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    fixedTaskUuid: string,
    data: Partial<InsertRhFixedTaskV2>
  ): Promise<RhFixedTaskV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhFixedTasksV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhFixedTasksV2.fixedTaskUuid, fixedTaskUuid))
      .returning();
    return results[0];
  }

  async softDelete(fixedTaskUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhFixedTasksV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhFixedTasksV2.fixedTaskUuid, fixedTaskUuid))
      .returning();
    return results.length > 0;
  }
}
