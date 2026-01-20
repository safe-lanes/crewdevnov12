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
  PersonalDetails,
  InsertPersonalDetails,
  Address,
  InsertAddress,
  FamilyInfo,
  InsertFamilyInfo,
  Child,
  InsertChild,
  NextOfKin,
  InsertNextOfKin,
} from "../../../../shared/v2/recruitment/types";

// ============================================================================
// PERSONAL DETAILS REPOSITORY
// ============================================================================

export class PersonalDetailsRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<PersonalDetails | undefined> {
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

  async upsert(recCanUuid: string, data: Partial<InsertPersonalDetails>): Promise<PersonalDetails> {
    const db = getDb();
    const existing = await this.findByCandidateUuid(recCanUuid);
    
    if (existing) {
      const results = await db
        .update(candPersonalDetails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(candPersonalDetails.id, existing.id))
        .returning();
      return results[0];
    } else {
      const results = await db
        .insert(candPersonalDetails)
        .values({ ...data, recCanUuid } as InsertPersonalDetails)
        .returning();
      return results[0];
    }
  }
}

// ============================================================================
// ADDRESS REPOSITORY
// ============================================================================

export class AddressRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<Address | undefined> {
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

  async upsert(recCanUuid: string, data: Partial<InsertAddress>): Promise<Address> {
    const db = getDb();
    const existing = await this.findByCandidateUuid(recCanUuid);
    
    if (existing) {
      const results = await db
        .update(candAddresses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(candAddresses.id, existing.id))
        .returning();
      return results[0];
    } else {
      const results = await db
        .insert(candAddresses)
        .values({ ...data, recCanUuid } as InsertAddress)
        .returning();
      return results[0];
    }
  }
}

// ============================================================================
// FAMILY INFO REPOSITORY
// ============================================================================

export class FamilyInfoRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<FamilyInfo | undefined> {
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

  async upsert(recCanUuid: string, data: Partial<InsertFamilyInfo>): Promise<FamilyInfo> {
    const db = getDb();
    const existing = await this.findByCandidateUuid(recCanUuid);
    
    if (existing) {
      const results = await db
        .update(candFamilyInfo)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(candFamilyInfo.id, existing.id))
        .returning();
      return results[0];
    } else {
      const results = await db
        .insert(candFamilyInfo)
        .values({ ...data, recCanUuid } as InsertFamilyInfo)
        .returning();
      return results[0];
    }
  }
}

// ============================================================================
// CHILDREN REPOSITORY
// ============================================================================

export class ChildrenRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<Child[]> {
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

  async findById(id: number): Promise<Child | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candChildren)
      .where(
        and(
          eq(candChildren.id, id),
          eq(candChildren.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertChild): Promise<Child> {
    const db = getDb();
    const results = await db
      .insert(candChildren)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertChild>): Promise<Child | undefined> {
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

// ============================================================================
// NEXT OF KIN REPOSITORY
// ============================================================================

export class NextOfKinRepository {
  async findByCandidateUuid(recCanUuid: string): Promise<NextOfKin[]> {
    const db = getDb();
    return db
      .select()
      .from(candNextOfKin)
      .where(
        and(
          eq(candNextOfKin.recCanUuid, recCanUuid),
          eq(candNextOfKin.isDeleted, false)
        )
      );
  }

  async findById(id: number): Promise<NextOfKin | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(candNextOfKin)
      .where(
        and(
          eq(candNextOfKin.id, id),
          eq(candNextOfKin.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(data: InsertNextOfKin): Promise<NextOfKin> {
    const db = getDb();
    const results = await db
      .insert(candNextOfKin)
      .values(data)
      .returning();
    return results[0];
  }

  async update(id: number, data: Partial<InsertNextOfKin>): Promise<NextOfKin | undefined> {
    const db = getDb();
    const results = await db
      .update(candNextOfKin)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(candNextOfKin.id, id))
      .returning();
    return results[0];
  }

  async softDelete(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(candNextOfKin)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(candNextOfKin.id, id))
      .returning();
    return results.length > 0;
  }
}

// Export singleton instances
export const personalDetailsRepository = new PersonalDetailsRepository();
export const addressRepository = new AddressRepository();
export const familyInfoRepository = new FamilyInfoRepository();
export const childrenRepository = new ChildrenRepository();
export const nextOfKinRepository = new NextOfKinRepository();
