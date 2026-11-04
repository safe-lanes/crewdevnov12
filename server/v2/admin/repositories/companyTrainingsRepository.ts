import { eq, and, desc, asc, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { admCompanyTrainingsV2, admTrainingMasterV2, admCompanyTrainingGroupsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmCompanyTrainingV2, InsertAdmCompanyTrainingV2 } from "../../../../shared/v2/admin/types";
import { applyAuditUser } from "../utils/auditUser";
import { companyTrainingUuid } from "../utils/companyTrainingUuid";

export class CompanyTrainingsRepository {
  async findAll(): Promise<AdmCompanyTrainingV2[]> {
    const db = getDb();
    const results = await db
      .select({
        id: admCompanyTrainingsV2.id,
        ctUuid: admCompanyTrainingsV2.ctUuid,
        trainingMasterId: admCompanyTrainingsV2.trainingMasterId,
        companyId: admCompanyTrainingsV2.companyId,
        trainingLabel: admCompanyTrainingsV2.trainingLabel,
        abr: admCompanyTrainingsV2.abr,
        requirement: admCompanyTrainingsV2.requirement,
        groupCode: admCompanyTrainingsV2.groupCode,
        sortOrder: admCompanyTrainingsV2.sortOrder,
        isDeleted: admCompanyTrainingsV2.isDeleted,
        isSync: admCompanyTrainingsV2.isSync,
        createdAt: admCompanyTrainingsV2.createdAt,
        updatedAt: admCompanyTrainingsV2.updatedAt,
        createdByUuid: admCompanyTrainingsV2.createdByUuid,
        updatedByUuid: admCompanyTrainingsV2.updatedByUuid,
      })
      .from(admCompanyTrainingsV2)
      .leftJoin(
        admCompanyTrainingGroupsV2,
        eq(admCompanyTrainingsV2.groupCode, admCompanyTrainingGroupsV2.code)
      )
      .where(eq(admCompanyTrainingsV2.isDeleted, false))
      .orderBy(
        asc(sql`COALESCE(${admCompanyTrainingGroupsV2.displayOrder}, 999)`),
        asc(sql`COALESCE(${admCompanyTrainingsV2.sortOrder}, 999)`)
      );
    return results as AdmCompanyTrainingV2[];
  }

  async findById(id: number): Promise<AdmCompanyTrainingV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingsV2)
      .where(and(eq(admCompanyTrainingsV2.id, id), eq(admCompanyTrainingsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(ctUuid: string): Promise<AdmCompanyTrainingV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingsV2)
      .where(and(eq(admCompanyTrainingsV2.ctUuid, ctUuid), eq(admCompanyTrainingsV2.isDeleted, false)));
    return results[0];
  }

  async findByMasterId(masterId: number): Promise<AdmCompanyTrainingV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admCompanyTrainingsV2)
      .where(and(eq(admCompanyTrainingsV2.trainingMasterId, masterId), eq(admCompanyTrainingsV2.isDeleted, false)))
      .orderBy(desc(admCompanyTrainingsV2.createdAt));
  }

  async create(data: Omit<InsertAdmCompanyTrainingV2, "ctUuid">): Promise<AdmCompanyTrainingV2> {
    const db = getDb();
    const ctUuid = companyTrainingUuid(data.companyId);
    const taken = await db
      .select({ id: admCompanyTrainingsV2.id })
      .from(admCompanyTrainingsV2)
      .where(eq(admCompanyTrainingsV2.ctUuid, ctUuid));
    if (taken.length > 0) throw new Error(`Company training code ${data.companyId} already exists`);
    const results = await db
      .insert(admCompanyTrainingsV2)
      .values({ ...data, ctUuid })
      .returning();
    return results[0];
  }

  async createFromMaster(masterId: number, auditUserUuid?: string | null): Promise<AdmCompanyTrainingV2 | null> {
    const db = getDb();

    const existing = await db
      .select()
      .from(admCompanyTrainingsV2)
      .where(and(eq(admCompanyTrainingsV2.trainingMasterId, masterId), eq(admCompanyTrainingsV2.isDeleted, false)));
    if (existing.length > 0) return existing[0];

    const masters = await db
      .select()
      .from(admTrainingMasterV2)
      .where(eq(admTrainingMasterV2.id, masterId));
    if (!masters[0]) return null;

    const mt = masters[0];

    const allCompanyTrainings = await db
      .select()
      .from(admCompanyTrainingsV2)
      .where(eq(admCompanyTrainingsV2.isDeleted, false));
    const maxSortOrder = allCompanyTrainings.reduce((max, ct) => Math.max(max, ct.sortOrder ?? 0), 0);

    const ctUuid = companyTrainingUuid(mt.trainingId);
    const fields = {
        trainingMasterId: mt.id,
        companyId: mt.trainingId,
        trainingLabel: mt.trainingLabel || mt.trainingName,
        requirement: mt.requirementReference || null,
        sortOrder: allCompanyTrainings.length === 0 ? 0 : maxSortOrder + 1,
    };

    // Switching a training off soft-deletes its row. Switching it back on
    // brings that row back: its code-derived ct_uuid is still taken by it.
    const [sameUuid] = await db
      .select()
      .from(admCompanyTrainingsV2)
      .where(eq(admCompanyTrainingsV2.ctUuid, ctUuid));
    if (sameUuid) {
      if (!sameUuid.isDeleted) {
        throw new Error(`Company training code ${mt.trainingId} is already used by another company training`);
      }
      const revived = await db
        .update(admCompanyTrainingsV2)
        .set(applyAuditUser({ ...fields, isDeleted: false, auditUserUuid: auditUserUuid ?? null }))
        .where(eq(admCompanyTrainingsV2.id, sameUuid.id))
        .returning();
      return revived[0];
    }

    const insertData: any = { ...fields, ctUuid };
    if (auditUserUuid) {
      insertData.createdByUuid = auditUserUuid;
      insertData.updatedByUuid = auditUserUuid;
    }
    const results = await db
      .insert(admCompanyTrainingsV2)
      .values(insertData)
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmCompanyTrainingV2>): Promise<AdmCompanyTrainingV2 | undefined> {
    const db = getDb();
    // ct_uuid is fixed when the row is made (see companyTrainingUuid); other
    // servers and stored references rely on it never changing.
    const { ctUuid: _ctUuid, id: _id, ...changes } = data as Partial<InsertAdmCompanyTrainingV2> & { id?: number };
    const results = await db
      .update(admCompanyTrainingsV2)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingsV2.id, id), eq(admCompanyTrainingsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingsV2.id, id), eq(admCompanyTrainingsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async deleteByMasterId(masterId: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingsV2.trainingMasterId, masterId), eq(admCompanyTrainingsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async reorder(orders: Array<{ id: number; sortOrder: number }>, auditUserUuid: string | null = null): Promise<void> {
    const db = getDb();
    for (const order of orders) {
      await db
        .update(admCompanyTrainingsV2)
        .set(applyAuditUser({ sortOrder: order.sortOrder, auditUserUuid }))
        .where(eq(admCompanyTrainingsV2.id, order.id));
    }
  }
}
