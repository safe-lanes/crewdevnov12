import { eq, and, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { applyAuditUser } from "../../admin/utils/auditUser";
import { CrewAssignmentsRepository } from "../repositories";
import { crewMembersService } from "./crewMembersService";
import { crewAssignments } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewAssignment,
  CrewAssignment,
} from "../../../../shared/v2/crew-pool/types";

const crewAssignmentsRepository = new CrewAssignmentsRepository();

export const crewAssignmentsService = {
  async getAll(crewUuid: string): Promise<CrewAssignment[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewAssignmentsRepository.findByCrewUuid(crewUuid);
  },

  async getByUuid(assignUuid: string): Promise<CrewAssignment> {
    const assignment = await crewAssignmentsRepository.findByUuid(assignUuid);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignUuid}`);
    }
    return assignment;
  },

  async getCurrent(crewUuid: string): Promise<CrewAssignment | null> {
    await crewMembersService.getByUuid(crewUuid);
    const current = await crewAssignmentsRepository.findCurrent(crewUuid);
    return current || null;
  },

  async create(
    crewUuid: string,
    data: Omit<InsertCrewAssignment, "assignUuid" | "crewUuid">
  ): Promise<CrewAssignment> {
    await crewMembersService.getByUuid(crewUuid);

    if (data.signOnDate && data.signOffDate) {
      const signOn = new Date(data.signOnDate);
      const signOff = new Date(data.signOffDate);
      if (signOn > signOff) {
        throw new Error("Sign on date cannot be after sign off date");
      }
    }

    return crewAssignmentsRepository.create({ ...data, crewUuid });
  },

  async update(
    assignUuid: string,
    data: Partial<InsertCrewAssignment> & { auditUserUuid?: string | null }
  ): Promise<CrewAssignment> {
    await this.getByUuid(assignUuid);

    if (data.signOnDate && data.signOffDate) {
      const signOn = new Date(data.signOnDate);
      const signOff = new Date(data.signOffDate);
      if (signOn > signOff) {
        throw new Error("Sign on date cannot be after sign off date");
      }
    }

    const updated = await crewAssignmentsRepository.update(
      assignUuid,
      applyAuditUser(data)
    );
    if (!updated) {
      throw new Error(`Failed to update assignment: ${assignUuid}`);
    }
    return updated;
  },

  async delete(assignUuid: string): Promise<void> {
    await this.getByUuid(assignUuid);
    const success = await crewAssignmentsRepository.softDelete(assignUuid);
    if (!success) {
      throw new Error(`Failed to delete assignment: ${assignUuid}`);
    }
  },

  async setAsCurrent(crewUuid: string, assignUuid: string): Promise<boolean> {
    await crewMembersService.getByUuid(crewUuid);
    await this.getByUuid(assignUuid);
    return crewAssignmentsRepository.setCurrentAssignment(crewUuid, assignUuid);
  },

  /**
   * Assign crew to vessel (with primary/secondary status)
   * Rules:
   * - A crew can have one PRIMARY assignment (their main vessel)
   * - A crew can have multiple SECONDARY assignments (relief/backup)
   * - Creating a PRIMARY deactivates any existing PRIMARY
   */
  async assignToVessel(
    crewUuid: string,
    vesselUuid: string,
    data: {
      signOnDate?: Date | string;
      reliefDue?: Date | string;
      contractPeriod?: string;
      assignmentType?: "primary" | "secondary";
      vesselName?: string;
      rank?: string;
      notes?: string;
      auditUserUuid?: string | null;
    }
  ): Promise<CrewAssignment> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    const assignmentType = data.assignmentType || "primary";
    const signOnDate = data.signOnDate || new Date();
    const auditUserUuid = data.auditUserUuid ?? null;

    return db.transaction(async (tx: any) => {
      if (assignmentType === "primary") {
        await tx
          .update(crewAssignments)
          .set(applyAuditUser({ isCurrent: false, auditUserUuid }))
          .where(
            and(
              eq(crewAssignments.crewUuid, crewUuid),
              eq(crewAssignments.assignmentType, "primary"),
              eq(crewAssignments.isCurrent, true)
            )
          );
      }

      const now = new Date();
      const signOnDateStr =
        typeof signOnDate === "string"
          ? signOnDate
          : signOnDate.toISOString().split("T")[0];

      const [assignment] = await tx
        .insert(crewAssignments)
        .values(
          applyAuditUser(
            {
              assignUuid: uuidv4(),
              crewUuid,
              vesselUuid,
              vesselName: data.vesselName ?? null,
              rank: data.rank ?? null,
              signOnDate: signOnDateStr,
              reliefDue: data.reliefDue
                ? typeof data.reliefDue === "string"
                  ? data.reliefDue
                  : data.reliefDue.toISOString().split("T")[0]
                : null,
              contractPeriod: data.contractPeriod ?? null,
              assignmentType,
              isCurrent: true,
              createdAt: now,
              auditUserUuid,
            },
            true
          )
        )
        .returning();

      return assignment;
    });
  },

  /**
   * Sign off crew from vessel
   */
  async signOff(
    crewUuid: string,
    data: {
      signOffDate?: Date | string;
      signOffReason?: string;
      signOffNotes?: string;
      auditUserUuid?: string | null;
    }
  ): Promise<CrewAssignment | null> {
    const db = getDb();
    const auditUserUuid = data.auditUserUuid ?? null;

    const [current] = await db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isCurrent, true),
          eq(crewAssignments.assignmentType, "primary")
        )
      )
      .limit(1);

    if (!current) {
      return null;
    }

    const signOffDate = data.signOffDate || new Date();
    const signOffDateStr =
      typeof signOffDate === "string"
        ? signOffDate
        : signOffDate.toISOString().split("T")[0];

    const [updated] = await db
      .update(crewAssignments)
      .set(
        applyAuditUser({
          signOffDate: signOffDateStr,
          reason: data.signOffReason || null,
          isCurrent: false,
          auditUserUuid,
        })
      )
      .where(eq(crewAssignments.assignUuid, current.assignUuid))
      .returning();

    return updated;
  },

  /**
   * Get all assignments for a crew (history)
   */
  async getAssignmentHistory(
    crewUuid: string,
    limit?: number
  ): Promise<CrewAssignment[]> {
    const db = getDb();
    await crewMembersService.getByUuid(crewUuid);

    let query = db
      .select()
      .from(crewAssignments)
      .where(
        and(
          eq(crewAssignments.crewUuid, crewUuid),
          eq(crewAssignments.isDeleted, false)
        )
      )
      .orderBy(desc(crewAssignments.signOnDate));

    if (limit && limit > 0) {
      query = query.limit(limit);
    }

    return query;
  },

  /**
   * Get all crew currently assigned to a vessel
   */
  async getVesselCrew(
    vesselUuid: string,
    includeSecondary: boolean = false
  ): Promise<CrewAssignment[]> {
    const db = getDb();

    const conditions = [
      eq(crewAssignments.vesselUuid, vesselUuid),
      eq(crewAssignments.isCurrent, true),
      eq(crewAssignments.isDeleted, false),
    ];

    if (!includeSecondary) {
      conditions.push(eq(crewAssignments.assignmentType, "primary"));
    }

    return db
      .select()
      .from(crewAssignments)
      .where(and(...conditions));
  },
};
