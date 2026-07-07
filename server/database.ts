import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DatabaseConnectionManager, createConnectionManager } from "./utils/dbConnectionManager";
import { 
  getReportingDate, 
  safeParseDate, 
  calculatePeriodMonths as calcPeriodMonths,
  isActiveSeaService,
  getSeaServiceFromDate,
  getSeaServiceToDate
} from "@shared/dateUtils";
//  import 'dotenv/config';
import { 
  forms,
  companyRanks,
  promotionHierarchies,
  crewMembers, 
  vesselPlanning,
  dataMasters,
  masterDataEntries,
  promotionReviews,
  type Form,
  type InsertForm,
  type CompanyRank,
  type InsertCompanyRank,
  type PromotionHierarchy,
  type CrewMember,
  type InsertCrewMember,
  type VesselPlanning,
  type InsertVesselPlanning,
  type DataMaster,
  type InsertDataMaster,
  type MasterDataEntry,
  type InsertMasterDataEntry,
  oilMajorRules,
  type OilMajorRules,
  type PromotionReview,
  type InsertPromotionReview,
  masterNationalities,
  masterVessels,
  masterVesselTypes,
  masterAdditionalGroups,
  masterPorts,
  masterLanguages,
  masterFleetGroups,
  masterCountries,
  masterUsers
} from "@shared/schema";
import { eq, desc, asc, sql, and, inArray, like, isNull, getTableName } from "drizzle-orm";
import { type IStorage } from "./storage";
import {
  alertPoliciesV2,
  alertEventsV2,
  alertDeliveriesV2,
  type AlertPolicyV2,
  type InsertAlertPolicyV2,
  type AlertEventV2,
  type InsertAlertEventV2,
  type AlertDeliveryV2,
  type InsertAlertDeliveryV2,
} from "../shared/v2/alerts/schema";

