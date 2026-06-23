/**
 * Contract Data Store
 * Manages crew member contract wage information with automatic inheritance from
 * Rate Tables & Rules. Backed by the native V2 Accounts API (/api/v2/accounts).
 */

import { create } from 'zustand';
import type {
  AccContractV2,
  AccContractPayElementV2,
} from '@shared/v2/accounts/types';

const V2_BASE = '/api/v2/accounts';

interface ContractDataState {
  // Current contract data
  contractData: AccContractV2 | null;
  earnings: AccContractPayElementV2[];
  deductions: AccContractPayElementV2[];
  isLoading: boolean;

  // UI state
  selectedCrewId: string | null;

  // Actions
  fetchContractData: (crewUuid: string, vesselGroup?: string) => Promise<void>;
  updatePayElementApplicability: (
    contractPayElementUuid: string,
    applicable: boolean,
  ) => Promise<void>;
  updatePayElementValue: (
    contractPayElementUuid: string,
    value: string | null,
  ) => Promise<void>;
  addCustomPayElement: (
    element: Partial<AccContractPayElementV2>,
  ) => Promise<void>;
  removeCustomPayElement: (contractPayElementUuid: string) => Promise<void>;
  updateContractStatus: (
    contractUuid: string,
    status: 'draft' | 'active',
  ) => Promise<void>;
  updateContractEffectiveDate: (
    contractUuid: string,
    effectiveDate: string,
  ) => Promise<void>;
  setSelectedCrewId: (id: string | null) => void;
}

const sortByOrder = (a: AccContractPayElementV2, b: AccContractPayElementV2) =>
  (a.sortOrder || 0) - (b.sortOrder || 0);

export const useContractDataStore = create<ContractDataState>((set, get) => ({
  // Initial state
  contractData: null,
  earnings: [],
  deductions: [],
  isLoading: false,
  selectedCrewId: null,

  // Fetch contract data with automatic pay element inheritance
  fetchContractData: async (crewUuid: string, vesselGroup = 'all-vessels') => {
    set({ isLoading: true });
    try {
      const response = await fetch(
        `${V2_BASE}/contract-data/${crewUuid}?vesselGroup=${vesselGroup}`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch contract data');
      }
      const data = await response.json();

      set({
        contractData: data.contractData,
        earnings: (data.earnings || []).sort(sortByOrder),
        deductions: (data.deductions || []).sort(sortByOrder),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching contract data:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Update pay element applicability (toggle on/off)
  updatePayElementApplicability: async (contractPayElementUuid, applicable) => {
    try {
      const response = await fetch(
        `${V2_BASE}/contract-pay-elements/${contractPayElementUuid}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicable }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update pay element applicability');
      }

      const updatedElement: AccContractPayElementV2 = await response.json();

      set((state) => {
        const updateArray = (arr: AccContractPayElementV2[]) =>
          arr.map((item) =>
            item.contractPayElementUuid === contractPayElementUuid
              ? updatedElement
              : item,
          );

        return {
          earnings:
            updatedElement.type === 'earning'
              ? updateArray(state.earnings)
              : state.earnings,
          deductions:
            updatedElement.type === 'deduction'
              ? updateArray(state.deductions)
              : state.deductions,
        };
      });
    } catch (error) {
      console.error('Error updating pay element applicability:', error);
      throw error;
    }
  },

  // Update pay element value
  updatePayElementValue: async (contractPayElementUuid, value) => {
    try {
      const response = await fetch(
        `${V2_BASE}/contract-pay-elements/${contractPayElementUuid}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update pay element value');
      }

      const updatedElement: AccContractPayElementV2 = await response.json();

      set((state) => {
        const updateArray = (arr: AccContractPayElementV2[]) =>
          arr.map((item) =>
            item.contractPayElementUuid === contractPayElementUuid
              ? updatedElement
              : item,
          );

        return {
          earnings:
            updatedElement.type === 'earning'
              ? updateArray(state.earnings)
              : state.earnings,
          deductions:
            updatedElement.type === 'deduction'
              ? updateArray(state.deductions)
              : state.deductions,
        };
      });
    } catch (error) {
      console.error('Error updating pay element value:', error);
      throw error;
    }
  },

  // Add custom pay element
  addCustomPayElement: async (element) => {
    const { contractData } = get();
    if (!contractData) {
      throw new Error('No contract data available');
    }

    try {
      const response = await fetch(`${V2_BASE}/contract-pay-elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...element,
          contractUuid: contractData.contractUuid,
          isCustom: true,
          isInherited: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create custom pay element');
      }

      const newElement: AccContractPayElementV2 = await response.json();

      set((state) => ({
        earnings:
          newElement.type === 'earning'
            ? [...state.earnings, newElement].sort(sortByOrder)
            : state.earnings,
        deductions:
          newElement.type === 'deduction'
            ? [...state.deductions, newElement].sort(sortByOrder)
            : state.deductions,
      }));
    } catch (error) {
      console.error('Error adding custom pay element:', error);
      throw error;
    }
  },

  // Remove custom pay element
  removeCustomPayElement: async (contractPayElementUuid) => {
    try {
      const response = await fetch(
        `${V2_BASE}/contract-pay-elements/${contractPayElementUuid}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        throw new Error('Failed to delete custom pay element');
      }

      set((state) => ({
        earnings: state.earnings.filter(
          (item) => item.contractPayElementUuid !== contractPayElementUuid,
        ),
        deductions: state.deductions.filter(
          (item) => item.contractPayElementUuid !== contractPayElementUuid,
        ),
      }));
    } catch (error) {
      console.error('Error removing custom pay element:', error);
      throw error;
    }
  },

  // Update contract status
  updateContractStatus: async (contractUuid, status) => {
    try {
      const response = await fetch(
        `${V2_BASE}/contracts/${contractUuid}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update contract status');
      }

      const updatedContract: AccContractV2 = await response.json();

      set((state) => ({
        contractData:
          state.contractData?.contractUuid === contractUuid
            ? updatedContract
            : state.contractData,
      }));
    } catch (error) {
      console.error('Error updating contract status:', error);
      throw error;
    }
  },

  // Update contract effective date
  updateContractEffectiveDate: async (contractUuid, effectiveDate) => {
    try {
      const response = await fetch(
        `${V2_BASE}/contracts/${contractUuid}/effective-date`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ effectiveDate }),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to update contract effective date');
      }

      const updatedContract: AccContractV2 = await response.json();

      set((state) => ({
        contractData:
          state.contractData?.contractUuid === contractUuid
            ? updatedContract
            : state.contractData,
      }));
    } catch (error) {
      console.error('Error updating contract effective date:', error);
      throw error;
    }
  },

  setSelectedCrewId: (id) => set({ selectedCrewId: id }),
}));
