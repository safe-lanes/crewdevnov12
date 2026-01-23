# Phase 12a: Backend Logic Migration

## Prerequisites
- Phases 1-5 complete (schema, repositories, services, controllers, routes)
- V2 database tables exist
- Legacy system unchanged and functional

## Objective
Add production-ready business logic from legacy Crew Pool to V2 services and controllers. Execute this immediately after Phase 5 (Routes).

---

## SECTION 1: Crew Members Service Logic

### 1.1 Get All With Details (from routes.ts lines 7248-7440)

**Target:** `server/v2/crew-pool/services/crewMembersService.ts`

```typescript
// ADD these methods to crewMembersService.ts

import { and, eq, or, ilike, desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { 
  crewMembersV2,
  crewAssignments,
  crewPersonalDetails,
  crewAddresses,
  crewFamilyInfo,
  crewChildren,
  crewNextOfKin,
} from '@shared/v2/crew-pool/schema';

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  pages: number;
  currentPage: number;
}

export const crewMembersService = {
  // ... existing CRUD methods from Phase 3 ...

  /**
   * Get all crew with filters, pagination, and joined assignment data
   * COPIED FROM: server/routes.ts lines 7248-7440
   */
  async getAllWithDetails(filters?: {
    rank?: string;
    nationality?: string;
    status?: string;
    search?: string;
    vesselUuid?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: any[]; pagination: PaginationMeta }> {
    const limit = Math.min(filters?.limit || 50, 100);
    const offset = filters?.offset || 0;

    // Build WHERE conditions
    const conditions: any[] = [eq(crewMembersV2.isDeleted, false)];

    if (filters?.rank) {
      conditions.push(eq(crewMembersV2.presentRank, filters.rank));
    }

    if (filters?.nationality) {
      conditions.push(eq(crewMembersV2.nationality, filters.nationality));
    }

    if (filters?.status) {
      conditions.push(eq(crewMembersV2.status, filters.status));
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(crewMembersV2.firstName, searchTerm),
          ilike(crewMembersV2.familyName, searchTerm),
          ilike(crewMembersV2.empNo, searchTerm),
          ilike(crewMembersV2.employeeId, searchTerm)
        )
      );
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crewMembersV2)
      .where(and(...conditions));

    const total = countResult?.count || 0;

    // Get crew with LEFT JOIN for current assignment
    const results = await db
      .select({
        crew: crewMembersV2,
        currentVessel: crewAssignments.vesselUuid,
        signOnDate: crewAssignments.signOnDate,
        reliefDue: crewAssignments.reliefDue,
        contractPeriodMonths: crewAssignments.contractPeriodMonths,
      })
      .from(crewMembersV2)
      .leftJoin(
        crewAssignments,
        and(
          eq(crewAssignments.crewUuid, crewMembersV2.crewUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.isDeleted, false)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(crewMembersV2.createdAt))
      .limit(limit)
      .offset(offset);

    // Calculate derived fields for each crew
    const data = results.map(r => ({
      ...r.crew,
      presentVessel: r.currentVessel,
      signOnDate: r.signOnDate,
      reliefDue: r.reliefDue,
      contractPeriodMonths: r.contractPeriodMonths,
      status: this.calculateCrewStatus(r.crew.isActive !== false, !!r.currentVessel),
      timeOnBoardMonths: this.calculateTimeOnBoard(r.signOnDate),
    }));

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
    };
  },

  /**
   * Calculate crew status based on active flag and vessel assignment
   * COPIED FROM: server/routes.ts calculateCrewStatus function
   * 
   * Rules:
   * - isActive=false → "Inactive"
   * - isActive=true + vessel assignment → "On Board"
   * - isActive=true + no vessel → "On Leave"
   */
  calculateCrewStatus(isActive: boolean, hasVesselAssignment: boolean): string {
    if (!isActive) return 'Inactive';
    return hasVesselAssignment ? 'On Board' : 'On Leave';
  },

  /**
   * Calculate time on board in months from sign-on date
   * COPIED FROM: server/routes.ts lines 7393-7410
   */
  calculateTimeOnBoard(signOnDate: Date | string | null): number | null {
    if (!signOnDate) return null;
    try {
      const signOn = new Date(signOnDate);
      const today = new Date();
      const diffTime = today.getTime() - signOn.getTime();
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
      return Math.round(diffMonths * 10) / 10; // Round to 1 decimal
    } catch {
      return null;
    }
  },
};
```

