import { eq, and, asc, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewFamilyInfo,
  crewChildren,
  crewNextOfKin,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewFamilyInfo,
  InsertCrewFamilyInfo,
  CrewChild,
  InsertCrewChild,
  CrewNextOfKin,
  InsertCrewNextOfKin,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewFamilyRepository {
  // ============ Family Info (1:1) ============
  async findFamilyInfoByCrewUuid(
    crewUuid: string
  ): Promise<CrewFamilyInfo | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewFamilyInfo)
      .where(
        and(
          eq(crewFamilyInfo.crewUuid, crewUuid),
          eq(crewFamilyInfo.isDeleted, false)
        )
      );
    return results[0];
  }

  async createFamilyInfo(
    data: Omit<InsertCrewFamilyInfo, "famUuid">
  ): Promise<CrewFamilyInfo> {
    const db = getDb();
    const results = await db
      .insert(crewFamilyInfo)
      .values({
        ...data,
        famUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateFamilyInfo(
    crewUuid: string,
    data: Partial<InsertCrewFamilyInfo>
  ): Promise<CrewFamilyInfo | undefined> {
    const db = getDb();
    const results = await db
      .update(crewFamilyInfo)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewFamilyInfo.crewUuid, crewUuid))
      .returning();
    return results[0];
  }

  async upsertFamilyInfo(
    crewUuid: string,
    data: Omit<InsertCrewFamilyInfo, "famUuid" | "crewUuid">
  ): Promise<CrewFamilyInfo> {
    const existing = await this.findFamilyInfoByCrewUuid(crewUuid);
    if (existing) {
      const updated = await this.updateFamilyInfo(crewUuid, data);
      return updated!;
    }
    return this.createFamilyInfo({ ...data, crewUuid });
  }

  // ============ Children (1:N) ============
  async findChildrenByCrewUuid(crewUuid: string): Promise<CrewChild[]> {
    const db = getDb();
    return db
      .select()
      .from(crewChildren)
      .where(
        and(
          eq(crewChildren.crewUuid, crewUuid),
          eq(crewChildren.isDeleted, false)
        )
      )
      .orderBy(asc(crewChildren.sortOrder), asc(crewChildren.createdAt));
  }

  async createChild(
    data: Omit<InsertCrewChild, "childUuid">
  ): Promise<CrewChild> {
    const db = getDb();
    const results = await db
      .insert(crewChildren)
      .values({
        ...data,
        childUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateChild(
    childUuid: string,
    data: Partial<InsertCrewChild>
  ): Promise<CrewChild | undefined> {
    const db = getDb();
    const results = await db
      .update(crewChildren)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewChildren.childUuid, childUuid))
      .returning();
    return results[0];
  }

  async softDeleteChild(childUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewChildren)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewChildren.childUuid, childUuid))
      .returning();
    return results.length > 0;
  }

  async syncChildren(
    crewUuid: string,
    children: Omit<InsertCrewChild, "childUuid" | "crewUuid">[]
  ): Promise<CrewChild[]> {
    const db = getDb();
    // Soft delete existing children
    await db
      .update(crewChildren)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewChildren.crewUuid, crewUuid));

    // Insert new children
    if (children.length === 0) return [];

    const results = await db
      .insert(crewChildren)
      .values(
        children.map((child, index) => ({
          ...child,
          crewUuid,
          childUuid: uuidv4(),
          sortOrder: index,
        }))
      )
      .returning();
    return results;
  }

  // ============ Next of Kin (1:1) ============
  async findNextOfKinByCrewUuid(
    crewUuid: string
  ): Promise<CrewNextOfKin | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewNextOfKin)
      .where(
        and(
          eq(crewNextOfKin.crewUuid, crewUuid),
          eq(crewNextOfKin.isDeleted, false)
        )
      );
    return results[0];
  }

  async createNextOfKin(
    data: Omit<InsertCrewNextOfKin, "nokUuid">
  ): Promise<CrewNextOfKin> {
    const db = getDb();
    const results = await db
      .insert(crewNextOfKin)
      .values({
        ...data,
        nokUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateNextOfKin(
    crewUuid: string,
    data: Partial<InsertCrewNextOfKin>
  ): Promise<CrewNextOfKin | undefined> {
    const db = getDb();
    const results = await db
      .update(crewNextOfKin)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewNextOfKin.crewUuid, crewUuid))
      .returning();
    return results[0];
  }

  async upsertNextOfKin(
    crewUuid: string,
    data: Omit<InsertCrewNextOfKin, "nokUuid" | "crewUuid">
  ): Promise<CrewNextOfKin> {
    const existing = await this.findNextOfKinByCrewUuid(crewUuid);
    if (existing) {
      const updated = await this.updateNextOfKin(crewUuid, data);
      return updated!;
    }
    return this.createNextOfKin({ ...data, crewUuid });
  }

  // ============ Combined Family Data ============
  async findFullFamilyByCrewUuid(crewUuid: string) {
    const [familyInfo, children, nextOfKin] = await Promise.all([
      this.findFamilyInfoByCrewUuid(crewUuid),
      this.findChildrenByCrewUuid(crewUuid),
      this.findNextOfKinByCrewUuid(crewUuid),
    ]);
    return { familyInfo, children, nextOfKin };
  }
}
