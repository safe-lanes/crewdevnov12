import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { accContractPayElementsV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccContractPayElementV2,
  InsertAccContractPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class ContractPayElementsRepository {
  async findByContract(
    contractUuid: string,
  ): Promise<AccContractPayElementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(accContractPayElementsV2)
      .where(
        and(
          eq(accContractPayElementsV2.contractUuid, contractUuid),
          eq(accContractPayElementsV2.isDeleted, false),
        ),
      )
      .orderBy(asc(accContractPayElementsV2.sortOrder));
  }

  async findByUuid(
    contractPayElementUuid: string,
  ): Promise<AccContractPayElementV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accContractPayElementsV2)
      .where(
        and(
          eq(
            accContractPayElementsV2.contractPayElementUuid,
            contractPayElementUuid,
          ),
          eq(accContractPayElementsV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async create(
    data: Omit<InsertAccContractPayElementV2, "contractPayElementUuid">,
  ): Promise<AccContractPayElementV2> {
    const db = getDb();
    const results = await db
      .insert(accContractPayElementsV2)
      .values({ ...data, contractPayElementUuid: uuidv4() })
      .returning();
    return results[0];
  }

  /**
   * Insert an inherited element, ignoring the unique (contract_uuid,
   * pay_element_uuid) guard so concurrent inheritance syncs cannot create
   * duplicates.
   */
  async createInheritedIfAbsent(
    data: Omit<InsertAccContractPayElementV2, "contractPayElementUuid">,
  ): Promise<void> {
    const db = getDb();
    await db
      .insert(accContractPayElementsV2)
      .values({ ...data, contractPayElementUuid: uuidv4() })
      .onConflictDoNothing();
  }

  async update(
    contractPayElementUuid: string,
    data: Partial<InsertAccContractPayElementV2>,
  ): Promise<AccContractPayElementV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accContractPayElementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(
        eq(
          accContractPayElementsV2.contractPayElementUuid,
          contractPayElementUuid,
        ),
      )
      .returning();
    return results[0];
  }

  async softDelete(contractPayElementUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accContractPayElementsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        eq(
          accContractPayElementsV2.contractPayElementUuid,
          contractPayElementUuid,
        ),
      )
      .returning();
    return results.length > 0;
  }
}
