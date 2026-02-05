import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhVariableTasksV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhVariableTaskV2,
  InsertRhVariableTaskV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";

export class VariableTasksRepository {
  async findAll(filters?: {
    vesselId?: string;
    periodValue?: string;
    isDraft?: boolean;
  }): Promise<RhVariableTaskV2[]> {
    const db = getDb();
    let conditions = [eq(rhVariableTasksV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhVariableTasksV2.vesselId, filters.vesselId));
    }
    if (filters?.periodValue) {
      conditions.push(eq(rhVariableTasksV2.periodValue, filters.periodValue));
    }
    if (filters?.isDraft !== undefined) {
      conditions.push(eq(rhVariableTasksV2.isDraft, filters.isDraft));
    }

    const results = await db
      .select()
      .from(rhVariableTasksV2)
      .where(and(...conditions))
      .orderBy(desc(rhVariableTasksV2.createdAt));

    return results;
  }

  async findByUuid(variableTaskUuid: string): Promise<RhVariableTaskV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhVariableTasksV2)
      .where(
        and(
          eq(rhVariableTasksV2.variableTaskUuid, variableTaskUuid),
          eq(rhVariableTasksV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhVariableTaskV2, "variableTaskUuid">
  ): Promise<RhVariableTaskV2> {
    const db = getDb();
    const results = await db
      .insert(rhVariableTasksV2)
      .values({
        ...data,
        variableTaskUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    variableTaskUuid: string,
    data: Partial<InsertRhVariableTaskV2>
  ): Promise<RhVariableTaskV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhVariableTasksV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhVariableTasksV2.variableTaskUuid, variableTaskUuid))
      .returning();
    return results[0];
  }

  async softDelete(variableTaskUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhVariableTasksV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhVariableTasksV2.variableTaskUuid, variableTaskUuid))
      .returning();
    return results.length > 0;
  }
}
