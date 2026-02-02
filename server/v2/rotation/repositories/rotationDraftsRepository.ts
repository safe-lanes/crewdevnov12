import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { 
  rotationDraftsV2, 
  rotationDraftVesselsV2, 
  rotationDraftRanksV2, 
  rotationEntriesV2,
  rotationArchiveV2 
} from "../../../../shared/v2/rotation/schema";
import type { 
  RotationDraftsV2, 
  InsertRotationDraftsV2,
  RotationDraftVesselsV2,
  InsertRotationDraftVesselsV2,
  RotationDraftRanksV2,
  InsertRotationDraftRanksV2
} from "../../../../shared/v2/rotation/schema";
import { v4 as uuidv4 } from "uuid";

export class RotationDraftsRepository {
  async findAll(filters?: { planStatus?: string }): Promise<RotationDraftsV2[]> {
    const db = getDb();
    let conditions = [eq(rotationDraftsV2.isDeleted, false)];
    
    if (filters?.planStatus) {
      conditions.push(eq(rotationDraftsV2.planStatus, filters.planStatus));
    }

    return db
      .select()
      .from(rotationDraftsV2)
      .where(and(...conditions))
      .orderBy(desc(rotationDraftsV2.createdAt));
  }

  async findByDraftUuid(draftUuid: string): Promise<RotationDraftsV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rotationDraftsV2)
      .where(
        and(
          eq(rotationDraftsV2.draftUuid, draftUuid),
          eq(rotationDraftsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: Omit<InsertRotationDraftsV2, "draftUuid" | "draftId">): Promise<RotationDraftsV2> {
    const db = getDb();
    const results = await db
      .insert(rotationDraftsV2)
      .values({
        ...data,
        draftUuid: uuidv4(),
        draftId: `DRAFT-${Date.now()}`,
      })
      .returning();
    return results[0];
  }

  async update(draftUuid: string, data: Partial<InsertRotationDraftsV2>): Promise<RotationDraftsV2> {
    const db = getDb();
    const results = await db
      .update(rotationDraftsV2)
      .set({
        ...data,
        updatedAt: new Date(),
        lastEdited: new Date().toISOString(),
      })
      .where(eq(rotationDraftsV2.draftUuid, draftUuid))
      .returning();
    return results[0];
  }

  async softDelete(draftUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(rotationDraftsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(rotationDraftsV2.draftUuid, draftUuid));
  }
}

export class RotationDraftVesselsRepository {
  async findByDraftUuid(draftUuid: string): Promise<RotationDraftVesselsV2[]> {
    const db = getDb();
    return db
      .select()
      .from(rotationDraftVesselsV2)
      .where(
        and(
          eq(rotationDraftVesselsV2.draftUuid, draftUuid),
          eq(rotationDraftVesselsV2.isDeleted, false)
        )
      )
      .orderBy(rotationDraftVesselsV2.sortOrder);
  }

  async create(data: Omit<InsertRotationDraftVesselsV2, "rvUuid">): Promise<RotationDraftVesselsV2> {
    const db = getDb();
    const results = await db
      .insert(rotationDraftVesselsV2)
      .values({
        ...data,
        rvUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDelete(rvUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(rotationDraftVesselsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(rotationDraftVesselsV2.rvUuid, rvUuid));
  }
}

export class RotationDraftRanksRepository {
  async findByDraftUuid(draftUuid: string): Promise<RotationDraftRanksV2[]> {
    const db = getDb();
    return db
      .select()
      .from(rotationDraftRanksV2)
      .where(
        and(
          eq(rotationDraftRanksV2.draftUuid, draftUuid),
          eq(rotationDraftRanksV2.isDeleted, false)
        )
      )
      .orderBy(rotationDraftRanksV2.sortOrder);
  }

  async create(data: Omit<InsertRotationDraftRanksV2, "rrUuid">): Promise<RotationDraftRanksV2> {
    const db = getDb();
    const results = await db
      .insert(rotationDraftRanksV2)
      .values({
        ...data,
        rrUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDelete(rrUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(rotationDraftRanksV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(rotationDraftRanksV2.rrUuid, rrUuid));
  }

  async hardDeleteByDraftUuid(draftUuid: string): Promise<void> {
    const db = getDb();
    await db
      .delete(rotationDraftRanksV2)
      .where(eq(rotationDraftRanksV2.draftUuid, draftUuid));
  }
}

export const rotationDraftsRepository = new RotationDraftsRepository();
export const rotationDraftVesselsRepository = new RotationDraftVesselsRepository();
export const rotationDraftRanksRepository = new RotationDraftRanksRepository();
