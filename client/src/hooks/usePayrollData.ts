/**
 * Unified Payroll Data Hook
 * Purpose: Combine data from Rate Tables & Rules, Contract Data, Allotments, Advances & Bond
 * for Pay Run Details screen
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export interface PayrollElement {
  id: string;
  name: string;
  code: string;
  type: 'earning' | 'deduction';
  category: string;
  formula: string;
  value: number | null;
  isEditable: boolean;
  source: 'contract' | 'allotment' | 'advance' | 'bond' | 'inherited';
  applicable: boolean;
  originalId?: string; // Reference to source record
}

export interface CrewPayrollData {
  crewMemberId: string;
  crewName: string;
  crewRank: string;
  vessel: string;
  contractData: {
    id: number;
    currency: string;
    vesselGroup: string;
  };
  elements: {
    earnings: PayrollElement[];
    deductions: PayrollElement[];
  };
  totals: {
    grossEarnings: number;
    totalDeductions: number;
    netPay: number;
  };
}

/**
 * Fetch combined payroll data for a crew member from multiple sources
 */
export function usePayrollData(crewMemberId: string | null) {
  const [editableValues, setEditableValues] = useState<Record<string, number>>({});

  const { data, isLoading, error, refetch } = useQuery<CrewPayrollData | null>({
    queryKey: ['payroll-data', crewMemberId],
    queryFn: async () => {
      if (!crewMemberId) return null;

      try {
        console.log(`📊 Fetching combined payroll data for crew: ${crewMemberId}`);
        
        // 1. Fetch Contract Data (includes inherited elements from Rate Tables & Rules)
        const contractResponse = await fetch(`/api/contract-data/${crewMemberId}`);
        if (!contractResponse.ok) {
          throw new Error(`Failed to fetch contract data: ${contractResponse.status}`);
        }
        const contractData = await contractResponse.json();
        
        // 2. Fetch Crew Member Info
        const crewResponse = await fetch(`/api/crew-members`);
        if (!crewResponse.ok) {
          throw new Error(`Failed to fetch crew members: ${crewResponse.status}`);
        }
        const crewMembers = await crewResponse.json();
        const crewMember = crewMembers.find((c: any) => c.id === crewMemberId);
        
        if (!crewMember) {
          throw new Error(`Crew member not found: ${crewMemberId}`);
        }

        // 3. Fetch Allotments (TODO: Create API endpoint)
        const allotments = await fetchAllotments(crewMemberId);
        
        // 4. Fetch Advances & Bond (TODO: Create API endpoint)
        const advances = await fetchAdvances(crewMemberId);
        const bonds = await fetchBonds(crewMemberId);

        // 5. Combine all data into unified payroll elements
        const elements = combinePayrollElements(
          contractData.earnings || [],
          contractData.deductions || [],
          allotments,
          advances,
          bonds
        );

        const result: CrewPayrollData = {
          crewMemberId,
          crewName: `${crewMember.firstName} ${crewMember.lastName}`,
          crewRank: crewMember.rank || 'Unknown',
          vessel: crewMember.vessel || '',
          contractData: {
            id: contractData.contractData?.id || 0,
            currency: contractData.contractData?.currency || 'USD',
            vesselGroup: contractData.contractData?.vesselGroup || 'all-vessels'
          },
          elements,
          totals: calculateTotals(elements)
        };

        console.log(`✅ Combined payroll data fetched successfully:`, result);
        return result;
        
      } catch (error) {
        console.error('❌ Error fetching payroll data:', error);
        throw error;
      }
    },
    enabled: !!crewMemberId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  const updateElementValue = (elementId: string, value: number) => {
    setEditableValues(prev => ({
      ...prev,
      [elementId]: value
    }));
  };

  const resetEditableValues = () => {
    setEditableValues({});
  };

  const savePayrollData = async () => {
    if (!data || Object.keys(editableValues).length === 0) return;

    try {
      console.log('💾 Saving payroll changes:', editableValues);
      
      // TODO: Implement save logic to appropriate APIs
      // For now, just log the changes
      console.log('Changes to save:', editableValues);
      
      // Reset editable values after successful save
      setEditableValues({});
      
      // Refetch to get updated data
      await refetch();
      
    } catch (error) {
      console.error('❌ Error saving payroll data:', error);
      throw error;
    }
  };

  // Apply editable values overlay
  const dataWithEdits = data ? {
    ...data,
    elements: {
      earnings: data.elements.earnings.map(el => ({
        ...el,
        value: editableValues[el.id] ?? el.value
      })),
      deductions: data.elements.deductions.map(el => ({
        ...el,
        value: editableValues[el.id] ?? el.value
      }))
    }
  } : null;

  return {
    data: dataWithEdits,
    isLoading,
    error,
    refetch,
    updateElementValue,
    resetEditableValues,
    savePayrollData,
    hasUnsavedChanges: Object.keys(editableValues).length > 0
  };
}

// Helper functions for fetching additional data sources
async function fetchAllotments(crewMemberId: string) {
  try {
    console.log(`🏦 Fetching allotments for crew: ${crewMemberId}`);
    const response = await fetch(`/api/allotments/crew/${crewMemberId}`);
    if (!response.ok) throw new Error('Failed to fetch allotments');
    return response.json();
  } catch (error) {
    console.warn('⚠️ Failed to fetch allotments:', error);
    return [];
  }
}

async function fetchAdvances(crewMemberId: string) {
  try {
    console.log(`💰 Fetching advances for crew: ${crewMemberId}`);
    const response = await fetch(`/api/advances/crew/${crewMemberId}`);
    if (!response.ok) throw new Error('Failed to fetch advances');
    return response.json();
  } catch (error) {
    console.warn('⚠️ Failed to fetch advances:', error);
    return [];
  }
}

async function fetchBonds(crewMemberId: string) {
  try {
    console.log(`🛒 Fetching bond purchases for crew: ${crewMemberId}`);
    const response = await fetch(`/api/bond-items/crew/${crewMemberId}`);
    if (!response.ok) throw new Error('Failed to fetch bond items');
    return response.json();
  } catch (error) {
    console.warn('⚠️ Failed to fetch bonds:', error);
    return [];
  }
}

// Combine data from all sources into unified payroll elements
function combinePayrollElements(
  earnings: any[],
  deductions: any[],
  allotments: any[],
  advances: any[],
  bonds: any[]
): { earnings: PayrollElement[]; deductions: PayrollElement[] } {
  
  const combinedEarnings: PayrollElement[] = [];
  const combinedDeductions: PayrollElement[] = [];

  // 1. Add inherited/contract earnings
  earnings.forEach(earning => {
    combinedEarnings.push({
      id: `earning_${earning.id}`,
      name: earning.payElementName,
      code: earning.payElementCode,
      type: 'earning',
      category: earning.category || 'Fixed',
      formula: earning.formula || 'No Formula',
      value: Number(earning.value) || 0,
      isEditable: earning.applicable || false,
      source: earning.isInherited ? 'inherited' : 'contract',
      applicable: earning.applicable || false,
      originalId: earning.id?.toString()
    });
  });

  // 2. Add inherited/contract deductions  
  deductions.forEach(deduction => {
    combinedDeductions.push({
      id: `deduction_${deduction.id}`,
      name: deduction.payElementName,
      code: deduction.payElementCode,
      type: 'deduction',
      category: deduction.category || 'Fixed',
      formula: deduction.formula || 'No Formula',
      value: Number(deduction.value) || 0,
      isEditable: deduction.applicable || false,
      source: deduction.isInherited ? 'inherited' : 'contract',
      applicable: deduction.applicable || false,
      originalId: deduction.id?.toString()
    });
  });

  // 3. Add allotments total as single deduction
  if (allotments.length > 0) {
    const totalAllotments = allotments.reduce((total, allotment) => {
      if (allotment.allotmentType === 'fixed' && allotment.status === 'active') {
        return total + allotment.value;
      }
      return total;
    }, 0);

    const activeAllotmentsCount = allotments.filter(a => a.status === 'active').length;

    if (activeAllotmentsCount > 0) {
      combinedDeductions.push({
        id: 'allotments_total',
        name: `Allotments (${activeAllotmentsCount} items)`,
        code: 'ALLOTMENTS',
        type: 'deduction',
        category: 'Allotments',
        formula: 'Sum of Active Allotments',
        value: totalAllotments,
        isEditable: false, // Redirect to Allotments Manager for details
        source: 'allotment',
        applicable: true,
        originalId: 'allotments_summary'
      });
    }
  }

  // 4. Add advances total as single deduction (recovery amounts)
  if (advances.length > 0) {
    const totalAdvanceRecovery = advances.reduce((total, advance) => {
      if ((advance.status === 'approved' || advance.status === 'disbursed') && advance.recoveryAmount) {
        return total + advance.recoveryAmount;
      }
      return total;
    }, 0);

    const activeAdvancesCount = advances.filter(a => 
      (a.status === 'approved' || a.status === 'disbursed') && a.recoveryAmount > 0
    ).length;

    if (activeAdvancesCount > 0 && totalAdvanceRecovery > 0) {
      combinedDeductions.push({
        id: 'advances_total',
        name: `Cash Advance Recovery (${activeAdvancesCount} items)`,
        code: 'ADVANCES',
        type: 'deduction',
        category: 'Advance Recovery',
        formula: 'Sum of Recovery Amounts',
        value: totalAdvanceRecovery,
        isEditable: false, // Redirect to Advances & Bond Manager for details
        source: 'advance',
        applicable: true,
        originalId: 'advances_summary'
      });
    }
  }

  // 5. Add bond purchases total as single deduction
  if (bonds.length > 0) {
    const totalBonds = bonds.reduce((total, bond) => {
      if (bond.autoDeduct && (bond.status === 'pending' || bond.status === 'deducted')) {
        return total + (bond.deductionAmount || bond.totalPrice || 0);
      }
      return total;
    }, 0);

    const activeBondsCount = bonds.filter(b => 
      b.autoDeduct && (b.status === 'pending' || b.status === 'deducted')
    ).length;

    if (activeBondsCount > 0 && totalBonds > 0) {
      combinedDeductions.push({
        id: 'bonds_total',
        name: `Bond Purchases (${activeBondsCount} items)`,
        code: 'BONDS',
        type: 'deduction',
        category: 'Bond Purchases',
        formula: 'Sum of Bond Items',
        value: totalBonds,
        isEditable: false, // Redirect to Advances & Bond Manager for details
        source: 'bond',
        applicable: true,
        originalId: 'bonds_summary'
      });
    }
  }

  return {
    earnings: combinedEarnings,
    deductions: combinedDeductions
  };
}

// Calculate totals from payroll elements
function calculateTotals(elements: { earnings: PayrollElement[]; deductions: PayrollElement[] }) {
  const grossEarnings = elements.earnings
    .filter(e => e.applicable)
    .reduce((sum, e) => sum + (Number(e.value) || 0), 0);
    
  const totalDeductions = elements.deductions
    .filter(e => e.applicable)
    .reduce((sum, e) => sum + (Number(e.value) || 0), 0);
    
  const netPay = grossEarnings - totalDeductions;

  return {
    grossEarnings,
    totalDeductions,
    netPay
  };
}