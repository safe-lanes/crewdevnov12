import { MastersRepository } from "../repositories/mastersRepository";
import type {
  CreateMasterLicenseDce,
  UpdateMasterLicenseDce,
  CreateMasterCrewPool,
  UpdateMasterCrewPool,
  CreateMasterAppraisalType,
  UpdateMasterAppraisalType,
} from "../../../../shared/schema";

const mastersRepo = new MastersRepository();

function addVesselAliases(row: any) {
  return { ...row, uuid: row.vesselUuid, name: row.vessel };
}

function addVesselTypeAliases(row: any) {
  return { ...row, uuid: row.vtUuid, name: row.vesselType };
}

function addNationalityAliases(row: any) {
  return { ...row, uuid: row.natUuid, name: row.nationality };
}

function addCountryAliases(row: any) {
  return { ...row, uuid: row.countryUuid, name: row.countryName };
}

function addPortAliases(row: any) {
  return { ...row, uuid: row.portUuid };
}

function addLanguageAliases(row: any) {
  return { ...row, uuid: row.langUuid, name: row.languageName };
}

function addFleetGroupAliases(row: any) {
  return { ...row, uuid: row.fgUuid };
}

function addAdditionalGroupAliases(row: any) {
  return { ...row, uuid: row.agUuid };
}

function addUserAliases(row: any) {
  return { ...row, uuid: row.userUuid, userName: row.displayName };
}

function addLicenseDceAliases(row: any) {
  return { ...row, uuid: row.id };
}

function addManningAgentAliases(row: any) {
  return { ...row, uuid: row.id };
}

function addCrewPoolAliases(row: any) {
  return { ...row, uuid: row.id };
}

function addAppraisalTypeAliases(row: any) {
  return { ...row, uuid: row.id };
}