### 1.2 Create With Related Data (from routes.ts lines 7456-7495)

```typescript
// ADD to crewMembersService.ts

/**
 * Create new crew member with all related data in a transaction
 * COPIED FROM: server/routes.ts lines 7456-7495
 */
async createWithRelatedData(data: {
  crew: InsertCrewMemberV2;
  personalDetails?: InsertCrewPersonalDetails;
  address?: InsertCrewAddress;
  familyInfo?: InsertCrewFamilyInfo;
  children?: InsertCrewChild[];
  nextOfKin?: InsertCrewNextOfKin;
}): Promise<CrewMemberV2> {
  return db.transaction(async (tx) => {
    // 1. Generate UUID and create crew member
    const crewUuid = uuidv4();
    const [crew] = await tx
      .insert(crewMembersV2)
      .values({ 
        ...data.crew, 
        crewUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 2. Create personal details if provided
    if (data.personalDetails) {
      await tx.insert(crewPersonalDetails).values({
        ...data.personalDetails,
        detailUuid: uuidv4(),
        crewUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 3. Create address if provided
    if (data.address) {
      await tx.insert(crewAddresses).values({
        ...data.address,
        addressUuid: uuidv4(),
        crewUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 4. Create family info if provided
    if (data.familyInfo) {
      await tx.insert(crewFamilyInfo).values({
        ...data.familyInfo,
        familyUuid: uuidv4(),
        crewUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 5. Create children if provided
    if (data.children && data.children.length > 0) {
      await tx.insert(crewChildren).values(
        data.children.map(child => ({
          ...child,
          childUuid: uuidv4(),
          crewUuid,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );
    }

    // 6. Create next of kin if provided
    if (data.nextOfKin) {
      await tx.insert(crewNextOfKin).values({
        ...data.nextOfKin,
        nokUuid: uuidv4(),
        crewUuid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return crew;
  });
},
```

### 1.3 Update With Protection (from routes.ts lines 7496-7540)

```typescript
// ADD to crewMembersService.ts

/**
 * Update crew member - protect vessel assignment fields from accidental clearing
 * COPIED FROM: server/routes.ts lines 7496-7540
 * 
 * IMPORTANT: Crew Member Update Protection
 * Prevents form submissions from accidentally clearing vessel assignment data
 * when the form doesn't include those fields.
 */
async updateWithProtection(
  crewUuid: string,
  data: Partial<InsertCrewMemberV2>,
  options?: { allowVesselClear?: boolean }
): Promise<CrewMemberV2> {
  // Get existing crew to check current values
  const [existing] = await db
    .select()
    .from(crewMembersV2)
    .where(eq(crewMembersV2.crewUuid, crewUuid))
    .limit(1);
  
  if (!existing) {
    throw new Error(`Crew member not found: ${crewUuid}`);
  }
  
  // Protected fields - only clear if explicitly allowed
  const protectedFields = [
    'presentVessel',
    'signOnDate', 
    'reliefDue',
    'contractPeriodMonths',
  ] as const;
  
  const updateData = { ...data, updatedAt: new Date() };
  
  if (!options?.allowVesselClear) {
    for (const field of protectedFields) {
      // If field is being set to null/undefined but existing has value, preserve it
      if (
        (updateData[field] === null || updateData[field] === undefined) &&
        existing[field] !== null && existing[field] !== undefined
      ) {
        delete updateData[field];
      }
    }
  }
  
  const [updated] = await db
    .update(crewMembersV2)
    .set(updateData)
    .where(eq(crewMembersV2.crewUuid, crewUuid))
    .returning();
    
  return updated;
},

/**
 * Get complete crew profile with all related data
 */
async getFullProfile(crewUuid: string): Promise<CrewFullProfile | null> {
  const [crew] = await db
    .select()
    .from(crewMembersV2)
    .where(and(
      eq(crewMembersV2.crewUuid, crewUuid),
      eq(crewMembersV2.isDeleted, false)
    ))
    .limit(1);
    
  if (!crew) return null;
  
  // Fetch all related data in parallel
  const [
    personalDetails,
    address,
    familyInfo,
    children,
    nextOfKin,
  ] = await Promise.all([
    db.select().from(crewPersonalDetails).where(eq(crewPersonalDetails.crewUuid, crewUuid)).limit(1),
    db.select().from(crewAddresses).where(eq(crewAddresses.crewUuid, crewUuid)).limit(1),
    db.select().from(crewFamilyInfo).where(eq(crewFamilyInfo.crewUuid, crewUuid)).limit(1),
    db.select().from(crewChildren).where(and(eq(crewChildren.crewUuid, crewUuid), eq(crewChildren.isDeleted, false))),
    db.select().from(crewNextOfKin).where(eq(crewNextOfKin.crewUuid, crewUuid)).limit(1),
  ]);
  
  return {
    crew,
    personalDetails: personalDetails[0] || null,
    address: address[0] || null,
    familyInfo: familyInfo[0] || null,
    children,
    nextOfKin: nextOfKin[0] || null,
  };
},
```

