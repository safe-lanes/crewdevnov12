import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { accContractsV2 } from "../../../../shared/v2/accounts/schema";
import type {
  AccContractV2,
  InsertAccContractV2,
} from "../../../../shared/v2/accounts/types";
import { v4 as uuidv4 } from "uuid";

export class ContractsRepository {
  async findAll(filters?: {
    crewUuid?: string;
    vesselGroup?: string;
    status?: string;
  }): Promise<AccContractV2[]> {
    const db = getDb();
    const conditions = [eq(accContractsV2.isDeleted, false)];
    if (filters?.crewUuid) {
      conditions.push(eq(accContractsV2.crewUuid, filters.crewUuid));
    }
    if (filters?.vesselGroup) {
      conditions.push(eq(accContractsV2.vesselGroup, filters.vesselGroup));
    }
    if (filters?.status) {
      conditions.push(eq(accContractsV2.status, filters.status));
    }
    return db
      .select()
      .from(accContractsV2)
      .where(and(...conditions))
      .orderBy(desc(accContractsV2.createdAt));
  }

  async findByUuid(contractUuid: string): Promise<AccContractV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accContractsV2)
      .where(
        and(
          eq(accContractsV2.contractUuid, contractUuid),
          eq(accContractsV2.isDeleted, false),
        ),
      );
    return results[0];
  }

  async findByCrewAndGroup(
    crewUuid: string,
    vesselGroup: string,
  ): Promise<AccContractV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(accContractsV2)
      .where(
        and(
          eq(accContractsV2.crewUuid, crewUuid),
          eq(accContractsV2.vesselGroup, vesselGroup),
          eq(accContractsV2.isDeleted, false),
        ),
      )
      .orderBy(desc(accContractsV2.createdAt));
    return results[0];
  }

  async create(
    data: Omit<InsertAccContractV2, "contractUuid">,
  ): Promise<AccContractV2 | undefined> {
    const db = getDb();
    // Tolerate the unique (crew_uuid, vessel_group) guard under concurrent
    // find-or-create: a losing insert returns no row (caller refetches).
    const results = await db
      .insert(accContractsV2)
      .values({ ...data, contractUuid: uuidv4() })
      .onConflictDoNothing()
      .returning();
    return results[0];
  }

  async update(
    contractUuid: string,
    data: Partial<InsertAccContractV2>,
  ): Promise<AccContractV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(accContractsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accContractsV2.contractUuid, contractUuid))
      .returning();
    return results[0];
  }

  async softDelete(contractUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(accContractsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(accContractsV2.contractUuid, contractUuid))
      .returning();
    return results.length > 0;
  }
}
