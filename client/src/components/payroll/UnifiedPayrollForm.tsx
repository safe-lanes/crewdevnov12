/**
 * Unified Payroll Form - Combined data from all sources
 * Purpose: Display and edit payroll data from Rate Tables, Contract Data, Allotments, Advances & Bond
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { 
  Edit, 
  Save, 
  X, 
  DollarSign, 
  Minus, 
  Plus,
  ExternalLink
} from 'lucide-react';
import { usePayrollData, type CrewPayrollData, type PayrollElement } from '@/hooks/usePayrollData';
import { useToast } from '@/hooks/use-toast';

interface UnifiedPayrollFormProps {
  crewMemberId: string | null;
  isEditable?: boolean;
}

export function UnifiedPayrollForm({ crewMemberId, isEditable = true }: UnifiedPayrollFormProps) {
  const { 
    data, 
    isLoading, 
    error, 
    updateElementValue, 
    resetEditableValues, 
    savePayrollData,
    hasUnsavedChanges 
  } = usePayrollData(crewMemberId);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Loading payroll data...</h3>
          <p className="text-gray-600">Combining data from multiple sources</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <X className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Data</h3>
          <p className="text-red-600 mb-4">{error.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Crew Member</h3>
          <p className="text-gray-600">Choose a crew member to view their payroll details</p>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    if (!isEditable) {
      toast({
        title: "Cannot Edit",
        description: "Payroll is locked for editing",
        variant: "destructive"
      });
      return;
    }
    setIsEditMode(true);
  };

  const handleSave = async () => {
    try {
      await savePayrollData();
      setIsEditMode(false);
      toast({
        title: "Saved Successfully",
        description: "Payroll data has been updated",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save payroll changes",
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    resetEditableValues();
    setIsEditMode(false);
    toast({
      title: "Changes Discarded",
      description: "Reverted to last saved state",
    });
  };

  const getSourceBadge = (source: PayrollElement['source']) => {
    const variants = {
      inherited: { className: "bg-blue-100 text-blue-800", label: "Rate Tables" },
      contract: { className: "bg-green-100 text-green-800", label: "Contract" },
      allotment: { className: "bg-purple-100 text-purple-800", label: "Allotment" },
      advance: { className: "bg-orange-100 text-orange-800", label: "Advance" },
      bond: { className: "bg-pink-100 text-pink-800", label: "Bond" }
    };
    
    const config = variants[source];
    return (
      <Badge variant="outline" className={`${config.className} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  const renderPayElement = (element: PayrollElement) => (
    <div key={element.id} className="grid grid-cols-12 gap-3 p-3 border rounded-lg hover:bg-gray-50">
      {/* Element Name & Source */}
      <div className="col-span-4">
        <div className="font-medium text-sm">{element.name}</div>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-xs bg-gray-100 px-1 rounded">{element.code}</code>
          {getSourceBadge(element.source)}
        </div>
      </div>

      {/* Category & Formula */}
      <div className="col-span-3">
        <div className="text-sm text-gray-700">{element.category}</div>
        <div className="text-xs text-gray-500 truncate" title={element.formula}>
          {element.formula}
        </div>
      </div>

      {/* Value */}
      <div className="col-span-2">
        {element.isEditable && isEditMode ? (
          <Input
            type="number"
            step="0.01"
            value={element.value || 0}
            onChange={(e) => updateElementValue(element.id, parseFloat(e.target.value) || 0)}
            className="text-sm h-8"
          />
        ) : (
          <div className="text-sm font-mono text-right">
            ${(Number(element.value) || 0).toFixed(2)}
          </div>
        )}
      </div>

      {/* Applicable Toggle */}
      <div className="col-span-1 text-center">
        <div className={`w-3 h-3 rounded-full ${element.applicable ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>

      {/* Actions */}
      <div className="col-span-2 text-center">
        {element.source !== 'inherited' && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => {
              // Navigate to source for editing
              const routes = {
                contract: '/accounts/contract-data',
                allotment: '/accounts/wage-accounts/allotments',
                advance: '/accounts/wage-accounts/advances-bond',
                bond: '/accounts/wage-accounts/advances-bond'
              };
              const route = routes[element.source as keyof typeof routes];
              if (route) {
                console.log(`Navigate to ${route} for element ${element.id}`);
              }
            }}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Edit Source
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <Card>
        <CardHeader className="flex flex-col space-y-1.5 p-6 bg-[#ffffff]">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>{data.crewName} - Payroll Details</span>
              <Badge variant="outline">{data.crewRank}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {!isEditMode && isEditable && (
                <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2">
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
              )}
              {isEditMode && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSave} 
                    disabled={!hasUnsavedChanges}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6 pt-0 space-y-6 bg-[#ffffff]">
          {/* Summary Section - At the top for quick reference */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ${(Number(data.totals.grossEarnings) || 0).toFixed(2)}
              </div>
              <p className="text-sm text-gray-600">Gross Earnings</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                ${(Number(data.totals.totalDeductions) || 0).toFixed(2)}
              </div>
              <p className="text-sm text-gray-600">Total Deductions</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                ${(Number(data.totals.netPay) || 0).toFixed(2)}
              </div>
              <p className="text-sm text-gray-600">Net Pay</p>
            </div>
          </div>

          {/* Single Table Structure - Like Appraisals Form */}
          <div className="space-y-4">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 p-3 bg-gray-100 rounded-lg font-medium text-sm">
              <div className="col-span-1">S.No</div>
              <div className="col-span-3">Pay Element</div>
              <div className="col-span-2">Category & Formula</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1 text-center">Active</div>
              <div className="col-span-2 text-center">Source</div>
              <div className="col-span-1 text-center">Actions</div>
            </div>

            {/* Earnings Section */}
            {data.elements.earnings.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 px-3 py-2 rounded">
                  <Plus className="w-4 h-4" />
                  Earnings ({data.elements.earnings.length})
                </div>
                
                {data.elements.earnings.map((element, index) => (
                  <div key={element.id} className="grid grid-cols-12 gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <div className="col-span-1 text-center text-sm text-gray-500">
                      {index + 1}
                    </div>
                    <div className="col-span-3">
                      <div className="font-medium text-sm">{element.name}</div>
                      <code className="text-xs bg-gray-100 px-1 rounded">{element.code}</code>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-gray-700">{element.category}</div>
                      <div className="text-xs text-gray-500 truncate" title={element.formula}>
                        {element.formula}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      {element.isEditable && isEditMode ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={element.value || 0}
                          onChange={(e) => updateElementValue(element.id, parseFloat(e.target.value) || 0)}
                          className="text-sm h-8"
                        />
                      ) : (
                        <div className="text-sm font-mono">
                          ${(Number(element.value) || 0).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 text-center">
                      <div className={`w-3 h-3 rounded-full ${element.applicable ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                    <div className="col-span-2 text-center">
                      {getSourceBadge(element.source)}
                    </div>
                    <div className="col-span-1 text-center">
                      {element.source !== 'inherited' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => {
                            const routes = {
                              contract: '/accounts/contract-data',
                              allotment: '/accounts/wage-accounts/allotments',
                              advance: '/accounts/wage-accounts/advances-bond',
                              bond: '/accounts/wage-accounts/advances-bond'
                            };
                            const route = routes[element.source as keyof typeof routes];
                            if (route) {
                              console.log(`Navigate to ${route} for element ${element.id}`);
                            }
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Deductions Section */}
            {data.elements.deductions.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-red-700 bg-red-50 px-3 py-2 rounded mt-6">
                  <Minus className="w-4 h-4" />
                  Deductions ({data.elements.deductions.length})
                </div>
                
                {data.elements.deductions.map((element, index) => (
                  <div key={element.id} className="grid grid-cols-12 gap-3 p-3 border rounded-lg hover:bg-gray-50">
                    <div className="col-span-1 text-center text-sm text-gray-500">
                      {data.elements.earnings.length + index + 1}
                    </div>
                    <div className="col-span-3">
                      <div className="font-medium text-sm">{element.name}</div>
                      <code className="text-xs bg-gray-100 px-1 rounded">{element.code}</code>
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm text-gray-700">{element.category}</div>
                      <div className="text-xs text-gray-500 truncate" title={element.formula}>
                        {element.formula}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      {element.isEditable && isEditMode ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={element.value || 0}
                          onChange={(e) => updateElementValue(element.id, parseFloat(e.target.value) || 0)}
                          className="text-sm h-8"
                        />
                      ) : (
                        <div className="text-sm font-mono">
                          ${(Number(element.value) || 0).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 text-center">
                      <div className={`w-3 h-3 rounded-full ${element.applicable ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </div>
                    <div className="col-span-2 text-center">
                      {getSourceBadge(element.source)}
                    </div>
                    <div className="col-span-1 text-center">
                      {element.source !== 'inherited' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => {
                            const routes = {
                              contract: '/accounts/contract-data',
                              allotment: '/accounts/wage-accounts/allotments',
                              advance: '/accounts/wage-accounts/advances-bond',
                              bond: '/accounts/wage-accounts/advances-bond'
                            };
                            const route = routes[element.source as keyof typeof routes];
                            if (route) {
                              console.log(`Navigate to ${route} for element ${element.id}`);
                            }
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Empty State */}
            {data.elements.earnings.length === 0 && data.elements.deductions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg">No pay elements configured</p>
                <p className="text-sm">Add pay elements in Rate Tables & Rules or Contract Data</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}