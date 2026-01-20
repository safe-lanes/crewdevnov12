import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  candPersonalDetails,
  candAddresses,
  candFamilyInfo,
  candChildren,
  candNextOfKin,
} from "../../../../shared/v2/recruitment/schema";
import type {
  CandPersonalDetails,
  InsertPersonalDetails,
  CandAddress,
  InsertAddress,
  CandFamilyInfo,
  InsertFamilyInfo,
  CandChild,
  InsertChild,
  CandNextOfKin,
  InsertNextOfKin,
} from "../../../../shared/v2/recruitment/types";

export class PersonalDetailsRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandPersonalDetails | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candPersonalDetails)
      .where(
        and(
          eq(candPersonalDetails.recCanUuid, recCanUuid),
          eq(candPersonalDetails.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertPersonalDetails): Promise<CandPersonalDetails> {
    const db = getDb();
    const results = await db.insert(candPersonalDetails).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertPersonalDetails>): Promise<CandPersonalDetails | undefined> {
    const db = getDb();
    const results = await db
      .update(candPersonalDetails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candPersonalDetails.id, id))
      .returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertPersonalDetails>): Promise<CandPersonalDetails> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertPersonalDetails);
  }
}

export class AddressRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandAddress | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candAddresses)
      .where(
        and(
          eq(candAddresses.recCanUuid, recCanUuid),
          eq(candAddresses.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertAddress): Promise<CandAddress> {
    const db = getDb();
    const results = await db.insert(candAddresses).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertAddress>): Promise<CandAddress | undefined> {
    const db = getDb();
    const results = await db
      .update(candAddresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candAddresses.id, id))
      .returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertAddress>): Promise<CandAddress> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertAddress);
  }
}

export class FamilyInfoRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandFamilyInfo | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candFamilyInfo)
      .where(
        and(
          eq(candFamilyInfo.recCanUuid, recCanUuid),
          eq(candFamilyInfo.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertFamilyInfo): Promise<CandFamilyInfo> {
    const db = getDb();
    const results = await db.insert(candFamilyInfo).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertFamilyInfo>): Promise<CandFamilyInfo | undefined> {
    const db = getDb();
    const results = await db
      .update(candFamilyInfo)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candFamilyInfo.id, id))
      .returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertFamilyInfo>): Promise<CandFamilyInfo> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertFamilyInfo);
  }
}

export class ChildrenRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandChild[]> {
    const db = getDb();
    return db
      .select()
      .from(candChildren)
      .where(
        and(
          eq(candChildren.recCanUuid, recCanUuid),
          eq(candChildren.isDeleted, false)
        )
      );
  }

  async create(data: InsertChild): Promise<CandChild> {
    const db = getDb();
    const results = await db.insert(candChildren).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertChild>): Promise<CandChild | undefined> {
    const db = getDb();
    const results = await db
      .update(candChildren)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candChildren.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candChildren)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candChildren.id, id))
      .returning();
    return results.length > 0;
  }
}

export class NextOfKinRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<CandNextOfKin | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candNextOfKin)
      .where(
        and(
          eq(candNextOfKin.recCanUuid, recCanUuid),
          eq(candNextOfKin.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertNextOfKin): Promise<CandNextOfKin> {
    const db = getDb();
    const results = await db.insert(candNextOfKin).values(data).returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertNextOfKin>): Promise<CandNextOfKin | undefined> {
    const db = getDb();
    const results = await db
      .update(candNextOfKin)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candNextOfKin.id, id))
      .returning();
    return results[0];
  }

  async upsert(recCanUuid: string, data: Partial<InsertNextOfKin>): Promise<CandNextOfKin> {
    const existing = await this.findByCandidateUuid(recCanUuid);
    if (existing) {
      return (await this.update(existing.id, data))!;
    }
    return this.create({ ...data, recCanUuid } as InsertNextOfKin);
  }
}

export const personalDetailsRepository = new PersonalDetailsRepository();
export const addressRepository = new AddressRepository();
export const familyInfoRepository = new FamilyInfoRepository();
export const childrenRepository = new ChildrenRepository();
export const nextOfKinRepository = new NextOfKinRepository();
