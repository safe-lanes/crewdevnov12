/**
 * Add Element Modal - Search and add pay elements
 * Purpose: Modal for selecting and adding new pay elements from library
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, Plus } from "lucide-react";
import { PayElement, PayElementType, Basis } from "@/types/wage";
import { useWageRun } from "@/store/wageRuns";
import { useToast } from "@/hooks/use-toast";

interface AddElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  crewId: string;
}

// Mock pay elements library
const mockPayElements: PayElement[] = [
  {
    code: "BASIC",
    name: "Basic Salary",
    type: "EARNING",
    defaultBasis: "fixed",
    defaultRate: 5000,
    currency: "USD",
    isActive: true
  },
  {
    code: "OT_STD",
    name: "Overtime Standard",
    type: "EARNING",
    defaultBasis: "hours",
    defaultRate: 25,
    defaultMultiplier: 1.5,
    currency: "USD",
    isActive: true
  },
  {
    code: "ALLOW_FOOD",
    name: "Food Allowance",
    type: "EARNING",
    defaultBasis: "days",
    defaultRate: 50,
    currency: "USD",
    isActive: true
  },
  {
    code: "TAX_INCOME",
    name: "Income Tax",
    type: "DEDUCTION",
    defaultBasis: "percent",
    defaultRate: 15,
    currency: "USD",
    isActive: true
  },
  {
    code: "SSC_EMP",
    name: "Social Security - Employee",
    type: "DEDUCTION",
    defaultBasis: "percent",
    defaultRate: 6.2,
    currency: "USD",
    isActive: true
  },
  {
    code: "PENSION",
    name: "Pension Contribution",
    type: "CONTRIBUTION",
    defaultBasis: "percent",
    defaultRate: 5,
    currency: "USD",
    isActive: true
  },
  {
    code: "BONUS",
    name: "Performance Bonus",
    type: "EARNING",
    defaultBasis: "fixed",
    defaultRate: 1000,
    currency: "USD",
    isActive: true
  },
  {
    code: "ALLOT",
    name: "Allotment",
    type: "DEDUCTION",
    defaultBasis: "fixed",
    defaultRate: 2000,
    currency: "USD",
    isActive: true
  }
];

export default function AddElementModal({ isOpen, onClose, crewId }: AddElementModalProps) {
  const { upsertLine } = useWageRun();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<PayElementType | "ALL">("ALL");
  const [selectedElement, setSelectedElement] = useState<PayElement | null>(null);
  const [customValues, setCustomValues] = useState({
    hours: 0,
    days: 0,
    rate: 0,
    multiplier: 1,
    amount: 0
  });

  const filteredElements = mockPayElements.filter(element => {
    const matchesSearch = element.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         element.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "ALL" || element.type === filterType;
    return matchesSearch && matchesType && element.isActive;
  });

  const handleElementSelect = (element: PayElement) => {
    setSelectedElement(element);
    setCustomValues({
      hours: 0,
      days: 0,
      rate: element.defaultRate || 0,
      multiplier: element.defaultMultiplier || 1,
      amount: element.defaultRate || 0
    });
  };

  const handleAdd = async () => {
    if (!selectedElement) return;

    try {
      const newLine = {
        code: selectedElement.code,
        name: selectedElement.name,
        type: selectedElement.type,
        basis: selectedElement.defaultBasis,
        currency: selectedElement.currency,
        hours: selectedElement.defaultBasis === "hours" ? customValues.hours : undefined,
        days: selectedElement.defaultBasis === "days" ? customValues.days : undefined,
        rate: ["hours", "days", "percent"].includes(selectedElement.defaultBasis) ? customValues.rate : undefined,
        multiplier: selectedElement.defaultBasis === "hours" ? customValues.multiplier : undefined,
        amount: selectedElement.defaultBasis === "fixed" ? customValues.amount : 
                selectedElement.defaultBasis === "hours" ? customValues.hours * customValues.rate * customValues.multiplier :
                selectedElement.defaultBasis === "days" ? customValues.days * customValues.rate :
                customValues.amount,
        isManual: false
      };

      await upsertLine(crewId, newLine);
      
      toast({
        title: "Element Added",
        description: `${selectedElement.name} has been added to the payroll`,
      });
      
      handleClose();
    } catch (error) {
      toast({
        title: "Add Failed",
        description: "Failed to add pay element",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setSearchTerm("");
    setFilterType("ALL");
    setSelectedElement(null);
    setCustomValues({ hours: 0, days: 0, rate: 0, multiplier: 1, amount: 0 });
    onClose();
  };

  const getTypeColor = (type: PayElementType) => {
    switch (type) {
      case "EARNING": return "bg-green-100 text-green-800";
      case "DEDUCTION": return "bg-red-100 text-red-800";
      case "CONTRIBUTION": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Pay Element</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Elements</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="filter">Filter by Type</Label>
              <Select value={filterType} onValueChange={(value: PayElementType | "ALL") => setFilterType(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="EARNING">Earnings</SelectItem>
                  <SelectItem value="DEDUCTION">Deductions</SelectItem>
                  <SelectItem value="CONTRIBUTION">Contributions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Elements List */}
            <div>
              <h3 className="font-medium mb-3">Available Elements ({filteredElements.length})</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {filteredElements.map(element => (
                  <div
                    key={element.code}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedElement?.code === element.code
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleElementSelect(element)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{element.name}</div>
                        <div className="text-sm text-gray-600">{element.code}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getTypeColor(element.type)}>
                          {element.type}
                        </Badge>
                        <span className="text-xs text-gray-500">{element.defaultBasis}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredElements.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No elements found matching your search
                  </div>
                )}
              </div>
            </div>

            {/* Configuration Panel */}
            <div>
              {selectedElement ? (
                <div className="space-y-4">
                  <h3 className="font-medium">Configure Element</h3>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium">{selectedElement.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedElement.code} • {selectedElement.type} • {selectedElement.defaultBasis}
                    </div>
                  </div>

                  {selectedElement.defaultBasis === "hours" && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="hours">Hours</Label>
                        <Input
                          id="hours"
                          type="number"
                          value={customValues.hours}
                          onChange={e => setCustomValues(prev => ({ ...prev, hours: parseFloat(e.target.value) || 0 }))}
                          min={0}
                          step={0.25}
                        />
                      </div>
                      <div>
                        <Label htmlFor="rate">Rate (per hour)</Label>
                        <Input
                          id="rate"
                          type="number"
                          value={customValues.rate}
                          onChange={e => setCustomValues(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                          min={0}
                          step={0.01}
                        />
                      </div>
                      <div>
                        <Label htmlFor="multiplier">Multiplier</Label>
                        <Input
                          id="multiplier"
                          type="number"
                          value={customValues.multiplier}
                          onChange={e => setCustomValues(prev => ({ ...prev, multiplier: parseFloat(e.target.value) || 1 }))}
                          min={0}
                          step={0.1}
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        Total: ${(customValues.hours * customValues.rate * customValues.multiplier).toFixed(2)}
                      </div>
                    </div>
                  )}

                  {selectedElement.defaultBasis === "days" && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="days">Days</Label>
                        <Input
                          id="days"
                          type="number"
                          value={customValues.days}
                          onChange={e => setCustomValues(prev => ({ ...prev, days: parseFloat(e.target.value) || 0 }))}
                          min={0}
                          step={0.5}
                        />
                      </div>
                      <div>
                        <Label htmlFor="rate">Rate (per day)</Label>
                        <Input
                          id="rate"
                          type="number"
                          value={customValues.rate}
                          onChange={e => setCustomValues(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                          min={0}
                          step={0.01}
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        Total: ${(customValues.days * customValues.rate).toFixed(2)}
                      </div>
                    </div>
                  )}

                  {selectedElement.defaultBasis === "fixed" && (
                    <div>
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={customValues.amount}
                        onChange={e => setCustomValues(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                        step={0.01}
                      />
                    </div>
                  )}

                  {selectedElement.defaultBasis === "percent" && (
                    <div>
                      <Label htmlFor="rate">Percentage Rate</Label>
                      <Input
                        id="rate"
                        type="number"
                        value={customValues.rate}
                        onChange={e => setCustomValues(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                        min={0}
                        max={100}
                        step={0.1}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Will be calculated as percentage of base amount
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select an element from the list to configure
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!selectedElement}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Element
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}