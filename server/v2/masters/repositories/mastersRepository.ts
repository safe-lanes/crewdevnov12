import { eq, and, desc, asc, sql, getTableName } from "drizzle-orm";
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
  masterLicensesDce,
  masterManningAgents,
  masterCrewPools,
  masterAppraisalTypes,
} from "../../../../shared/schema";

const MASTER_TABLE_MAP: Record<string, any> = {
  nationalities: masterNationalities,
  vessels: masterVessels,
  vesselTypes: masterVesselTypes,
  additionalGroups: masterAdditionalGroups,
  ports: masterPorts,
  fleetGroups: masterFleetGroups,
  languages: masterLanguages,
  countries: masterCountries,
  users: masterUsers,
};

const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  nationalities: {
    cid: 'natUuid',
    countryCode: 'countryCode',
    countryName: 'countryName',
    nationality: 'nationality',
    countryRefId: 'countryRefId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    createdBy: 'createdBy',
    isDeleted: 'isDeleted',
  },
  vessels: {
    vuid: 'vesselUuid',
    vessel: 'vessel',
    imoNumber: 'imoNumber',
    vesselType: 'vesselType',
  },
  vesselTypes: {
    vtuid: 'vtUuid',
    vesselType: 'vesselType',
    tanker: 'tanker',
    oilTanker: 'oilTanker',
    gasTanker: 'gasTanker',
    container: 'container',
    chemicalTanker: 'chemicalTanker',
    other: 'other',
    dry: 'dry',
    isActive: 'isActive',
    isDeleted: 'isDeleted',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
  },
  additionalGroups: {
    id: 'agUuid',
    name: 'name',
    vessels: 'vessels',
  },
  ports: {
    puid: 'portUuid',
    name: 'name',
    latitude: 'latitude',
    longitude: 'longitude',
    country: 'country',
    portcode: 'portcode',
    isActive: 'isActive',
    isDeleted: 'isDeleted',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    createdBy: 'createdBy',
  },
  fleetGroups: {
    id: 'fgUuid',
    name: 'name',
    vessels: 'vessels',
  },
  languages: {
    luid: 'langUuid',
    isoCode: 'isoCode',
    languageName: 'languageName',
    nativeName: 'nativeName',
    isForeignLanguage: 'isForeignLanguage',
    displayOrder: 'displayOrder',
    isActive: 'isActive',
    isDeleted: 'isDeleted',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  countries: {
    nuid: 'countryUuid',
    countryName: 'countryName',
    isActive: 'isActive',
    isDeleted: 'isDeleted',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    createdBy: 'createdBy',
    domain: 'domain',
    orderBy: 'orderBy',
  },
  users: {
    uuid: 'userUuid',
    firstname: 'firstname',
    lastname: 'lastname',
    email: 'email',
    fullname: 'fullname',
    userType: 'userType',
    designation: 'designation',
    department: 'department',
    role: 'role',
    displayName: 'displayName',
  },
};

const BOOLEAN_FIELDS = new Set([
  'tanker', 'oilTanker', 'gasTanker', 'chemicalTanker', 'dry', 'container', 'other',
  'isActive', 'isDeleted', 'isForeignLanguage',
]);

const TIMESTAMP_FIELDS = new Set(['createdAt', 'updatedAt', 'synchedAt']);

