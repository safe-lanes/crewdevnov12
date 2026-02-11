import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admFormsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmFormV2, InsertAdmFormV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class FormsRepository {
  async findAll(): Promise<AdmFormV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admFormsV2)
      .where(eq(admFormsV2.isDeleted, false))
      .orderBy(desc(admFormsV2.createdAt));
  }

  async findByUuid(formUuid: string): Promise<AdmFormV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormsV2)
      .where(and(eq(admFormsV2.formUuid, formUuid), eq(admFormsV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmFormV2, "formUuid">): Promise<AdmFormV2> {
    const db = getDb();
    const results = await db
      .insert(admFormsV2)
      .values({ ...data, formUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(formUuid: string, data: Partial<InsertAdmFormV2>): Promise<AdmFormV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admFormsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admFormsV2.formUuid, formUuid), eq(admFormsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDelete(formUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admFormsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admFormsV2.formUuid, formUuid), eq(admFormsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
