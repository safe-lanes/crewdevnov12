import { eq, and, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import {
  masterTrainingCategory,
  type MasterTrainingCategory,
} from "../../../../shared/v2/masters/schema";

export class TrainingCategoryConflictError extends Error {
  constructor(module: string, label: string) {
    super(`Category "${label}" already exists for module "${module}"`);
    this.name = "TrainingCategoryConflictError";
  }
}

export class TrainingCategoryRepository {
  async findAll(module?: string): Promise<MasterTrainingCategory[]> {
    const db = getDb();
    const conditions = [eq(masterTrainingCategory.isDeleted, false)];
    if (module) conditions.push(eq(masterTrainingCategory.module, module));
    return db
      .select()
      .from(masterTrainingCategory)
      .where(and(...conditions))
      .orderBy(asc(masterTrainingCategory.sortOrder), asc(masterTrainingCategory.label));
  }

  private async findRowAnyState(module: string, label: string): Promise<MasterTrainingCategory | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTrainingCategory)
      .where(and(eq(masterTrainingCategory.module, module), eq(masterTrainingCategory.label, label)));
    return rows[0];
  }

  private async nextSortOrder(module: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ sortOrder: masterTrainingCategory.sortOrder })
      .from(masterTrainingCategory)
      .where(eq(masterTrainingCategory.module, module));
    return rows.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), 0) + 1;
  }

  // Creates (or reactivates) one row per (module, label).
  async createForModules(
    label: string,
    modules: string[],
    auditUserUuid?: string | null,
  ): Promise<MasterTrainingCategory[]> {
    const db = getDb();
    const result: MasterTrainingCategory[] = [];
    for (const module of modules) {
      const existing = await this.findRowAnyState(module, label);
      if (existing) {
        const r = await db
          .update(masterTrainingCategory)
          .set({
            isDeleted: false,
            isActive: true,
            updatedAt: new Date(),
            updatedByUuid: auditUserUuid || null,
          })
          .where(eq(masterTrainingCategory.mtcUuid, existing.mtcUuid))
          .returning();
        result.push(r[0]);
      } else {
        const r = await db
          .insert(masterTrainingCategory)
          .values({
            mtcUuid: uuidv4(),
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
    mtcUuid: string,
    data: { label?: string; isActive?: boolean },
    auditUserUuid?: string | null,
  ): Promise<MasterTrainingCategory | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTrainingCategory)
      .where(and(eq(masterTrainingCategory.mtcUuid, mtcUuid), eq(masterTrainingCategory.isDeleted, false)));
    const existing = rows[0];
    if (!existing) return undefined;

    if (data.label !== undefined && data.label !== existing.label) {
      const clash = await this.findRowAnyState(existing.module, data.label);
      if (clash && clash.mtcUuid !== mtcUuid) {
        throw new TrainingCategoryConflictError(existing.module, data.label);
      }
    }

    const r = await db
      .update(masterTrainingCategory)
      .set({
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
        updatedByUuid: auditUserUuid || null,
      })
      .where(eq(masterTrainingCategory.mtcUuid, mtcUuid))
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
  ): Promise<MasterTrainingCategory[]> {
    const db = getDb();
    const existingRows = await db
      .select()
      .from(masterTrainingCategory)
      .where(and(eq(masterTrainingCategory.label, originalLabel), eq(masterTrainingCategory.isDeleted, false)));

    const selected = new Set(modules);
    const existingModules = new Set(existingRows.map((r) => r.module));

    // Rename validation first (all-or-nothing before mutating)
    if (label !== originalLabel) {
      for (const row of existingRows) {
        if (!selected.has(row.module)) continue;
        const clash = await this.findRowAnyState(row.module, label);
        if (clash && clash.mtcUuid !== row.mtcUuid) {
          throw new TrainingCategoryConflictError(row.module, label);
        }
      }
    }

    for (const row of existingRows) {
      if (selected.has(row.module)) {
        if (label !== originalLabel) {
          await db
            .update(masterTrainingCategory)
            .set({ label, updatedAt: new Date(), updatedByUuid: auditUserUuid || null })
            .where(eq(masterTrainingCategory.mtcUuid, row.mtcUuid));
        }
      } else {
        await db
          .update(masterTrainingCategory)
          .set({ isDeleted: true, isActive: false, updatedAt: new Date(), updatedByUuid: auditUserUuid || null })
          .where(eq(masterTrainingCategory.mtcUuid, row.mtcUuid));
      }
    }

    const newModules = modules.filter((m) => !existingModules.has(m));
    if (newModules.length > 0) {
      await this.createForModules(label, newModules, auditUserUuid);
    }

    return this.findAll();
  }

  async deleteRow(mtcUuid: string, auditUserUuid?: string | null): Promise<MasterTrainingCategory | undefined> {
    const db = getDb();
    const rows = await db
      .select()
      .from(masterTrainingCategory)
      .where(and(eq(masterTrainingCategory.mtcUuid, mtcUuid), eq(masterTrainingCategory.isDeleted, false)));
    const existing = rows[0];
    if (!existing) return undefined;

    const r = await db
      .update(masterTrainingCategory)
      .set({
        isDeleted: true,
        isActive: false,
        updatedAt: new Date(),
        updatedByUuid: auditUserUuid || null,
      })
      .where(eq(masterTrainingCategory.mtcUuid, mtcUuid))
      .returning();
    return r[0];
  }
}
