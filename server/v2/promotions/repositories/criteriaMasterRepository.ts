import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { promoCriteriaMasterV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoCriteriaMasterV2 } from "../../../../shared/v2/promotions/types";

export class CriteriaMasterRepository {
  async findAll(): Promise<PromoCriteriaMasterV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoCriteriaMasterV2)
      .where(eq(promoCriteriaMasterV2.isDeleted, false))
      .orderBy(promoCriteriaMasterV2.sortOrder);
  }

  async findByCode(code: string): Promise<PromoCriteriaMasterV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(promoCriteriaMasterV2)
      .where(and(eq(promoCriteriaMasterV2.criteriaCode, code), eq(promoCriteriaMasterV2.isDeleted, false)));
    return results[0];
  }
}
