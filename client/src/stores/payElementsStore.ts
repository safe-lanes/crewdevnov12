/**
 * Global Pay Elements Store
 * Master configuration source for pay elements across the application
 */

import { create } from 'zustand';

export interface PayElement {
  id: string;
  name: string;
  code: string;
  type: 'earning' | 'deduction' | 'contribution';
  category: string;
  formula: string;
  rounding: string;
  ceiling?: number;
  floor?: number;
  effectiveDate: string;
  status: 'active' | 'inactive';
  vesselGroups?: string[]; // Which vessel groups this element applies to
}

export interface VesselGroup {
  id: string;
  name: string;
  vessels: string[];
  createdDate: string;
}

interface PayElementsState {
  payElements: PayElement[];
  vesselGroups: VesselGroup[];
  selectedVesselGroup: string;
  
  // Actions
  setPayElements: (elements: PayElement[]) => void;
  addPayElement: (element: PayElement) => void;
  updatePayElement: (id: string, element: Partial<PayElement>) => void;
  deletePayElement: (id: string) => void;
  
  setVesselGroups: (groups: VesselGroup[]) => void;
  addVesselGroup: (group: VesselGroup) => void;
  setSelectedVesselGroup: (groupId: string) => void;
  
  // Get filtered pay elements by vessel group
  getPayElementsByVesselGroup: (groupId: string) => PayElement[];
}

// Initial data - these would normally come from the database
const initialPayElements: PayElement[] = [
  {
    id: "PE001",
    name: "Basic Salary",
    code: "BASIC",
    type: "earning",
    category: "Fixed",
    formula: "Monthly Fixed Amount",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels", "tankers"]
  },
  {
    id: "PE002",
    name: "Fixed Overtime",
    code: "FIXED_OT",
    type: "earning",
    category: "Fixed",
    formula: "Fixed Monthly Amount",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels"]
  },
  {
    id: "PE003",
    name: "Variable Overtime Rate",
    code: "VAR_OT",
    type: "earning",
    category: "Variable",
    formula: "Hourly × Rate × Multiplier",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels", "tankers"]
  },
  {
    id: "PE004",
    name: "Leave Pay",
    code: "LEAVE_PAY",
    type: "earning",
    category: "Fixed",
    formula: "No Formula",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels"]
  },
  {
    id: "PE005",
    name: "Uniform Allowance",
    code: "UA",
    type: "earning",
    category: "Fixed",
    formula: "No Formula",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels", "tankers"]
  },
  {
    id: "PE006",
    name: "Fixed Allotment",
    code: "FIXED_ALLOT",
    type: "deduction",
    category: "Fixed",
    formula: "Fixed Amount",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels"]
  },
  {
    id: "PE007",
    name: "Union Deduction",
    code: "UNION_DED",
    type: "deduction",
    category: "Fixed",
    formula: "Fixed Amount",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels"]
  },
  {
    id: "PE008",
    name: "PF",
    code: "PF",
    type: "deduction",
    category: "Variable",
    formula: "Percentage of Gross",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels", "tankers"]
  },
  {
    id: "PE009",
    name: "Income Tax",
    code: "INCOME_TAX",
    type: "deduction",
    category: "Statutory",
    formula: "Percentage of Gross",
    rounding: "ROUND_DOWN_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    vesselGroups: ["all-vessels"]
  }
];

const initialVesselGroups: VesselGroup[] = [
  {
    id: "all-vessels",
    name: "All Vessels",
    vessels: ["MV Atlantic Explorer", "MV Pacific Pioneer", "MV Arctic Dawn", "SS Mediterranean Star"],
    createdDate: "2025-01-01"
  },
  {
    id: "tankers",
    name: "Tankers",
    vessels: ["MV Atlantic Explorer", "MV Pacific Pioneer"],
    createdDate: "2025-01-01"
  }
];

export const usePayElementsStore = create<PayElementsState>((set, get) => ({
  payElements: initialPayElements,
  vesselGroups: initialVesselGroups,
  selectedVesselGroup: "all-vessels",
  
  setPayElements: (elements) => set({ payElements: elements }),
  
  addPayElement: (element) => set((state) => ({
    payElements: [...state.payElements, element]
  })),
  
  updatePayElement: (id, updates) => set((state) => ({
    payElements: state.payElements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    )
  })),
  
  deletePayElement: (id) => set((state) => ({
    payElements: state.payElements.filter(el => el.id !== id)
  })),
  
  setVesselGroups: (groups) => set({ vesselGroups: groups }),
  
  addVesselGroup: (group) => set((state) => ({
    vesselGroups: [...state.vesselGroups, group]
  })),
  
  setSelectedVesselGroup: (groupId) => set({ selectedVesselGroup: groupId }),
  
  getPayElementsByVesselGroup: (groupId) => {
    const { payElements } = get();
    return payElements.filter(element => 
      element.status === 'active' && 
      element.vesselGroups?.includes(groupId)
    );
  }
}));