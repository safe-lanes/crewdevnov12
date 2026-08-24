import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admFormVersionsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmFormVersionV2, InsertAdmFormVersionV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class FormVersionsRepository {
  async findByFormId(formId: number, rankGroupId?: number): Promise<AdmFormVersionV2[]> {
    const db = getDb();
    const conditions = [
      eq(admFormVersionsV2.formId, formId),
      eq(admFormVersionsV2.isDeleted, false),
    ];
    if (rankGroupId !== undefined) {
      conditions.push(eq(admFormVersionsV2.rankGroupId, rankGroupId));
    }
    return db
      .select()
      .from(admFormVersionsV2)
      .where(and(...conditions))
      .orderBy(desc(admFormVersionsV2.createdAt));
  }

  async findById(id: number): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(and(eq(admFormVersionsV2.id, id), eq(admFormVersionsV2.isDeleted, false)));
    return results[0];
  }

  // Pinned appraisals must always be able to render their saved version,
  // even if that version was later soft-deleted in the Form Editor.
  async findByIdIncludingDeleted(id: number): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(eq(admFormVersionsV2.id, id));
    return results[0];
  }

  async findByUuid(fvUuid: string): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(and(eq(admFormVersionsV2.fvUuid, fvUuid), eq(admFormVersionsV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmFormVersionV2, "fvUuid">, executor: any = getDb()): Promise<AdmFormVersionV2> {
    const results = await executor
      .insert(admFormVersionsV2)
      .values({ ...data, fvUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmFormVersionV2>): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.id, id), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async update(fvUuid: string, data: Partial<InsertAdmFormVersionV2>): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.fvUuid, fvUuid), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.id, id), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async findDraftByRankGroupId(rankGroupId: number): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.rankGroupId, rankGroupId),
        eq(admFormVersionsV2.status, 'draft'),
        eq(admFormVersionsV2.isDeleted, false),
      ))
      .orderBy(desc(admFormVersionsV2.createdAt))
      .limit(1);
    return results[0];
  }

  async findLatestReleasedByRankGroupId(rankGroupId: number): Promise<AdmFormVersionV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admFormVersionsV2)
      .where(and(
        eq(admFormVersionsV2.rankGroupId, rankGroupId),
        eq(admFormVersionsV2.status, 'released'),
        eq(admFormVersionsV2.isDeleted, false),
      ));
    if (results.length === 0) return undefined;
    return results.reduce((latest, v) => {
      const vNo = parseInt(v.versionNo, 10);
      const latestNo = parseInt(latest.versionNo, 10);
      const vNumValid = !isNaN(vNo);
      const latestNumValid = !isNaN(latestNo);
      if (vNumValid && latestNumValid) {
        if (vNo !== latestNo) return vNo > latestNo ? v : latest;
      } else if (vNumValid) {
        return v;
      } else if (!latestNumValid) {
        // both invalid — fall through to releasedAt comparison
      }
      const vReleasedAt = v.releasedAt ? new Date(v.releasedAt).getTime() : 0;
      const latestReleasedAt = latest.releasedAt ? new Date(latest.releasedAt).getTime() : 0;
      return vReleasedAt > latestReleasedAt ? v : latest;
    }, results[0]);
  }

  async softDelete(fvUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admFormVersionsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admFormVersionsV2.fvUuid, fvUuid), eq(admFormVersionsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
