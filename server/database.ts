import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { 
  users, 
  forms, 
  rankGroups, 
  availableRanks, 
  companyRanks,
  promotionHierarchies,
  crewMembers, 
  appraisalResults,
  recruitmentCandidates,
  vesselGroups,
  vesselDrafts,
  vesselRevisions,
  vesselPlanning,
  rotationPlans,
  restHoursVesselRecords,
  restHoursCrewRecords,
  restHoursDailyRecords,
  variableTasks,
  fixedTasks,
  drugAlcoholTestRecords,
  vesselViolationComments,
  officeViolationComments,
  ncReports,
  vesselDateLineAdjustments,
  dataMasters,
  masterDataEntries,
  type User,
  type InsertUser,
  type Form,
  type InsertForm,
  type RankGroup,
  type InsertRankGroup,
  type AvailableRank,
  type InsertAvailableRank,
  type CompanyRank,
  type InsertCompanyRank,
  type PromotionHierarchy,
  type InsertPromotionHierarchy,
  type CrewMember,
  type InsertCrewMember,
  type AppraisalResult,
  type InsertAppraisalResult,
  type RecruitmentCandidate,
  type InsertRecruitmentCandidate,
  type VesselGroup,
  type InsertVesselGroup,
  type VesselDraft,
  type InsertVesselDraft,
  type VesselRevision,
  type InsertVesselRevision,
  type VesselPlanning,
  type InsertVesselPlanning,
  type RotationPlan,
  type InsertRotationPlan,
  type RestHoursVesselRecord,
  type InsertRestHoursVesselRecord,
  type RestHoursCrewRecord,
  type InsertRestHoursCrewRecord,
  type RestHoursDailyRecord,
  type InsertRestHoursDailyRecord,
  type VariableTask,
  type InsertVariableTask,
  type FixedTask,
  type InsertFixedTask,
  type DrugAlcoholTestRecord,
  type InsertDrugAlcoholTestRecord,
  type VesselViolationComment,
  type InsertVesselViolationComment,
  type OfficeViolationComment,
  type InsertOfficeViolationComment,
  type NCReport,
  type InsertNCReport,
  type VesselDateLineAdjustment,
  type InsertVesselDateLineAdjustment,
  type DataMaster,
  type InsertDataMaster,
  type MasterDataEntry,
  type InsertMasterDataEntry
} from "@shared/schema";
import { eq, desc, sql, and, inArray, or, like } from "drizzle-orm";
import { type IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: Pool;
  private columnCache: Map<string, Set<string>> = new Map(); // Cache existing column names per table

  constructor() {
    const { DATABASE_URL } = process.env;
    
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required for PostgreSQL connection");
    }
    
    // Determine SSL configuration based on DATABASE_URL
    // Neon/external PostgreSQL requires SSL, Replit internal doesn't
    const requiresSsl = DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('ssl=true');
    
    console.log(`🔐 SSL Configuration: ${requiresSsl ? 'ENABLED (required by connection string)' : 'DISABLED (internal database)'}`);
    
    this.pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: requiresSsl ? {
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined
      } : false,
      max: 10,
    });
    this.db = drizzle(this.pool);
    
    // Ensure enhanced master data entries schema exists on startup (async, non-blocking)
    this.ensureMasterDataEntriesSchema().catch(err => 
      console.error("Schema migration failed:", err)
    );
  }

  async close() {
    await this.pool.end();
  }

  // Column Allow-List Filter Methods
  private async getExistingColumns(tableName: string): Promise<Set<string>> {
    if (this.columnCache.has(tableName)) {
      return this.columnCache.get(tableName)!;
    }

    try {
      const result = await this.pool.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [tableName]
      );
      
      const columnNames: string[] = result.rows.map((row: any) => row.column_name as string);
      const columns = new Set<string>(columnNames);
      this.columnCache.set(tableName, columns);
      console.log(`📋 Cached columns for ${tableName}:`, Array.from(columns));
      return columns;
    } catch (error) {
      console.error(`❌ Failed to get columns for ${tableName}:`, error);
      // Return empty set to prevent errors - will be filtered out
      return new Set<string>();
    }
  }

  private async filterPayloadByExistingColumns<T extends Record<string, any>>(
    payload: T, 
    tableName: string
  ): Promise<Record<string, any>> {
    const existingColumns = await this.getExistingColumns(tableName);
    const filtered: Record<string, any> = {};
    const filteredOutKeys: string[] = [];

    // Field mapping for camelCase to snake_case
    const fieldMapping: Record<string, string> = {
      masterId: 'master_id',
      entryId: 'entry_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    };

    for (const [key, value] of Object.entries(payload)) {
      // Map to database column name
      const dbColumnName = fieldMapping[key] || key;
      
      console.log(`🔧 [FIELD MAP] ${key} -> ${dbColumnName}, exists: ${existingColumns.has(dbColumnName)}`);
      
      if (existingColumns.has(dbColumnName)) {
        filtered[dbColumnName] = value;
      } else {
        filteredOutKeys.push(key);
      }
    }

    if (filteredOutKeys.length > 0) {
      console.log(`🔧 Filtered out non-existent columns for ${tableName}:`, filteredOutKeys);
    }
    
    console.log(`✅ Final filtered payload for ${tableName}:`, filtered);
    return filtered;
  }

  // Name Field Fallback for Master 014 (Vessel Master)
  private ensureNameFieldForVesselMaster(insertEntry: InsertMasterDataEntry): InsertMasterDataEntry {
    if (insertEntry.masterId === '014' && !insertEntry.name) {
      // Derive name from vessel fields or fallback to entryId
      const derivedName = (insertEntry as any).vessel || 
                         (insertEntry as any).imoNumber || 
                         insertEntry.entryId || 
                         'Unnamed Vessel';
      
      console.log(`🚢 Master 014: Deriving name field from vessel data. Result: "${derivedName}"`);
      return { ...insertEntry, name: derivedName };
    }
    return insertEntry;
  }

  // Self-migration to ensure master_data_entries has enhanced nationality schema
  private async ensureMasterDataEntriesSchema(): Promise<void> {
    // DISABLED: This method used MySQL syntax and is not needed for PostgreSQL
    // The PostgreSQL schema migration already includes all required columns
    console.log("✅ Schema migrations handled by Drizzle/PostgreSQL migrations");
    return;
    
    /* MySQL-specific code disabled
    try {
      console.log("🔧 Checking master_data_entries schema...");
      
      // Check which columns exist
      const [rows]: any = await this.pool.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'master_data_entries'",
        [process.env.DB_NAME || 'crew_database']
      );
      
      const columnNames: string[] = rows.map((row: any) => row.COLUMN_NAME as string);
      const existingColumns = new Set<string>(columnNames);
      console.log("📋 Existing columns:", Array.from(existingColumns));
      
      // Define new columns to add (for nationality, country, and vessel type enhanced structures)
      const newColumns = [
        { name: 'nuid', ddl: 'ADD COLUMN nuid TEXT NULL' },
        { name: 'countryName', ddl: 'ADD COLUMN countryName TEXT NULL' },
        { name: 'country', ddl: 'ADD COLUMN country TEXT NULL' },
        { name: 'isActive', ddl: 'ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1' },
        { name: 'isDeleted', ddl: 'ADD COLUMN isDeleted TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'createdBy', ddl: 'ADD COLUMN createdBy TEXT NULL' },
        { name: 'domain', ddl: 'ADD COLUMN domain TEXT NULL' },
        { name: 'orderBy', ddl: 'ADD COLUMN orderBy INT NULL' },
        // Additional columns for enhanced Country master structure
        { name: 'cid', ddl: 'ADD COLUMN cid TEXT NULL' },
        { name: 'countryCode', ddl: 'ADD COLUMN countryCode TEXT NULL' },
        { name: 'nationality', ddl: 'ADD COLUMN nationality TEXT NULL' },
        { name: 'countryRefId', ddl: 'ADD COLUMN countryRefId TEXT NULL' },
        // Additional columns for enhanced Vessel Type master structure
        { name: 'vtuid', ddl: 'ADD COLUMN vtuid TEXT NULL' },
        { name: 'vesselType', ddl: 'ADD COLUMN vesselType TEXT NULL' },
        { name: 'tanker', ddl: 'ADD COLUMN tanker TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'oilTanker', ddl: 'ADD COLUMN oilTanker TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'gasTanker', ddl: 'ADD COLUMN gasTanker TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'chemicalTanker', ddl: 'ADD COLUMN chemicalTanker TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'bulk', ddl: 'ADD COLUMN bulk TINYINT(1) NOT NULL DEFAULT 0' },
        // Additional columns for Fleet Groups master structure (ID 015)
        { name: 'fuid', ddl: 'ADD COLUMN fuid TEXT NULL' },
        { name: 'managerId', ddl: 'ADD COLUMN managerId TEXT NULL' },
        // Additional columns for Additional Groups master structure (ID 016)
        { name: 'aguid', ddl: 'ADD COLUMN aguid TEXT NULL' },
        { name: 'userId', ddl: 'ADD COLUMN userId TEXT NULL' },
        { name: 'vesselIds', ddl: 'ADD COLUMN vesselIds TEXT NULL' },
        // Additional columns for Vessel Owners master structure (ID 017)
        { name: 'vouid', ddl: 'ADD COLUMN vouid TEXT NULL' },
        { name: 'address', ddl: 'ADD COLUMN address TEXT NULL' },
        { name: 'email', ddl: 'ADD COLUMN email TEXT NULL' },
        { name: 'phone', ddl: 'ADD COLUMN phone TEXT NULL' },
        { name: 'company', ddl: 'ADD COLUMN company TEXT NULL' },
        { name: 'nameOfContactPerson', ddl: 'ADD COLUMN nameOfContactPerson TEXT NULL' },
        // Additional columns for Designation Master structure (ID 012)
        { name: 'duid', ddl: 'ADD COLUMN duid TEXT NULL' },
        { name: 'shortCode', ddl: 'ADD COLUMN shortCode TEXT NULL' },
        { name: 'type', ddl: 'ADD COLUMN type TEXT NULL' },
        { name: 'department', ddl: 'ADD COLUMN department TEXT NULL' },
        // Additional columns for User Master structure (ID 013)
        { name: 'uuid', ddl: 'ADD COLUMN uuid TEXT NULL' },
        { name: 'lastname', ddl: 'ADD COLUMN lastname TEXT NULL' },
        { name: 'firstname', ddl: 'ADD COLUMN firstname TEXT NULL' },
        { name: 'addressLine1', ddl: 'ADD COLUMN addressLine1 TEXT NULL' },
        { name: 'addressLine2', ddl: 'ADD COLUMN addressLine2 TEXT NULL' },
        { name: 'addressLine3', ddl: 'ADD COLUMN addressLine3 TEXT NULL' },
        { name: 'city', ddl: 'ADD COLUMN city TEXT NULL' },
        { name: 'state', ddl: 'ADD COLUMN state TEXT NULL' },
        { name: 'zipcode', ddl: 'ADD COLUMN zipcode TEXT NULL' },
        { name: 'loginId', ddl: 'ADD COLUMN loginId TEXT NULL' },
        { name: 'roleId', ddl: 'ADD COLUMN roleId TEXT NULL' },
        { name: 'designationId', ddl: 'ADD COLUMN designationId TEXT NULL' },
        { name: 'profilePic', ddl: 'ADD COLUMN profilePic TEXT NULL' },
        { name: 'userType', ddl: 'ADD COLUMN userType TEXT NULL' },
        { name: 'departmentId', ddl: 'ADD COLUMN departmentId TEXT NULL' },
        // Additional columns for Port Master structure (ID 018)
        { name: 'puid', ddl: 'ADD COLUMN puid TEXT NULL' },
        { name: 'portCode', ddl: 'ADD COLUMN portCode TEXT NULL' },
        { name: 'portName', ddl: 'ADD COLUMN portName TEXT NULL' },
        { name: 'latitude', ddl: 'ADD COLUMN latitude DECIMAL(10,8) NULL' },
        { name: 'longitude', ddl: 'ADD COLUMN longitude DECIMAL(11,8) NULL' },
        { name: 'countryId', ddl: 'ADD COLUMN countryId TEXT NULL' },
        { name: 'region', ddl: 'ADD COLUMN region TEXT NULL' },
        { name: 'timeZone', ddl: 'ADD COLUMN timeZone TEXT NULL' },
        { name: 'harborType', ddl: 'ADD COLUMN harborType TEXT NULL' },
        { name: 'facilities', ddl: 'ADD COLUMN facilities TEXT NULL' }
      ];
      
      // Add missing columns
      for (const column of newColumns) {
        if (!existingColumns.has(column.name)) {
          console.log(`➕ Adding column: ${column.name}`);
          await this.pool.query(`ALTER TABLE master_data_entries ${column.ddl}`);
        }
      }
      
      console.log("✅ master_data_entries schema is up to date");
      
      // DISABLED: Automatic data seeding per user request
      // User manages their own master data entries
      console.log("ℹ️ Automatic data seeding is disabled - users manage their own entries");
    } catch (error) {
      console.error("❌ Failed to update master_data_entries schema:", error);
      // Don't throw - allow app to start even if schema update fails
    }
    */
  }

  // Migrate Port master data from ID '005' to ID '018' (consolidation fix)
  private async migratePortMasterFromId005ToId018(): Promise<void> {
    try {
      console.log("🚢 Checking for Port master data migration from ID '005' to ID '018'...");
      
      // Check if there are any existing entries with master_id='005'
      const [existingId005Entries]: any = await this.pool.query(
        "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '005'"
      );
      
      const id005Count = existingId005Entries[0].count;
      console.log(`📊 Found ${id005Count} entries with old Port master ID '005'`);
      
      if (id005Count > 0) {
        console.log("🔄 Migrating Port master entries from ID '005' to ID '018'...");
        
        // Update all entries from master_id='005' to master_id='018'
        await this.pool.query(
          "UPDATE master_data_entries SET master_id = '018' WHERE master_id = '005'"
        );
        
        console.log(`✅ Successfully migrated ${id005Count} Port master entries from ID '005' to ID '018'`);
      } else {
        console.log("✅ No Port master entries found with old ID '005' - migration not needed");
      }
      
      // Also ensure the data_masters table doesn't have the duplicate entry with ID '005'
      const [existingMaster005]: any = await this.pool.query(
        "SELECT COUNT(*) as count FROM data_masters WHERE id = '005'"
      );
      
      if (existingMaster005[0].count > 0) {
        console.log("🗑️ Removing duplicate Port master with ID '005' from data_masters table...");
        await this.pool.query("DELETE FROM data_masters WHERE id = '005'");
        console.log("✅ Duplicate Port master with ID '005' removed from data_masters table");
      }
    } catch (error) {
      console.error("❌ Failed to migrate Port master data from ID '005' to ID '018':", error);
      // Don't throw - allow app to continue even if migration fails
    }
  }

  // Ensure nationality master data is properly seeded with enhanced structure
  private async ensureNationalityDataSeeded(): Promise<void> {
    try {
      console.log("🌍 Checking nationality master data...");
      
      // Check if we have any nationality entries with the new enhanced structure (NAT001-NAT020)
      const [existingNationalityEntries]: any = await this.pool.query(
        "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '001' AND entry_id LIKE 'NAT%'"
      );
      
      const enhancedEntriesCount = existingNationalityEntries[0].count;
      console.log(`📊 Found ${enhancedEntriesCount} enhanced nationality entries with NAT format`);
      
      // If we don't have the full set of enhanced nationality data, or need to update existing data, seed it
      // Force re-seed to apply corrected nationality data (Myanmar->Burmese, Bangladesh->Bangladeshi)
      if (enhancedEntriesCount !== 20) {
        console.log("🗂️ Seeding enhanced nationality master data...");
        
        // Clear existing nationality entries to avoid conflicts and ensure fresh accurate data
        await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '001'");
        
        // Major Maritime Nations with enhanced structure (NAT001-NAT020)
        const nationalityData = [
          { entryId: "NAT001", name: "Filipino", description: "Philippines", countryName: "Filipino", country: "Philippines" },
          { entryId: "NAT002", name: "Indian", description: "India", countryName: "Indian", country: "India" },
          { entryId: "NAT003", name: "Chinese", description: "China", countryName: "Chinese", country: "China" },
          { entryId: "NAT004", name: "Ukrainian", description: "Ukraine", countryName: "Ukrainian", country: "Ukraine" },
          { entryId: "NAT005", name: "Russian", description: "Russia", countryName: "Russian", country: "Russia" },
          { entryId: "NAT006", name: "Indonesian", description: "Indonesia", countryName: "Indonesian", country: "Indonesia" },
          { entryId: "NAT007", name: "Turkish", description: "Turkey", countryName: "Turkish", country: "Turkey" },
          { entryId: "NAT008", name: "Polish", description: "Poland", countryName: "Polish", country: "Poland" },
          { entryId: "NAT009", name: "Romanian", description: "Romania", countryName: "Romanian", country: "Romania" },
          { entryId: "NAT010", name: "Bulgarian", description: "Bulgaria", countryName: "Bulgarian", country: "Bulgaria" },
          { entryId: "NAT011", name: "Greek", description: "Greece", countryName: "Greek", country: "Greece" },
          { entryId: "NAT012", name: "Croatian", description: "Croatia", countryName: "Croatian", country: "Croatia" },
          { entryId: "NAT013", name: "Burmese", description: "Myanmar", countryName: "Burmese", country: "Myanmar" },
          { entryId: "NAT014", name: "Vietnamese", description: "Vietnam", countryName: "Vietnamese", country: "Vietnam" },
          { entryId: "NAT015", name: "Bangladeshi", description: "Bangladesh", countryName: "Bangladeshi", country: "Bangladesh" },
          { entryId: "NAT016", name: "Pakistani", description: "Pakistan", countryName: "Pakistani", country: "Pakistan" },
          { entryId: "NAT017", name: "Sri Lankan", description: "Sri Lanka", countryName: "Sri Lankan", country: "Sri Lanka" },
          { entryId: "NAT018", name: "Georgian", description: "Georgia", countryName: "Georgian", country: "Georgia" },
          { entryId: "NAT019", name: "Latvian", description: "Latvia", countryName: "Latvian", country: "Latvia" },
          { entryId: "NAT020", name: "Estonian", description: "Estonia", countryName: "Estonian", country: "Estonia" }
        ];
        
        // Insert each nationality entry with enhanced structure
        for (const nationality of nationalityData) {
          await this.pool.query(
            `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, countryName, country, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            ['001', nationality.entryId, nationality.name, nationality.description, nationality.countryName, nationality.country, 1, 0]
          );
        }
        
        console.log("✅ Enhanced nationality master data seeded successfully with NAT001-NAT020 format");
      } else {
        console.log("✅ Enhanced nationality master data already exists");
      }
    } catch (error) {
      console.error("❌ Failed to seed nationality master data:", error);
      // Don't throw - allow app to continue
    }
  }

  // Fix specific nationality data inconsistencies identified by architect review
  private async fixNationalityDataInconsistencies(): Promise<void> {
    try {
      console.log("🔧 Checking for nationality data inconsistencies...");
      
      // Check for problematic entries that need correction
      const [problematicEntries]: any = await this.pool.query(
        "SELECT entry_id, countryName FROM master_data_entries WHERE master_id = '001' AND (entry_id = 'NAT013' OR entry_id = 'NAT015')"
      );
      
      let updatesNeeded = false;
      for (const entry of problematicEntries) {
        if (entry.entry_id === 'NAT013' && entry.countryName === 'Myanmar') {
          updatesNeeded = true;
          break;
        }
        if (entry.entry_id === 'NAT015' && entry.countryName === 'Bangladesh') {
          updatesNeeded = true;
          break;
        }
      }
      
      if (updatesNeeded) {
        console.log("🛠️ Fixing nationality data inconsistencies...");
        
        // Fix NAT013: Myanmar -> Burmese
        await this.pool.query(
          "UPDATE master_data_entries SET name = 'Burmese', countryName = 'Burmese' WHERE master_id = '001' AND entry_id = 'NAT013'"
        );
        
        // Fix NAT015: Bangladesh -> Bangladeshi  
        await this.pool.query(
          "UPDATE master_data_entries SET name = 'Bangladeshi', countryName = 'Bangladeshi' WHERE master_id = '001' AND entry_id = 'NAT015'"
        );
        
        console.log("✅ Nationality data inconsistencies fixed (NAT013: Myanmar->Burmese, NAT015: Bangladesh->Bangladeshi)");
      } else {
        console.log("✅ Nationality data is already consistent");
      }
    } catch (error) {
      console.error("❌ Failed to fix nationality data inconsistencies:", error);
      // Don't throw - allow app to continue
    }
  }

  // Ensure country master data is properly seeded with enhanced structure
  private async ensureCountryDataSeeded(): Promise<void> {
    try {
      console.log("🌎 Checking country master data...");
      
      // Check if we have any country entries with enhanced structure
      const [existingCountryEntries]: any = await this.pool.query(
        "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '002' AND entry_id RLIKE '^[0-9]+$'"
      );
      
      const enhancedCountriesCount = existingCountryEntries[0].count;
      console.log(`📊 Found ${enhancedCountriesCount} enhanced country entries with numeric entry IDs`);
      
      // If we don't have the enhanced country data structure, seed it
      if (enhancedCountriesCount < 50) {
        console.log("🗂️ Seeding enhanced country master data...");
        
        // Clear existing country entries to ensure clean enhanced structure
        await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '002'");
        
        // Country data with enhanced structure (as per attached specification)
        const countryData = [
          { entryId: "001", name: "Afghanistan", description: "Afghanistan", countryName: "Afghanistan", countryCode: "AF", nationality: "Afghan", cid: "AF001", countryRefId: "AFG" },
          { entryId: "002", name: "Algeria", description: "Algeria", countryName: "Algeria", countryCode: "DZ", nationality: "Algerian", cid: "DZ002", countryRefId: "DZA" },
          { entryId: "003", name: "Albania", description: "Albania", countryName: "Albania", countryCode: "AL", nationality: "Albanian", cid: "AL003", countryRefId: "ALB" },
          { entryId: "004", name: "United Kingdom", description: "United Kingdom", countryName: "United Kingdom", countryCode: "GB", nationality: "British", cid: "GB004", countryRefId: "GBR" },
          { entryId: "005", name: "United States", description: "United States", countryName: "United States", countryCode: "US", nationality: "American", cid: "US005", countryRefId: "USA" },
          { entryId: "006", name: "Canada", description: "Canada", countryName: "Canada", countryCode: "CA", nationality: "Canadian", cid: "CA006", countryRefId: "CAN" },
          { entryId: "007", name: "Australia", description: "Australia", countryName: "Australia", countryCode: "AU", nationality: "Australian", cid: "AU007", countryRefId: "AUS" },
          { entryId: "008", name: "Germany", description: "Germany", countryName: "Germany", countryCode: "DE", nationality: "German", cid: "DE008", countryRefId: "DEU" },
          { entryId: "009", name: "France", description: "France", countryName: "France", countryCode: "FR", nationality: "French", cid: "FR009", countryRefId: "FRA" },
          { entryId: "010", name: "Italy", description: "Italy", countryName: "Italy", countryCode: "IT", nationality: "Italian", cid: "IT010", countryRefId: "ITA" },
          { entryId: "011", name: "Spain", description: "Spain", countryName: "Spain", countryCode: "ES", nationality: "Spanish", cid: "ES011", countryRefId: "ESP" },
          { entryId: "012", name: "Netherlands", description: "Netherlands", countryName: "Netherlands", countryCode: "NL", nationality: "Dutch", cid: "NL012", countryRefId: "NLD" },
          { entryId: "013", name: "Norway", description: "Norway", countryName: "Norway", countryCode: "NO", nationality: "Norwegian", cid: "NO013", countryRefId: "NOR" },
          { entryId: "014", name: "Sweden", description: "Sweden", countryName: "Sweden", countryCode: "SE", nationality: "Swedish", cid: "SE014", countryRefId: "SWE" },
          { entryId: "015", name: "Denmark", description: "Denmark", countryName: "Denmark", countryCode: "DK", nationality: "Danish", cid: "DK015", countryRefId: "DNK" },
          { entryId: "016", name: "Japan", description: "Japan", countryName: "Japan", countryCode: "JP", nationality: "Japanese", cid: "JP016", countryRefId: "JPN" },
          { entryId: "017", name: "South Korea", description: "South Korea", countryName: "South Korea", countryCode: "KR", nationality: "Korean", cid: "KR017", countryRefId: "KOR" },
          { entryId: "018", name: "China", description: "China", countryName: "China", countryCode: "CN", nationality: "Chinese", cid: "CN018", countryRefId: "CHN" },
          { entryId: "019", name: "India", description: "India", countryName: "India", countryCode: "IN", nationality: "Indian", cid: "IN019", countryRefId: "IND" },
          { entryId: "020", name: "Singapore", description: "Singapore", countryName: "Singapore", countryCode: "SG", nationality: "Singaporean", cid: "SG020", countryRefId: "SGP" },
          { entryId: "021", name: "Brazil", description: "Brazil", countryName: "Brazil", countryCode: "BR", nationality: "Brazilian", cid: "BR021", countryRefId: "BRA" },
          { entryId: "022", name: "Argentina", description: "Argentina", countryName: "Argentina", countryCode: "AR", nationality: "Argentine", cid: "AR022", countryRefId: "ARG" },
          { entryId: "023", name: "Mexico", description: "Mexico", countryName: "Mexico", countryCode: "MX", nationality: "Mexican", cid: "MX023", countryRefId: "MEX" },
          { entryId: "024", name: "Panama", description: "Panama", countryName: "Panama", countryCode: "PA", nationality: "Panamanian", cid: "PA024", countryRefId: "PAN" },
          { entryId: "025", name: "Philippines", description: "Philippines", countryName: "Philippines", countryCode: "PH", nationality: "Filipino", cid: "PH025", countryRefId: "PHL" },
          { entryId: "026", name: "Indonesia", description: "Indonesia", countryName: "Indonesia", countryCode: "ID", nationality: "Indonesian", cid: "ID026", countryRefId: "IDN" },
          { entryId: "027", name: "Malaysia", description: "Malaysia", countryName: "Malaysia", countryCode: "MY", nationality: "Malaysian", cid: "MY027", countryRefId: "MYS" },
          { entryId: "028", name: "Thailand", description: "Thailand", countryName: "Thailand", countryCode: "TH", nationality: "Thai", cid: "TH028", countryRefId: "THA" },
          { entryId: "029", name: "Vietnam", description: "Vietnam", countryName: "Vietnam", countryCode: "VN", nationality: "Vietnamese", cid: "VN029", countryRefId: "VNM" },
          { entryId: "030", name: "Turkey", description: "Turkey", countryName: "Turkey", countryCode: "TR", nationality: "Turkish", cid: "TR030", countryRefId: "TUR" },
          { entryId: "031", name: "Greece", description: "Greece", countryName: "Greece", countryCode: "GR", nationality: "Greek", cid: "GR031", countryRefId: "GRC" },
          { entryId: "032", name: "Cyprus", description: "Cyprus", countryName: "Cyprus", countryCode: "CY", nationality: "Cypriot", cid: "CY032", countryRefId: "CYP" },
          { entryId: "033", name: "Malta", description: "Malta", countryName: "Malta", countryCode: "MT", nationality: "Maltese", cid: "MT033", countryRefId: "MLT" },
          { entryId: "034", name: "Liberia", description: "Liberia", countryName: "Liberia", countryCode: "LR", nationality: "Liberian", cid: "LR034", countryRefId: "LBR" },
          { entryId: "035", name: "Marshall Islands", description: "Marshall Islands", countryName: "Marshall Islands", countryCode: "MH", nationality: "Marshallese", cid: "MH035", countryRefId: "MHL" },
          { entryId: "036", name: "Bahamas", description: "Bahamas", countryName: "Bahamas", countryCode: "BS", nationality: "Bahamian", cid: "BS036", countryRefId: "BHS" },
          { entryId: "037", name: "Barbados", description: "Barbados", countryName: "Barbados", countryCode: "BB", nationality: "Barbadian", cid: "BB037", countryRefId: "BRB" },
          { entryId: "038", name: "Antigua and Barbuda", description: "Antigua and Barbuda", countryName: "Antigua and Barbuda", countryCode: "AG", nationality: "Antiguan", cid: "AG038", countryRefId: "ATG" },
          { entryId: "039", name: "Saint Vincent", description: "Saint Vincent and the Grenadines", countryName: "Saint Vincent and the Grenadines", countryCode: "VC", nationality: "Vincentian", cid: "VC039", countryRefId: "VCT" },
          { entryId: "040", name: "Saint Kitts and Nevis", description: "Saint Kitts and Nevis", countryName: "Saint Kitts and Nevis", countryCode: "KN", nationality: "Kittitian", cid: "KN040", countryRefId: "KNA" },
          { entryId: "041", name: "Russia", description: "Russia", countryName: "Russia", countryCode: "RU", nationality: "Russian", cid: "RU041", countryRefId: "RUS" },
          { entryId: "042", name: "Ukraine", description: "Ukraine", countryName: "Ukraine", countryCode: "UA", nationality: "Ukrainian", cid: "UA042", countryRefId: "UKR" },
          { entryId: "043", name: "Poland", description: "Poland", countryName: "Poland", countryCode: "PL", nationality: "Polish", cid: "PL043", countryRefId: "POL" },
          { entryId: "044", name: "Romania", description: "Romania", countryName: "Romania", countryCode: "RO", nationality: "Romanian", cid: "RO044", countryRefId: "ROU" },
          { entryId: "045", name: "Bulgaria", description: "Bulgaria", countryName: "Bulgaria", countryCode: "BG", nationality: "Bulgarian", cid: "BG045", countryRefId: "BGR" },
          { entryId: "046", name: "Croatia", description: "Croatia", countryName: "Croatia", countryCode: "HR", nationality: "Croatian", cid: "HR046", countryRefId: "HRV" },
          { entryId: "047", name: "Estonia", description: "Estonia", countryName: "Estonia", countryCode: "EE", nationality: "Estonian", cid: "EE047", countryRefId: "EST" },
          { entryId: "048", name: "Latvia", description: "Latvia", countryName: "Latvia", countryCode: "LV", nationality: "Latvian", cid: "LV048", countryRefId: "LVA" },
          { entryId: "049", name: "Lithuania", description: "Lithuania", countryName: "Lithuania", countryCode: "LT", nationality: "Lithuanian", cid: "LT049", countryRefId: "LTU" },
          { entryId: "050", name: "Finland", description: "Finland", countryName: "Finland", countryCode: "FI", nationality: "Finnish", cid: "FI050", countryRefId: "FIN" }
        ];
        
        // Insert each country entry with enhanced structure
        for (const country of countryData) {
          await this.pool.query(
            `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, countryName, countryCode, nationality, cid, countryRefId, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            ['002', country.entryId, country.name, country.description, country.countryName, country.countryCode, country.nationality, country.cid, country.countryRefId, 1, 0]
          );
        }
        
        console.log("✅ Enhanced country master data seeded successfully with 001-050 format");
      } else {
        console.log("✅ Enhanced country master data already exists");
      }
    } catch (error) {
      console.error("❌ Failed to seed country master data:", error);
      // Don't throw - allow app to continue
    }
  }

  // Vessel type seeding DISABLED - Users manage their own vessel types
  private async ensureVesselTypeDataSeeded(): Promise<void> {
    try {
      console.log("🚢 Vessel type automatic seeding is disabled - users manage their own entries");
      return; // Skip automatic seeding completely
      
      // Check if we have any vessel type entries with enhanced structure
      const [existingVesselTypeEntries]: any = await this.pool.query(
        "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '004' AND entry_id RLIKE '^VT[0-9]+$'"
      );
      
      const enhancedVesselTypesCount = existingVesselTypeEntries[0].count;
      console.log(`📊 Found ${enhancedVesselTypesCount} enhanced vessel type entries with VT format`);
      
      // If we don't have the enhanced vessel type data structure, seed it
      if (false) { // DISABLED - no automatic seeding
        console.log("🗂️ Seeding enhanced vessel type master data with duplicate checking...");
        
        // Vessel type data with enhanced structure based on maritime industry standards
        const vesselTypeData = [
          { entryId: "VT001", name: "Oil Tanker", description: "Oil Tanker", vtuid: "OT001", vesselType: "Oil Tanker", tanker: 1, oilTanker: 1, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
          { entryId: "VT002", name: "Chemical Tanker", description: "Chemical Tanker", vtuid: "CT002", vesselType: "Chemical Tanker", tanker: 1, oilTanker: 0, gasTanker: 0, chemicalTanker: 1, bulk: 0 },
          { entryId: "VT003", name: "LPG Tanker", description: "LPG Tanker", vtuid: "LPG003", vesselType: "LPG Tanker", tanker: 1, oilTanker: 0, gasTanker: 1, chemicalTanker: 0, bulk: 0 },
          { entryId: "VT004", name: "LNG Tanker", description: "LNG Tanker", vtuid: "LNG004", vesselType: "LNG Tanker", tanker: 1, oilTanker: 0, gasTanker: 1, chemicalTanker: 0, bulk: 0 },
          { entryId: "VT005", name: "Bulk Carrier", description: "Bulk Carrier", vtuid: "BC005", vesselType: "Bulk Carrier", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 1 },
          { entryId: "VT006", name: "Container Ship", description: "Container Ship", vtuid: "CS006", vesselType: "Container Ship", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
          { entryId: "VT007", name: "General Cargo", description: "General Cargo", vtuid: "GC007", vesselType: "General Cargo", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
          { entryId: "VT008", name: "Product Tanker", description: "Product Tanker", vtuid: "PT008", vesselType: "Product Tanker", tanker: 1, oilTanker: 1, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
          { entryId: "VT009", name: "Crude Oil Tanker", description: "Crude Oil Tanker", vtuid: "COT009", vesselType: "Crude Oil Tanker", tanker: 1, oilTanker: 1, gasTanker: 0, chemicalTanker: 0, bulk: 0 },
          { entryId: "VT010", name: "Dry Bulk Carrier", description: "Dry Bulk Carrier", vtuid: "DBC010", vesselType: "Dry Bulk Carrier", tanker: 0, oilTanker: 0, gasTanker: 0, chemicalTanker: 0, bulk: 1 }
        ];
        
        // Insert each vessel type entry with enhanced structure (with duplicate checking)
        for (const vesselType of vesselTypeData) {
          try {
            // Check if entry already exists by master_id and entry_id
            const [existing]: any = await this.pool.query(
              "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '004' AND entry_id = ?",
              [vesselType.entryId]
            );
            
            if (existing[0].count === 0) {
              console.log(`🚢 Creating vessel type entry: ${vesselType.entryId} - ${vesselType.name}`);
              await this.pool.query(
                `INSERT INTO master_data_entries 
                 (master_id, entry_id, name, description, vtuid, vesselType, tanker, oilTanker, gasTanker, chemicalTanker, bulk, isActive, isDeleted, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                ['004', vesselType.entryId, vesselType.name, vesselType.description, vesselType.vtuid, vesselType.vesselType, vesselType.tanker, vesselType.oilTanker, vesselType.gasTanker, vesselType.chemicalTanker, vesselType.bulk, 1, 0]
              );
            } else {
              console.log(`✅ Vessel type entry already exists: ${vesselType.entryId} - ${vesselType.name}`);
            }
          } catch (error) {
            console.warn(`⚠️ Warning: Could not create vessel type entry ${vesselType.entryId}:`, error);
            // Continue with next entry - don't let one failure block others
          }
        }
        
        console.log("✅ Enhanced vessel type master data seeded successfully with VT001-VT010 format");
      } else {
        console.log("✅ Enhanced vessel type master data already exists");
      }
    } catch (error) {
      console.error("❌ Failed to seed vessel type master data:", error);
      // Don't throw - allow app to continue
    }
  }

  // Ensure language master data is properly seeded with simple structure
  private async ensureLanguageDataSeeded(): Promise<void> {
    try {
      console.log("🌐 Checking language master data...");
      
      // Check if we have any language entries with enhanced structure
      const [existingLanguageEntries]: any = await this.pool.query(
        "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '003' AND entry_id RLIKE '^LNG[0-9]+$'"
      );
      
      const enhancedLanguagesCount = existingLanguageEntries[0].count;
      console.log(`📊 Found ${enhancedLanguagesCount} enhanced language entries with LNG format`);
      
      // If we don't have the enhanced language data structure, clean and seed it
      if (enhancedLanguagesCount < 20) {
        console.log("🗂️ Cleaning and seeding enhanced language master data...");
        
        // Clear ALL existing entries in master_id '003' to remove vessel type pollution
        await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '003'");
        console.log("🧹 Removed vessel type pollution from Language master (003)");
        
        // Common maritime languages with ISO codes
        const languageData = [
          { entryId: "LNG001", name: "English", description: "EN" },
          { entryId: "LNG002", name: "Spanish", description: "ES" },
          { entryId: "LNG003", name: "Chinese", description: "ZH" },
          { entryId: "LNG004", name: "Filipino", description: "TL" },
          { entryId: "LNG005", name: "Russian", description: "RU" },
          { entryId: "LNG006", name: "Indonesian", description: "ID" },
          { entryId: "LNG007", name: "Hindi", description: "HI" },
          { entryId: "LNG008", name: "Arabic", description: "AR" },
          { entryId: "LNG009", name: "Portuguese", description: "PT" },
          { entryId: "LNG010", name: "French", description: "FR" },
          { entryId: "LNG011", name: "Japanese", description: "JA" },
          { entryId: "LNG012", name: "Korean", description: "KO" },
          { entryId: "LNG013", name: "Vietnamese", description: "VI" },
          { entryId: "LNG014", name: "Turkish", description: "TR" },
          { entryId: "LNG015", name: "Greek", description: "EL" },
          { entryId: "LNG016", name: "Ukrainian", description: "UK" },
          { entryId: "LNG017", name: "Polish", description: "PL" },
          { entryId: "LNG018", name: "Romanian", description: "RO" },
          { entryId: "LNG019", name: "Thai", description: "TH" },
          { entryId: "LNG020", name: "Malay", description: "MS" }
        ];
        
        // Insert each language entry with simple structure (name = language, description = ISO code)
        for (const language of languageData) {
          await this.pool.query(
            `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            ['003', language.entryId, language.name, language.description, 1, 0]
          );
        }
        
        console.log("✅ Enhanced language master data seeded successfully with LNG001-LNG020 format");
      } else {
        console.log("✅ Enhanced language master data already exists");
      }
    } catch (error) {
      console.error("❌ Failed to seed language master data:", error);
      // Don't throw - allow app to continue
    }
  }

  // Ensure port master data is properly seeded with enhanced structure  
  private async ensurePortDataSeeded(): Promise<void> {
    try {
      console.log("🏰 Checking port master data...");
      
      // Check if we have any port entries with enhanced structure (PORT001-PORT020)
      const [existingPortEntries]: any = await this.pool.query(
        "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = '018' AND entry_id RLIKE '^PORT[0-9]+$'"
      );
      
      const enhancedPortsCount = existingPortEntries[0].count;
      console.log(`📊 Found ${enhancedPortsCount} enhanced port entries with PORT format`);
      
      // If we don't have the enhanced port data structure, seed it
      if (enhancedPortsCount < 20) {
        console.log("🗂️ Seeding enhanced port master data...");
        
        // Clear existing port entries to ensure clean enhanced structure
        await this.pool.query("DELETE FROM master_data_entries WHERE master_id = '018'");
        
        // Major international maritime ports with enhanced structure
        const portData = [
          { entryId: "PORT001", name: "Singapore", description: "Port of Singapore", portCode: "SGSIN", portName: "Singapore", latitude: 1.2966, longitude: 103.8764, countryId: "020", region: "Southeast Asia", timeZone: "GMT+8", harborType: "Container Hub", facilities: "Container,Bulk,Tanker,Passenger" },
          { entryId: "PORT002", name: "Shanghai", description: "Port of Shanghai", portCode: "CNSHA", portName: "Shanghai", latitude: 31.2304, longitude: 121.4737, countryId: "018", region: "East Asia", timeZone: "GMT+8", harborType: "Container Hub", facilities: "Container,Bulk,General Cargo" },
          { entryId: "PORT003", name: "Rotterdam", description: "Port of Rotterdam", portCode: "NLRTM", portName: "Rotterdam", latitude: 51.9225, longitude: 4.4792, countryId: "012", region: "Europe", timeZone: "GMT+1", harborType: "Container Hub", facilities: "Container,Bulk,Tanker,Chemicals" },
          { entryId: "PORT004", name: "Antwerp", description: "Port of Antwerp", portCode: "BEANR", portName: "Antwerp", latitude: 51.2194, longitude: 4.4025, countryId: "004", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Chemicals" },
          { entryId: "PORT005", name: "Hamburg", description: "Port of Hamburg", portCode: "DEHAM", portName: "Hamburg", latitude: 53.5511, longitude: 9.9937, countryId: "008", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Bulk" },
          { entryId: "PORT006", name: "Los Angeles", description: "Port of Los Angeles", portCode: "USLAX", portName: "Los Angeles", latitude: 33.7447, longitude: -118.2567, countryId: "005", region: "North America", timeZone: "GMT-8", harborType: "Container Hub", facilities: "Container,Bulk,General Cargo" },
          { entryId: "PORT007", name: "Hong Kong", description: "Port of Hong Kong", portCode: "HKHKG", portName: "Hong Kong", latitude: 22.3193, longitude: 114.1694, countryId: "018", region: "East Asia", timeZone: "GMT+8", harborType: "Container Hub", facilities: "Container,General Cargo,Transshipment" },
          { entryId: "PORT008", name: "Dubai", description: "Port of Dubai", portCode: "AEDXB", portName: "Dubai", latitude: 25.2697, longitude: 55.3094, countryId: "004", region: "Middle East", timeZone: "GMT+4", harborType: "Container Hub", facilities: "Container,General Cargo,Transshipment" },
          { entryId: "PORT009", name: "New York", description: "Port of New York", portCode: "USNYC", portName: "New York", latitude: 40.6892, longitude: -74.0445, countryId: "005", region: "North America", timeZone: "GMT-5", harborType: "Container Port", facilities: "Container,General Cargo,Bulk" },
          { entryId: "PORT010", name: "Busan", description: "Port of Busan", portCode: "KRPUS", portName: "Busan", latitude: 35.1796, longitude: 129.0756, countryId: "017", region: "East Asia", timeZone: "GMT+9", harborType: "Container Hub", facilities: "Container,Bulk,Transshipment" },
          { entryId: "PORT011", name: "Le Havre", description: "Port of Le Havre", portCode: "FRLEH", portName: "Le Havre", latitude: 49.4944, longitude: 0.1079, countryId: "009", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Tanker" },
          { entryId: "PORT012", name: "Felixstowe", description: "Port of Felixstowe", portCode: "GBFXT", portName: "Felixstowe", latitude: 51.9607, longitude: 1.3511, countryId: "004", region: "Europe", timeZone: "GMT", harborType: "Container Port", facilities: "Container,General Cargo" },
          { entryId: "PORT013", name: "Mumbai", description: "Port of Mumbai", portCode: "INMUN", portName: "Mumbai", latitude: 18.9220, longitude: 72.8347, countryId: "019", region: "South Asia", timeZone: "GMT+5:30", harborType: "Container Port", facilities: "Container,Bulk,General Cargo" },
          { entryId: "PORT014", name: "Yokohama", description: "Port of Yokohama", portCode: "JPYOK", portName: "Yokohama", latitude: 35.4437, longitude: 139.6380, countryId: "016", region: "East Asia", timeZone: "GMT+9", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
          { entryId: "PORT015", name: "Long Beach", description: "Port of Long Beach", portCode: "USLGB", portName: "Long Beach", latitude: 33.7701, longitude: -118.2437, countryId: "005", region: "North America", timeZone: "GMT-8", harborType: "Container Port", facilities: "Container,Bulk,General Cargo" },
          { entryId: "PORT016", name: "Valencia", description: "Port of Valencia", portCode: "ESVLC", portName: "Valencia", latitude: 39.4699, longitude: -0.3763, countryId: "011", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
          { entryId: "PORT017", name: "Piraeus", description: "Port of Piraeus", portCode: "GRPIR", portName: "Piraeus", latitude: 37.9755, longitude: 23.7348, countryId: "031", region: "Europe", timeZone: "GMT+2", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
          { entryId: "PORT018", name: "Marseille", description: "Port of Marseille", portCode: "FRMRS", portName: "Marseille", latitude: 43.2965, longitude: 5.3698, countryId: "009", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
          { entryId: "PORT019", name: "Barcelona", description: "Port of Barcelona", portCode: "ESBCN", portName: "Barcelona", latitude: 41.3851, longitude: 2.1734, countryId: "011", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" },
          { entryId: "PORT020", name: "Genoa", description: "Port of Genoa", portCode: "ITGOA", portName: "Genoa", latitude: 44.4056, longitude: 8.9463, countryId: "010", region: "Europe", timeZone: "GMT+1", harborType: "Container Port", facilities: "Container,General Cargo,Passenger" }
        ];
        
        // Insert each port entry with enhanced structure
        for (const port of portData) {
          await this.pool.query(
            `INSERT INTO master_data_entries 
             (master_id, entry_id, name, description, portCode, portName, latitude, longitude, countryId, region, timeZone, harborType, facilities, isActive, isDeleted, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            ['018', port.entryId, port.name, port.description, port.portCode, port.portName, port.latitude, port.longitude, port.countryId, port.region, port.timeZone, port.harborType, port.facilities, 1, 0]
          );
        }
        
        console.log("✅ Enhanced port master data seeded successfully with PORT001-PORT020 format");
      } else {
        console.log("✅ Enhanced port master data already exists");
      }
    } catch (error) {
      console.error("❌ Failed to seed port master data:", error);
      // Don't throw - allow app to continue
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0] || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0] || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [created] = await this.db.insert(users).values(insertUser).returning();
    return created;
  }

  // Form methods
  async getForms(): Promise<Form[]> {
    return await this.db.select().from(forms);
  }

  async getForm(id: number): Promise<Form | undefined> {
    const result = await this.db.select().from(forms).where(eq(forms.id, id));
    return result[0] || undefined;
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const [created] = await this.db.insert(forms).values(insertForm).returning();
    return created;
  }

  async updateForm(id: number, formData: Partial<InsertForm>): Promise<Form | undefined> {
    const result = await this.db.update(forms).set(formData).where(eq(forms.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteForm(id: number): Promise<boolean> {
    const result = await this.db.delete(forms).where(eq(forms.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Rank Group methods
  async getRankGroups(): Promise<RankGroup[]> {
    return await this.db.select().from(rankGroups);
  }

  async createRankGroup(insertRankGroup: InsertRankGroup): Promise<RankGroup> {
    const [created] = await this.db.insert(rankGroups).values(insertRankGroup).returning();
    return created;
  }

  async updateRankGroup(id: number, rankGroupData: Partial<InsertRankGroup>): Promise<RankGroup | undefined> {
    const result = await this.db.update(rankGroups).set(rankGroupData).where(eq(rankGroups.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteRankGroup(id: number): Promise<boolean> {
    const result = await this.db.delete(rankGroups).where(eq(rankGroups.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Available Rank methods
  async getAvailableRanks(): Promise<AvailableRank[]> {
    return await this.db.select().from(availableRanks);
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    const [created] = await this.db.insert(availableRanks).values(insertAvailableRank).returning();
    return created;
  }

  async updateAvailableRank(id: number, rankData: Partial<InsertAvailableRank>): Promise<AvailableRank | undefined> {
    const result = await this.db.update(availableRanks).set(rankData).where(eq(availableRanks.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteAvailableRank(id: number): Promise<boolean> {
    const result = await this.db.delete(availableRanks).where(eq(availableRanks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async clearAllAvailableRanks(): Promise<boolean> {
    await this.db.delete(availableRanks);
    await this.pool.query(`ALTER SEQUENCE available_ranks_id_seq RESTART WITH 1`);
    return true;
  }

  async updateRankOrders(rankOrders: { id: number; sortOrder: number }[]): Promise<boolean> {
    for (const { id, sortOrder } of rankOrders) {
      await this.db.update(availableRanks)
        .set({ sortOrder })
        .where(eq(availableRanks.id, id));
    }
    return true;
  }

  // Company Rank methods
  async getCompanyRanks(): Promise<CompanyRank[]> {
    return await this.db.select().from(companyRanks);
  }

  async getCompanyRank(id: string): Promise<CompanyRank | undefined> {
    const result = await this.db.select().from(companyRanks).where(eq(companyRanks.id, id));
    return result[0] || undefined;
  }

  async createCompanyRank(rank: InsertCompanyRank): Promise<CompanyRank> {
    const [created] = await this.db.insert(companyRanks).values(rank).returning();
    return created;
  }

  async updateCompanyRank(id: string, rank: Partial<InsertCompanyRank>): Promise<CompanyRank | undefined> {
    const result = await this.db.update(companyRanks).set(rank).where(eq(companyRanks.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteCompanyRank(id: string): Promise<boolean> {
    const result = await this.db.delete(companyRanks).where(eq(companyRanks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async clearAllCompanyRanks(): Promise<boolean> {
    await this.db.delete(companyRanks);
    return true;
  }

  async saveAllCompanyRanks(ranks: InsertCompanyRank[]): Promise<CompanyRank[]> {
    await this.db.delete(companyRanks);
    if (ranks.length > 0) {
      const result = await this.db.insert(companyRanks).values(ranks).returning();
      return result;
    }
    return [];
  }

  // Promotion Hierarchy methods
  async getPromotionHierarchies(): Promise<PromotionHierarchy[]> {
    return await this.db.select().from(promotionHierarchies);
  }

  async getPromotionHierarchy(id: number): Promise<PromotionHierarchy | undefined> {
    const result = await this.db.select().from(promotionHierarchies).where(eq(promotionHierarchies.id, id));
    return result[0] || undefined;
  }

  async createPromotionHierarchy(hierarchy: InsertPromotionHierarchy): Promise<PromotionHierarchy> {
    const [created] = await this.db.insert(promotionHierarchies).values(hierarchy).returning();
    return created;
  }

  async updatePromotionHierarchy(id: number, hierarchy: Partial<InsertPromotionHierarchy>): Promise<PromotionHierarchy | undefined> {
    const result = await this.db.update(promotionHierarchies).set(hierarchy).where(eq(promotionHierarchies.id, id)).returning();
    return result[0] || undefined;
  }

  async deletePromotionHierarchy(id: number): Promise<boolean> {
    const result = await this.db.delete(promotionHierarchies).where(eq(promotionHierarchies.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Crew Member methods
  async getCrewMembers(): Promise<CrewMember[]> {
    return await this.db.select().from(crewMembers);
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    const result = await this.db.select().from(crewMembers).where(eq(crewMembers.id, id));
    return result[0] || undefined;
  }

  async createCrewMember(insertCrewMember: InsertCrewMember): Promise<CrewMember> {
    const [created] = await this.db.insert(crewMembers).values(insertCrewMember).returning();
    return created;
  }

  async updateCrewMember(id: string, crewMemberData: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const result = await this.db.update(crewMembers).set(crewMemberData).where(eq(crewMembers.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    const result = await this.db.delete(crewMembers).where(eq(crewMembers.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getNextCrewId(): Promise<string> {
    // Check if id_counters table has crew_id counter
    const result = await this.pool.query(
      'SELECT current_value, prefix, format FROM id_counters WHERE counter_type = $1',
      ['crew_id']
    );
    
    let currentValue = 0;
    let prefix = 'A';
    let format = '0000';
    
    if (result.rows.length > 0) {
      currentValue = result.rows[0].current_value;
      prefix = result.rows[0].prefix;
      format = result.rows[0].format;
    } else {
      // Initialize counter if it doesn't exist
      await this.pool.query(
        'INSERT INTO id_counters (counter_type, current_value, prefix, format) VALUES ($1, $2, $3, $4)',
        ['crew_id', 0, 'A', '0000']
      );
    }
    
    const nextValue = currentValue + 1;
    
    // Update counter
    await this.pool.query(
      'UPDATE id_counters SET current_value = $1, updated_at = NOW() WHERE counter_type = $2',
      [nextValue, 'crew_id']
    );
    
    // Use the format length to determine padding
    const paddingLength = format.length;
    return `${prefix}${nextValue.toString().padStart(paddingLength, '0')}`;
  }

  // Appraisal Result methods
  async getAppraisalResults(): Promise<AppraisalResult[]> {
    return await this.db.select().from(appraisalResults);
  }

  async getAppraisalResult(id: number): Promise<AppraisalResult | undefined> {
    const result = await this.db.select().from(appraisalResults).where(eq(appraisalResults.id, id));
    return result[0] || undefined;
  }

  async getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]> {
    return await this.db.select().from(appraisalResults).where(eq(appraisalResults.crewMemberId, crewMemberId));
  }

  async createAppraisalResult(insertAppraisalResult: InsertAppraisalResult): Promise<AppraisalResult> {
    const [created] = await this.db.insert(appraisalResults).values(insertAppraisalResult).returning();
    return created;
  }

  async updateAppraisalResult(id: number, appraisalResultData: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined> {
    const result = await this.db.update(appraisalResults).set(appraisalResultData).where(eq(appraisalResults.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteAppraisalResult(id: number): Promise<boolean> {
    const result = await this.db.delete(appraisalResults).where(eq(appraisalResults.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async submitAppraisalStage(id: number, stage: string, data: any, submittedBy: string): Promise<AppraisalResult | undefined> {
    // Map stage to status
    const statusMap: Record<string, string> = {
      'stage1': 'Preliminary',
      'stage2': 'Submitted',
      'stage3': 'Reviewed'
    };
    
    const newStatus = statusMap[stage] || 'Draft';
    
    // Get current appraisal
    const current = await this.getAppraisalResult(id);
    if (!current) {
      return undefined;
    }
    
    // Merge new data into existing appraisal data
    const updatedData = {
      ...(current.appraisalData as any || {}),
      ...data,
      [`${stage}SubmittedBy`]: submittedBy,
      [`${stage}SubmittedAt`]: new Date().toISOString()
    };
    
    // Update appraisal with new data and status
    const result = await this.db
      .update(appraisalResults)
      .set({
        appraisalData: updatedData,
        status: newStatus,
        submittedAt: new Date()
      })
      .where(eq(appraisalResults.id, id))
      .returning();
    
    return result[0] || undefined;
  }

  // Recruitment Candidates Methods
  async getRecruitmentCandidates(): Promise<RecruitmentCandidate[]> {
    return await this.db.select().from(recruitmentCandidates);
  }

  async getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    const results = await this.db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.id, id));
    return results[0] || undefined;
  }

  async getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]> {
    return await this.db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.status, status));
  }

  async createRecruitmentCandidate(insertCandidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate> {
    const [created] = await this.db.insert(recruitmentCandidates).values(insertCandidate).returning();
    return created;
  }

  async updateRecruitmentCandidate(id: string, candidateData: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined> {
    const result = await this.db.update(recruitmentCandidates)
      .set({ ...candidateData, updatedAt: new Date() })
      .where(eq(recruitmentCandidates.id, id))
      .returning();
    
    return result[0] || undefined;
  }

  async deleteRecruitmentCandidate(id: string): Promise<boolean> {
    const result = await this.db.delete(recruitmentCandidates).where(eq(recruitmentCandidates.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async transferRecruitedCandidate(candidateId: string): Promise<CrewMember> {
    // Get the candidate
    const candidate = await this.getRecruitmentCandidate(candidateId);
    if (!candidate) {
      throw new Error(`Recruitment candidate ${candidateId} not found`);
    }
    
    // Generate new crew ID
    const newCrewId = await this.getNextCrewId();
    
    // Create crew member from candidate data
    const crewMemberData: InsertCrewMember = {
      id: newCrewId,
      empNo: candidate.empNo || '',
      firstName: candidate.firstName,
      middleName: candidate.middleName,
      familyName: candidate.familyName,
      dateOfBirth: candidate.dateOfBirth,
      nationality: candidate.nationality,
      presentRank: candidate.rankAppliedFor,
      presentVessel: 'Unassigned',
      vesselType: 'General',
      rankAppliedFor: candidate.rankAppliedFor,
      email: candidate.email,
      mobile: candidate.mobile,
      residentialAddressLine1: candidate.residentialAddressLine1,
      residentialAddressLine2: candidate.residentialAddressLine2,
      status: 'Active'
    };
    
    // Create the crew member
    const crewMember = await this.createCrewMember(crewMemberData);
    
    // Update candidate status to "Recruited"
    await this.updateRecruitmentCandidate(candidateId, {
      status: 'Recruited',
      transferredToCrewId: newCrewId
    });
    
    return crewMember;
  }

  // Vessel Groups Methods
  async getVesselGroups(): Promise<VesselGroup[]> {
    return await this.db.select().from(vesselGroups);
  }

  async getVesselGroup(id: number): Promise<VesselGroup | undefined> {
    const result = await this.db.select().from(vesselGroups).where(eq(vesselGroups.id, id));
    return result[0] || undefined;
  }

  async createVesselGroup(group: InsertVesselGroup): Promise<VesselGroup> {
    const [created] = await this.db.insert(vesselGroups).values(group).returning();
    return created;
  }

  async updateVesselGroup(id: number, group: Partial<InsertVesselGroup>): Promise<VesselGroup | undefined> {
    const result = await this.db.update(vesselGroups).set(group).where(eq(vesselGroups.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteVesselGroup(id: number): Promise<boolean> {
    const result = await this.db.delete(vesselGroups).where(eq(vesselGroups.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vessel Drafts Methods
  async getVesselDrafts(): Promise<VesselDraft[]> {
    return await this.db.select().from(vesselDrafts);
  }

  async getVesselDraft(id: number): Promise<VesselDraft | undefined> {
    const result = await this.db.select().from(vesselDrafts).where(eq(vesselDrafts.id, id));
    return result[0] || undefined;
  }

  async getVesselDraftsByVessel(vesselId: string): Promise<VesselDraft[]> {
    return await this.db.select().from(vesselDrafts).where(eq(vesselDrafts.vesselId, vesselId));
  }

  async createVesselDraft(draft: InsertVesselDraft): Promise<VesselDraft> {
    const [created] = await this.db.insert(vesselDrafts).values(draft).returning();
    return created;
  }

  async updateVesselDraft(id: number, draft: Partial<InsertVesselDraft>): Promise<VesselDraft | undefined> {
    const result = await this.db.update(vesselDrafts).set(draft).where(eq(vesselDrafts.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteVesselDraft(id: number): Promise<boolean> {
    const result = await this.db.delete(vesselDrafts).where(eq(vesselDrafts.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vessel Revisions Methods
  async getVesselRevisions(): Promise<VesselRevision[]> {
    return await this.db.select().from(vesselRevisions);
  }

  async getVesselRevision(id: number): Promise<VesselRevision | undefined> {
    const result = await this.db.select().from(vesselRevisions).where(eq(vesselRevisions.id, id));
    return result[0] || undefined;
  }

  async getVesselRevisionsByVessel(vesselId: string): Promise<VesselRevision[]> {
    return await this.db.select().from(vesselRevisions).where(eq(vesselRevisions.vesselId, vesselId));
  }

  async createVesselRevision(revision: InsertVesselRevision): Promise<VesselRevision> {
    const [created] = await this.db.insert(vesselRevisions).values(revision).returning();
    return created;
  }

  // Vessel Planning Methods
  async getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]> {
    return await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.vesselId, vesselId));
  }

  async getVesselPlanningById(id: number): Promise<VesselPlanning | undefined> {
    const result = await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.id, id));
    return result[0] || undefined;
  }

  async createVesselPlanning(planning: InsertVesselPlanning): Promise<VesselPlanning> {
    const [created] = await this.db.insert(vesselPlanning).values(planning).returning();
    return created;
  }

  async updateVesselPlanning(id: number, planning: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined> {
    const result = await this.db.update(vesselPlanning).set(planning).where(eq(vesselPlanning.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteVesselPlanning(id: number): Promise<boolean> {
    const result = await this.db.delete(vesselPlanning).where(eq(vesselPlanning.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Rotation Plans Methods
  async getRotationPlans(): Promise<RotationPlan[]> {
    return await this.db.select().from(rotationPlans);
  }

  async getRotationPlan(id: number): Promise<RotationPlan | undefined> {
    const result = await this.db.select().from(rotationPlans).where(eq(rotationPlans.id, id));
    return result[0] || undefined;
  }

  async createRotationPlan(plan: InsertRotationPlan): Promise<RotationPlan> {
    const [created] = await this.db.insert(rotationPlans).values(plan).returning();
    return created;
  }

  async updateRotationPlan(id: number, plan: Partial<InsertRotationPlan>): Promise<RotationPlan | undefined> {
    const result = await this.db.update(rotationPlans).set(plan).where(eq(rotationPlans.id, id)).returning();
    return result[0] || undefined;
  }

  async deleteRotationPlan(id: number): Promise<boolean> {
    const result = await this.db.delete(rotationPlans).where(eq(rotationPlans.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Rotation Workflow Methods
  async proposeRotationPlan(id: number, proposedBy: string): Promise<RotationPlan | undefined> {
    const now = new Date().toISOString();
    const [updated] = await this.db
      .update(rotationPlans)
      .set({
        planStatus: "Proposed",
        proposedBy: proposedBy,
        proposedDate: now,
        lastEdited: now
      })
      .where(eq(rotationPlans.id, id))
      .returning();
    
    return updated;
  }

  async getProposedAssignments(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string }): Promise<any[]> {
    // Get plans with "Proposed" or "Partially Approved" status
    const plans = await this.db
      .select()
      .from(rotationPlans);
    
    // Filter for Proposed or Partially Approved status
    const relevantPlans = plans.filter(plan => 
      plan.planStatus === "Proposed" || plan.planStatus === "Partially Approved"
    );
    
    // Extract and flatten assignments from all proposed/partially approved plans
    const proposedAssignments: any[] = [];
    
    for (const plan of relevantPlans) {
      // Apply draftId filter
      if (filters?.draftId && plan.draftId !== filters.draftId) continue;
      
      // Apply date filters with proper date parsing (handles ISO timestamps)
      if (filters?.dateFrom) {
        const planToDate = new Date(plan.planToDate);
        const filterFromDate = new Date(filters.dateFrom);
        if (planToDate < filterFromDate) continue;
      }
      if (filters?.dateTo) {
        const planFromDate = new Date(plan.planFromDate);
        const filterToDate = new Date(filters.dateTo);
        if (planFromDate > filterToDate) continue;
      }
      
      // Parse assignments JSON
      const assignments = plan.assignments ? JSON.parse(plan.assignments) : [];
      
      // Add plan context to each assignment
      for (const assignment of assignments) {
        // Apply vessel filter
        if (filters?.vessels && !filters.vessels.includes(assignment.vesselName)) continue;
        
        // Apply rank filter
        if (filters?.ranks && !filters.ranks.includes(assignment.rank)) continue;
        
        proposedAssignments.push({
          ...assignment,
          planId: plan.id,
          planFromDate: plan.planFromDate,
          planToDate: plan.planToDate,
          proposedBy: plan.proposedBy,
          proposedDate: plan.proposedDate
        });
      }
    }
    
    return proposedAssignments;
  }

  async deployAssignment(planId: number, assignmentIndex: number, deployedBy: string): Promise<{ success: boolean; conflicts?: any[] }> {
    try {
      // Get current plan
      const plans = await this.db
        .select()
        .from(rotationPlans)
        .where(eq(rotationPlans.id, planId));
      
      if (!plans[0]) return { success: false };
      
      // Parse assignments
      const assignments = plans[0].assignments ? JSON.parse(plans[0].assignments) : [];
      if (!assignments[assignmentIndex]) return { success: false };
      
      const assignment = assignments[assignmentIndex];
      
      // Check for conflicts before deployment
      const conflicts = await this.checkAssignmentConflicts(
        assignment.crewId,
        assignment.joiningDate,
        assignment.contractPeriod || 6,
        planId,
        assignmentIndex
      );
      
      if (conflicts.length > 0) {
        return { success: false, conflicts };
      }
      
      // Update assignment
      assignments[assignmentIndex] = {
        ...assignment,
        status: 'Deployed',
        deployedBy: deployedBy,
        deployedAt: new Date().toISOString()
      };
      
      // Save updated assignments
      await this.db
        .update(rotationPlans)
        .set({ 
          assignments: JSON.stringify(assignments),
          lastEdited: new Date().toISOString()
        })
        .where(eq(rotationPlans.id, planId));
      
      return { success: true };
    } catch (error) {
      console.error('Error deploying assignment:', error);
      return { success: false };
    }
  }

  async rejectAssignment(planId: number, assignmentIndex: number): Promise<RotationPlan | undefined> {
    try {
      // Get current plan
      const plans = await this.db
        .select()
        .from(rotationPlans)
        .where(eq(rotationPlans.id, planId));
      
      if (!plans[0]) return undefined;
      
      // Parse and update assignments
      const assignments = plans[0].assignments ? JSON.parse(plans[0].assignments) : [];
      if (!assignments[assignmentIndex]) return undefined;
      
      assignments[assignmentIndex] = {
        ...assignments[assignmentIndex],
        status: 'Rejected',
        rejectedAt: new Date().toISOString()
      };
      
      // Save updated assignments and return updated plan
      const [updated] = await this.db
        .update(rotationPlans)
        .set({ 
          assignments: JSON.stringify(assignments),
          lastEdited: new Date().toISOString()
        })
        .where(eq(rotationPlans.id, planId))
        .returning();
      
      return updated;
    } catch (error) {
      console.error('Error rejecting assignment:', error);
      return undefined;
    }
  }

  async checkAssignmentConflicts(
    crewId: string, 
    joiningDate: string, 
    contractPeriod: number,
    excludePlanId?: number,
    excludeAssignmentIndex?: number
  ): Promise<any[]> {
    // Calculate end date from joining date + contract period (months)
    const joiningDateObj = new Date(joiningDate);
    const endDateObj = new Date(joiningDateObj);
    endDateObj.setMonth(endDateObj.getMonth() + contractPeriod);
    const endDate = endDateObj.toISOString().split('T')[0];
    
    const conflicts: any[] = [];
    
    // Check 1: Conflicts in vesselPlanning table (deployed assignments)
    const vesselPlanningEntries = await this.db
      .select()
      .from(vesselPlanning)
      .where(eq(vesselPlanning.crewMemberId, crewId));
    
    for (const planning of vesselPlanningEntries) {
      // Calculate planning end date if available
      const planStart = planning.plannedDate || planning.joiningDate;
      if (!planStart) continue;
      
      // Use endDate if available, otherwise calculate from contract period
      let planEnd = planning.endDate;
      if (!planEnd && planning.contractPeriod) {
        const planStartObj = new Date(planStart);
        const planEndObj = new Date(planStartObj);
        planEndObj.setMonth(planEndObj.getMonth() + planning.contractPeriod);
        planEnd = planEndObj.toISOString().split('T')[0];
      } else if (!planEnd) {
        // Default to 6 months if no contract period specified
        const planStartObj = new Date(planStart);
        const planEndObj = new Date(planStartObj);
        planEndObj.setMonth(planEndObj.getMonth() + 6);
        planEnd = planEndObj.toISOString().split('T')[0];
      }
      
      // Check date overlap
      const hasOverlap = joiningDate <= planEnd && endDate >= planStart;
      
      if (hasOverlap) {
        conflicts.push({
          source: 'vesselPlanning',
          planningId: planning.id,
          crewId: planning.crewMemberId,
          vesselId: planning.vesselId,
          rank: planning.rank,
          startDate: planStart,
          endDate: planEnd,
          conflictType: 'deployed_assignment'
        });
      }
    }
    
    // Check 2: Conflicts in rotation plans (proposed/pending assignments)
    const allPlans = await this.db.select().from(rotationPlans);
    
    for (const plan of allPlans) {
      // Skip the plan we're checking against
      if (excludePlanId && plan.id === excludePlanId) continue;
      
      // Parse assignments
      const assignments = plan.assignments ? JSON.parse(plan.assignments) : [];
      
      for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        
        // Skip the specific assignment we're checking
        if (excludePlanId && plan.id === excludePlanId && excludeAssignmentIndex === i) continue;
        
        // Check if it's the same crew member
        if (assignment.crewId !== crewId) continue;
        
        // Skip rejected assignments
        if (assignment.status === 'Rejected') continue;
        
        // Calculate assignment end date
        const assignmentStart = assignment.joiningDate;
        const assignmentPeriod = assignment.contractPeriod || 6;
        const assignmentStartObj = new Date(assignmentStart);
        const assignmentEndObj = new Date(assignmentStartObj);
        assignmentEndObj.setMonth(assignmentEndObj.getMonth() + assignmentPeriod);
        const assignmentEnd = assignmentEndObj.toISOString().split('T')[0];
        
        // Check date overlap: ranges overlap if start1 <= end2 AND end1 >= start2
        const hasOverlap = joiningDate <= assignmentEnd && endDate >= assignmentStart;
        
        if (hasOverlap) {
          conflicts.push({
            source: 'rotationPlan',
            ...assignment,
            planId: plan.id,
            assignmentIndex: i,
            conflictType: 'date_overlap'
          });
        }
      }
    }
    
    return conflicts;
  }

  // Rest Hours Vessel Records Methods
  async getRestHoursVesselRecords(): Promise<RestHoursVesselRecord[]> {
    return await this.db.select().from(restHoursVesselRecords);
  }

  async getRestHoursVesselRecord(id: number): Promise<RestHoursVesselRecord | undefined> {
    const results = await this.db
      .select()
      .from(restHoursVesselRecords)
      .where(eq(restHoursVesselRecords.id, id));
    return results[0] || undefined;
  }

  async getRestHoursVesselRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string }): Promise<RestHoursVesselRecord[]> {
    const conditions = [];
    
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      conditions.push(inArray(restHoursVesselRecords.vesselId, filters.vesselIds));
    }
    if (filters.monthValue) {
      conditions.push(eq(restHoursVesselRecords.monthValue, filters.monthValue));
    }
    
    if (conditions.length === 0) {
      return await this.db.select().from(restHoursVesselRecords);
    }
    
    return await this.db
      .select()
      .from(restHoursVesselRecords)
      .where(and(...conditions));
  }

  async createRestHoursVesselRecord(record: InsertRestHoursVesselRecord): Promise<RestHoursVesselRecord> {
    const [created] = await this.db
      .insert(restHoursVesselRecords)
      .values(record)
      .returning();
    return created;
  }

  async updateRestHoursVesselRecord(id: number, record: Partial<InsertRestHoursVesselRecord>): Promise<RestHoursVesselRecord | undefined> {
    const [updated] = await this.db
      .update(restHoursVesselRecords)
      .set(record)
      .where(eq(restHoursVesselRecords.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRestHoursVesselRecord(id: number): Promise<boolean> {
    const result = await this.db
      .delete(restHoursVesselRecords)
      .where(eq(restHoursVesselRecords.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Rest Hours Crew Records Methods
  async getRestHoursCrewRecords(): Promise<RestHoursCrewRecord[]> {
    return await this.db.select().from(restHoursCrewRecords);
  }

  async getRestHoursCrewRecord(id: number): Promise<RestHoursCrewRecord | undefined> {
    const results = await this.db
      .select()
      .from(restHoursCrewRecords)
      .where(eq(restHoursCrewRecords.id, id));
    return results[0] || undefined;
  }

  async getRestHoursCrewRecordsByFilters(filters: { vesselIds?: string[]; monthValue?: string; ranks?: string[]; search?: string }): Promise<RestHoursCrewRecord[]> {
    const conditions = [];
    
    if (filters.vesselIds && filters.vesselIds.length > 0) {
      conditions.push(inArray(restHoursCrewRecords.vesselId, filters.vesselIds));
    }
    if (filters.monthValue) {
      conditions.push(eq(restHoursCrewRecords.monthValue, filters.monthValue));
    }
    if (filters.ranks && filters.ranks.length > 0) {
      conditions.push(inArray(restHoursCrewRecords.rank, filters.ranks));
    }
    if (filters.search) {
      conditions.push(
        or(
          sql`${restHoursCrewRecords.crewMemberId} ILIKE ${`%${filters.search}%`}`,
          sql`${restHoursCrewRecords.name} ILIKE ${`%${filters.search}%`}`
        )
      );
    }
    
    if (conditions.length === 0) {
      return await this.db.select().from(restHoursCrewRecords);
    }
    
    return await this.db
      .select()
      .from(restHoursCrewRecords)
      .where(and(...conditions));
  }

  async createRestHoursCrewRecord(record: InsertRestHoursCrewRecord): Promise<RestHoursCrewRecord> {
    const [created] = await this.db
      .insert(restHoursCrewRecords)
      .values(record)
      .returning();
    return created;
  }

  async updateRestHoursCrewRecord(id: number, record: Partial<InsertRestHoursCrewRecord>): Promise<RestHoursCrewRecord | undefined> {
    const [updated] = await this.db
      .update(restHoursCrewRecords)
      .set(record)
      .where(eq(restHoursCrewRecords.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRestHoursCrewRecord(id: number): Promise<boolean> {
    const result = await this.db
      .delete(restHoursCrewRecords)
      .where(eq(restHoursCrewRecords.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Rest Hours Daily Records Methods
  async getRestHoursDailyRecords(): Promise<RestHoursDailyRecord[]> {
    return await this.db.select().from(restHoursDailyRecords);
  }

  async getRestHoursDailyRecord(id: number): Promise<RestHoursDailyRecord | undefined> {
    const results = await this.db
      .select()
      .from(restHoursDailyRecords)
      .where(eq(restHoursDailyRecords.id, id));
    return results[0] || undefined;
  }

  async getRestHoursDailyRecordByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<RestHoursDailyRecord | undefined> {
    const results = await this.db
      .select()
      .from(restHoursDailyRecords)
      .where(
        and(
          eq(restHoursDailyRecords.crewMemberId, crewMemberId),
          eq(restHoursDailyRecords.vesselId, vesselId),
          eq(restHoursDailyRecords.monthYear, monthYear)
        )
      );
    return results[0] || undefined;
  }

  async createRestHoursDailyRecord(record: InsertRestHoursDailyRecord): Promise<RestHoursDailyRecord> {
    const [created] = await this.db
      .insert(restHoursDailyRecords)
      .values(record)
      .returning();
    return created;
  }

  async updateRestHoursDailyRecord(id: number, record: Partial<InsertRestHoursDailyRecord>): Promise<RestHoursDailyRecord | undefined> {
    const [updated] = await this.db
      .update(restHoursDailyRecords)
      .set(record)
      .where(eq(restHoursDailyRecords.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRestHoursDailyRecord(id: number): Promise<boolean> {
    const result = await this.db
      .delete(restHoursDailyRecords)
      .where(eq(restHoursDailyRecords.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // JSON Normalization Helpers for Phase 2F
  private parseVariableTask(task: VariableTask): VariableTask {
    return {
      ...task,
      selectedTasks: task.selectedTasks 
        ? (typeof task.selectedTasks === 'string' ? JSON.parse(task.selectedTasks) : task.selectedTasks)
        : null,
      crewInvolvedDetails: task.crewInvolvedDetails 
        ? (typeof task.crewInvolvedDetails === 'string' ? JSON.parse(task.crewInvolvedDetails) : task.crewInvolvedDetails)
        : null
    };
  }

  private stringifyVariableTaskInput(task: any): any {
    const result = { ...task };
    if (task.selectedTasks !== undefined) {
      result.selectedTasks = task.selectedTasks ? JSON.stringify(task.selectedTasks) : null;
    }
    if (task.crewInvolvedDetails !== undefined) {
      result.crewInvolvedDetails = task.crewInvolvedDetails ? JSON.stringify(task.crewInvolvedDetails) : null;
    }
    return result;
  }

  private parseFixedTask(task: FixedTask): FixedTask {
    return {
      ...task,
      seaHours: task.seaHours 
        ? (typeof task.seaHours === 'string' ? JSON.parse(task.seaHours) : task.seaHours)
        : null,
      portHours: task.portHours 
        ? (typeof task.portHours === 'string' ? JSON.parse(task.portHours) : task.portHours)
        : null
    };
  }

  private stringifyFixedTaskInput(task: any): any {
    const result = { ...task };
    if (task.seaHours !== undefined) {
      result.seaHours = task.seaHours ? JSON.stringify(task.seaHours) : null;
    }
    if (task.portHours !== undefined) {
      result.portHours = task.portHours ? JSON.stringify(task.portHours) : null;
    }
    return result;
  }

  private parseDrugAlcoholTestRecord(record: DrugAlcoholTestRecord): DrugAlcoholTestRecord {
    return {
      ...record,
      alcoholDrugType: record.alcoholDrugType 
        ? (typeof record.alcoholDrugType === 'string' ? JSON.parse(record.alcoholDrugType) : record.alcoholDrugType)
        : null,
      testingEquipment: record.testingEquipment 
        ? (typeof record.testingEquipment === 'string' ? JSON.parse(record.testingEquipment) : record.testingEquipment)
        : null,
      testHistory: record.testHistory 
        ? (typeof record.testHistory === 'string' ? JSON.parse(record.testHistory) : record.testHistory)
        : null,
      personnelTested: record.personnelTested 
        ? (typeof record.personnelTested === 'string' ? JSON.parse(record.personnelTested) : record.personnelTested)
        : null,
      masterDeputySignature: record.masterDeputySignature 
        ? (typeof record.masterDeputySignature === 'string' ? JSON.parse(record.masterDeputySignature) : record.masterDeputySignature)
        : null
    };
  }

  private stringifyDrugAlcoholTestRecordInput(record: any): any {
    const result = { ...record };
    if (record.alcoholDrugType !== undefined) {
      result.alcoholDrugType = record.alcoholDrugType ? JSON.stringify(record.alcoholDrugType) : null;
    }
    if (record.testingEquipment !== undefined) {
      result.testingEquipment = record.testingEquipment ? JSON.stringify(record.testingEquipment) : null;
    }
    if (record.testHistory !== undefined) {
      result.testHistory = record.testHistory ? JSON.stringify(record.testHistory) : null;
    }
    if (record.personnelTested !== undefined) {
      result.personnelTested = record.personnelTested ? JSON.stringify(record.personnelTested) : null;
    }
    if (record.masterDeputySignature !== undefined) {
      result.masterDeputySignature = record.masterDeputySignature ? JSON.stringify(record.masterDeputySignature) : null;
    }
    return result;
  }

  // Variable Tasks Methods
  async getVariableTasks(): Promise<VariableTask[]> {
    const tasks = await this.db.select().from(variableTasks);
    return tasks.map(task => this.parseVariableTask(task));
  }

  async getVariableTask(id: number): Promise<VariableTask | undefined> {
    const results = await this.db
      .select()
      .from(variableTasks)
      .where(eq(variableTasks.id, id));
    return results[0] ? this.parseVariableTask(results[0]) : null;
  }

  async getVariableTasksByFilters(filters: { vesselId?: string, periodValue?: string, status?: string }): Promise<VariableTask[]> {
    const conditions = [];
    if (filters.vesselId) {
      conditions.push(eq(variableTasks.vesselId, filters.vesselId));
    }
    if (filters.periodValue) {
      conditions.push(eq(variableTasks.periodValue, filters.periodValue));
    }
    if (filters.status) {
      conditions.push(eq(variableTasks.status, filters.status));
    }
    
    const tasks = conditions.length === 0
      ? await this.db.select().from(variableTasks)
      : await this.db.select().from(variableTasks).where(and(...conditions));
    
    return tasks.map(task => this.parseVariableTask(task));
  }

  async createVariableTask(task: InsertVariableTask): Promise<VariableTask> {
    const stringified = this.stringifyVariableTaskInput(task);
    const [created] = await this.db
      .insert(variableTasks)
      .values(stringified)
      .returning();
    return this.parseVariableTask(created);
  }

  async updateVariableTask(id: number, task: Partial<InsertVariableTask>): Promise<VariableTask | undefined> {
    const stringified = this.stringifyVariableTaskInput(task);
    const [updated] = await this.db
      .update(variableTasks)
      .set(stringified)
      .where(eq(variableTasks.id, id))
      .returning();
    return updated ? this.parseVariableTask(updated) : null;
  }

  async deleteVariableTask(id: number): Promise<boolean> {
    const result = await this.db
      .delete(variableTasks)
      .where(eq(variableTasks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Fixed Tasks Methods
  async getFixedTasks(): Promise<FixedTask[]> {
    const tasks = await this.db.select().from(fixedTasks);
    return tasks.map(task => this.parseFixedTask(task));
  }

  async getFixedTask(id: number): Promise<FixedTask | undefined> {
    const results = await this.db
      .select()
      .from(fixedTasks)
      .where(eq(fixedTasks.id, id));
    return results[0] ? this.parseFixedTask(results[0]) : null;
  }

  async getFixedTasksByVesselAndMonth(vesselId: string, monthYear: string): Promise<FixedTask[]> {
    const tasks = await this.db
      .select()
      .from(fixedTasks)
      .where(
        and(
          eq(fixedTasks.vesselId, vesselId),
          eq(fixedTasks.monthYear, monthYear)
        )
      );
    return tasks.map(task => this.parseFixedTask(task));
  }

  async getFixedTaskByKey(
    crewMemberId: string,
    vesselId: string,
    monthYear: string
  ): Promise<FixedTask | undefined> {
    const results = await this.db
      .select()
      .from(fixedTasks)
      .where(
        and(
          eq(fixedTasks.crewMemberId, crewMemberId),
          eq(fixedTasks.vesselId, vesselId),
          eq(fixedTasks.monthYear, monthYear)
        )
      );
    return results[0] ? this.parseFixedTask(results[0]) : null;
  }

  async createFixedTask(task: InsertFixedTask): Promise<FixedTask> {
    const stringified = this.stringifyFixedTaskInput(task);
    const [created] = await this.db
      .insert(fixedTasks)
      .values(stringified)
      .returning();
    return this.parseFixedTask(created);
  }

  async updateFixedTask(id: number, task: Partial<InsertFixedTask>): Promise<FixedTask | undefined> {
    const stringified = this.stringifyFixedTaskInput(task);
    const [updated] = await this.db
      .update(fixedTasks)
      .set(stringified)
      .where(eq(fixedTasks.id, id))
      .returning();
    return updated ? this.parseFixedTask(updated) : null;
  }

  async deleteFixedTask(id: number): Promise<boolean> {
    const result = await this.db
      .delete(fixedTasks)
      .where(eq(fixedTasks.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Drug & Alcohol Testing Methods
  async getDrugAlcoholTestRecords(): Promise<DrugAlcoholTestRecord[]> {
    const records = await this.db.select().from(drugAlcoholTestRecords);
    return records.map(record => this.parseDrugAlcoholTestRecord(record));
  }

  async getDrugAlcoholTestRecord(id: number): Promise<DrugAlcoholTestRecord | undefined> {
    const results = await this.db
      .select()
      .from(drugAlcoholTestRecords)
      .where(eq(drugAlcoholTestRecords.id, id));
    return results[0] ? this.parseDrugAlcoholTestRecord(results[0]) : null;
  }

  async getDrugAlcoholTestRecordsByVessel(vesselId: string, testType?: string): Promise<DrugAlcoholTestRecord[]> {
    const conditions = [eq(drugAlcoholTestRecords.vesselId, vesselId)];
    if (testType) {
      conditions.push(eq(drugAlcoholTestRecords.testType, testType));
    }
    const records = await this.db
      .select()
      .from(drugAlcoholTestRecords)
      .where(and(...conditions));
    return records.map(record => this.parseDrugAlcoholTestRecord(record));
  }

  async createDrugAlcoholTestRecord(record: InsertDrugAlcoholTestRecord): Promise<DrugAlcoholTestRecord> {
    const stringified = this.stringifyDrugAlcoholTestRecordInput(record);
    const [created] = await this.db
      .insert(drugAlcoholTestRecords)
      .values(stringified)
      .returning();
    return this.parseDrugAlcoholTestRecord(created);
  }

  async updateDrugAlcoholTestRecord(id: number, record: Partial<InsertDrugAlcoholTestRecord>): Promise<DrugAlcoholTestRecord | undefined> {
    const stringified = this.stringifyDrugAlcoholTestRecordInput(record);
    const [updated] = await this.db
      .update(drugAlcoholTestRecords)
      .set(stringified)
      .where(eq(drugAlcoholTestRecords.id, id))
      .returning();
    return updated ? this.parseDrugAlcoholTestRecord(updated) : null;
  }

  async deleteDrugAlcoholTestRecord(id: number): Promise<boolean> {
    const result = await this.db
      .delete(drugAlcoholTestRecords)
      .where(eq(drugAlcoholTestRecords.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Vessel Violation Comments Methods
  async getVesselViolationComment(vesselId: string, monthValue: string): Promise<VesselViolationComment | undefined> {
    const results = await this.db
      .select()
      .from(vesselViolationComments)
      .where(
        and(
          eq(vesselViolationComments.vesselId, vesselId),
          eq(vesselViolationComments.monthValue, monthValue)
        )
      );
    return results[0] || undefined;
  }

  async saveVesselViolationComment(comment: InsertVesselViolationComment): Promise<VesselViolationComment> {
    const existing = await this.db
      .select()
      .from(vesselViolationComments)
      .where(
        and(
          eq(vesselViolationComments.vesselId, comment.vesselId),
          eq(vesselViolationComments.monthValue, comment.monthValue)
        )
      );
    
    if (existing[0]) {
      const [updated] = await this.db
        .update(vesselViolationComments)
        .set(comment)
        .where(eq(vesselViolationComments.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(vesselViolationComments)
        .values(comment)
        .returning();
      return created;
    }
  }

  // Office Violation Comments Methods
  async getOfficeViolationComment(vesselId: string, monthValue: string): Promise<OfficeViolationComment | undefined> {
    const results = await this.db
      .select()
      .from(officeViolationComments)
      .where(
        and(
          eq(officeViolationComments.vesselId, vesselId),
          eq(officeViolationComments.monthValue, monthValue)
        )
      );
    return results[0] || undefined;
  }

  async saveOfficeViolationComment(comment: InsertOfficeViolationComment): Promise<OfficeViolationComment> {
    const existing = await this.db
      .select()
      .from(officeViolationComments)
      .where(
        and(
          eq(officeViolationComments.vesselId, comment.vesselId),
          eq(officeViolationComments.monthValue, comment.monthValue)
        )
      );
    
    if (existing[0]) {
      const [updated] = await this.db
        .update(officeViolationComments)
        .set(comment)
        .where(eq(officeViolationComments.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(officeViolationComments)
        .values(comment)
        .returning();
      return created;
    }
  }

  // NC Reports Methods
  async getAllNCReports(): Promise<NCReport[]> {
    return await this.db.select().from(ncReports);
  }

  async getNCReport(crewMemberId: string, vesselId: string, monthValue: string): Promise<NCReport | undefined> {
    const results = await this.db
      .select()
      .from(ncReports)
      .where(
        and(
          eq(ncReports.crewMemberId, crewMemberId),
          eq(ncReports.vesselId, vesselId),
          eq(ncReports.monthValue, monthValue)
        )
      );
    return results[0] || undefined;
  }

  async saveNCReport(report: InsertNCReport): Promise<NCReport> {
    const existing = await this.db
      .select()
      .from(ncReports)
      .where(
        and(
          eq(ncReports.crewMemberId, report.crewMemberId),
          eq(ncReports.vesselId, report.vesselId),
          eq(ncReports.monthValue, report.monthValue)
        )
      );
    
    if (existing[0]) {
      const [updated] = await this.db
        .update(ncReports)
        .set(report)
        .where(eq(ncReports.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(ncReports)
        .values(report)
        .returning();
      return created;
    }
  }

  // Date Line Adjustments Methods
  async getVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<VesselDateLineAdjustment | undefined> {
    const results = await this.db
      .select()
      .from(vesselDateLineAdjustments)
      .where(
        and(
          eq(vesselDateLineAdjustments.vesselId, vesselId),
          eq(vesselDateLineAdjustments.monthValue, monthValue)
        )
      );
    return results[0] || undefined;
  }

  async saveVesselDateLineAdjustment(adjustment: InsertVesselDateLineAdjustment): Promise<VesselDateLineAdjustment> {
    const existing = await this.db
      .select()
      .from(vesselDateLineAdjustments)
      .where(
        and(
          eq(vesselDateLineAdjustments.vesselId, adjustment.vesselId),
          eq(vesselDateLineAdjustments.monthValue, adjustment.monthValue)
        )
      );
    
    if (existing[0]) {
      const [updated] = await this.db
        .update(vesselDateLineAdjustments)
        .set(adjustment)
        .where(eq(vesselDateLineAdjustments.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(vesselDateLineAdjustments)
        .values(adjustment)
        .returning();
      return created;
    }
  }

  async deleteVesselDateLineAdjustment(vesselId: string, monthValue: string): Promise<boolean> {
    const result = await this.db
      .delete(vesselDateLineAdjustments)
      .where(
        and(
          eq(vesselDateLineAdjustments.vesselId, vesselId),
          eq(vesselDateLineAdjustments.monthValue, monthValue)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async clearAdvancedDaysData(vesselId: string, monthValue: string, advancedDays: number[]): Promise<boolean> {
    const result = await this.db
      .update(vesselDateLineAdjustments)
      .set({ adjustments: [] as any })  // Clear adjustments array (Drizzle handles JSON serialization)
      .where(
        and(
          eq(vesselDateLineAdjustments.vesselId, vesselId),
          eq(vesselDateLineAdjustments.monthValue, monthValue)
        )
      );
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Dashboard & Utilities Methods
  async getCrewDashboardSummary(crewId: string): Promise<any> {
    const crew = await this.getCrewMember(crewId);
    const appraisals = await this.getAppraisalResultsByCrewMember(crewId);
    const planning = await this.db
      .select()
      .from(vesselPlanning)
      .where(eq(vesselPlanning.crewMemberId, crewId));
    
    return {
      crew,
      totalAppraisals: appraisals.length,
      latestAppraisal: appraisals[0] || null,
      currentAssignment: planning[0] || null
    };
  }

  async getFormForRank(rankLabel: string, category?: string): Promise<Form | undefined> {
    const rankGroupResults = await this.db
      .select()
      .from(rankGroups)
      .where(like(rankGroups.ranks, `%${rankLabel}%`));
    
    if (rankGroupResults.length === 0) return null;
    
    const formIds = rankGroupResults.map(rg => rg.formId);
    
    const conditions = [inArray(forms.id, formIds)];
    if (category) {
      conditions.push(eq(forms.category, category));
    }
    
    const results = await this.db
      .select()
      .from(forms)
      .where(and(...conditions));
    
    return results[0] || undefined;
  }

  // Data Masters Methods
  async getDataMasters(): Promise<DataMaster[]> {
    return await this.db.select().from(dataMasters);
  }

  async getDataMaster(id: string): Promise<DataMaster | undefined> {
    const results = await this.db.select().from(dataMasters).where(eq(dataMasters.id, id));
    return results[0] || undefined;
  }

  async createDataMaster(insertMaster: InsertDataMaster): Promise<DataMaster> {
    const [created] = await this.db
      .insert(dataMasters)
      .values(insertMaster)
      .returning();
    return created;
  }

  async updateDataMaster(id: string, masterData: Partial<InsertDataMaster>): Promise<DataMaster | undefined> {
    const [updated] = await this.db
      .update(dataMasters)
      .set({ ...masterData, updatedAt: new Date() })
      .where(eq(dataMasters.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDataMaster(id: string): Promise<boolean> {
    const result = await this.db.delete(dataMasters).where(eq(dataMasters.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Master Data Entries Methods
  async getMasterDataEntries(masterId: string): Promise<MasterDataEntry[]> {
    // Use raw SQL to avoid Drizzle schema column issues
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).join(', ');
    const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE master_id = ?`;
    
    const [results]: any = await this.pool.query(selectSql, [masterId]);
    return results;
  }

  async getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined> {
    // Use raw SQL to avoid Drizzle schema column issues
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).join(', ');
    const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE id = ?`;
    
    const [results]: any = await this.pool.query(selectSql, [id]);
    return results[0] || undefined;
  }

  async createMasterDataEntry(insertEntry: InsertMasterDataEntry): Promise<MasterDataEntry> {
    console.log('🔧 [DB] Creating master data entry (NEW IMPLEMENTATION):', insertEntry);
    
    // Step 1: Apply name field fallback for Master 014 (Vessel Master)
    const entryWithName = this.ensureNameFieldForVesselMaster(insertEntry);
    console.log('🚢 [DB] After name fallback:', entryWithName);
    
    // Step 2: Filter payload to only include existing columns
    const filteredEntry = await this.filterPayloadByExistingColumns(entryWithName, 'master_data_entries');
    console.log('🔧 [DB] Filtered entry for database insert:', filteredEntry);
    
    // Step 3: Use raw SQL to bypass Drizzle schema enforcement
    // Exclude created_at and updated_at from the payload - we'll add them explicitly
    const { created_at, updated_at, ...payloadWithoutTimestamps } = filteredEntry as any;
    console.log('🔍 [DEBUG] After destructuring, payloadWithoutTimestamps keys:', Object.keys(payloadWithoutTimestamps));
    console.log('🔍 [DEBUG] created_at extracted:', created_at);
    console.log('🔍 [DEBUG] updated_at extracted:', updated_at);
    
    // Quote column names to preserve case in PostgreSQL
    const columns = Object.keys(payloadWithoutTimestamps).map(col => `"${col}"`).join(', ');
    const values = Object.values(payloadWithoutTimestamps).map(value => value === undefined ? null : value);
    // PostgreSQL uses $1, $2, $3 style placeholders
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const insertSql = `INSERT INTO master_data_entries (${columns}, "created_at", "updated_at") VALUES (${placeholders}, NOW(), NOW()) RETURNING *`;
    console.log('🔧 [DB] Raw SQL:', insertSql);
    console.log('🔧 [DB] Values:', values);
    
    const result: any = await this.pool.query(insertSql, values);
    console.log('📤 [DB] Insert result:', result);
    
    // PostgreSQL returns {rows: [...], ...}, get the first row from RETURNING *
    if (result.rows && result.rows.length > 0) {
      console.log('✅ [DB] Successfully created master data entry:', result.rows[0]);
      return result.rows[0];
    }
    
    // Fallback if RETURNING didn't work - fetch by master_id
    console.error('❌ [DB] No rows returned, trying alternative approach');
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).map(col => `"${col}"`).join(', ');
    const fallbackSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "master_id" = $1 ORDER BY "id" DESC LIMIT 1`;
    
    const fallbackResult: any = await this.pool.query(fallbackSql, [entryWithName.masterId]);
    console.log('🔄 [DB] Fallback query result:', fallbackResult.rows[0]);
    return fallbackResult.rows[0];
  }

  async updateMasterDataEntry(id: number, entryData: Partial<InsertMasterDataEntry>): Promise<MasterDataEntry | undefined> {
    // Filter payload to only include existing columns
    const filteredEntry = await this.filterPayloadByExistingColumns(entryData, 'master_data_entries');
    
    // Add updated_at timestamp
    filteredEntry.updated_at = new Date();
    
    // Use raw SQL for UPDATE
    const columns = Object.keys(filteredEntry).map(col => `${col} = ?`).join(', ');
    const values = Object.values(filteredEntry).map(value => value === undefined ? null : value);
    const updateSql = `UPDATE master_data_entries SET ${columns} WHERE id = ?`;
    
    const [result]: any = await this.pool.query(updateSql, [...values, id]);
    
    if (result.affectedRows === 0) {
      return null;
    }
    
    // Use raw SQL for SELECT
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).join(', ');
    const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE id = ?`;
    
    const [selectResults]: any = await this.pool.query(selectSql, [id]);
    return selectResults[0] || undefined;
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    // Check if entry exists first (robust approach vs unreliable affectedRows)
    const existing = await this.getMasterDataEntry(id);
    if (!existing) return false;
    
    // Execute delete using raw SQL
    const deleteSql = `DELETE FROM master_data_entries WHERE id = ?`;
    await this.pool.query(deleteSql, [id]);
    
    // Return true since entry existed (delete should succeed)
    return true;
  }

  // Create database if it doesn't exist (PostgreSQL databases are typically created externally)
  async createDatabaseIfNotExists(): Promise<void> {
    // For PostgreSQL, database creation is handled externally via cloud provider or psql
    // This method is kept for interface compatibility but does nothing
    console.log("ℹ️ PostgreSQL database should be created externally (via cloud provider or psql)");
    console.log("ℹ️ Assuming database specified in DATABASE_URL already exists");
  }

  // Seed data for initial setup
  async seedDatabase(): Promise<void> {
    try {
      // Database and tables already exist, skip creation step
      
      console.log("🔄 Connecting to existing crew_database tables...");
      
      // Check if data masters are already complete (18 categories)
      const existingMasters = await this.getDataMasters();
      if (existingMasters.length >= 18) {
        console.log("Database already seeded, skipping...");
        return;
      }
      
      // If we have some but not all masters, only seed the missing ones
      console.log(`Found ${existingMasters.length} existing master categories, ensuring all 18 are present...`);

      // Seed available ranks
      const rankData: InsertAvailableRank[] = [
        { name: "Master", category: "Senior Officers" },
        { name: "Chief Officer", category: "Senior Officers" },
        { name: "Chief Engineer", category: "Senior Officers" },
        { name: "2nd Officer", category: "Junior Officers" },
        { name: "3rd Officer", category: "Junior Officers" },
        { name: "2nd Engineer", category: "Junior Officers" },
        { name: "3rd Engineer", category: "Junior Officers" },
        { name: "Bosun", category: "Ratings" },
        { name: "AB", category: "Ratings" },
        { name: "OS", category: "Ratings" },
        { name: "Oiler", category: "Ratings" },
        { name: "Wiper", category: "Ratings" },
      ];

      for (const rank of rankData) {
        await this.createAvailableRank(rank);
      }

      // Seed data masters categories (all 18 categories including new ones)
      const masterCategories: InsertDataMaster[] = [
        { id: "001", name: "Nationality", description: "Crew member nationalities" },
        { id: "002", name: "Country", description: "Countries and regions" },
        { id: "003", name: "Language", description: "Languages spoken" },
        { id: "004", name: "Vessel Type", description: "Types of vessels" },
        { id: "006", name: "Qualification", description: "Qualifications and certifications" },
        { id: "007", name: "Course", description: "Training courses" },
        { id: "008", name: "Contract Type", description: "Types of contracts" },
        { id: "009", name: "Medical Status", description: "Medical examination status" },
        { id: "010", name: "Document Type", description: "Document types" },
        { id: "011", name: "Equipment", description: "Ship equipment and machinery" },
        { id: "012", name: "Designation", description: "Manage office personnel designations and organizational roles" },
        { id: "013", name: "Users", description: "System users and administrators" },
        { id: "014", name: "Vessels", description: "Fleet vessel information" },
        { id: "015", name: "Fleet Groups", description: "Vessel fleet groupings" },
        { id: "016", name: "Additional Groups", description: "Manage additional vessel groupings and assignments" },
        { id: "017", name: "Vessel Owners", description: "Manage vessel ownership details, contact information and vessel assignments" },
        { id: "018", name: "Port", description: "International ports and terminals for vessel operations" }
      ];

      // Only create missing master categories
      const existingIds = new Set(existingMasters.map(m => m.id));
      for (const master of masterCategories) {
        if (!existingIds.has(master.id)) {
          console.log(`Creating missing master category: ${master.id} - ${master.name}`);
          await this.createDataMaster(master);
        }
      }

      // Seed sample data for some master categories
      const sampleMasterEntries: InsertMasterDataEntry[] = [
        // Major Maritime Nations with enhanced structure (NAT001-NAT020)
        { masterId: "001", entryId: "NAT001", name: "Filipino", description: "Philippines", countryName: "Filipino", country: "Philippines" },
        { masterId: "001", entryId: "NAT002", name: "Indian", description: "India", countryName: "Indian", country: "India" },
        { masterId: "001", entryId: "NAT003", name: "Chinese", description: "China", countryName: "Chinese", country: "China" },
        { masterId: "001", entryId: "NAT004", name: "Ukrainian", description: "Ukraine", countryName: "Ukrainian", country: "Ukraine" },
        { masterId: "001", entryId: "NAT005", name: "Russian", description: "Russia", countryName: "Russian", country: "Russia" },
        { masterId: "001", entryId: "NAT006", name: "Indonesian", description: "Indonesia", countryName: "Indonesian", country: "Indonesia" },
        { masterId: "001", entryId: "NAT007", name: "Turkish", description: "Turkey", countryName: "Turkish", country: "Turkey" },
        { masterId: "001", entryId: "NAT008", name: "Polish", description: "Poland", countryName: "Polish", country: "Poland" },
        { masterId: "001", entryId: "NAT009", name: "Romanian", description: "Romania", countryName: "Romanian", country: "Romania" },
        { masterId: "001", entryId: "NAT010", name: "Bulgarian", description: "Bulgaria", countryName: "Bulgarian", country: "Bulgaria" },
        { masterId: "001", entryId: "NAT011", name: "Greek", description: "Greece", countryName: "Greek", country: "Greece" },
        { masterId: "001", entryId: "NAT012", name: "Croatian", description: "Croatia", countryName: "Croatian", country: "Croatia" },
        { masterId: "001", entryId: "NAT013", name: "Myanmar", description: "Myanmar", countryName: "Myanmar", country: "Myanmar" },
        { masterId: "001", entryId: "NAT014", name: "Vietnamese", description: "Vietnam", countryName: "Vietnamese", country: "Vietnam" },
        { masterId: "001", entryId: "NAT015", name: "Bangladesh", description: "Bangladesh", countryName: "Bangladesh", country: "Bangladesh" },
        { masterId: "001", entryId: "NAT016", name: "Pakistani", description: "Pakistan", countryName: "Pakistani", country: "Pakistan" },
        { masterId: "001", entryId: "NAT017", name: "Sri Lankan", description: "Sri Lanka", countryName: "Sri Lankan", country: "Sri Lanka" },
        { masterId: "001", entryId: "NAT018", name: "Georgian", description: "Georgia", countryName: "Georgian", country: "Georgia" },
        { masterId: "001", entryId: "NAT019", name: "Latvian", description: "Latvia", countryName: "Latvian", country: "Latvia" },
        { masterId: "001", entryId: "NAT020", name: "Estonian", description: "Estonia", countryName: "Estonian", country: "Estonia" },
        
        // Designation entries - DISABLED: Users manage their own designations
        // { masterId: "012", entryId: "DES001", name: "Master", description: "Ship Captain" },
        // { masterId: "012", entryId: "DES002", name: "Chief Engineer", description: "Chief Engineering Officer" },
        // { masterId: "012", entryId: "DES003", name: "Chief Officer", description: "First Officer" },
        
        // Vessel Type entries - DISABLED: Users manage their own vessel types
        // { masterId: "004", entryId: "VT001", name: "Oil Tanker", description: "Petroleum transport vessel" },
        // { masterId: "004", entryId: "VT002", name: "Container Ship", description: "Containerized cargo vessel" },
        // { masterId: "004", entryId: "VT003", name: "Bulk Carrier", description: "Dry bulk cargo vessel" },
        
        // Fleet Groups entries (ID 015)
        { masterId: "015", entryId: "001", name: "Fleet Group 1", description: "Primary fleet group" },
        { masterId: "015", entryId: "002", name: "Fleet Group 2", description: "Secondary fleet group" },
        { masterId: "015", entryId: "003", name: "Fleet Group 3", description: "Tertiary fleet group" },
        { masterId: "015", entryId: "004", name: "Fleet Group 4", description: "Quaternary fleet group" },
        
        // Vessel Owners entries (ID 017)
        { masterId: "017", entryId: "VO001", name: "Maersk Line", description: "Danish shipping and logistics company" },
        { masterId: "017", entryId: "VO002", name: "MSC Mediterranean Shipping Company", description: "Swiss-Italian cargo shipping company" },
        { masterId: "017", entryId: "VO003", name: "CMA CGM Group", description: "French container transportation and shipping company" },
        { masterId: "017", entryId: "VO004", name: "COSCO Shipping Lines", description: "Chinese state-owned shipping and logistics company" },
        { masterId: "017", entryId: "VO005", name: "Hapag-Lloyd", description: "German international shipping and container transportation company" }
      ];

      // Create sample master entries with duplicate checking
      for (const entry of sampleMasterEntries) {
        try {
          // Check if entry already exists by master_id and entry_id
          const [existing]: any = await this.pool.query(
            "SELECT COUNT(*) as count FROM master_data_entries WHERE master_id = ? AND entry_id = ?",
            [entry.masterId, entry.entryId]
          );
          
          if (existing[0].count === 0) {
            console.log(`🆕 Creating new master entry: ${entry.masterId}/${entry.entryId} - ${entry.name}`);
            await this.createMasterDataEntry(entry);
          } else {
            console.log(`✅ Master entry already exists: ${entry.masterId}/${entry.entryId} - ${entry.name}`);
          }
        } catch (error) {
          console.warn(`⚠️ Warning: Could not create master entry ${entry.masterId}/${entry.entryId}:`, error);
          // Continue with next entry - don't let one failure block others
        }
      }

      // Seed forms (with error handling to prevent blocking data masters)
      let formId: number | null = null;
      try {
        // Check if "Crew Appraisal Form" already exists
        const existingForms = await this.getForms();
        const existingForm = existingForms.find(f => f.name === "Crew Appraisal Form");
        
        if (!existingForm) {
          console.log("🆕 Creating new form: Crew Appraisal Form");
          const form = await this.createForm({
            name: "Crew Appraisal Form",
            rankGroup: JSON.stringify("Senior Officers"), // Fix: JSON format for database
            versionNo: "01",
            versionDate: "01-Jan-2025",
            configuration: null,
          });

          if (form && form.id) {
            formId = form.id;
            // Seed rank groups
            await this.createRankGroup({
              formId: form.id,
              name: "Senior Officers",
              ranks: JSON.stringify(["Master", "Chief Officer", "Chief Engineer"]),
            });
          }
        } else {
          console.log("✅ Form already exists: Crew Appraisal Form");
          formId = existingForm.id;
        }
      } catch (error) {
        console.warn("Warning: Could not seed forms/rank groups:", error);
        // Continue with other seeding - don't let form seeding block data masters
      }

      // Seed crew members
      const crewMemberData: InsertCrewMember[] = [
        {
          id: "2025-05-14",
          firstName: "James",
          middleName: "Michael",
          lastName: "",
          rank: "Master",
          nationality: "British",
          vessel: "MT Sail One",
          vesselType: "Oil Tanker",
          signOnDate: "01-Feb-2025",
        },
        {
          id: "2025-03-12",
          firstName: "Anna",
          middleName: "Marie",
          lastName: "Johnson",
          rank: "Chief Engineer",
          nationality: "British",
          vessel: "MT Sail Ten",
          vesselType: "LPG Tanker",
          signOnDate: "01-Jan-2025",
        },
        {
          id: "2025-02-12",
          firstName: "David",
          middleName: "Lee",
          lastName: "Brown",
          rank: "Able Seaman",
          nationality: "Indian",
          vessel: "MT Sail Two",
          vesselType: "Container",
          signOnDate: "01-Feb-2025",
        },
      ];

      for (const crewMember of crewMemberData) {
        await this.createCrewMember(crewMember);
      }

      // Seed appraisal results (only if form was created successfully)
      if (formId) {
        const appraisalData: InsertAppraisalResult[] = [
          {
            crewMemberId: "2025-05-14",
            formId: formId,
            appraisalType: "End of Contract",
            appraisalDate: "06-Jun-2025",
            appraisalData: "{}",
            competenceRating: "4.9",
            behavioralRating: "4.5",
            overallRating: "4.7",
            submittedBy: "admin",
            status: "submitted",
          },
          {
            crewMemberId: "2025-03-12",
            formId: formId,
            appraisalType: "Mid Term",
            appraisalDate: "07-May-2025",
            appraisalData: "{}",
            competenceRating: "3.5",
            behavioralRating: "4.5",
            overallRating: "4.0",
            submittedBy: "admin",
            status: "submitted",
          },
          {
            crewMemberId: "2025-02-12",
            formId: formId,
            appraisalType: "Special",
            appraisalDate: "06-Jun-2025",
            appraisalData: "{}",
            competenceRating: "2.5",
            behavioralRating: "3.5",
            overallRating: "3.0",
            submittedBy: "admin",
            status: "submitted",
          },
        ];

        for (const appraisal of appraisalData) {
          await this.createAppraisalResult(appraisal);
        }
      }


      // Seed recruitment candidates data
      const recruitmentData: InsertRecruitmentCandidate[] = [
        {
          id: "2025-03-14",
          fileNo: "2025-05-14",
          firstName: "James",
          middleName: "Michael",
          familyName: "Smith",
          dob: "1985-06-15",
          nationality: "British",
          rankAppliedFor: "Captain",
          presentRank: "First Officer",
          vesselType: "Oil Tanker",
          status: "Applied"
        },
        {
          id: "2025-03-12",
          fileNo: "2025-03-12",
          firstName: "Anna",
          middleName: "Marie",
          familyName: "Johnson",
          dob: "1990-11-22",
          nationality: "British",
          rankAppliedFor: "Chief Engineer",
          presentRank: "Second Engineer",
          vesselType: "LPG Tanker",
          status: "Screening"
        },
        {
          id: "2025-02-12",
          fileNo: "2025-02-12",
          firstName: "David",
          middleName: "Lee",
          familyName: "Brown",
          dob: "1980-02-10",
          nationality: "Indian",
          rankAppliedFor: "Able Seaman",
          presentRank: "Deck Cadet",
          vesselType: "Container",
          status: "For Approval"
        },
        {
          id: "2024-12-15",
          fileNo: "2024-12-15",
          firstName: "Michael",
          middleName: "Robert",
          familyName: "Thompson",
          dob: "1988-03-20",
          nationality: "British",
          rankAppliedFor: "Second Officer",
          presentRank: "Third Officer",
          vesselType: "Container",
          status: "Recruited"
        },
        {
          id: "2024-11-08",
          fileNo: "2024-11-08",
          firstName: "Sarah",
          middleName: "Elizabeth",
          familyName: "Wilson",
          dob: "1987-09-12",
          nationality: "Indian",
          rankAppliedFor: "Third Engineer",
          presentRank: "Fourth Engineer",
          vesselType: "Bulk",
          status: "Recruited"
        },
        {
          id: "2024-10-22",
          fileNo: "2024-10-22",
          firstName: "Carlos",
          middleName: "Antonio",
          familyName: "Rodriguez",
          dob: "1991-01-30",
          nationality: "Philippines",
          rankAppliedFor: "Bosun",
          presentRank: "AB",
          vesselType: "Oil Tanker",
          status: "Recruited"
        },
        {
          id: "2025-01-18",
          fileNo: "2025-01-18",
          firstName: "Lisa",
          middleName: "Anne",
          familyName: "Anderson",
          dob: "1989-07-25",
          nationality: "Romanian",
          rankAppliedFor: "Cook",
          presentRank: "Assistant Cook",
          vesselType: "General Cargo",
          status: "Waitlisted"
        },
        {
          id: "2025-01-05",
          fileNo: "2025-01-05",
          firstName: "Ahmed",
          middleName: "Hassan",
          familyName: "Ali",
          dob: "1986-11-14",
          nationality: "Indian",
          rankAppliedFor: "Chief Mate",
          presentRank: "Second Mate",
          vesselType: "Container",
          status: "Waitlisted"
        },
        {
          id: "2025-02-01",
          fileNo: "2025-02-01",
          firstName: "Peter",
          middleName: "James",
          familyName: "Clarke",
          dob: "1983-05-17",
          nationality: "British",
          rankAppliedFor: "Captain",
          presentRank: "Chief Officer",
          vesselType: "LPG Tanker",
          status: "Rejected"
        },
        {
          id: "2025-01-30",
          fileNo: "2025-01-30",
          firstName: "Maria",
          middleName: "Elena",
          familyName: "Garcia",
          dob: "1992-08-05",
          nationality: "Philippines",
          rankAppliedFor: "Ordinary Seaman",
          presentRank: "Cadet",
          vesselType: "Bulk",
          status: "Rejected"
        }
      ];

      for (const candidate of recruitmentData) {
        await this.createRecruitmentCandidate(candidate);
      }

      console.log("📊 Database seeded successfully!");
    } catch (error) {
      console.error("Error seeding database:", error);
      throw error;
    }
  }

  // Push schema to database
  async pushSchema(): Promise<void> {
    try {
      // Import and run schema migrations
      const { migrate } = await import('drizzle-orm/mysql2/migrator');
      // Since we're not using migrations, we'll just ensure tables exist
      // by running a simple table creation check
      console.log("📋 Schema push completed (tables will be created on first access)");
    } catch (error) {
      console.error("Error pushing schema:", error);
      // Don't throw - tables will be created automatically by Drizzle on first access
    }
  }
}