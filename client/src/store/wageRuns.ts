/**
 * Wage Runs Store
 * Purpose: Zustand store for managing payroll run state and editing
 */

import { create } from "zustand";
import { CrewPayrollSnapshot, PayElementLine, PayRunStatus } from "@/types/wage";

type State = {
  runId: string;
  status: PayRunStatus;
  selectedCrewId?: string;
  crewMap: Record<string, CrewPayrollSnapshot>;
  isSaving: boolean;
  canEdit: boolean; // derived from status
  isEditMode: boolean;
};

type Actions = {
  initialize: (runId: string, status: PayRunStatus) => void;
  loadCrew: (crewId: string) => Promise<void>;
  selectCrew: (crewId: string) => void;
  upsertLine: (crewId: string, line: Partial<PayElementLine> & { id?: string }) => Promise<void>;
  deleteLine: (crewId: string, lineId: string) => Promise<void>;
  recalc: (scope?: "crew" | "full") => Promise<void>;
  setStatus: (s: PayRunStatus) => void;
  setEditMode: (enabled: boolean) => void;
  resetChanges: (crewId: string) => Promise<void>;
};

// Mock API functions for now
const mockApi = {
  async getCrewPayroll(runId: string, crewId: string): Promise<CrewPayrollSnapshot> {
    // Mock data based on crew member
    const crewNames: Record<string, { name: string; rank: string }> = {
      "1": { name: "James Wilson", rank: "Captain" },
      "2": { name: "Sarah Chen", rank: "Chief Engineer" },
      "3": { name: "Mike Rodriguez", rank: "Second Officer" }
    };
    
    const crew = crewNames[crewId] || { name: "Unknown", rank: "Crew" };
    
    const lines: PayElementLine[] = [
      {
        id: `basic-${crewId}`,
        code: "BASIC",
        name: "Basic Salary",
        type: "EARNING",
        basis: "fixed",
        currency: "USD",
        amount: crewId === "1" ? 8500 : crewId === "2" ? 7200 : 5500,
        isManual: false
      },
      {
        id: `ot-${crewId}`,
        code: "OT_PREM",
        name: "Overtime Premium",
        type: "EARNING",
        basis: "hours",
        hours: 20,
        rate: 25,
        multiplier: 1.5,
        currency: "USD",
        amount: 750,
        isManual: false
      },
      {
        id: `tax-${crewId}`,
        code: "TAX",
        name: "Income Tax",
        type: "DEDUCTION",
        basis: "percent",
        rate: 15,
        currency: "USD",
        amount: -1275,
        isManual: false
      }
    ];

    const earnings = lines.filter(l => l.type === "EARNING").reduce((sum, l) => sum + l.amount, 0);
    const deductions = lines.filter(l => l.type === "DEDUCTION").reduce((sum, l) => sum + Math.abs(l.amount), 0);
    
    return {
      crewId,
      name: crew.name,
      rank: crew.rank,
      lines,
      totals: {
        earnings,
        deductions,
        net: earnings - deductions
      }
    };
  },

  async upsertPayElement(runId: string, crewId: string, line: Partial<PayElementLine>): Promise<void> {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
  },

  async deletePayElement(runId: string, crewId: string, lineId: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  },

  async recalculate(runId: string, scope: string, crewIds?: string[]): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 800));
  }
};

export const useWageRun = create<State & Actions>((set, get) => ({
  runId: "",
  status: "draft",
  selectedCrewId: undefined,
  crewMap: {},
  isSaving: false,
  isEditMode: false,
  get canEdit() { 
    return ["draft"].includes(get().status); 
  },

  initialize: (runId: string, status: PayRunStatus) => {
    set({ runId, status });
  },

  async loadCrew(crewId: string) {
    const { runId } = get();
    try {
      const snapshot = await mockApi.getCrewPayroll(runId, crewId);
      set(state => ({
        crewMap: {
          ...state.crewMap,
          [crewId]: snapshot
        }
      }));
    } catch (error) {
      console.error('Failed to load crew payroll:', error);
    }
  },

  selectCrew(crewId: string) {
    const { crewMap, loadCrew } = get();
    set({ selectedCrewId: crewId, isEditMode: false });
    
    // Load crew data if not already loaded
    if (!crewMap[crewId]) {
      loadCrew(crewId);
    }
  },

  async upsertLine(crewId: string, line: Partial<PayElementLine> & { id?: string }) {
    const { runId } = get();
    set({ isSaving: true });
    
    try {
      await mockApi.upsertPayElement(runId, crewId, line);
      
      // Update local state
      set(state => {
        const crew = state.crewMap[crewId];
        if (!crew) return state;

        let updatedLines;
        if (line.id && crew.lines.find(l => l.id === line.id)) {
          // Update existing line
          updatedLines = crew.lines.map(l => l.id === line.id ? { ...l, ...line } : l);
        } else {
          // Add new line
          const newLine: PayElementLine = {
            id: line.id || `new-${Date.now()}`,
            code: line.code || "NEW",
            name: line.name || "New Element",
            type: line.type || "EARNING",
            basis: line.basis || "fixed",
            currency: line.currency || "USD",
            amount: line.amount || 0,
            isManual: line.isManual || false,
            ...line
          };
          updatedLines = [...crew.lines, newLine];
        }

        // Recalculate totals
        const earnings = updatedLines.filter(l => l.type === "EARNING").reduce((sum, l) => sum + l.amount, 0);
        const deductions = updatedLines.filter(l => l.type === "DEDUCTION").reduce((sum, l) => sum + Math.abs(l.amount), 0);

        return {
          crewMap: {
            ...state.crewMap,
            [crewId]: {
              ...crew,
              lines: updatedLines,
              totals: {
                earnings,
                deductions,
                net: earnings - deductions
              }
            }
          }
        };
      });

      await get().recalc("crew");
    } catch (error) {
      console.error('Failed to save pay element:', error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  async deleteLine(crewId: string, lineId: string) {
    const { runId } = get();
    
    try {
      await mockApi.deletePayElement(runId, crewId, lineId);
      
      // Update local state
      set(state => {
        const crew = state.crewMap[crewId];
        if (!crew) return state;

        const updatedLines = crew.lines.filter(l => l.id !== lineId);
        const earnings = updatedLines.filter(l => l.type === "EARNING").reduce((sum, l) => sum + l.amount, 0);
        const deductions = updatedLines.filter(l => l.type === "DEDUCTION").reduce((sum, l) => sum + Math.abs(l.amount), 0);

        return {
          crewMap: {
            ...state.crewMap,
            [crewId]: {
              ...crew,
              lines: updatedLines,
              totals: {
                earnings,
                deductions,
                net: earnings - deductions
              }
            }
          }
        };
      });

      await get().recalc("crew");
    } catch (error) {
      console.error('Failed to delete pay element:', error);
      throw error;
    }
  },

  async recalc(scope = "crew") {
    const { runId, selectedCrewId } = get();
    
    try {
      await mockApi.recalculate(runId, scope, selectedCrewId ? [selectedCrewId] : undefined);
      
      if (selectedCrewId) {
        await get().loadCrew(selectedCrewId);
      }
    } catch (error) {
      console.error('Failed to recalculate:', error);
    }
  },

  setStatus(status: PayRunStatus) {
    set({ status });
  },

  setEditMode(isEditMode: boolean) {
    set({ isEditMode });
  },

  async resetChanges(crewId: string) {
    await get().loadCrew(crewId);
    set({ isEditMode: false });
  }
}));