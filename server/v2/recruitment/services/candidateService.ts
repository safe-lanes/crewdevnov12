import { v4 as uuidv4 } from "uuid";
import { eq, or, inArray, asc, and } from "drizzle-orm";
import { getDb } from "../../db";
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
  candPersonalDetails,
  candAddresses,
} from "../../../../shared/v2/recruitment/schema";
import {
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

// Standard UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CandidateListItem extends RecruitmentCandidate {
  nationality: string;
  vesselType: string;
}

export class CandidateService {
  // ============================================================================
  // MASTER DATA UUID RESOLUTION (WRITE OPERATIONS)
  // ============================================================================

  /**
   * Check if a string is a valid UUID format
   */
  private isValidUuid(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  /**
   * Resolve master data value/name to UUID
   * Handles both:
   * - UUID input: "550e8400-e29b-41d4-a716-446655440000" → validated and returned as-is
   * - Name input: "Indian" → lookup and return "nat-uuid-123"
   * - Code input: "IN" → lookup and return "nat-uuid-123"
   */
  private async resolveMasterDataUuid(
    value: string | null | undefined,
    masterTable: 'nationality' | 'vesselType' | 'country' | 'language' | 'port' | 'fleetGroup' | 'vessel'
  ): Promise<string | null> {
    if (!value || value.trim() === '') {
      return null;
    }

    const db = getDb();

    // If it's a valid UUID format, verify it exists in the master table
    if (this.isValidUuid(value)) {
      // Verify the UUID exists in the master table
      try {
        let exists = false;
        switch (masterTable) {
          case 'nationality': {
            const result = await db
              .select({ uuid: masterNationalities.natUuid })
              .from(masterNationalities)
              .where(eq(masterNationalities.natUuid, value))
              .limit(1);
            exists = result.length > 0;
            break;
          }
          case 'vesselType': {
            const result = await db
              .select({ uuid: masterVesselTypes.vtUuid })
              .from(masterVesselTypes)
              .where(eq(masterVesselTypes.vtUuid, value))
              .limit(1);
            exists = result.length > 0;
            break;
          }
          case 'country': {
            const result = await db
              .select({ uuid: masterCountries.countryUuid })
              .from(masterCountries)
              .where(eq(masterCountries.countryUuid, value))
              .limit(1);
            exists = result.length > 0;
            break;
          }
          case 'language': {
            const result = await db
              .select({ uuid: masterLanguages.langUuid })
              .from(masterLanguages)
              .where(eq(masterLanguages.langUuid, value))
              .limit(1);
            exists = result.length > 0;
            break;
          }
          case 'port': {
            const result = await db
              .select({ uuid: masterPorts.portUuid })
              .from(masterPorts)
              .where(eq(masterPorts.portUuid, value))
              .limit(1);
            exists = result.length > 0;
            break;
          }
          case 'fleetGroup': {
            const result = await db
              .select({ uuid: masterFleetGroups.fgUuid })
              .from(masterFleetGroups)
              .where(eq(masterFleetGroups.fgUuid, value))
              .limit(1);
            exists = result.length > 0;
            break;
          }
          case 'vessel': {
            const result = await db
              .select({ uuid: masterVessels.vesselUuid })
              .from(masterVessels)
              .where(eq(masterVessels.vesselUuid, value))
              .limit(1);
            exists = result.length > 0;
            break;
          }
        }
        return exists ? value : null;
      } catch (error) {
        console.error(`Error verifying ${masterTable} UUID "${value}":`, error);
        return null;
      }
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
                eq(masterNationalities.countryCode, value),
                eq(masterNationalities.countryName, value)
              )
            )
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'vesselType': {
          const result = await db
            .select({ uuid: masterVesselTypes.vtUuid })
            .from(masterVesselTypes)
            .where(eq(masterVesselTypes.vesselType, value))
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'country': {
          const result = await db
            .select({ uuid: masterCountries.countryUuid })
            .from(masterCountries)
            .where(eq(masterCountries.countryName, value))
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'language': {
          const result = await db
            .select({ uuid: masterLanguages.langUuid })
            .from(masterLanguages)
            .where(
              or(
                eq(masterLanguages.languageName, value),
                eq(masterLanguages.isoCode, value),
                eq(masterLanguages.nativeName, value)
              )
            )
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'port': {
          const result = await db
            .select({ uuid: masterPorts.portUuid })
            .from(masterPorts)
            .where(
              or(
                eq(masterPorts.name, value),
                eq(masterPorts.portcode, value)
              )
            )
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'fleetGroup': {
          const result = await db
            .select({ uuid: masterFleetGroups.fgUuid })
            .from(masterFleetGroups)
            .where(eq(masterFleetGroups.name, value))
            .limit(1);
          return result[0]?.uuid || null;
        }

        case 'vessel': {
          const result = await db
            .select({ uuid: masterVessels.vesselUuid })
            .from(masterVessels)
            .where(
              or(
                eq(masterVessels.vessel, value),
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
        and(
          eq(recruitmentCandidatesV2.recCanUuid, candVesselTypesApplied.recCanUuid),
          eq(candVesselTypesApplied.isDeleted, false)
        )
      )
      .where(eq(recruitmentCandidatesV2.isDeleted, false))
      .orderBy(asc(candVesselTypesApplied.sortOrder));

    // Step 2: Group candidates with multiple vessel types
    const candidateMap = new Map<string, CandidateListItem>();

    for (const row of candidatesWithMasterData) {
      const { nationalityName, vesselTypeUuid, ...candidateData } = row;

      if (!candidateMap.has(row.recCanUuid)) {
        // First time seeing this candidate
        candidateMap.set(row.recCanUuid, {
          ...candidateData,
          nationality: nationalityName || row.nationalityUuid || '',
          vesselType: '',
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
          vesselTypeUuid: masterVesselTypes.vtUuid,
          vesselTypeName: masterVesselTypes.vesselType,
        })
        .from(masterVesselTypes)
        .where(inArray(masterVesselTypes.vtUuid, vesselTypeUuids));

      const vesselTypeLookup = new Map<string | null, string | null>(
        vesselTypes.map((vt: { vesselTypeUuid: string | null; vesselTypeName: string | null }) => [vt.vesselTypeUuid, vt.vesselTypeName])
      );

      // Replace UUIDs with actual names
      Array.from(candidateMap.values()).forEach((candidate) => {
        if (candidate.vesselType) {
          candidate.vesselType = vesselTypeLookup.get(candidate.vesselType) || candidate.vesselType;
        }
      });
    }

    return Array.from(candidateMap.values());
  }

  async getCandidateById(id: number): Promise<RecruitmentCandidate | undefined> {
    return candidateRepository.findById(id);
  }

  async getCandidateByUuid(recCanUuid: string): Promise<(RecruitmentCandidate & { nationalityName?: string }) | undefined> {
    const db = getDb();
    
    const result = await db
      .select({
        id: recruitmentCandidatesV2.id,
        recCanUuid: recruitmentCandidatesV2.recCanUuid,
        firstName: recruitmentCandidatesV2.firstName,
        middleName: recruitmentCandidatesV2.middleName,
        familyName: recruitmentCandidatesV2.familyName,
        gender: recruitmentCandidatesV2.gender,
        dob: recruitmentCandidatesV2.dob,
        nationalityUuid: recruitmentCandidatesV2.nationalityUuid,
        presentRank: recruitmentCandidatesV2.presentRank,
        rankAppliedFor: recruitmentCandidatesV2.rankAppliedFor,
        fileNo: recruitmentCandidatesV2.fileNo,
        status: recruitmentCandidatesV2.status,
        uploadedPhoto: recruitmentCandidatesV2.uploadedPhoto,
        createdAt: recruitmentCandidatesV2.createdAt,
        updatedAt: recruitmentCandidatesV2.updatedAt,
        createdByUuid: recruitmentCandidatesV2.createdByUuid,
        updatedByUuid: recruitmentCandidatesV2.updatedByUuid,
        isDeleted: recruitmentCandidatesV2.isDeleted,
        isSync: recruitmentCandidatesV2.isSync,
        nationalityName: masterNationalities.nationality,
      })
      .from(recruitmentCandidatesV2)
      .leftJoin(
        masterNationalities,
        eq(recruitmentCandidatesV2.nationalityUuid, masterNationalities.natUuid)
      )
      .where(eq(recruitmentCandidatesV2.recCanUuid, recCanUuid))
      .limit(1);

    if (result.length === 0) return undefined;

    const { nationalityName, ...candidateData } = result[0];
    return {
      ...candidateData,
      nationalityName: nationalityName || undefined,
    };
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
    let nationalityUuid: string | null = null;
    
    if (nationalityInput) {
      nationalityUuid = await this.resolveMasterDataUuid(nationalityInput, 'nationality');

      if (!nationalityUuid) {
        throw new Error(
          `Invalid nationality: "${nationalityInput}". ` +
          `Not found in master_nationalities table. ` +
          `Valid values: nationality name (e.g., "Indian") or UUID.`
        );
      }
    }

    // Delete alias field to prevent it from being passed to repository
    const cleanData = { ...data };
    delete (cleanData as any).nationality;

    return candidateRepository.create({
      recCanUuid,
      ...cleanData,
      nationalityUuid,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  // ============================================================================
  // UPDATE CANDIDATE (with UUID resolution)
  // ============================================================================

  async updateCandidate(
    id: number,
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

      data.nationalityUuid = nationalityUuid;
      delete (data as any).nationality;
    }

    return candidateRepository.update(id, {
      ...data,
      updatedByUuid,
    });
  }

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

      data.nationalityUuid = nationalityUuid;
      delete (data as any).nationality;
    }

    return candidateRepository.updateByUuid(recCanUuid, {
      ...data,
      updatedByUuid,
    });
  }

  async deleteCandidate(id: number): Promise<boolean> {
    return candidateRepository.softDelete(id);
  }

  async deleteCandidateByUuid(recCanUuid: string): Promise<boolean> {
    return candidateRepository.softDeleteByUuid(recCanUuid);
  }

  // ============================================================================
  // VESSEL TYPES (with UUID resolution)
  // ============================================================================

  async getVesselTypesApplied(recCanUuid: string): Promise<(CandVesselTypeApplied & { vesselTypeName?: string })[]> {
    const db = getDb();
    
    const result = await db
      .select({
        id: candVesselTypesApplied.id,
        cvtaUuid: candVesselTypesApplied.cvtaUuid,
        recCanUuid: candVesselTypesApplied.recCanUuid,
        vesselTypeUuid: candVesselTypesApplied.vesselTypeUuid,
        sortOrder: candVesselTypesApplied.sortOrder,
        isDeleted: candVesselTypesApplied.isDeleted,
        createdAt: candVesselTypesApplied.createdAt,
        updatedAt: candVesselTypesApplied.updatedAt,
        createdByUuid: candVesselTypesApplied.createdByUuid,
        updatedByUuid: candVesselTypesApplied.updatedByUuid,
        vesselTypeName: masterVesselTypes.vesselType,
      })
      .from(candVesselTypesApplied)
      .leftJoin(
        masterVesselTypes,
        eq(candVesselTypesApplied.vesselTypeUuid, masterVesselTypes.vtUuid)
      )
      .where(
        and(
          eq(candVesselTypesApplied.recCanUuid, recCanUuid),
          eq(candVesselTypesApplied.isDeleted, false)
        )
      )
      .orderBy(asc(candVesselTypesApplied.sortOrder));

    return result.map((row) => ({
      id: row.id,
      cvtaUuid: row.cvtaUuid,
      recCanUuid: row.recCanUuid,
      vesselTypeUuid: row.vesselTypeUuid,
      sortOrder: row.sortOrder,
      isDeleted: row.isDeleted,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByUuid: row.createdByUuid,
      updatedByUuid: row.updatedByUuid,
      vesselTypeName: row.vesselTypeName || undefined,
    }));
  }

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
      vesselTypeUuid,
      createdByUuid,
      updatedByUuid: createdByUuid,
    });
  }

  async removeVesselTypeApplied(id: number): Promise<boolean> {
    return vesselTypesAppliedRepository.softDelete(id);
  }

  async replaceVesselTypes(
    recCanUuid: string,
    vesselTypeInputs: string[],
    createdByUuid?: string
  ): Promise<CandVesselTypeApplied[]> {
    // First validate all inputs before deleting existing records
    const invalidInputs: string[] = [];
    const resolvedUuids: (string | null)[] = [];
    
    for (const input of vesselTypeInputs) {
      const vesselTypeUuid = await this.resolveMasterDataUuid(input, 'vesselType');
      resolvedUuids.push(vesselTypeUuid);
      if (!vesselTypeUuid) {
        invalidInputs.push(input);
      }
    }
    
    // Throw error if any inputs are invalid
    if (invalidInputs.length > 0) {
      throw new Error(
        `Invalid vessel types: ${invalidInputs.map(i => `"${i}"`).join(', ')}. ` +
        `Not found in master_vessel_types table.`
      );
    }

    // All inputs validated, now delete and recreate
    await vesselTypesAppliedRepository.deleteByCandidateUuid(recCanUuid);
    const results: CandVesselTypeApplied[] = [];
    
    for (let i = 0; i < resolvedUuids.length; i++) {
      const vesselTypeUuid = resolvedUuids[i];
      if (!vesselTypeUuid) continue;

      const vt = await vesselTypesAppliedRepository.create({
        cvtaUuid: uuidv4(),
        recCanUuid,
        vesselTypeUuid,
        sortOrder: i,
        createdByUuid,
        updatedByUuid: createdByUuid,
      });
      results.push(vt);
    }
    return results;
  }

  // ============================================================================
  // PERSONAL DETAILS (with UUID resolution)
  // ============================================================================

  async getPersonalDetails(recCanUuid: string): Promise<(CandPersonalDetails & { placeOfBirthCountryName?: string; nativeLanguageName?: string }) | undefined> {
    const db = getDb();
    
    const result = await db
      .select({
        id: candPersonalDetails.id,
        cpdUuid: candPersonalDetails.cpdUuid,
        recCanUuid: candPersonalDetails.recCanUuid,
        heightCm: candPersonalDetails.heightCm,
        weightKg: candPersonalDetails.weightKg,
        placeOfBirthCity: candPersonalDetails.placeOfBirthCity,
        placeOfBirthCountryUuid: candPersonalDetails.placeOfBirthCountryUuid,
        ageInYears: candPersonalDetails.ageInYears,
        nativeLanguageUuid: candPersonalDetails.nativeLanguageUuid,
        foreignLanguages: candPersonalDetails.foreignLanguages,
        englishProficiency: candPersonalDetails.englishProficiency,
        manningAgent: candPersonalDetails.manningAgent,
        isDeleted: candPersonalDetails.isDeleted,
        isSync: candPersonalDetails.isSync,
        createdAt: candPersonalDetails.createdAt,
        updatedAt: candPersonalDetails.updatedAt,
        createdByUuid: candPersonalDetails.createdByUuid,
        updatedByUuid: candPersonalDetails.updatedByUuid,
        placeOfBirthCountryName: masterCountries.countryName,
        nativeLanguageName: masterLanguages.languageName,
      })
      .from(candPersonalDetails)
      .leftJoin(
        masterCountries,
        eq(candPersonalDetails.placeOfBirthCountryUuid, masterCountries.countryUuid)
      )
      .leftJoin(
        masterLanguages,
        eq(candPersonalDetails.nativeLanguageUuid, masterLanguages.langUuid)
      )
      .where(eq(candPersonalDetails.recCanUuid, recCanUuid))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      id: row.id,
      cpdUuid: row.cpdUuid,
      recCanUuid: row.recCanUuid,
      heightCm: row.heightCm,
      weightKg: row.weightKg,
      placeOfBirthCity: row.placeOfBirthCity,
      placeOfBirthCountryUuid: row.placeOfBirthCountryUuid,
      ageInYears: row.ageInYears,
      nativeLanguageUuid: row.nativeLanguageUuid,
      foreignLanguages: row.foreignLanguages,
      englishProficiency: row.englishProficiency,
      manningAgent: row.manningAgent,
      isDeleted: row.isDeleted,
      isSync: row.isSync,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByUuid: row.createdByUuid,
      updatedByUuid: row.updatedByUuid,
      placeOfBirthCountryName: row.placeOfBirthCountryName || undefined,
      nativeLanguageName: row.nativeLanguageName || undefined,
    };
  }

  async upsertPersonalDetails(
    recCanUuid: string,
    data: Partial<InsertPersonalDetails>,
    userUuid?: string
  ): Promise<CandPersonalDetails> {
    // Resolve country if provided
    const countryInput = data.placeOfBirthCountryUuid || (data as any).placeOfBirthCountry;
    if (countryInput) {
      const countryUuid = await this.resolveMasterDataUuid(countryInput, 'country');

      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}"`);
      }

      data.placeOfBirthCountryUuid = countryUuid;
      delete (data as any).placeOfBirthCountry;
    }

    // Resolve language if provided
    const langInput = data.nativeLanguageUuid || (data as any).nativeLanguage;
    if (langInput) {
      const langUuid = await this.resolveMasterDataUuid(langInput, 'language');

      if (!langUuid) {
        throw new Error(`Invalid language: "${langInput}"`);
      }

      data.nativeLanguageUuid = langUuid;
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
  // ADDRESS (with UUID resolution)
  // ============================================================================

  async getAddress(recCanUuid: string): Promise<(CandAddress & { countryOfResidenceName?: string }) | undefined> {
    const db = getDb();
    
    const result = await db
      .select({
        id: candAddresses.id,
        addrUuid: candAddresses.addrUuid,
        recCanUuid: candAddresses.recCanUuid,
        countryOfResidenceUuid: candAddresses.countryOfResidenceUuid,
        nearestAirport: candAddresses.nearestAirport,
        addressLine1: candAddresses.addressLine1,
        addressLine2: candAddresses.addressLine2,
        contactLandline: candAddresses.contactLandline,
        mobile: candAddresses.mobile,
        email: candAddresses.email,
        isDeleted: candAddresses.isDeleted,
        isSync: candAddresses.isSync,
        createdAt: candAddresses.createdAt,
        updatedAt: candAddresses.updatedAt,
        createdByUuid: candAddresses.createdByUuid,
        updatedByUuid: candAddresses.updatedByUuid,
        countryOfResidenceName: masterCountries.countryName,
      })
      .from(candAddresses)
      .leftJoin(
        masterCountries,
        eq(candAddresses.countryOfResidenceUuid, masterCountries.countryUuid)
      )
      .where(eq(candAddresses.recCanUuid, recCanUuid))
      .limit(1);

    if (result.length === 0) return undefined;

    const row = result[0];
    return {
      id: row.id,
      addrUuid: row.addrUuid,
      recCanUuid: row.recCanUuid,
      countryOfResidenceUuid: row.countryOfResidenceUuid,
      nearestAirport: row.nearestAirport,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      contactLandline: row.contactLandline,
      mobile: row.mobile,
      email: row.email,
      isDeleted: row.isDeleted,
      isSync: row.isSync,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByUuid: row.createdByUuid,
      updatedByUuid: row.updatedByUuid,
      countryOfResidenceName: row.countryOfResidenceName || undefined,
    };
  }

  async upsertAddress(
    recCanUuid: string,
    data: Partial<InsertAddress>,
    userUuid?: string
  ): Promise<CandAddress> {
    // Resolve country if provided
    const countryInput = data.countryOfResidenceUuid || (data as any).countryOfResidence;
    if (countryInput) {
      const countryUuid = await this.resolveMasterDataUuid(countryInput, 'country');

      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}"`);
      }

      data.countryOfResidenceUuid = countryUuid;
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
  // FAMILY INFO
  // ============================================================================

  async getFamilyInfo(recCanUuid: string): Promise<CandFamilyInfo | undefined> {
    return familyInfoRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertFamilyInfo(
    recCanUuid: string,
    data: Partial<InsertFamilyInfo>,
    userUuid?: string
  ): Promise<CandFamilyInfo> {
    return familyInfoRepository.upsert(recCanUuid, {
      famUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }

  // ============================================================================
  // CHILDREN
  // ============================================================================

  async getChildren(recCanUuid: string): Promise<CandChild[]> {
    return childrenRepository.findByCandidateUuid(recCanUuid);
  }

  async createChild(
    recCanUuid: string,
    data: Partial<InsertChild>,
    createdByUuid?: string
  ): Promise<CandChild> {
    return childrenRepository.create({
      childUuid: uuidv4(),
      recCanUuid,
      ...data,
      createdByUuid,
      updatedByUuid: createdByUuid,
    } as InsertChild);
  }

  async updateChild(
    id: number,
    data: Partial<InsertChild>,
    updatedByUuid?: string
  ): Promise<CandChild | undefined> {
    return childrenRepository.update(id, {
      ...data,
      updatedByUuid,
    });
  }

  async deleteChild(id: number): Promise<boolean> {
    return childrenRepository.softDelete(id);
  }

  async replaceChildren(
    recCanUuid: string,
    children: Partial<InsertChild>[],
    createdByUuid?: string
  ): Promise<CandChild[]> {
    await childrenRepository.deleteByCandidateUuid(recCanUuid);
    const results: CandChild[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (!child.firstName?.trim()) continue;
      const created = await childrenRepository.create({
        childUuid: uuidv4(),
        recCanUuid,
        firstName: child.firstName,
        middleName: child.middleName,
        familyName: child.familyName,
        dob: child.dob,
        gender: child.gender,
        sortOrder: i,
        createdByUuid,
        updatedByUuid: createdByUuid,
      } as InsertChild);
      results.push(created);
    }
    return results;
  }

  // ============================================================================
  // NEXT OF KIN
  // ============================================================================

  async getNextOfKin(recCanUuid: string): Promise<CandNextOfKin | undefined> {
    return nextOfKinRepository.findByCandidateUuid(recCanUuid);
  }

  async upsertNextOfKin(
    recCanUuid: string,
    data: Partial<InsertNextOfKin>,
    userUuid?: string
  ): Promise<CandNextOfKin> {
    return nextOfKinRepository.upsert(recCanUuid, {
      nokUuid: uuidv4(),
      ...data,
      createdByUuid: userUuid,
      updatedByUuid: userUuid,
    });
  }
}

export const candidateService = new CandidateService();
