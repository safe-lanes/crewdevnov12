# STEP 2 COMPLETE: Master Data UUID Resolution (READ + WRITE)

## Overview

This fix addresses **both directions** of master data handling:
1. **WRITE (Insert/Update)**: Accept name OR UUID, store only UUID
2. **READ (Fetch/Display)**: Return both UUID (for forms) and resolved name (for display)

---

## Problem Statement

### Current Issues:

**Issue 1 - WRITE:** When creating/updating candidates, if frontend sends actual values instead of UUIDs, they get stored directly:
```typescript
// Frontend sends: { nationality: "Indian" }
// Database stores: { nationality_uuid: "Indian" } ❌ WRONG
// Should store: { nationality_uuid: "nat-uuid-123" } ✅ CORRECT
```

**Issue 2 - READ:** When fetching candidates, only UUIDs are returned:
```typescript
// Database has: { nationality_uuid: "nat-uuid-123" }
// API returns: { nationality: "nat-uuid-123" } ❌ NOT USEFUL
// Should return: { nationalityUuid: "nat-uuid-123", nationality: "Indian" } ✅ USEFUL
```

---

## PART A: Fix WRITE Operations (UUID Resolution on Insert/Update)

### Instructions for Replit

**File: `server/v2/recruitment/services/candidateService.ts`**

Add master data resolution helper at the top of the class:

