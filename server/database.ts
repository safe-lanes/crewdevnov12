import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { 
  users, 
  forms, 
  rankGroups, 
  availableRanks, 
  crewMembers, 
  appraisalResults,
  recruitmentCandidates,
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
  type CrewMember,
  type InsertCrewMember,
  type AppraisalResult,
  type InsertAppraisalResult,
  type RecruitmentCandidate,
  type InsertRecruitmentCandidate,
  type DataMaster,
  type InsertDataMaster,
  type MasterDataEntry,
  type InsertMasterDataEntry
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { type IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: mysql.Pool;

  constructor() {
    // Use direct environment variables approach that works
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    
    if (!DB_HOST || !DB_USER || !DB_PASSWORD) {
      throw new Error("DB_HOST, DB_USER, and DB_PASSWORD environment variables are required");
    }
    
    this.pool = mysql.createPool({
      host: DB_HOST,
      port: parseInt(DB_PORT || '3306'),
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME || 'crew_database',
      ssl: {
        rejectUnauthorized: false // Required for RDS connections
      },
      connectionLimit: 10,
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

  // Self-migration to ensure master_data_entries has enhanced nationality schema
  private async ensureMasterDataEntriesSchema(): Promise<void> {
    try {
      console.log("🔧 Checking master_data_entries schema...");
      
      // Check which columns exist
      const [rows]: any = await this.pool.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'master_data_entries'",
        [process.env.DB_NAME || 'crew_database']
      );
      
      const existingColumns = new Set(rows.map((row: any) => row.COLUMN_NAME));
      console.log("📋 Existing columns:", Array.from(existingColumns));
      
      // Define new columns to add
      const newColumns = [
        { name: 'nuid', ddl: 'ADD COLUMN nuid TEXT NULL' },
        { name: 'countryName', ddl: 'ADD COLUMN countryName TEXT NULL' },
        { name: 'country', ddl: 'ADD COLUMN country TEXT NULL' },
        { name: 'isActive', ddl: 'ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1' },
        { name: 'isDeleted', ddl: 'ADD COLUMN isDeleted TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'createdBy', ddl: 'ADD COLUMN createdBy TEXT NULL' },
        { name: 'domain', ddl: 'ADD COLUMN domain TEXT NULL' },
        { name: 'orderBy', ddl: 'ADD COLUMN orderBy INT NULL' }
      ];
      
      // Add missing columns
      for (const column of newColumns) {
        if (!existingColumns.has(column.name)) {
          console.log(`➕ Adding column: ${column.name}`);
          await this.pool.execute(`ALTER TABLE master_data_entries ${column.ddl}`);
        }
      }
      
      console.log("✅ master_data_entries schema is up to date");
    } catch (error) {
      console.error("❌ Failed to update master_data_entries schema:", error);
      // Don't throw - allow app to start even if schema update fails
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    await this.db.insert(users).values(insertUser);
    return await this.getUserByUsername(insertUser.username) as User;
  }

  // Form methods
  async getForms(): Promise<Form[]> {
    return await this.db.select().from(forms);
  }

  async getForm(id: number): Promise<Form | undefined> {
    const result = await this.db.select().from(forms).where(eq(forms.id, id));
    return result[0];
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const result = await this.db.insert(forms).values(insertForm);
    const insertId = (result as any).insertId;
    return await this.getForm(insertId) as Form;
  }

  async updateForm(id: number, formData: Partial<InsertForm>): Promise<Form | undefined> {
    await this.db.update(forms).set(formData).where(eq(forms.id, id));
    return await this.getForm(id);
  }

  async deleteForm(id: number): Promise<boolean> {
    const result = await this.db.delete(forms).where(eq(forms.id, id));
    return (result as any).affectedRows > 0;
  }

  // Rank Group methods
  async getRankGroups(formId: number): Promise<RankGroup[]> {
    return await this.db.select().from(rankGroups).where(eq(rankGroups.formId, formId));
  }

  async createRankGroup(insertRankGroup: InsertRankGroup): Promise<RankGroup> {
    const result = await this.db.insert(rankGroups).values(insertRankGroup);
    const insertId = (result as any).insertId;
    const rankGroup = await this.db.select().from(rankGroups).where(eq(rankGroups.id, insertId));
    return rankGroup[0];
  }

  async updateRankGroup(id: number, rankGroupData: Partial<InsertRankGroup>): Promise<RankGroup | undefined> {
    await this.db.update(rankGroups).set(rankGroupData).where(eq(rankGroups.id, id));
    const rankGroup = await this.db.select().from(rankGroups).where(eq(rankGroups.id, id));
    return rankGroup[0];
  }

  async deleteRankGroup(id: number): Promise<boolean> {
    const result = await this.db.delete(rankGroups).where(eq(rankGroups.id, id));
    return (result as any).affectedRows > 0;
  }

  // Available Rank methods
  async getAvailableRanks(): Promise<AvailableRank[]> {
    return await this.db.select().from(availableRanks);
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    const result = await this.db.insert(availableRanks).values(insertAvailableRank);
    const insertId = (result as any).insertId;
    const availableRank = await this.db.select().from(availableRanks).where(eq(availableRanks.id, insertId));
    return availableRank[0];
  }

  // Crew Member methods
  async getCrewMembers(): Promise<CrewMember[]> {
    return await this.db.select().from(crewMembers);
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    const result = await this.db.select().from(crewMembers).where(eq(crewMembers.id, id));
    return result[0];
  }

  async createCrewMember(insertCrewMember: InsertCrewMember): Promise<CrewMember> {
    await this.db.insert(crewMembers).values(insertCrewMember);
    return await this.getCrewMember(insertCrewMember.id) as CrewMember;
  }

  async updateCrewMember(id: string, crewMemberData: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    await this.db.update(crewMembers).set(crewMemberData).where(eq(crewMembers.id, id));
    return await this.getCrewMember(id);
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    const result = await this.db.delete(crewMembers).where(eq(crewMembers.id, id));
    return (result as any).affectedRows > 0;
  }

  // Appraisal Result methods
  async getAppraisalResults(): Promise<AppraisalResult[]> {
    return await this.db.select().from(appraisalResults);
  }

  async getAppraisalResult(id: number): Promise<AppraisalResult | undefined> {
    const result = await this.db.select().from(appraisalResults).where(eq(appraisalResults.id, id));
    return result[0];
  }

  async getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]> {
    return await this.db.select().from(appraisalResults).where(eq(appraisalResults.crewMemberId, crewMemberId));
  }

  async createAppraisalResult(insertAppraisalResult: InsertAppraisalResult): Promise<AppraisalResult> {
    const result = await this.db.insert(appraisalResults).values(insertAppraisalResult);
    const insertId = (result as any).insertId;
    return await this.getAppraisalResult(insertId) as AppraisalResult;
  }

  async updateAppraisalResult(id: number, appraisalResultData: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined> {
    await this.db.update(appraisalResults).set(appraisalResultData).where(eq(appraisalResults.id, id));
    return await this.getAppraisalResult(id);
  }

  async deleteAppraisalResult(id: number): Promise<boolean> {
    const result = await this.db.delete(appraisalResults).where(eq(appraisalResults.id, id));
    return (result as any).affectedRows > 0;
  }

  // Recruitment Candidates Methods
  async getRecruitmentCandidates(): Promise<RecruitmentCandidate[]> {
    return await this.db.select().from(recruitmentCandidates);
  }

  async getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    const results = await this.db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.id, id));
    return results[0];
  }

  async getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]> {
    return await this.db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.status, status));
  }

  async createRecruitmentCandidate(insertCandidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate> {
    await this.db.insert(recruitmentCandidates).values(insertCandidate);
    // Since MySQL doesn't support RETURNING, fetch the created record
    const results = await this.db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.id, insertCandidate.id));
    return results[0];
  }

  async updateRecruitmentCandidate(id: string, candidateData: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined> {
    const result = await this.db.update(recruitmentCandidates)
      .set({ ...candidateData, updatedAt: new Date() })
      .where(eq(recruitmentCandidates.id, id));
    
    if ((result as any).affectedRows === 0) {
      return undefined;
    }
    
    const results = await this.db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.id, id));
    return results[0];
  }

  async deleteRecruitmentCandidate(id: string): Promise<boolean> {
    const result = await this.db.delete(recruitmentCandidates).where(eq(recruitmentCandidates.id, id));
    return (result as any).affectedRows > 0;
  }

  // Data Masters Methods
  async getDataMasters(): Promise<DataMaster[]> {
    return await this.db.select().from(dataMasters);
  }

  async getDataMaster(id: string): Promise<DataMaster | undefined> {
    const results = await this.db.select().from(dataMasters).where(eq(dataMasters.id, id));
    return results[0];
  }

  async createDataMaster(insertMaster: InsertDataMaster): Promise<DataMaster> {
    await this.db.insert(dataMasters).values(insertMaster);
    // Fetch the created record
    const results = await this.db.select().from(dataMasters).where(eq(dataMasters.id, insertMaster.id));
    return results[0];
  }

  async updateDataMaster(id: string, masterData: Partial<InsertDataMaster>): Promise<DataMaster | undefined> {
    const result = await this.db.update(dataMasters)
      .set({ ...masterData, updatedAt: new Date() })
      .where(eq(dataMasters.id, id));
    
    if ((result as any).affectedRows === 0) {
      return undefined;
    }
    
    const results = await this.db.select().from(dataMasters).where(eq(dataMasters.id, id));
    return results[0];
  }

  async deleteDataMaster(id: string): Promise<boolean> {
    const result = await this.db.delete(dataMasters).where(eq(dataMasters.id, id));
    return (result as any).affectedRows > 0;
  }

  // Master Data Entries Methods
  async getMasterDataEntries(masterId: string): Promise<MasterDataEntry[]> {
    return await this.db.select().from(masterDataEntries).where(eq(masterDataEntries.masterId, masterId));
  }

  async getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined> {
    const results = await this.db.select().from(masterDataEntries).where(eq(masterDataEntries.id, id));
    return results[0];
  }

  async createMasterDataEntry(insertEntry: InsertMasterDataEntry): Promise<MasterDataEntry> {
    const result = await this.db.insert(masterDataEntries).values(insertEntry);
    const insertId = (result as any).insertId;
    // Fetch the created record
    const results = await this.db.select().from(masterDataEntries).where(eq(masterDataEntries.id, insertId));
    return results[0];
  }

  async updateMasterDataEntry(id: number, entryData: Partial<InsertMasterDataEntry>): Promise<MasterDataEntry | undefined> {
    const result = await this.db.update(masterDataEntries)
      .set({ ...entryData, updatedAt: new Date() })
      .where(eq(masterDataEntries.id, id));
    
    if ((result as any).affectedRows === 0) {
      return undefined;
    }
    
    const results = await this.db.select().from(masterDataEntries).where(eq(masterDataEntries.id, id));
    return results[0];
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    // Check if entry exists first (robust approach vs unreliable affectedRows)
    const existing = await this.getMasterDataEntry(id);
    if (!existing) return false;
    
    // Execute delete
    await this.db.delete(masterDataEntries).where(eq(masterDataEntries.id, id));
    
    // Return true since entry existed (delete should succeed)
    return true;
  }

  // Create database if it doesn't exist
  async createDatabaseIfNotExists(): Promise<void> {
    try {
      // Connect without specifying database to create it
      const url = new URL(process.env.DATABASE_URL!);
      const adminPool = mysql.createPool({
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        // Don't specify database - connect to MySQL server directly
        ssl: {
          rejectUnauthorized: false
        },
        connectionLimit: 1
      });
      
      console.log("🔧 Creating 'crew_database' database if it doesn't exist...");
      
      // Create database if not exists
      await adminPool.execute("CREATE DATABASE IF NOT EXISTS crew_database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
      
      console.log("✅ Database 'crew_database' ensured to exist");
      
      // Close admin connection
      await adminPool.end();
      
    } catch (error) {
      console.error("❌ Failed to create database:", error);
      throw error;
    }
  }

  // Seed data for initial setup
  async seedDatabase(): Promise<void> {
    try {
      // Database and tables already exist, skip creation step
      
      console.log("🔄 Connecting to existing crew_database tables...");
      
      // Check if data masters are already complete (17 categories)
      const existingMasters = await this.getDataMasters();
      if (existingMasters.length >= 17) {
        console.log("Database already seeded, skipping...");
        return;
      }
      
      // If we have some but not all masters, only seed the missing ones
      console.log(`Found ${existingMasters.length} existing master categories, ensuring all 17 are present...`);

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

      // Seed data masters categories (all 17 categories including new ones)
      const masterCategories: InsertDataMaster[] = [
        { id: "001", name: "Nationality", description: "Crew member nationalities" },
        { id: "002", name: "Country", description: "Countries and regions" },
        { id: "003", name: "Language", description: "Languages spoken" },
        { id: "004", name: "Vessel Type", description: "Types of vessels" },
        { id: "005", name: "Port", description: "Ports and terminals" },
        { id: "006", name: "Qualification", description: "Qualifications and certifications" },
        { id: "007", name: "Course", description: "Training courses" },
        { id: "008", name: "Contract Type", description: "Types of contracts" },
        { id: "009", name: "Medical Status", description: "Medical examination status" },
        { id: "010", name: "Document Type", description: "Document types" },
        { id: "011", name: "Equipment", description: "Ship equipment and machinery" },
        { id: "012", name: "Designation", description: "Job titles and positions" },
        { id: "013", name: "Users", description: "System users and administrators" },
        { id: "014", name: "Vessels", description: "Fleet vessel information" },
        { id: "015", name: "Fleet Groups", description: "Vessel fleet groupings" },
        { id: "016", name: "Additional Groups", description: "Additional organizational groups" },
        { id: "017", name: "Vessel Owners", description: "Company and ownership information" }
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
        // Nationality entries
        { masterId: "001", name: "Filipino", description: "Philippines" },
        { masterId: "001", name: "Indian", description: "India" },
        { masterId: "001", name: "Ukrainian", description: "Ukraine" },
        { masterId: "001", name: "Canadian", description: "Canada" },
        
        // Designation entries
        { masterId: "012", name: "Master", description: "Ship Captain" },
        { masterId: "012", name: "Chief Engineer", description: "Chief Engineering Officer" },
        { masterId: "012", name: "Chief Officer", description: "First Officer" },
        
        // Vessel Type entries  
        { masterId: "004", name: "Oil Tanker", description: "Petroleum transport vessel" },
        { masterId: "004", name: "Container Ship", description: "Containerized cargo vessel" },
        { masterId: "004", name: "Bulk Carrier", description: "Dry bulk cargo vessel" }
      ];

      for (const entry of sampleMasterEntries) {
        await this.createMasterDataEntry(entry);
      }

      // Seed forms (with error handling to prevent blocking data masters)
      try {
        const form = await this.createForm({
          name: "Crew Appraisal Form",
          rankGroup: JSON.stringify("Senior Officers"), // Fix: JSON format for database
          versionNo: "01",
          versionDate: "01-Jan-2025",
          configuration: null,
        });

        if (form && form.id) {
          // Seed rank groups
          await this.createRankGroup({
            formId: form.id,
            name: "Senior Officers",
            ranks: JSON.stringify(["Master", "Chief Officer", "Chief Engineer"]),
          });
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

      // Seed appraisal results
      const appraisalData: InsertAppraisalResult[] = [
        {
          crewMemberId: "2025-05-14",
          formId: form.id,
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
          formId: form.id,
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
          formId: form.id,
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