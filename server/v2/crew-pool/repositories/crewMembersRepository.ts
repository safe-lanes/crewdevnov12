import { eq, and, desc, like, or, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewMemberV2,
  InsertCrewMemberV2,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewMembersRepository {
  async findAll(filters?: {
    status?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<CrewMemberV2[]> {
    const db = getDb();
    let conditions = [
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
    ];

    if (filters?.status) {
      conditions.push(eq(crewMembersV2.status, filters.status));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(crewMembersV2.isActive, filters.isActive));
    }

    let query = db
      .select()
      .from(crewMembersV2)
      .where(and(...conditions))
      .orderBy(desc(crewMembersV2.createdAt));

    const results = await query;

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      return results.filter(
        (crew: CrewMemberV2) =>
          crew.firstName?.toLowerCase().includes(searchLower) ||
          crew.familyName?.toLowerCase().includes(searchLower) ||
          crew.empNo?.toLowerCase().includes(searchLower) ||
          crew.employeeId?.toLowerCase().includes(searchLower)
      );
    }

    return results;
  }

  async findById(id: number): Promise<CrewMemberV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewMembersV2)
      .where(
        and(eq(crewMembersV2.id, id), eq(crewMembersV2.isDeleted, false))
      );
    return results[0];
  }

  async findByUuid(crewUuid: string): Promise<CrewMemberV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewMembersV2)
      .where(
        and(
          eq(crewMembersV2.crewUuid, crewUuid),
          eq(crewMembersV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByEmpNo(empNo: string): Promise<CrewMemberV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewMembersV2)
      .where(
        and(eq(crewMembersV2.empNo, empNo), eq(crewMembersV2.isDeleted, false))
      );
    return results[0];
  }

  async create(
    data: Omit<InsertCrewMemberV2, "crewUuid">
  ): Promise<CrewMemberV2> {
    const db = getDb();
    const results = await db
      .insert(crewMembersV2)
      .values({
        ...data,
        crewUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    crewUuid: string,
    data: Partial<InsertCrewMemberV2>
  ): Promise<CrewMemberV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results[0];
  }

  async updateById(
    id: number,
    data: Partial<InsertCrewMemberV2>
  ): Promise<CrewMemberV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewMembersV2.id, id))
      .returning();
    return results[0];
  }

  async softDelete(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({
        isDeleted: true,
        archivedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({
        isDeleted: true,
        archivedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(crewMembersV2.id, id))
      .returning();
    return results.length > 0;
  }

  async archive(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({
        archivedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  async unarchive(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({
        archivedAt: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }
}
