import { eq, and, desc, asc, sql, getTableName, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { admRoleMasterAc } from "../../../../shared/v2/admin/schema";
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
  dataMasters,
  type DataMaster,
  type InsertDataMaster,
  type InsertMasterDataEntry,
  type MasterDataEntry,
} from "../../../../shared/schema";
import {
  crewMembersV2,
  crewPersonalDetails,
} from "../../../../shared/v2/crew-pool/schema";

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
  roles: admRoleMasterAc,
};

type MasterSyncAudit = {
  count: number;
  inserted: number;
  updated: number;
  softDeleted: number;
  unchanged: number;
  removalSupported: boolean;
  note?: string;
};

type MasterSyncConfig = {
  table: any;
  keyField: string;
  supportsSoftDelete: boolean;
};

const MASTER_SYNC_CONFIG: Record<string, MasterSyncConfig> = {
  nationalities: {
    table: masterNationalities,
    keyField: 'natUuid',
    supportsSoftDelete: true,
  },
  vessels: {
    table: masterVessels,
    keyField: 'vesselUuid',
    supportsSoftDelete: true,
  },
  vesselTypes: {
    table: masterVesselTypes,
    keyField: 'vtUuid',
    supportsSoftDelete: true,
  },
  additionalGroups: {
    table: masterAdditionalGroups,
    keyField: 'agUuid',
    supportsSoftDelete: false,
  },
  ports: {
    table: masterPorts,
    keyField: 'portUuid',
    supportsSoftDelete: true,
  },
  fleetGroups: {
    table: masterFleetGroups,
    keyField: 'fgUuid',
    supportsSoftDelete: false,
  },
  languages: {
    table: masterLanguages,
    keyField: 'langUuid',
    supportsSoftDelete: true,
  },
  countries: {
    table: masterCountries,
    keyField: 'countryUuid',
    supportsSoftDelete: true,
  },
  users: {
    table: masterUsers,
    keyField: 'userUuid',
    supportsSoftDelete: false,
  },
  roles: {
    table: admRoleMasterAc,
    keyField: 'ruid',
    supportsSoftDelete: true,
  },
};

const FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  nationalities: {
    id: 'id',
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
    id: 'id',
    vuid: 'vesselUuid',
    vessel: 'vessel',
    imoNumber: 'imoNumber',
    flag: 'flag',
    vesselType: 'vesselType',
    yearBuilt: 'yearBuilt',
    deadWeightSummer: 'deadWeight',
    vesselOwner: 'vesselOwner',
    engineTypePower: 'engineTypePower',
    isActive: 'isActive',
    isDeleted: 'isDeleted',
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
    id: 'id',
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
    id: 'id',
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
    vesselIds: 'vesselIds',
  },
  roles: {
    id: 'id',
    ruid: 'ruid',
    role: 'assignedRole',
    roletype: 'roletype',
    isActive: 'isActive',
    isDeleted: 'isDeleted',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
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

function normalizeBusinessKey(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseBooleanField(value: unknown, masterType: string, field: string, rowNumber: number): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || (typeof value === 'string' && value.trim().toLowerCase() === 'true') || value === '1') {
    return true;
  }
  if (value === 0 || (typeof value === 'string' && value.trim().toLowerCase() === 'false') || value === '0') {
    return false;
  }
  throw new Error(
    `[MastersRepository] Invalid ${masterType} payload: ${field} must be a boolean at row ${rowNumber}`,
  );
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (left instanceof Date || right instanceof Date) {
    const leftTime = left instanceof Date ? left.getTime() : new Date(String(left)).getTime();
    const rightTime = right instanceof Date ? right.getTime() : new Date(String(right)).getTime();
    return leftTime === rightTime;
  }
  if (
    (typeof left === 'string' || typeof left === 'number') &&
    (typeof right === 'string' || typeof right === 'number')
  ) {
    return String(left).trim() === String(right).trim();
  }
  return false;
}

