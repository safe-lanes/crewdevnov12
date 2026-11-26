import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhVariableTasksV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhVariableTaskV2,
  InsertRhVariableTaskV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";
import { capturedInsert, capturedUpdate } from "../../sync/capturedWrite";

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
    data: Omit<InsertRhVariableTaskV2, "variableTaskUuid">, tx?: any
  ): Promise<RhVariableTaskV2> {
    return capturedInsert<RhVariableTaskV2>(tx, rhVariableTasksV2, "variableTaskUuid", {
      ...data,
      variableTaskUuid: uuidv4(),
    });
  }

  async update(
    variableTaskUuid: string,
    data: Partial<InsertRhVariableTaskV2>, tx?: any
  ): Promise<RhVariableTaskV2 | undefined> {
    return capturedUpdate<RhVariableTaskV2>(
      tx, rhVariableTasksV2, "variableTaskUuid", variableTaskUuid, { ...data, updatedAt: new Date() });
  }

  async softDelete(variableTaskUuid: string, tx?: any): Promise<boolean> {
    const row = await capturedUpdate(
      tx, rhVariableTasksV2, "variableTaskUuid", variableTaskUuid, { isDeleted: true, updatedAt: new Date() });
    return !!row;
  }
}
