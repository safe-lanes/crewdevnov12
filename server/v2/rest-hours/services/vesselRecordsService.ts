import { VesselRecordsRepository, CrewRecordsRepository } from "../repositories";
import type {
  RhVesselRecordV2,
  InsertRhVesselRecordV2,
} from "../../../../shared/v2/rest-hours/types";
import { getDb } from "../../db";
import { crewAssignments, crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { crewRecordsService } from "./crewRecordsService";

const vesselRecordsRepository = new VesselRecordsRepository();
const crewRecordsRepository = new CrewRecordsRepository();

async function getOnboardCrewCount(vesselId: string): Promise<number> {
  const db = getDb();
  const crewData = await db
    .select({ crewUuid: crewAssignments.crewUuid })
    .from(crewAssignments)
    .innerJoin(crewMembersV2, eq(crewAssignments.crewUuid, crewMembersV2.crewUuid))
    .where(
      and(
        eq(crewAssignments.vesselUuid, vesselId),
        eq(crewAssignments.isCurrent, true),
        or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted))
      )
    );
  return crewData.length;
}

function applyAuditUser<T extends object>(
  data: T,
  isCreate = false
): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;

  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;

  return result;
}

async function enrichVesselRecordsWithLiveCounts(
  records: RhVesselRecordV2[]
): Promise<RhVesselRecordV2[]> {
  if (records.length === 0) return [];

  const enrichedRecords: RhVesselRecordV2[] = [];

  for (const record of records) {
    const onboardCrewCount = await getOnboardCrewCount(record.vesselId);
    const totalCrew = Math.max(onboardCrewCount, record.totalCrew || 0);

    const enrichedCrewRecords = await crewRecordsService.getAll({
      vesselId: record.vesselId,
      monthValue: record.monthValue,
    });

    if (enrichedCrewRecords.length > 0) {
      const totalViolations = enrichedCrewRecords.reduce((sum, r) => sum + (r.totalViolations || 0), 0);
      const crewWithViolations = enrichedCrewRecords.filter(r => (r.totalViolations || 0) > 0).length;
      const totalNCs = enrichedCrewRecords.reduce((sum, r) => sum + (r.totalNCs || 0), 0);
      const crewWithNCs = enrichedCrewRecords.filter(r => (r.totalNCs || 0) > 0).length;
      const predictedViolations = enrichedCrewRecords.reduce((sum, r) => sum + (r.predictedViolations || 0), 0);
      const crewWithPredictedViolations = enrichedCrewRecords.filter(r => (r.predictedViolations || 0) > 0).length;
      const predictedNCs = enrichedCrewRecords.reduce((sum, r) => sum + (r.predictedNCs || 0), 0);
      const crewWithPredictedNCs = enrichedCrewRecords.filter(r => (r.totalNCs || 0) === 0 && (r.predictedNCs || 0) > 0).length;

      const totalPercent = enrichedCrewRecords.reduce((sum, r) => sum + (r.recordingStatusPercent || 0), 0);
      const averagePercent = Math.round(totalPercent / enrichedCrewRecords.length);

      enrichedRecords.push({
        ...record,
        totalCrew,
        totalViolations,
        crewWithViolations,
        totalNCs,
        crewWithNCs,
        predictedViolations,
        crewWithPredictedViolations,
        predictedNCs,
        crewWithPredictedNCs,
        recordingStatusPercent: averagePercent,
      });
    } else {
      enrichedRecords.push({
        ...record,
        totalCrew,
      });
    }
  }

  return enrichedRecords;
}

export const vesselRecordsService = {
  async getAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhVesselRecordV2[]> {
    const records = await vesselRecordsRepository.findAll(filters);
    return enrichVesselRecordsWithLiveCounts(records);
  },

  async getByUuid(rhVesselUuid: string): Promise<RhVesselRecordV2> {
    const record = await vesselRecordsRepository.findByUuid(rhVesselUuid);
    if (!record) {
      throw new Error(`Vessel record not found: ${rhVesselUuid}`);
    }
    return record;
  },

  async getByFilters(
    vesselIds: string[],
    monthValue?: string
  ): Promise<RhVesselRecordV2[]> {
    if (!vesselIds || vesselIds.length === 0) {
      return [];
    }

    const allRecords: RhVesselRecordV2[] = [];
    for (const vesselId of vesselIds) {
      const records = await vesselRecordsRepository.findAll({
        vesselId,
        monthValue,
      });
      allRecords.push(...records);
    }

    return enrichVesselRecordsWithLiveCounts(allRecords);
  },

  async create(
    data: Omit<InsertRhVesselRecordV2, "rhVesselUuid"> & { auditUserUuid?: string }
  ): Promise<RhVesselRecordV2> {
    if (!data.vesselId) {
      throw new Error("Vessel ID is required");
    }
    if (!data.monthValue) {
      throw new Error("Month value is required");
    }

    const dataWithAudit = applyAuditUser(data, true);
    return vesselRecordsRepository.create(dataWithAudit);
  },

  async update(
    rhVesselUuid: string,
    data: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string }
  ): Promise<RhVesselRecordV2> {
    await this.getByUuid(rhVesselUuid);

    const dataWithAudit = applyAuditUser(data, false);
    const updated = await vesselRecordsRepository.update(rhVesselUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Failed to update vessel record: ${rhVesselUuid}`);
    }
    return updated;
  },

  async delete(rhVesselUuid: string): Promise<void> {
    await this.getByUuid(rhVesselUuid);
    const success = await vesselRecordsRepository.softDelete(rhVesselUuid);
    if (!success) {
      throw new Error(`Failed to delete vessel record: ${rhVesselUuid}`);
    }
  },

  async getByVesselId(vesselId: string): Promise<RhVesselRecordV2> {
    const record = await vesselRecordsRepository.findByVesselId(vesselId);
    if (!record) {
      throw new Error(`Vessel record not found for vesselId: ${vesselId}`);
    }
    return record;
  },

  async submitVesselReview(
    vesselId: string,
    data: {
      auditUserUuid?: string;
    }
  ): Promise<RhVesselRecordV2> {
    const record = await this.getByVesselId(vesselId);

    const updateData: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string } = {
      vesselReviewStatus: "Submitted",
      vesselReviewSubmittedDate: new Date(),
      auditUserUuid: data.auditUserUuid,
    };

    return this.update(record.rhVesselUuid, updateData);
  },

  async submitOfficeReview(
    vesselId: string,
    data: {
      auditUserUuid?: string;
    }
  ): Promise<RhVesselRecordV2> {
    const record = await this.getByVesselId(vesselId);

    const updateData: Partial<InsertRhVesselRecordV2> & { auditUserUuid?: string } = {
      officeReviewStatus: "Submitted",
      officeReviewSubmittedDate: new Date(),
      auditUserUuid: data.auditUserUuid,
    };

    return this.update(record.rhVesselUuid, updateData);
  },
};
