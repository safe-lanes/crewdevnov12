import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admCompanyTrainingRequirementsV2 } from "../../../../shared/v2/admin/schema";
import type { AdmCompanyTrainingRequirementV2, InsertAdmCompanyTrainingRequirementV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class CompanyTrainingRequirementsRepository {
  async findAll(): Promise<AdmCompanyTrainingRequirementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admCompanyTrainingRequirementsV2)
      .where(eq(admCompanyTrainingRequirementsV2.isDeleted, false))
      .orderBy(desc(admCompanyTrainingRequirementsV2.createdAt));
  }

  async findById(id: number): Promise<AdmCompanyTrainingRequirementV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingRequirementsV2)
      .where(and(eq(admCompanyTrainingRequirementsV2.id, id), eq(admCompanyTrainingRequirementsV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(ctrUuid: string): Promise<AdmCompanyTrainingRequirementV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admCompanyTrainingRequirementsV2)
      .where(and(eq(admCompanyTrainingRequirementsV2.ctrUuid, ctrUuid), eq(admCompanyTrainingRequirementsV2.isDeleted, false)));
    return results[0];
  }

  async findByCompanyTrainingId(companyTrainingId: number): Promise<AdmCompanyTrainingRequirementV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admCompanyTrainingRequirementsV2)
      .where(and(eq(admCompanyTrainingRequirementsV2.companyTrainingId, companyTrainingId), eq(admCompanyTrainingRequirementsV2.isDeleted, false)))
      .orderBy(desc(admCompanyTrainingRequirementsV2.createdAt));
  }

  async create(data: Omit<InsertAdmCompanyTrainingRequirementV2, "ctrUuid">): Promise<AdmCompanyTrainingRequirementV2> {
    const db = getDb();
    const results = await db
      .insert(admCompanyTrainingRequirementsV2)
      .values({ ...data, ctrUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmCompanyTrainingRequirementV2>): Promise<AdmCompanyTrainingRequirementV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingRequirementsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingRequirementsV2.id, id), eq(admCompanyTrainingRequirementsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admCompanyTrainingRequirementsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admCompanyTrainingRequirementsV2.id, id), eq(admCompanyTrainingRequirementsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async upsertBatch(requirements: Array<{ companyTrainingId: number; rankId: number; status: string | null }>): Promise<void> {
    const db = getDb();
    for (const req of requirements) {
      const existing = await db
        .select()
        .from(admCompanyTrainingRequirementsV2)
        .where(
          and(
            eq(admCompanyTrainingRequirementsV2.companyTrainingId, req.companyTrainingId),
            eq(admCompanyTrainingRequirementsV2.rankId, req.rankId),
            eq(admCompanyTrainingRequirementsV2.isDeleted, false)
          )
        );

      if (req.status === null) {
        if (existing[0]) {
          await db
            .update(admCompanyTrainingRequirementsV2)
            .set({ isDeleted: true, updatedAt: new Date() })
            .where(eq(admCompanyTrainingRequirementsV2.id, existing[0].id));
        }
      } else if (existing[0]) {
        await db
          .update(admCompanyTrainingRequirementsV2)
          .set({ status: req.status, updatedAt: new Date() })
          .where(eq(admCompanyTrainingRequirementsV2.id, existing[0].id));
      } else {
        await db
          .insert(admCompanyTrainingRequirementsV2)
          .values({
            ctrUuid: uuidv4(),
            companyTrainingId: req.companyTrainingId,
            rankId: req.rankId,
            status: req.status,
          });
      }
    }
  }
}
