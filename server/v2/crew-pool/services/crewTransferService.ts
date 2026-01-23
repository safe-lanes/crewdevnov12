import { CrewMembersRepository } from "../repositories";
import type { InsertCrewMemberV2 } from "../../../../shared/v2/crew-pool/types";

const crewMembersRepository = new CrewMembersRepository();

export const crewTransferService = {
  async transferFromRecruitment(recCanUuid: string) {
    throw new Error(
      "Not implemented - requires recruitment V2 tables integration"
    );
  },

  async transferFromLegacyCrewPool(legacyCrewId: number) {
    throw new Error(
      "Not implemented - requires legacy crew_members table integration"
    );
  },

  async validateTransferData(
    data: Partial<InsertCrewMemberV2>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!data.firstName) {
      errors.push("First name is required");
    }
    if (!data.familyName) {
      errors.push("Family name is required");
    }
    if (!data.empNo) {
      errors.push("Employee number is required");
    }

    if (data.empNo) {
      const existing = await crewMembersRepository.findByEmpNo(data.empNo);
      if (existing) {
        errors.push(`Employee number ${data.empNo} already exists`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  async prepareTransferData(
    sourceData: Record<string, unknown>
  ): Promise<Partial<InsertCrewMemberV2>> {
    return {
      firstName: sourceData.firstName as string | undefined,
      familyName: sourceData.familyName as string | undefined,
      empNo: sourceData.empNo as string | undefined,
      employeeId: sourceData.employeeId as string | undefined,
      presentRank: sourceData.presentRank as string | undefined,
      nationalityUuid: sourceData.nationalityUuid as string | undefined,
      status: "active",
      isActive: true,
    };
  },
};