```typescript
import { v4 as uuidv4 } from "uuid";
import { eq, or, sql } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  candidateRepository,
  vesselTypesAppliedRepository,
  personalDetailsRepository,
  addressRepository,
  familyInfoRepository,
  childrenRepository,
  nextOfKinRepository,
} from "../repositories";
import {
  recruitmentCandidatesV2,
  candVesselTypesApplied,
  masterNationalities,
  masterVesselTypes,
  masterCountries,
  masterLanguages,
  masterPorts,
  masterFleetGroups,
  masterVessels,
} from "../../../../shared/schema";
import type {
  RecruitmentCandidate,
  CandVesselTypeApplied,
  CandPersonalDetails,
  CandAddress,
  CandFamilyInfo,
  CandChild,
  CandNextOfKin,
  CreateCandidateRequest,
  InsertPersonalDetails,
  InsertAddress,
  InsertFamilyInfo,
  InsertChild,
  InsertNextOfKin,
} from "../../../../shared/v2/recruitment/types";

export interface CandidateListItem extends RecruitmentCandidate {
  nationality: string;
  vesselType: string;
}

export class CandidateService {

  // ============================================================================
  // MASTER DATA UUID RESOLUTION (WRITE OPERATIONS)
  // ============================================================================

  /**
   * Resolve master data value/name to UUID
   * Handles both:
   * - UUID input: "nat-uuid-123" → "nat-uuid-123" (passthrough)
   * - Name input: "Indian" → "nat-uuid-123" (lookup)
   * - Code input: "IN" → "nat-uuid-123" (lookup)
   */
  private async resolveMasterDataUuid(
    value: string | null | undefined,
    masterTable: 'nationality' | 'vesselType' | 'country' | 'language' | 'port' | 'fleetGroup' | 'vessel'
  ): Promise<string | null> {
    if (!value || value.trim() === '') {
      return null;
    }

    const db = getDb();

    // If already a UUID format (contains hyphens and looks like UUID), return as-is
    // Examples: "nat-uuid-123", "vt-abc-def-ghi"
    if (value.includes('-') && value.length > 10) {
      return value;
    }

    // Otherwise, lookup UUID by name or code
    try {
      switch (masterTable) {
        case 'nationality': {
          const result = await db
            .select({ uuid: masterNationalities.natUuid })
            .from(masterNationalities)
            .where(
              or(
                eq(masterNationalities.nationality, value),
                eq(masterNationalities.countryCode, value)
              )
            )
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'vesselType': {
          const result = await db
            .select({ uuid: masterVesselTypes.vesselTypeUuid })
            .from(masterVesselTypes)
            .where(eq(masterVesselTypes.vesselType, value))
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'country': {
          const result = await db
            .select({ uuid: masterCountries.countryUuid })
            .from(masterCountries)
            .where(
              or(
                eq(masterCountries.countryName, value),
                eq(masterCountries.countryCode, value)
              )
            )
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'language': {
          const result = await db
            .select({ uuid: masterLanguages.langUuid })
            .from(masterLanguages)
            .where(eq(masterLanguages.language, value))
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'port': {
          const result = await db
            .select({ uuid: masterPorts.portUuid })
            .from(masterPorts)
            .where(
              or(
                eq(masterPorts.portName, value),
                eq(masterPorts.portCode, value)
              )
            )
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'fleetGroup': {
          const result = await db
            .select({ uuid: masterFleetGroups.fgUuid })
            .from(masterFleetGroups)
            .where(eq(masterFleetGroups.fleetGroupName, value))
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'vessel': {
          const result = await db
            .select({ uuid: masterVessels.vesselUuid })
            .from(masterVessels)
            .where(
              or(
                eq(masterVessels.vesselName, value),
                eq(masterVessels.imoNumber, value)
              )
            )
            .limit(1);
          return result[0]?.uuid || null;
        }

        default:
          return null;
      }
    } catch (error) {
      console.error(`Error resolving ${masterTable} UUID for value "${value}":`, error);
      return null;
    }
  }

  // ============================================================================
  // CREATE CANDIDATE (with UUID resolution)
  // ============================================================================

  async createCandidate(
    data: CreateCandidateRequest,
    createdByUuid?: string
  ): Promise<RecruitmentCandidate> {
    const recCanUuid = uuidv4();

    // Resolve nationality: Accept "Indian" OR "nat-uuid-123"
    const nationalityInput = data.nationalityUuid || (data as any).nationality;
    const nationalityUuid = await this.resolveMasterDataUuid(nationalityInput, 'nationality');

    if (nationalityInput && !nationalityUuid) {
      throw new Error(
        `Invalid nationality: "${nationalityInput}". ` +
        `Not found in master_nationalities table. ` +
        `Valid values: nationality name (e.g., "Indian") or UUID.`
      );
    }

    return candidateRepository.create({
      recCanUuid,
      ...data,
      nationalityUuid, // ✅ Always stores UUID, never raw value
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  // ============================================================================
  // UPDATE CANDIDATE (with UUID resolution)
  // ============================================================================

  async updateCandidateByUuid(
    recCanUuid: string,
    data: Partial<CreateCandidateRequest>,
    updatedByUuid?: string
  ): Promise<RecruitmentCandidate | undefined> {

    // Resolve nationality if provided
    const nationalityInput = data.nationalityUuid || (data as any).nationality;
    if (nationalityInput) {
      const nationalityUuid = await this.resolveMasterDataUuid(nationalityInput, 'nationality');

      if (!nationalityUuid) {
        throw new Error(
          `Invalid nationality: "${nationalityInput}". ` +
          `Not found in master_nationalities table.`
        );
      }

      data.nationalityUuid = nationalityUuid; // ✅ Replace with UUID
      delete (data as any).nationality; // Remove non-schema field
    }

    return candidateRepository.updateByUuid(recCanUuid, {
      ...data,
      updatedByUuid,
    });
  }

  // ============================================================================
  // ADD VESSEL TYPE (with UUID resolution)
  // ============================================================================

  async addVesselTypeApplied(
    recCanUuid: string,
    vesselTypeInput: string,
    createdByUuid?: string
  ): Promise<CandVesselTypeApplied> {

    // Resolve vessel type: Accept "Container" OR "vt-uuid-123"
    const vesselTypeUuid = await this.resolveMasterDataUuid(vesselTypeInput, 'vesselType');

    if (!vesselTypeUuid) {
      throw new Error(
        `Invalid vessel type: "${vesselTypeInput}". ` +
        `Not found in master_vessel_types table. ` +
        `Valid values: vessel type name (e.g., "Container") or UUID.`
      );
    }

    return vesselTypesAppliedRepository.create({
      cvtaUuid: uuidv4(),
      recCanUuid,
      vesselTypeUuid, // ✅ Always stores UUID
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  // ============================================================================
  // UPSERT PERSONAL DETAILS (with UUID resolution)
  // ============================================================================

  async upsertPersonalDetails(
    recCanUuid: string,
    data: Partial<InsertPersonalDetails>,
    userUuid?: string
  ): Promise<CandPersonalDetails> {

    // Resolve country if provided
    if ((data as any).placeOfBirthCountry || data.placeOfBirthCountryUuid) {
      const countryInput = data.placeOfBirthCountryUuid || (data as any).placeOfBirthCountry;
      const countryUuid = await this.resolveMasterDataUuid(countryInput, 'country');

      if (countryInput && !countryUuid) {
        throw new Error(`Invalid country: "${countryInput}"`);
      }

      data.placeOfBirthCountryUuid = countryUuid || undefined;
      delete (data as any).placeOfBirthCountry;
    }

    // Resolve language if provided
    if ((data as any).nativeLanguage || data.nativeLanguageUuid) {
      const langInput = data.nativeLanguageUuid || (data as any).nativeLanguage;
      const langUuid = await this.resolveMasterDataUuid(langInput, 'language');

      if (langInput && !langUuid) {
        throw new Error(`Invalid language: "${langInput}"`);
      }

      data.nativeLanguageUuid = langUuid || undefined;
      delete (data as any).nativeLanguage;
    }

    return personalDetailsRepository.upsert(recCanUuid, {
      cpdUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  // ============================================================================
  // UPSERT ADDRESS (with UUID resolution)
  // ============================================================================

  async upsertAddress(
    recCanUuid: string,
    data: Partial<InsertAddress>,
    userUuid?: string
  ): Promise<CandAddress> {

    // Resolve country if provided
    if ((data as any).countryOfResidence || data.countryOfResidenceUuid) {
      const countryInput = data.countryOfResidenceUuid || (data as any).countryOfResidence;
      const countryUuid = await this.resolveMasterDataUuid(countryInput, 'country');

      if (countryInput && !countryUuid) {
        throw new Error(`Invalid country: "${countryInput}"`);
      }

      data.countryOfResidenceUuid = countryUuid || undefined;
      delete (data as any).countryOfResidence;
    }

    return addressRepository.upsert(recCanUuid, {
      addrUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  // ============================================================================
  // GET ALL CANDIDATES (with JOIN resolution for READ)
  // ============================================================================

  async getAllCandidates(): Promise<CandidateListItem[]> {
    const db = getDb();

    // Step 1: Get all candidates with proper JOINs to resolve master data
    const candidatesWithMasterData = await db
      .select({
        // Candidate fields
        id: recruitmentCandidatesV2.id,
        recCanUuid: recruitmentCandidatesV2.recCanUuid,
        fileNo: recruitmentCandidatesV2.fileNo,
        firstName: recruitmentCandidatesV2.firstName,
        middleName: recruitmentCandidatesV2.middleName,
        familyName: recruitmentCandidatesV2.familyName,
        gender: recruitmentCandidatesV2.gender,
        dob: recruitmentCandidatesV2.dob,
        nationalityUuid: recruitmentCandidatesV2.nationalityUuid,
        presentRank: recruitmentCandidatesV2.presentRank,
        rankAppliedFor: recruitmentCandidatesV2.rankAppliedFor,
        status: recruitmentCandidatesV2.status,
        uploadedPhoto: recruitmentCandidatesV2.uploadedPhoto,
        createdAt: recruitmentCandidatesV2.createdAt,
        updatedAt: recruitmentCandidatesV2.updatedAt,
        createdByUuid: recruitmentCandidatesV2.createdByUuid,
        updatedByUuid: recruitmentCandidatesV2.updatedByUuid,
        isDeleted: recruitmentCandidatesV2.isDeleted,
        isSync: recruitmentCandidatesV2.isSync,

        // Resolved master data (ACTUAL NAMES, NOT UUIDs)
        nationalityName: masterNationalities.nationality,

        // Vessel type UUID (will be resolved in next step)
        vesselTypeUuid: candVesselTypesApplied.vesselTypeUuid,
      })
      .from(recruitmentCandidatesV2)
      .leftJoin(
        masterNationalities,
        eq(recruitmentCandidatesV2.nationalityUuid, masterNationalities.natUuid)
      )
      .leftJoin(
        candVesselTypesApplied,
        eq(recruitmentCandidatesV2.recCanUuid, candVesselTypesApplied.recCanUuid)
      )
      .where(eq(recruitmentCandidatesV2.isDeleted, false));

    // Step 2: Group candidates with multiple vessel types
    const candidateMap = new Map<string, CandidateListItem>();

    for (const row of candidatesWithMasterData) {
      const { nationalityName, vesselTypeUuid, ...candidateData } = row;

      if (!candidateMap.has(row.recCanUuid)) {
        // First time seeing this candidate
        candidateMap.set(row.recCanUuid, {
          ...candidateData,
          nationality: nationalityName || row.nationalityUuid || '', // ✅ Display name
          vesselType: '',  // Will be set below
        });
      }

      // Set primary vessel type (first one encountered)
      const candidate = candidateMap.get(row.recCanUuid)!;
      if (!candidate.vesselType && vesselTypeUuid) {
        candidate.vesselType = vesselTypeUuid;
      }
    }

    // Step 3: Resolve all vessel type UUIDs to names in a single query
    const vesselTypeUuids = Array.from(candidateMap.values())
      .map(c => c.vesselType)
      .filter(Boolean);

    if (vesselTypeUuids.length > 0) {
      const vesselTypes = await db
        .select({
          vesselTypeUuid: masterVesselTypes.vesselTypeUuid,
          vesselTypeName: masterVesselTypes.vesselType,
        })
        .from(masterVesselTypes)
        .where(sql`${masterVesselTypes.vesselTypeUuid} = ANY(${vesselTypeUuids})`);

      const vesselTypeLookup = new Map(
        vesselTypes.map(vt => [vt.vesselTypeUuid, vt.vesselTypeName])
      );

      // Replace UUIDs with actual names
      for (const candidate of candidateMap.values()) {
        if (candidate.vesselType) {
          candidate.vesselType = vesselTypeLookup.get(candidate.vesselType) || candidate.vesselType;
        }
      }
    }

    return Array.from(candidateMap.values());
  }

  // ... keep all other existing methods (getCandidateById, updateCandidate, deleteCandidate, etc.)
}

export const candidateService = new CandidateService();
```

