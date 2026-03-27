import { eq, and, asc, desc, or, ilike, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { CrewMembersRepository } from "../repositories";
import {
  crewMembersV2,
  crewAssignments,
  crewPersonalDetails,
  crewAddresses,
  crewFamilyInfo,
  crewChildren,
  crewNextOfKin,
  crewDocuments,
  crewDocumentsAttachments,
  crewVisas,
  crewVisasAttachments,
  crewEducation,
  crewEducationAttachments,
  crewLicenses,
  crewLicensesAttachments,
  crewTrainingCourses,
  crewTrainingAttachments,
  crewSeaService,
  crewSeaServiceAttachments,
  crewPreJoiningMedicals,
  crewMedicalAttachments,
  crewDoctorVisits,
  crewDoctorVisitsAttachments,
  crewVesselTypesApplied,
} from "../../../../shared/v2/crew-pool/schema";
import {
  masterNationalities,
  masterVesselTypes,
  masterVessels,
  masterCountries,
  masterLanguages,
} from "../../../../shared/schema";
import type {
  InsertCrewMemberV2,
  CrewMemberV2,
  InsertCrewPersonalDetails,
  InsertCrewAddress,
  InsertCrewFamilyInfo,
  InsertCrewChild,
  InsertCrewNextOfKin,
  CrewPersonalDetails,
  CrewAddress,
  CrewFamilyInfo,
  CrewChild,
  CrewNextOfKin,
} from "../../../../shared/v2/crew-pool/types";

const crewMembersRepository = new CrewMembersRepository();

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  pages: number;
  currentPage: number;
}

interface CrewFullProfile {
  crew: CrewMemberV2;
  personalDetails: CrewPersonalDetails | null;
  address: CrewAddress | null;
  familyInfo: CrewFamilyInfo | null;
  children: CrewChild[];
  nextOfKin: CrewNextOfKin | null;
  documents: any[];
  visas: any[];
  education: any[];
  licenses: any[];
  trainingCourses: any[];
  seaService: any[];
  medicals: any[];
  doctorVisits: any[];
}

import {
  resolveMasterDataUuid,
  resolveNationalityUuid,
  resolveVesselTypeUuid,
} from "./masterDataResolver";

// Helper to extract and apply audit user fields
function applyAuditUser<T extends object>(data: T, isCreate = false): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;
  
  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;
  
  return result;
}