function buildVesselClassification(item: any): string | null {
  const classifications: string[] = [];
  if (item.tanker === true || item.tanker === 1) classifications.push('Tanker');
  if (item.oilTanker === true || item.oilTanker === 1) classifications.push('Oil');
  if (item.gasTanker === true || item.gasTanker === 1) classifications.push('Gas');
  if (item.chemicalTanker === true || item.chemicalTanker === 1) classifications.push('Chemical');
  if (item.dry === true || item.dry === 1) classifications.push('Dry');
  if (item.container === true || item.container === 1) classifications.push('Container');
  return classifications.length > 0 ? classifications.join(', ') : null;
}

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

  async findAllLicensesDce() {
    const db = getDb();
    return db
      .select()
      .from(masterLicensesDce)
      .where(and(eq(masterLicensesDce.isDeleted, false), eq(masterLicensesDce.isActive, true)))
      .orderBy(asc(masterLicensesDce.sortOrder));
  }

  async findLicenseDceById(id: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterLicensesDce)
      .where(and(eq(masterLicensesDce.id, id), eq(masterLicensesDce.isDeleted, false)));
    return results[0];
  }

  async findLicenseDceByEntryId(entryId: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterLicensesDce)
      .where(and(eq(masterLicensesDce.entryId, entryId), eq(masterLicensesDce.isDeleted, false)));
    return results[0];
  }

  async findAllManningAgents() {
    const db = getDb();
    return db
      .select()
      .from(masterManningAgents)
      .where(and(eq(masterManningAgents.isDeleted, false), eq(masterManningAgents.isActive, true)))
      .orderBy(asc(masterManningAgents.sortOrder));
  }

  async findManningAgentById(id: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterManningAgents)
      .where(and(eq(masterManningAgents.id, id), eq(masterManningAgents.isDeleted, false)));
    return results[0];
  }

  async findAllCrewPools() {
    const db = getDb();
    return db
      .select()
      .from(masterCrewPools)
      .where(and(eq(masterCrewPools.isDeleted, false), eq(masterCrewPools.isActive, true)))
      .orderBy(asc(masterCrewPools.sortOrder));
  }

  async findCrewPoolById(id: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterCrewPools)
      .where(and(eq(masterCrewPools.id, id), eq(masterCrewPools.isDeleted, false)));
    return results[0];
  }

  async findAllAppraisalTypes() {
    const db = getDb();
    return db
      .select()
      .from(masterAppraisalTypes)
      .where(and(eq(masterAppraisalTypes.isDeleted, false), eq(masterAppraisalTypes.isActive, true)))
      .orderBy(asc(masterAppraisalTypes.sortOrder));
  }

  async findAppraisalTypeById(id: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterAppraisalTypes)
      .where(and(eq(masterAppraisalTypes.id, id), eq(masterAppraisalTypes.isDeleted, false)));
    return results[0];
  }

  async findAppraisalTypeByEntryId(entryId: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterAppraisalTypes)
      .where(and(eq(masterAppraisalTypes.entryId, entryId), eq(masterAppraisalTypes.isDeleted, false)));
    return results[0];
  }

  async getMasterData(masterType: string): Promise<any[]> {
    const table = MASTER_TABLE_MAP[masterType];
    if (!table) {
      console.warn(`[MastersRepository] Unknown master type: ${masterType}`);
      return [];
    }

    try {
      const db = getDb();
      const rows = await db.select().from(table).orderBy(table.id);
      console.log(`[MastersRepository] getMasterData(${masterType}): returned ${rows.length} records`);

      if (masterType === 'vesselTypes') {
        return rows.map((row: any) => ({
          ...row,
          classification: buildVesselClassification(row),
        }));
      }
      return rows;
    } catch (error: any) {
      console.error(`[MastersRepository] getMasterData error`, error);
      return [];
    }
  }

  async syncMasterData(masterType: string, data: any[]): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      console.log(`[MastersRepository] syncMasterData(${masterType}): No data`);
      return { count: 0 };
    }

    const table = MASTER_TABLE_MAP[masterType];
    const mapping = FIELD_MAPPINGS[masterType];

    if (!table || !mapping) {
      console.warn(`[MastersRepository] Unknown master type: ${masterType}`);
      return { count: 0 };
    }

    try {
      const db = getDb();
      const tableName = getTableName(table);

      console.log(`[MastersRepository] syncMasterData(${masterType}): tableName=${tableName}`);

      await db.execute(
        sql.raw(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`)
      );

      const insertData = data.map((item) => {
        const row: any = {};
        for (const [apiField, schemaField] of Object.entries(mapping)) {
          if (item[apiField] !== undefined && item[apiField] !== null) {
            let value = item[apiField];
            if (BOOLEAN_FIELDS.has(apiField)) {
              value = Boolean(value);
            } else if (TIMESTAMP_FIELDS.has(apiField)) {
              value = typeof value === 'string' ? new Date(value) : value;
            }
            row[schemaField] = value;
          }
        }
        return row;
      });

      console.log(`[MastersRepository] syncMasterData(${masterType}): inserting ${insertData.length} rows`);

      if (insertData.length > 0) {
        const BATCH_SIZE = 1000;
        let totalInserted = 0;

        for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
          const batch = insertData.slice(i, i + BATCH_SIZE);
          await db.insert(table).values(batch);
          totalInserted += batch.length;
          console.log(`[MastersRepository] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalInserted}/${insertData.length} rows`);
        }
        console.log(`[MastersRepository] Successfully inserted ${totalInserted} rows into ${masterType}`);
      }

      return { count: insertData.length };
    } catch (error) {
      console.error(`[MastersRepository] Error syncing ${masterType}:`, error);
      throw error;
    }
  }
}