---

## PART B: Update Controller Error Handling

**File: `server/v2/recruitment/controllers/candidateController.ts`**

```typescript
import { Request, Response } from "express";
import { candidateService } from "../services";
import { createCandidateRequestSchema } from "../../../../shared/v2/recruitment/types";

export async function createCandidate(req: Request, res: Response) {
  try {
    const parsed = createCandidateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors
      });
    }

    // Service layer will automatically resolve:
    // - "Indian" → "nat-uuid-123"
    // - "nat-uuid-123" → "nat-uuid-123" (passthrough)
    const candidate = await candidateService.createCandidate(parsed.data);

    res.status(201).json(candidate);
  } catch (error) {
    console.error("Error creating candidate:", error);

    // Return helpful error for invalid master data
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: error.message,
        hint: "Ensure the value exists in the corresponding master data table",
        examples: {
          nationality: "Indian, British, Filipino (or UUID)",
          vesselType: "Container, Bulk Carrier, Tanker (or UUID)"
        }
      });
    }

    res.status(500).json({ error: "Failed to create candidate" });
  }
}

export async function updateCandidateByUuid(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const candidate = await candidateService.updateCandidateByUuid(recCanUuid, req.body);

    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    res.json(candidate);
  } catch (error) {
    console.error("Error updating candidate:", error);

    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to update candidate" });
  }
}

export async function addVesselTypeApplied(req: Request, res: Response) {
  try {
    const { recCanUuid } = req.params;
    const { vesselTypeUuid, vesselType } = req.body;

    // Accept either vesselTypeUuid or vesselType
    const input = vesselTypeUuid || vesselType;

    if (!input) {
      return res.status(400).json({
        error: "Either vesselTypeUuid or vesselType is required"
      });
    }

    const vesselTypeRecord = await candidateService.addVesselTypeApplied(recCanUuid, input);
    res.status(201).json(vesselTypeRecord);
  } catch (error) {
    console.error("Error adding vessel type:", error);

    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to add vessel type" });
  }
}

// ... keep all other controller functions
```

