import { MastersRepository } from "../repositories/mastersRepository";

const mastersRepo = new MastersRepository();

export const mastersService = {
  async getNationalities() {
    return mastersRepo.findAllNationalities();
  },

  async getNationalityByUuid(natUuid: string) {
    const result = await mastersRepo.findNationalityByUuid(natUuid);
    if (!result) throw new Error(`Nationality not found: ${natUuid}`);
    return result;
  },

  async getVessels() {
    return mastersRepo.findAllVessels();
  },

  async getVesselByUuid(vesselUuid: string) {
    const result = await mastersRepo.findVesselByUuid(vesselUuid);
    if (!result) throw new Error(`Vessel not found: ${vesselUuid}`);
    return result;
  },

  async getVesselTypes() {
    return mastersRepo.findAllVesselTypes();
  },

  async getVesselTypeByUuid(vtUuid: string) {
    const result = await mastersRepo.findVesselTypeByUuid(vtUuid);
    if (!result) throw new Error(`Vessel type not found: ${vtUuid}`);
    return result;
  },

  async getAdditionalGroups() {
    return mastersRepo.findAllAdditionalGroups();
  },

  async getAdditionalGroupByUuid(agUuid: string) {
    const result = await mastersRepo.findAdditionalGroupByUuid(agUuid);
    if (!result) throw new Error(`Additional group not found: ${agUuid}`);
    return result;
  },

  async getPorts() {
    return mastersRepo.findAllPorts();
  },

  async getPortByUuid(portUuid: string) {
    const result = await mastersRepo.findPortByUuid(portUuid);
    if (!result) throw new Error(`Port not found: ${portUuid}`);
    return result;
  },

  async getFleetGroups() {
    return mastersRepo.findAllFleetGroups();
  },

  async getFleetGroupByUuid(fgUuid: string) {
    const result = await mastersRepo.findFleetGroupByUuid(fgUuid);
    if (!result) throw new Error(`Fleet group not found: ${fgUuid}`);
    return result;
  },

  async getLanguages() {
    return mastersRepo.findAllLanguages();
  },

  async getLanguageByUuid(langUuid: string) {
    const result = await mastersRepo.findLanguageByUuid(langUuid);
    if (!result) throw new Error(`Language not found: ${langUuid}`);
    return result;
  },

  async getCountries() {
    return mastersRepo.findAllCountries();
  },

  async getCountryByUuid(countryUuid: string) {
    const result = await mastersRepo.findCountryByUuid(countryUuid);
    if (!result) throw new Error(`Country not found: ${countryUuid}`);
    return result;
  },

  async getUsers() {
    return mastersRepo.findAllUsers();
  },

  async getUserByUuid(userUuid: string) {
    const result = await mastersRepo.findUserByUuid(userUuid);
    if (!result) throw new Error(`User not found: ${userUuid}`);
    return result;
  },
};
