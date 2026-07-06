import { eq, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { accTenantConfigV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccTenantConfigV2,
  InsertAccTenantConfigV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Tenant configuration is a single-row table per tenant DB. The repository
 * exposes a `findSingle` accessor plus create/update; the service guarantees the
 * row exists (creating it with defaults on first read).
 */
export class TenantConfigRepository {
  async findSingle(): Promise<AccTenantConfigV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accTenantConfigV2)
      .where(eq(accTenantConfigV2.isDeleted, false))
      .orderBy(asc(accTenantConfigV2.id))
      .limit(1);
    return results[0];
  }

  async create(
    data: Partial<InsertAccTenantConfigV2>,
  ): Promise<AccTenantConfigV2> {
    const db = getDb();
    const results = await db
      .insert(accTenantConfigV2)
      .values({ ...data, configUuid: uuidv4() } as InsertAccTenantConfigV2)
      .returning();
    return results[0];
  }

  async update(
    configUuid: string,
    data: Partial<InsertAccTenantConfigV2>,
  ): Promise<AccTenantConfigV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accTenantConfigV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accTenantConfigV2.configUuid, configUuid))
      .returning();
    return results[0];
  }
}
