# Phase 2: Repository Layer

## Context
Phase 1 is complete. You have:
- 25 tables defined in `shared/v2/crew-pool/schema.ts`
- Types defined in `shared/v2/crew-pool/types.ts`
- All tables created in database

## Objective
Create the Repository layer following the Recruitment V2 pattern. Repositories handle direct database access with JOIN-based queries to prevent N+1 issues.

## Reference Files (DO NOT MODIFY - use as patterns only)
- `server/v2/recruitment/repositories/candidateRepository.ts` - Follow this exact pattern
- `server/v2/recruitment/repositories/index.ts` - See how repositories are exported

## Files to Create

### Folder: `server/v2/crew-pool/repositories/`

### 1. `crewMembersRepository.ts`

```typescript
import { db } from '@/db';
import { eq, and, isNull, desc, like, or } from 'drizzle-orm';
import { crewMembersV2 } from '@shared/v2/crew-pool/schema';
import type { InsertCrewMemberV2, CrewMemberV2 } from '@shared/v2/crew-pool/types';
import { v4 as uuidv4 } from 'uuid';

export const crewMembersRepository = {
  async findAll(filters?: { status?: string; isActive?: boolean; search?: string }) {
    let query = db.select().from(crewMembersV2).where(isNull(crewMembersV2.archivedAt));
    
    // Apply filters...
    return query.orderBy(desc(crewMembersV2.createdAt));
  },

  async findByUuid(crewUuid: string): Promise<CrewMemberV2 | undefined> {
    const [crew] = await db
      .select()
      .from(crewMembersV2)
      .where(eq(crewMembersV2.crewUuid, crewUuid));
    return crew;
  },

  async create(data: Omit<InsertCrewMemberV2, 'crewUuid'>): Promise<CrewMemberV2> {
    const [crew] = await db
      .insert(crewMembersV2)
      .values({ ...data, crewUuid: uuidv4() })
      .returning();
    return crew;
  },

  async update(crewUuid: string, data: Partial<InsertCrewMemberV2>): Promise<CrewMemberV2 | undefined> {
    const [crew] = await db
      .update(crewMembersV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .returning();
    return crew;
  },

  async softDelete(crewUuid: string): Promise<void> {
    await db
      .update(crewMembersV2)
      .set({ archivedAt: new Date(), isActive: false })
      .where(eq(crewMembersV2.crewUuid, crewUuid));
  },
};
```

### 2. `crewAssignmentsRepository.ts`

```typescript
import { db } from '@/db';
import { eq, and, desc } from 'drizzle-orm';
import { crewAssignments } from '@shared/v2/crew-pool/schema';
import type { InsertCrewAssignment, CrewAssignment } from '@shared/v2/crew-pool/types';
import { v4 as uuidv4 } from 'uuid';

export const crewAssignmentsRepository = {
  async findByCrewUuid(crewUuid: string): Promise<CrewAssignment[]> {
    return db
      .select()
      .from(crewAssignments)
      .where(eq(crewAssignments.crewUuid, crewUuid))
      .orderBy(desc(crewAssignments.signOnDate));
  },

  async findCurrent(crewUuid: string): Promise<CrewAssignment | undefined> {
    const [assignment] = await db
      .select()
      .from(crewAssignments)
      .where(and(
        eq(crewAssignments.crewUuid, crewUuid),
        eq(crewAssignments.isCurrent, true)
      ));
    return assignment;
  },

  async create(data: Omit<InsertCrewAssignment, 'assignUuid'>): Promise<CrewAssignment> {
    // If marking as current, unset previous current
    if (data.isCurrent) {
      await db
        .update(crewAssignments)
        .set({ isCurrent: false })
        .where(and(
          eq(crewAssignments.crewUuid, data.crewUuid),
          eq(crewAssignments.isCurrent, true)
        ));
    }
    
    const [assignment] = await db
      .insert(crewAssignments)
      .values({ ...data, assignUuid: uuidv4() })
      .returning();
    return assignment;
  },

  async update(assignUuid: string, data: Partial<InsertCrewAssignment>): Promise<CrewAssignment | undefined> {
    const [assignment] = await db
      .update(crewAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewAssignments.assignUuid, assignUuid))
      .returning();
    return assignment;
  },

  async delete(assignUuid: string): Promise<void> {
    await db.delete(crewAssignments).where(eq(crewAssignments.assignUuid, assignUuid));
  },
};
```

### 3. `crewDocumentsRepository.ts` (Pattern for entities with attachments)

**CRITICAL: Use JOINs to prevent N+1 queries**

