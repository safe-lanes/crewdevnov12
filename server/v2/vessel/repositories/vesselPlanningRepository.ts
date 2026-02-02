import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../../db";
import { vesselPlanningV2, vesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { masterPorts, masterNationalities } from "../../../../shared/schema";
import type { VesselPlanningV2, InsertVesselPlanningV2, VesselPlanningAttachmentsV2, InsertVesselPlanningAttachmentsV2 } from "../../../../shared/v2/vessel/schema";
import { v4 as uuidv4 } from "uuid";

export class VesselPlanningRepository {
  async findByVesselUuid(vesselUuid: string): Promise<any[]> {
    const db = getDb();
    const relieverCrew = alias(crewMembersV2, "reliever_crew");
    const signOffPort = alias(masterPorts, "sign_off_port");
    const joiningPort = alias(masterPorts, "joining_port");
    const crewNationality = alias(masterNationalities, "crew_nationality");
    const relieverNationalityTable = alias(masterNationalities, "reliever_nationality");
    
    const results = await db
      .select({
        planning: vesselPlanningV2,
        crewFirstName: crewMembersV2.firstName,
        crewFamilyName: crewMembersV2.familyName,
        crewEmpNo: crewMembersV2.empNo,
        crewNationalityName: crewNationality.nationality,
        relieverFirstName: relieverCrew.firstName,
        relieverFamilyName: relieverCrew.familyName,
        relieverNationalityName: relieverNationalityTable.nationality,
        signOffPortName: signOffPort.name,
        joiningPortName: joiningPort.name,
      })
      .from(vesselPlanningV2)
      .leftJoin(crewMembersV2, eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid))
      .leftJoin(relieverCrew, eq(vesselPlanningV2.relieverCrewUuid, relieverCrew.crewUuid))
      .leftJoin(signOffPort, eq(vesselPlanningV2.signOffPortUuid, signOffPort.portUuid))
      .leftJoin(joiningPort, eq(vesselPlanningV2.joiningPortUuid, joiningPort.portUuid))
      .leftJoin(crewNationality, eq(crewMembersV2.nationalityUuid, crewNationality.natUuid))
      .leftJoin(relieverNationalityTable, eq(relieverCrew.nationalityUuid, relieverNationalityTable.natUuid))
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.isDeleted, false)
          // Note: Removed isArchived filter - return all records so frontend can filter by showArchived toggle
        )
      )
      .orderBy(desc(vesselPlanningV2.createdAt));

    return results.map((row: any) => ({
      ...row.planning,
      crewMemberName: row.crewFirstName && row.crewFamilyName 
        ? `${row.crewFirstName} ${row.crewFamilyName}`
        : null,
      crewEmpNo: row.crewEmpNo,
      nationality: row.crewNationalityName || null,
      relieverCrewName: row.relieverFirstName && row.relieverFamilyName
        ? `${row.relieverFirstName} ${row.relieverFamilyName}`
        : null,
      relieverNationality: row.relieverNationalityName || null,
      signOffPortName: row.signOffPortName || null,
      joiningPortName: row.joiningPortName || null,
    }));
  }

  async findByPlanUuid(planUuid: string): Promise<any | undefined> {
    const db = getDb();
    const relieverCrew = alias(crewMembersV2, "reliever_crew");
    const signOffPort = alias(masterPorts, "sign_off_port");
    const joiningPort = alias(masterPorts, "joining_port");
    const crewNationality = alias(masterNationalities, "crew_nationality");
    const relieverNationalityTable = alias(masterNationalities, "reliever_nationality");
    
    const results = await db
      .select({
        planning: vesselPlanningV2,
        crewFirstName: crewMembersV2.firstName,
        crewFamilyName: crewMembersV2.familyName,
        crewEmpNo: crewMembersV2.empNo,
        crewNationalityName: crewNationality.nationality,
        relieverFirstName: relieverCrew.firstName,
        relieverFamilyName: relieverCrew.familyName,
        relieverNationalityName: relieverNationalityTable.nationality,
        signOffPortName: signOffPort.name,
        joiningPortName: joiningPort.name,
      })
      .from(vesselPlanningV2)
      .leftJoin(crewMembersV2, eq(vesselPlanningV2.crewUuid, crewMembersV2.crewUuid))
      .leftJoin(relieverCrew, eq(vesselPlanningV2.relieverCrewUuid, relieverCrew.crewUuid))
      .leftJoin(signOffPort, eq(vesselPlanningV2.signOffPortUuid, signOffPort.portUuid))
      .leftJoin(joiningPort, eq(vesselPlanningV2.joiningPortUuid, joiningPort.portUuid))
      .leftJoin(crewNationality, eq(crewMembersV2.nationalityUuid, crewNationality.natUuid))
      .leftJoin(relieverNationalityTable, eq(relieverCrew.nationalityUuid, relieverNationalityTable.natUuid))
      .where(
        and(
          eq(vesselPlanningV2.planUuid, planUuid),
          eq(vesselPlanningV2.isDeleted, false)
        )
      );
    
    if (!results[0]) return undefined;
    const row = results[0];
    return {
      ...row.planning,
      crewMemberName: row.crewFirstName && row.crewFamilyName 
        ? `${row.crewFirstName} ${row.crewFamilyName}`
        : null,
      crewEmpNo: row.crewEmpNo,
      nationality: row.crewNationalityName || null,
      relieverCrewName: row.relieverFirstName && row.relieverFamilyName
        ? `${row.relieverFirstName} ${row.relieverFamilyName}`
        : null,
      relieverNationality: row.relieverNationalityName || null,
      signOffPortName: row.signOffPortName || null,
      joiningPortName: row.joiningPortName || null,
    };
  }

  async findByVesselAndRank(vesselUuid: string, rankId: string): Promise<VesselPlanningV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(vesselPlanningV2)
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.rankId, rankId),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false)
        )
      );
    return results[0];
  }

  async create(data: Omit<InsertVesselPlanningV2, "planUuid">): Promise<VesselPlanningV2> {
    const db = getDb();
    const results = await db
      .insert(vesselPlanningV2)
      .values({
        ...data,
        planUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(planUuid: string, data: Partial<InsertVesselPlanningV2>): Promise<VesselPlanningV2> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(vesselPlanningV2.planUuid, planUuid))
      .returning();
    return results[0];
  }

  async archive(planUuid: string, archivedByUuid?: string): Promise<VesselPlanningV2> {
    const db = getDb();
    const results = await db
      .update(vesselPlanningV2)
      .set({
        isArchived: true,
        archivedDate: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
        updatedByUuid: archivedByUuid,
      })
      .where(eq(vesselPlanningV2.planUuid, planUuid))
      .returning();
    return results[0];
  }

  async softDelete(planUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(vesselPlanningV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(vesselPlanningV2.planUuid, planUuid));
  }
}

export class VesselPlanningAttachmentsRepository {
  async findByPlanUuid(planUuid: string): Promise<VesselPlanningAttachmentsV2[]> {
    const db = getDb();
    return db
      .select()
      .from(vesselPlanningAttachmentsV2)
      .where(
        and(
          eq(vesselPlanningAttachmentsV2.planUuid, planUuid),
          eq(vesselPlanningAttachmentsV2.isDeleted, false)
        )
      )
      .orderBy(vesselPlanningAttachmentsV2.sortOrder);
  }

  async create(data: Omit<InsertVesselPlanningAttachmentsV2, "attUuid">): Promise<VesselPlanningAttachmentsV2> {
    const db = getDb();
    const results = await db
      .insert(vesselPlanningAttachmentsV2)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDelete(attUuid: string): Promise<void> {
    const db = getDb();
    await db
      .update(vesselPlanningAttachmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(vesselPlanningAttachmentsV2.attUuid, attUuid));
  }
}

export const vesselPlanningRepository = new VesselPlanningRepository();
export const vesselPlanningAttachmentsRepository = new VesselPlanningAttachmentsRepository();