---

## PART C: Update Validation Schema (Optional)

**File: `shared/v2/recruitment/types.ts`**

```typescript
import { z } from 'zod';

export const createCandidateRequestSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  middleName: z.string().optional(),
  familyName: z.string().min(1, "Family name required"),

  // Accept EITHER UUID or name (service layer will resolve)
  nationalityUuid: z.string().optional(),
  nationality: z.string().optional(), // Fallback if frontend sends name

  rankAppliedFor: z.string().optional(),
  status: z.string().optional(),
  gender: z.string().optional(),
  dob: z.string().optional(),
  presentRank: z.string().optional(),
  uploadedPhoto: z.string().optional(),
  fileNo: z.string().optional(),
}).refine(
  (data) => data.nationalityUuid || data.nationality,
  {
    message: "Either nationalityUuid or nationality must be provided",
    path: ["nationalityUuid"]
  }
);

export type CreateCandidateRequest = z.infer<typeof createCandidateRequestSchema>;
```

---

## Testing the Complete Fix

### Test 1: Create Candidate with Name (Not UUID)

```bash
curl -X POST http://localhost:3000/api/v2/recruitment/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "familyName": "Doe",
    "nationality": "Indian",
    "rankAppliedFor": "Master"
  }'
```

**Expected Database Record:**
```sql
SELECT * FROM recruitment_candidates_v2 WHERE first_name = 'John';

-- Should show:
-- nationality_uuid: "nat-uuid-123" ✅ (NOT "Indian")
```