export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: Pool;
  private connectionManager: DatabaseConnectionManager;
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
      max: 15,                    // Reduced from 20 for better local PostgreSQL compatibility
      min: 2,                     // Minimum number of clients to keep open
      idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
      connectionTimeoutMillis: 5000, // Return error after 5 seconds if no connection
      allowExitOnIdle: true,      // Allow pool to close when idle (prevent connection leaks)
    });
    this.db = drizzle(this.pool);
    
    // Initialize connection manager with retry logic and request queuing
    this.connectionManager = createConnectionManager(this.pool, {
      maxConcurrent: 8,           // Limit concurrent operations to prevent pool exhaustion
      maxRetries: 3,              // Retry failed operations up to 3 times
      baseDelayMs: 100,           // Start with 100ms delay for retries
      maxDelayMs: 5000,           // Max 5 second delay between retries
      queueTimeoutMs: 30000,      // 30 second timeout for queued operations
    });
    
    console.log('🛡️ Database Connection Manager initialized with resilience features');
    
    // Ensure enhanced master data entries schema exists on startup (async, non-blocking)
    this.ensureMasterDataEntriesSchema().catch(err => 
      console.error("Schema migration failed:", err)
    );
  }

  async close() {
    await this.pool.end();
  }

  // Public accessor for migration scripts
  getDb() {
    return this.db;
  }

  // Public accessor for connection manager (for health checks and metrics)
  getConnectionManager(): DatabaseConnectionManager {
    return this.connectionManager;
  }


  private async getExistingColumns(tableName: string): Promise<Set<string>> {
    if (this.columnCache.has(tableName)) {
      return this.columnCache.get(tableName)!;
    }

    try {
      // Use connection manager with retry logic for resilient column fetching
      const result = await this.connectionManager.query<{ rows: { column_name: string }[] }>(
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

  private async ensureMasterDataEntriesSchema(): Promise<void> {
    // DISABLED: This method used MySQL syntax and is not needed for PostgreSQL
    // The PostgreSQL schema migration already includes all required columns
    console.log("✅ Schema migrations handled by Drizzle/PostgreSQL migrations");
    return;
  }

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


  async getRankGroups(formId?: number, includeArchived: boolean = false): Promise<any[]> {
    return [];
  }

  async getAvailableRanks(): Promise<any[]> {
    return [];
  }

  async getAvailableRank(id: number): Promise<any | undefined> {
    return undefined;
  }

  async createAvailableRank(insertAvailableRank: any): Promise<any> {
    throw new Error("Legacy v1 table dropped");
  }

  async updateAvailableRank(id: number, rankData: any): Promise<any | undefined> {
    throw new Error("Legacy v1 table dropped");
  }

  async deleteAvailableRank(id: number): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async clearAllAvailableRanks(): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async updateRankOrders(rankOrders: { id: number; sortOrder: number }[]): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async getCompanyRanks(): Promise<CompanyRank[]> {
    return await this.db.select().from(companyRanks);
  }


  async getCompanyRankByName(rankName: string): Promise<CompanyRank | undefined> {
    const result = await this.db.select().from(companyRanks).where(eq(companyRanks.rank, rankName));
    return result[0] || undefined;
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

  // Crew Member methods
  async getCrewMembers(filters?: {
    rank?: string;
    nationality?: string;
    status?: string;
    search?: string;
  }): Promise<CrewMember[]> {
    let query = this.db.select().from(crewMembers);
    
    // Apply filters if provided
    const conditions: any[] = [];
    
    if (filters?.rank) {
      conditions.push(eq(crewMembers.presentRank, filters.rank));
    }
    
    if (filters?.nationality) {
      conditions.push(eq(crewMembers.nationality, filters.nationality));
    }
    
    if (filters?.status) {
      conditions.push(eq(crewMembers.status, filters.status));
    }
    
    if (filters?.search) {
      // Case-insensitive search using raw SQL (Drizzle ORM struggles with LOWER + LIKE + OR)
      const searchPattern = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        sql`(LOWER("first_name") LIKE ${searchPattern} OR LOWER("family_name") LIKE ${searchPattern} OR LOWER("employee_id") LIKE ${searchPattern})`
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    const result = await this.db.select().from(crewMembers).where(eq(crewMembers.id, id));
    return result[0] || undefined;
  }

  async createCrewMember(insertCrewMember: InsertCrewMember): Promise<CrewMember> {
    // Ensure id is set (auto-generate if not provided)
    const dataWithId = {
      ...insertCrewMember,
      id: insertCrewMember.id || await this.getNextCrewId()
    };
    const [created] = await this.db.insert(crewMembers).values(dataWithId).returning();
    return created;
  }

  async updateCrewMember(id: string, crewMemberData: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    // Set updatedAt timestamp automatically on every update for sorting by latest edited
    const dataWithTimestamp = {
      ...crewMemberData,
      updatedAt: new Date()
    };
    const result = await this.db.update(crewMembers).set(dataWithTimestamp).where(eq(crewMembers.id, id)).returning();
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
      prefix = result.rows[0].prefix || 'A';
      format = result.rows[0].format || '0000';
    } else {
      // Initialize counter if it doesn't exist
      await this.pool.query(
        'INSERT INTO id_counters (counter_type, current_value, prefix, format) VALUES ($1, $2, $3, $4)',
        ['crew_id', 0, 'A', '0000']
      );
    }
    
    let nextValue = currentValue + 1;
    let nextPrefix = prefix;
    
    // Standard format: Alphabet + 4 digits (A0001 → A9999 → B0001 → B9999 → C0001...)
    const maxValue = 9999;
    
    // Check if we need to roll over to next letter
    if (nextValue > maxValue) {
      nextValue = 1; // Reset to 1 (not 0, so first ID is X0001)
      // Increment the prefix letter (A → B → C ... → Z)
      const nextCharCode = prefix.charCodeAt(0) + 1;
      if (nextCharCode > 90) { // 'Z' is 90
        // Exceeded Z, could extend to AA, AB... but for now throw error
        throw new Error('Crew ID sequence exhausted (reached Z9999). Contact administrator.');
      }
      nextPrefix = String.fromCharCode(nextCharCode);
    }
    
    // Update counter with new value and possibly new prefix
    await this.pool.query(
      'UPDATE id_counters SET current_value = $1, prefix = $2, updated_at = NOW() WHERE counter_type = $3',
      [nextValue, nextPrefix, 'crew_id']
    );
    
    // Use the format length to determine padding (default 4 digits)
    const paddingLength = format.length;
    return `${nextPrefix}${nextValue.toString().padStart(paddingLength, '0')}`;
  }

  async getAppraisalResultsByCrewMember(crewMemberId: string): Promise<any[]> {
    return [];
  }

  async getVesselRevisionsByVessel(vesselId: string): Promise<any[]> {
    return [];
  }

  async getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]> {
    return await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.vesselId, vesselId));
  }

  async getVesselPlanningByCrewMember(crewMemberId: string): Promise<VesselPlanning[]> {
    return await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.crewMemberId, crewMemberId));
  }

  async getVesselPlanningAsReliever(crewMemberId: string): Promise<VesselPlanning[]> {
    return await this.db.select().from(vesselPlanning).where(eq(vesselPlanning.relieverCrewId, crewMemberId));
  }


  async getAllVesselPlanning(): Promise<VesselPlanning[]> {
    return await this.db.select().from(vesselPlanning);
  }

  async createVesselPlanning(planning: InsertVesselPlanning): Promise<VesselPlanning> {
    const [created] = await this.db.insert(vesselPlanning).values(planning).returning();
    return created;
  }

  async updateVesselPlanning(id: number, planning: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined> {
    const result = await this.db.update(vesselPlanning).set(planning).where(eq(vesselPlanning.id, id)).returning();
    return result[0] || undefined;
  }

  // Dashboard & Utilities Methods
  
  // Tanker vessel types for experience calculation
  private readonly TANKER_VESSEL_TYPES = [
    'Oil Tanker',
    'Chemical Tanker', 
    'Gas Tanker',
    'LPG Tanker',
    'LNG Tanker',
    'Product Oil Tanker',
    'Crude Oil Tanker',
    'Bitumen/Asphalt Carriers',
    'Oil Chemical Tanker',
    'Shuttle Tankers'
  ];

  // Officer rank names for OOW calculation (fallback when category not available)
  private readonly OFFICER_RANK_NAMES = [
    'Master', 'Captain',
    'Chief Officer', 'Chief Mate', 'C/O',
    '2nd Officer', 'Second Officer', '2/O',
    '3rd Officer', 'Third Officer', '3/O',
    'Chief Engineer', 'C/E',
    '2nd Engineer', 'Second Engineer', '2/E',
    '3rd Engineer', 'Third Engineer', '3/E',
    '4th Engineer', 'Fourth Engineer', '4/E',
    'Electrical Officer', 'E/O', 'ETO',
    'Radio Officer', 'R/O'
  ];

  private isTankerVesselType(vesselType: string): boolean {
    if (!vesselType) return false;
    const normalized = vesselType.trim().toLowerCase();
    
    // Keywords that indicate tanker vessels
    const tankerKeywords = ['tanker', 'oil', 'chemical', 'gas', 'lng', 'lpg', 'bitumen', 'asphalt', 'product'];
    
    // Check exact match first
    if (this.TANKER_VESSEL_TYPES.some(t => t.toLowerCase() === normalized)) {
      return true;
    }
    
    // Check keyword-based matching for variants like "Oil/Chemical Tanker", "Product Tanker", etc.
    return tankerKeywords.some(keyword => normalized.includes(keyword));
  }

  private isOfficerRank(rankName: string): boolean {
    if (!rankName) return false;
    const normalized = rankName.trim().toLowerCase();
    
    // Keywords that indicate officer ranks (excludes ratings like AB, Oiler, Fitter, Cook, Steward)
    const officerKeywords = ['officer', 'master', 'captain', 'engineer', 'mate', 'eto', 'e/o', 'r/o'];
    
    // Exclusion keywords for non-officer ratings that might have "officer" in title
    const ratingKeywords = ['petty', 'bosun', 'boatswain', 'able', 'ordinary', 'oiler', 'motorman', 'wiper', 
                            'fitter', 'cook', 'steward', 'messman', 'cadet', 'trainee', 'rating'];
    
    // Check exact match first
    if (this.OFFICER_RANK_NAMES.some(r => r.toLowerCase() === normalized)) {
      return true;
    }
    
    // Check if it's explicitly a rating (exclude)
    if (ratingKeywords.some(keyword => normalized.includes(keyword))) {
      return false;
    }
    
    // Check keyword-based matching for officer ranks
    return officerKeywords.some(keyword => normalized.includes(keyword));
  }

  private buildRankOrderMap(hierarchies: any[]): Map<string, number> {
    // Build a map of rank name -> hierarchy order (lower = more senior)
    // Each hierarchy's rankPath goes from junior to senior (e.g., 3rd Officer → 2nd Officer → Chief Officer → Master)
    // So last index = most senior, index 0 = most junior. We invert the index so seniors get the lowest order.
    const rankOrderMap = new Map<string, number>();
    
    for (const hierarchy of hierarchies) {
      if (!hierarchy.isActive) continue;
      
      let rankPath: string[] = [];
      try {
        // Parse rankPath if it's a JSON string
        rankPath = typeof hierarchy.rankPath === 'string' 
          ? JSON.parse(hierarchy.rankPath) 
          : hierarchy.rankPath;
      } catch (e) {
        continue;
      }
      
      if (!Array.isArray(rankPath)) continue;
      
      // Invert the index so most senior (last position) gets order 0, most junior gets the highest order
      const lastIndex = rankPath.length - 1;
      rankPath.forEach((rank, index) => {
        const normalizedRank = rank.trim().toLowerCase();
        const order = lastIndex - index;
        // Use the lowest order if rank appears in multiple hierarchies (more senior position wins)
        const currentOrder = rankOrderMap.get(normalizedRank);
        if (currentOrder === undefined || order < currentOrder) {
          rankOrderMap.set(normalizedRank, order);
        }
      });
    }
    
    return rankOrderMap;
  }

  private calculateRankExperience(
    companySeaService: any[],
    externalSeaService: any[],
    rankOrderMap?: Map<string, number>
  ): { rankExperience: Array<{ type: string; label: string; months: number; years: number }>; totalMonths: number } {
    // Ensure inputs are arrays
    const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
    const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
    const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
    
    // Aggregate months by rank
    const rankMonths: Record<string, number> = {};
    let totalMonths = 0;
    
    for (const service of allSeaService) {
      const period = parseFloat(service.periodMonths) || 0;
      if (period <= 0) continue;
      
      // Get rank name - only count if rank exists
      let rank = (service.rank || '').trim();
      if (!rank) continue;
      
      // Only add to total if rank exists (so totals match items)
      totalMonths += period;
      rankMonths[rank] = (rankMonths[rank] || 0) + period;
    }
    
    // Convert to array
    const rankExperience = Object.entries(rankMonths)
      .map(([rank, months]) => ({
        type: rank,
        label: rank,
        months,
        years: Math.round((months / 12) * 10) / 10
      }));
    
    // Sort by hierarchy order (senior first) if available, otherwise by months descending
    if (rankOrderMap && rankOrderMap.size > 0) {
      rankExperience.sort((a, b) => {
        const orderA = rankOrderMap.get(a.type.toLowerCase()) ?? -1;
        const orderB = rankOrderMap.get(b.type.toLowerCase()) ?? -1;
        
        // Both ranks in hierarchy: sort by hierarchy order (lower index = more senior = first)
        if (orderA >= 0 && orderB >= 0) {
          return orderA - orderB;
        }
        // Only one in hierarchy: prioritize the one in hierarchy
        if (orderA >= 0) return -1;
        if (orderB >= 0) return 1;
        // Neither in hierarchy: fall back to months descending
        return b.months - a.months;
      });
    } else {
      // No hierarchy: sort by months descending
      rankExperience.sort((a, b) => b.months - a.months);
    }
    
    return { rankExperience, totalMonths };
  }

  private calculateRankExperienceByVesselType(
    companySeaService: any[],
    externalSeaService: any[],
    currentRank: string
  ): Record<string, number> {
    const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
    const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
    const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
    
    // Normalize the current rank for comparison (handle variants like "3rd Officer_1", "Master(Temp)", etc.)
    const normalizeRankForComparison = (rank: string): string => {
      if (!rank) return '';
      return rank
        .replace(/_\d+$/, '')           // Remove numeric suffixes like "_1", "_2"
        .replace(/\(.*?\)$/, '')        // Remove parenthetical suffixes like "(Temp)", "(Acting)"
        .replace(/\s+/g, ' ')           // Normalize whitespace
        .trim()
        .toLowerCase();
    };
    
    const normalizedCurrentRank = normalizeRankForComparison(currentRank);
    if (!normalizedCurrentRank) return {};
    
    // Aggregate months by vessel type for entries matching the current rank
    const vesselTypeMonths: Record<string, number> = {};
    
    for (const service of allSeaService) {
      // Calculate period - use provided periodMonths or calculate from dates for active entries
      let period = parseFloat(service.periodMonths) || 0;
      
      // If periodMonths is empty/zero and this is an active entry (has from date), calculate dynamically
      if (period <= 0 && service.from) {
        const fromDate = new Date(service.from);
        // Sanitize 'to' date - treat empty strings as undefined (ongoing service)
        const toDateStr = (service.to || '').trim();
        const toDate = toDateStr ? new Date(toDateStr) : new Date(); // Use current date if no/empty end date
        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
          const diffMs = toDate.getTime() - fromDate.getTime();
          period = Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 30.44)); // Convert to months
        }
      }
      
      if (period <= 0) continue;
      
      // Check if the service is for the current rank (with improved normalization)
      const serviceRank = normalizeRankForComparison(service.rank || '');
      if (serviceRank !== normalizedCurrentRank) {
        continue;
      }
      
      // Get vessel type - check multiple possible field names used in various data feeds
      const vesselType = (
        service.vesselType || 
        service.shipType || 
        service.vessel_type || 
        service.vesselTypeName ||
        service.type ||
        ''
      ).trim();
      if (!vesselType) {
        continue;
      }
      
      // Use original vessel type as key (not normalized, so frontend can match against dropdown values)
      vesselTypeMonths[vesselType] = (vesselTypeMonths[vesselType] || 0) + period;
    }
    
    return vesselTypeMonths;
  }

  private calculateShipTypeExperience(
    companySeaService: any[],
    externalSeaService: any[]
  ): { shipTypeExperience: Array<{ type: string; label: string; months: number; years: number }>; totalMonths: number } {
    // Ensure inputs are arrays
    const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
    const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
    const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
    
    // Vessel type normalization map
    const vesselTypeNormalization: Record<string, string> = {
      'oil tanker': 'Oil Tkr',
      'product tanker': 'Oil Tkr', 
      'crude oil tanker': 'Oil Tkr',
      'chemical tanker': 'Ch Tkr',
      'oil/chemical tanker': 'Oil/Ch Tkr',
      'oil chemical tanker': 'Oil/Ch Tkr',
      'gas tanker': 'Gas Tkr',
      'lpg tanker': 'Gas Tkr',
      'lng tanker': 'Gas Tkr',
      'bulk carrier': 'Bulk',
      'dry bulk carrier': 'Bulk',
      'bulk': 'Bulk',
      'container ship': 'Container',
      'container': 'Container',
      'general cargo': 'Gen Cargo',
      'ro-ro': 'Ro-Ro',
      'roro': 'Ro-Ro',
      'offshore': 'Offshore',
      'tanker': 'Tanker'
    };
    
    // Aggregate months by normalized vessel type
    const typeMonths: Record<string, number> = {};
    let totalMonths = 0;
    
    for (const service of allSeaService) {
      const period = parseFloat(service.periodMonths) || 0;
      if (period <= 0) continue;
      
      totalMonths += period;
      
      // Normalize vessel type
      let vesselType = (service.vesselType || '').trim();
      if (!vesselType) continue;
      
      const normalizedType = vesselType.toLowerCase();
      let displayLabel: string = vesselTypeNormalization[normalizedType] || '';
      
      // If no exact match, try keyword matching
      if (!displayLabel) {
        if (normalizedType.includes('oil') && normalizedType.includes('chemical')) {
          displayLabel = 'Oil/Ch Tkr';
        } else if (normalizedType.includes('oil') || normalizedType.includes('product') || normalizedType.includes('crude')) {
          displayLabel = 'Oil Tkr';
        } else if (normalizedType.includes('chemical')) {
          displayLabel = 'Ch Tkr';
        } else if (normalizedType.includes('gas') || normalizedType.includes('lpg') || normalizedType.includes('lng')) {
          displayLabel = 'Gas Tkr';
        } else if (normalizedType.includes('bulk')) {
          displayLabel = 'Bulk';
        } else if (normalizedType.includes('container')) {
          displayLabel = 'Container';
        } else if (normalizedType.includes('tanker')) {
          displayLabel = 'Tanker';
        } else {
          displayLabel = vesselType; // Use original if no mapping
        }
      }
      
      typeMonths[displayLabel] = (typeMonths[displayLabel] || 0) + period;
    }
    
    // Convert to array and sort by months descending
    const shipTypeExperience = Object.entries(typeMonths)
      .map(([type, months]) => ({
        type,
        label: type,
        months,
        years: Math.round((months / 12) * 10) / 10
      }))
      .sort((a, b) => b.months - a.months);
    
    return { shipTypeExperience, totalMonths };
  }

  private calculateExperienceFromSeaService(
    companySeaService: any[],
    externalSeaService: any[],
    currentRank: string
  ): { company: number; rank: number; tankers: number; oow: number } {
    // Ensure inputs are arrays
    const safeCompanySeaService = Array.isArray(companySeaService) ? companySeaService : [];
    const safeExternalSeaService = Array.isArray(externalSeaService) ? externalSeaService : [];
    const allSeaService = [...safeCompanySeaService, ...safeExternalSeaService];
    
    // 1. Company (Yrs) - Calendar time from earliest E1 "from" date to today
    // Uses calendar difference from first company service date to present
    let companyYears = 0;
    if (safeCompanySeaService.length > 0) {
      const fromDates = safeCompanySeaService
        .map(s => getSeaServiceFromDate(s))
        .filter((d: any) => d && typeof d === 'string' && d.trim() !== '')
        .map((d: any) => new Date(d))
        .filter((d: any) => !isNaN(d.getTime()));
      
      if (fromDates.length > 0) {
        const earliestDate = new Date(Math.min(...fromDates.map((d: any) => d.getTime())));
        const today = new Date();
        const diffMs = today.getTime() - earliestDate.getTime();
        const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
        // Ensure any positive company tenure shows at least 0.1 years
        const roundedYears = Math.round(diffYears * 10) / 10;
        companyYears = diffYears > 0 ? Math.max(0.1, roundedYears) : 0;
      }
    }

    // Helper function to get period in months for a service record
    // Uses shared date utility with fallback to stored periodMonths for legacy records
    const getServicePeriodMonths = (service: any): number => {
      // Use helper to get start date - handles multiple key formats
      const fromStr = getSeaServiceFromDate(service);
      const from = safeParseDate(fromStr);
      if (!from) return 0;
      
      const isActive = isActiveSeaService(service);
      
      if (isActive) {
        // Active contracts: use shared reporting date (today)
        return calcPeriodMonths(from, getReportingDate());
      } else {
        // Use helper to get end date - handles multiple key formats
        const toStr = getSeaServiceToDate(service);
        const to = safeParseDate(toStr);
        if (to) {
          // Completed contracts with valid 'to' date: calculate period
          return calcPeriodMonths(from, to);
        } else {
          // Legacy completed records with no valid 'to' date: fallback to stored periodMonths
          return parseFloat(service.periodMonths) || 0;
        }
      }
    };

    // 2. Rank (Yrs) - Sum of Period(M) where rank = current rank / 12
    let rankMonths = 0;
    if (currentRank) {
      const normalizedCurrentRank = currentRank.trim().toLowerCase();
      for (const service of allSeaService) {
        if (service.rank && service.rank.trim().toLowerCase() === normalizedCurrentRank) {
          rankMonths += getServicePeriodMonths(service);
        }
      }
    }
    const rankYears = Math.round((rankMonths / 12) * 10) / 10;

    // 3. Tankers (Yrs) - Sum of Period(M) where vessel type is tanker / 12
    let tankerMonths = 0;
    for (const service of allSeaService) {
      if (this.isTankerVesselType(service.vesselType)) {
        tankerMonths += getServicePeriodMonths(service);
      }
    }
    const tankerYears = Math.round((tankerMonths / 12) * 10) / 10;

    // 4. OOW (Yrs) - Sum of Period(M) where rank is officer / 12
    let oowMonths = 0;
    for (const service of allSeaService) {
      if (this.isOfficerRank(service.rank)) {
        oowMonths += getServicePeriodMonths(service);
      }
    }
    const oowYears = Math.round((oowMonths / 12) * 10) / 10;

    return {
      company: companyYears,
      rank: rankYears,
      tankers: tankerYears,
      oow: oowYears
    };
  }

  private parseSeaServiceData(data: any): any[] {
    if (!data) return [];
    
    let parsed = data;
    
    // Handle double-stringified JSON (parse until we get an array or non-string)
    let attempts = 0;
    while (typeof parsed === 'string' && attempts < 3) {
      try {
        parsed = JSON.parse(parsed);
        attempts++;
      } catch (e) {
        return [];
      }
    }
    
    // Ensure result is an array
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    // Handle AG Grid wrapper objects like { rows: [...] } or { data: [...] }
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.rows)) return parsed.rows;
      if (Array.isArray(parsed.data)) return parsed.data;
    }
    
    return [];
  }

  private parseLicenseData(data: any): any[] {
    if (!data) return [];
    
    // If already an array, return it
    if (Array.isArray(data)) {
      return data;
    }
    
    let parsed = data;
    
    // Handle double-stringified JSON (parse until we get an array or non-string)
    let attempts = 0;
    while (typeof parsed === 'string' && attempts < 3) {
      try {
        parsed = JSON.parse(parsed);
        attempts++;
      } catch (e) {
        return [];
      }
    }
    
    // Ensure result is an array
    if (Array.isArray(parsed)) {
      return parsed;
    }
    
    return [];
  }

  /**
   * Derive endorsement code (O, C, G combinations) based on rank category and licenses held
   * 
   * Mapping by Rank Category:
   * - Senior Officers: L002 (DCE_Oil_Management) → O, L004 (DCE_Chem_Management) → C, L006 (DCE_Gas_Management) → G
   * - Other Officers: L001/L002 → O, L003/L004 → C, L005/L006 → G
   * - Ratings: LIC018 (DCE_Oil_Support) → O, LIC019 (DCE_Chem_Support) → C, LIC020 (DCE_Gas_Support) → G
   */
  private deriveEndorsementCode(
    rankFlags: { seniorOfficer?: boolean | null; officer?: boolean | null; rating?: boolean | null },
    licenses: Array<{ licenseType?: string; licenseId?: string; entryId?: string }>
  ): string {
    if (!licenses || licenses.length === 0) return '—';
    
    // Extract license IDs from the licenses array
    // Note: License records store their ID in 'licenseId' (from Master 016 template.id), or 'entryId'
    const licenseIds = new Set(
      licenses.map(lic => (lic.licenseId || lic.entryId || lic.licenseType || '').toUpperCase())
    );
    
    let hasO = false;
    let hasC = false;
    let hasG = false;
    
    if (rankFlags.seniorOfficer) {
      // Senior Officers - only Management level DCE
      hasO = licenseIds.has('L002') || licenseIds.has('LIC002');
      hasC = licenseIds.has('L004') || licenseIds.has('LIC004');
      hasG = licenseIds.has('L006') || licenseIds.has('LIC006');
    } else if (rankFlags.rating) {
      // Ratings - Support level DCE
      hasO = licenseIds.has('LIC018');
      hasC = licenseIds.has('LIC019');
      hasG = licenseIds.has('LIC020');
    } else if (rankFlags.officer) {
      // Other Officers (not Senior) - Operation OR Management level DCE
      hasO = licenseIds.has('L001') || licenseIds.has('L002') || licenseIds.has('LIC001') || licenseIds.has('LIC002');
      hasC = licenseIds.has('L003') || licenseIds.has('L004') || licenseIds.has('LIC003') || licenseIds.has('LIC004');
      hasG = licenseIds.has('L005') || licenseIds.has('L006') || licenseIds.has('LIC005') || licenseIds.has('LIC006');
    } else {
      // Default: treat as Other Officers (officer flag not explicitly set)
      hasO = licenseIds.has('L001') || licenseIds.has('L002') || licenseIds.has('LIC001') || licenseIds.has('LIC002');
      hasC = licenseIds.has('L003') || licenseIds.has('L004') || licenseIds.has('LIC003') || licenseIds.has('LIC004');
      hasG = licenseIds.has('L005') || licenseIds.has('L006') || licenseIds.has('LIC005') || licenseIds.has('LIC006');
    }
    
    // Build endorsement code string
    let code = '';
    if (hasO) code += 'O';
    if (hasC) code += 'C';
    if (hasG) code += 'G';
    
    return code || '—';
  }

  async getCrewDashboardSummary(crewId: string): Promise<any> {
    const crewMember = await this.getCrewMember(crewId);
    if (!crewMember) return undefined;

    const appraisals = await this.getAppraisalResultsByCrewMember(crewId);
    
    // Parse sea service data for experience calculations (handles double-stringified JSON)
    const companySeaService = this.parseSeaServiceData(crewMember.currentCompanySeaService);
    const externalSeaService = this.parseSeaServiceData(crewMember.externalSeaService);
    
    // Calculate experience from sea service data
    const currentRank = crewMember.presentRank || '';
    const experience = this.calculateExperienceFromSeaService(
      companySeaService,
      externalSeaService,
      currentRank
    );
    
    // Calculate ship type experience
    const shipTypeData = this.calculateShipTypeExperience(companySeaService, externalSeaService);
    
    // Fetch promotion hierarchies for rank ordering
    const hierarchies = await this.getPromotionHierarchies();
    const rankOrderMap = this.buildRankOrderMap(hierarchies);
    
    // Calculate rank experience (sorted by hierarchy order if available)
    const rankData = this.calculateRankExperience(companySeaService, externalSeaService, rankOrderMap);
    
    // Calculate rank experience by vessel type (for A2.3b promotion criteria)
    const rankExperienceByVesselType = this.calculateRankExperienceByVesselType(
      companySeaService,
      externalSeaService,
      currentRank
    );

    // Parse licenses for endorsement calculation (handles double-stringified JSON)
    const licenses = this.parseLicenseData(crewMember.licenses);
    
    // Get rank flags for endorsement derivation
    const rankFlags = await this.getCompanyRankByName(currentRank);
    const endorsementCode = this.deriveEndorsementCode(
      {
        seniorOfficer: rankFlags?.seniorOfficer,
        officer: rankFlags?.officer,
        rating: rankFlags?.rating
      },
      licenses
    );

    // Check vessel_planning for active vessel assignments
    // IMPORTANT: Filter out archived records - archived crew have been signed off and are not currently on board
    const allVesselPlanningEntries = await this.getVesselPlanningByCrewMember(crewId);
    const activeVesselPlanningEntries = allVesselPlanningEntries.filter((p: any) => !p.isArchived);
    const hasVesselAssignment = activeVesselPlanningEntries && activeVesselPlanningEntries.length > 0;
    
    // Find primary assignment if any (from non-archived records only)
    const primaryAssignment = hasVesselAssignment 
      ? activeVesselPlanningEntries.find((p: any) => 
          (p.crewStatus || 'primary').toLowerCase() === 'primary' || 
          (p.crewStatus || 'primary').toLowerCase() === 'p'
        ) || activeVesselPlanningEntries[0]
      : null;

    // Use unified status calculation logic
    const isActive = crewMember.isActive !== false; // Default to active if null/undefined
    const calculatedStatus = isActive 
      ? (hasVesselAssignment ? 'On Board' : 'On Leave') 
      : 'Inactive';
    
    // Get vessel name from vessel_planning or crew member record
    const vesselCode = primaryAssignment?.vesselId || crewMember.presentVessel || '';
    const vesselName = await this.translateVesselCodeToNameFromDb(vesselCode);
    
    // Get dates from vessel_planning or crew member record
    const joinedDate = primaryAssignment?.signOnDate || crewMember.signOnDate;
    const reliefDue = primaryAssignment?.reliefDue || crewMember.reliefDue;
    const joinedDateFormatted = this.formatDateForDashboard(joinedDate);
    const reliefDueFormatted = this.formatDateForDashboard(reliefDue);
    const nextAvailabilityFormatted = this.formatDateForDashboard(crewMember.nextAvailability);

    // Build vessel code to name map from master data for timeline translation
    const vesselCodeToNameMap = await this.getVesselCodeToNameMap();
    
    // Build reverse map: vessel name -> vessel code(s) for legacy appraisals
    const vesselNameToCodeMap = new Map<string, string>();
    for (const [code, name] of vesselCodeToNameMap.entries()) {
      vesselNameToCodeMap.set(name, code);
    }
    
    // Build service timeline from sea service and vessel planning
    // Key appraisals by both vessel name and vessel code to ensure lookups work after translation
    const appraisalsByVessel = new Map<string, number[]>();
    
    // Helper to add appraisal ID to a key in the map
    const addAppraisalToKey = (key: string, appraisalId: number) => {
      if (!key) return;
      if (!appraisalsByVessel.has(key)) {
        appraisalsByVessel.set(key, []);
      }
      const arr = appraisalsByVessel.get(key)!;
      // Avoid duplicates
      if (!arr.includes(appraisalId)) {
        arr.push(appraisalId);
      }
    };
    
    // Badge logic for appraisals will be implemented later
    // For now, appraisalsByVessel remains empty - badges are disabled
    // TODO: Implement appraisal-to-vessel matching based on user specification
    
    // Fetch records where this crew member is assigned as a reliever (for planned blue bars)
    const relieverPlanningRecords = await this.getVesselPlanningAsReliever(crewId);
    
    // Build the service timeline using buildServiceTimeline helper
    // Use ALL vessel planning entries (including archived) for historical timeline display
    const { buildServiceTimeline } = await import('./storage.js');
    const serviceTimeline = buildServiceTimeline(
      companySeaService,
      allVesselPlanningEntries,
      appraisalsByVessel,
      new Map(), // handovers - not yet implemented
      vesselCodeToNameMap,
      relieverPlanningRecords
    );

    return {
      status: {
        status: calculatedStatus,
        isActive: isActive,
        vessel: hasVesselAssignment ? vesselName : null,
        joinedDate: hasVesselAssignment ? joinedDateFormatted : null, 
        sailingDue: hasVesselAssignment ? reliefDueFormatted : null,
        nextAvailability: !hasVesselAssignment && calculatedStatus === 'On Leave' ? nextAvailabilityFormatted : null,
        presentAssignment: vesselCode || null,
        emergencyContact: (crewMember.nokFirstName && crewMember.nokRelationship && crewMember.nokTelephone) ? {
          name: `${crewMember.nokFirstName}${crewMember.nokFamilyName ? ' ' + crewMember.nokFamilyName : ''}`.trim(),
          relation: crewMember.nokRelationship,
          phone: crewMember.nokTelephone
        } : null
      },
      experience: {
        company: experience.company,
        rank: experience.rank,
        tankers: experience.tankers, 
        ocw: experience.oow,
        endorsements: endorsementCode
      },
      shipTypes: {
        items: shipTypeData.shipTypeExperience,
        totalMonths: shipTypeData.totalMonths,
        totalYears: Math.round((shipTypeData.totalMonths / 12) * 10) / 10
      },
      rankExperience: {
        items: rankData.rankExperience,
        totalMonths: rankData.totalMonths,
        totalYears: Math.round((rankData.totalMonths / 12) * 10) / 10
      },
      rankExperienceByVesselType,
      serviceTimeline,
      compliance: [
        { category: "Travel Docs", status: "compliant", details: "✓" },
        { category: "Visas", status: "compliant", details: "✓" },
        { category: "License & DCE", status: "compliant", details: "✓" },
        { category: "Training", status: "issues", details: "Issues: 2" },
        { category: "Medical", status: "compliant", details: "Last: 15 Feb 2022" },
        { category: "Vaccination", status: "issues", details: "Issue: 1" }
      ],
      careerProgression: [
        {
          position: "To C/E",
          status: { recommend: false, advance: false, demote: true, approved: false }
        },
        {
          position: "To 2/E", 
          date: "22 Jan 2017",
          status: { recommend: true, advance: true, demote: false, approved: true }
        },
        {
          position: "To 3/E",
          date: "12 Dec 2014", 
          status: { recommend: true, advance: true, demote: false, approved: true }
        }
      ],
      appraisals: appraisals.map((appraisal, index) => ({
        year: 2014 + index * 2,
        score: parseFloat(appraisal.overallRating || "3.0") * 8
      })).concat([
        { year: 2024, score: 31 }
      ])
    };
  }

  private formatDateForDashboard(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate().toString().padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  }

  private async translateVesselCodeToNameFromDb(vesselCode: string): Promise<string> {
    if (!vesselCode) return '';
    try {
      const result: any = await this.pool.query(
        `SELECT name FROM master_data_entries WHERE master_id = '014' AND entry_id = $1`,
        [vesselCode]
      );
      if (result.rows && result.rows.length > 0) {
        return result.rows[0].name;
      }
      return vesselCode;
    } catch {
      return vesselCode;
    }
  }

  private async getVesselCodeToNameMap(): Promise<Map<string, string>> {
    const vesselMap = new Map<string, string>();
    try {
      const result: any = await this.pool.query(
        `SELECT entry_id, name FROM master_data_entries WHERE master_id = '014'`
      );
      if (result.rows) {
        for (const row of result.rows) {
          if (row.entry_id && row.name) {
            vesselMap.set(row.entry_id, row.name);
          }
        }
      }
    } catch {
      // Return empty map on error
    }
    return vesselMap;
  }

  async getFormForRank(rankLabel: string, category?: string): Promise<Form | undefined> {
    const results = await this.db
      .select()
      .from(forms);
    
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
    const selectColumns = Array.from(existingColumns).map(col => `"${col}"`).join(', ');
    // Order by orderBy column if it exists, fallback to entry_id for consistent ordering
    const hasOrderBy = existingColumns.has('orderBy');
    const orderClause = hasOrderBy ? '"orderBy" NULLS LAST, "entry_id"' : '"entry_id"';
    const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "master_id" = $1 ORDER BY ${orderClause}`;
    
    const result: any = await this.pool.query(selectSql, [masterId]);
    return result.rows || [];
  }

  async getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined> {
    // Use raw SQL to avoid Drizzle schema column issues
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).map(col => `"${col}"`).join(', ');
    const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "id" = $1`;
    
    const result: any = await this.pool.query(selectSql, [id]);
    return result.rows?.[0] || undefined;
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
    
    // Use raw SQL for UPDATE - PostgreSQL syntax with $1, $2, etc.
    const columns = Object.keys(filteredEntry).map((col, i) => `"${col}" = $${i + 1}`).join(', ');
    const values = Object.values(filteredEntry).map(value => value === undefined ? null : value);
    const updateSql = `UPDATE master_data_entries SET ${columns} WHERE "id" = $${values.length + 1}`;
    
    const result: any = await this.pool.query(updateSql, [...values, id]);
    
    if (result.rowCount === 0) {
      return undefined;
    }
    
    // Use raw SQL for SELECT
    const existingColumns = await this.getExistingColumns('master_data_entries');
    const selectColumns = Array.from(existingColumns).map(col => `"${col}"`).join(', ');
    const selectSql = `SELECT ${selectColumns} FROM master_data_entries WHERE "id" = $1`;
    
    const selectResult: any = await this.pool.query(selectSql, [id]);
    return selectResult.rows?.[0] || undefined;
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    // Check if entry exists first (robust approach vs unreliable affectedRows)
    const existing = await this.getMasterDataEntry(id);
    if (!existing) return false;
    
    // Execute delete using raw SQL - PostgreSQL syntax
    const deleteSql = `DELETE FROM master_data_entries WHERE "id" = $1`;
    await this.pool.query(deleteSql, [id]);
    
    // Return true since entry existed (delete should succeed)
    return true;
  }

  // Oil Major Compliance Rules Methods
  async getOilMajorRules(): Promise<OilMajorRules[]> {
    try {
      return await this.db.select().from(oilMajorRules).orderBy(asc(oilMajorRules.oilMajorName));
    } catch (error) {
      console.error("Error getting oil major rules:", error);
      return [];
    }
  }

  async getTrainingMasters(): Promise<any[]> {
    return [];
  }

  async getTrainingMaster(id: number): Promise<any | undefined> {
    return undefined;
  }

  async createTrainingMaster(training: any): Promise<any> {
    throw new Error("Legacy v1 table dropped");
  }

  async updateTrainingMaster(id: number, training: any): Promise<any | undefined> {
    throw new Error("Legacy v1 table dropped");
  }

  async deleteTrainingMaster(id: number): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async reorderTrainingMasters(orders: Array<{ id: number; sortOrder: number }>): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async getCompanyTrainingGroups(): Promise<any[]> {
    return [];
  }

  async updateCompanyTrainingGroup(code: string, data: any): Promise<any | undefined> {
    throw new Error("Legacy v1 table dropped");
  }

  async getCompanyTrainings(): Promise<any[]> {
    return [];
  }

  async getCompanyTraining(id: number): Promise<any | undefined> {
    return undefined;
  }

  async getCompanyTrainingByMasterId(trainingMasterId: number): Promise<any | undefined> {
    return undefined;
  }

  async createCompanyTraining(training: any): Promise<any> {
    throw new Error("Legacy v1 table dropped");
  }

  async updateCompanyTraining(id: number, training: any): Promise<any | undefined> {
    throw new Error("Legacy v1 table dropped");
  }

  async deleteCompanyTraining(id: number): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async deleteCompanyTrainingByMasterId(trainingMasterId: number): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async createCompanyTrainingFromMaster(trainingMasterId: number): Promise<any | null> {
    throw new Error("Legacy v1 table dropped");
  }

  async importCompanyTrainingsFromMaster(): Promise<any[]> {
    return [];
  }

  async reorderCompanyTrainings(orders: Array<{ id: number; sortOrder: number }>): Promise<boolean> {
    throw new Error("Legacy v1 table dropped");
  }

  async getCompanyTrainingRequirements(): Promise<any[]> {
    return [];
  }

  async upsertCompanyTrainingRequirements(requirements: any[]): Promise<any[]> {
    return [];
  }

  // Promotion Reviews Methods
  async getPromotionReviews(): Promise<PromotionReview[]> {
    return await this.db.select().from(promotionReviews).orderBy(desc(promotionReviews.updatedAt));
  }

  async createPromotionReview(review: InsertPromotionReview): Promise<PromotionReview> {
    const result = await this.db.insert(promotionReviews).values(review).returning();
    return result[0];
  }

  // =============================================================================
  // External Master Data Methods (Sync from SAIL ERP API)
  // =============================================================================

  private buildVesselClassification(item: any): string | null {
    const classifications: string[] = [];
    if (item.tanker === true || item.tanker === 1) classifications.push('Tanker');
    if (item.oilTanker === true || item.oilTanker === 1) classifications.push('Oil');
    if (item.gasTanker === true || item.gasTanker === 1) classifications.push('Gas');
    if (item.chemicalTanker === true || item.chemicalTanker === 1) classifications.push('Chemical');
    if (item.dry === true || item.dry === 1) classifications.push('Dry');
    if (item.container === true || item.container === 1) classifications.push('Container');
    return classifications.length > 0 ? classifications.join(', ') : null;
  }

  async getMasterData(masterType: string): Promise<any[]> {
    const tableMap: Record<string, any> = {
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

    const table = tableMap[masterType];
    if (!table) {
      console.warn(`[DatabaseStorage] Unknown master type: ${masterType}`);
      return [];
    }

    try {
      const rows = await this.db.select().from(table).orderBy(table.id);
      console.log(`[DatabaseStorage] getMasterData(${masterType}): returned ${rows.length} records`);

      if (masterType === 'vesselTypes') {
        return rows.map((row: any) => ({
          ...row,
          classification: this.buildVesselClassification(row),
        }));
      }
      return rows;
    } catch (error: any) {
      console.error(`[DatabaseStorage] getMasterData error`, error);
      return [];
    }
  }

  async syncMasterData(masterType: string, data: any[]): Promise<{ count: number }> {
    if (!data || data.length === 0) {
      console.log(`[DatabaseStorage] syncMasterData(${masterType}): No data`);
      return { count: 0 };
    }

    const tableMap: Record<string, any> = {
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

    const fieldMappings: Record<string, Record<string, string>> = {
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

    const table = tableMap[masterType];
    const mapping = fieldMappings[masterType];

    if (!table || !mapping) {
      console.warn(`[DatabaseStorage] Unknown master type: ${masterType}`);
      return { count: 0 };
    }

    const booleanFields = new Set([
      'tanker', 'oilTanker', 'gasTanker', 'chemicalTanker', 'dry', 'container', 'other',
      'isActive', 'isDeleted', 'isForeignLanguage',
    ]);

    const timestampFields = new Set(['createdAt', 'updatedAt', 'synchedAt']);

    try {
      // Clear existing data
      const tableName = getTableName(table);

      console.log('tableName:', tableName);

      await this.db.execute(
        sql.raw(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`)
      );
      // await this.db.delete(table);

      // Build insert objects with proper type conversion
      const insertData = data.map((item) => {
        const row: any = {};
        for (const [apiField, schemaField] of Object.entries(mapping)) {
          if (item[apiField] !== undefined && item[apiField] !== null) {
            let value = item[apiField];
            if (booleanFields.has(apiField)) {
              value = Boolean(value);
            } else if (timestampFields.has(apiField)) {
              value = typeof value === 'string' ? new Date(value) : value;
            }
            row[schemaField] = value;
          }
        }
        return row;
      });

      console.log(`[DatabaseStorage] syncMasterData(${masterType}): inserting ${insertData.length} rows`);

      if (insertData.length > 0) {
        const BATCH_SIZE = 1000;
        let totalInserted = 0;

        for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
          const batch = insertData.slice(i, i + BATCH_SIZE);
          await this.db.insert(table).values(batch);
          totalInserted += batch.length;
          console.log(`[DatabaseStorage] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalInserted}/${insertData.length} rows`);
        }
        console.log(`[DatabaseStorage] Successfully inserted ${totalInserted} rows into ${masterType}`);
      }

      return { count: insertData.length };
    } catch (error) {
      console.error(`[DatabaseStorage] Error syncing ${masterType}:`, error);
      throw error;
    }
  }

  async getAlertPolicies(): Promise<AlertPolicyV2[]> {
    return await this.db.select().from(alertPoliciesV2).where(eq(alertPoliciesV2.isDeleted, false));
  }

  async getAlertPolicy(apuuid: string): Promise<AlertPolicyV2 | undefined> {
    const result = await this.db.select().from(alertPoliciesV2)
      .where(and(eq(alertPoliciesV2.apuuid, apuuid), eq(alertPoliciesV2.isDeleted, false)));
    return result[0];
  }

  async getAlertEvents(filters?: { alertType?: string; acknowledged?: boolean }): Promise<AlertEventV2[]> {
    const conditions = [eq(alertEventsV2.isDeleted, false)];
    if (filters?.alertType) {
      conditions.push(eq(alertEventsV2.alertType, filters.alertType));
    }
    if (filters?.acknowledged !== undefined) {
      if (filters.acknowledged) {
        conditions.push(sql`${alertEventsV2.ackBy} IS NOT NULL`);
      } else {
        conditions.push(sql`${alertEventsV2.ackBy} IS NULL`);
      }
    }
    return await this.db.select().from(alertEventsV2)
      .where(and(...conditions))
      .orderBy(desc(alertEventsV2.createdAt));
  }

  async getAlertEvent(aeuuid: string): Promise<AlertEventV2 | undefined> {
    const result = await this.db.select().from(alertEventsV2)
      .where(and(eq(alertEventsV2.aeuuid, aeuuid), eq(alertEventsV2.isDeleted, false)));
    return result[0];
  }

  async createAlertEvent(event: InsertAlertEventV2): Promise<AlertEventV2> {
    const [created] = await this.db.insert(alertEventsV2).values({
      ...event,
      aeuuid: event.aeuuid || sql`gen_random_uuid()::text`,
    }).returning();
    return created;
  }

  async acknowledgeAlertEvent(aeuuid: string, userId: string): Promise<AlertEventV2> {
    const [updated] = await this.db.update(alertEventsV2)
      .set({ ackBy: userId, ackAt: new Date(), updatedAt: new Date() })
      .where(eq(alertEventsV2.aeuuid, aeuuid))
      .returning();
    if (!updated) throw new Error(`Alert event ${aeuuid} not found`);
    return updated;
  }

  async getUnacknowledgedAlertEventsForRole(userType: string, roleName: string | null): Promise<AlertEventV2[]> {
    const conditions: any[] = [
      sql`${alertEventsV2.ackBy} IS NULL`,
      eq(alertEventsV2.isDeleted, false)
    ];

    const normUserType = userType.toLowerCase();
    const normRoleName = roleName ? roleName.toLowerCase() : "";

    // Admin userType or role sees all alerts
       // Admin role sees all alerts
    if (
      normRoleName === 'admin' ||
      normRoleName === 'sail admin' ||
      normRoleName === 'super admin'
    ) {
      return await this.db.select().from(alertEventsV2)
        .where(and(...conditions))
        .orderBy(desc(alertEventsV2.createdAt));
    }

    // Get all enabled policies
    const policies = await this.db.select().from(alertPoliciesV2)
      .where(and(eq(alertPoliciesV2.enabled, true), eq(alertPoliciesV2.isDeleted, false)));

    const allowedPolicyUuids: string[] = [];
    for (const policy of policies) {
      try {
        const recipients = JSON.parse(policy.recipients || '{}');
        const roles: string[] = (recipients.roles || []).map((r: string) => r.toLowerCase());
        
        if (roles.includes(normUserType) || (normRoleName && roles.includes(normRoleName))) {
          allowedPolicyUuids.push(policy.apuuid);
        }
      } catch {
        // Skip invalid JSON policies
      }
    }

    if (allowedPolicyUuids.length === 0) {
      return [];
    }

    conditions.push(
      sql`${alertEventsV2.policyUuid} IN (${sql.join(allowedPolicyUuids.map(u => sql`${u}`), sql`, `)})`
    );

    return await this.db.select().from(alertEventsV2)
      .where(and(...conditions))
      .orderBy(desc(alertEventsV2.createdAt));
  }
}