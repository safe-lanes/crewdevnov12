import { eq, and, desc, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { admFormsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmFormV2, InsertAdmFormV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class FormsRepository {
  async findAll(includeArchivedCompanyForms = true): Promise<AdmFormV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admFormsV2)
      .where(and(
        eq(admFormsV2.isDeleted, false),
        includeArchivedCompanyForms
          ? undefined
          : or(sql`${admFormsV2.category} <> 'dynamic'`, isNull(admFormsV2.archivedAt)),
      ))
      .orderBy(desc(admFormsV2.createdAt));
  }

  async findById(id: number, executor: any = getDb()): Promise<AdmFormV2 | undefined> {
    const results = await executor
      .select()
      .from(admFormsV2)
      .where(and(eq(admFormsV2.id, id), eq(admFormsV2.isDeleted, false)));
    return results[0];
  }

  async lockById(id: number, executor: any): Promise<AdmFormV2 | undefined> {
    await executor.execute(sql`SELECT id FROM adm_forms_v2 WHERE id = ${id} FOR UPDATE`);
    return this.findById(id, executor);
  }

  async findByUuid(formUuid: string, executor: any = getDb()): Promise<AdmFormV2 | undefined> {
    const results = await executor
      .select()
      .from(admFormsV2)
      .where(and(eq(admFormsV2.formUuid, formUuid), eq(admFormsV2.isDeleted, false)));
    return results[0];
  }

  async findActiveDynamicNameConflict(name: string, exceptId?: number, executor: any = getDb()): Promise<AdmFormV2 | undefined> {
    const conditions = [
      eq(admFormsV2.category, "dynamic"),
      isNull(admFormsV2.archivedAt),
      sql`lower(trim(${admFormsV2.name})) = lower(trim(${name}))`,
      exceptId !== undefined ? sql`${admFormsV2.id} <> ${exceptId}` : undefined,
    ];
    return (await executor.select().from(admFormsV2).where(and(...conditions)).limit(1))[0];
  }

  async create(data: Omit<InsertAdmFormV2, "formUuid">, executor: any = getDb()): Promise<AdmFormV2> {
    const results = await executor
      .insert(admFormsV2)
      .values({ ...data, formUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmFormV2>, executor: any = getDb()): Promise<AdmFormV2 | undefined> {
    const results = await executor
      .update(admFormsV2)
      .set({ ...data, updatedAt: new Date() })
      // A provided category must match the stored category at update time,
      // including when a concurrent writer changes it after the API preflight.
      .where(and(eq(admFormsV2.id, id), eq(admFormsV2.isDeleted, false), isNull(admFormsV2.archivedAt),
        data.category !== undefined ? eq(admFormsV2.category, data.category) : undefined))
      .returning();
    return results[0];
  }

  async update(formUuid: string, data: Partial<InsertAdmFormV2>, executor: any = getDb()): Promise<AdmFormV2 | undefined> {
    const results = await executor
      .update(admFormsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admFormsV2.formUuid, formUuid), eq(admFormsV2.isDeleted, false), isNull(admFormsV2.archivedAt),
        data.category !== undefined ? eq(admFormsV2.category, data.category) : undefined))
      .returning();
    return results[0];
  }

  async archiveDynamicById(id: number, auditUserUuid: string | null = null): Promise<boolean> {
    return getDb().transaction(async (tx: any) => {
      const form = await this.lockById(id, tx);
      if (!form || form.category !== "dynamic" || form.archivedAt) return false;
      const results = await tx.update(admFormsV2)
        .set({ archivedAt: new Date(), updatedAt: new Date(), updatedByUuid: auditUserUuid })
        .where(and(
          eq(admFormsV2.id, id),
          eq(admFormsV2.category, "dynamic"),
          eq(admFormsV2.isDeleted, false),
          isNull(admFormsV2.archivedAt),
        )).returning({ id: admFormsV2.id });
      return results.length > 0;
    });
  }

  async softDeleteById(id: number, executor: any = getDb()): Promise<boolean> {
    const results = await executor
      .update(admFormsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admFormsV2.id, id), eq(admFormsV2.isDeleted, false), isNull(admFormsV2.archivedAt)))
      .returning();
    return results.length > 0;
  }

  async softDelete(formUuid: string, executor: any = getDb()): Promise<boolean> {
    const results = await executor
      .update(admFormsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admFormsV2.formUuid, formUuid), eq(admFormsV2.isDeleted, false), isNull(admFormsV2.archivedAt)))
      .returning();
    return results.length > 0;
  }
}
