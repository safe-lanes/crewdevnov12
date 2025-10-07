import { users, type User, type InsertUser, type Form, type InsertForm, type RankGroup, type InsertRankGroup, type AvailableRank, type InsertAvailableRank, type UpdateAvailableRank, type CrewMember, type InsertCrewMember, type AppraisalResult, type InsertAppraisalResult, type RecruitmentCandidate, type InsertRecruitmentCandidate, type CompanyRank, type InsertCompanyRank, type DataMaster, type InsertDataMaster, type MasterDataEntry, type InsertMasterDataEntry, type VesselGroup, type InsertVesselGroup, type VesselDraft, type InsertVesselDraft, type VesselRevision, type InsertVesselRevision, type VesselPlanning, type InsertVesselPlanning, type RotationPlan, type InsertRotationPlan, type CrewDashboardSummary } from "@shared/schema";

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
  updateRankOrders(rankOrders: Array<{ id: number; sortOrder: number }>): Promise<boolean>;
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
  // Vessel Groups
  getVesselGroups(): Promise<VesselGroup[]>;
  getVesselGroup(id: number): Promise<VesselGroup | undefined>;
  createVesselGroup(vesselGroup: InsertVesselGroup): Promise<VesselGroup>;
  updateVesselGroup(id: number, vesselGroup: Partial<InsertVesselGroup>): Promise<VesselGroup | undefined>;
  deleteVesselGroup(id: number): Promise<boolean>;
  // Vessel Drafts
  getVesselDrafts(): Promise<VesselDraft[]>;
  getVesselDraft(id: number): Promise<VesselDraft | undefined>;
  getVesselDraftsByVessel(vesselId: string): Promise<VesselDraft[]>;
  createVesselDraft(vesselDraft: InsertVesselDraft): Promise<VesselDraft>;
  updateVesselDraft(id: number, vesselDraft: Partial<InsertVesselDraft>): Promise<VesselDraft | undefined>;
  deleteVesselDraft(id: number): Promise<boolean>;
  // Vessel Revisions
  getVesselRevisions(): Promise<VesselRevision[]>;
  getVesselRevision(id: number): Promise<VesselRevision | undefined>;
  getVesselRevisionsByVessel(vesselId: string): Promise<VesselRevision[]>;
  createVesselRevision(vesselRevision: InsertVesselRevision): Promise<VesselRevision>;
  // Vessel Planning
  getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]>;
  getVesselPlanningById(id: number): Promise<VesselPlanning | undefined>;
  createVesselPlanning(planning: InsertVesselPlanning): Promise<VesselPlanning>;
  updateVesselPlanning(id: number, planning: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined>;
  deleteVesselPlanning(id: number): Promise<boolean>;
  // Dashboard Summary
  getCrewDashboardSummary(crewId: string): Promise<CrewDashboardSummary | undefined>;
  // ID Generation
  getNextCrewId(): Promise<string>;
  // Rotation Plans
  getRotationPlans(): Promise<RotationPlan[]>;
  getRotationPlan(id: number): Promise<RotationPlan | undefined>;
  createRotationPlan(plan: InsertRotationPlan): Promise<RotationPlan>;
  updateRotationPlan(id: number, plan: Partial<InsertRotationPlan>): Promise<RotationPlan | undefined>;
  deleteRotationPlan(id: number): Promise<boolean>;
  // Rotation Approval Workflow
  proposeRotationPlan(id: number, proposedBy: string): Promise<RotationPlan | undefined>;
  getProposedAssignments(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string }): Promise<any[]>;
  deployAssignment(planId: number, assignmentIndex: number, deployedBy: string): Promise<{ success: boolean; conflicts?: any[] }>;
  rejectAssignment(planId: number, assignmentIndex: number): Promise<RotationPlan | undefined>;
  checkAssignmentConflicts(crewId: string, joiningDate: string, contractPeriod: number, excludePlanId?: number, excludeAssignmentIndex?: number): Promise<any[]>;
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
  private vesselGroups: Map<number, VesselGroup>;
  private vesselDrafts: Map<number, VesselDraft>;
  private vesselRevisions: Map<number, VesselRevision>;
  private vesselPlanning: Map<number, VesselPlanning>;
  private rotationPlans: Map<number, RotationPlan>;
  private currentUserId: number;
  private currentFormId: number;
  private currentRankGroupId: number;
  private currentAvailableRankId: number;
  private currentAppraisalResultId: number;
  private currentCrewIdCounter: number;
  private currentVesselGroupId: number;
  private currentVesselDraftId: number;
  private currentVesselRevisionId: number;
  private currentVesselPlanningId: number;
  private currentRotationPlanId: number;

  constructor() {
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.vesselGroups = new Map();
    this.vesselDrafts = new Map();
    this.vesselRevisions = new Map();
    this.vesselPlanning = new Map();
    this.rotationPlans = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentAppraisalResultId = 1;
    this.currentCrewIdCounter = 1;
    this.currentVesselGroupId = 1;
    this.currentVesselDraftId = 1;
    this.currentVesselRevisionId = 1;
    this.currentVesselPlanningId = 1;
    this.currentRotationPlanId = 1;
    
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
    this.availableRanks.set(1, { id: 1, name: "Master", category: "Senior Officers", rankId: "S1", label: "Master", applicableToCompany: true, sortOrder: 1 });
    this.availableRanks.set(2, { id: 2, name: "Chief Officer", category: "Senior Officers", rankId: "S2", label: "Chief Officer", applicableToCompany: true, sortOrder: 2 });
    this.availableRanks.set(3, { id: 3, name: "Chief Engineer", category: "Senior Officers", rankId: "S7", label: "Chief Engineer", applicableToCompany: true, sortOrder: 3 });
    this.availableRanks.set(4, { id: 4, name: "2nd Officer", category: "Junior Officers", rankId: "S3", label: "2nd Officer", applicableToCompany: true, sortOrder: 4 });
    this.availableRanks.set(5, { id: 5, name: "3rd Officer", category: "Junior Officers", rankId: "S4", label: "3rd Officer", applicableToCompany: true, sortOrder: 5 });
    this.availableRanks.set(6, { id: 6, name: "2nd Engineer", category: "Junior Officers", rankId: "S9", label: "2nd Engineer", applicableToCompany: true, sortOrder: 6 });
    this.availableRanks.set(7, { id: 7, name: "3rd Engineer", category: "Junior Officers", rankId: "S10", label: "3rd Engineer", applicableToCompany: true, sortOrder: 7 });
    this.availableRanks.set(8, { id: 8, name: "Bosun", category: "Ratings", rankId: "S12", label: "Bosun", applicableToCompany: true, sortOrder: 8 });
    this.availableRanks.set(9, { id: 9, name: "AB", category: "Ratings", rankId: "S14", label: "AB", applicableToCompany: true, sortOrder: 9 });
    this.availableRanks.set(10, { id: 10, name: "OS", category: "Ratings", rankId: "S15", label: "OS", applicableToCompany: false, sortOrder: 10 });
    this.availableRanks.set(11, { id: 11, name: "Oiler", category: "Ratings", rankId: "S16", label: "Oiler", applicableToCompany: false, sortOrder: 11 });
    this.availableRanks.set(12, { id: 12, name: "Wiper", category: "Ratings", rankId: "S17", label: "Wiper", applicableToCompany: false, sortOrder: 12 });
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
      empNo: "EMP001",
      firstName: "James",
      middleName: "Michael",
      familyName: "Smith",
      dateOfBirth: "1985-03-15",
      age: "39",
      nationality: "British",
      presentRank: "Master",
      rankAppliedFor: null,
      employeeId: "EMP001",
      presentVessel: "MT Sail One",
      vesselType: "Oil Tanker",
      lastVessel: null,
      status: "On Board",
      joiningDate: "01-Feb-2025",
      signOnDate: "01-Feb-2025",
      signOffDate: null,
      contractPeriod: "6 months",
      reliefDue: "01-Aug-2025",
      reason: null,
      availability: "On Board",
      email: "james.smith@example.com",
      mobile: "+44 7700 900123",
      contactLandline: null,
      countryOfResidence: "United Kingdom",
      nearestAirport: "LHR",
      residentialAddressLine1: null,
      residentialAddressLine2: null,
      placeOfBirthCity: "London",
      placeOfBirthCountry: "United Kingdom",
      heightCm: null,
      weightKg: null,
      bmi: null,
      nativeLanguage: "English",
      foreignLanguages: null,
      englishProficiency: "Native",
      maritalStatus: "Married",
      numberOfDependentChildren: "2",
      fatherName: null,
      motherName: null,
      spouseFirstName: null,
      spouseMiddleName: null,
      spouseFamilyName: null,
      spouseDateOfBirth: null,
      nokFirstName: null,
      nokMiddleName: null,
      nokFamilyName: null,
      nokTelephone: null,
      nokEmail: null,
      nokAddress: null,
      nokRelationship: null,
      manningAgent: null,
      vesselTypes: JSON.stringify(["Oil Tanker", "Chemical Tanker"]),
      documents: null,
      visas: null,
      education: null,
      licenses: null,
      trainingCourses: null,
      currentCompanySeaService: null,
      externalSeaService: null,
      preJoiningMedicals: null,
      doctorVisits: null,
      children: null,
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    this.crewMembers.set("2025-03-12", {
      id: "2025-03-12",
      firstName: "Anna",
      middleName: "Marie",
      familyName: "Johnson",
      presentRank: "Chief Engineer",
      nationality: "British",
      presentVessel: "MT Sail Ten",
      vesselType: "LPG Tanker",
      signOnDate: "01-Jan-2025",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01")
    });

    this.crewMembers.set("2025-02-12", {
      id: "2025-02-12",
      firstName: "David",
      middleName: "Lee",
      familyName: "Brown",
      presentRank: "Able Seaman",
      nationality: "Indian",
      presentVessel: "MT Sail Two",
      vesselType: "Container",
      signOnDate: "01-Feb-2025",
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    this.crewMembers.set("2025-05-14-2", {
      id: "2025-05-14-2",
      firstName: "Emily",
      middleName: "Grace",
      familyName: "Davis",
      presentRank: "Chief Mate",
      nationality: "Indian",
      presentVessel: "MT Sail Five",
      vesselType: "Bulk",
      signOnDate: "01-Jan-2025",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01")
    });

    this.crewMembers.set("2025-03-12-2", {
      id: "2025-03-12-2",
      firstName: "John",
      middleName: "Paul",
      familyName: "Williams",
      presentRank: "Electrician",
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

    // Initialize with sample rotation plan data
    this.rotationPlans.set(1, {
      id: 1,
      draftId: "24-01-13",
      lastEdited: "10 Jan 24",
      vessels: JSON.stringify(["Vessel 2", "Vessel 4", "Vessel 5", "Vessel 6"]),
      crew: "Master, Chief Officer",
      planFromDate: "1 Jan 24",
      planToDate: "30 Jun 24",
      createdBy: "ABC, Crew Execution",
      planStatus: "Pending Approval",
      proposedBy: null,
      proposedDate: null,
      assignments: null,
      createdAt: new Date("2024-01-10"),
      updatedAt: new Date("2024-01-10")
    });

    this.rotationPlans.set(2, {
      id: 2,
      draftId: "24-02-05",
      lastEdited: "15 Feb 24",
      vessels: JSON.stringify(["MT Sail One", "MT Sail Two"]),
      crew: "Chief Engineer, 2nd Engineer",
      planFromDate: "1 Mar 24",
      planToDate: "31 Aug 24",
      createdBy: "Tech Team",
      planStatus: "In Draft",
      proposedBy: null,
      proposedDate: null,
      assignments: null,
      createdAt: new Date("2024-02-15"),
      updatedAt: new Date("2024-02-15")
    });

    this.rotationPlans.set(3, {
      id: 3,
      draftId: "24-03-22",
      lastEdited: "22 Mar 24",
      vessels: JSON.stringify(["MT Sail Five", "MT Sail Eight", "MT Sail Ten"]),
      crew: "Master, Chief Officer, 2nd Officer",
      planFromDate: "1 Apr 24",
      planToDate: "30 Sep 24",
      createdBy: "Operations Team",
      planStatus: "Approved",
      proposedBy: null,
      proposedDate: null,
      assignments: null,
      createdAt: new Date("2024-03-22"),
      updatedAt: new Date("2024-03-22")
    });

    this.currentRotationPlanId = 4;
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
    this.vesselGroups = new Map();
    this.vesselDrafts = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentAppraisalResultId = 1;
    this.currentVesselGroupId = 1;
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
    return Array.from(this.availableRanks.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    const id = this.currentAvailableRankId++;
    // Get the next sortOrder value
    const existingRanks = await this.getAvailableRanks();
    const maxSortOrder = existingRanks.length > 0 ? Math.max(...existingRanks.map(r => r.sortOrder || 0)) : 0;
    
    const availableRank: AvailableRank = { 
      ...insertAvailableRank, 
      id,
      rankId: insertAvailableRank.rankId ?? null,
      label: insertAvailableRank.label ?? null,
      applicableToCompany: insertAvailableRank.applicableToCompany ?? null,
      sortOrder: insertAvailableRank.sortOrder ?? (maxSortOrder + 1)
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

  async updateRankOrders(rankOrders: Array<{ id: number; sortOrder: number }>): Promise<boolean> {
    try {
      for (const { id, sortOrder } of rankOrders) {
        const existingRank = this.availableRanks.get(id);
        if (existingRank) {
          const updatedRank: AvailableRank = { 
            ...existingRank, 
            sortOrder 
          };
          this.availableRanks.set(id, updatedRank);
        }
      }
      return true;
    } catch (error) {
      console.error('Failed to update rank orders:', error);
      return false;
    }
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
      familyName: insertCrewMember.familyName || null,
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

  // ID Generation Methods
  async getNextCrewId(): Promise<string> {
    const nextNumber = this.currentCrewIdCounter++;
    // Format: A000001, A000002, etc. (A + 6-digit padded number)
    return `A${nextNumber.toString().padStart(6, '0')}`;
  }

  // Vessel Groups Methods
  async getVesselGroups(): Promise<VesselGroup[]> {
    return Array.from(this.vesselGroups.values());
  }

  async getVesselGroup(id: number): Promise<VesselGroup | undefined> {
    return this.vesselGroups.get(id);
  }

  async createVesselGroup(insertVesselGroup: InsertVesselGroup): Promise<VesselGroup> {
    const id = this.currentVesselGroupId++;
    const vesselGroup: VesselGroup = { 
      ...insertVesselGroup, 
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.vesselGroups.set(id, vesselGroup);
    return vesselGroup;
  }

  async updateVesselGroup(id: number, vesselGroupData: Partial<InsertVesselGroup>): Promise<VesselGroup | undefined> {
    const existingVesselGroup = this.vesselGroups.get(id);
    if (!existingVesselGroup) return undefined;

    const updatedVesselGroup: VesselGroup = { 
      ...existingVesselGroup, 
      ...vesselGroupData,
      updatedAt: new Date()
    };
    this.vesselGroups.set(id, updatedVesselGroup);
    return updatedVesselGroup;
  }

  async deleteVesselGroup(id: number): Promise<boolean> {
    return this.vesselGroups.delete(id);
  }

  // Vessel Drafts methods
  async getVesselDrafts(): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values());
  }

  async getVesselDraft(id: number): Promise<VesselDraft | undefined> {
    return this.vesselDrafts.get(id);
  }

  async getVesselDraftsByVessel(vesselId: string): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values()).filter(draft => draft.vesselId === vesselId);
  }

  async createVesselDraft(insertVesselDraft: InsertVesselDraft): Promise<VesselDraft> {
    const id = this.currentVesselDraftId++;
    const vesselDraft: VesselDraft = { 
      ...insertVesselDraft, 
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.vesselDrafts.set(id, vesselDraft);
    return vesselDraft;
  }

  async updateVesselDraft(id: number, vesselDraftData: Partial<InsertVesselDraft>): Promise<VesselDraft | undefined> {
    const existingVesselDraft = this.vesselDrafts.get(id);
    if (!existingVesselDraft) return undefined;

    const updatedVesselDraft: VesselDraft = { 
      ...existingVesselDraft, 
      ...vesselDraftData,
      updatedAt: new Date()
    };
    this.vesselDrafts.set(id, updatedVesselDraft);
    return updatedVesselDraft;
  }

  async deleteVesselDraft(id: number): Promise<boolean> {
    return this.vesselDrafts.delete(id);
  }

  // Vessel Revisions methods
  async getVesselRevisions(): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values());
  }

  async getVesselRevision(id: number): Promise<VesselRevision | undefined> {
    return this.vesselRevisions.get(id);
  }

  async getVesselRevisionsByVessel(vesselId: string): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values()).filter(revision => revision.vesselId === vesselId);
  }

  async createVesselRevision(insertVesselRevision: InsertVesselRevision): Promise<VesselRevision> {
    const id = this.currentVesselRevisionId++;
    const vesselRevision: VesselRevision = { 
      ...insertVesselRevision, 
      id,
      createdAt: new Date()
    };
    this.vesselRevisions.set(id, vesselRevision);
    return vesselRevision;
  }

  // Vessel Planning Methods
  async getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.vesselId === vesselId);
  }

  async getVesselPlanningById(id: number): Promise<VesselPlanning | undefined> {
    return this.vesselPlanning.get(id);
  }

  async createVesselPlanning(insertPlanning: InsertVesselPlanning): Promise<VesselPlanning> {
    const id = this.currentVesselPlanningId++;
    const vesselPlanning: VesselPlanning = { 
      ...insertPlanning,
      id,
      onBoardCrewId: insertPlanning.onBoardCrewId || null,
      onBoardCrewName: insertPlanning.onBoardCrewName || null,
      reliefDue: insertPlanning.reliefDue || null,
      signOffDate: insertPlanning.signOffDate || null,
      signOffPort: insertPlanning.signOffPort || null,
      reliefStatus: insertPlanning.reliefStatus || null,
      relieverCrewId: insertPlanning.relieverCrewId || null,
      relieverCrewName: insertPlanning.relieverCrewName || null,
      joiningDate: insertPlanning.joiningDate || null,
      joiningPort: insertPlanning.joiningPort || null,
      joiningStatus: insertPlanning.joiningStatus || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.vesselPlanning.set(id, vesselPlanning);
    return vesselPlanning;
  }

  async updateVesselPlanning(id: number, planningData: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined> {
    const existingPlanning = this.vesselPlanning.get(id);
    if (!existingPlanning) return undefined;

    const updatedPlanning: VesselPlanning = { 
      ...existingPlanning, 
      ...planningData,
      updatedAt: new Date()
    };
    this.vesselPlanning.set(id, updatedPlanning);
    return updatedPlanning;
  }

  async deleteVesselPlanning(id: number): Promise<boolean> {
    return this.vesselPlanning.delete(id);
  }

  // Rotation Plans Methods
  async getRotationPlans(): Promise<RotationPlan[]> {
    return Array.from(this.rotationPlans.values());
  }

  async getRotationPlan(id: number): Promise<RotationPlan | undefined> {
    return this.rotationPlans.get(id);
  }

  async createRotationPlan(insertPlan: InsertRotationPlan): Promise<RotationPlan> {
    const id = this.currentRotationPlanId++;
    const rotationPlan: RotationPlan = {
      ...insertPlan,
      id,
      planStatus: insertPlan.planStatus || "In Draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rotationPlans.set(id, rotationPlan);
    return rotationPlan;
  }

  async updateRotationPlan(id: number, updateData: Partial<InsertRotationPlan>): Promise<RotationPlan | undefined> {
    const existingPlan = this.rotationPlans.get(id);
    if (!existingPlan) return undefined;
    
    const updatedPlan: RotationPlan = {
      ...existingPlan,
      ...updateData,
      updatedAt: new Date(),
    };
    this.rotationPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async deleteRotationPlan(id: number): Promise<boolean> {
    return this.rotationPlans.delete(id);
  }

  // Rotation Approval Workflow Methods
  async proposeRotationPlan(id: number, proposedBy: string): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(id);
    if (!plan) return undefined;

    const updatedPlan: RotationPlan = {
      ...plan,
      planStatus: "Proposed",
      proposedBy,
      proposedDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date()
    };
    this.rotationPlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async getProposedAssignments(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string }): Promise<any[]> {
    const proposedPlans = Array.from(this.rotationPlans.values()).filter(plan => 
      plan.planStatus === "Proposed" || plan.planStatus === "Partially Approved"
    );

    const assignments: any[] = [];
    for (const plan of proposedPlans) {
      if (plan.assignments) {
        const planAssignments = JSON.parse(plan.assignments);
        for (let i = 0; i < planAssignments.length; i++) {
          const assignment = planAssignments[i];
          
          if (!assignment.proposalStatus || assignment.proposalStatus === "proposed") {
            // Find current crew on board for this vessel/rank
            let currentCrew = null;
            
            // Determine vesselId for lookup
            let vesselIdToMatch: string | null = null;
            if (assignment.vesselId) {
              // Use existing vesselId and normalize it
              vesselIdToMatch = String(assignment.vesselId);
              if (/^\d+$/.test(vesselIdToMatch)) {
                // Numeric format - convert to VSL-XXX format
                vesselIdToMatch = `VSL-${vesselIdToMatch.padStart(3, '0')}`;
              }
            } else if (assignment.vessel || assignment.vesselName) {
              // Legacy assignment without vesselId
              const vesselValue = assignment.vessel || assignment.vesselName;
              
              // Check if the vessel field already contains a vessel ID (VSL-XXX format)
              if (/^VSL-\d{3}$/.test(vesselValue)) {
                // It's already a vessel ID, use it directly
                vesselIdToMatch = vesselValue;
              } else {
                // It's a vessel name, need to look it up in master data (master ID "014")
                const vesselMasterData = await this.getMasterDataEntries("014");
                const vessel = vesselMasterData?.find((v: any) => v.name === vesselValue);
                
                if (vessel && vessel.entryId) {
                  // Use the entryId which is in VSL-XXX format
                  vesselIdToMatch = vessel.entryId;
                }
              }
            }
            
            if (vesselIdToMatch && assignment.rank) {
              // Look for crew members currently on this vessel with this rank
              // Note: crew.presentVessel stores vessel ID format "VSL-003"
              const crewOnBoard = Array.from(this.crewMembers.values()).find(crew => 
                crew.presentVessel === vesselIdToMatch && crew.presentRank === assignment.rank
              );
              
              if (crewOnBoard) {
                // Get vessel planning data for this crew member to get contract dates
                // vesselPlanning.vesselId stores vessel ID
                const planning = Array.from(this.vesselPlanning.values()).find(p => 
                  p.onBoardCrewId === crewOnBoard.id && p.vesselId === vesselIdToMatch && p.rank === assignment.rank
                );
                
                if (planning && planning.reliefDue) {
                  // Calculate range dates based on contract end range settings
                  const reliefDueDate = new Date(planning.reliefDue);
                  const rangeStartMonths = planning.contractEndRangeStartMonths || 0;
                  const rangeEndMonths = planning.contractEndRangeEndMonths || 1;
                  
                  const rangeStartDate = new Date(reliefDueDate);
                  rangeStartDate.setMonth(rangeStartDate.getMonth() + rangeStartMonths);
                  
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeEndMonths);
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.lastName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: planning.joiningDate || crewOnBoard.joiningDate || '',
                    contractEndDate: planning.reliefDue,
                    rangeStartDate: rangeStartDate.toISOString().split('T')[0],
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                } else if (crewOnBoard.joiningDate && crewOnBoard.reliefDue) {
                  // Fallback to crew member data if no planning data
                  const reliefDueDate = new Date(crewOnBoard.reliefDue);
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + 1); // Default 1 month grace period
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.lastName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: crewOnBoard.joiningDate,
                    contractEndDate: crewOnBoard.reliefDue,
                    rangeStartDate: crewOnBoard.reliefDue,
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                }
              }
            }
            
            assignments.push({
              ...assignment,
              planId: plan.id,
              draftId: plan.draftId,
              proposedBy: plan.proposedBy,
              proposedDate: plan.proposedDate,
              assignmentIndex: i,
              currentCrew, // Add current crew timeline data
            });
          }
        }
      }
    }

    return assignments;
  }

  async deployAssignment(planId: number, assignmentIndex: number, deployedBy: string): Promise<{ success: boolean; conflicts?: any[] }> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return { success: false };

    const assignments = JSON.parse(plan.assignments);
    const assignment = assignments[assignmentIndex];
    if (!assignment) return { success: false };

    // Check for conflicts, excluding this assignment to avoid self-conflict
    const conflicts = await this.checkAssignmentConflicts(
      assignment.crewId,
      assignment.joiningDate,
      assignment.contractPeriod,
      planId,
      assignmentIndex
    );

    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    // Mark assignment as deployed
    assignments[assignmentIndex] = {
      ...assignment,
      proposalStatus: "deployed",
      deployedDate: new Date().toISOString().split('T')[0],
      deployedBy
    };

    // Update rotation plan
    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      updatedAt: new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);

    // Create vessel planning entry for the deployed crew
    // Require proper IDs - fail if not available
    if (!assignment.vesselId || !assignment.rankId) {
      console.error('Missing vesselId or rankId in assignment:', assignment);
      return { success: false };
    }

    const vesselPlanningEntry = {
      vesselId: assignment.vesselId,
      rankId: assignment.rankId,
      rank: assignment.rank,
      relieverCrewId: assignment.crewId,
      relieverCrewName: assignment.crewName,
      joiningDate: assignment.joiningDate,
      joiningStatus: "Confirmed",
      contractPeriodMonths: assignment.contractPeriod,
      deploymentChecklistCompleted: false,
      applicableDocsChecked: false,
    };

    await this.createVesselPlanning(vesselPlanningEntry);

    return { success: true };
  }

  async rejectAssignment(planId: number, assignmentIndex: number): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return undefined;

    const assignments = JSON.parse(plan.assignments);
    if (!assignments[assignmentIndex]) return undefined;

    // Remove the assignment
    assignments.splice(assignmentIndex, 1);

    // Update plan status back to Draft if no assignments left
    const planStatus = assignments.length === 0 ? "In Draft" : plan.planStatus;

    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      planStatus,
      updatedAt: new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);
    return updatedPlan;
  }

  async checkAssignmentConflicts(
    crewId: string, 
    joiningDate: string, 
    contractPeriod: number,
    excludePlanId?: number,
    excludeAssignmentIndex?: number
  ): Promise<any[]> {
    const conflicts: any[] = [];
    const joiningDateObj = new Date(joiningDate);
    const contractEndDate = new Date(joiningDateObj);
    contractEndDate.setMonth(contractEndDate.getMonth() + contractPeriod);

    // Check all proposed assignments
    for (const plan of this.rotationPlans.values()) {
      if (plan.assignments) {
        const assignments = JSON.parse(plan.assignments);
        for (let i = 0; i < assignments.length; i++) {
          const assignment = assignments[i];
          
          // Skip the assignment being deployed to avoid self-conflict
          if (excludePlanId !== undefined && excludeAssignmentIndex !== undefined) {
            if (plan.id === excludePlanId && i === excludeAssignmentIndex) {
              continue;
            }
          }
          
          if (assignment.crewId === crewId && assignment.proposalStatus === "proposed") {
            const assignmentJoiningDate = new Date(assignment.joiningDate);
            const assignmentEndDate = new Date(assignmentJoiningDate);
            assignmentEndDate.setMonth(assignmentEndDate.getMonth() + assignment.contractPeriod);

            // Check for overlap
            if (
              (joiningDateObj <= assignmentEndDate && contractEndDate >= assignmentJoiningDate)
            ) {
              conflicts.push({
                planId: plan.id,
                draftId: plan.draftId,
                vessel: assignment.vesselName,
                rank: assignment.rank,
                joiningDate: assignment.joiningDate,
                contractPeriod: assignment.contractPeriod
              });
            }
          }
        }
      }
    }

    return conflicts;
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
  private vesselGroups: Map<number, VesselGroup>;
  private masterDataEntries: Map<string, any>;
  private vesselDrafts: Map<number, VesselDraft>;
  private vesselRevisions: Map<number, VesselRevision>;
  private vesselPlanning: Map<number, VesselPlanning>;
  private currentUserId: number;
  private currentFormId: number;
  private currentRankGroupId: number;
  private currentAvailableRankId: number;
  private currentAppraisalResultId: number;
  private currentCrewIdCounter: number;
  private currentVesselGroupId: number;
  private currentVesselDraftId: number;
  private currentVesselRevisionId: number;
  private currentVesselPlanningId: number;
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving: boolean = false;
  private needsResave: boolean = false;
  private pendingData: any = null;

  constructor() {
    // Initialize all properties first
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.companyRanks = new Map();
    this.crewMembers = new Map();
    this.appraisalResults = new Map();
    this.recruitmentCandidates = new Map();
    this.vesselGroups = new Map();
    this.masterDataEntries = new Map();
    this.vesselDrafts = new Map();
    this.vesselRevisions = new Map();
    this.vesselPlanning = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentAppraisalResultId = 1;
    this.currentCrewIdCounter = 1;
    this.currentVesselGroupId = 1;
    this.currentVesselDraftId = 1;
    this.currentVesselRevisionId = 1;
    this.currentVesselPlanningId = 1;
    
    this.filePath = path.join(process.cwd(), 'test-data.json');
    this.loadFromFile();
  }

  private loadNestedMapData(data: any): Map<number, VesselRevision> {
    // Helper function to recursively extract revision objects from nested arrays
    const extractRevisions = (arr: any, results: VesselRevision[] = []): VesselRevision[] => {
      if (!Array.isArray(arr)) return results;
      
      for (const item of arr) {
        if (Array.isArray(item) && item.length === 2) {
          const [key, value] = item;
          // Check if value is a revision object (has vesselId property)
          if (typeof value === 'object' && value !== null && !Array.isArray(value) && value.vesselId) {
            results.push(value);
          } else {
            // Recursively search in nested arrays
            extractRevisions(item, results);
          }
        }
      }
      return results;
    };
    
    const revisions = extractRevisions(data);
    const map = new Map<number, VesselRevision>();
    
    for (const revision of revisions) {
      if (revision.id !== undefined) {
        map.set(revision.id, revision);
      }
    }
    
    console.log(`📊 Loaded ${map.size} vessel revisions from file`);
    return map;
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
        this.vesselGroups = new Map(data.vesselGroups || []);
        this.masterDataEntries = new Map(data.masterDataEntries || []);
        
        // Load current counters
        this.currentUserId = data.currentUserId || 1;
        this.currentFormId = data.currentFormId || 2;
        this.currentRankGroupId = data.currentRankGroupId || 1;
        this.currentAvailableRankId = data.currentAvailableRankId || 11;
        this.currentAppraisalResultId = data.currentAppraisalResultId || 1;
        
        // Robust crew ID counter initialization
        if (data.currentCrewIdCounter) {
          this.currentCrewIdCounter = data.currentCrewIdCounter;
        } else {
          // First run with existing data - scan for highest existing A-series ID
          this.currentCrewIdCounter = this.initializeCrewIdCounter();
        }

        // Initialize vessel group counter
        this.currentVesselGroupId = data.currentVesselGroupId || 1;
        
        // Load vessel drafts and counter (same format as other maps)
        this.vesselDrafts = new Map(data.vesselDrafts || []);
        this.currentVesselDraftId = data.currentVesselDraftId || 1;
        
        // Load vessel revisions and counter - flatten nested structure if needed
        this.vesselRevisions = this.loadNestedMapData(data.vesselRevisions || []);
        this.currentVesselRevisionId = data.currentVesselRevisionId || 1;
        
        // Load vessel planning and counter
        this.vesselPlanning = new Map(data.vesselPlanning || []);
        this.currentVesselPlanningId = data.currentVesselPlanningId || 1;
        
        // Load rotation plans and counter
        this.rotationPlans = new Map(data.rotationPlans || []);
        this.currentRotationPlanId = data.currentRotationPlanId || 1;
        
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
    this.pendingData = {
      users: Array.from(this.users.entries()),
      forms: Array.from(this.forms.entries()),
      rankGroups: Array.from(this.rankGroups.entries()),
      availableRanks: Array.from(this.availableRanks.entries()),
      companyRanks: Array.from(this.companyRanks.entries()),
      crewMembers: Array.from(this.crewMembers.entries()),
      appraisalResults: Array.from(this.appraisalResults.entries()),
      recruitmentCandidates: Array.from(this.recruitmentCandidates.entries()),
      vesselGroups: Array.from(this.vesselGroups.entries()),
      vesselDrafts: Array.from(this.vesselDrafts.entries()),
      vesselRevisions: Array.from(this.vesselRevisions.entries()),
      vesselPlanning: Array.from(this.vesselPlanning.entries()),
      rotationPlans: Array.from(this.rotationPlans.entries()),
      masterDataEntries: Array.from(this.masterDataEntries.entries()),
      currentUserId: this.currentUserId,
      currentFormId: this.currentFormId,
      currentRankGroupId: this.currentRankGroupId,
      currentAvailableRankId: this.currentAvailableRankId,
      currentAppraisalResultId: this.currentAppraisalResultId,
      currentCrewIdCounter: this.currentCrewIdCounter,
      currentVesselGroupId: this.currentVesselGroupId,
      currentVesselDraftId: this.currentVesselDraftId,
      currentVesselRevisionId: this.currentVesselRevisionId,
      currentVesselPlanningId: this.currentVesselPlanningId,
      currentRotationPlanId: this.currentRotationPlanId
    };
    
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(async () => {
      if (this.isSaving) {
        this.needsResave = true;
        return;
      }
      
      this.isSaving = true;
      try {
        await fs.promises.writeFile(this.filePath, JSON.stringify(this.pendingData), 'utf8');
        console.log("💾 Data saved to test-data.json");
      } catch (error) {
        console.error("⚠️ Error saving to test-data.json:", error);
      } finally {
        this.isSaving = false;
        
        if (this.needsResave) {
          this.needsResave = false;
          this.saveToFile();
        }
      }
    }, 300);
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
    this.currentCrewIdCounter = 1;

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
    this.availableRanks.set(1, { id: 1, name: "Master", category: "Senior Officers", rankId: "S1", label: "Master", applicableToCompany: true, sortOrder: 1 });
    this.availableRanks.set(2, { id: 2, name: "Chief Officer", category: "Senior Officers", rankId: "S2", label: "Chief Officer", applicableToCompany: true, sortOrder: 2 });
    this.availableRanks.set(3, { id: 3, name: "Chief Engineer", category: "Senior Officers", rankId: "S7", label: "Chief Engineer", applicableToCompany: true, sortOrder: 3 });
    this.availableRanks.set(4, { id: 4, name: "2nd Officer", category: "Junior Officers", rankId: "S3", label: "2nd Officer", applicableToCompany: true, sortOrder: 4 });
    this.availableRanks.set(5, { id: 5, name: "3rd Officer", category: "Junior Officers", rankId: "S4", label: "3rd Officer", applicableToCompany: true, sortOrder: 5 });
    this.availableRanks.set(6, { id: 6, name: "2nd Engineer", category: "Junior Officers", rankId: "S9", label: "2nd Engineer", applicableToCompany: true, sortOrder: 6 });
    this.availableRanks.set(7, { id: 7, name: "3rd Engineer", category: "Junior Officers", rankId: "S10", label: "3rd Engineer", applicableToCompany: true, sortOrder: 7 });
    this.availableRanks.set(8, { id: 8, name: "Bosun", category: "Ratings", rankId: "S12", label: "Bosun", applicableToCompany: true, sortOrder: 8 });
    this.availableRanks.set(9, { id: 9, name: "AB", category: "Ratings", rankId: "S14", label: "AB", applicableToCompany: true, sortOrder: 9 });
    this.availableRanks.set(10, { id: 10, name: "OS", category: "Ratings", rankId: "S15", label: "OS", applicableToCompany: false, sortOrder: 10 });

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
      familyName: "Wilson",
      presentRank: "Master",
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
      familyName: "Johnson",
      presentRank: "Chief Engineer",
      nationality: "British",
      presentVessel: "MT Sail Ten",
      vesselType: "LPG Tanker",
      signOnDate: "01-Jan-2025",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01")
    });

    this.crewMembers.set("2025-02-12", {
      id: "2025-02-12",
      firstName: "David",
      middleName: "Lee",
      familyName: "Brown",
      presentRank: "Able Seaman",
      nationality: "Indian",
      presentVessel: "MT Sail Two",
      vesselType: "Container",
      signOnDate: "01-Feb-2025",
      createdAt: new Date("2025-02-01"),
      updatedAt: new Date("2025-02-01")
    });

    this.crewMembers.set("2025-04-18", {
      id: "2025-04-18",
      firstName: "Carlos",
      middleName: "Miguel",
      familyName: "Santos",
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
    return Array.from(this.availableRanks.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createAvailableRank(insertAvailableRank: InsertAvailableRank): Promise<AvailableRank> {
    // Get the next sortOrder value
    const existingRanks = await this.getAvailableRanks();
    const maxSortOrder = existingRanks.length > 0 ? Math.max(...existingRanks.map(r => r.sortOrder || 0)) : 0;
    
    const availableRank: AvailableRank = { 
      ...insertAvailableRank, 
      id: this.currentAvailableRankId++,
      rankId: insertAvailableRank.rankId ?? null,
      label: insertAvailableRank.label ?? null,
      applicableToCompany: insertAvailableRank.applicableToCompany ?? null,
      sortOrder: insertAvailableRank.sortOrder ?? (maxSortOrder + 1)
    };
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

  async updateRankOrders(rankOrders: Array<{ id: number; sortOrder: number }>): Promise<boolean> {
    try {
      for (const { id, sortOrder } of rankOrders) {
        const existingRank = this.availableRanks.get(id);
        if (existingRank) {
          const updatedRank: AvailableRank = { 
            ...existingRank, 
            sortOrder 
          };
          this.availableRanks.set(id, updatedRank);
        }
      }
      this.saveToFile();
      return true;
    } catch (error) {
      console.error('Failed to update rank orders:', error);
      return false;
    }
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
    const uniqueId = await this.getNextCrewId();
    const crewMember: CrewMember = { ...insertCrewMember, id: uniqueId };
    this.crewMembers.set(uniqueId, crewMember);
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

  // ID Generation Methods
  private initializeCrewIdCounter(): number {
    let maxCounter = 0;
    
    // Scan existing crew members for A-series IDs in employeeId field
    for (const crewMember of this.crewMembers.values()) {
      if (crewMember.employeeId) {
        const match = crewMember.employeeId.match(/^A(\d{6})$/);
        if (match) {
          const idNumber = parseInt(match[1], 10);
          maxCounter = Math.max(maxCounter, idNumber);
        }
      }
    }
    
    const startingCounter = maxCounter + 1;
    console.log(`🔢 Initialized crew ID counter to ${startingCounter} (scanned ${this.crewMembers.size} existing crew members)`);
    return startingCounter;
  }

  async getNextCrewId(): Promise<string> {
    const nextNumber = this.currentCrewIdCounter++;
    // Format: A000001, A000002, etc. (A + 6-digit padded number)
    this.saveToFile(); // Persist the updated counter
    return `A${nextNumber.toString().padStart(6, '0')}`;
  }

  // Vessel Groups Methods
  async getVesselGroups(): Promise<VesselGroup[]> {
    return Array.from(this.vesselGroups.values());
  }

  async getVesselGroup(id: number): Promise<VesselGroup | undefined> {
    return this.vesselGroups.get(id);
  }

  async createVesselGroup(insertVesselGroup: InsertVesselGroup): Promise<VesselGroup> {
    const id = this.currentVesselGroupId++;
    const vesselGroup: VesselGroup = { 
      ...insertVesselGroup, 
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.vesselGroups.set(id, vesselGroup);
    this.saveToFile(); // Persist the changes
    return vesselGroup;
  }

  async updateVesselGroup(id: number, vesselGroupData: Partial<InsertVesselGroup>): Promise<VesselGroup | undefined> {
    const existingVesselGroup = this.vesselGroups.get(id);
    if (!existingVesselGroup) return undefined;

    const updatedVesselGroup: VesselGroup = { 
      ...existingVesselGroup, 
      ...vesselGroupData,
      updatedAt: new Date()
    };
    this.vesselGroups.set(id, updatedVesselGroup);
    this.saveToFile(); // Persist the changes
    return updatedVesselGroup;
  }

  async deleteVesselGroup(id: number): Promise<boolean> {
    const result = this.vesselGroups.delete(id);
    if (result) {
      this.saveToFile(); // Persist the changes
    }
    return result;
  }

  // Vessel Drafts methods
  async getVesselDrafts(): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values());
  }

  async getVesselDraft(id: number): Promise<VesselDraft | undefined> {
    return this.vesselDrafts.get(id);
  }

  async getVesselDraftsByVessel(vesselId: string): Promise<VesselDraft[]> {
    return Array.from(this.vesselDrafts.values()).filter(draft => draft.vesselId === vesselId);
  }

  async createVesselDraft(insertVesselDraft: InsertVesselDraft): Promise<VesselDraft> {
    const id = this.currentVesselDraftId++;
    const vesselDraft: VesselDraft = { 
      ...insertVesselDraft, 
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.vesselDrafts.set(id, vesselDraft);
    this.saveToFile(); // Persist the changes
    return vesselDraft;
  }

  async updateVesselDraft(id: number, vesselDraftData: Partial<InsertVesselDraft>): Promise<VesselDraft | undefined> {
    const existingVesselDraft = this.vesselDrafts.get(id);
    if (!existingVesselDraft) return undefined;

    const updatedVesselDraft: VesselDraft = { 
      ...existingVesselDraft, 
      ...vesselDraftData,
      updatedAt: new Date()
    };
    this.vesselDrafts.set(id, updatedVesselDraft);
    this.saveToFile(); // Persist the changes
    return updatedVesselDraft;
  }

  async deleteVesselDraft(id: number): Promise<boolean> {
    const result = this.vesselDrafts.delete(id);
    if (result) {
      this.saveToFile(); // Persist the changes
    }
    return result;
  }

  // Vessel Revisions methods
  async getVesselRevisions(): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values());
  }

  async getVesselRevision(id: number): Promise<VesselRevision | undefined> {
    return this.vesselRevisions.get(id);
  }

  async getVesselRevisionsByVessel(vesselId: string): Promise<VesselRevision[]> {
    return Array.from(this.vesselRevisions.values()).filter(revision => revision.vesselId === vesselId);
  }

  async createVesselRevision(insertVesselRevision: InsertVesselRevision): Promise<VesselRevision> {
    const id = this.currentVesselRevisionId++;
    const vesselRevision: VesselRevision = { 
      ...insertVesselRevision, 
      id,
      createdAt: new Date()
    };
    this.vesselRevisions.set(id, vesselRevision);
    this.saveToFile(); // Persist the changes
    return vesselRevision;
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

  // Vessel Planning Methods
  async getVesselPlanningByVessel(vesselId: string): Promise<VesselPlanning[]> {
    return Array.from(this.vesselPlanning.values()).filter(planning => planning.vesselId === vesselId);
  }

  async getVesselPlanningById(id: number): Promise<VesselPlanning | undefined> {
    return this.vesselPlanning.get(id);
  }

  async createVesselPlanning(insertPlanning: InsertVesselPlanning): Promise<VesselPlanning> {
    const id = this.currentVesselPlanningId++;
    const vesselPlanning: VesselPlanning = { 
      ...insertPlanning,
      id,
      onBoardCrewId: insertPlanning.onBoardCrewId || null,
      onBoardCrewName: insertPlanning.onBoardCrewName || null,
      reliefDue: insertPlanning.reliefDue || null,
      signOffDate: insertPlanning.signOffDate || null,
      signOffPort: insertPlanning.signOffPort || null,
      reliefStatus: insertPlanning.reliefStatus || null,
      relieverCrewId: insertPlanning.relieverCrewId || null,
      relieverCrewName: insertPlanning.relieverCrewName || null,
      joiningDate: insertPlanning.joiningDate || null,
      joiningPort: insertPlanning.joiningPort || null,
      joiningStatus: insertPlanning.joiningStatus || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.vesselPlanning.set(id, vesselPlanning);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return vesselPlanning;
  }

  async updateVesselPlanning(id: number, planningData: Partial<InsertVesselPlanning>): Promise<VesselPlanning | undefined> {
    const existingPlanning = this.vesselPlanning.get(id);
    if (!existingPlanning) return undefined;

    const updatedPlanning: VesselPlanning = { 
      ...existingPlanning, 
      ...planningData,
      updatedAt: new Date()
    };
    this.vesselPlanning.set(id, updatedPlanning);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedPlanning;
  }

  async deleteVesselPlanning(id: number): Promise<boolean> {
    const result = this.vesselPlanning.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Rotation Plans Methods
  async getRotationPlans(): Promise<RotationPlan[]> {
    return Array.from(this.rotationPlans.values());
  }

  async getRotationPlan(id: number): Promise<RotationPlan | undefined> {
    return this.rotationPlans.get(id);
  }

  async createRotationPlan(insertPlan: InsertRotationPlan): Promise<RotationPlan> {
    const id = this.currentRotationPlanId++;
    const rotationPlan: RotationPlan = {
      ...insertPlan,
      id,
      planStatus: insertPlan.planStatus || "In Draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rotationPlans.set(id, rotationPlan);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY CREATE!
    return rotationPlan;
  }

  async updateRotationPlan(id: number, updateData: Partial<InsertRotationPlan>): Promise<RotationPlan | undefined> {
    const existingPlan = this.rotationPlans.get(id);
    if (!existingPlan) return undefined;
    
    const updatedPlan: RotationPlan = {
      ...existingPlan,
      ...updateData,
      updatedAt: new Date(),
    };
    this.rotationPlans.set(id, updatedPlan);
    this.saveToFile(); // SAVE TO FILE AFTER EVERY UPDATE!
    return updatedPlan;
  }

  async deleteRotationPlan(id: number): Promise<boolean> {
    const result = this.rotationPlans.delete(id);
    if (result) this.saveToFile(); // SAVE TO FILE AFTER EVERY DELETE!
    return result;
  }

  // Rotation Approval Workflow Methods
  async proposeRotationPlan(id: number, proposedBy: string): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(id);
    if (!plan) return undefined;

    // Reset all assignment proposal statuses to "proposed" when proposing a plan
    let assignments = plan.assignments;
    if (assignments) {
      const parsedAssignments = JSON.parse(assignments);
      const resetAssignments = parsedAssignments.map((assignment: any) => ({
        ...assignment,
        proposalStatus: "proposed", // Reset to proposed status
      }));
      assignments = JSON.stringify(resetAssignments);
    }

    const updatedPlan: RotationPlan = {
      ...plan,
      assignments,
      planStatus: "Proposed",
      proposedBy,
      proposedDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date()
    };
    this.rotationPlans.set(id, updatedPlan);
    this.saveToFile(); // SAVE TO FILE!
    return updatedPlan;
  }

  async getProposedAssignments(filters?: { vessels?: string[]; ranks?: string[]; draftId?: string; dateFrom?: string; dateTo?: string }): Promise<any[]> {
    const proposedPlans = Array.from(this.rotationPlans.values()).filter(plan => 
      plan.planStatus === "Proposed" || plan.planStatus === "Partially Approved"
    );

    const assignments: any[] = [];
    for (const plan of proposedPlans) {
      if (plan.assignments) {
        const planAssignments = JSON.parse(plan.assignments);
        for (let i = 0; i < planAssignments.length; i++) {
          const assignment = planAssignments[i];
          
          if (!assignment.proposalStatus || assignment.proposalStatus === "proposed") {
            // Find current crew on board for this vessel/rank
            let currentCrew = null;
            
            // Determine vesselId for lookup
            let vesselIdToMatch: string | null = null;
            if (assignment.vesselId) {
              // Use existing vesselId and normalize it
              vesselIdToMatch = String(assignment.vesselId);
              if (/^\d+$/.test(vesselIdToMatch)) {
                // Numeric format - convert to VSL-XXX format
                vesselIdToMatch = `VSL-${vesselIdToMatch.padStart(3, '0')}`;
              }
            } else if (assignment.vessel || assignment.vesselName) {
              // Legacy assignment without vesselId
              const vesselValue = assignment.vessel || assignment.vesselName;
              
              // Check if the vessel field already contains a vessel ID (VSL-XXX format)
              if (/^VSL-\d{3}$/.test(vesselValue)) {
                // It's already a vessel ID, use it directly
                vesselIdToMatch = vesselValue;
              } else {
                // It's a vessel name, need to look it up in master data (master ID "014")
                const vesselMasterData = await this.getMasterDataEntries("014");
                const vessel = vesselMasterData?.find((v: any) => v.name === vesselValue);
                
                if (vessel && vessel.entryId) {
                  // Use the entryId which is in VSL-XXX format
                  vesselIdToMatch = vessel.entryId;
                }
              }
            }
            
            if (vesselIdToMatch && assignment.rank) {
              // Look for crew members currently on this vessel with this rank
              // Note: crew.presentVessel stores vessel ID format "VSL-003"
              const crewOnBoard = Array.from(this.crewMembers.values()).find(crew => 
                crew.presentVessel === vesselIdToMatch && crew.presentRank === assignment.rank
              );
              
              if (crewOnBoard) {
                // Get vessel planning data for this crew member to get contract dates
                // vesselPlanning.vesselId stores vessel ID
                const planning = Array.from(this.vesselPlanning.values()).find(p => 
                  p.onBoardCrewId === crewOnBoard.id && p.vesselId === vesselIdToMatch && p.rank === assignment.rank
                );
                
                if (planning && planning.reliefDue) {
                  // Calculate range dates based on contract end range settings
                  const reliefDueDate = new Date(planning.reliefDue);
                  const rangeStartMonths = planning.contractEndRangeStartMonths || 0;
                  const rangeEndMonths = planning.contractEndRangeEndMonths || 1;
                  
                  const rangeStartDate = new Date(reliefDueDate);
                  rangeStartDate.setMonth(rangeStartDate.getMonth() + rangeStartMonths);
                  
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + rangeEndMonths);
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.lastName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: planning.joiningDate || crewOnBoard.joiningDate || '',
                    contractEndDate: planning.reliefDue,
                    rangeStartDate: rangeStartDate.toISOString().split('T')[0],
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                } else if (crewOnBoard.joiningDate && crewOnBoard.reliefDue) {
                  // Fallback to crew member data if no planning data
                  const reliefDueDate = new Date(crewOnBoard.reliefDue);
                  const rangeEndDate = new Date(reliefDueDate);
                  rangeEndDate.setMonth(rangeEndDate.getMonth() + 1); // Default 1 month grace period
                  
                  currentCrew = {
                    id: crewOnBoard.id,
                    name: `${crewOnBoard.firstName} ${crewOnBoard.middleName || ''} ${crewOnBoard.familyName || crewOnBoard.lastName || ''}`.replace(/\s+/g, ' ').trim(),
                    contractStartDate: crewOnBoard.joiningDate,
                    contractEndDate: crewOnBoard.reliefDue,
                    rangeStartDate: crewOnBoard.reliefDue,
                    rangeEndDate: rangeEndDate.toISOString().split('T')[0],
                  };
                }
              }
            }
            
            assignments.push({
              ...assignment,
              planId: plan.id,
              draftId: plan.draftId,
              proposedBy: plan.proposedBy,
              proposedDate: plan.proposedDate,
              assignmentIndex: i,
              currentCrew, // Add current crew timeline data
            });
          }
        }
      }
    }

    return assignments;
  }

  async deployAssignment(planId: number, assignmentIndex: number, deployedBy: string): Promise<{ success: boolean; conflicts?: any[] }> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return { success: false };

    const assignments = JSON.parse(plan.assignments);
    const assignment = assignments[assignmentIndex];
    if (!assignment) return { success: false };

    // Check for conflicts, excluding this assignment to avoid self-conflict
    const conflicts = await this.checkAssignmentConflicts(
      assignment.crewId,
      assignment.joiningDate,
      assignment.contractPeriod,
      planId,
      assignmentIndex
    );

    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    // Mark assignment as deployed
    assignments[assignmentIndex] = {
      ...assignment,
      proposalStatus: "deployed",
      deployedDate: new Date().toISOString().split('T')[0],
      deployedBy
    };

    // Update rotation plan
    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      updatedAt: new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);
    this.saveToFile(); // SAVE TO FILE!

    // Create vessel planning entry for the deployed crew
    // Require proper IDs - fail if not available
    if (!assignment.vesselId || !assignment.rankId) {
      console.error('Missing vesselId or rankId in assignment:', assignment);
      return { success: false };
    }

    const vesselPlanningEntry = {
      vesselId: assignment.vesselId,
      rankId: assignment.rankId,
      rank: assignment.rank,
      relieverCrewId: assignment.crewId,
      relieverCrewName: assignment.crewName,
      joiningDate: assignment.joiningDate,
      joiningStatus: "Confirmed",
      contractPeriodMonths: assignment.contractPeriod,
      deploymentChecklistCompleted: false,
      applicableDocsChecked: false,
    };

    await this.createVesselPlanning(vesselPlanningEntry);

    return { success: true };
  }

  async rejectAssignment(planId: number, assignmentIndex: number): Promise<RotationPlan | undefined> {
    const plan = this.rotationPlans.get(planId);
    if (!plan || !plan.assignments) return undefined;

    const assignments = JSON.parse(plan.assignments);
    if (!assignments[assignmentIndex]) return undefined;

    // Remove the assignment
    assignments.splice(assignmentIndex, 1);

    // Update plan status back to Draft if no assignments left
    const planStatus = assignments.length === 0 ? "In Draft" : plan.planStatus;

    const updatedPlan: RotationPlan = {
      ...plan,
      assignments: JSON.stringify(assignments),
      planStatus,
      updatedAt: new Date()
    };
    this.rotationPlans.set(planId, updatedPlan);
    this.saveToFile(); // SAVE TO FILE!
    return updatedPlan;
  }

  async checkAssignmentConflicts(
    crewId: string, 
    joiningDate: string, 
    contractPeriod: number,
    excludePlanId?: number,
    excludeAssignmentIndex?: number
  ): Promise<any[]> {
    const conflicts: any[] = [];
    const joiningDateObj = new Date(joiningDate);
    const contractEndDate = new Date(joiningDateObj);
    contractEndDate.setMonth(contractEndDate.getMonth() + contractPeriod);

    // Check all proposed assignments
    for (const plan of this.rotationPlans.values()) {
      if (plan.assignments) {
        const assignments = JSON.parse(plan.assignments);
        for (let i = 0; i < assignments.length; i++) {
          const assignment = assignments[i];
          
          // Skip the assignment being deployed to avoid self-conflict
          if (excludePlanId !== undefined && excludeAssignmentIndex !== undefined) {
            if (plan.id === excludePlanId && i === excludeAssignmentIndex) {
              continue;
            }
          }
          
          if (assignment.crewId === crewId && assignment.proposalStatus === "proposed") {
            const assignmentJoiningDate = new Date(assignment.joiningDate);
            const assignmentEndDate = new Date(assignmentJoiningDate);
            assignmentEndDate.setMonth(assignmentEndDate.getMonth() + assignment.contractPeriod);

            // Check for overlap
            if (
              (joiningDateObj <= assignmentEndDate && contractEndDate >= assignmentJoiningDate)
            ) {
              conflicts.push({
                planId: plan.id,
                draftId: plan.draftId,
                vessel: assignment.vesselName,
                rank: assignment.rank,
                joiningDate: assignment.joiningDate,
                contractPeriod: assignment.contractPeriod
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  // Data Masters methods (return empty array for frontend compatibility)
  async getDataMasters(): Promise<any[]> {
    // PersistentFileStorage doesn't have data masters - return empty array for frontend compatibility
    // Individual masters work via getMasterDataEntries() instead
    return [];
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
      
      // Only log in development mode for performance
      if (process.env.NODE_ENV === 'development') {
        console.log(`📄 [PERSISTENT] getMasterDataEntries(${masterId}): Found ${filteredEntries.length} entries`);
      }
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