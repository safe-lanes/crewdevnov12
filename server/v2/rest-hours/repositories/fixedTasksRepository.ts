import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhFixedTasksV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhFixedTaskV2,
  InsertRhFixedTaskV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";
import { capturedInsert, capturedUpdate } from "../../sync/capturedWrite";

export class FixedTasksRepository {
  private parseFixedTask(task: RhFixedTaskV2): RhFixedTaskV2 {
    return {
      ...task,
      seaHours: task.seaHours
        ? (typeof task.seaHours === 'string' ? JSON.parse(task.seaHours) : task.seaHours)
        : null,
      portHours: task.portHours
        ? (typeof task.portHours === 'string' ? JSON.parse(task.portHours) : task.portHours)
        : null,
    } as RhFixedTaskV2;
  }

  async findAll(filters?: {
    vesselId?: string;
    crewMemberId?: string;
    monthYear?: string;
  }): Promise<RhFixedTaskV2[]> {
    const db = getDb();
    let conditions = [eq(rhFixedTasksV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhFixedTasksV2.vesselId, filters.vesselId));
    }
    if (filters?.crewMemberId) {
      conditions.push(eq(rhFixedTasksV2.crewMemberId, filters.crewMemberId));
    }
    if (filters?.monthYear) {
      conditions.push(eq(rhFixedTasksV2.monthYear, filters.monthYear));
    }

    const results = await db
      .select()
      .from(rhFixedTasksV2)
      .where(and(...conditions))
      .orderBy(desc(rhFixedTasksV2.createdAt));

    return results.map((task: RhFixedTaskV2) => this.parseFixedTask(task));
  }

  async findByUuid(fixedTaskUuid: string): Promise<RhFixedTaskV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhFixedTasksV2)
      .where(
        and(
          eq(rhFixedTasksV2.fixedTaskUuid, fixedTaskUuid),
          eq(rhFixedTasksV2.isDeleted, false)
        )
      );
    return results[0] ? this.parseFixedTask(results[0]) : undefined;
  }

  async findAllByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RhFixedTaskV2[]> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhFixedTasksV2)
      .where(
        and(
          eq(rhFixedTasksV2.crewMemberId, crewMemberId),
          eq(rhFixedTasksV2.vesselId, vesselId),
          eq(rhFixedTasksV2.monthYear, monthYear),
          eq(rhFixedTasksV2.isDeleted, false)
        )
      );
    return results
      .sort((a: RhFixedTaskV2, b: RhFixedTaskV2) =>
        (a.applicableFrom ?? '').localeCompare(b.applicableFrom ?? ''))
      .map((task: RhFixedTaskV2) => this.parseFixedTask(task));
  }

  // Single "active" fixed-task row. Non-split case = byte-identical to before;
  // after a promotion split the latest unlocked rank period is preferred.
  async findByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RhFixedTaskV2 | undefined> {
    const all = await this.findAllByKey(crewMemberId, vesselId, monthYear);
    if (all.length <= 1) return all[0];
    const activeUnlocked = all.filter(t => !t.isLocked);
    const pool = activeUnlocked.length > 0 ? activeUnlocked : all;
    const fullMonth = pool.find(t => !t.applicableFrom && !t.applicableTo);
    if (fullMonth) return fullMonth;
    return pool[pool.length - 1];
  }

  async create(
    data: Omit<InsertRhFixedTaskV2, "fixedTaskUuid">, tx?: any
  ): Promise<RhFixedTaskV2> {
    const row = await capturedInsert<RhFixedTaskV2>(tx, rhFixedTasksV2, "fixedTaskUuid", {
      ...data,
      fixedTaskUuid: uuidv4(),
    });
    return this.parseFixedTask(row);
  }

  async update(
    fixedTaskUuid: string,
    data: Partial<InsertRhFixedTaskV2>, tx?: any
  ): Promise<RhFixedTaskV2 | undefined> {
    const row = await capturedUpdate<RhFixedTaskV2>(
      tx, rhFixedTasksV2, "fixedTaskUuid", fixedTaskUuid, { ...data, updatedAt: new Date() });
    return row ? this.parseFixedTask(row) : undefined;
  }

  async softDelete(fixedTaskUuid: string, tx?: any): Promise<boolean> {
    const row = await capturedUpdate(
      tx, rhFixedTasksV2, "fixedTaskUuid", fixedTaskUuid, { isDeleted: true, updatedAt: new Date() });
    return !!row;
  }
}
