import { eq, and, desc, asc, sql } from "drizzle-orm";
import { getDb } from "../../db";
import {
  masterNationalities,
  masterVessels,
  masterVesselTypes,
  masterAdditionalGroups,
  masterPorts,
  masterFleetGroups,
  masterLanguages,
  masterCountries,
  masterUsers,
} from "../../../../shared/schema";

export class MastersRepository {
  async findAllNationalities() {
    const db = getDb();
    return db
      .select()
      .from(masterNationalities)
      .where(eq(masterNationalities.isDeleted, false))
      .orderBy(asc(masterNationalities.nationality));
  }

  async findNationalityByUuid(natUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterNationalities)
      .where(and(eq(masterNationalities.natUuid, natUuid), eq(masterNationalities.isDeleted, false)));
    return results[0];
  }

  async findAllVessels() {
    const db = getDb();
    return db
      .select()
      .from(masterVessels)
      .orderBy(sql`LOWER(${masterVessels.vessel})`);
  }

  async findVesselByUuid(vesselUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterVessels)
      .where(eq(masterVessels.vesselUuid, vesselUuid));
    return results[0];
  }

  async findAllVesselTypes() {
    const db = getDb();
    return db
      .select()
      .from(masterVesselTypes)
      .where(and(eq(masterVesselTypes.isDeleted, false), eq(masterVesselTypes.isActive, true)))
      .orderBy(asc(masterVesselTypes.vesselType));
  }

  async findVesselTypeByUuid(vtUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterVesselTypes)
      .where(and(eq(masterVesselTypes.vtUuid, vtUuid), eq(masterVesselTypes.isDeleted, false)));
    return results[0];
  }

  async findAllAdditionalGroups() {
    const db = getDb();
    return db
      .select()
      .from(masterAdditionalGroups)
      .orderBy(asc(masterAdditionalGroups.name));
  }

  async findAdditionalGroupByUuid(agUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterAdditionalGroups)
      .where(eq(masterAdditionalGroups.agUuid, agUuid));
    return results[0];
  }

  async findAllPorts() {
    const db = getDb();
    return db
      .select()
      .from(masterPorts)
      .where(and(eq(masterPorts.isDeleted, false), eq(masterPorts.isActive, true)))
      .orderBy(asc(masterPorts.name));
  }

  async findPortByUuid(portUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterPorts)
      .where(and(eq(masterPorts.portUuid, portUuid), eq(masterPorts.isDeleted, false)));
    return results[0];
  }

  async findAllFleetGroups() {
    const db = getDb();
    return db
      .select()
      .from(masterFleetGroups)
      .orderBy(asc(masterFleetGroups.name));
  }

  async findFleetGroupByUuid(fgUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterFleetGroups)
      .where(eq(masterFleetGroups.fgUuid, fgUuid));
    return results[0];
  }

  async findAllLanguages() {
    const db = getDb();
    return db
      .select()
      .from(masterLanguages)
      .where(and(eq(masterLanguages.isDeleted, false), eq(masterLanguages.isActive, true)))
      .orderBy(asc(masterLanguages.displayOrder));
  }

  async findLanguageByUuid(langUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterLanguages)
      .where(and(eq(masterLanguages.langUuid, langUuid), eq(masterLanguages.isDeleted, false)));
    return results[0];
  }

  async findAllCountries() {
    const db = getDb();
    return db
      .select()
      .from(masterCountries)
      .where(and(eq(masterCountries.isDeleted, false), eq(masterCountries.isActive, true)))
      .orderBy(asc(masterCountries.orderBy));
  }

  async findCountryByUuid(countryUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterCountries)
      .where(and(eq(masterCountries.countryUuid, countryUuid), eq(masterCountries.isDeleted, false)));
    return results[0];
  }

  async findAllUsers() {
    const db = getDb();
    return db
      .select()
      .from(masterUsers)
      .orderBy(asc(masterUsers.fullname));
  }

  async findUserByUuid(userUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterUsers)
      .where(eq(masterUsers.userUuid, userUuid));
    return results[0];
  }
}
