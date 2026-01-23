import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewFamilyInfo, crewChildren, crewNextOfKin } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewFamilyInfo,
  CrewFamilyInfo,
  InsertCrewChild,
  CrewChild,
  InsertCrewNextOfKin,
  CrewNextOfKin,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewFamilyRepository {
  // Family Info (1:1 with crew_members_v2)
  async findFamilyInfo(crewUuid: string): Promise<CrewFamilyInfo | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewFamilyInfo)
      .where(eq(crewFamilyInfo.crewUuid, crewUuid));
    return results[0];
  }

  async upsertFamilyInfo(crewUuid: string, data: Omit<InsertCrewFamilyInfo, "crewUuid">): Promise<CrewFamilyInfo> {
    const db = getDb();
    const existing = await this.findFamilyInfo(crewUuid);

    if (existing) {
      const results = await db
        .update(crewFamilyInfo)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(crewFamilyInfo.crewUuid, crewUuid))
        .returning();
      return results[0];
    }

    const results = await db
      .insert(crewFamilyInfo)
      .values({ ...data, crewUuid })
      .returning();
    return results[0];
  }

  // Children (1:N with crew_members_v2)
  async findChildren(crewUuid: string): Promise<CrewChild[]> {
    const db = getDb();
    return db
      .select()
      .from(crewChildren)
      .where(
        and(
          eq(crewChildren.crewUuid, crewUuid),
          eq(crewChildren.isDeleted, false)
        )
      );
  }

  async findChildByUuid(childUuid: string): Promise<CrewChild | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewChildren)
      .where(
        and(
          eq(crewChildren.childUuid, childUuid),
          eq(crewChildren.isDeleted, false)
        )
      );
    return results[0];
  }

  async createChild(data: Omit<InsertCrewChild, "childUuid">): Promise<CrewChild> {
    const db = getDb();
    const results = await db
      .insert(crewChildren)
      .values({ ...data, childUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateChild(childUuid: string, data: Partial<InsertCrewChild>): Promise<CrewChild | undefined> {
    const db = getDb();
    const results = await db
      .update(crewChildren)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewChildren.childUuid, childUuid))
      .returning();
    return results[0];
  }

  async deleteChild(childUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewChildren)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewChildren.childUuid, childUuid))
      .returning();
    return results.length > 0;
  }

  async syncChildren(crewUuid: string, children: Omit<InsertCrewChild, "crewUuid" | "childUuid">[]): Promise<CrewChild[]> {
    const db = getDb();
    
    // Soft delete all existing children
    await db
      .update(crewChildren)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewChildren.crewUuid, crewUuid));

    if (children.length === 0) {
      return [];
    }

    // Insert new children
    const results = await db
      .insert(crewChildren)
      .values(children.map(child => ({ ...child, crewUuid, childUuid: uuidv4() })))
      .returning();
    return results;
  }

  // Next of Kin (1:1 with crew_members_v2)
  async findNextOfKin(crewUuid: string): Promise<CrewNextOfKin | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewNextOfKin)
      .where(eq(crewNextOfKin.crewUuid, crewUuid));
    return results[0];
  }

  async upsertNextOfKin(crewUuid: string, data: Omit<InsertCrewNextOfKin, "crewUuid">): Promise<CrewNextOfKin> {
    const db = getDb();
    const existing = await this.findNextOfKin(crewUuid);

    if (existing) {
      const results = await db
        .update(crewNextOfKin)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(crewNextOfKin.crewUuid, crewUuid))
        .returning();
      return results[0];
    }

    const results = await db
      .insert(crewNextOfKin)
      .values({ ...data, crewUuid })
      .returning();
    return results[0];
  }

  async deleteNextOfKin(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewNextOfKin)
      .where(eq(crewNextOfKin.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  // Get all family info for a crew member
  async findAllFamilyInfo(crewUuid: string): Promise<{
    familyInfo: CrewFamilyInfo | undefined;
    children: CrewChild[];
    nextOfKin: CrewNextOfKin | undefined;
  }> {
    const [familyInfo, children, nextOfKin] = await Promise.all([
      this.findFamilyInfo(crewUuid),
      this.findChildren(crewUuid),
      this.findNextOfKin(crewUuid),
    ]);
    return { familyInfo, children, nextOfKin };
  }
}

export const crewFamilyRepository = new CrewFamilyRepository();
