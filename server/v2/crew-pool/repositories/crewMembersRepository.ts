import { eq, and, isNull, desc, like, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import type { InsertCrewMemberV2, CrewMemberV2 } from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewMembersRepository {
  async findAll(filters?: { status?: string; isActive?: boolean; search?: string }): Promise<CrewMemberV2[]> {
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
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          like(crewMembersV2.firstName, searchTerm),
          like(crewMembersV2.familyName, searchTerm),
          like(crewMembersV2.empNo, searchTerm)
        )!
      );
    }

    return db
      .select()
      .from(crewMembersV2)
      .where(and(...conditions))
      .orderBy(desc(crewMembersV2.createdAt));
  }

  async findById(id: number): Promise<CrewMemberV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewMembersV2)
      .where(
        and(
          eq(crewMembersV2.id, id),
          eq(crewMembersV2.isDeleted, false)
        )
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
        and(
          eq(crewMembersV2.empNo, empNo),
          eq(crewMembersV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: Omit<InsertCrewMemberV2, "crewUuid">): Promise<CrewMemberV2> {
    const db = getDb();
    const results = await db
      .insert(crewMembersV2)
      .values({ ...data, crewUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(crewUuid: string, data: Partial<InsertCrewMemberV2>): Promise<CrewMemberV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertCrewMemberV2>): Promise<CrewMemberV2 | undefined> {
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
      .set({ archivedAt: new Date(), isActive: false, isDeleted: true, updatedAt: new Date() })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({ archivedAt: new Date(), isActive: false, isDeleted: true, updatedAt: new Date() })
      .where(eq(crewMembersV2.id, id))
      .returning();
    return results.length > 0;
  }

  async archive(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  async restore(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewMembersV2)
      .set({ archivedAt: null, isActive: true, isDeleted: false, updatedAt: new Date() })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  async getNextEmpNo(): Promise<string> {
    const db = getDb();
    const result = await db
      .select({ maxEmpNo: sql<string>`MAX(emp_no)` })
      .from(crewMembersV2);
    
    const maxEmpNo = result[0]?.maxEmpNo;
    if (!maxEmpNo) {
      return "EMP-0001";
    }
    
    const numPart = parseInt(maxEmpNo.replace("EMP-", ""), 10);
    return `EMP-${String(numPart + 1).padStart(4, "0")}`;
  }
}

export const crewMembersRepository = new CrewMembersRepository();