### Test 2: Create Candidate with UUID (Passthrough)

```bash
curl -X POST http://localhost:3000/api/v2/recruitment/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "familyName": "Smith",
    "nationalityUuid": "nat-uuid-456",
    "rankAppliedFor": "Chief Officer"
  }'
```

**Expected Database Record:**
```sql
-- nationality_uuid: "nat-uuid-456" ✅ (UUID passthrough)
```

### Test 3: Get All Candidates (Returns Resolved Names)

```bash
curl http://localhost:3000/api/v2/recruitment/candidates | jq '.[0]'
```

**Expected API Response:**
```json
{
  "recCanUuid": "rec-can-uuid-001",
  "firstName": "John",
  "familyName": "Doe",
  "nationalityUuid": "nat-uuid-123",  // ✅ UUID (for form binding)
  "nationality": "Indian",             // ✅ Name (for display)
  "rankAppliedFor": "Master",
  "vesselType": "Container",           // ✅ Name (for display)
  "status": "Draft"
}
```

### Test 4: Invalid Master Data Value

```bash
curl -X POST http://localhost:3000/api/v2/recruitment/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "familyName": "Invalid",
    "nationality": "NonExistentCountry"
  }'
```

**Expected Error Response (400):**
```json
{
  "error": "Invalid nationality: \"NonExistentCountry\". Not found in master_nationalities table. Valid values: nationality name (e.g., \"Indian\") or UUID.",
  "hint": "Ensure the value exists in the corresponding master data table",
  "examples": {
    "nationality": "Indian, British, Filipino (or UUID)",
    "vesselType": "Container, Bulk Carrier, Tanker (or UUID)"
  }
}
```

---

## Summary: What This Fix Does

### WRITE Operations (Insert/Update):
✅ Accepts **either** name ("Indian") **or** UUID ("nat-uuid-123")
✅ Automatically resolves name → UUID before saving
✅ Stores **only UUIDs** in foreign key columns
✅ Validates against master data tables
✅ Returns helpful error if master data value not found

### READ Operations (Fetch/Display):
✅ JOINs with master data tables
✅ Returns **both** UUID (for forms) and name (for display)
✅ Uses single query with JOINs (no N+1)
✅ Handles missing master data gracefully (fallback to UUID)

### Complete Data Flow:
```
Frontend sends: { nationality: "Indian" }
      ↓
Service resolves: "Indian" → "nat-uuid-123"
      ↓
Database stores: { nationality_uuid: "nat-uuid-123" }
      ↓
Database fetches with JOIN:
  SELECT c.*, n.nationality
  FROM candidates c
  LEFT JOIN master_nationalities n ON c.nationality_uuid = n.nat_uuid
      ↓
API returns: { nationalityUuid: "nat-uuid-123", nationality: "Indian" }
      ↓
Frontend displays: "Indian" ✅
Frontend form binds: "nat-uuid-123" ✅
```

---

## Rollback Plan

If issues occur:

```typescript
// Revert to original getAllCandidates:
async getAllCandidates(): Promise<CandidateListItem[]> {
  const candidates = await candidateRepository.findAll();

  const enrichedCandidates: CandidateListItem[] = await Promise.all(
    candidates.map(async (candidate) => {
      const vesselTypes = await vesselTypesAppliedRepository.findByCandidateUuid(candidate.recCanUuid);
      const primaryVesselType = vesselTypes.length > 0 ? vesselTypes[0].vesselTypeUuid || '' : '';

      return {
        ...candidate,
        nationality: candidate.nationalityUuid || '',
        vesselType: primaryVesselType,
      };
    })
  );

  return enrichedCandidates;
}
```

---

## Files Modified

1. ✅ `server/v2/recruitment/services/candidateService.ts` - Added UUID resolution
2. ✅ `server/v2/recruitment/controllers/candidateController.ts` - Better error handling
3. ✅ `shared/v2/recruitment/types.ts` - Flexible validation schema

---

## Next Steps

After applying this fix:
1. Run STEP 1 (Add Indexes) first if not done already
2. Apply this STEP 2 (Master Data Resolution)
3. Test all endpoints thoroughly
4. Monitor error logs for any "Invalid [masterData]" errors
5. Add more master data validation as needed for other fields (ports, languages, etc.)
