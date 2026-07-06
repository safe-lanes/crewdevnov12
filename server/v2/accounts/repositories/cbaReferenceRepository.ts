import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { accCbaReferenceV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccCbaReferenceV2,
  InsertAccCbaReferenceV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class CbaReferenceRepository {
  async findAll(): Promise<AccCbaReferenceV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accCbaReferenceV2)
      .where(eq(accCbaReferenceV2.isDeleted, false))
      .orderBy(asc(accCbaReferenceV2.sortOrder), asc(accCbaReferenceV2.cbaName));
  }

  async findByUuid(
    cbaRefUuid: string,
  ): Promise<AccCbaReferenceV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accCbaReferenceV2)
      .where(
        and(
          eq(accCbaReferenceV2.cbaRefUuid, cbaRefUuid),
          eq(accCbaReferenceV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccCbaReferenceV2, "cbaRefUuid">,
  ): Promise<AccCbaReferenceV2> {
    const db = getDb();
    const results = await db
      .insert(accCbaReferenceV2)
      .values({ ...data, cbaRefUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(
    cbaRefUuid: string,
    data: Partial<InsertAccCbaReferenceV2>,
  ): Promise<AccCbaReferenceV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accCbaReferenceV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accCbaReferenceV2.cbaRefUuid, cbaRefUuid))
      .returning();
    return results[0];
  }

  async softDelete(cbaRefUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accCbaReferenceV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accCbaReferenceV2.cbaRefUuid, cbaRefUuid))
      .returning();
    return results.length > 0;
  }
}
