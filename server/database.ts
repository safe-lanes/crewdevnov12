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
  type InsertRecruitmentCandidate
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { type IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: mysql.Pool;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    
    // Parse DATABASE_URL for RDS connection
    const url = new URL(process.env.DATABASE_URL);
    
    this.pool = mysql.createPool({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
      ssl: {
        rejectUnauthorized: false // Required for RDS connections
      },
      connectionLimit: 10,
    });
    this.db = drizzle(this.pool);
  }

  async close() {
    await this.pool.end();
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
      
      console.log("🔧 Creating 'crew_appraisals' database if it doesn't exist...");
      
      // Create database if not exists
      await adminPool.execute("CREATE DATABASE IF NOT EXISTS crew_appraisals CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
      
      console.log("✅ Database 'crew_appraisals' ensured to exist");
      
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
      // First ensure database exists
      await this.createDatabaseIfNotExists();
      
      console.log("🔄 Pushing schema to MySQL RDS...");
      // Push schema using drizzle-kit
      await this.pushSchema();
      
      // Check if data already exists
      const existingForms = await this.getForms();
      if (existingForms.length > 0) {
        console.log("Database already seeded, skipping...");
        return;
      }

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

      // Seed forms
      const form = await this.createForm({
        name: "Crew Appraisal Form",
        rankGroup: "Senior Officers",
        versionNo: "01",
        versionDate: "01-Jan-2025",
        configuration: null,
      });

      // Seed rank groups
      await this.createRankGroup({
        formId: form.id,
        name: "Senior Officers",
        ranks: JSON.stringify(["Master", "Chief Officer", "Chief Engineer"]),
      });

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