---

## SECTION 2: Sea Service Experience Calculation

### 2.1 Experience Metrics (from routes.ts calculateExperienceFromSeaService)

**Target:** `server/v2/crew-pool/services/crewSeaServiceService.ts`

```typescript
// ADD to crewSeaServiceService.ts

export interface ExperienceMetrics {
  totalSeaTimeMonths: number;
  companySeaTimeMonths: number;
  externalSeaTimeMonths: number;
  rankExperienceMonths: number;
  vesselTypeExperience: Record<string, number>;
}

export const crewSeaServiceService = {
  // ... existing CRUD methods from Phase 3 ...

  /**
   * Calculate experience metrics from sea service records
   * COPIED FROM: server/routes.ts calculateExperienceFromSeaService
   * 
   * Used by: Officer Matrix, Oil Major Compliance Engine
   */
  calculateExperienceMetrics(
    seaServiceRecords: CrewSeaService[],
    currentRank: string
  ): ExperienceMetrics {
    let companySeaTimeMonths = 0;
    let externalSeaTimeMonths = 0;
    let rankExperienceMonths = 0;
    const vesselTypeExperience: Record<string, number> = {};

    for (const service of seaServiceRecords) {
      const months = this.calculatePeriodMonths(service.fromDate, service.toDate);
      
      // Separate company vs external
      if (service.isCompanyService) {
        companySeaTimeMonths += months;
      } else {
        externalSeaTimeMonths += months;
      }
      
      // Track rank experience
      if (service.rank === currentRank) {
        rankExperienceMonths += months;
      }
      
      // Track vessel type experience
      if (service.vesselType) {
        vesselTypeExperience[service.vesselType] = 
          (vesselTypeExperience[service.vesselType] || 0) + months;
      }
    }

    return {
      totalSeaTimeMonths: companySeaTimeMonths + externalSeaTimeMonths,
      companySeaTimeMonths,
      externalSeaTimeMonths,
      rankExperienceMonths,
      vesselTypeExperience,
    };
  },

  /**
   * Calculate period in months between two dates
   */
  calculatePeriodMonths(fromDate: string | Date | null, toDate: string | Date | null): number {
    if (!fromDate || !toDate) return 0;
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const diffTime = to.getTime() - from.getTime();
      return Math.max(0, diffTime / (1000 * 60 * 60 * 24 * 30.44));
    } catch {
      return 0;
    }
  },

  /**
   * Get all sea service for a crew member with experience metrics
   */
  async getAllWithMetrics(crewUuid: string, currentRank: string): Promise<{
    records: CrewSeaService[];
    metrics: ExperienceMetrics;
  }> {
    const records = await this.findByCrewUuid(crewUuid);
    const metrics = this.calculateExperienceMetrics(records, currentRank);
    return { records, metrics };
  },
};
```

---

## SECTION 3: Assignment Service Logic

### 3.1 Vessel Assignment (from routes.ts lines 7276-7344)

**Target:** `server/v2/crew-pool/services/crewAssignmentsService.ts`

