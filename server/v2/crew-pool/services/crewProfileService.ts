import { crewMembersService } from "./crewMembersService";
import { crewAssignmentsService } from "./crewAssignmentsService";
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
    data: Parameters<typeof crewPersonalRepository.upsertPersonalDetails>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    return crewPersonalRepository.upsertPersonalDetails(crewUuid, data);
  },

  async upsertAddress(
    crewUuid: string,
    data: Parameters<typeof crewPersonalRepository.upsertAddress>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    return crewPersonalRepository.upsertAddress(crewUuid, data);
  },

  async upsertFamilyInfo(
    crewUuid: string,
    data: Parameters<typeof crewFamilyRepository.upsertFamilyInfo>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.upsertFamilyInfo(crewUuid, data);
  },

  async upsertNextOfKin(
    crewUuid: string,
    data: Parameters<typeof crewFamilyRepository.upsertNextOfKin>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.upsertNextOfKin(crewUuid, data);
  },

  async syncChildren(
    crewUuid: string,
    children: Parameters<typeof crewFamilyRepository.syncChildren>[1]
  ) {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.syncChildren(crewUuid, children);
  },

  async createChild(
    crewUuid: string,
    data: Omit<InsertCrewChild, "childUuid" | "crewUuid">
  ): Promise<CrewChild> {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.createChild({ ...data, crewUuid });
  },

  async updateChild(
    childUuid: string,
    data: Partial<InsertCrewChild>
  ): Promise<CrewChild> {
    const updated = await crewFamilyRepository.updateChild(childUuid, data);
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
