/**
 * Pay Elements Store
 * Purpose: Global store for managing pay elements library configuration
 * This serves as the master configuration that feeds into all payroll screens
 */

import { create } from "zustand";

export interface PayElement {
  id: string;
  name: string;
  code: string;
  type: "earning" | "deduction" | "contribution";
  category: string;
  formula: string;
  rounding: string;
  ceiling?: number;
  floor?: number;
  effectiveDate: string;
  status: "active" | "inactive";
  vesselGroups?: string[]; // Optional: specific vessel groups this applies to
  clientId?: string; // For multi-client support
}

export interface PayElementsState {
  // Pay Elements Library
  elements: PayElement[];
  
  // Client configuration
  currentClientId: string;
  
  // Actions
  setElements: (elements: PayElement[]) => void;
  addElement: (element: PayElement) => void;
  updateElement: (id: string, updates: Partial<PayElement>) => void;
  removeElement: (id: string) => void;
  
  // Getters for different contexts
  getActiveElements: () => PayElement[];
  getElementsForVessel: (vesselId: string) => PayElement[];
  getElementsByType: (type: PayElement['type']) => PayElement[];
  
  // Client management
  setCurrentClient: (clientId: string) => void;
  getElementsForClient: (clientId?: string) => PayElement[];
}

// Mock data - initial pay elements library
const mockPayElements: PayElement[] = [
  {
    id: "PE001",
    name: "Basic Salary",
    code: "BASIC",
    type: "earning",
    category: "Fixed Pay",
    formula: "Monthly Fixed Amount",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    clientId: "default"
  },
  {
    id: "PE002",
    name: "Overtime Premium",
    code: "OT_PREM",
    type: "earning",
    category: "Variable Pay",
    formula: "Hours × Rate × Multiplier",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    clientId: "default"
  },
  {
    id: "PE003",
    name: "Income Tax",
    code: "INCOME_TAX",
    type: "deduction",
    category: "Statutory",
    formula: "Percentage of Gross",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-01-01",
    status: "active",
    clientId: "default"
  },
  {
    id: "PE004",
    name: "Uniform Allowance",
    code: "UA",
    type: "earning",
    category: "Fixed Pay",
    formula: "No Formula",
    rounding: "ROUND_NEAREST_CENT",
    effectiveDate: "2025-08-15",
    status: "active",
    clientId: "default"
  }
];

export const usePayElementsStore = create<PayElementsState>((set, get) => ({
  elements: mockPayElements,
  currentClientId: "default",
  
  setElements: (elements) => set({ elements }),
  
  addElement: (element) => set((state) => ({
    elements: [...state.elements, element]
  })),
  
  updateElement: (id, updates) => set((state) => ({
    elements: state.elements.map(el => 
      el.id === id ? { ...el, ...updates } : el
    )
  })),
  
  removeElement: (id) => set((state) => ({
    elements: state.elements.filter(el => el.id !== id)
  })),
  
  getActiveElements: () => {
    const { elements, currentClientId } = get();
    return elements.filter(el => 
      el.status === "active" && 
      (el.clientId === currentClientId || !el.clientId)
    );
  },
  
  getElementsForVessel: (vesselId) => {
    const { elements, currentClientId } = get();
    return elements.filter(el => 
      el.status === "active" && 
      (el.clientId === currentClientId || !el.clientId) &&
      (!el.vesselGroups || el.vesselGroups.includes(vesselId))
    );
  },
  
  getElementsByType: (type) => {
    const { elements, currentClientId } = get();
    return elements.filter(el => 
      el.type === type && 
      el.status === "active" && 
      (el.clientId === currentClientId || !el.clientId)
    );
  },
  
  setCurrentClient: (clientId) => set({ currentClientId: clientId }),
  
  getElementsForClient: (clientId) => {
    const { elements, currentClientId } = get();
    const targetClientId = clientId || currentClientId;
    return elements.filter(el => 
      el.clientId === targetClientId || !el.clientId
    );
  }
}));