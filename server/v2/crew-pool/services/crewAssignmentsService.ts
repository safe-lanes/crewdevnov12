import { eq, and, desc } from "drizzle-orm";
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
const CURRENT_ASSIGNMENT_TYPES = ["Planned", "OnBoard", "Cancelled"] as const;

function requireCurrentAssignmentType(value: unknown): void {
  if (!CURRENT_ASSIGNMENT_TYPES.includes(value as typeof CURRENT_ASSIGNMENT_TYPES[number])) {
    throw new Error("Assignment type must be Planned, OnBoard, or Cancelled");
  }
}

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
    requireCurrentAssignmentType(data.assignmentType);

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
    if ("assignmentType" in data) {
      requireCurrentAssignmentType(data.assignmentType);
    }

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
          eq(crewAssignments.assignmentType, "OnBoard"),
          eq(crewAssignments.isDeleted, false),
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
      conditions.push(eq(crewAssignments.assignmentType, "OnBoard"));
    }

    return db
      .select()
      .from(crewAssignments)
      .where(and(...conditions));
  },
};
