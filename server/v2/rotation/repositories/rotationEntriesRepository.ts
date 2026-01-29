import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rotationEntriesV2, rotationArchiveV2 } from "../../../../shared/v2/rotation/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import type { 
  RotationEntriesV2, 
  InsertRotationEntriesV2,
  RotationArchiveV2,
  InsertRotationArchiveV2
} from "../../../../shared/v2/rotation/schema";
import { v4 as uuidv4 } from "uuid";

export class RotationEntriesRepository {
  async findByDraftUuid(draftUuid: string): Promise<any[]> {
    const db = getDb();
    const results = await db
      .select({
        entry: rotationEntriesV2,
        crewFirstName: crewMembersV2.firstName,
        crewFamilyName: crewMembersV2.familyName,
        crewEmpNo: crewMembersV2.empNo,
      })
      .from(rotationEntriesV2)
      .leftJoin(crewMembersV2, eq(rotationEntriesV2.crewUuid, crewMembersV2.crewUuid))
      .where(
        and(
          eq(rotationEntriesV2.draftUuid, draftUuid),
          eq(rotationEntriesV2.isDeleted, false)
        )
      )
      .orderBy(desc(rotationEntriesV2.createdAt));

    return results.map((row: { entry: any; crewFirstName: string | null; crewFamilyName: string | null; crewEmpNo: string | null }) => ({
      ...row.entry,
      crewName: row.crewFirstName && row.crewFamilyName 
        ? `${row.crewFirstName} ${row.crewFamilyName}`
        : null,
      crewEmpNo: row.crewEmpNo,
    }));
  }

  async findByEntryUuid(entryUuid: string): Promise<RotationEntriesV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rotationEntriesV2)
      .where(
        and(
          eq(rotationEntriesV2.entryUuid, entryUuid),
          eq(rotationEntriesV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByVesselAndRank(vesselUuid: string, rank: string, draftUuid: string): Promise<RotationEntriesV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rotationEntriesV2)
      .where(
        and(
          eq(rotationEntriesV2.vesselUuid, vesselUuid),
          eq(rotationEntriesV2.rank, rank),
          eq(rotationEntriesV2.draftUuid, draftUuid),
          eq(rotationEntriesV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: Omit<InsertRotationEntriesV2, "entryUuid">): Promise<RotationEntriesV2> {
    const db = getDb();
    const results = await db
      .insert(rotationEntriesV2)
      .values({
        ...data,
        entryUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(entryUuid: string, data: Partial<InsertRotationEntriesV2>): Promise<RotationEntriesV2> {
    const db = getDb();
    const results = await db
      .update(rotationEntriesV2)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(rotationEntriesV2.entryUuid, entryUuid))
      .returning();
    return results[0];
  }

  async softDelete(entryUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(rotationEntriesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(rotationEntriesV2.entryUuid, entryUuid));
  }
}

export class RotationArchiveRepository {
  async findAll(filters?: { result?: string; vesselUuid?: string }): Promise<RotationArchiveV2[]> {
    const db = getDb();
    let conditions = [eq(rotationArchiveV2.isDeleted, false)];
    
    if (filters?.result) {
      conditions.push(eq(rotationArchiveV2.result, filters.result));
    }
    if (filters?.vesselUuid) {
      conditions.push(eq(rotationArchiveV2.vesselUuid, filters.vesselUuid));
    }

    return db
      .select()
      .from(rotationArchiveV2)
      .where(and(...conditions))
      .orderBy(desc(rotationArchiveV2.archivedDate));
  }

  async create(data: Omit<InsertRotationArchiveV2, "archiveUuid">): Promise<RotationArchiveV2> {
    const db = getDb();
    const results = await db
      .insert(rotationArchiveV2)
      .values({
        ...data,
        archiveUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }
}

export const rotationEntriesRepository = new RotationEntriesRepository();
export const rotationArchiveRepository = new RotationArchiveRepository();
