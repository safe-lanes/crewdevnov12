import { eq, and, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  masterTrainingStatus,
  type MasterTrainingStatus,
} from "../../../../shared/v2/masters/schema";

export class TrainingStatusConflictError extends Error {
  constructor(module: string, label: string) {
    super(`Status "${label}" already exists for module "${module}"`);
    this.name = "TrainingStatusConflictError";
  }
}

export class TrainingStatusRepository {
  async findAll(module?: string): Promise<MasterTrainingStatus[]> {
    const db = getDb();
    const conditions = [eq(masterTrainingStatus.isDeleted, false)];
    if (module) conditions.push(eq(masterTrainingStatus.module, module));
    return db
      .select()
      .from(masterTrainingStatus)
      .where(and(...conditions))
      .orderBy(asc(masterTrainingStatus.sortOrder), asc(masterTrainingStatus.label));
  }

  private async findRowAnyState(module: string, label: string): Promise<MasterTrainingStatus | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTrainingStatus)
      .where(and(eq(masterTrainingStatus.module, module), eq(masterTrainingStatus.label, label)));
    return rows[0];
  }

  private async nextSortOrder(module: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ sortOrder: masterTrainingStatus.sortOrder })
      .from(masterTrainingStatus)
      .where(eq(masterTrainingStatus.module, module));
    return rows.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), 0) + 1;
  }

  // Creates (or reactivates) one row per (module, label).
  async createForModules(
    label: string,
    modules: string[],
    auditUserUuid?: string | null,
  ): Promise<MasterTrainingStatus[]> {
    const db = getDb();
    const result: MasterTrainingStatus[] = [];
    for (const module of modules) {
      const existing = await this.findRowAnyState(module, label);
      if (existing) {
        const r = await db
          .update(masterTrainingStatus)
          .set({
            isDeleted: false,
            isActive: true,
            updatedAt: new Date(),
            updatedByUuid: auditUserUuid || null,
          })
          .where(eq(masterTrainingStatus.mtsUuid, existing.mtsUuid))
          .returning();
        result.push(r[0]);
      } else {
        const r = await db
          .insert(masterTrainingStatus)
          .values({
            mtsUuid: uuidv4(),
            label,
            module,
            isActive: true,
            sortOrder: await this.nextSortOrder(module),
            createdByUuid: auditUserUuid || null,
            updatedByUuid: auditUserUuid || null,
          })
          .returning();
        result.push(r[0]);
      }
    }
    return result;
  }

  async updateRow(
    mtsUuid: string,
    data: { label?: string; isActive?: boolean },
    auditUserUuid?: string | null,
  ): Promise<MasterTrainingStatus | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTrainingStatus)
      .where(and(eq(masterTrainingStatus.mtsUuid, mtsUuid), eq(masterTrainingStatus.isDeleted, false)));
    const existing = rows[0];
    if (!existing) return undefined;

    if (data.label !== undefined && data.label !== existing.label) {
      const clash = await this.findRowAnyState(existing.module, data.label);
      if (clash && clash.mtsUuid !== mtsUuid) {
        throw new TrainingStatusConflictError(existing.module, data.label);
      }
    }

    const r = await db
      .update(masterTrainingStatus)
      .set({
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
        updatedByUuid: auditUserUuid || null,
      })
      .where(eq(masterTrainingStatus.mtsUuid, mtsUuid))
      .returning();
    return r[0];
  }

  // Edits a status "group" (all rows sharing originalLabel): renames rows in
  // selected modules, soft-deletes rows in deselected modules, and creates
  // rows for newly selected modules.
  async groupUpdate(
    originalLabel: string,
    label: string,
    modules: string[],
    auditUserUuid?: string | null,
  ): Promise<MasterTrainingStatus[]> {
    const db = getDb();
    const existingRows = await db
      .select()
      .from(masterTrainingStatus)
      .where(and(eq(masterTrainingStatus.label, originalLabel), eq(masterTrainingStatus.isDeleted, false)));

    const selected = new Set(modules);
    const existingModules = new Set(existingRows.map((r) => r.module));

    // Rename validation first (all-or-nothing before mutating)
    if (label !== originalLabel) {
      for (const row of existingRows) {
        if (!selected.has(row.module)) continue;
        const clash = await this.findRowAnyState(row.module, label);
        if (clash && clash.mtsUuid !== row.mtsUuid) {
          throw new TrainingStatusConflictError(row.module, label);
        }
      }
    }

    for (const row of existingRows) {
      if (selected.has(row.module)) {
        if (label !== originalLabel) {
          await db
            .update(masterTrainingStatus)
            .set({ label, updatedAt: new Date(), updatedByUuid: auditUserUuid || null })
            .where(eq(masterTrainingStatus.mtsUuid, row.mtsUuid));
        }
      } else {
        await db
          .update(masterTrainingStatus)
          .set({ isDeleted: true, isActive: false, updatedAt: new Date(), updatedByUuid: auditUserUuid || null })
          .where(eq(masterTrainingStatus.mtsUuid, row.mtsUuid));
      }
    }

    const newModules = modules.filter((m) => !existingModules.has(m));
    if (newModules.length > 0) {
      await this.createForModules(label, newModules, auditUserUuid);
    }

    return this.findAll();
  }

  async deleteRow(mtsUuid: string, auditUserUuid?: string | null): Promise<MasterTrainingStatus | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTrainingStatus)
      .where(and(eq(masterTrainingStatus.mtsUuid, mtsUuid), eq(masterTrainingStatus.isDeleted, false)));
    const existing = rows[0];
    if (!existing) return undefined;

    const r = await db
      .update(masterTrainingStatus)
      .set({
        isDeleted: true,
        isActive: false,
        updatedAt: new Date(),
        updatedByUuid: auditUserUuid || null,
      })
      .where(eq(masterTrainingStatus.mtsUuid, mtsUuid))
      .returning();
    return r[0];
  }
}