```typescript
// ADD to crewAssignmentsService.ts

import { and, eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const crewAssignmentsService = {
  // ... existing CRUD methods from Phase 3 ...

  /**
   * Assign crew to vessel (with primary/secondary status)
   * COPIED FROM: server/routes.ts vessel assignment logic
   * 
   * Rules:
   * - A crew can have one PRIMARY assignment (their main vessel)
   * - A crew can have multiple SECONDARY assignments (relief/backup)
   * - Creating a PRIMARY deactivates any existing PRIMARY
   */
  async assignToVessel(
    crewUuid: string,
    vesselUuid: string,
    data: {
      signOnDate: Date | string;
      reliefDue?: Date | string;
      contractPeriodMonths?: number;
      crewStatus?: 'primary' | 'secondary';
    }
  ): Promise<CrewAssignment> {
    return db.transaction(async (tx) => {
      const crewStatus = data.crewStatus || 'primary';
      
      // If this is a primary assignment, deactivate any existing primary
      if (crewStatus === 'primary') {
        await tx
          .update(crewAssignments)
          .set({ 
            isCurrent: false, 
            updatedAt: new Date() 
          })
          .where(
            and(
              eq(crewAssignments.crewUuid, crewUuid),
              eq(crewAssignments.crewStatus, 'primary'),
              eq(crewAssignments.isCurrent, true)
            )
          );
      }

      // Create new assignment
      const [assignment] = await tx
        .insert(crewAssignments)
        .values({
          assignUuid: uuidv4(),
          crewUuid,
          vesselUuid,
          signOnDate: new Date(data.signOnDate),
          reliefDue: data.reliefDue ? new Date(data.reliefDue) : null,
          contractPeriodMonths: data.contractPeriodMonths ?? null,
          crewStatus,
          isCurrent: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return assignment;
    });
  },

  /**
   * Sign off crew from vessel
   * COPIED FROM: server/routes.ts POST /api/crew-members/:id/sign-off
   */
  async signOff(
    crewUuid: string,
    data: {
      signOffDate: Date | string;
      signOffReason?: string;
    }
  ): Promise<CrewAssignment> {
    // Get current primary assignment
    const [current] = await db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.crewStatus, 'primary')
        )
      )
      .limit(1);
      
    if (!current) {
      throw new Error('No active assignment to sign off');
    }

    // Update assignment with sign-off data
    const [updated] = await db
      .update(crewAssignments)
      .set({
        signOffDate: new Date(data.signOffDate),
        signOffReason: data.signOffReason ?? null,
        isCurrent: false,
        updatedAt: new Date(),
      })
      .where(eq(crewAssignments.assignUuid, current.assignUuid))
      .returning();
      
    return updated;
  },

  /**
   * Get current assignment for a crew member
   */
  async getCurrent(crewUuid: string): Promise<CrewAssignment | null> {
    const [current] = await db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.crewStatus, 'primary')
        )
      )
      .limit(1);
      
    return current || null;
  },

  /**
   * Get all assignments for a crew (history)
   */
  async getAssignmentHistory(crewUuid: string): Promise<CrewAssignment[]> {
    return db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isDeleted, false)
        )
      )
      .orderBy(desc(crewAssignments.signOnDate));
  },

  /**
   * Get all crew currently assigned to a vessel
   */
  async getVesselCrew(vesselUuid: string): Promise<CrewAssignment[]> {
    return db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.vesselUuid, vesselUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.isDeleted, false)
        )
      );
  },
};
```

---

## SECTION 4: Document/Visa/License/Training CRUD Pattern

### 4.1 Generic Attachment Reconciliation Pattern

**Apply to:** All entity services with attachments (documents, visas, licenses, training, sea service, medicals, doctor visits)

