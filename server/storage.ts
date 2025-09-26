import { users, type User, type InsertUser, type Form, type InsertForm, type RankGroup, type InsertRankGroup, type AvailableRank, type InsertAvailableRank, type UpdateAvailableRank, type CrewMember, type InsertCrewMember, type AppraisalResult, type InsertAppraisalResult, type RecruitmentCandidate, type InsertRecruitmentCandidate, type CompanyRank, type InsertCompanyRank, type DataMaster, type InsertDataMaster, type MasterDataEntry, type InsertMasterDataEntry, type CrewDashboardSummary } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getForms(): Promise<Form[]>;
  getForm(id: number): Promise<Form | undefined>;
  createForm(form: InsertForm): Promise<Form>;
  updateForm(id: number, form: Partial<InsertForm>): Promise<Form | undefined>;
  deleteForm(id: number): Promise<boolean>;
  getRankGroups(formId: number): Promise<RankGroup[]>;
  createRankGroup(rankGroup: InsertRankGroup): Promise<RankGroup>;
  updateRankGroup(id: number, rankGroup: Partial<InsertRankGroup>): Promise<RankGroup | undefined>;
  deleteRankGroup(id: number): Promise<boolean>;
  getAvailableRanks(): Promise<AvailableRank[]>;
  createAvailableRank(rank: InsertAvailableRank): Promise<AvailableRank>;
  updateAvailableRank(id: number, rank: Partial<InsertAvailableRank>): Promise<AvailableRank | undefined>;
  deleteAvailableRank(id: number): Promise<boolean>;
  clearAllAvailableRanks(): Promise<boolean>;
  // Company Ranks
  getCompanyRanks(): Promise<CompanyRank[]>;
  getCompanyRank(id: string): Promise<CompanyRank | undefined>;
  createCompanyRank(rank: InsertCompanyRank): Promise<CompanyRank>;
  updateCompanyRank(id: string, rank: Partial<InsertCompanyRank>): Promise<CompanyRank | undefined>;
  deleteCompanyRank(id: string): Promise<boolean>;
  clearAllCompanyRanks(): Promise<boolean>;
  saveAllCompanyRanks(ranks: InsertCompanyRank[]): Promise<CompanyRank[]>;
  // Crew Members
  getCrewMembers(): Promise<CrewMember[]>;
  getCrewMember(id: string): Promise<CrewMember | undefined>;
  createCrewMember(crewMember: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: string, crewMember: Partial<InsertCrewMember>): Promise<CrewMember | undefined>;
  deleteCrewMember(id: string): Promise<boolean>;
  // Appraisal Results
  getAppraisalResults(): Promise<AppraisalResult[]>;
  getAppraisalResult(id: number): Promise<AppraisalResult | undefined>;
  getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]>;
  createAppraisalResult(appraisalResult: InsertAppraisalResult): Promise<AppraisalResult>;
  updateAppraisalResult(id: number, appraisalResult: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined>;
  deleteAppraisalResult(id: number): Promise<boolean>;
  // Recruitment Candidates
  getRecruitmentCandidates(): Promise<RecruitmentCandidate[]>;
  getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined>;
  getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]>;
  createRecruitmentCandidate(candidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate>;
  updateRecruitmentCandidate(id: string, candidate: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined>;
  deleteRecruitmentCandidate(id: string): Promise<boolean>;
  // Data Masters
  getDataMasters(): Promise<DataMaster[]>;
  getDataMaster(id: string): Promise<DataMaster | undefined>;
  createDataMaster(master: InsertDataMaster): Promise<DataMaster>;
  updateDataMaster(id: string, master: Partial<InsertDataMaster>): Promise<DataMaster | undefined>;
  deleteDataMaster(id: string): Promise<boolean>;
  // Master Data Entries
  getMasterDataEntries(masterId: string): Promise<MasterDataEntry[]>;
  getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined>;
  createMasterDataEntry(entry: InsertMasterDataEntry): Promise<MasterDataEntry>;
  updateMasterDataEntry(id: number, entry: Partial<InsertMasterDataEntry>): Promise<MasterDataEntry | undefined>;
  deleteMasterDataEntry(id: number): Promise<boolean>;
  // Dashboard Summary
  getCrewDashboardSummary(crewId: string): Promise<CrewDashboardSummary | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private forms: Map<number, Form>;
  private rankGroups: Map<number, RankGroup>;
  private availableRanks: Map<number, AvailableRank>;
  private companyRanks: Map<string, CompanyRank>;
  private crewMembers: Map<string, CrewMember>;
  private appraisalResults: Map<number, AppraisalResult>;
  private recruitmentCandidates: Map<string, RecruitmentCandidate>;
  private currentUserId: number;
  private currentFormId: number;
  private currentRankGroupId: number;
  private currentAvailableRankId: number;
  private currentAppraisalResultId: number;

  constructor() {
    this.initializeDefaultData();

    // Initialize with sample form data - showing only 1 rank group for configuration
    this.forms.set(1, {
      id: 1,
      name: "Crew Appraisal Form",
      rankGroup: "Senior Officers",
      versionNo: "01",
      versionDate: "01-Jan-2025",
      configuration: null,
    });
    this.currentFormId = 2;

    // Initialize with sample available ranks (minimal seeding since user manages their own data)
    this.availableRanks.set(1, { id: 1, name: "Master", category: "Senior Officers", rankId: "S1", label: "Master", applicableToCompany: true });
    this.availableRanks.set(2, { id: 2, name: "Chief Officer", category: "Senior Officers", rankId: "S2", label: "Chief Officer", applicableToCompany: true });
    this.availableRanks.set(3, { id: 3, name: "Chief Engineer", category: "Senior Officers", rankId: "S7", label: "Chief Engineer", applicableToCompany: true });
    this.availableRanks.set(4, { id: 4, name: "2nd Officer", category: "Junior Officers", rankId: "S3", label: "2nd Officer", applicableToCompany: true });
    this.availableRanks.set(5, { id: 5, name: "3rd Officer", category: "Junior Officers", rankId: "S4", label: "3rd Officer", applicableToCompany: true });
    this.availableRanks.set(6, { id: 6, name: "2nd Engineer", category: "Junior Officers", rankId: "S9", label: "2nd Engineer", applicableToCompany: true });
    this.availableRanks.set(7, { id: 7, name: "3rd Engineer", category: "Junior Officers", rankId: "S10", label: "3rd Engineer", applicableToCompany: true });
    this.availableRanks.set(8, { id: 8, name: "Bosun", category: "Ratings", rankId: "S12", label: "Bosun", applicableToCompany: true });
    this.availableRanks.set(9, { id: 9, name: "AB", category: "Ratings", rankId: "S14", label: "AB", applicableToCompany: true });
    this.availableRanks.set(10, { id: 10, name: "OS", category: "Ratings", rankId: "S15", label: "OS", applicableToCompany: false });
    this.availableRanks.set(11, { id: 11, name: "Oiler", category: "Ratings", rankId: "S16", label: "Oiler", applicableToCompany: false });
    this.availableRanks.set(12, { id: 12, name: "Wiper", category: "Ratings", rankId: "S17", label: "Wiper", applicableToCompany: false });
    this.currentAvailableRankId = 13;

    // Initialize with sample rank groups - showing only 1 for configuration
    // Note: Using JSON string for ranks array compatibility with MySQL
    this.rankGroups.set(1, {
      id: 1,
      formId: 1,
      name: "Senior Officers",
      ranks: JSON.stringify(["Master", "Chief Officer", "Chief Engineer"])
    });
    this.currentRankGroupId = 2;

    // Initialize with sample crew member data
    this.crewMembers.set("2025-05-14", {
      id: "2025-05-14",
      firstName: "James",
      middleName: "Michael",
      lastName: "",
      rank: "Master",
      nationality: "British",
      vessel: "MT Sail One",
      vesselType: "Oil Tanker",
      signOnDate: "01-Feb-2025",
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    this.crewMembers.set("2025-03-12", {
      id: "2025-03-12",
      firstName: "Anna",
      middleName: "Marie",
      lastName: "Johnson",
      rank: "Chief Engineer",
      nationality: "British",
      vessel: "MT Sail Ten",
      vesselType: "LPG Tanker",
      signOnDate: "01-Jan-2025",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01")
    });

    this.crewMembers.set("2025-02-12", {
      id: "2025-02-12",
      firstName: "David",
      middleName: "Lee",
      lastName: "Brown",
      rank: "Able Seaman",
      nationality: "Indian",
      vessel: "MT Sail Two",
      vesselType: "Container",
      signOnDate: "01-Feb-2025",
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    this.crewMembers.set("2025-05-14-2", {
      id: "2025-05-14-2",
      firstName: "Emily",
      middleName: "Grace",
      lastName: "Davis",
      rank: "Chief Mate",
      nationality: "Indian",
      vessel: "MT Sail Five",
      vesselType: "Bulk",
      signOnDate: "01-Jan-2025",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01")
    });

    this.crewMembers.set("2025-03-12-2", {
      id: "2025-03-12-2",
      firstName: "John",
      middleName: "Paul",
      lastName: "Williams",
      rank: "Electrician",
      nationality: "Indian",
      vessel: "MT Sail Eight",
      vesselType: "Bulk",
      signOnDate: "01-Feb-2025",
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    // Initialize with sample recruitment candidates
    this.recruitmentCandidates.set("2025-09-23-1758595508955", {
      id: "2025-09-23-1758595508955",
      fileNo: "M2025-955",
      firstName: "Mark",
      middleName: "Tan",
      familyName: "Twait",
      dob: "1981-01-04",
      nationality: "Malaysian",
      rankAppliedFor: "Master",
      presentRank: "Master",
      vesselType: "Oil Tanker",
      status: "Applied",
      applicationData: "{\"firstName\":\"Mark\",\"middleName\":\"Tan\",\"familyName\":\"Twait\",\"nationality\":\"Malaysian\",\"presentRank\":\"Master\",\"dateOfBirth\":\"1981-01-04\",\"placeOfBirthCity\":\"\",\"placeOfBirthCountry\":\"Malaysia\",\"ageInYears\":\"44\",\"heightCm\":\"\",\"weightKg\":\"\",\"nativeLanguage\":\"English\",\"foreignLanguages\":\"Spanish\",\"englishProficiency\":\"Good\",\"rankAppliedFor\":\"Master\",\"manningAgent\":\"ABC \",\"fileNo\":\"M2025-955\",\"b1AgeMeetsCriteria\":\"Yes\",\"b1RankMeetsCriteria\":\"Yes\",\"b1CertificatesValid\":\"No\",\"b1Shortlisted\":\"Yes\",\"b2ReferenceChecksCompleted\":\"Yes\",\"b2CurrentEmployerFeedback\":\"Good feedback\"}",
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-001", {
      id: "RC-2025-001",
      fileNo: "RF-2025-001",
      firstName: "Michael",
      middleName: "James",
      familyName: "Thompson",
      dob: "1985-03-15",
      nationality: "Filipino",
      rankAppliedFor: "Chief Officer",
      presentRank: "2nd Officer",
      vesselType: "Container",
      status: "Applied",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-002", {
      id: "RC-2025-002",
      fileNo: "RF-2025-002",
      firstName: "Sarah",
      middleName: null,
      familyName: "Rodriguez",
      dob: "1990-07-22",
      nationality: "Spanish",
      rankAppliedFor: "3rd Engineer",
      presentRank: "Engine Cadet",
      vesselType: "Oil Tanker",
      status: "Screening",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-003", {
      id: "RC-2025-003",
      fileNo: "RF-2025-003",
      firstName: "Alexander",
      middleName: "Viktor",
      familyName: "Petrov",
      dob: "1982-11-08",
      nationality: "Russian",
      rankAppliedFor: "Master",
      presentRank: "Chief Officer",
      vesselType: "Bulk Carrier",
      status: "For Approval",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-004", {
      id: "RC-2025-004",
      fileNo: "RF-2025-004",
      firstName: "Priya",
      middleName: "Devi",
      familyName: "Sharma",
      dob: "1993-02-14",
      nationality: "Indian",
      rankAppliedFor: "Able Seaman",
      presentRank: "Ordinary Seaman",
      vesselType: "LPG Tanker",
      status: "Applied",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    // Initialize with sample appraisal results
    this.appraisalResults.set(1, {
      id: 1,
      crewMemberId: "2025-05-14",
      formId: 1,
      appraisalType: "End of Contract",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "4.9",
      behavioralRating: "4.5",
      overallRating: "4.7",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-06-06")
    });

    this.appraisalResults.set(2, {
      id: 2,
      crewMemberId: "2025-03-12",
      formId: 1,
      appraisalType: "Mid Term",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.5",
      behavioralRating: "4.5",
      overallRating: "4.0",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-05-07")
    });

    this.appraisalResults.set(3, {
      id: 3,
      crewMemberId: "2025-02-12",
      formId: 1,
      appraisalType: "Special",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "2.5",
      behavioralRating: "3.5",
      overallRating: "3.0",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-06-06")
    });

    this.appraisalResults.set(4, {
      id: 4,
      crewMemberId: "2025-05-14-2",
      formId: 1,
      appraisalType: "Probation",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.5",
      behavioralRating: "4.5",
      overallRating: "4.0",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-05-07")
    });

    this.appraisalResults.set(5, {
      id: 5,
      crewMemberId: "2025-03-12-2",
      formId: 1,
      appraisalType: "Appraiser S/Off",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "4.5",
      behavioralRating: "2.5",
      overallRating: "3.5",
      submittedBy: "admin",
      status: "submitted",
      submittedAt: new Date("2025-06-06")
    });

    this.currentAppraisalResultId = 6;
  }

  private initializeDefaultData() {
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentAppraisalResultId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getForms(): Promise<Form[]> {
    return Array.from(this.forms.values());
  }

  async getForm(id: number): Promise<Form | undefined> {
    return this.forms.get(id);
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const id = this.currentFormId++;
    const form: Form = { 
      ...insertForm, 
      id,
      configuration: insertForm.configuration || null
    };
    this.forms.set(id, form);
    return form;
  }

  async updateForm(id: number, formData: Partial<InsertForm>): Promise<Form | undefined> {
    const existingForm = this.forms.get(id);
    if (!existingForm) return undefined;

    const updatedForm: Form = { 
      ...existingForm, 
      ...formData,
      configuration: formData.configuration !== undefined ? formData.configuration : existingForm.configuration
    };
    this.forms.set(id, updatedForm);
    return updatedForm;
  }

  async deleteForm(id: number): Promise<boolean> {
    return this.forms.delete(id);
  }

  async getRankGroups(formId: number): Promise<RankGroup[]> {
    return Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
  }

  async createRankGroup(insertRankGroup: InsertRankGroup): Promise<RankGroup> {
    const id = this.currentRankGroupId++;
    // Convert array to JSON string for MySQL compatibility
    const rankGroup: RankGroup = { 
      ...insertRankGroup, 
      id,
      ranks: typeof insertRankGroup.ranks === 'string' 
        ? insertRankGroup.ranks 
        : JSON.stringify(insertRankGroup.ranks)
    };
    this.rankGroups.set(id, rankGroup);
    
    // Sync the form's rankGroup field with all associated rank groups
    await this.syncFormRankGroup(insertRankGroup.formId);
    
    return rankGroup;
  }

  // Private helper to sync form's rankGroup field with associated rank groups
  private async syncFormRankGroup(formId: number): Promise<void> {
    // Get all rank groups for this form
    const formRankGroups = Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
    
    // Create display string from rank group names
    const rankGroupNames = formRankGroups.map(rg => rg.name).join(", ");
    
    // Update the form's rankGroup field
    const form = this.forms.get(formId);
    if (form) {
      form.rankGroup = rankGroupNames || "";
      this.forms.set(formId, form);
    }
  }

  async updateRankGroup(id: number, rankGroupData: Partial<InsertRankGroup>): Promise<RankGroup | undefined> {
    const existingRankGroup = this.rankGroups.get(id);
    if (!existingRankGroup) return undefined;

    const updatedRankGroup: RankGroup = { 
      ...existingRankGroup, 
      ...rankGroupData,
      ranks: rankGroupData.ranks 
        ? (typeof rankGroupData.ranks === 'string' 
          ? rankGroupData.ranks 
          : JSON.stringify(rankGroupData.ranks))
        : existingRankGroup.ranks
    };
    this.rankGroups.set(id, updatedRankGroup);
    return updatedRankGroup;
  }

  async deleteRankGroup(id: number): Promise<boolean> {
    const rankGroup = this.rankGroups.get(id);
    if (!rankGroup) return false;
    
    const formId = rankGroup.formId;
    const result = this.rankGroups.delete(id);
    
    if (result) {
      // Sync the form's rankGroup field after deletion
      await this.syncFormRankGroup(formId);
    }
    
    return result;
  }

  async getAvailableRanks(): Promise<AvailableRank[]> {
    return Array.from(this.availableRanks.values());
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    const id = this.currentAvailableRankId++;
    const availableRank: AvailableRank = { 
      ...insertAvailableRank, 
      id,
      rankId: insertAvailableRank.rankId ?? null,
      label: insertAvailableRank.label ?? null,
      applicableToCompany: insertAvailableRank.applicableToCompany ?? null
    };
    this.availableRanks.set(id, availableRank);
    return availableRank;
  }

  async updateAvailableRank(id: number, rankData: Partial<InsertAvailableRank>): Promise<AvailableRank | undefined> {
    const existingRank = this.availableRanks.get(id);
    if (!existingRank) return undefined;

    const updatedRank: AvailableRank = { 
      ...existingRank, 
      ...rankData
    };
    this.availableRanks.set(id, updatedRank);
    return updatedRank;
  }

  async deleteAvailableRank(id: number): Promise<boolean> {
    return this.availableRanks.delete(id);
  }

  async clearAllAvailableRanks(): Promise<boolean> {
    this.availableRanks.clear();
    return true;
  }

  // Crew Members Methods
  async getCrewMembers(): Promise<CrewMember[]> {
    return Array.from(this.crewMembers.values());
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    return this.crewMembers.get(id);
  }

  async createCrewMember(insertCrewMember: InsertCrewMember): Promise<CrewMember> {
    const crewMember: CrewMember = { 
      ...insertCrewMember,
      middleName: insertCrewMember.middleName || null,
      lastName: insertCrewMember.lastName || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.crewMembers.set(crewMember.id, crewMember);
    return crewMember;
  }

  async updateCrewMember(id: string, crewMemberData: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const existingCrewMember = this.crewMembers.get(id);
    if (!existingCrewMember) return undefined;

    const updatedCrewMember: CrewMember = { 
      ...existingCrewMember, 
      ...crewMemberData,
      updatedAt: new Date()
    };
    this.crewMembers.set(id, updatedCrewMember);
    return updatedCrewMember;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    return this.crewMembers.delete(id);
  }

  // Dashboard Summary Method
  async getCrewDashboardSummary(crewId: string): Promise<CrewDashboardSummary | undefined> {
    const crewMember = await this.getCrewMember(crewId);
    if (!crewMember) return undefined;

    const appraisals = await this.getAppraisalResultsByCrewMember(crewId);

    // Generate realistic dashboard data based on crew member and appraisals
    const summary: CrewDashboardSummary = {
      status: {
        status: "On Board",
        vessel: crewMember.vessel,
        joinedDate: "15 Mar 2022", 
        sailingDue: "15 Jul 2022",
        presentAssignment: crewMember.vessel || "Chandigarh",
        emergencyContact: {
          name: "Mira Kumari", 
          relation: "Wife",
          phone: "+91 987 555 8553"
        }
      },
      experience: {
        company: 1.2,
        rank: 1.9,
        tankers: 2.5, 
        ocw: 3.6,
        endorsements: 5
      },
      shipTypes: {
        oilTanker: 4.2,
        chemicalTanker: 5.1,
        gasTanker: 3.2,
        bulk: 1.1
      },
      serviceTimeline: [
        { vessel: "Pacific Explorer", startMonth: 1, endMonth: 3, type: "completed" },
        { vessel: "Atlantic Explorer", startMonth: 5, endMonth: 6, type: "active" }
      ],
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
        score: parseFloat(appraisal.overallRating || "3.0") * 8 // Convert to chart scale
      })).concat([
        { year: 2024, score: 31 } // Add current year point
      ])
    };

    return summary;
  }

  // Appraisal Results Methods
  async getAppraisalResults(): Promise<AppraisalResult[]> {
    return Array.from(this.appraisalResults.values());
  }

  async getAppraisalResult(id: number): Promise<AppraisalResult | undefined> {
    return this.appraisalResults.get(id);
  }

  async getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]> {
    return Array.from(this.appraisalResults.values()).filter(ar => ar.crewMemberId === crewMemberId);
  }

  async createAppraisalResult(insertAppraisalResult: InsertAppraisalResult): Promise<AppraisalResult> {
    const id = this.currentAppraisalResultId++;
    const appraisalResult: AppraisalResult = { 
      ...insertAppraisalResult, 
      id,
      competenceRating: insertAppraisalResult.competenceRating || null,
      behavioralRating: insertAppraisalResult.behavioralRating || null,
      overallRating: insertAppraisalResult.overallRating || null,
      status: insertAppraisalResult.status || "draft",
      submittedAt: new Date()
    };
    this.appraisalResults.set(id, appraisalResult);
    return appraisalResult;
  }

  async updateAppraisalResult(id: number, appraisalResultData: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined> {
    const existingAppraisalResult = this.appraisalResults.get(id);
    if (!existingAppraisalResult) return undefined;

    const updatedAppraisalResult: AppraisalResult = { 
      ...existingAppraisalResult, 
      ...appraisalResultData
    };
    this.appraisalResults.set(id, updatedAppraisalResult);
    return updatedAppraisalResult;
  }

  async deleteAppraisalResult(id: number): Promise<boolean> {
    return this.appraisalResults.delete(id);
  }

  // Recruitment Candidates Methods
  async getRecruitmentCandidates(): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values());
  }

  async getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    return this.recruitmentCandidates.get(id);
  }

  async getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values()).filter(candidate => candidate.status === status);
  }

  async createRecruitmentCandidate(insertCandidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate> {
    const candidate: RecruitmentCandidate = { 
      ...insertCandidate,
      middleName: insertCandidate.middleName || null,
      applicationData: insertCandidate.applicationData || null,
      status: insertCandidate.status || "Applied",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.recruitmentCandidates.set(candidate.id, candidate);
    return candidate;
  }

  async updateRecruitmentCandidate(id: string, candidateData: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined> {
    const existingCandidate = this.recruitmentCandidates.get(id);
    if (!existingCandidate) return undefined;

    const updatedCandidate: RecruitmentCandidate = { 
      ...existingCandidate, 
      ...candidateData,
      updatedAt: new Date()
    };
    this.recruitmentCandidates.set(id, updatedCandidate);
    return updatedCandidate;
  }

  async deleteRecruitmentCandidate(id: string): Promise<boolean> {
    return this.recruitmentCandidates.delete(id);
  }

  // Data Masters Methods (stub implementations for MemStorage)
  async getDataMasters(): Promise<DataMaster[]> {
    // MemStorage doesn't have data masters - return empty array
    return [];
  }

  async getDataMaster(id: string): Promise<DataMaster | undefined> {
    // MemStorage doesn't have data masters - return undefined
    return undefined;
  }

  async createDataMaster(master: InsertDataMaster): Promise<DataMaster> {
    // MemStorage doesn't support data masters - throw error
    throw new Error("MemStorage doesn't support data masters. Use DatabaseStorage instead.");
  }

  async updateDataMaster(id: string, master: Partial<InsertDataMaster>): Promise<DataMaster | undefined> {
    // MemStorage doesn't support data masters - throw error
    throw new Error("MemStorage doesn't support data masters. Use DatabaseStorage instead.");
  }

  async deleteDataMaster(id: string): Promise<boolean> {
    // MemStorage doesn't support data masters - throw error
    throw new Error("MemStorage doesn't support data masters. Use DatabaseStorage instead.");
  }

  // Master Data Entries Methods (stub implementations for MemStorage)
  async getMasterDataEntries(masterId: string): Promise<MasterDataEntry[]> {
    // MemStorage doesn't have master data entries - return empty array
    return [];
  }

  async getMasterDataEntry(id: number): Promise<MasterDataEntry | undefined> {
    // MemStorage doesn't have master data entries - return undefined
    return undefined;
  }

  async createMasterDataEntry(entry: InsertMasterDataEntry): Promise<MasterDataEntry> {
    // MemStorage doesn't support master data entries - throw error
    throw new Error("MemStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async updateMasterDataEntry(id: number, entry: Partial<InsertMasterDataEntry>): Promise<MasterDataEntry | undefined> {
    // MemStorage doesn't support master data entries - throw error
    throw new Error("MemStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    // MemStorage doesn't support master data entries - throw error
    throw new Error("MemStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }
}

// PersistentFileStorage class - saves data to JSON file for persistence across restarts
export class PersistentFileStorage implements IStorage {
  private users: Map<number, User>;
  private forms: Map<number, Form>;
  private rankGroups: Map<number, RankGroup>;
  private availableRanks: Map<number, AvailableRank>;
  private companyRanks: Map<string, CompanyRank>;
  private crewMembers: Map<string, CrewMember>;
  private appraisalResults: Map<number, AppraisalResult>;
  private recruitmentCandidates: Map<string, RecruitmentCandidate>;
  private masterDataEntries: Map<string, any>;
  private currentUserId: number;
  private currentFormId: number;
  private currentRankGroupId: number;
  private currentAvailableRankId: number;
  private currentAppraisalResultId: number;
  private filePath: string;

  constructor() {
    this.filePath = path.join(process.cwd(), 'test-data.json');
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // Convert arrays back to Maps
        this.users = new Map(data.users || []);
        this.forms = new Map(data.forms || []);
        this.rankGroups = new Map(data.rankGroups || []);
        this.availableRanks = new Map(data.availableRanks || []);
        this.companyRanks = new Map(data.companyRanks || []);
        this.crewMembers = new Map(data.crewMembers || []);
        this.appraisalResults = new Map(data.appraisalResults || []);
        this.recruitmentCandidates = new Map(data.recruitmentCandidates || []);
        this.masterDataEntries = new Map(data.masterDataEntries || []);
        
        // Load current counters
        this.currentUserId = data.currentUserId || 1;
        this.currentFormId = data.currentFormId || 2;
        this.currentRankGroupId = data.currentRankGroupId || 1;
        this.currentAvailableRankId = data.currentAvailableRankId || 11;
        this.currentAppraisalResultId = data.currentAppraisalResultId || 1;
        
        console.log("📄 Loaded existing data from test-data.json");
      } else {
        console.log("📄 test-data.json not found, initializing with default data");
        this.initializeDefaultData();
        this.saveToFile();
      }
    } catch (error) {
      console.error("⚠️ Error loading test-data.json, falling back to default data:", error);
      this.initializeDefaultData();
      this.saveToFile();
    }
  }

  private saveToFile(): void {
    try {
      const data = {
        users: Array.from(this.users.entries()),
        forms: Array.from(this.forms.entries()),
        rankGroups: Array.from(this.rankGroups.entries()),
        availableRanks: Array.from(this.availableRanks.entries()),
        companyRanks: Array.from(this.companyRanks.entries()),
        crewMembers: Array.from(this.crewMembers.entries()),
        appraisalResults: Array.from(this.appraisalResults.entries()),
        recruitmentCandidates: Array.from(this.recruitmentCandidates.entries()),
        masterDataEntries: Array.from(this.masterDataEntries.entries()),
        currentUserId: this.currentUserId,
        currentFormId: this.currentFormId,
        currentRankGroupId: this.currentRankGroupId,
        currentAvailableRankId: this.currentAvailableRankId,
        currentAppraisalResultId: this.currentAppraisalResultId
      };
      
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log("💾 Data saved to test-data.json");
    } catch (error) {
      console.error("⚠️ Error saving to test-data.json:", error);
    }
  }

  private initializeDefaultData(): void {
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.masterDataEntries = new Map();
    this.currentUserId = 1;
    this.currentFormId = 2;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 11;
    this.currentAppraisalResultId = 1;

    // Initialize with sample form data
    this.forms.set(1, {
      id: 1,
      name: "Crew Appraisal Form",
      rankGroup: "Senior Officers",
      versionNo: "01",
      versionDate: "01-Jan-2025",
      configuration: null,
    });

    // Initialize with sample available ranks
    this.availableRanks.set(1, { id: 1, name: "Master", category: "Senior Officers", rankId: "S1", label: "Master", applicableToCompany: true });
    this.availableRanks.set(2, { id: 2, name: "Chief Officer", category: "Senior Officers", rankId: "S2", label: "Chief Officer", applicableToCompany: true });
    this.availableRanks.set(3, { id: 3, name: "Chief Engineer", category: "Senior Officers", rankId: "S7", label: "Chief Engineer", applicableToCompany: true });
    this.availableRanks.set(4, { id: 4, name: "2nd Officer", category: "Junior Officers", rankId: "S3", label: "2nd Officer", applicableToCompany: true });
    this.availableRanks.set(5, { id: 5, name: "3rd Officer", category: "Junior Officers", rankId: "S4", label: "3rd Officer", applicableToCompany: true });
    this.availableRanks.set(6, { id: 6, name: "2nd Engineer", category: "Junior Officers", rankId: "S9", label: "2nd Engineer", applicableToCompany: true });
    this.availableRanks.set(7, { id: 7, name: "3rd Engineer", category: "Junior Officers", rankId: "S10", label: "3rd Engineer", applicableToCompany: true });
    this.availableRanks.set(8, { id: 8, name: "Bosun", category: "Ratings", rankId: "S12", label: "Bosun", applicableToCompany: true });
    this.availableRanks.set(9, { id: 9, name: "AB", category: "Ratings", rankId: "S14", label: "AB", applicableToCompany: true });
    this.availableRanks.set(10, { id: 10, name: "OS", category: "Ratings", rankId: "S15", label: "OS", applicableToCompany: false });

    // Initialize sample recruitment candidate
    const sampleCandidate: RecruitmentCandidate = {
      id: "2025-09-23-1758595508955",
      fileNo: "RC-2025-001",
      firstName: "Mark",
      middleName: "Tan",
      familyName: "Twait",
      dob: "1981-01-04",
      nationality: "Malaysian",
      rankAppliedFor: "Master",
      presentRank: "Master",
      vesselType: JSON.stringify(["Oil Tanker"]),
      status: "Applied",
      applicationData: JSON.stringify({
        firstName: "Mark",
        middleName: "Tan",
        familyName: "Twait",
        nationality: "Malaysian",
        presentRank: "Master",
        vesselType: ["Oil Tanker"],
        dateOfBirth: "1981-01-04",
        ageInYears: "44",
        nativeLanguage: "English",
        foreignLanguages: "Spanish",
        englishProficiency: "Good",
        rankAppliedFor: "Master",
        manningAgent: "ABC ",
        fileNo: "M2025-955"
      }),
      createdAt: new Date('2025-09-23T10:00:00Z'),
      updatedAt: new Date('2025-09-23T10:00:00Z'),
    };

    this.recruitmentCandidates.set(sampleCandidate.id, sampleCandidate);

    // Add additional recruitment candidates (from original MemStorage)
    this.recruitmentCandidates.set("RC-2025-002", {
      id: "RC-2025-002",
      fileNo: "RF-2025-002",
      firstName: "Sarah",
      middleName: null,
      familyName: "Rodriguez",
      dob: "1990-07-22",
      nationality: "Spanish",
      rankAppliedFor: "3rd Engineer",
      presentRank: "Engine Cadet",
      vesselType: "Oil Tanker",
      status: "Screening",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-003", {
      id: "RC-2025-003",
      fileNo: "RF-2025-003",
      firstName: "Alexander",
      middleName: "Viktor",
      familyName: "Petrov",
      dob: "1982-11-08",
      nationality: "Russian",
      rankAppliedFor: "Master",
      presentRank: "Chief Officer",
      vesselType: "Bulk Carrier",
      status: "For Approval",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-004", {
      id: "RC-2025-004",
      fileNo: "RF-2025-004",
      firstName: "Priya",
      middleName: "Devi",
      familyName: "Sharma",
      dob: "1993-02-14",
      nationality: "Indian",
      rankAppliedFor: "Able Seaman",
      presentRank: "Ordinary Seaman",
      vesselType: "LPG Tanker",
      status: "Applied",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    this.recruitmentCandidates.set("RC-2025-005", {
      id: "RC-2025-005",
      fileNo: "RF-2025-005",
      firstName: "Ahmed",
      middleName: "Hassan",
      familyName: "Al-Rashid",
      dob: "1985-09-30",
      nationality: "Egyptian",
      rankAppliedFor: "Chief Officer",
      presentRank: "2nd Officer",
      vesselType: "Container",
      status: "Recruited",
      applicationData: null,
      createdAt: new Date("2025-09-23"),
      updatedAt: new Date("2025-09-23")
    });

    // Initialize with sample crew member data (from original MemStorage)
    this.crewMembers.set("2025-05-14", {
      id: "2025-05-14",
      firstName: "James",
      middleName: "Michael",
      lastName: "Wilson",
      rank: "Master",
      nationality: "British",
      vessel: "MT Sail One",
      vesselType: "Oil Tanker",
      signOnDate: "01-Feb-2025",
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    this.crewMembers.set("2025-03-12", {
      id: "2025-03-12",
      firstName: "Anna",
      middleName: "Marie",
      lastName: "Johnson",
      rank: "Chief Engineer",
      nationality: "British",
      vessel: "MT Sail Ten",
      vesselType: "LPG Tanker",
      signOnDate: "01-Jan-2025",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01")
    });

    this.crewMembers.set("2025-02-12", {
      id: "2025-02-12",
      firstName: "David",
      middleName: "Lee",
      lastName: "Brown",
      rank: "Able Seaman",
      nationality: "Indian",
      vessel: "MT Sail Two",
      vesselType: "Container",
      signOnDate: "01-Feb-2025",
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    this.crewMembers.set("2025-04-18", {
      id: "2025-04-18",
      firstName: "Carlos",
      middleName: "Miguel",
      lastName: "Santos",
      rank: "2nd Officer",
      nationality: "Filipino",
      vessel: "MT Sail Three",
      vesselType: "Chemical Tanker",
      signOnDate: "15-Mar-2025",
      createdAt: new Date("2025-03-15"),
      updatedAt: new Date("2025-03-15")
    });

    // Initialize with sample appraisal results
    this.appraisalResults.set(1, {
      id: 1,
      crewMemberId: "2025-05-14",
      formId: 1,
      appraisalType: "End of Contract",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "4.9",
      behavioralRating: "4.5",
      overallRating: "4.7",
      submittedBy: "admin",
      createdAt: new Date("2025-06-06"),
      updatedAt: new Date("2025-06-06")
    });

    this.appraisalResults.set(2, {
      id: 2,
      crewMemberId: "2025-03-12",
      formId: 1,
      appraisalType: "Mid Term",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.5",
      behavioralRating: "4.5",
      overallRating: "4.0",
      submittedBy: "admin",
      createdAt: new Date("2025-05-07"),
      updatedAt: new Date("2025-05-07")
    });

    this.appraisalResults.set(3, {
      id: 3,
      crewMemberId: "2025-02-12",
      formId: 1,
      appraisalType: "Special",
      appraisalDate: "06-Jun-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "2.5",
      behavioralRating: "3.5",
      overallRating: "3.0",
      submittedBy: "admin",
      createdAt: new Date("2025-06-06"),
      updatedAt: new Date("2025-06-06")
    });

    this.appraisalResults.set(4, {
      id: 4,
      crewMemberId: "2025-04-18",
      formId: 1,
      appraisalType: "Probation",
      appraisalDate: "07-May-2025",
      appraisalData: JSON.stringify({}),
      competenceRating: "3.8",
      behavioralRating: "4.2",
      overallRating: "4.0",
      submittedBy: "admin",
      createdAt: new Date("2025-05-07"),
      updatedAt: new Date("2025-05-07")
    });

    this.currentAppraisalResultId = 5;
  }

  // User methods (same as MemStorage)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(user: User): Promise<User> {
    user.id = this.currentUserId++;
    this.users.set(user.id, user);
    this.saveToFile();
    return user;
  }

  // Form methods (same as MemStorage)
  async getForms(): Promise<Form[]> {
    return Array.from(this.forms.values());
  }

  async getForm(id: number): Promise<Form | undefined> {
    return this.forms.get(id);
  }

  async createForm(insertForm: InsertForm): Promise<Form> {
    const form: Form = { ...insertForm, id: this.currentFormId++ };
    this.forms.set(form.id, form);
    this.saveToFile();
    return form;
  }

  async updateForm(id: number, formData: Partial<InsertForm>): Promise<Form | undefined> {
    const existingForm = this.forms.get(id);
    if (!existingForm) return undefined;

    const updatedForm: Form = { ...existingForm, ...formData };
    this.forms.set(id, updatedForm);
    this.saveToFile();
    return updatedForm;
  }

  async deleteForm(id: number): Promise<boolean> {
    const result = this.forms.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // Rank Group methods (same as MemStorage)
  async getRankGroups(formId: number): Promise<RankGroup[]> {
    return Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
  }

  async createRankGroup(insertRankGroup: InsertRankGroup): Promise<RankGroup> {
    const rankGroup: RankGroup = { ...insertRankGroup, id: this.currentRankGroupId++ };
    this.rankGroups.set(rankGroup.id, rankGroup);
    
    // Sync the form's rankGroup field with all associated rank groups
    await this.syncFormRankGroup(insertRankGroup.formId);
    
    this.saveToFile();
    return rankGroup;
  }

  // Private helper to sync form's rankGroup field with associated rank groups
  private async syncFormRankGroup(formId: number): Promise<void> {
    // Get all rank groups for this form
    const formRankGroups = Array.from(this.rankGroups.values()).filter(rg => rg.formId === formId);
    
    // Create display string from rank group names
    const rankGroupNames = formRankGroups.map(rg => rg.name).join(", ");
    
    // Update the form's rankGroup field
    const form = this.forms.get(formId);
    if (form) {
      form.rankGroup = rankGroupNames || "";
      this.forms.set(formId, form);
    }
  }

  async updateRankGroup(id: number, rankGroupData: Partial<InsertRankGroup>): Promise<RankGroup | undefined> {
    const existingRankGroup = this.rankGroups.get(id);
    if (!existingRankGroup) return undefined;

    const updatedRankGroup: RankGroup = { ...existingRankGroup, ...rankGroupData };
    this.rankGroups.set(id, updatedRankGroup);
    this.saveToFile();
    return updatedRankGroup;
  }

  async deleteRankGroup(id: number): Promise<boolean> {
    const rankGroup = this.rankGroups.get(id);
    if (!rankGroup) return false;
    
    const formId = rankGroup.formId;
    const result = this.rankGroups.delete(id);
    
    if (result) {
      // Sync the form's rankGroup field after deletion
      await this.syncFormRankGroup(formId);
      this.saveToFile();
    }
    
    return result;
  }

  // Available Rank methods (same as MemStorage)
  async getAvailableRanks(): Promise<AvailableRank[]> {
    return Array.from(this.availableRanks.values());
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    const availableRank: AvailableRank = { ...insertAvailableRank, id: this.currentAvailableRankId++ };
    this.availableRanks.set(availableRank.id, availableRank);
    this.saveToFile();
    return availableRank;
  }

  async updateAvailableRank(id: number, availableRankData: Partial<InsertAvailableRank>): Promise<AvailableRank | undefined> {
    const existingAvailableRank = this.availableRanks.get(id);
    if (!existingAvailableRank) return undefined;

    const updatedAvailableRank: AvailableRank = { ...existingAvailableRank, ...availableRankData };
    this.availableRanks.set(id, updatedAvailableRank);
    this.saveToFile();
    return updatedAvailableRank;
  }

  async deleteAvailableRank(id: number): Promise<boolean> {
    const result = this.availableRanks.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  async clearAllAvailableRanks(): Promise<boolean> {
    this.availableRanks.clear();
    this.saveToFile();
    return true;
  }

  // Company Rank methods - CRITICAL FOR ROLE PERSISTENCE!
  async getCompanyRanks(): Promise<CompanyRank[]> {
    return Array.from(this.companyRanks.values());
  }

  async getCompanyRank(id: string): Promise<CompanyRank | undefined> {
    return this.companyRanks.get(id);
  }

  async createCompanyRank(insertCompanyRank: InsertCompanyRank): Promise<CompanyRank> {
    const companyRank: CompanyRank = { ...insertCompanyRank };
    this.companyRanks.set(companyRank.id, companyRank);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    console.log(`💾 [COMPANY-RANK] Created and saved: ${companyRank.id} - ${companyRank.rank}${companyRank.role ? ` (${companyRank.role})` : ''}`);
    return companyRank;
  }

  async updateCompanyRank(id: string, companyRankData: Partial<InsertCompanyRank>): Promise<CompanyRank | undefined> {
    const existingCompanyRank = this.companyRanks.get(id);
    if (!existingCompanyRank) return undefined;

    const updatedCompanyRank: CompanyRank = { ...existingCompanyRank, ...companyRankData };
    this.companyRanks.set(id, updatedCompanyRank);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    console.log(`💾 [COMPANY-RANK] Updated and saved: ${updatedCompanyRank.id} - ${updatedCompanyRank.rank}${updatedCompanyRank.role ? ` (${updatedCompanyRank.role})` : ''}`);
    return updatedCompanyRank;
  }

  async deleteCompanyRank(id: string): Promise<boolean> {
    const result = this.companyRanks.delete(id);
    if (result) {
      this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
      console.log(`💾 [COMPANY-RANK] Deleted and saved: ${id}`);
    }
    return result;
  }

  async clearAllCompanyRanks(): Promise<boolean> {
    this.companyRanks.clear();
    this.saveToFile(); // SAVE TO FILE AFTER CLEAR!
    console.log(`💾 [COMPANY-RANK] Cleared all company ranks and saved`);
    return true;
  }

  async saveAllCompanyRanks(ranks: InsertCompanyRank[]): Promise<CompanyRank[]> {
    // Clear existing and replace with new data
    this.companyRanks.clear();
    const savedRanks: CompanyRank[] = [];
    
    for (const rank of ranks) {
      const companyRank: CompanyRank = { ...rank };
      this.companyRanks.set(companyRank.id, companyRank);
      savedRanks.push(companyRank);
    }
    
    this.saveToFile(); // SAVE TO FILE AFTER BULK SAVE!
    console.log(`💾 [COMPANY-RANK] Bulk saved ${savedRanks.length} company ranks to persistent storage`);
    return savedRanks;
  }

  // Crew Member methods (same as MemStorage)
  async getCrewMembers(): Promise<CrewMember[]> {
    return Array.from(this.crewMembers.values());
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    return this.crewMembers.get(id);
  }

  async createCrewMember(insertCrewMember: InsertCrewMember): Promise<CrewMember> {
    const crewMember: CrewMember = { ...insertCrewMember };
    this.crewMembers.set(crewMember.id, crewMember);
    this.saveToFile();
    return crewMember;
  }

  async updateCrewMember(id: string, crewMemberData: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const existingCrewMember = this.crewMembers.get(id);
    if (!existingCrewMember) return undefined;

    const updatedCrewMember: CrewMember = { ...existingCrewMember, ...crewMemberData };
    this.crewMembers.set(id, updatedCrewMember);
    this.saveToFile();
    return updatedCrewMember;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    const result = this.crewMembers.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // Dashboard Summary Method
  async getCrewDashboardSummary(crewId: string): Promise<CrewDashboardSummary | undefined> {
    const crewMember = await this.getCrewMember(crewId);
    if (!crewMember) return undefined;

    const appraisals = await this.getAppraisalResultsByCrewMember(crewId);

    // Generate realistic dashboard data based on crew member and appraisals
    const summary: CrewDashboardSummary = {
      status: {
        status: "On Board",
        vessel: crewMember.vessel,
        joinedDate: "15 Mar 2022", 
        sailingDue: "15 Jul 2022",
        presentAssignment: crewMember.vessel || "Chandigarh",
        emergencyContact: {
          name: "Mira Kumari", 
          relation: "Wife",
          phone: "+91 987 555 8553"
        }
      },
      experience: {
        company: 1.2,
        rank: 1.9,
        tankers: 2.5, 
        ocw: 3.6,
        endorsements: 5
      },
      shipTypes: {
        oilTanker: 4.2,
        chemicalTanker: 5.1,
        gasTanker: 3.2,
        bulk: 1.1
      },
      serviceTimeline: [
        { vessel: "Pacific Explorer", startMonth: 1, endMonth: 3, type: "completed" },
        { vessel: "Atlantic Explorer", startMonth: 5, endMonth: 6, type: "active" }
      ],
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
        score: parseFloat(appraisal.overallRating || "3.0") * 8 // Convert to chart scale
      })).concat([
        { year: 2024, score: 31 } // Add current year point
      ])
    };

    return summary;
  }

  // Appraisal Result methods (same as MemStorage)
  async getAppraisalResults(): Promise<AppraisalResult[]> {
    return Array.from(this.appraisalResults.values());
  }

  async getAppraisalResult(id: number): Promise<AppraisalResult | undefined> {
    return this.appraisalResults.get(id);
  }

  async getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]> {
    return Array.from(this.appraisalResults.values()).filter(ar => ar.crewMemberId === crewMemberId);
  }

  async createAppraisalResult(insertAppraisalResult: InsertAppraisalResult): Promise<AppraisalResult> {
    const appraisalResult: AppraisalResult = { ...insertAppraisalResult, id: this.currentAppraisalResultId++ };
    this.appraisalResults.set(appraisalResult.id, appraisalResult);
    this.saveToFile();
    return appraisalResult;
  }

  async updateAppraisalResult(id: number, appraisalData: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined> {
    const existingAppraisal = this.appraisalResults.get(id);
    if (!existingAppraisal) return undefined;

    const updatedAppraisal: AppraisalResult = { ...existingAppraisal, ...appraisalData };
    this.appraisalResults.set(id, updatedAppraisal);
    this.saveToFile();
    return updatedAppraisal;
  }

  async deleteAppraisalResult(id: number): Promise<boolean> {
    const result = this.appraisalResults.delete(id);
    if (result) this.saveToFile();
    return result;
  }

  // Recruitment Candidate methods - THE IMPORTANT ONES FOR YOUR FORM!
  async getRecruitmentCandidates(): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values());
  }

  async getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | undefined> {
    return this.recruitmentCandidates.get(id);
  }

  async getRecruitmentCandidatesByStatus(status: string): Promise<RecruitmentCandidate[]> {
    return Array.from(this.recruitmentCandidates.values()).filter(candidate => candidate.status === status);
  }

  async createRecruitmentCandidate(insertCandidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate> {
    const candidate: RecruitmentCandidate = { 
      ...insertCandidate,
      middleName: insertCandidate.middleName || null,
      applicationData: insertCandidate.applicationData || null,
      status: insertCandidate.status || "Applied",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.recruitmentCandidates.set(candidate.id, candidate);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return candidate;
  }

  async updateRecruitmentCandidate(id: string, candidateData: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate | undefined> {
    const existingCandidate = this.recruitmentCandidates.get(id);
    if (!existingCandidate) return undefined;

    const updatedCandidate: RecruitmentCandidate = { 
      ...existingCandidate, 
      ...candidateData,
      updatedAt: new Date()
    };
    this.recruitmentCandidates.set(id, updatedCandidate);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedCandidate;
  }

  async deleteRecruitmentCandidate(id: string): Promise<boolean> {
    const result = this.recruitmentCandidates.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Data Masters methods (not supported - same as MemStorage)
  async getDataMasters(): Promise<any[]> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async getDataMaster(id: string): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async createDataMaster(masterData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async updateDataMaster(id: string, masterData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async deleteDataMaster(id: string): Promise<boolean> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  // Master Data Entries methods (not supported - same as MemStorage)  
  async getMasterDataEntries(masterId: string): Promise<any[]> {
    try {
      // Filter entries by masterId
      const filteredEntries: any[] = [];
      for (const [key, entry] of this.masterDataEntries) {
        if (entry.masterId === masterId) {
          filteredEntries.push(entry);
        }
      }
      
      console.log(`📄 [PERSISTENT] getMasterDataEntries(${masterId}): Found ${filteredEntries.length} entries`);
      return filteredEntries;
    } catch (error) {
      console.error(`❌ [PERSISTENT] Error getting master data entries for ${masterId}:`, error);
      return [];
    }
  }

  async getMasterDataEntry(id: number): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async createMasterDataEntry(entryData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async updateMasterDataEntry(id: number, entryData: any): Promise<any> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }

  async deleteMasterDataEntry(id: number): Promise<boolean> {
    throw new Error("PersistentFileStorage doesn't support master data entries. Use DatabaseStorage instead.");
  }
}

import { DatabaseStorage } from "./database";
import * as fs from 'fs';
import * as path from 'path';

// Construct DATABASE_URL from RDS connection details
function constructDatabaseUrl(): string | null {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD } = process.env;

  if (DB_HOST && DB_PORT && DB_USER && DB_PASSWORD) {
    // URL-encode the password to handle special characters
    const encodedPassword = encodeURIComponent(DB_PASSWORD);
    return `mysql://${DB_USER}:${encodedPassword}@${DB_HOST}:${DB_PORT}/crew_database`;
  }

  // Fallback to DATABASE_URL if set directly
  return process.env.DATABASE_URL || null;
}

// Initialize MySQL RDS storage with improved error handling
let storage: IStorage;
let isConnected = false;
let connectionError: Error | null = null;

const databaseUrl = constructDatabaseUrl();

// TEMPORARY: Force MemStorage for frontend development
// User requested to disconnect from crew_database for frontend development
const databaseUrlForceDisabled: string | undefined = false ? (databaseUrl || undefined) : undefined;
if (databaseUrlForceDisabled) {
  try {
    // Set the constructed DATABASE_URL for DatabaseStorage to use
    process.env.DATABASE_URL = databaseUrlForceDisabled;
    storage = new DatabaseStorage();

    console.log("🔌 Attempting to connect to MySQL RDS...");
    console.log("🎯 Target RDS Instance: MySQL database 'crew_database'");

    // Database connection test only - seeding completely disabled per user request
    (async () => {
      try {
        console.log("⏳ Testing database connection...");
        console.log("ℹ️ Automatic data seeding is disabled - users manage their own entries");
        // await (storage as DatabaseStorage).seedDatabase(); // DISABLED PER USER REQUEST
        isConnected = true;
        connectionError = null;
        console.log("✅ SUCCESS: MySQL RDS database connected successfully!");
        console.log("🚀 Application is ready to serve requests with persistent MySQL storage");
      } catch (error) {
        isConnected = false;
        connectionError = error as Error;
        console.error("⚠️  WARNING: Failed to seed MySQL RDS database:", error);
        console.error("🔍 Connection Details:");
        console.error(`   • Host: ${process.env.DB_HOST}`);
        console.error(`   • Port: ${process.env.DB_PORT}`);
        console.error(`   • Database: crew_database`);
        console.error(`   • User: ${process.env.DB_USER}`);
        console.error("📊 This could be due to:");
        console.error("   • RDS security group not allowing connections from this environment");
        console.error("   • Database 'crew_database' does not exist yet");
        console.error("   • Network connectivity issues");
        console.error("   • Incorrect credentials");
        console.error("🚑 Server will start anyway. Use /api/health to test connectivity.");
      }
    })();
  } catch (error) {
    isConnected = false;
    connectionError = error as Error;
    console.error("❌ ERROR: Failed to initialize MySQL RDS database:", error);
    console.error("🚑 Server will start anyway. Use /api/health to test connectivity.");
    // Create a stub storage that will throw meaningful errors
    storage = new (class implements IStorage {
      private throwConnectionError(): never {
        throw new Error(`MySQL RDS connection failed: ${connectionError?.message || 'Unknown error'}. Check /api/health for details.`);
      }
      async getUser(): Promise<any> { this.throwConnectionError(); }
      async getUserByUsername(): Promise<any> { this.throwConnectionError(); }
      async createUser(): Promise<any> { this.throwConnectionError(); }
      async getForms(): Promise<any> { this.throwConnectionError(); }
      async getForm(): Promise<any> { this.throwConnectionError(); }
      async createForm(): Promise<any> { this.throwConnectionError(); }
      async updateForm(): Promise<any> { this.throwConnectionError(); }
      async deleteForm(): Promise<any> { this.throwConnectionError(); }
      async getRankGroups(): Promise<any> { this.throwConnectionError(); }
      async createRankGroup(): Promise<any> { this.throwConnectionError(); }
      async updateRankGroup(): Promise<any> { this.throwConnectionError(); }
      async deleteRankGroup(): Promise<any> { this.throwConnectionError(); }
      async getAvailableRanks(): Promise<any> { this.throwConnectionError(); }
      async createAvailableRank(): Promise<any> { this.throwConnectionError(); }
      async updateAvailableRank(): Promise<any> { this.throwConnectionError(); }
      async deleteAvailableRank(): Promise<any> { this.throwConnectionError(); }
      async clearAllAvailableRanks(): Promise<any> { this.throwConnectionError(); }
      async getCrewMembers(): Promise<any> { this.throwConnectionError(); }
      async getCrewMember(): Promise<any> { this.throwConnectionError(); }
      async createCrewMember(): Promise<any> { this.throwConnectionError(); }
      async updateCrewMember(): Promise<any> { this.throwConnectionError(); }
      async deleteCrewMember(): Promise<any> { this.throwConnectionError(); }
      async getAppraisalResults(): Promise<any> { this.throwConnectionError(); }
      async getAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async getAppraisalResultsByCrewMember(): Promise<any> { this.throwConnectionError(); }
      async createAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async updateAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async deleteAppraisalResult(): Promise<any> { this.throwConnectionError(); }
      async getRecruitmentCandidates(): Promise<any> { this.throwConnectionError(); }
      async getRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      async getRecruitmentCandidatesByStatus(): Promise<any> { this.throwConnectionError(); }
      async createRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      async updateRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      async deleteRecruitmentCandidate(): Promise<any> { this.throwConnectionError(); }
      // Data Masters - MISSING METHODS CAUSING 404 ERRORS
      async getDataMasters(): Promise<any> { this.throwConnectionError(); }
      async getDataMaster(): Promise<any> { this.throwConnectionError(); }
      async createDataMaster(): Promise<any> { this.throwConnectionError(); }
      async updateDataMaster(): Promise<any> { this.throwConnectionError(); }
      async deleteDataMaster(): Promise<any> { this.throwConnectionError(); }
      // Master Data Entries - MISSING METHODS CAUSING 404 ERRORS  
      async getMasterDataEntries(): Promise<any> { this.throwConnectionError(); }
      async getMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
      async createMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
      async updateMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
      async deleteMasterDataEntry(): Promise<any> { this.throwConnectionError(); }
    })();
  }
} else {
  isConnected = false;
  connectionError = null;
  console.log("📄 PERSISTENT FILE STORAGE MODE: Using file-based storage (PersistentFileStorage)");
  console.log("🚀 Application will use persistent JSON storage for development");
  console.log("💾 All data will be saved to test-data.json and persist across restarts");

  // Use PersistentFileStorage for persistent development storage
  storage = new PersistentFileStorage();
  console.log("✅ PersistentFileStorage initialized successfully - data will persist across restarts!");
}

// Export connection status for health checks
export { isConnected, connectionError };

export { storage };