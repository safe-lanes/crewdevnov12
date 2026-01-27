import { crewMembersService } from "./crewMembersService";
import { crewAssignmentsService } from "./crewAssignmentsService";
import { resolveCountryUuid, resolveVesselTypeUuid } from "./masterDataResolver";
import {
  CrewPersonalRepository,
  CrewFamilyRepository,
  CrewVesselTypesRepository,
} from "../repositories";
import type {
  InsertCrewChild,
  CrewChild,
} from "../../../../shared/v2/crew-pool/types";

const crewPersonalRepository = new CrewPersonalRepository();
const crewFamilyRepository = new CrewFamilyRepository();
const crewVesselTypesRepository = new CrewVesselTypesRepository();

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

// Helper to calculate age from date of birth
function calculateAge(dob: string | null | undefined): string | null {
  if (!dob) return null;
  
  try {
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year yet
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 0 ? age.toString() : null;
  } catch {
    return null;
  }
}

export const crewProfileService = {
  async getFullProfile(crewUuid: string) {
    const [
      crew,
      currentAssignment,
      personalDetails,
      address,
      familyInfo,
      children,
      nextOfKin,
      vesselTypes,
    ] = await Promise.all([
      crewMembersService.getByUuid(crewUuid),
      crewAssignmentsService.getCurrent(crewUuid),
      crewPersonalRepository.findPersonalDetailsByCrewUuid(crewUuid),
      crewPersonalRepository.findAddressByCrewUuid(crewUuid),
      crewFamilyRepository.findFamilyInfoByCrewUuid(crewUuid),
      crewFamilyRepository.findChildrenByCrewUuid(crewUuid),
      crewFamilyRepository.findNextOfKinByCrewUuid(crewUuid),
      crewVesselTypesRepository.findByCrewUuid(crewUuid),
    ]);

    return {
      crew,
      currentAssignment,
      personalDetails,
      address,
      family: {
        info: familyInfo,
        children,
        nextOfKin,
      },
      vesselTypes,
    };
  },

  async getPersonalDetails(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewPersonalRepository.findFullProfileByCrewUuid(crewUuid);
  },

  async getAddress(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewPersonalRepository.findAddressByCrewUuid(crewUuid);
  },

  async getFamilyInfo(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.findFullFamilyByCrewUuid(crewUuid);
  },

  async getChildren(crewUuid: string): Promise<CrewChild[]> {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.findChildrenByCrewUuid(crewUuid);
  },

  async getNextOfKin(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.findNextOfKinByCrewUuid(crewUuid);
  },

  async getVesselTypes(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewVesselTypesRepository.findByCrewUuid(crewUuid);
  },

  async upsertPersonalDetails(
    crewUuid: string,
    data: Parameters<typeof crewPersonalRepository.upsertPersonalDetails>[1] & {
      placeOfBirthCountry?: string;
      dob?: string | null;
    }
  ) {
    await crewMembersService.getByUuid(crewUuid);

    // Resolve country if provided (accept name or UUID)
    const countryInput = data.placeOfBirthCountryUuid || (data as any).placeOfBirthCountry;
    if (countryInput) {
      const countryUuid = await resolveCountryUuid(countryInput);
      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
      }
      data.placeOfBirthCountryUuid = countryUuid;
    }

    // Calculate age from date of birth if dob is provided, or clear it if null
    if (data.dob !== undefined) {
      (data as any).ageInYears = data.dob ? calculateAge(data.dob) : null;
    }

    // Remove non-schema fields and apply audit user
    const { placeOfBirthCountry, dob, ...cleanData } = data as any;
    const dataWithAudit = applyAuditUser(cleanData, false);

    return crewPersonalRepository.upsertPersonalDetails(crewUuid, dataWithAudit);
  },

  async upsertAddress(
    crewUuid: string,
    data: Parameters<typeof crewPersonalRepository.upsertAddress>[1] & {
      countryOfResidence?: string;
    }
  ) {
    await crewMembersService.getByUuid(crewUuid);

    // Resolve country if provided (accept name or UUID)
    const countryInput = data.countryOfResidenceUuid || (data as any).countryOfResidence;
    if (countryInput) {
      const countryUuid = await resolveCountryUuid(countryInput);
      if (!countryUuid) {
        throw new Error(`Invalid country: "${countryInput}". Not found in master_countries table.`);
      }
      data.countryOfResidenceUuid = countryUuid;
    }

    // Remove non-schema fields and apply audit user
    const { countryOfResidence, ...cleanData } = data as any;
    const dataWithAudit = applyAuditUser(cleanData, false);

    return crewPersonalRepository.upsertAddress(crewUuid, dataWithAudit);
  },

  async upsertFamilyInfo(
    crewUuid: string,
    data: Parameters<typeof crewFamilyRepository.upsertFamilyInfo>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    const dataWithAudit = applyAuditUser(data, false);
    return crewFamilyRepository.upsertFamilyInfo(crewUuid, dataWithAudit);
  },

  async upsertNextOfKin(
    crewUuid: string,
    data: Parameters<typeof crewFamilyRepository.upsertNextOfKin>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    const dataWithAudit = applyAuditUser(data, false);
    return crewFamilyRepository.upsertNextOfKin(crewUuid, dataWithAudit);
  },

  async syncChildren(
    crewUuid: string,
    children: Parameters<typeof crewFamilyRepository.syncChildren>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    // Apply audit user to each child
    const childrenWithAudit = children.map(child => applyAuditUser(child, true));
    return crewFamilyRepository.syncChildren(crewUuid, childrenWithAudit);
  },

  async createChild(
    crewUuid: string,
    data: Omit<InsertCrewChild, "childUuid" | "crewUuid">
  ): Promise<CrewChild> {
    await crewMembersService.getByUuid(crewUuid);
    const dataWithAudit = applyAuditUser(data, true);
    return crewFamilyRepository.createChild({ ...dataWithAudit, crewUuid });
  },

  async updateChild(
    childUuid: string,
    data: Partial<InsertCrewChild>
  ): Promise<CrewChild> {
    const dataWithAudit = applyAuditUser(data, false);
    const updated = await crewFamilyRepository.updateChild(childUuid, dataWithAudit);
    if (!updated) {
      throw new Error(`Child not found: ${childUuid}`);
    }
    return updated;
  },

  async deleteChild(childUuid: string): Promise<void> {
    const success = await crewFamilyRepository.softDeleteChild(childUuid);
    if (!success) {
      throw new Error(`Failed to delete child: ${childUuid}`);
    }
  },

  async syncVesselTypes(crewUuid: string, vesselTypeUuids: string[]) {
    await crewMembersService.getByUuid(crewUuid);
    return crewVesselTypesRepository.sync(crewUuid, vesselTypeUuids);
  },
};