```typescript
// PATTERN: Add to each attachment-supporting service

/**
 * Reconcile items with attachments - handles add/update/delete in one transaction
 * COPIED FROM: CrewInfoForm.tsx attachment save pattern
 * 
 * Frontend sends array of items with:
 * - uuid?: string          - Existing item UUID (empty = new)
 * - isDeleted?: boolean    - Mark for soft deletion
 * - data: EntityData       - Entity field values
 * - attachments?: Array    - Attachment changes
 */
async reconcileWithAttachments(
  crewUuid: string,
  items: Array<{
    uuid?: string;
    isDeleted?: boolean;
    data: InsertEntity;
    attachments?: Array<{
      attUuid?: string;
      isNew?: boolean;
      fileName: string;
      fileData?: string;
    }>;
  }>
): Promise<Entity[]> {
  return db.transaction(async (tx) => {
    const results: Entity[] = [];
    const now = new Date();

    for (const item of items) {
      // Handle soft deletion
      if (item.isDeleted && item.uuid) {
        await tx
          .update(entityTable)
          .set({ isDeleted: true, updatedAt: now })
          .where(eq(entityTable.entityUuid, item.uuid));
        continue;
      }

      let entityUuid: string;

      // Handle update of existing item
      if (item.uuid) {
        const [updated] = await tx
          .update(entityTable)
          .set({ ...item.data, updatedAt: now })
          .where(eq(entityTable.entityUuid, item.uuid))
          .returning();
        entityUuid = item.uuid;
        results.push(updated);
      } else {
        // Handle create of new item
        entityUuid = uuidv4();
        const [created] = await tx
          .insert(entityTable)
          .values({
            ...item.data,
            entityUuid,
            crewUuid,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        results.push(created);
      }

      // Handle new attachments
      if (item.attachments) {
        for (const att of item.attachments) {
          if (att.isNew && att.fileData) {
            await tx.insert(entityAttachmentsTable).values({
              attUuid: uuidv4(),
              parentUuid: entityUuid,
              fileName: att.fileName,
              fileData: att.fileData,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }

    return results;
  });
}
```

### 4.2 Document Service Implementation

**Target:** `server/v2/crew-pool/services/crewDocumentsService.ts`

```typescript
// ADD to crewDocumentsService.ts

export const crewDocumentsService = {
  // ... existing CRUD methods ...

  /**
   * Get all documents with nested attachments for a crew member
   */
  async getAllWithAttachments(crewUuid: string): Promise<DocumentWithAttachments[]> {
    const documents = await db
      .select()
      .from(crewDocuments)
      .where(
        and(
          eq(crewDocuments.crewUuid, crewUuid),
          eq(crewDocuments.isDeleted, false)
        )
      );
    
    if (documents.length === 0) return [];
    
    // Get all attachments in one query
    const docUuids = documents.map(d => d.docUuid);
    const allAttachments = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(
        and(
          inArray(crewDocumentsAttachments.parentUuid, docUuids),
          eq(crewDocumentsAttachments.isDeleted, false)
        )
      );
    
    // Group attachments by document
    const attachmentMap = new Map<string, Attachment[]>();
    for (const att of allAttachments) {
      const existing = attachmentMap.get(att.parentUuid) || [];
      existing.push(att);
      attachmentMap.set(att.parentUuid, existing);
    }
    
    // Merge attachments into documents
    return documents.map(doc => ({
      ...doc,
      attachments: attachmentMap.get(doc.docUuid) || [],
    }));
  },

  /**
   * Get documents expiring within threshold days
   */
  async getExpiringDocuments(
    crewUuid: string,
    daysThreshold: number = 90
  ): Promise<CrewDocument[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    
    return db
      .select()
      .from(crewDocuments)
      .where(
        and(
          eq(crewDocuments.crewUuid, crewUuid),
          eq(crewDocuments.isDeleted, false),
          sql`${crewDocuments.expiryDate} <= ${thresholdDate.toISOString()}::date`,
          sql`${crewDocuments.expiryDate} >= CURRENT_DATE`
        )
      )
      .orderBy(crewDocuments.expiryDate);
  },
};
```

### 4.3 License Service with Archive Support

**Target:** `server/v2/crew-pool/services/crewLicensesService.ts`