function hasChangedFields(existing: Record<string, any>, incoming: Record<string, any>): boolean {
  return Object.entries(incoming)
    .filter(([field]) => field !== 'id')
    .some(([field, value]) => !valuesEqual(existing[field], value));
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

  /**
   * Returns active, non-deleted vessels only.
   * Used by the standard /api/v2/masters/vessels endpoint consumed by most modules.
   * Consistent with findAllVesselTypes / findAllPorts / findAllLanguages etc.
   */
  async findAllVessels() {
    const db = getDb();
    return db
      .select()
      .from(masterVessels)
      .where(and(eq(masterVessels.isActive, true), eq(masterVessels.isDeleted, false)))
      .orderBy(sql`LOWER(${masterVessels.vessel})`);
  }

  /**
   * Returns every vessel regardless of is_active / is_deleted status.
   * Used by endpoints that must surface inactive/historical vessels
   * (e.g. Sea Service and crew import template dropdowns).
   * Do NOT add an active/deleted filter here — that is the whole point.
   */
  async findAllVesselsIncludingInactive() {
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

  async findDistinctDepartments(): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .selectDistinct({ department: masterUsers.department })
      .from(masterUsers)
      .where(sql`${masterUsers.department} IS NOT NULL AND btrim(${masterUsers.department}) <> ''`)
      .orderBy(asc(masterUsers.department));
    return rows
      .map((row: { department: string | null }) => row.department?.trim())
      .filter((department: string | undefined): department is string => !!department);
  }

  async findUserByUuid(userUuid: string) {
    const db = getDb();
    const results = await db
      .select()
      .from(masterUsers)
      .where(eq(masterUsers.userUuid, userUuid));
    return results[0];
  }

  /**
   * Resolves the vessel UUIDs a Ship user is permitted to access.
   *
   * Reads master_users.vessel_ids (comma-separated integer vessel IDs synced
   * from the parent system via Sync All), then looks up the corresponding
   * vessel_uuid values in master_vessels. Used by the auth middleware to
   * populate req.user.vessels before any controller runs.
   *
   * Returns [] when the user is not found, has no vessel_ids, or the IDs
   * resolve to no matching vessels. Any DB error propagates to the caller.
   */
  async findVesselUuidsByUserId(userId: number): Promise<string[]> {
    const db = getDb();

    const users = await db
      .select({ vesselIds: masterUsers.vesselIds })
      .from(masterUsers)
      .where(eq(masterUsers.id, userId));

    const raw = users[0]?.vesselIds;
    if (!raw || !raw.trim()) return [];

    const vesselIdInts = raw
      .split(',')
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => Number.isInteger(n) && !isNaN(n));

    if (vesselIdInts.length === 0) return [];

    const vessels = await db
      .select({ vesselUuid: masterVessels.vesselUuid })
      .from(masterVessels)
      .where(inArray(masterVessels.id, vesselIdInts));

    return vessels
      .map((v: { vesselUuid: string | null }) => v.vesselUuid)
      .filter((uuid: string | null): uuid is string => typeof uuid === 'string' && uuid.length > 0);
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

  async findManningAgentsWithActiveCrew() {
    const db = getDb();
    return db
      .selectDistinct({
        id: masterManningAgents.id,
        name: masterManningAgents.name,
        country: masterManningAgents.country,
        email: masterManningAgents.email,
        phone: masterManningAgents.phone,
        address: masterManningAgents.address,
        contactPerson: masterManningAgents.contactPerson,
        sortOrder: masterManningAgents.sortOrder,
        isActive: masterManningAgents.isActive,
        isDeleted: masterManningAgents.isDeleted,
        createdAt: masterManningAgents.createdAt,
        updatedAt: masterManningAgents.updatedAt,
      })
      .from(masterManningAgents)
      .innerJoin(
        crewPersonalDetails,
        sql`(
          lower(trim(${crewPersonalDetails.manningAgent})) = lower(trim(${masterManningAgents.name}))
          OR trim(${crewPersonalDetails.manningAgent}) = (${masterManningAgents.id})::text
        )`,
      )
      .innerJoin(
        crewMembersV2,
        eq(crewMembersV2.crewUuid, crewPersonalDetails.crewUuid),
      )
      .where(and(
        eq(masterManningAgents.isDeleted, false),
        eq(masterManningAgents.isActive, true),
        eq(crewPersonalDetails.isDeleted, false),
        eq(crewMembersV2.isDeleted, false),
        eq(crewMembersV2.isActive, true),
        sql`${crewMembersV2.archivedAt} IS NULL`,
        sql`lower(trim(coalesce(${crewMembersV2.status}, ''))) NOT IN (
          'inactive',
          'terminated',
          'terminated - nfr',
          'terminated employment',
          'terminated employment - nfr'
        )`,
      ))
      .orderBy(asc(masterManningAgents.sortOrder), asc(masterManningAgents.name));
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

  private columnCacheByDb = new Map<string, Map<string, Set<string>>>();

  private getColumnCacheKey(): string {
    try {
      const { tenantConnectionManager } = require("../../../utils/tenantConnectionManager");
      return tenantConnectionManager.getCurrentTenantId() || '__default__';
    } catch {
      return '__default__';
    }
  }

  private async getExistingColumns(tableName: string): Promise<Set<string>> {
    const tenantKey = this.getColumnCacheKey();
    if (!this.columnCacheByDb.has(tenantKey)) {
      this.columnCacheByDb.set(tenantKey, new Map());
    }
    const tenantCache = this.columnCacheByDb.get(tenantKey)!;

    if (tenantCache.has(tableName)) {
      return tenantCache.get(tableName)!;
    }
    try {
      const db = getDb();
      const result = await db.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName}`
      );
      const rows = (result as any).rows || result;
      const columns = new Set<string>(rows.map((row: any) => row.column_name as string));
      tenantCache.set(tableName, columns);
      return columns;
    } catch (error) {
      console.error(`Failed to get columns for ${tableName}:`, error);
      return new Set<string>();
    }
  }

  private async filterPayloadByExistingColumns<T extends Record<string, any>>(
    payload: T,
    tableName: string
  ): Promise<Record<string, any>> {
    const existingColumns = await this.getExistingColumns(tableName);
    const filtered: Record<string, any> = {};

    const fieldMapping: Record<string, string> = {
      masterId: 'master_id',
      entryId: 'entry_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    for (const [key, value] of Object.entries(payload)) {
      const dbColumnName = fieldMapping[key] || key;
      if (existingColumns.has(dbColumnName)) {
        filtered[dbColumnName] = value;
      }
    }

    return filtered;
  }

  private ensureNameFieldForVesselMaster(insertEntry: InsertMasterDataEntry): InsertMasterDataEntry {
    if (insertEntry.masterId === '014' && !insertEntry.name) {
      const derivedName = (insertEntry as any).vessel ||
                         (insertEntry as any).imoNumber ||
                         insertEntry.entryId ||
                         'Unnamed Vessel';
      return { ...insertEntry, name: derivedName };
    }
    return insertEntry;
  }

  async getDataMasters(): Promise<DataMaster[]> {
    const db = getDb();
    return await db.select().from(dataMasters);
  }

  async getDataMaster(id: string): Promise<DataMaster | undefined> {
    const db = getDb();
    const results = await db.select().from(dataMasters).where(eq(dataMasters.id, id));
    return results[0] || undefined;
  }

  async createDataMaster(insertMaster: InsertDataMaster): Promise<DataMaster> {
    const db = getDb();
    const [created] = await db
      .insert(dataMasters)
      .values(insertMaster)
      .returning();
    return created;
  }

  async updateDataMaster(id: string, masterData: Partial<InsertDataMaster>): Promise<DataMaster | undefined> {
    const db = getDb();
    const [updated] = await db
      .update(dataMasters)
      .set({ ...masterData, updatedAt: new Date() })
      .where(eq(dataMasters.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDataMaster(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(dataMasters).where(eq(dataMasters.id, id));
    return (result as any).rowCount !== null && (result as any).rowCount > 0;
  }

  async getMasterDataEntries(masterId: string): Promise<MasterDataEntry[]> {
    const db = getDb();
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).map(col => `"${col}"`).join(', ');
    const hasOrderBy = existingColumns.has('orderBy');
    const orderClause = hasOrderBy ? '"orderBy" NULLS LAST, "entry_id"' : '"entry_id"';

    const result: any = await db.execute(
      sql`SELECT ${sql.raw(selectColumns)} FROM master_data_entries WHERE "master_id" = ${masterId} ORDER BY ${sql.raw(orderClause)}`
    );
    return (result as any).rows || result || [];
  }

  async getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined> {
    const db = getDb();
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).map(col => `"${col}"`).join(', ');

    const result: any = await db.execute(
      sql`SELECT ${sql.raw(selectColumns)} FROM master_data_entries WHERE "id" = ${id}`
    );
    const rows = (result as any).rows || result;
    return rows?.[0] || undefined;
  }

  private buildParameterizedInsert(
    tableName: string,
    payload: Record<string, any>
  ): ReturnType<typeof sql> {
    const keys = Object.keys(payload);
    const columnsPart = keys.map(col => `"${col}"`).join(', ');

    const chunks: any[] = [sql.raw(`INSERT INTO ${tableName} (${columnsPart}, "created_at", "updated_at") VALUES (`)];
    keys.forEach((key, i) => {
      if (i > 0) chunks.push(sql.raw(', '));
      const val = payload[key] === undefined ? null : payload[key];
      chunks.push(sql`${val}`);
    });
    chunks.push(sql.raw(`, NOW(), NOW()) RETURNING *`));

    return sql.join(chunks, sql.raw(''));
  }

  private buildParameterizedUpdate(
    tableName: string,
    payload: Record<string, any>,
    id: number
  ): ReturnType<typeof sql> {
    const keys = Object.keys(payload);
    const chunks: any[] = [sql.raw(`UPDATE ${tableName} SET `)];
    keys.forEach((key, i) => {
      if (i > 0) chunks.push(sql.raw(', '));
      const val = payload[key] === undefined ? null : payload[key];
      chunks.push(sql`${sql.raw(`"${key}"`)} = ${val}`);
    });
    chunks.push(sql` WHERE "id" = ${id}`);
    return sql.join(chunks, sql.raw(''));
  }

  async createMasterDataEntry(insertEntry: InsertMasterDataEntry): Promise<MasterDataEntry> {
    const db = getDb();
    const entryWithName = this.ensureNameFieldForVesselMaster(insertEntry);
    const filteredEntry = await this.filterPayloadByExistingColumns(entryWithName, 'master_data_entries');

    const { created_at, updated_at, ...payloadWithoutTimestamps } = filteredEntry as any;

    const query = this.buildParameterizedInsert('master_data_entries', payloadWithoutTimestamps);
    const result: any = await db.execute(query);

    const rows = (result as any).rows || result;
    if (rows && rows.length > 0) {
      return rows[0];
    }

    const fallbackResult: any = await db.execute(
      sql`SELECT * FROM master_data_entries WHERE "master_id" = ${entryWithName.masterId} ORDER BY "id" DESC LIMIT 1`
    );
    const fallbackRows = (fallbackResult as any).rows || fallbackResult;
    return fallbackRows[0];
  }

  async updateMasterDataEntry(id: number, entryData: Partial<InsertMasterDataEntry>): Promise<MasterDataEntry | undefined> {
    const db = getDb();
    const filteredEntry = await this.filterPayloadByExistingColumns(entryData, 'master_data_entries');
    filteredEntry.updated_at = new Date();

    const query = this.buildParameterizedUpdate('master_data_entries', filteredEntry, id);
    const result: any = await db.execute(query);

    const rowCount = (result as any).rowCount ?? ((result as any).rows || result)?.length;
    if (rowCount === 0) {
      return undefined;
    }

    return this.getMasterDataEntry(id);
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    const existing = await this.getMasterDataEntry(id);
    if (!existing) return false;

    const db = getDb();
    await db.execute(sql`DELETE FROM master_data_entries WHERE "id" = ${id}`);
    return true;
  }

  async syncMasterData(masterType: string, data: any[]): Promise<MasterSyncAudit> {
    const config = MASTER_SYNC_CONFIG[masterType];
    const removalSupported = config?.supportsSoftDelete ?? false;
    const removalNote = removalSupported
      ? undefined
      : `Removal not supported for ${masterType}; rows absent from the payload are left untouched.`;

    if (!data || data.length === 0) {
      console.log(`[MastersRepository] syncMasterData(${masterType}): No data`);
      return {
        count: 0,
        inserted: 0,
        updated: 0,
        softDeleted: 0,
        unchanged: 0,
        removalSupported,
        ...(removalNote ? { note: removalNote } : {}),
      };
    }

    const table = config?.table || MASTER_TABLE_MAP[masterType];
    const mapping = FIELD_MAPPINGS[masterType];

    if (!config || !table || !mapping) {
      console.warn(`[MastersRepository] Unknown master type: ${masterType}`);
      return {
        count: 0,
        inserted: 0,
        updated: 0,
        softDeleted: 0,
        unchanged: 0,
        removalSupported: false,
      };
    }

    try {
      const db = getDb();
      const tableName = getTableName(table);

      console.log(
        `[MastersRepository] syncMasterData(${masterType}): ` +
        `tableName=${tableName} businessKey=${config.keyField}`,
      );

      const insertData = data.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new Error(`[MastersRepository] Invalid ${masterType} payload: every row must be an object`);
        }
        const row: any = {};
        for (const [apiField, schemaField] of Object.entries(mapping)) {
          if (item[apiField] !== undefined && item[apiField] !== null) {
            let value = item[apiField];
            if (BOOLEAN_FIELDS.has(apiField)) {
              value = parseBooleanField(value, masterType, apiField, index + 1);
            } else if (TIMESTAMP_FIELDS.has(apiField)) {
              value = typeof value === 'string' ? new Date(value) : value;
            }
            row[schemaField] = value;
          }
        }
        if (config.supportsSoftDelete && !Object.prototype.hasOwnProperty.call(row, 'isDeleted')) {
          row.isDeleted = false;
        }
        return row;
      });

      if (insertData.length === 0) {
        console.log(`[MastersRepository] syncMasterData(${masterType}): No valid data to insert`);
        return {
          count: 0,
          inserted: 0,
          updated: 0,
          softDeleted: 0,
          unchanged: 0,
          removalSupported: config.supportsSoftDelete,
          ...(removalNote ? { note: removalNote } : {}),
        };
      }

      const payloadKeys = insertData.map((row) => normalizeBusinessKey(row[config.keyField]));
      const emptyKeyIndex = payloadKeys.findIndex((key) => key.length === 0);
      if (emptyKeyIndex !== -1) {
        throw new Error(
          `[MastersRepository] Invalid ${masterType} payload: ${config.keyField} is required for every row (row ${emptyKeyIndex + 1})`,
        );
      }
      if (new Set(payloadKeys).size !== payloadKeys.length) {
        throw new Error(`[MastersRepository] Invalid ${masterType} payload: duplicate ${config.keyField} values`);
      }

      const audit = await db.transaction(async (tx: any): Promise<MasterSyncAudit> => {
        await tx.execute(sql.raw(`LOCK TABLE ${tableName} IN SHARE ROW EXCLUSIVE MODE`));
        const existingRows = await tx.select().from(table);
        const existingByKey = new Map<string, Record<string, any>[]>();
        for (const existingRow of existingRows as Record<string, any>[]) {
          const key = normalizeBusinessKey(existingRow[config.keyField]);
          const matches = existingByKey.get(key) || [];
          matches.push(existingRow);
          existingByKey.set(key, matches);
        }

        const result: MasterSyncAudit = {
          count: insertData.length,
          inserted: 0,
          updated: 0,
          softDeleted: 0,
          unchanged: 0,
          removalSupported: config.supportsSoftDelete,
          ...(removalNote ? { note: removalNote } : {}),
        };

        for (const incomingRow of insertData as Record<string, any>[]) {
          const key = normalizeBusinessKey(incomingRow[config.keyField]);
          const matches = existingByKey.get(key) || [];

          if (matches.length === 0) {
            await tx.insert(table).values(incomingRow);
            result.inserted++;
            continue;
          }

          const updateRow = { ...incomingRow };
          delete updateRow.id;
          for (const existingRow of matches) {
            if (hasChangedFields(existingRow, incomingRow)) {
              await tx
                .update(table)
                .set(updateRow)
                .where(eq(table.id, existingRow.id));
              result.updated++;
            } else {
              result.unchanged++;
            }
          }
        }

        const incomingKeySet = new Set(payloadKeys);
        for (const existingRow of existingRows as Record<string, any>[]) {
          const key = normalizeBusinessKey(existingRow[config.keyField]);
          if (incomingKeySet.has(key)) {
            continue;
          }

          if (config.supportsSoftDelete && existingRow.isDeleted !== true) {
            await tx
              .update(table)
              .set({ isDeleted: true })
              .where(eq(table.id, existingRow.id));
            result.softDeleted++;
          } else {
            result.unchanged++;
          }
        }

        // Parent-supplied numeric IDs are preserved for new rows. Keep the
        // sequence above the highest explicit ID for future local inserts.
        if (Object.values(mapping).includes('id')) {
          await tx.execute(
            sql.raw(
              `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1))`,
            ),
          );
        }

        return result;
      });

      console.log(
        `[MastersRepository] syncMasterData(${masterType}): ` +
        `inserted=${audit.inserted} updated=${audit.updated} ` +
        `soft_deleted=${audit.softDeleted} unchanged=${audit.unchanged}` +
        (audit.note ? ` note="${audit.note}"` : ''),
      );
      return audit;
    } catch (error) {
      console.error(`[MastersRepository] Error syncing ${masterType}:`, error);
      throw error;
    }
  }
}
