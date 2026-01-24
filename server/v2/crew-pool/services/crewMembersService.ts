import { eq, and, desc, or, ilike, sql, isNull } from "drizzle-orm";
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
} from "../../../../shared/v2/crew-pool/schema";
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

export const crewMembersService = {
  async getAll(filters?: {
    status?: string;
    isActive?: boolean;
    search?: string;
  }): Promise<CrewMemberV2[]> {
    return crewMembersRepository.findAll(filters);
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
    data: Omit<InsertCrewMemberV2, "crewUuid">
  ): Promise<CrewMemberV2> {
    if (!data.firstName || !data.familyName) {
      throw new Error("First name and family name are required");
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

    return crewMembersRepository.create({ ...data, empNo });
  },
  
  async generateEmpNo(): Promise<string> {
    const db = getDb();
    // Get the highest empNo that starts with 'V2-' and increment
    const result = await db
      .select({ empNo: crewMembersV2.empNo })
      .from(crewMembersV2)
      .where(ilike(crewMembersV2.empNo, 'V2-%'))
      .orderBy(desc(crewMembersV2.empNo))
      .limit(1);
    
    let nextNum = 1;
    if (result.length > 0 && result[0].empNo) {
      const match = result[0].empNo.match(/V2-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    
    return `V2-${nextNum.toString().padStart(6, '0')}`;
  },

  async update(
    crewUuid: string,
    data: Partial<InsertCrewMemberV2>
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

    const updated = await crewMembersRepository.update(crewUuid, data);
    if (!updated) {
      throw new Error(`Failed to update crew member: ${crewUuid}`);
    }
    return updated;
  },

  async updateById(
    id: number,
    data: Partial<InsertCrewMemberV2>
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

    const updated = await crewMembersRepository.updateById(id, data);
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
    const limit = Math.min(filters?.limit || 50, 100);
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

    const results = await db
      .select({
        crew: crewMembersV2,
        currentVessel: crewAssignments.vesselUuid,
        signOnDate: crewAssignments.signOnDate,
        reliefDue: crewAssignments.reliefDue,
        contractPeriod: crewAssignments.contractPeriod,
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

    const data = results.map((r) => ({
      ...r.crew,
      presentVessel: r.currentVessel,
      signOnDate: r.signOnDate,
      reliefDue: r.reliefDue,
      contractPeriod: r.contractPeriod,
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

    return db.transaction(async (tx) => {
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

    const [crew] = await db
      .select()
      .from(crewMembersV2)
      .where(
        and(
          eq(crewMembersV2.crewUuid, crewUuid),
          eq(crewMembersV2.isDeleted, false)
        )
      )
      .limit(1);

    if (!crew) return null;

    const [personalDetails, address, familyInfo, children, nextOfKin, documents, visas, education, licenses, trainingCourses, seaService, medicals, doctorVisits] =
      await Promise.all([
        db
          .select()
          .from(crewPersonalDetails)
          .where(
            and(
              eq(crewPersonalDetails.crewUuid, crewUuid),
              eq(crewPersonalDetails.isDeleted, false)
            )
          )
          .limit(1),
        db
          .select()
          .from(crewAddresses)
          .where(
            and(
              eq(crewAddresses.crewUuid, crewUuid),
              eq(crewAddresses.isDeleted, false)
            )
          )
          .limit(1),
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
          ),
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
        // Documents with attachments
        db
          .select()
          .from(crewDocuments)
          .where(
            and(
              eq(crewDocuments.crewUuid, crewUuid),
              eq(crewDocuments.isDeleted, false)
            )
          ),
        // Visas with attachments
        db
          .select()
          .from(crewVisas)
          .where(
            and(
              eq(crewVisas.crewUuid, crewUuid),
              eq(crewVisas.isDeleted, false)
            )
          ),
        // Education
        db
          .select()
          .from(crewEducation)
          .where(
            and(
              eq(crewEducation.crewUuid, crewUuid),
              eq(crewEducation.isDeleted, false)
            )
          ),
        // Licenses
        db
          .select()
          .from(crewLicenses)
          .where(
            and(
              eq(crewLicenses.crewUuid, crewUuid),
              eq(crewLicenses.isDeleted, false)
            )
          ),
        // Training Courses
        db
          .select()
          .from(crewTrainingCourses)
          .where(
            and(
              eq(crewTrainingCourses.crewUuid, crewUuid),
              eq(crewTrainingCourses.isDeleted, false)
            )
          ),
        // Sea Service
        db
          .select()
          .from(crewSeaService)
          .where(
            and(
              eq(crewSeaService.crewUuid, crewUuid),
              eq(crewSeaService.isDeleted, false)
            )
          ),
        // Pre-Joining Medicals
        db
          .select()
          .from(crewPreJoiningMedicals)
          .where(
            and(
              eq(crewPreJoiningMedicals.crewUuid, crewUuid),
              eq(crewPreJoiningMedicals.isDeleted, false)
            )
          ),
        // Doctor Visits
        db
          .select()
          .from(crewDoctorVisits)
          .where(
            and(
              eq(crewDoctorVisits.crewUuid, crewUuid),
              eq(crewDoctorVisits.isDeleted, false)
            )
          ),
      ]);

    // Get attachments for documents
    const docUuids = documents.map((d: any) => d.docUuid);
    const documentAttachments = docUuids.length > 0 
      ? await db.select().from(crewDocumentsAttachments).where(
          and(
            sql`${crewDocumentsAttachments.docUuid} = ANY(ARRAY[${sql.raw(docUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewDocumentsAttachments.isDeleted, false)
          )
        )
      : [];

    // Get attachments for visas
    const visaUuids = visas.map((v: any) => v.visaUuid);
    const visaAttachments = visaUuids.length > 0
      ? await db.select().from(crewVisasAttachments).where(
          and(
            sql`${crewVisasAttachments.visaUuid} = ANY(ARRAY[${sql.raw(visaUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewVisasAttachments.isDeleted, false)
          )
        )
      : [];

    // Get attachments for education
    const eduUuids = education.map((e: any) => e.eduUuid);
    const educationAttachments = eduUuids.length > 0
      ? await db.select().from(crewEducationAttachments).where(
          and(
            sql`${crewEducationAttachments.eduUuid} = ANY(ARRAY[${sql.raw(eduUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewEducationAttachments.isDeleted, false)
          )
        )
      : [];

    // Get attachments for licenses
    const licUuids = licenses.map((l: any) => l.licUuid);
    const licenseAttachments = licUuids.length > 0
      ? await db.select().from(crewLicensesAttachments).where(
          and(
            sql`${crewLicensesAttachments.licUuid} = ANY(ARRAY[${sql.raw(licUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewLicensesAttachments.isDeleted, false)
          )
        )
      : [];

    // Get attachments for training courses
    const trainUuids = trainingCourses.map((t: any) => t.trainUuid);
    const trainingAttachments = trainUuids.length > 0
      ? await db.select().from(crewTrainingAttachments).where(
          and(
            sql`${crewTrainingAttachments.trainUuid} = ANY(ARRAY[${sql.raw(trainUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewTrainingAttachments.isDeleted, false)
          )
        )
      : [];

    // Get attachments for sea service
    const seaUuids = seaService.map((s: any) => s.seaUuid);
    const seaServiceAttachments = seaUuids.length > 0
      ? await db.select().from(crewSeaServiceAttachments).where(
          and(
            sql`${crewSeaServiceAttachments.seaUuid} = ANY(ARRAY[${sql.raw(seaUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewSeaServiceAttachments.isDeleted, false)
          )
        )
      : [];

    // Get attachments for medicals
    const medUuids = medicals.map((m: any) => m.medUuid);
    const medicalAttachments = medUuids.length > 0
      ? await db.select().from(crewMedicalAttachments).where(
          and(
            sql`${crewMedicalAttachments.medUuid} = ANY(ARRAY[${sql.raw(medUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewMedicalAttachments.isDeleted, false)
          )
        )
      : [];

    // Get attachments for doctor visits
    const visitUuids = doctorVisits.map((d: any) => d.visitUuid);
    const doctorVisitAttachments = visitUuids.length > 0
      ? await db.select().from(crewDoctorVisitsAttachments).where(
          and(
            sql`${crewDoctorVisitsAttachments.visitUuid} = ANY(ARRAY[${sql.raw(visitUuids.map((u: string) => `'${u}'`).join(','))}]::text[])`,
            eq(crewDoctorVisitsAttachments.isDeleted, false)
          )
        )
      : [];

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
    };
  },
};