```typescript
// ADD to crewLicensesService.ts

export const crewLicensesService = {
  // ... existing CRUD methods ...

  /**
   * Archive a license (e.g., when upgraded to higher COC)
   * COPIED FROM: CrewInfoForm.tsx license archiving pattern
   */
  async archiveLicense(
    licenseUuid: string,
    reason: string
  ): Promise<CrewLicense> {
    const [updated] = await db
      .update(crewLicenses)
      .set({
        archivedAt: new Date(),
        archivedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(crewLicenses.licenseUuid, licenseUuid))
      .returning();
      
    return updated;
  },

  /**
   * Unarchive a license
   */
  async unarchiveLicense(licenseUuid: string): Promise<CrewLicense> {
    const [updated] = await db
      .update(crewLicenses)
      .set({
        archivedAt: null,
        archivedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(crewLicenses.licenseUuid, licenseUuid))
      .returning();
      
    return updated;
  },

  /**
   * Get active (non-archived) licenses only
   */
  async getActiveLicenses(crewUuid: string): Promise<CrewLicense[]> {
    return db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.crewUuid, crewUuid),
          eq(crewLicenses.isDeleted, false),
          sql`${crewLicenses.archivedAt} IS NULL`
        )
      );
  },

  /**
   * Get archived licenses (for history display)
   */
  async getArchivedLicenses(crewUuid: string): Promise<CrewLicense[]> {
    return db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.crewUuid, crewUuid),
          eq(crewLicenses.isDeleted, false),
          sql`${crewLicenses.archivedAt} IS NOT NULL`
        )
      );
  },

  /**
   * Get all licenses with attachments and archive status
   */
  async getAllWithAttachments(crewUuid: string): Promise<LicenseWithAttachments[]> {
    const licenses = await db
      .select()
      .from(crewLicenses)
      .where(
        and(
          eq(crewLicenses.crewUuid, crewUuid),
          eq(crewLicenses.isDeleted, false)
        )
      );
    
    if (licenses.length === 0) return [];
    
    const licenseUuids = licenses.map(l => l.licenseUuid);
    const allAttachments = await db
      .select()
      .from(crewLicensesAttachments)
      .where(
        and(
          inArray(crewLicensesAttachments.parentUuid, licenseUuids),
          eq(crewLicensesAttachments.isDeleted, false)
        )
      );
    
    const attachmentMap = new Map<string, Attachment[]>();
    for (const att of allAttachments) {
      const existing = attachmentMap.get(att.parentUuid) || [];
      existing.push(att);
      attachmentMap.set(att.parentUuid, existing);
    }
    
    return licenses.map(lic => ({
      ...lic,
      attachments: attachmentMap.get(lic.licenseUuid) || [],
    }));
  },
};
```

---

## SECTION 5: Zod Validation Schemas

### 5.1 Controller Validation File

**Target:** `server/v2/crew-pool/controllers/validation.ts`