export const mastersService = {
  async getNationalities() {
    const rows = await mastersRepo.findAllNationalities();
    return rows.map(addNationalityAliases);
  },

  async getNationalityByUuid(natUuid: string) {
    const result = await mastersRepo.findNationalityByUuid(natUuid);
    if (!result) throw new Error(`Nationality not found: ${natUuid}`);
    return addNationalityAliases(result);
  },

  async getVessels() {
    const rows = await mastersRepo.findAllVessels();
    return rows.map(addVesselAliases);
  },

  /** Returns all vessels including inactive/deleted — for sea service & import template use. */
  async getAllVessels() {
    const rows = await mastersRepo.findAllVesselsIncludingInactive();
    return rows.map(addVesselAliases);
  },

  async getVesselByUuid(vesselUuid: string) {
    const result = await mastersRepo.findVesselByUuid(vesselUuid);
    if (!result) throw new Error(`Vessel not found: ${vesselUuid}`);
    return addVesselAliases(result);
  },

  async getVesselTypes() {
    const rows = await mastersRepo.findAllVesselTypes();
    return rows.map(addVesselTypeAliases);
  },

  async getVesselTypeByUuid(vtUuid: string) {
    const result = await mastersRepo.findVesselTypeByUuid(vtUuid);
    if (!result) throw new Error(`Vessel type not found: ${vtUuid}`);
    return addVesselTypeAliases(result);
  },

  async getAdditionalGroups() {
    const rows = await mastersRepo.findAllAdditionalGroups();
    return rows.map(addAdditionalGroupAliases);
  },

  async getAdditionalGroupByUuid(agUuid: string) {
    const result = await mastersRepo.findAdditionalGroupByUuid(agUuid);
    if (!result) throw new Error(`Additional group not found: ${agUuid}`);
    return addAdditionalGroupAliases(result);
  },

  async getPorts() {
    const rows = await mastersRepo.findAllPorts();
    return rows.map(addPortAliases);
  },

  async getPortByUuid(portUuid: string) {
    const result = await mastersRepo.findPortByUuid(portUuid);
    if (!result) throw new Error(`Port not found: ${portUuid}`);
    return addPortAliases(result);
  },

  async getFleetGroups() {
    const rows = await mastersRepo.findAllFleetGroups();
    return rows.map(addFleetGroupAliases);
  },

  async getFleetGroupByUuid(fgUuid: string) {
    const result = await mastersRepo.findFleetGroupByUuid(fgUuid);
    if (!result) throw new Error(`Fleet group not found: ${fgUuid}`);
    return addFleetGroupAliases(result);
  },

  async getLanguages() {
    const rows = await mastersRepo.findAllLanguages();
    return rows.map(addLanguageAliases);
  },

  async getLanguageByUuid(langUuid: string) {
    const result = await mastersRepo.findLanguageByUuid(langUuid);
    if (!result) throw new Error(`Language not found: ${langUuid}`);
    return addLanguageAliases(result);
  },

  async getCountries() {
    const rows = await mastersRepo.findAllCountries();
    return rows.map(addCountryAliases);
  },

  async getCountryByUuid(countryUuid: string) {
    const result = await mastersRepo.findCountryByUuid(countryUuid);
    if (!result) throw new Error(`Country not found: ${countryUuid}`);
    return addCountryAliases(result);
  },

  async getUsers() {
    const rows = await mastersRepo.findAllUsers();
    return rows.map(addUserAliases);
  },

  async getDepartments() {
    return mastersRepo.findDistinctDepartments();
  },

  async getUserByUuid(userUuid: string) {
    const result = await mastersRepo.findUserByUuid(userUuid);
    if (!result) throw new Error(`User not found: ${userUuid}`);
    return addUserAliases(result);
  },

  async getLicensesDce() {
    const rows = await mastersRepo.findAllLicensesDce();
    return rows.map(addLicenseDceAliases);
  },

  async getLicenseDceById(id: string) {
    const result = await mastersRepo.findLicenseDceById(id);
    if (!result) throw new Error(`License/DCE not found: ${id}`);
    return addLicenseDceAliases(result);
  },

  async getManningAgents() {
    const rows = await mastersRepo.findAllManningAgents();
    return rows.map(addManningAgentAliases);
  },

  async getManningAgentsWithActiveCrew() {
    const rows = await mastersRepo.findManningAgentsWithActiveCrew();
    return rows.map(addManningAgentAliases);
  },

  async getManningAgentById(id: string) {
    const result = await mastersRepo.findManningAgentById(id);
    if (!result) throw new Error(`Manning agent not found: ${id}`);
    return addManningAgentAliases(result);
  },

  async getCrewPools() {
    const rows = await mastersRepo.findAllCrewPools();
    return rows.map(addCrewPoolAliases);
  },

  async getCrewPoolById(id: string) {
    const result = await mastersRepo.findCrewPoolById(id);
    if (!result) throw new Error(`Crew pool not found: ${id}`);
    return addCrewPoolAliases(result);
  },

  async getAppraisalTypes() {
    const rows = await mastersRepo.findAllAppraisalTypes();
    return rows.map(addAppraisalTypeAliases);
  },

  async getAppraisalTypeById(id: string) {
    const result = await mastersRepo.findAppraisalTypeById(id);
    if (!result) throw new Error(`Appraisal type not found: ${id}`);
    return addAppraisalTypeAliases(result);
  },

  async createLicenseDce(data: CreateMasterLicenseDce) {
    const row = await mastersRepo.createLicenseDce(data);
    return addLicenseDceAliases(row);
  },

  async updateLicenseDce(id: string, data: UpdateMasterLicenseDce) {
    const row = await mastersRepo.updateLicenseDce(id, data);
    if (!row) throw new Error(`License/DCE not found: ${id}`);
    return addLicenseDceAliases(row);
  },

  async deleteLicenseDce(id: string) {
    const row = await mastersRepo.deleteLicenseDce(id);
    if (!row) throw new Error(`License/DCE not found: ${id}`);
    return addLicenseDceAliases(row);
  },

  async createCrewPool(data: CreateMasterCrewPool) {
    const row = await mastersRepo.createCrewPool(data);
    return addCrewPoolAliases(row);
  },

  async updateCrewPool(id: string, data: UpdateMasterCrewPool) {
    const row = await mastersRepo.updateCrewPool(id, data);
    if (!row) throw new Error(`Crew pool not found: ${id}`);
    return addCrewPoolAliases(row);
  },

  async deleteCrewPool(id: string) {
    const row = await mastersRepo.deleteCrewPool(id);
    if (!row) throw new Error(`Crew pool not found: ${id}`);
    return addCrewPoolAliases(row);
  },

  async createAppraisalType(data: CreateMasterAppraisalType) {
    const row = await mastersRepo.createAppraisalType(data);
    return addAppraisalTypeAliases(row);
  },

  async updateAppraisalType(id: string, data: UpdateMasterAppraisalType) {
    const row = await mastersRepo.updateAppraisalType(id, data);
    if (!row) throw new Error(`Appraisal type not found: ${id}`);
    return addAppraisalTypeAliases(row);
  },

  async deleteAppraisalType(id: string) {
    const row = await mastersRepo.deleteAppraisalType(id);
    if (!row) throw new Error(`Appraisal type not found: ${id}`);
    return addAppraisalTypeAliases(row);
  },
};