```typescript
import { db } from '@/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { crewDocuments, crewDocumentsAttachments } from '@shared/v2/crew-pool/schema';
import { v4 as uuidv4 } from 'uuid';

export const crewDocumentsRepository = {
  // JOIN-based query to get documents WITH attachments in single query
  async findByCrewUuidWithAttachments(crewUuid: string) {
    const docs = await db
      .select()
      .from(crewDocuments)
      .where(eq(crewDocuments.crewUuid, crewUuid))
      .orderBy(desc(crewDocuments.createdAt));

    if (docs.length === 0) return [];

    const docUuids = docs.map(d => d.docUuid);
    const attachments = await db
      .select()
      .from(crewDocumentsAttachments)
      .where(inArray(crewDocumentsAttachments.docUuid, docUuids));

    // Group attachments by docUuid
    const attMap = new Map<string, typeof attachments>();
    attachments.forEach(att => {
      const existing = attMap.get(att.docUuid) || [];
      existing.push(att);
      attMap.set(att.docUuid, existing);
    });

    return docs.map(doc => ({
      ...doc,
      attachments: attMap.get(doc.docUuid) || [],
    }));
  },

  async create(data: Omit<InsertCrewDocument, 'docUuid'>) {
    const [doc] = await db
      .insert(crewDocuments)
      .values({ ...data, docUuid: uuidv4() })
      .returning();
    return doc;
  },

  async update(docUuid: string, data: Partial<InsertCrewDocument>) {
    const [doc] = await db
      .update(crewDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewDocuments.docUuid, docUuid))
      .returning();
    return doc;
  },

  async delete(docUuid: string) {
    // Delete attachments first (cascade)
    await db.delete(crewDocumentsAttachments).where(eq(crewDocumentsAttachments.docUuid, docUuid));
    await db.delete(crewDocuments).where(eq(crewDocuments.docUuid, docUuid));
  },

  async addAttachment(docUuid: string, data: { fileName: string; filePath: string; fileType: string; fileSize: number }) {
    const [att] = await db
      .insert(crewDocumentsAttachments)
      .values({ ...data, docUuid, attUuid: uuidv4() })
      .returning();
    return att;
  },

  async removeAttachment(attUuid: string) {
    await db.delete(crewDocumentsAttachments).where(eq(crewDocumentsAttachments.attUuid, attUuid));
  },
};
```

### All Repositories to Create

| File | Tables | Key Pattern |
|------|--------|-------------|
| `crewMembersRepository.ts` | crew_members_v2 | Soft delete, filters |
| `crewAssignmentsRepository.ts` | crew_assignments | Current assignment logic |
| `crewPersonalRepository.ts` | crew_personal_details, crew_addresses | Upsert pattern (1:1) |
| `crewFamilyRepository.ts` | crew_family_info, crew_children, crew_next_of_kin | Upsert + 1:N children |
| `crewVesselTypesRepository.ts` | crew_vessel_types_applied | Sync pattern (delete all, insert new) |
| `crewDocumentsRepository.ts` | crew_documents, crew_documents_attachments | JOIN + attachments |
| `crewVisasRepository.ts` | crew_visas, crew_visas_attachments | JOIN + attachments |
| `crewEducationRepository.ts` | crew_education, crew_education_attachments | JOIN + attachments |
| `crewLicensesRepository.ts` | crew_licenses, crew_licenses_attachments | JOIN + attachments + archive |
| `crewTrainingRepository.ts` | crew_training_courses, crew_training_attachments | JOIN + attachments |
| `crewSeaServiceRepository.ts` | crew_sea_service, crew_sea_service_attachments | JOIN + type filter |
| `crewMedicalRepository.ts` | All 4 medical tables | JOIN + attachments |

### 4. `index.ts`

```typescript
export * from './crewMembersRepository';
export * from './crewAssignmentsRepository';
export * from './crewPersonalRepository';
export * from './crewFamilyRepository';
export * from './crewVesselTypesRepository';
export * from './crewDocumentsRepository';
export * from './crewVisasRepository';
export * from './crewEducationRepository';
export * from './crewLicensesRepository';
export * from './crewTrainingRepository';
export * from './crewSeaServiceRepository';
export * from './crewMedicalRepository';
```

## Critical Patterns

### 1. N+1 Prevention
NEVER do this:
```typescript
// BAD - N+1 queries
const docs = await db.select().from(crewDocuments);
for (const doc of docs) {
  doc.attachments = await db.select().from(attachments).where(eq(attachments.docUuid, doc.docUuid));
}
```

ALWAYS do this:
```typescript
// GOOD - 2 queries with client-side join
const docs = await db.select().from(crewDocuments);
const attachments = await db.select().from(attachments).where(inArray(...));
// Then map attachments to docs
```

### 2. Upsert Pattern (for 1:1 relations)
```typescript
async upsert(crewUuid: string, data: InsertCrewPersonalDetails) {
  const existing = await this.findByCrewUuid(crewUuid);
  if (existing) {
    return this.update(crewUuid, data);
  }
  return this.create({ ...data, crewUuid });
}
```

### 3. Sync Pattern (for multi-select)
```typescript
async sync(crewUuid: string, vesselTypeUuids: string[]) {
  await db.delete(crewVesselTypesApplied).where(eq(crewVesselTypesApplied.crewUuid, crewUuid));
  if (vesselTypeUuids.length > 0) {
    await db.insert(crewVesselTypesApplied).values(
      vesselTypeUuids.map(uuid => ({ crewUuid, vesselTypeUuid: uuid }))
    );
  }
}
```

## Validation Steps

1. TypeScript compiles without errors
2. All repositories export correctly from index.ts
3. Test each repository method with sample data
4. Verify JOIN queries return nested attachments correctly

## DO NOT
- Use N+1 query patterns
- Forget to generate UUIDs for new records
- Hard delete when soft delete is expected
- Skip the index.ts exports

## Success Criteria
- [ ] 12 repository files created
- [ ] All use JOIN-based queries for attachments
- [ ] Proper UUID generation
- [ ] Correct soft delete for crew_members_v2
- [ ] index.ts exports all repositories