```typescript
// server/v2/crew-pool/controllers/validation.ts

import { z } from 'zod';

// Date format helper
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format: YYYY-MM-DD');

/**
 * Crew member create/update validation
 */
export const crewMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional().nullable(),
  familyName: z.string().min(1, 'Family name is required').max(100),
  gender: z.enum(['Male', 'Female', 'Other']).optional().nullable(),
  nationality: z.string().max(100).optional().nullable(),
  presentRank: z.string().max(50).optional().nullable(),
  empNo: z.string().min(1, 'Employee number is required').max(50),
  employeeId: z.string().max(50).optional().nullable(),
  isActive: z.boolean().default(true),
});

/**
 * Personal details validation
 */
export const personalDetailsSchema = z.object({
  dateOfBirth: dateString.optional().nullable(),
  placeOfBirthCity: z.string().max(100).optional().nullable(),
  placeOfBirthCountry: z.string().max(100).optional().nullable(),
  heightCm: z.number().min(100).max(250).optional().nullable(),
  weightKg: z.number().min(30).max(200).optional().nullable(),
  bmi: z.number().min(10).max(50).optional().nullable(),
  nativeLanguage: z.string().max(100).optional().nullable(),
  foreignLanguages: z.string().max(200).optional().nullable(),
  englishProficiency: z.enum(['Basic', 'Intermediate', 'Fluent', 'Native']).optional().nullable(),
  vesselTypes: z.array(z.string()).optional().nullable(),
  manningAgent: z.string().max(200).optional().nullable(),
  crewPool: z.string().max(100).optional().nullable(),
  nextAvailability: dateString.optional().nullable(),
});

/**
 * Address validation
 */
export const addressSchema = z.object({
  countryOfResidence: z.string().max(100).optional().nullable(),
  nearestAirport: z.string().max(100).optional().nullable(),
  residentialAddressLine1: z.string().max(200).optional().nullable(),
  residentialAddressLine2: z.string().max(200).optional().nullable(),
  contactLandline: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  email: z.string().email().max(100).optional().nullable(),
});

/**
 * Family info validation
 */
export const familyInfoSchema = z.object({
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']).optional().nullable(),
  numberOfDependentChildren: z.number().min(0).max(20).optional().nullable(),
  fatherName: z.string().max(200).optional().nullable(),
  motherName: z.string().max(200).optional().nullable(),
  spouseFirstName: z.string().max(100).optional().nullable(),
  spouseMiddleName: z.string().max(100).optional().nullable(),
  spouseFamilyName: z.string().max(100).optional().nullable(),
  spouseDateOfBirth: dateString.optional().nullable(),
});

/**
 * Child validation
 */
export const childSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().max(100).optional().nullable(),
  familyName: z.string().min(1, 'Family name is required').max(100),
  dateOfBirth: dateString.optional().nullable(),
  gender: z.enum(['Male', 'Female']).optional().nullable(),
});

/**
 * Next of kin validation
 */
export const nextOfKinSchema = z.object({
  firstName: z.string().max(100).optional().nullable(),
  middleName: z.string().max(100).optional().nullable(),
  familyName: z.string().max(100).optional().nullable(),
  telephone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  relationship: z.string().max(50).optional().nullable(),
});

/**
 * Document validation
 */
export const documentSchema = z.object({
  documentId: z.string().max(50).optional().nullable(),
  documentName: z.string().min(1, 'Document name is required').max(200),
  documentNumber: z.string().max(100).optional().nullable(),
  issuedDate: dateString.optional().nullable(),
  expiryDate: dateString.optional().nullable(),
  issuingAuthority: z.string().max(200).optional().nullable(),
});

/**
 * Visa validation
 */
export const visaSchema = z.object({
  countryId: z.string().max(50).optional().nullable(),
  issuingCountry: z.string().min(1, 'Country is required').max(100),
  visaType: z.string().max(100).optional().nullable(),
  serialNo: z.string().max(100).optional().nullable(),
  issuedDate: dateString.optional().nullable(),
  expiryDate: dateString.optional().nullable(),
});

/**
 * Education validation
 */
export const educationSchema = z.object({
  dateOfCompletion: dateString.optional().nullable(),
  institution: z.string().max(200).optional().nullable(),
  subjects: z.string().max(200).optional().nullable(),
  qualifications: z.string().max(200).optional().nullable(),
});

/**
 * License validation
 */
export const licenseSchema = z.object({
  licenseId: z.string().max(50).optional().nullable(),
  certificateName: z.string().min(1, 'Certificate name is required').max(200),
  abbr: z.string().max(50).optional().nullable(),
  requirement: z.enum(['Mandatory', 'Recommended', 'Optional']).optional().nullable(),
  certificateNo: z.string().max(100).optional().nullable(),
  issuingAuthority: z.string().max(200).optional().nullable(),
  issuedDate: dateString.optional().nullable(),
  expiryDate: dateString.optional().nullable(),
});

/**
 * Training course validation
 */
export const trainingCourseSchema = z.object({
  courseId: z.string().max(50).optional().nullable(),
  companyId: z.string().max(50).optional().nullable(),
  courseName: z.string().min(1, 'Course name is required').max(200),
  abbr: z.string().max(50).optional().nullable(),
  requirement: z.enum(['Mandatory', 'Recommended', 'Optional']).optional().nullable(),
  certificateNo: z.string().max(100).optional().nullable(),
  issuingAuthority: z.string().max(200).optional().nullable(),
  issuedDate: dateString.optional().nullable(),
  expiryDate: dateString.optional().nullable(),
});

/**
 * Sea service validation
 */
export const seaServiceSchema = z.object({
  isCompanyService: z.boolean().default(true),
  vesselName: z.string().min(1, 'Vessel name is required').max(200),
  vesselCode: z.string().max(50).optional().nullable(),
  vesselType: z.string().max(100).optional().nullable(),
  deadweight: z.string().max(50).optional().nullable(),
  engineTypePower: z.string().max(100).optional().nullable(),
  ownerOperator: z.string().max(200).optional().nullable(),
  rank: z.string().max(50).optional().nullable(),
  fromDate: dateString.optional().nullable(),
  toDate: dateString.optional().nullable(),
  periodMonths: z.number().min(0).optional().nullable(),
  experienceCategories: z.array(z.string()).optional().nullable(),
});

/**
 * Assignment validation
 */
export const assignmentSchema = z.object({
  vesselUuid: z.string().uuid('Invalid vessel UUID'),
  signOnDate: dateString,
  reliefDue: dateString.optional().nullable(),
  contractPeriodMonths: z.number().min(1).max(24).optional().nullable(),
  crewStatus: z.enum(['primary', 'secondary']).default('primary'),
});

/**
 * Sign off validation
 */
export const signOffSchema = z.object({
  signOffDate: dateString,
  signOffReason: z.string().max(500).optional().nullable(),
});

/**
 * Pre-joining medical validation
 */
export const preJoiningMedicalSchema = z.object({
  vesselCode: z.string().max(50).optional().nullable(),
  vesselName: z.string().max(200).optional().nullable(),
  dateOfMedical: dateString.optional().nullable(),
  bloodPressure: z.string().max(50).optional().nullable(),
  weight: z.string().max(50).optional().nullable(),
  medicationPrescribed: z.string().max(500).optional().nullable(),
  fitnessForDuty: z.enum(['Fit', 'Unfit', 'Fit with restrictions']).optional().nullable(),
  expiryDate: dateString.optional().nullable(),
});

/**
 * Doctor visit validation
 */
export const doctorVisitSchema = z.object({
  vesselName: z.string().max(200).optional().nullable(),
  port: z.string().max(100).optional().nullable(),
  visitDate: dateString.optional().nullable(),
  complaint: z.string().max(500).optional().nullable(),
  doctorComments: z.string().max(1000).optional().nullable(),
});

/**
 * Attachment validation (for file uploads)
 */
export const attachmentSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileData: z.string().min(1), // Base64 encoded
});

/**
 * Bulk reconcile item schema (used by reconcileWithAttachments)
 */
export const reconcileItemSchema = z.object({
  uuid: z.string().uuid().optional().nullable(),
  isDeleted: z.boolean().optional(),
  data: z.record(z.any()),
  attachments: z.array(z.object({
    attUuid: z.string().uuid().optional().nullable(),
    isNew: z.boolean().optional(),
    fileName: z.string().max(255),
    fileData: z.string().optional(),
  })).optional(),
});

// Export types
export type CrewMemberInput = z.infer<typeof crewMemberSchema>;
export type PersonalDetailsInput = z.infer<typeof personalDetailsSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type FamilyInfoInput = z.infer<typeof familyInfoSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type NextOfKinInput = z.infer<typeof nextOfKinSchema>;
export type DocumentInput = z.infer<typeof documentSchema>;
export type VisaInput = z.infer<typeof visaSchema>;
export type EducationInput = z.infer<typeof educationSchema>;
export type LicenseInput = z.infer<typeof licenseSchema>;
export type TrainingCourseInput = z.infer<typeof trainingCourseSchema>;
export type SeaServiceInput = z.infer<typeof seaServiceSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type SignOffInput = z.infer<typeof signOffSchema>;
export type PreJoiningMedicalInput = z.infer<typeof preJoiningMedicalSchema>;
export type DoctorVisitInput = z.infer<typeof doctorVisitSchema>;
```

