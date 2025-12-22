/**
 * Contract Data Workspace
 * Central repository for wage information with automatic inheritance from Rate Tables & Rules
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Search,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Minus,
  AlertCircle
} from "lucide-react";
import { useContractDataStore } from "@/stores/contractDataStore";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ContractPayElement } from '@shared/schema';
import { AddPayElementModal } from "@/components/contract-data/AddPayElementModal";

export const ContractDataWorkspace: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVesselGroup, setSelectedVesselGroup] = useState("all-vessels");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState<'earning' | 'deduction'>('earning');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editableEffectiveDate, setEditableEffectiveDate] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    contractData,
    earnings,
    deductions,
    isLoading,
    selectedCrewId,
    setSelectedCrewId,
    fetchContractData,
    updatePayElementApplicability,
    updatePayElementValue,
    addCustomPayElement,
    removeCustomPayElement,
    updateContractStatus,
    updateContractEffectiveDate
  } = useContractDataStore();

  // Fetch crew members
  const { data: crewMembers = [], isLoading: crewLoading } = useQuery({
    queryKey: ['/api/crew-members'],
    queryFn: async () => {
      const response = await fetch('/api/crew-members');
      if (!response.ok) throw new Error('Failed to fetch crew members');
      return response.json();
    },
  });

  // Filter crew members based on search
  const filteredCrewMembers = crewMembers.filter((crew: any) => 
    crew.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    crew.rank.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Automatically fetch contract data when crew member is selected
  useEffect(() => {
    if (selectedCrewId) {
      fetchContractData(selectedCrewId, selectedVesselGroup).catch((error) => {
        toast({
          title: "Error",
          description: "Failed to load contract data",
          variant: "destructive",
        });
        console.error('Error fetching contract data:', error);
      });
    }
  }, [selectedCrewId, selectedVesselGroup, fetchContractData, toast]);

  // Initialize editable effective date when contract data loads
  useEffect(() => {
    if (contractData?.applicableFrom) {
      const dateValue = new Date(contractData.applicableFrom).toISOString().split('T')[0];
      setEditableEffectiveDate(dateValue);
    }
  }, [contractData]);

  // Event handlers for pay element management
  const handleApplicableToggle = async (elementId: number, checked: boolean) => {
    try {
      await updatePayElementApplicability(elementId, checked);
      toast({
        title: "Updated",
        description: `Pay element ${checked ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update pay element applicability",
        variant: "destructive",
      });
    }
  };

  const handleValueChange = async (elementId: number, value: string) => {
    try {
      const processedValue = value.trim() === '' ? null : value;
      await updatePayElementValue(elementId, processedValue);
      toast({
        title: "Updated",
        description: "Pay element value updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update pay element value",
        variant: "destructive",
      });
    }
  };

  const handleOpenAddModal = (type: 'earning' | 'deduction') => {
    setAddModalType(type);
    setShowAddModal(true);
  };

  const handleAddCustomPayElement = async (elementData: any) => {
    try {
      await addCustomPayElement({
        ...elementData,
        sortOrder: addModalType === 'earning' ? earnings.length : deductions.length
      });
      
      toast({
        title: "Added",
        description: `Custom ${addModalType} added successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to add custom ${addModalType}`,
        variant: "destructive",
      });
    }
  };

  const handleRemoveCustomPayElement = async (elementId: number) => {
    try {
      await removeCustomPayElement(elementId);
      toast({
        title: "Removed",
        description: "Custom pay element removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove pay element",
        variant: "destructive",
      });
    }
  };

  const handleActivateContract = async () => {
    if (!contractData?.id) return;
    
    try {
      // Update effective date if changed and then activate
      if (editableEffectiveDate && editableEffectiveDate !== new Date(contractData.applicableFrom).toISOString().split('T')[0]) {
        await updateContractEffectiveDate(contractData.id, editableEffectiveDate);
      }
      
      await updateContractStatus(contractData.id, 'active');
      
      // Invalidate payroll data cache to ensure updates reflect
      queryClient.invalidateQueries({ queryKey: ['payroll-data'] });
      
      toast({
        title: "Contract Activated",
        description: `Contract activated with effective date: ${editableEffectiveDate}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to activate contract",
        variant: "destructive",
      });
    }
  };

  const handleSaveEffectiveDate = async () => {
    if (!contractData?.id || !editableEffectiveDate) return;
    
    try {
      await updateContractEffectiveDate(contractData.id, editableEffectiveDate);
      setIsEditingDate(false);
      
      toast({
        title: "Updated",
        description: "Effective date updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update effective date",
        variant: "destructive",
      });
    }
  };

  const handleCancelDateEdit = () => {
    if (contractData?.applicableFrom) {
      const dateValue = new Date(contractData.applicableFrom).toISOString().split('T')[0];
      setEditableEffectiveDate(dateValue);
    }
    setIsEditingDate(false);
  };

  const handleMakeDraft = async () => {
    if (!contractData?.id) return;
    
    try {
      await updateContractStatus(contractData.id, 'draft');
      
      // Invalidate payroll data cache to ensure updates reflect
      queryClient.invalidateQueries({ queryKey: ['payroll-data'] });
      
      toast({
        title: "Contract Made Draft",
        description: "Contract status changed to draft successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change contract to draft",
        variant: "destructive",
      });
    }
  };

  // Pay Element Component
  const PayElementRow: React.FC<{
    element: ContractPayElement;
    onToggle: (id: number, checked: boolean) => void;
    onValueChange: (id: number, value: string) => void;
    onRemove?: (id: number) => void;
  }> = ({ element, onToggle, onValueChange, onRemove }) => {
    const [localValue, setLocalValue] = useState(element.value?.toString() || '');

    const handleValueSubmit = () => {
      if (localValue !== (element.value?.toString() || '')) {
        onValueChange(element.id!, localValue);
      }
    };

    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-3 flex-1">
          <Switch
            checked={element.applicable}
            onCheckedChange={(checked) => onToggle(element.id!, checked)}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{element.payElementName}</span>
              {element.isInherited && (
                <Badge variant="outline" className="text-xs">Inherited</Badge>
              )}
              {element.isCustom && (
                <Badge variant="secondary" className="text-xs">Custom</Badge>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {element.payElementCode} • {element.category}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleValueSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleValueSubmit()}
            placeholder="Value"
            className="w-24 h-8 text-sm"
            disabled={!element.applicable}
          />
          {element.isCustom && onRemove && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(element.id!)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Crew Member Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Crew Members</h2>
            <Select value={selectedVesselGroup} onValueChange={setSelectedVesselGroup}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-vessels">All Vessels</SelectItem>
                <SelectItem value="tankers">Tankers</SelectItem>
                <SelectItem value="bulk-carriers">Bulk Carriers</SelectItem>
                <SelectItem value="container-ships">Container Ships</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search crew members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Crew Member List */}
        <div className="flex-1 overflow-y-auto">
          {crewLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredCrewMembers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No crew members found
            </div>
          ) : (
            filteredCrewMembers.map((crew: any) => (
              <div
                key={crew.id}
                className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                  selectedCrewId === crew.id ? 'bg-blue-100 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => setSelectedCrewId(crew.id)}
              >
                <div className="font-medium text-sm text-gray-900">
                  {crew.firstName} {crew.lastName || ''}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{crew.rank}</span>
                  <span>•</span>
                  <span>{crew.vessel}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {!selectedCrewId ? (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a Crew Member
              </h3>
              <p className="text-gray-500">
                Choose a crew member to view their contract data and inherited pay elements
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex-1 bg-white p-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : contractData ? (
          <div className="flex-1 bg-white overflow-y-auto">
            {/* Contract Header */}
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Contract Data
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{contractData.vessel} • {contractData.currency}</span>
                    <div className="flex items-center gap-2">
                      <span>From:</span>
                      {isEditingDate ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={editableEffectiveDate}
                            onChange={(e) => setEditableEffectiveDate(e.target.value)}
                            className="w-40 h-7 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveEffectiveDate}
                            className="h-7 px-2 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelDateEdit}
                            className="h-7 px-2 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingDate(true)}
                          className="h-auto p-1 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                        >
                          {new Date(contractData.applicableFrom).toLocaleDateString()}
                          <Calendar className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={contractData.status === 'active' ? 'default' : 'secondary'}>
                    {contractData.status}
                  </Badge>
                  {contractData.status === 'draft' ? (
                    <Button size="sm" onClick={handleActivateContract}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Activate Contract
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={handleMakeDraft}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Make Draft
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Pay Elements Sections */}
            <div className="p-6 space-y-8">
              {/* Section A: Earnings */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium text-green-700 flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Section A: Earnings
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAddModal('earning')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Earning
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {earnings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      No earnings elements found
                    </div>
                  ) : (
                    earnings.map((element) => (
                      <PayElementRow
                        key={element.id}
                        element={element}
                        onToggle={handleApplicableToggle}
                        onValueChange={handleValueChange}
                        onRemove={element.isCustom ? handleRemoveCustomPayElement : undefined}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Section B: Deductions */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium text-red-700 flex items-center gap-2">
                      <Minus className="w-5 h-5" />
                      Section B: Deductions
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAddModal('deduction')}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Deduction
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deductions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      No deduction elements found
                    </div>
                  ) : (
                    deductions.map((element) => (
                      <PayElementRow
                        key={element.id}
                        element={element}
                        onToggle={handleApplicableToggle}
                        onValueChange={handleValueChange}
                        onRemove={element.isCustom ? handleRemoveCustomPayElement : undefined}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Failed to Load Contract Data
              </h3>
              <p className="text-gray-500 mb-4">
                Unable to load contract data for the selected crew member
              </p>
              <Button onClick={() => selectedCrewId && fetchContractData(selectedCrewId, selectedVesselGroup)}>
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Pay Element Modal */}
      <AddPayElementModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddCustomPayElement}
        type={addModalType}
      />
    </div>
  );
};