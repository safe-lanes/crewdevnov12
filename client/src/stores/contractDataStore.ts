/**
 * Contract Data Store
 * Manages crew member contract wage information with automatic inheritance from Rate Tables & Rules
 */

import { create } from 'zustand';
import type { ContractData, ContractPayElement } from '@shared/schema';

interface ContractDataState {
  // Current contract data
  contractData: ContractData | null;
  earnings: ContractPayElement[];
  deductions: ContractPayElement[];
  isLoading: boolean;
  
  // UI state
  selectedCrewId: string | null;
  
  // Actions
  fetchContractData: (crewMemberId: string, vesselGroup?: string) => Promise<void>;
  updatePayElementApplicability: (elementId: number, applicable: boolean) => Promise<void>;
  updatePayElementValue: (elementId: number, value: string | null) => Promise<void>;
  addCustomPayElement: (element: Partial<ContractPayElement>) => Promise<void>;
  removeCustomPayElement: (elementId: number) => Promise<void>;
  updateContractStatus: (contractId: number, status: 'draft' | 'active') => Promise<void>;
  updateContractEffectiveDate: (contractId: number, effectiveDate: string) => Promise<void>;
  setSelectedCrewId: (id: string | null) => void;
}

export const useContractDataStore = create<ContractDataState>((set, get) => ({
  // Initial state
  contractData: null,
  earnings: [],
  deductions: [],
  isLoading: false,
  selectedCrewId: null,
  
  // Fetch contract data with automatic pay element inheritance
  fetchContractData: async (crewMemberId: string, vesselGroup = "all-vessels") => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/contract-data/${crewMemberId}?vesselGroup=${vesselGroup}`);
      if (!response.ok) {
        throw new Error('Failed to fetch contract data');
      }
      const data = await response.json();
      
      set({
        contractData: data.contractData,
        earnings: data.earnings.sort((a: ContractPayElement, b: ContractPayElement) => (a.sortOrder || 0) - (b.sortOrder || 0)),
        deductions: data.deductions.sort((a: ContractPayElement, b: ContractPayElement) => (a.sortOrder || 0) - (b.sortOrder || 0)),
        isLoading: false
      });
    } catch (error) {
      console.error('Error fetching contract data:', error);
      set({ isLoading: false });
      throw error;
    }
  },
  
  // Update pay element applicability (toggle on/off)
  updatePayElementApplicability: async (elementId: number, applicable: boolean) => {
    try {
      const response = await fetch(`/api/contract-pay-elements/${elementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicable })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update pay element applicability');
      }
      
      const updatedElement = await response.json();
      
      set((state) => {
        const updateArray = (arr: ContractPayElement[]) =>
          arr.map(item => item.id === elementId ? updatedElement : item);
        
        return {
          earnings: updatedElement.type === 'earning' ? updateArray(state.earnings) : state.earnings,
          deductions: updatedElement.type === 'deduction' ? updateArray(state.deductions) : state.deductions
        };
      });
    } catch (error) {
      console.error('Error updating pay element applicability:', error);
      throw error;
    }
  },
  
  // Update pay element value
  updatePayElementValue: async (elementId: number, value: string | null) => {
    try {
      const response = await fetch(`/api/contract-pay-elements/${elementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update pay element value');
      }
      
      const updatedElement = await response.json();
      
      set((state) => {
        const updateArray = (arr: ContractPayElement[]) =>
          arr.map(item => item.id === elementId ? updatedElement : item);
        
        return {
          earnings: updatedElement.type === 'earning' ? updateArray(state.earnings) : state.earnings,
          deductions: updatedElement.type === 'deduction' ? updateArray(state.deductions) : state.deductions
        };
      });
    } catch (error) {
      console.error('Error updating pay element value:', error);
      throw error;
    }
  },
  
  // Add custom pay element
  addCustomPayElement: async (element: Partial<ContractPayElement>) => {
    const { contractData } = get();
    if (!contractData) {
      throw new Error('No contract data available');
    }
    
    try {
      const response = await fetch('/api/contract-pay-elements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...element, 
          contractId: contractData.id,
          isCustom: true, 
          isInherited: false 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create custom pay element');
      }
      
      const newElement = await response.json();
      
      set((state) => ({
        earnings: newElement.type === 'earning' 
          ? [...state.earnings, newElement].sort((a, b) => a.sortOrder - b.sortOrder)
          : state.earnings,
        deductions: newElement.type === 'deduction' 
          ? [...state.deductions, newElement].sort((a, b) => a.sortOrder - b.sortOrder)
          : state.deductions
      }));
    } catch (error) {
      console.error('Error adding custom pay element:', error);
      throw error;
    }
  },
  
  // Remove custom pay element
  removeCustomPayElement: async (elementId: number) => {
    try {
      const response = await fetch(`/api/contract-pay-elements/${elementId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete custom pay element');
      }
      
      set((state) => ({
        earnings: state.earnings.filter(item => item.id !== elementId),
        deductions: state.deductions.filter(item => item.id !== elementId)
      }));
    } catch (error) {
      console.error('Error removing custom pay element:', error);
      throw error;
    }
  },

  // Update contract status
  updateContractStatus: async (contractId: number, status: 'draft' | 'active') => {
    try {
      const response = await fetch(`/api/contract-data/${contractId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update contract status');
      }
      
      const updatedContract = await response.json();
      
      set((state) => ({
        contractData: state.contractData?.id === contractId ? updatedContract : state.contractData
      }));
    } catch (error) {
      console.error('Error updating contract status:', error);
      throw error;
    }
  },
  
  // Update contract effective date
  updateContractEffectiveDate: async (contractId: number, effectiveDate: string) => {
    try {
      const response = await fetch(`/api/contract-data/${contractId}/effective-date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effectiveDate })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update contract effective date');
      }
      
      const updatedContract = await response.json();
      
      set((state) => ({
        contractData: state.contractData?.id === contractId ? updatedContract : state.contractData
      }));
    } catch (error) {
      console.error('Error updating contract effective date:', error);
      throw error;
    }
  },
  
  setSelectedCrewId: (id) => set({ selectedCrewId: id })
}));