---

## Checklist

### Service Layer
- [ ] `crewMembersService.ts` - `getAllWithDetails`, `calculateCrewStatus`, `calculateTimeOnBoard`
- [ ] `crewMembersService.ts` - `createWithRelatedData`, `updateWithProtection`, `getFullProfile`
- [ ] `crewSeaServiceService.ts` - `calculateExperienceMetrics`, `calculatePeriodMonths`, `getAllWithMetrics`
- [ ] `crewAssignmentsService.ts` - `assignToVessel`, `signOff`, `getCurrent`, `getAssignmentHistory`, `getVesselCrew`
- [ ] `crewDocumentsService.ts` - `getAllWithAttachments`, `getExpiringDocuments`
- [ ] `crewLicensesService.ts` - `archiveLicense`, `unarchiveLicense`, `getActiveLicenses`, `getArchivedLicenses`
- [ ] All entity services - `reconcileWithAttachments` pattern

### Controller Validation
- [ ] Create `validation.ts` with all Zod schemas
- [ ] Update controllers to use validation schemas with `schema.parse(req.body)`

### Testing
- [ ] API endpoints return correct data structure
- [ ] Validation rejects invalid input with proper error messages
- [ ] Transactions rollback on failure
- [ ] Attachment reconciliation handles add/update/delete

---

## Success Criteria

Phase 12a is complete when:
1. All service methods listed above are implemented
2. Validation schemas are in place and used by controllers
3. V2 endpoints return production-ready data
4. Legacy system remains unchanged
