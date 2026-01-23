import { crewMembersService } from "./crewMembersService";
import { crewAssignmentsService } from "./crewAssignmentsService";
import {
  CrewPersonalRepository,
  CrewFamilyRepository,
  CrewVesselTypesRepository,
} from "../repositories";

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

  async getFamilyInfo(crewUuid: string) {
    await crewMembersService.getByUuid(crewUuid);
    return crewFamilyRepository.findFullFamilyByCrewUuid(crewUuid);
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

  async syncVesselTypes(crewUuid: string, vesselTypeUuids: string[]) {
    await crewMembersService.getByUuid(crewUuid);
    return crewVesselTypesRepository.sync(crewUuid, vesselTypeUuids);
  },
};
