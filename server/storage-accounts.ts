
import { users, type User, type InsertUser, type Form, type InsertForm, type RankGroup, type InsertRankGroup, type AvailableRank, type InsertAvailableRank, type CrewMember, type InsertCrewMember, type AppraisalResult, type InsertAppraisalResult, type PayElement, type InsertPayElement, type ContractData, type InsertContractData, type ContractPayElement, type InsertContractPayElement, type Allotment, type InsertAllotment, type Advance, type InsertAdvance, type BondItem, type InsertBondItem } from "@shared/schema";

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
  
  // Pay Elements (Rate Tables & Rules)
  getPayElements(): Promise<PayElement[]>;
  getPayElement(id: string): Promise<PayElement | undefined>;
  createPayElement(payElement: InsertPayElement): Promise<PayElement>;
  updatePayElement(id: string, payElement: Partial<InsertPayElement>): Promise<PayElement | undefined>;
  deletePayElement(id: string): Promise<boolean>;
  
  // Contract Data
  getContractData(): Promise<ContractData[]>;
  getContractDataByCrewMember(crewMemberId: string): Promise<ContractData | undefined>;
  createContractData(contractData: InsertContractData): Promise<ContractData>;
  updateContractData(id: number, contractData: Partial<InsertContractData>): Promise<ContractData | undefined>;
  updateContractStatus(id: number, status: 'draft' | 'active'): Promise<ContractData | undefined>;
  updateContractEffectiveDate(id: number, effectiveDate: string): Promise<ContractData | undefined>;
  
  // Contract Pay Elements
  getContractPayElements(contractId: number): Promise<ContractPayElement[]>;
  createContractPayElement(contractPayElement: InsertContractPayElement): Promise<ContractPayElement>;
  updateContractPayElement(id: number, contractPayElement: Partial<InsertContractPayElement>): Promise<ContractPayElement | undefined>;
  deleteContractPayElement(id: number): Promise<boolean>;
  
  // Utility method to inherit pay elements for a crew member
  inheritPayElementsForCrewMember(crewMemberId: string, vesselGroup: string): Promise<ContractData>;

  // Allotments
  getAllotments(): Promise<Allotment[]>;
  getAllotmentsByCrewId(crewId: string): Promise<Allotment[]>;
  createAllotment(allotment: InsertAllotment): Promise<Allotment>;
  updateAllotment(id: string, updates: Partial<InsertAllotment>): Promise<Allotment | null>;
  deleteAllotment(id: string): Promise<boolean>;

  // Advances
  getAdvances(): Promise<Advance[]>;
  getAdvancesByCrewId(crewId: string): Promise<Advance[]>;
  createAdvance(advance: InsertAdvance): Promise<Advance>;
  updateAdvance(id: string, updates: Partial<InsertAdvance>): Promise<Advance | null>;
  deleteAdvance(id: string): Promise<boolean>;

  // Bond Items
  getBondItems(): Promise<BondItem[]>;
  getBondItemsByCrewId(crewId: string): Promise<BondItem[]>;
  createBondItem(bondItem: InsertBondItem): Promise<BondItem>;
  updateBondItem(id: string, updates: Partial<InsertBondItem>): Promise<BondItem | null>;
  deleteBondItem(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private forms: Map<number, Form>;
  private rankGroups: Map<number, RankGroup>;
  private availableRanks: Map<number, AvailableRank>;
  private crewMembers: Map<string, CrewMember>;
  private payElements: Map<string, PayElement>;
  private contractData: Map<number, ContractData>;
  private contractPayElements: Map<number, ContractPayElement>;
  private currentUserId: number;
  private currentFormId: number;
  private currentRankGroupId: number;
  private currentAvailableRankId: number;
  private currentAppraisalResultId: number;
  private currentContractDataId: number;
  private currentContractPayElementId: number;
  private allotments: Map<string, Allotment>;
  private advances: Map<string, Advance>;
  private bondItems: Map<string, BondItem>;

  constructor() {
    this.users = new Map();
    this.forms = new Map();
    this.rankGroups = new Map();
    this.availableRanks = new Map();
    this.crewMembers = new Map();
    this.payElements = new Map();
    this.contractData = new Map();
    this.contractPayElements = new Map();
    this.allotments = new Map();
    this.advances = new Map();
    this.bondItems = new Map();
    this.currentUserId = 1;
    this.currentFormId = 1;
    this.currentRankGroupId = 1;
    this.currentAvailableRankId = 1;
    this.currentAppraisalResultId = 1;
    this.currentContractDataId = 1;
    this.currentContractPayElementId = 1;
    

    this.currentAppraisalResultId = 6;

    // Initialize allotments data
    this.allotments.set("ALT001", {
      id: "ALT001",
      crewId: "2025-05-14",
      crewName: "James Michael",
      rank: "Master",
      beneficiaryName: "Maria Wilson",
      relationship: "Spouse",
      allotmentType: "percentage",
      value: 60,
      currency: "USD",
      bankName: "Chase Bank",
      accountNumber: "****1234",
      priority: 1,
      validFrom: "2024-01-15",
      validTo: "2024-12-31",
      status: "active",
      kycComplete: true,
      bankVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.allotments.set("ALT002", {
      id: "ALT002",
      crewId: "2025-05-14",
      crewName: "James Michael",
      rank: "Master",
      beneficiaryName: "Education Fund",
      relationship: "Dependent",
      allotmentType: "fixed",
      value: 1000,
      currency: "USD",
      bankName: "Wells Fargo",
      accountNumber: "****5678",
      priority: 2,
      validFrom: "2024-01-15",
      validTo: "2024-12-31",
      status: "active",
      kycComplete: true,
      bankVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize advances data
    this.advances.set("ADV001", {
      id: "ADV001",
      crewId: "2025-05-14",
      crewName: "James Michael",
      rank: "Master",
      amount: 2500,
      currency: "USD",
      reason: "Emergency medical expense",
      requestDate: "2024-10-15",
      approver: "Captain Smith",
      status: "approved",
      capCheck: true,
      remainingCap: 2500,
      recoveryAmount: 500,
      ctmReference: "CTM-2024-001",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.advances.set("ADV002", {
      id: "ADV002",
      crewId: "2025-03-12",
      crewName: "Anna Marie Johnson",
      rank: "Chief Engineer",
      amount: 1500,
      currency: "USD",
      reason: "Family emergency",
      requestDate: "2024-11-01",
      approver: "HR Manager",
      status: "disbursed",
      capCheck: true,
      remainingCap: 1000,
      recoveryAmount: 300,
      ctmReference: "CTM-2024-002",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize bond items data
    this.bondItems.set("BOND001", {
      id: "BOND001",
      crewId: "2025-05-14",
      crewName: "James Michael",
      itemName: "Phone Card",
      category: "Communications",
      quantity: 2,
      unitPrice: 25,
      totalPrice: 50,
      currency: "USD",
      saleDate: "2024-10-20",
      autoDeduct: true,
      deductionAmount: 50,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.bondItems.set("BOND002", {
      id: "BOND002",
      crewId: "2025-05-14",
      crewName: "James Michael",
      itemName: "Toiletries",
      category: "Personal Care",
      quantity: 1,
      unitPrice: 35,
      totalPrice: 35,
      currency: "USD",
      saleDate: "2024-10-25",
      autoDeduct: true,
      deductionAmount: 35,
      status: "deducted",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    // Initialize master pay elements (Rate Tables & Rules)
    this.initializePayElements();
    
    // Initialize contract data with realistic values for testing
    this.initializeContractData();
  }
  createAvailableRank(rank: InsertAvailableRank): Promise<AvailableRank> {
    throw new Error("Method not implemented.");
  }
  getCrewMembers(): Promise<CrewMember[]> {
    throw new Error("Method not implemented.");
  }
  getCrewMember(id: string): Promise<CrewMember | undefined> {
    throw new Error("Method not implemented.");
  }
  createCrewMember(crewMember: InsertCrewMember): Promise<CrewMember> {
    throw new Error("Method not implemented.");
  }
  updateCrewMember(id: string, crewMember: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    throw new Error("Method not implemented.");
  }
  deleteCrewMember(id: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getAppraisalResults(): Promise<AppraisalResult[]> {
    throw new Error("Method not implemented.");
  }
  getAppraisalResult(id: number): Promise<AppraisalResult | undefined> {
    throw new Error("Method not implemented.");
  }
  getAppraisalResultsByCrewMember(crewMemberId: string): Promise<AppraisalResult[]> {
    throw new Error("Method not implemented.");
  }
  createAppraisalResult(appraisalResult: InsertAppraisalResult): Promise<AppraisalResult> {
    throw new Error("Method not implemented.");
  }
  updateAppraisalResult(id: number, appraisalResult: Partial<InsertAppraisalResult>): Promise<AppraisalResult | undefined> {
    throw new Error("Method not implemented.");
  }
  deleteAppraisalResult(id: number): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  private initializePayElements() {
    // Master pay elements from Rate Tables & Rules
    const masterPayElements: PayElement[] = [
      {
        id: "PE001",
        name: "Basic Salary",
        code: "BASIC",
        type: "earning",
        category: "Fixed Pay",
        formula: "Monthly Fixed Amount",
        rounding: "ROUND_NEAREST_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "PE002",
        name: "Fixed Overtime",
        code: "OT_FIXED",
        type: "earning",
        category: "Variable Pay", 
        formula: "No Formula",
        rounding: "ROUND_UP_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "PE003",
        name: "Variable Overtime",
        code: "VAR_OT",
        type: "earning",
        category: "Variable",
        formula: "OT_HOURS * OT_RATE",
        rounding: "ROUND_UP_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "PE004", 
        name: "Uniform Allowance",
        code: "UA",
        type: "earning",
        category: "Fixed Pay",
        formula: "No Formula",
        rounding: "ROUND_NEAREST_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "PE005",
        name: "Leave Pay",
        code: "LV",
        type: "earning",
        category: "Fixed",
        formula: "No Formula",
        rounding: "ROUND_UP_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "PE006",
        name: "PF",
        code: "PF",
        type: "deduction",
        category: "Fixed",
        formula: "5% * GROSS_PAY",
        rounding: "ROUND_NEAREST_CENT",
        ceiling: null,
        floor: null,
        effectiveDate: "2025-01-01",
        status: "active",
        vesselGroups: '["all-vessels"]',
        reflectInContract: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    masterPayElements.forEach(element => {
      this.payElements.set(element.id, element);
    });
  }

  private initializeContractData() {
    // Create contract data for crew members with realistic values
    
    // Contract for James Wilson (Captain)
    const contractData1: ContractData = {
      id: 1,
      crewMemberId: "2025-05-14",
      vessel: "MT Sail One",
      vesselGroup: "all-vessels",
      applicableFrom: "2025-02-01",
      status: "active",
      currency: "USD",
      lastModified: new Date(),
      modifiedBy: "admin",
      createdAt: new Date()
    };
    this.contractData.set(1, contractData1);

    // Contract pay elements for James Wilson
    const contractPayElements1 = [
      { id: 1, contractId: 1, payElementId: "PE001", payElementCode: "BASIC", payElementName: "Basic Salary", type: "earning", category: "Fixed Pay", formula: "Monthly Fixed Amount", value: "12000", applicable: true, isCustom: false, isInherited: true, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, contractId: 1, payElementId: "PE002", payElementCode: "OT_FIXED", payElementName: "Fixed Overtime", type: "earning", category: "Variable Pay", formula: "No Formula", value: "3500", applicable: true, isCustom: false, isInherited: true, sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 3, contractId: 1, payElementId: "PE003", payElementCode: "VAR_OT", payElementName: "Variable Overtime", type: "earning", category: "Variable", formula: "OT_HOURS * OT_RATE", value: "1800", applicable: true, isCustom: false, isInherited: true, sortOrder: 3, createdAt: new Date(), updatedAt: new Date() },
      { id: 4, contractId: 1, payElementId: "PE004", payElementCode: "UA", payElementName: "Uniform Allowance", type: "earning", category: "Fixed Pay", formula: "No Formula", value: "500", applicable: true, isCustom: false, isInherited: true, sortOrder: 4, createdAt: new Date(), updatedAt: new Date() },
      { id: 5, contractId: 1, payElementId: "PE005", payElementCode: "LV", payElementName: "Leave Pay", type: "earning", category: "Fixed", formula: "No Formula", value: "800", applicable: true, isCustom: false, isInherited: true, sortOrder: 5, createdAt: new Date(), updatedAt: new Date() },
      { id: 6, contractId: 1, payElementId: "PE006", payElementCode: "PF", payElementName: "PF", type: "deduction", category: "Fixed", formula: "5% * GROSS_PAY", value: "900", applicable: true, isCustom: false, isInherited: true, sortOrder: 6, createdAt: new Date(), updatedAt: new Date() }
    ];

    // Contract for Anna Johnson (Chief Engineer)  
    const contractData2: ContractData = {
      id: 2,
      crewMemberId: "2025-03-12",
      vessel: "MT Sail Ten",
      vesselGroup: "all-vessels",
      applicableFrom: "2025-01-01",
      status: "active",
      currency: "USD",
      lastModified: new Date(),
      modifiedBy: "admin",
      createdAt: new Date()
    };
    this.contractData.set(2, contractData2);

    // Contract pay elements for Anna Johnson
    const contractPayElements2 = [
      { id: 7, contractId: 2, payElementId: "PE001", payElementCode: "BASIC", payElementName: "Basic Salary", type: "earning", category: "Fixed Pay", formula: "Monthly Fixed Amount", value: "10000", applicable: true, isCustom: false, isInherited: true, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 8, contractId: 2, payElementId: "PE002", payElementCode: "OT_FIXED", payElementName: "Fixed Overtime", type: "earning", category: "Variable Pay", formula: "No Formula", value: "3000", applicable: true, isCustom: false, isInherited: true, sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 9, contractId: 2, payElementId: "PE003", payElementCode: "VAR_OT", payElementName: "Variable Overtime", type: "earning", category: "Variable", formula: "OT_HOURS * OT_RATE", value: "1500", applicable: true, isCustom: false, isInherited: true, sortOrder: 3, createdAt: new Date(), updatedAt: new Date() },
      { id: 10, contractId: 2, payElementId: "PE004", payElementCode: "UA", payElementName: "Uniform Allowance", type: "earning", category: "Fixed Pay", formula: "No Formula", value: "400", applicable: true, isCustom: false, isInherited: true, sortOrder: 4, createdAt: new Date(), updatedAt: new Date() },
      { id: 11, contractId: 2, payElementId: "PE005", payElementCode: "LV", payElementName: "Leave Pay", type: "earning", category: "Fixed", formula: "No Formula", value: "600", applicable: true, isCustom: false, isInherited: true, sortOrder: 5, createdAt: new Date(), updatedAt: new Date() },
      { id: 12, contractId: 2, payElementId: "PE006", payElementCode: "PF", payElementName: "PF", type: "deduction", category: "Fixed", formula: "5% * GROSS_PAY", value: "750", applicable: true, isCustom: false, isInherited: true, sortOrder: 6, createdAt: new Date(), updatedAt: new Date() }
    ];

    // Contract for David Brown (Able Seaman)
    const contractData3: ContractData = {
      id: 3,
      crewMemberId: "2025-02-12",
      vessel: "MT Sail Two",
      vesselGroup: "all-vessels",
      applicableFrom: "2025-02-01",
      status: "active",
      currency: "USD",
      lastModified: new Date(),
      modifiedBy: "admin",
      createdAt: new Date()
    };
    this.contractData.set(3, contractData3);

    // Contract pay elements for David Brown
    const contractPayElements3 = [
      { id: 13, contractId: 3, payElementId: "PE001", payElementCode: "BASIC", payElementName: "Basic Salary", type: "earning", category: "Fixed Pay", formula: "Monthly Fixed Amount", value: "6000", applicable: true, isCustom: false, isInherited: true, sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 14, contractId: 3, payElementId: "PE002", payElementCode: "OT_FIXED", payElementName: "Fixed Overtime", type: "earning", category: "Variable Pay", formula: "No Formula", value: "1800", applicable: true, isCustom: false, isInherited: true, sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 15, contractId: 3, payElementId: "PE003", payElementCode: "VAR_OT", payElementName: "Variable Overtime", type: "earning", category: "Variable", formula: "OT_HOURS * OT_RATE", value: "900", applicable: true, isCustom: false, isInherited: true, sortOrder: 3, createdAt: new Date(), updatedAt: new Date() },
      { id: 16, contractId: 3, payElementId: "PE004", payElementCode: "UA", payElementName: "Uniform Allowance", type: "earning", category: "Fixed Pay", formula: "No Formula", value: "300", applicable: true, isCustom: false, isInherited: true, sortOrder: 4, createdAt: new Date(), updatedAt: new Date() },
      { id: 17, contractId: 3, payElementId: "PE005", payElementCode: "LV", payElementName: "Leave Pay", type: "earning", category: "Fixed", formula: "No Formula", value: "400", applicable: true, isCustom: false, isInherited: true, sortOrder: 5, createdAt: new Date(), updatedAt: new Date() },
      { id: 18, contractId: 3, payElementId: "PE006", payElementCode: "PF", payElementName: "PF", type: "deduction", category: "Fixed", formula: "5% * GROSS_PAY", value: "450", applicable: true, isCustom: false, isInherited: true, sortOrder: 6, createdAt: new Date(), updatedAt: new Date() }
    ];

    // Store all contract pay elements
    const allContractPayElements = [...contractPayElements1, ...contractPayElements2, ...contractPayElements3];
    allContractPayElements.forEach(element => {
      this.contractPayElements.set(element.id, element);
    });

    // Update current ID counter
    this.currentContractDataId = 4;
    this.currentContractPayElementId = 19;
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
    const form: Form = { ...insertForm, id, configuration: insertForm.configuration || null };
    this.forms.set(id, form);
    return form;
  }

  async updateForm(id: number, formData: Partial<InsertForm>): Promise<Form | undefined> {
    const existingForm = this.forms.get(id);
    if (!existingForm) return undefined;
    
    const updatedForm: Form = { ...existingForm, ...formData };
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
    return rankGroup;
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
    return this.rankGroups.delete(id);
  }

  async getAvailableRanks(): Promise<AvailableRank[]> {
    return Array.from(this.availableRanks.values());
  }
  // Pay Elements Methods (Rate Tables & Rules)
  async getPayElements(): Promise<PayElement[]> {
    return Array.from(this.payElements.values());
  }

  async getPayElement(id: string): Promise<PayElement | undefined> {
    return this.payElements.get(id);
  }

  async createPayElement(insertPayElement: InsertPayElement): Promise<PayElement> {
    const payElement: PayElement = {
      ...insertPayElement,
      status: insertPayElement.status || "active",
      ceiling: insertPayElement.ceiling || null,
      floor: insertPayElement.floor || null,
      vesselGroups: insertPayElement.vesselGroups || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.payElements.set(payElement.id, payElement);
    return payElement;
  }

  async updatePayElement(id: string, payElementData: Partial<InsertPayElement>): Promise<PayElement | undefined> {
    const existingPayElement = this.payElements.get(id);
    if (!existingPayElement) return undefined;
    
    const updatedPayElement: PayElement = {
      ...existingPayElement,
      ...payElementData,
      updatedAt: new Date()
    };
    this.payElements.set(id, updatedPayElement);
    return updatedPayElement;
  }

  async deletePayElement(id: string): Promise<boolean> {
    return this.payElements.delete(id);
  }

  // Contract Data Methods
  async getContractData(): Promise<ContractData[]> {
    return Array.from(this.contractData.values());
  }

  async getContractDataByCrewMember(crewMemberId: string): Promise<ContractData | undefined> {
    return Array.from(this.contractData.values()).find(cd => cd.crewMemberId === crewMemberId);
  }

  async createContractData(insertContractData: InsertContractData): Promise<ContractData> {
    const id = this.currentContractDataId++;
    const contractData: ContractData = {
      ...insertContractData,
      id,
      lastModified: new Date(),
      createdAt: new Date()
    };
    this.contractData.set(id, contractData);
    return contractData;
  }

  async updateContractData(id: number, contractDataUpdate: Partial<InsertContractData>): Promise<ContractData | undefined> {
    const existingContractData = this.contractData.get(id);
    if (!existingContractData) return undefined;
    
    const updatedContractData: ContractData = {
      ...existingContractData,
      ...contractDataUpdate,
      lastModified: new Date()
    };
    this.contractData.set(id, updatedContractData);
    return updatedContractData;
  }

  async updateContractStatus(id: number, status: 'draft' | 'active'): Promise<ContractData | undefined> {
    const existingContractData = this.contractData.get(id);
    if (!existingContractData) return undefined;
    
    const updatedContractData: ContractData = {
      ...existingContractData,
      status,
      lastModified: new Date()
    };
    this.contractData.set(id, updatedContractData);
    return updatedContractData;
  }

  async updateContractEffectiveDate(id: number, effectiveDate: string): Promise<ContractData | undefined> {
    const existingContractData = this.contractData.get(id);
    if (!existingContractData) return undefined;
    
    const updatedContractData: ContractData = {
      ...existingContractData,
      applicableFrom: effectiveDate,
      lastModified: new Date()
    };
    this.contractData.set(id, updatedContractData);
    return updatedContractData;
  }

  // Method to update existing inherited pay elements to be applicable by default
  async updateExistingInheritedElementsToApplicable(): Promise<void> {
    console.log('🔄 Updating existing inherited pay elements to be applicable by default...');
    
    for (const [id, element] of this.contractPayElements.entries()) {
      if (element.isInherited && !element.applicable) {
        const updatedElement: ContractPayElement = {
          ...element,
          applicable: true,
          updatedAt: new Date()
        };
        this.contractPayElements.set(id, updatedElement);
        console.log(`✅ Updated ${element.payElementName} to be applicable by default`);
      }
    }
  }

  // Contract Pay Elements Methods
  async getContractPayElements(contractId: number): Promise<ContractPayElement[]> {
    return Array.from(this.contractPayElements.values()).filter(cpe => cpe.contractId === contractId);
  }

  async createContractPayElement(insertContractPayElement: InsertContractPayElement): Promise<ContractPayElement> {
    const id = this.currentContractPayElementId++;
    const contractPayElement: ContractPayElement = {
      ...insertContractPayElement,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.contractPayElements.set(id, contractPayElement);
    return contractPayElement;
  }

  async updateContractPayElement(id: number, contractPayElementData: Partial<InsertContractPayElement>): Promise<ContractPayElement | undefined> {
    const existingContractPayElement = this.contractPayElements.get(id);
    if (!existingContractPayElement) return undefined;
    
    const updatedContractPayElement: ContractPayElement = {
      ...existingContractPayElement,
      ...contractPayElementData,
      updatedAt: new Date()
    };
    this.contractPayElements.set(id, updatedContractPayElement);
    return updatedContractPayElement;
  }

  async deleteContractPayElement(id: number): Promise<boolean> {
    return this.contractPayElements.delete(id);
  }

  // Utility method to inherit pay elements for a crew member
  async inheritPayElementsForCrewMember(crewMemberId: string, vesselGroup: string = "all-vessels"): Promise<ContractData> {
    // Check if contract data already exists
    let contractData = await this.getContractDataByCrewMember(crewMemberId);
    
    // If no contract data exists, create it
    if (!contractData) {
      const crewMember = await this.getCrewMember(crewMemberId);
      if (!crewMember) {
        throw new Error("Crew member not found");
      }
      
      contractData = await this.createContractData({
        crewMemberId,
        vessel: crewMember.vessel,
        vesselGroup,
        applicableFrom: new Date().toISOString().split('T')[0],
        status: "draft",
        currency: "USD",
        modifiedBy: "system"
      });
    }

    // Get all active pay elements for the vessel group
    const allPayElements = await this.getPayElements();
    const applicablePayElements = allPayElements.filter(pe => {
      // CRITICAL: Only include elements that should reflect in contracts
      if ((pe as any).reflectInContract === false) {
        console.log(`🚫 Excluding pay element "${pe.name}" from contract inheritance (reflectInContract = false)`);
        return false;
      }
      
      // For now, include all other pay elements regardless of status or vessel groups
      // This ensures inheritance works even if vessel groups aren't configured properly
      console.log(`✅ Including pay element "${pe.name}" in contract inheritance (reflectInContract != false)`);
      return true;
      
      // Original strict filtering (commented out for debugging):
      // if (pe.status !== "active") return false;
      // if (!pe.vesselGroups) return false;
      // const vesselGroups = JSON.parse(pe.vesselGroups);
      // return vesselGroups.includes("all-vessels") || vesselGroups.includes(vesselGroup);
    });

    // Get existing contract pay elements
    const existingContractPayElements = await this.getContractPayElements(contractData.id);
    
    // Remove existing inherited contract pay elements that should no longer be inherited
    for (const existingElement of existingContractPayElements) {
      if (existingElement.isInherited && existingElement.payElementId) {
        const originalPayElement = allPayElements.find(pe => pe.id === existingElement.payElementId);
        if (originalPayElement && (originalPayElement as any).reflectInContract === false) {
          console.log(`🗑️ Removing inherited pay element "${originalPayElement.name}" from contract (reflectInContract = false)`);
          await this.deleteContractPayElement(existingElement.id);
        }
      }
    }
    
    // Refresh existing contract pay elements after cleanup
    const refreshedContractPayElements = await this.getContractPayElements(contractData.id);
    const existingElementIds = new Set(refreshedContractPayElements.map(cpe => cpe.payElementId).filter(Boolean));

    // Add missing inherited pay elements
    for (const payElement of applicablePayElements) {
      if (!existingElementIds.has(payElement.id)) {
        await this.createContractPayElement({
          contractId: contractData.id,
          payElementId: payElement.id,
          payElementCode: payElement.code,
          payElementName: payElement.name,
          category: payElement.category,
          type: payElement.type as "earning" | "deduction",
          applicable: true, // Default to applicable - users can unselect if not needed
          formula: payElement.formula,
          value: null,
          isCustom: false,
          isInherited: true,
          sortOrder: 0
        });
      }
    }

    return contractData;
  }

  // Allotments Methods
  async getAllotments(): Promise<Allotment[]> {
    return Array.from(this.allotments.values());
  }

  async getAllotmentsByCrewId(crewId: string): Promise<Allotment[]> {
    return Array.from(this.allotments.values()).filter(a => a.crewId === crewId);
  }

  async createAllotment(insertAllotment: InsertAllotment): Promise<Allotment> {
    const allotment: Allotment = {
      ...insertAllotment,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.allotments.set(allotment.id, allotment);
    return allotment;
  }

  async updateAllotment(id: string, updates: Partial<InsertAllotment>): Promise<Allotment | null> {
    const existing = this.allotments.get(id);
    if (!existing) return null;
    
    const updated: Allotment = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.allotments.set(id, updated);
    return updated;
  }

  async deleteAllotment(id: string): Promise<boolean> {
    return this.allotments.delete(id);
  }

  // Advances Methods
  async getAdvances(): Promise<Advance[]> {
    return Array.from(this.advances.values());
  }

  async getAdvancesByCrewId(crewId: string): Promise<Advance[]> {
    return Array.from(this.advances.values()).filter(a => a.crewId === crewId);
  }

  async createAdvance(insertAdvance: InsertAdvance): Promise<Advance> {
    const advance: Advance = {
      ...insertAdvance,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.advances.set(advance.id, advance);
    return advance;
  }

  async updateAdvance(id: string, updates: Partial<InsertAdvance>): Promise<Advance | null> {
    const existing = this.advances.get(id);
    if (!existing) return null;
    
    const updated: Advance = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.advances.set(id, updated);
    return updated;
  }

  async deleteAdvance(id: string): Promise<boolean> {
    return this.advances.delete(id);
  }

  // Bond Items Methods
  async getBondItems(): Promise<BondItem[]> {
    return Array.from(this.bondItems.values());
  }

  async getBondItemsByCrewId(crewId: string): Promise<BondItem[]> {
    return Array.from(this.bondItems.values()).filter(b => b.crewId === crewId);
  }

  async createBondItem(insertBondItem: InsertBondItem): Promise<BondItem> {
    const bondItem: BondItem = {
      ...insertBondItem,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.bondItems.set(bondItem.id, bondItem);
    return bondItem;
  }

  async updateBondItem(id: string, updates: Partial<InsertBondItem>): Promise<BondItem | null> {
    const existing = this.bondItems.get(id);
    if (!existing) return null;
    
    const updated: BondItem = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.bondItems.set(id, updated);
    return updated;
  }

  async deleteBondItem(id: string): Promise<boolean> {
    return this.bondItems.delete(id);
  }
}
// Default to in-memory storage for development/testing so route handlers
// can safely call storageAccount methods without checking for initialization.
const storageAccount: IStorage = new MemStorage();
console.log("Using MemStorage as storageAccount (in-memory)");
export { storageAccount };