export const crewMembersService = {
  async getAll(filters?: {
    status?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<CrewMemberV2[]> {
    return crewMembersRepository.findAll(filters);
  },

  async getAllEnriched(filters?: {
    status?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<any[]> {
    const db = getDb();
    const { vesselPlanningV2 } = await import("../../../../shared/v2/vessel/schema");

    const conditions: any[] = [
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
    ];
    if (filters?.status) {
      conditions.push(eq(crewMembersV2.status, filters.status));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(crewMembersV2.isActive, filters.isActive));
    }

    const results = await db
      .select({
        id: crewMembersV2.id,
        crewUuid: crewMembersV2.crewUuid,
        empNo: crewMembersV2.empNo,
        employeeId: crewMembersV2.employeeId,
        firstName: crewMembersV2.firstName,
        middleName: crewMembersV2.middleName,
        familyName: crewMembersV2.familyName,
        gender: crewMembersV2.gender,
        dob: crewMembersV2.dob,
        nationalityUuid: crewMembersV2.nationalityUuid,
        nationalityName: masterNationalities.nationality,
        presentRank: crewMembersV2.presentRank,
        rankAppliedFor: crewMembersV2.rankAppliedFor,
        status: crewMembersV2.status,
        isActive: crewMembersV2.isActive,
        uploadedPhoto: crewMembersV2.uploadedPhoto,
        vesselTypeUuid: crewMembersV2.vesselTypeUuid,
        availability: crewMembersV2.availability,
        nextAvailability: crewMembersV2.nextAvailability,
        vesselUuid: vesselPlanningV2.vesselUuid,
        vesselName: masterVessels.vessel,
        manningAgentName: crewPersonalDetails.manningAgent,
      })
      .from(crewMembersV2)
      .leftJoin(crewPersonalDetails, eq(crewMembersV2.crewUuid, crewPersonalDetails.crewUuid))
      .leftJoin(masterNationalities, eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid))
      .leftJoin(
        vesselPlanningV2,
        and(
          eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false),
        )
      )
      .leftJoin(masterVessels, eq(vesselPlanningV2.vesselUuid, masterVessels.vesselUuid))
      .where(and(...conditions))
      .orderBy(desc(crewMembersV2.createdAt));

    const uniqueByEmpNo = new Map<string, any>();
    for (const row of results) {
      const key = row.empNo || row.crewUuid || String(row.id);
      if (!uniqueByEmpNo.has(key)) {
        uniqueByEmpNo.set(key, row);
      }
    }

    let enriched = Array.from(uniqueByEmpNo.values());

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      enriched = enriched.filter(
        (crew: any) =>
          crew.firstName?.toLowerCase().includes(searchLower) ||
          crew.familyName?.toLowerCase().includes(searchLower) ||
          crew.empNo?.toLowerCase().includes(searchLower) ||
          crew.employeeId?.toLowerCase().includes(searchLower)
      );
    }

    return enriched;
  },

  async getById(id: number): Promise<CrewMemberV2> {
    const crew = await crewMembersRepository.findById(id);
    if (!crew) {
      throw new Error(`Crew member not found with id: ${id}`);
    }
    return crew;
  },

  async getByUuid(crewUuid: string): Promise<CrewMemberV2> {
    const crew = await crewMembersRepository.findByUuid(crewUuid);
    if (!crew) {
      throw new Error(`Crew member not found: ${crewUuid}`);
    }
    return crew;
  },

  async getByEmpNo(empNo: string): Promise<CrewMemberV2> {
    const crew = await crewMembersRepository.findByEmpNo(empNo);
    if (!crew) {
      throw new Error(`Crew member not found with employee number: ${empNo}`);
    }
    return crew;
  },

  async create(
    data: Omit<InsertCrewMemberV2, "crewUuid"> & { nationality?: string; vesselType?: string }
  ): Promise<CrewMemberV2> {
    if (!data.firstName) {
      throw new Error("First name is required");
    }
    
    // Auto-generate empNo if not provided
    let empNo = data.empNo;
    if (!empNo) {
      empNo = await this.generateEmpNo();
    }

    const existing = await crewMembersRepository.findByEmpNo(empNo);
    if (existing) {
      throw new Error(
        `Crew member with employee number ${empNo} already exists`
      );
    }

    // Resolve nationality: Accept "Indian" OR "nat-uuid-123"
    const nationalityInput = data.nationalityUuid || data.nationality;
    const nationalityUuid = await resolveMasterDataUuid(nationalityInput, 'nationality');
    if (nationalityInput && !nationalityUuid) {
      throw new Error(
        `Invalid nationality: "${nationalityInput}". ` +
        `Not found in master_nationalities table.`
      );
    }

    // Resolve vessel type: Accept "Container" OR "vt-uuid-123"
    const vesselTypeInput = data.vesselTypeUuid || data.vesselType;
    const vesselTypeUuid = await resolveMasterDataUuid(vesselTypeInput, 'vesselType');
    if (vesselTypeInput && !vesselTypeUuid) {
      throw new Error(
        `Invalid vessel type: "${vesselTypeInput}". ` +
        `Not found in master_vessel_types table.`
      );
    }

    // Remove non-schema fields and replace with resolved UUIDs
    const { nationality, vesselType, ...cleanData } = data as any;
    
    // Apply audit user fields
    const dataWithAudit = applyAuditUser(cleanData, true);

    return crewMembersRepository.create({
      ...dataWithAudit,
      empNo,
      nationalityUuid,
      vesselTypeUuid,
    });
  },
  
  async generateEmpNo(): Promise<string> {
    const db = getDb();
    // Get ALL empNo values from V2 table only (legacy will be deprecated)
    // This handles mixed formats like A0029 (4 digits) and A000030 (6 digits)
    // String comparison fails here, so we must compare numerically
    
    const results = await db
      .select({ empNo: crewMembersV2.empNo })
      .from(crewMembersV2)
      .where(ilike(crewMembersV2.empNo, 'A%'));
    
    let maxNum = 0;
    for (const row of results) {
      if (row.empNo) {
        const match = row.empNo.match(/A(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
    
    const nextNum = maxNum + 1;
    return `A${nextNum.toString().padStart(6, '0')}`;
  },

  async update(
    crewUuid: string,
    data: Partial<InsertCrewMemberV2> & { nationality?: string; vesselType?: string }
  ): Promise<CrewMemberV2> {
    await this.getByUuid(crewUuid);

    if (data.empNo) {
      const existing = await crewMembersRepository.findByEmpNo(data.empNo);
      if (existing && existing.crewUuid !== crewUuid) {
        throw new Error(
          `Employee number ${data.empNo} is already in use by another crew member`
        );
      }
    }

    // Resolve nationality if provided
    const nationalityInput = data.nationalityUuid || (data as any).nationality;
    if (nationalityInput) {
      const nationalityUuid = await resolveMasterDataUuid(nationalityInput, 'nationality');
      if (!nationalityUuid) {
        throw new Error(
          `Invalid nationality: "${nationalityInput}". Not found in master_nationalities table.`
        );
      }
      data.nationalityUuid = nationalityUuid;
    }

    // Resolve vessel type if provided
    const vesselTypeInput = data.vesselTypeUuid || (data as any).vesselType;
    if (vesselTypeInput) {
      const vesselTypeUuid = await resolveMasterDataUuid(vesselTypeInput, 'vesselType');
      if (!vesselTypeUuid) {
        throw new Error(
          `Invalid vessel type: "${vesselTypeInput}". Not found in master_vessel_types table.`
        );
      }
      data.vesselTypeUuid = vesselTypeUuid;
    }

    // Remove non-schema fields and apply audit user
    const { nationality, vesselType, ...cleanData } = data as any;
    const dataWithAudit = applyAuditUser(cleanData, false);

    const updated = await crewMembersRepository.update(crewUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update crew member: ${crewUuid}`);
    }
    return updated;
  },

  async updateById(
    id: number,
    data: Partial<InsertCrewMemberV2> & { nationality?: string; vesselType?: string }
  ): Promise<CrewMemberV2> {
    const existing = await this.getById(id);

    if (data.empNo) {
      const empNoCheck = await crewMembersRepository.findByEmpNo(data.empNo);
      if (empNoCheck && empNoCheck.id !== id) {
        throw new Error(
          `Employee number ${data.empNo} is already in use by another crew member`
        );
      }
    }

    // Resolve nationality if provided
    const nationalityInput = data.nationalityUuid || (data as any).nationality;
    if (nationalityInput) {
      const nationalityUuid = await resolveMasterDataUuid(nationalityInput, 'nationality');
      if (!nationalityUuid) {
        throw new Error(
          `Invalid nationality: "${nationalityInput}". Not found in master_nationalities table.`
        );
      }
      data.nationalityUuid = nationalityUuid;
    }

    // Resolve vessel type if provided
    const vesselTypeInput = data.vesselTypeUuid || (data as any).vesselType;
    if (vesselTypeInput) {
      const vesselTypeUuid = await resolveMasterDataUuid(vesselTypeInput, 'vesselType');
      if (!vesselTypeUuid) {
        throw new Error(
          `Invalid vessel type: "${vesselTypeInput}". Not found in master_vessel_types table.`
        );
      }
      data.vesselTypeUuid = vesselTypeUuid;
    }

    // Remove non-schema fields and apply audit user
    const { nationality, vesselType, ...cleanData } = data as any;
    const dataWithAudit = applyAuditUser(cleanData, false);

    const updated = await crewMembersRepository.updateById(id, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update crew member with id: ${id}`);
    }
    return updated;
  },

  async archive(crewUuid: string): Promise<void> {
    await this.getByUuid(crewUuid);
    const success = await crewMembersRepository.softDelete(crewUuid);
    if (!success) {
      throw new Error(`Failed to archive crew member: ${crewUuid}`);
    }
  },

  async archiveById(id: number): Promise<void> {
    await this.getById(id);
    const success = await crewMembersRepository.softDeleteById(id);
    if (!success) {
      throw new Error(`Failed to archive crew member with id: ${id}`);
    }
  },

  async unarchive(crewUuid: string): Promise<void> {
    const success = await crewMembersRepository.unarchive(crewUuid);
    if (!success) {
      throw new Error(`Failed to unarchive crew member: ${crewUuid}`);
    }
  },

  async uploadPhoto(
    crewUuid: string,
    photoPath: string
  ): Promise<CrewMemberV2> {
    return this.update(crewUuid, { uploadedPhoto: photoPath });
  },

  async removePhoto(crewUuid: string): Promise<CrewMemberV2> {
    return this.update(crewUuid, { uploadedPhoto: null });
  },

  /**
   * Get all crew with filters, pagination, and joined assignment data
   * MIGRATED FROM: server/routes.ts legacy crew pool logic
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
    const db = getDb();
    const limit = Math.min(filters?.limit || 1000, 1000);
    const offset = filters?.offset || 0;

    const conditions: any[] = [
      eq(crewMembersV2.isDeleted, false),
      isNull(crewMembersV2.archivedAt),
    ];

    if (filters?.rank) {
      conditions.push(eq(crewMembersV2.presentRank, filters.rank));
    }

    if (filters?.nationality) {
      conditions.push(eq(crewMembersV2.nationalityUuid, filters.nationality));
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

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(crewMembersV2)
      .where(and(...conditions));

    const total = countResult?.count || 0;

    const latestAssignment = db
      .selectDistinctOn([crewAssignments.crewUuid], {
        crewUuid: crewAssignments.crewUuid,
        vesselUuid: crewAssignments.vesselUuid,
        signOnDate: crewAssignments.signOnDate,
        reliefDue: crewAssignments.reliefDue,
        contractPeriod: crewAssignments.contractPeriod,
      })
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.isDeleted, false)
        )
      )
      .orderBy(crewAssignments.crewUuid, desc(crewAssignments.signOnDate), desc(crewAssignments.id))
      .as('latest_assignment');

    const crewPage = db
      .select({ id: crewMembersV2.id })
      .from(crewMembersV2)
      .where(and(...conditions))
      .orderBy(desc(crewMembersV2.createdAt), crewMembersV2.id)
      .limit(limit)
      .offset(offset)
      .as('crew_page');

    const results = await db
      .select({
        crew: crewMembersV2,
        currentVessel: latestAssignment.vesselUuid,
        signOnDate: latestAssignment.signOnDate,
        reliefDue: latestAssignment.reliefDue,
        contractPeriod: latestAssignment.contractPeriod,
        nationality: masterNationalities.nationality,
        vesselType: masterVesselTypes.vesselType,
        currentVesselName: masterVessels.vessel,
        manningAgentName: crewPersonalDetails.manningAgent,
      })
      .from(crewPage)
      .innerJoin(crewMembersV2, eq(crewMembersV2.id, crewPage.id))
      .leftJoin(
        latestAssignment,
        eq(latestAssignment.crewUuid, crewMembersV2.crewUuid)
      )
      .leftJoin(
        masterNationalities,
        eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid)
      )
      .leftJoin(
        masterVesselTypes,
        eq(crewMembersV2.vesselTypeUuid, masterVesselTypes.vtUuid)
      )
      .leftJoin(
        masterVessels,
        eq(latestAssignment.vesselUuid, masterVessels.vesselUuid)
      )
      .leftJoin(crewPersonalDetails, eq(crewMembersV2.crewUuid, crewPersonalDetails.crewUuid))
      .orderBy(desc(crewMembersV2.createdAt), crewMembersV2.id);

    // Get crew UUIDs from results to fetch previous assignments
    const crewUuids = results.map((r: any) => r.crew.crewUuid).filter(Boolean);
    
    // Fetch previous assignments (most recent where isCurrent=false) for all crew
    const previousAssignmentsMap = new Map<string, any>();
    if (crewUuids.length > 0) {
      // Use a subquery approach: for each crew, get their most recent non-current assignment with vessel name
      const prevAssignments = await db
        .select({
          crewUuid: crewAssignments.crewUuid,
          vesselUuid: crewAssignments.vesselUuid,
          vesselName: masterVessels.vessel,
          signOffDate: crewAssignments.signOffDate,
          reason: crewAssignments.reason,
        })
        .from(crewAssignments)
        .leftJoin(
          masterVessels,
          eq(crewAssignments.vesselUuid, masterVessels.vesselUuid)
        )
        .where(
          and(
            inArray(crewAssignments.crewUuid, crewUuids),
            eq(crewAssignments.isCurrent, false),
            eq(crewAssignments.isDeleted, false),
            isNotNull(crewAssignments.signOffDate)
          )
        )
        .orderBy(desc(crewAssignments.signOffDate));
      
      // Group by crewUuid, keep only the most recent (first) for each crew
      for (const prev of prevAssignments) {
        if (!previousAssignmentsMap.has(prev.crewUuid)) {
          previousAssignmentsMap.set(prev.crewUuid, prev);
        }
      }
    }

    const data = results.map((r: any) => {
      const prevAssignment = previousAssignmentsMap.get(r.crew.crewUuid);
      return {
        ...r.crew,
        nationalityUuid: r.crew.nationalityUuid,
        nationality: r.nationality,
        vesselTypeUuid: r.crew.vesselTypeUuid,
        vesselType: r.vesselType,
        presentVessel: r.currentVessel,
        presentVesselName: r.currentVesselName,
        signOnDate: r.signOnDate,
        reliefDue: r.reliefDue,
        contractPeriod: r.contractPeriod,
        lastVessel: prevAssignment?.vesselName || prevAssignment?.vesselUuid || null,
        signOffDate: prevAssignment?.signOffDate || null,
        reason: prevAssignment?.reason || null,
        manningAgentName: r.manningAgentName || '',
        status: this.calculateCrewStatus(r.crew.isActive !== false, !!r.currentVessel),
        timeOnBoardMonths: this.calculateTimeOnBoard(r.signOnDate),
      };
    });

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
   * Rules:
   * - isActive=false → "Inactive"
   * - isActive=true + vessel assignment → "On Board"
   * - isActive=true + no vessel → "On Leave"
   */
  calculateCrewStatus(isActive: boolean, hasVesselAssignment: boolean): string {
    if (!isActive) return "Inactive";
    return hasVesselAssignment ? "On Board" : "On Leave";
  },

  /**
   * Calculate time on board in months from sign-on date
   */
  calculateTimeOnBoard(signOnDate: Date | string | null): number | null {
    if (!signOnDate) return null;
    try {
      const signOn = new Date(signOnDate);
      const today = new Date();
      const diffTime = today.getTime() - signOn.getTime();
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
      return Math.round(diffMonths * 10) / 10;
    } catch {
      return null;
    }
  },

  /**
   * Create new crew member with all related data in a transaction
   */
  async createWithRelatedData(data: {
    crew: Omit<InsertCrewMemberV2, "crewUuid">;
    personalDetails?: Omit<InsertCrewPersonalDetails, "cpdUuid" | "crewUuid">;
    address?: Omit<InsertCrewAddress, "addrUuid" | "crewUuid">;
    familyInfo?: Omit<InsertCrewFamilyInfo, "famUuid" | "crewUuid">;
    children?: Omit<InsertCrewChild, "childUuid" | "crewUuid">[];
    nextOfKin?: Omit<InsertCrewNextOfKin, "nokUuid" | "crewUuid">;
  }): Promise<CrewMemberV2> {
    const db = getDb();

    if (!data.crew.empNo) {
      throw new Error("Employee number is required");
    }
    const existing = await crewMembersRepository.findByEmpNo(data.crew.empNo);
    if (existing) {
      throw new Error(
        `Crew member with employee number ${data.crew.empNo} already exists`
      );
    }

    return db.transaction(async (tx: any) => {
      const crewUuid = uuidv4();
      const now = new Date();

      const [crew] = await tx
        .insert(crewMembersV2)
        .values({
          ...data.crew,
          crewUuid,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (data.personalDetails) {
        await tx.insert(crewPersonalDetails).values({
          ...data.personalDetails,
          cpdUuid: uuidv4(),
          crewUuid,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (data.address) {
        await tx.insert(crewAddresses).values({
          ...data.address,
          addrUuid: uuidv4(),
          crewUuid,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (data.familyInfo) {
        await tx.insert(crewFamilyInfo).values({
          ...data.familyInfo,
          famUuid: uuidv4(),
          crewUuid,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (data.children && data.children.length > 0) {
        await tx.insert(crewChildren).values(
          data.children.map((child, index) => ({
            ...child,
            childUuid: uuidv4(),
            crewUuid,
            sortOrder: index,
            createdAt: now,
            updatedAt: now,
          }))
        );
      }

      if (data.nextOfKin) {
        await tx.insert(crewNextOfKin).values({
          ...data.nextOfKin,
          nokUuid: uuidv4(),
          crewUuid,
          createdAt: now,
          updatedAt: now,
        });
      }

      return crew;
    });
  },

  /**
   * Update crew member - protect vessel assignment fields from accidental clearing
   * Prevents form submissions from accidentally clearing data when fields aren't included
   */
  async updateWithProtection(
    crewUuid: string,
    data: Partial<InsertCrewMemberV2>,
    options?: { allowVesselClear?: boolean }
  ): Promise<CrewMemberV2> {
    const db = getDb();

    const [existing] = await db
      .select()
      .from(crewMembersV2)
      .where(eq(crewMembersV2.crewUuid, crewUuid))
      .limit(1);

    if (!existing) {
      throw new Error(`Crew member not found: ${crewUuid}`);
    }

    if (data.empNo && data.empNo !== existing.empNo) {
      const empNoCheck = await crewMembersRepository.findByEmpNo(data.empNo);
      if (empNoCheck && empNoCheck.crewUuid !== crewUuid) {
        throw new Error(
          `Employee number ${data.empNo} is already in use by another crew member`
        );
      }
    }

    const updateData: any = { ...data, updatedAt: new Date() };

    if (!options?.allowVesselClear) {
      const protectedFields = [
        "presentRank",
        "status",
      ] as const;

      for (const field of protectedFields) {
        if (
          (updateData[field] === null || updateData[field] === undefined) &&
          existing[field] !== null &&
          existing[field] !== undefined
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
    const db = getDb();

    // Get crew with JOINs to resolve master data names
    const [crewResult] = await db
      .select({
        crew: crewMembersV2,
        nationality: masterNationalities.nationality,
        vesselType: masterVesselTypes.vesselType,
      })
      .from(crewMembersV2)
      .leftJoin(
        masterNationalities,
        eq(crewMembersV2.nationalityUuid, masterNationalities.natUuid)
      )
      .leftJoin(
        masterVesselTypes,
        eq(crewMembersV2.vesselTypeUuid, masterVesselTypes.vtUuid)
      )
      .where(
        and(
          eq(crewMembersV2.crewUuid, crewUuid),
          eq(crewMembersV2.isDeleted, false)
        )
      )
      .limit(1);

    if (!crewResult) return null;

    // Merge resolved names into crew object
    const crew = {
      ...crewResult.crew,
      nationality: crewResult.nationality,
      vesselType: crewResult.vesselType,
    };

    // Personal details with country and language resolution
    const personalDetailsResults = await db
      .select({
        personalDetails: crewPersonalDetails,
        placeOfBirthCountry: masterCountries.countryName,
        resolvedNativeLanguage: masterLanguages.languageName,
      })
      .from(crewPersonalDetails)
      .leftJoin(
        masterCountries,
        eq(crewPersonalDetails.placeOfBirthCountryUuid, masterCountries.countryUuid)
      )
      .leftJoin(
        masterLanguages,
        eq(crewPersonalDetails.nativeLanguageUuid, masterLanguages.langUuid)
      )
      .where(
        and(
          eq(crewPersonalDetails.crewUuid, crewUuid),
          eq(crewPersonalDetails.isDeleted, false)
        )
      )
      .limit(1);

    // Addresses with country resolution for countryOfResidence
    const addressResults = await db
      .select({
        address: crewAddresses,
        countryOfResidence: masterCountries.countryName,
      })
      .from(crewAddresses)
      .leftJoin(
        masterCountries,
        eq(crewAddresses.countryOfResidenceUuid, masterCountries.countryUuid)
      )
      .where(
        and(
          eq(crewAddresses.crewUuid, crewUuid),
          eq(crewAddresses.isDeleted, false)
        )
      )
      .limit(1);

    // Sea service with vessel and vessel type resolution
    const seaServiceResults = await db
      .select({
        seaService: crewSeaService,
        resolvedVesselName: masterVessels.vessel,
        resolvedVesselTypeName: masterVesselTypes.vesselType,
      })
      .from(crewSeaService)
      .leftJoin(
        masterVessels,
        eq(crewSeaService.vesselUuid, masterVessels.vesselUuid)
      )
      .leftJoin(
        masterVesselTypes,
        eq(crewSeaService.vesselTypeUuid, masterVesselTypes.vtUuid)
      )
      .where(
        and(
          eq(crewSeaService.crewUuid, crewUuid),
          eq(crewSeaService.isDeleted, false)
        )
      )
      .orderBy(asc(crewSeaService.sortOrder), asc(crewSeaService.createdAt));

    // Batch 1: Family-related queries (4 queries)
    const [familyInfo, children, nextOfKin, documents] = await Promise.all([
      db
        .select()
        .from(crewFamilyInfo)
        .where(
          and(
            eq(crewFamilyInfo.crewUuid, crewUuid),
            eq(crewFamilyInfo.isDeleted, false)
          )
        )
        .limit(1),
      db
        .select()
        .from(crewChildren)
        .where(
          and(
            eq(crewChildren.crewUuid, crewUuid),
            eq(crewChildren.isDeleted, false)
          )
        )
        .orderBy(asc(crewChildren.sortOrder), asc(crewChildren.createdAt)),
      db
        .select()
        .from(crewNextOfKin)
        .where(
          and(
            eq(crewNextOfKin.crewUuid, crewUuid),
            eq(crewNextOfKin.isDeleted, false)
          )
        )
        .limit(1),
      db
        .select()
        .from(crewDocuments)
        .where(
          and(
            eq(crewDocuments.crewUuid, crewUuid),
            eq(crewDocuments.isDeleted, false)
          )
        )
        .orderBy(asc(crewDocuments.sortOrder), asc(crewDocuments.createdAt)),
    ]);

    // Batch 2: Credentials queries (4 queries)
    const [visas, education, licenses, trainingCourses] = await Promise.all([
      db
        .select()
        .from(crewVisas)
        .where(
          and(
            eq(crewVisas.crewUuid, crewUuid),
            eq(crewVisas.isDeleted, false)
          )
        )
        .orderBy(asc(crewVisas.sortOrder), asc(crewVisas.createdAt)),
      db
        .select()
        .from(crewEducation)
        .where(
          and(
            eq(crewEducation.crewUuid, crewUuid),
            eq(crewEducation.isDeleted, false)
          )
        )
        .orderBy(asc(crewEducation.sortOrder), asc(crewEducation.createdAt)),
      db
        .select()
        .from(crewLicenses)
        .where(
          and(
            eq(crewLicenses.crewUuid, crewUuid),
            eq(crewLicenses.isDeleted, false)
          )
        )
        .orderBy(asc(crewLicenses.sortOrder), asc(crewLicenses.createdAt)),
      db
        .select()
        .from(crewTrainingCourses)
        .where(
          and(
            eq(crewTrainingCourses.crewUuid, crewUuid),
            eq(crewTrainingCourses.isDeleted, false)
          )
        )
        .orderBy(asc(crewTrainingCourses.sortOrder), asc(crewTrainingCourses.createdAt)),
    ]);

    // Batch 3: Medical and vessel types queries (3 queries)
    const [medicalsWithVessel, doctorVisits, vesselTypesRaw] = await Promise.all([
      db
        .select({
          medical: crewPreJoiningMedicals,
          resolvedVesselName: masterVessels.vessel,
        })
        .from(crewPreJoiningMedicals)
        .leftJoin(
          masterVessels,
          eq(crewPreJoiningMedicals.vesselUuid, masterVessels.vesselUuid)
        )
        .where(
          and(
            eq(crewPreJoiningMedicals.crewUuid, crewUuid),
            eq(crewPreJoiningMedicals.isDeleted, false)
          )
        )
        .orderBy(asc(crewPreJoiningMedicals.sortOrder), asc(crewPreJoiningMedicals.createdAt)),
      db
        .select()
        .from(crewDoctorVisits)
        .where(
          and(
            eq(crewDoctorVisits.crewUuid, crewUuid),
            eq(crewDoctorVisits.isDeleted, false)
          )
        )
        .orderBy(asc(crewDoctorVisits.sortOrder), asc(crewDoctorVisits.createdAt)),
      db
        .select({
          cvta: crewVesselTypesApplied,
          resolvedVesselTypeName: masterVesselTypes.vesselType,
        })
        .from(crewVesselTypesApplied)
        .leftJoin(
          masterVesselTypes,
          eq(crewVesselTypesApplied.vesselTypeUuid, masterVesselTypes.vtUuid)
        )
        .where(
          and(
            eq(crewVesselTypesApplied.crewUuid, crewUuid),
            eq(crewVesselTypesApplied.isDeleted, false)
          )
        ),
    ]);

    // Extract and merge resolved names
    const personalDetailsRow = personalDetailsResults[0];
    const personalDetails = personalDetailsRow ? [{
      ...personalDetailsRow.personalDetails,
      placeOfBirthCountry: personalDetailsRow.placeOfBirthCountry,
      // If UUID resolved to language name, use it; otherwise use original value (might be text name already)
      nativeLanguage: personalDetailsRow.resolvedNativeLanguage || personalDetailsRow.personalDetails.nativeLanguageUuid,
    }] : [];

    const addressRow = addressResults[0];
    const address = addressRow ? [{
      ...addressRow.address,
      countryOfResidence: addressRow.countryOfResidence,
    }] : [];

    // Merge resolved vessel and vessel type names into sea service
    const seaService = seaServiceResults.map((row: { seaService: any; resolvedVesselName: string | null; resolvedVesselTypeName: string | null }) => ({
      ...row.seaService,
      resolvedVesselName: row.resolvedVesselName,
      resolvedVesselTypeName: row.resolvedVesselTypeName,
    }));

    // Merge resolved vessel names into medicals
    const medicals = medicalsWithVessel.map((row: { medical: any; resolvedVesselName: string | null }) => ({
      ...row.medical,
      vesselName: row.resolvedVesselName || row.medical.vesselName,
    }));

    // Collect UUIDs for attachment queries
    const docUuids = documents.map((d: any) => d.docUuid);
    const visaUuids = visas.map((v: any) => v.visaUuid);
    const eduUuids = education.map((e: any) => e.eduUuid);
    const licUuids = licenses.map((l: any) => l.licUuid);
    const trainUuids = trainingCourses.map((t: any) => t.trainUuid);
    const seaUuids = seaService.map((s: any) => s.seaUuid);
    const medUuids = medicals.map((m: any) => m.medUuid);
    const visitUuids = doctorVisits.map((d: any) => d.visitUuid);

    // Batch 4: Attachment queries for documents, visas, education, licenses (4 queries)
    const [documentAttachments, visaAttachments, educationAttachments, licenseAttachments] = await Promise.all([
      docUuids.length > 0 
        ? db.select().from(crewDocumentsAttachments).where(
            and(
              sql`${crewDocumentsAttachments.docUuid} = ANY(ARRAY[${sql.raw(docUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewDocumentsAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
      visaUuids.length > 0
        ? db.select().from(crewVisasAttachments).where(
            and(
              sql`${crewVisasAttachments.visaUuid} = ANY(ARRAY[${sql.raw(visaUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewVisasAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
      eduUuids.length > 0
        ? db.select().from(crewEducationAttachments).where(
            and(
              sql`${crewEducationAttachments.eduUuid} = ANY(ARRAY[${sql.raw(eduUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewEducationAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
      licUuids.length > 0
        ? db.select().from(crewLicensesAttachments).where(
            and(
              sql`${crewLicensesAttachments.licUuid} = ANY(ARRAY[${sql.raw(licUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewLicensesAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
    ]);

    // Batch 5: Attachment queries for training, sea service, medicals, doctor visits (4 queries)
    const [trainingAttachments, seaServiceAttachments, medicalAttachments, doctorVisitAttachments] = await Promise.all([
      trainUuids.length > 0
        ? db.select().from(crewTrainingAttachments).where(
            and(
              sql`${crewTrainingAttachments.trainUuid} = ANY(ARRAY[${sql.raw(trainUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewTrainingAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
      seaUuids.length > 0
        ? db.select().from(crewSeaServiceAttachments).where(
            and(
              sql`${crewSeaServiceAttachments.seaUuid} = ANY(ARRAY[${sql.raw(seaUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewSeaServiceAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
      medUuids.length > 0
        ? db.select().from(crewMedicalAttachments).where(
            and(
              sql`${crewMedicalAttachments.medUuid} = ANY(ARRAY[${sql.raw(medUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewMedicalAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
      visitUuids.length > 0
        ? db.select().from(crewDoctorVisitsAttachments).where(
            and(
              sql`${crewDoctorVisitsAttachments.visitUuid} = ANY(ARRAY[${sql.raw(visitUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
              eq(crewDoctorVisitsAttachments.isDeleted, false)
            )
          )
        : Promise.resolve([]),
    ]);

    // Map attachments to documents
    const documentsWithAttachments = documents.map((doc: any) => ({
      ...doc,
      attachments: documentAttachments.filter((att: any) => att.docUuid === doc.docUuid)
    }));

    // Map attachments to visas
    const visasWithAttachments = visas.map((visa: any) => ({
      ...visa,
      attachments: visaAttachments.filter((att: any) => att.visaUuid === visa.visaUuid)
    }));

    // Map attachments to education
    const educationWithAttachments = education.map((edu: any) => ({
      ...edu,
      attachments: educationAttachments.filter((att: any) => att.eduUuid === edu.eduUuid)
    }));

    // Map attachments to licenses
    const licensesWithAttachments = licenses.map((lic: any) => ({
      ...lic,
      attachments: licenseAttachments.filter((att: any) => att.licUuid === lic.licUuid)
    }));

    // Map attachments to training courses
    const trainingWithAttachments = trainingCourses.map((train: any) => ({
      ...train,
      attachments: trainingAttachments.filter((att: any) => att.trainUuid === train.trainUuid)
    }));

    // Map attachments to sea service
    const seaServiceWithAttachments = seaService.map((sea: any) => ({
      ...sea,
      attachments: seaServiceAttachments.filter((att: any) => att.seaUuid === sea.seaUuid)
    }));

    // Map attachments to medicals
    const medicalsWithAttachments = medicals.map((med: any) => ({
      ...med,
      attachments: medicalAttachments.filter((att: any) => att.medUuid === med.medUuid)
    }));

    // Map attachments to doctor visits
    const doctorVisitsWithAttachments = doctorVisits.map((visit: any) => ({
      ...visit,
      attachments: doctorVisitAttachments.filter((att: any) => att.visitUuid === visit.visitUuid)
    }));

    // Process vessel types with resolved names
    const vesselTypes = vesselTypesRaw.map((row: { cvta: any; resolvedVesselTypeName: string | null }) => ({
      ...row.cvta,
      resolvedVesselTypeName: row.resolvedVesselTypeName,
    }));

    return {
      crew,
      personalDetails: personalDetails[0] || null,
      address: address[0] || null,
      familyInfo: familyInfo[0] || null,
      children,
      nextOfKin: nextOfKin[0] || null,
      documents: documentsWithAttachments,
      visas: visasWithAttachments,
      education: educationWithAttachments,
      licenses: licensesWithAttachments,
      trainingCourses: trainingWithAttachments,
      seaService: seaServiceWithAttachments,
      medicals: medicalsWithAttachments,
      doctorVisits: doctorVisitsWithAttachments,
      vesselTypes,
    };
  },
};
