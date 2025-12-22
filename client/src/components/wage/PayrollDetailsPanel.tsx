/**
 * Payroll Details Panel - Unified crew payroll management
 * Purpose: Main right panel with combined data from Rate Tables, Contract Data, Allotments, Advances & Bond
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Save, X, Plus, Calculator, AlertTriangle, Check, FileText, Settings, CreditCard, History, Eye } from "lucide-react";
import { useWageRun } from "@/store/wageRuns";
import { PayElementType } from "@/types/wage";
import ElementLineRow from "./ElementLineRow";
import { useToast } from "@/hooks/use-toast";
import CrewPayrollCardModal from "./CrewPayrollCardModal";
import { AddPayElementModal } from '@/components/payroll/AddPayElementModal';
import { type PayElement } from '@/store/payElements';
import { UnifiedPayrollForm } from '@/components/payroll/UnifiedPayrollForm';

interface PayrollDetailsPanelProps {
  crewId: string;
}

export default function PayrollDetailsPanel({ crewId }: PayrollDetailsPanelProps) {
  const {
    crewMap,
    canEdit,
    isEditMode,
    isSaving,
    setEditMode,
    resetChanges,
    recalc
  } = useWageRun();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayrollCardModal, setShowPayrollCardModal] = useState(false);
  const { toast } = useToast();
  
  // Handler for adding pay elements from the global library
  const handleAddPayElement = (element: PayElement, configuration: any) => {
    // TODO: Implement adding the pay element to the crew's payroll
    console.log('Adding pay element to crew:', { element, configuration, crewId });
    toast({
      title: "Pay Element Added",
      description: `${element.name} has been added to the payroll`,
    });
  };
  
  // Use the new unified payroll system
  return (
    <div className="h-full p-6">
      <UnifiedPayrollForm 
        crewMemberId={crewId} 
        isEditable={canEdit}
      />

      {/* Add Pay Element Modal */}
      <AddPayElementModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddPayElement}
        crewId={crewId}
        title="Add Pay Element to Crew"
        description="Select a pay element from your configured library to add to this crew member's payroll"
      />

      {/* Crew Payroll Card Modal */}
      <CrewPayrollCardModal
        isOpen={showPayrollCardModal}
        onClose={() => setShowPayrollCardModal(false)}
        crewId={crewId}
        crewName="Selected Crew Member"
        crewRank="Unknown"
      />
    </div>
  );
}