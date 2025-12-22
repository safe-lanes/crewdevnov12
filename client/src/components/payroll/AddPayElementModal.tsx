/**
 * Add Pay Element Modal
 * Purpose: Reusable modal for adding pay elements from the global library to payroll
 * This ensures consistency across all payroll screens (Payrun Details, Payroll Card, etc.)
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, DollarSign, Minus, Calculator } from "lucide-react";
import { usePayElementsStore, type PayElement } from "@/store/payElements";

interface AddPayElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (element: PayElement, configuration: PayElementConfiguration) => void;
  vesselId?: string; // For filtering vessel-specific elements
  crewId?: string; // For individual crew additions
  title?: string;
  description?: string;
}

interface PayElementConfiguration {
  hours?: number;
  rate?: number;
  amount?: number;
  multiplier?: number;
  percentage?: number;
  isManual: boolean;
}

const getTypeBadge = (type: string) => {
  const variants = {
    earning: { className: "bg-green-100 text-green-800", icon: Plus },
    deduction: { className: "bg-red-100 text-red-800", icon: Minus },
    contribution: { className: "bg-blue-100 text-blue-800", icon: DollarSign }
  };
  const config = variants[type as keyof typeof variants] || variants.earning;
  const Icon = config.icon;
  
  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="w-3 h-3 mr-1" />
      {type.toUpperCase()}
    </Badge>
  );
};

export function AddPayElementModal({
  isOpen,
  onClose,
  onAdd,
  vesselId,
  crewId,
  title = "Add Pay Element",
  description = "Select a pay element from your configured library to add to the payroll"
}: AddPayElementModalProps) {
  const { getActiveElements, getElementsForVessel } = usePayElementsStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedElement, setSelectedElement] = useState<PayElement | null>(null);
  const [configuration, setConfiguration] = useState<PayElementConfiguration>({
    isManual: true
  });

  // Get available elements based on vessel or show all active elements
  const availableElements = vesselId ? getElementsForVessel(vesselId) : getActiveElements();
  
  // Filter elements based on search and type
  const filteredElements = availableElements.filter(element => {
    const matchesSearch = element.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         element.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || element.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setSelectedType("all");
      setSelectedElement(null);
      setConfiguration({ isManual: true });
    }
  }, [isOpen]);

  const handleElementSelect = (element: PayElement) => {
    setSelectedElement(element);
    // Set default configuration based on element type and formula
    setConfiguration({
      amount: element.type === "earning" ? 0 : 0,
      isManual: true
    });
  };

  const handleAdd = () => {
    if (!selectedElement) return;
    
    onAdd(selectedElement, configuration);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Elements</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="type-filter">Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="earning">Earnings</SelectItem>
                  <SelectItem value="deduction">Deductions</SelectItem>
                  <SelectItem value="contribution">Contributions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Elements List */}
          <div className="border rounded-lg">
            <div className="grid grid-cols-6 gap-4 p-3 bg-gray-50 rounded-t-lg font-medium text-sm border-b">
              <div>Element Name</div>
              <div>Code</div>
              <div>Type</div>
              <div>Category</div>
              <div>Formula</div>
              <div>Action</div>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {filteredElements.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No pay elements found. {searchTerm && "Try adjusting your search terms."}
                </div>
              ) : (
                filteredElements.map((element) => (
                  <div 
                    key={element.id} 
                    className={`grid grid-cols-6 gap-4 p-3 border-b hover:bg-gray-50 cursor-pointer ${
                      selectedElement?.id === element.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                    onClick={() => handleElementSelect(element)}
                  >
                    <div className="font-medium">{element.name}</div>
                    <div className="font-mono text-sm">{element.code}</div>
                    <div>{getTypeBadge(element.type)}</div>
                    <div className="text-sm text-gray-600">{element.category}</div>
                    <div className="text-xs text-gray-500 truncate" title={element.formula}>
                      {element.formula}
                    </div>
                    <div>
                      <Button
                        size="sm"
                        variant={selectedElement?.id === element.id ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleElementSelect(element);
                        }}
                      >
                        {selectedElement?.id === element.id ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Configuration Panel */}
          {selectedElement && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-3">Configure: {selectedElement.name}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount">Amount ({configuration.isManual ? "Manual" : "Calculated"})</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={configuration.amount || ""}
                    onChange={(e) => setConfiguration(prev => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="Enter amount"
                  />
                </div>
                
                {selectedElement.type === "earning" && selectedElement.formula.includes("HOURS") && (
                  <div>
                    <Label htmlFor="hours">Hours</Label>
                    <Input
                      id="hours"
                      type="number"
                      step="0.1"
                      value={configuration.hours || ""}
                      onChange={(e) => setConfiguration(prev => ({
                        ...prev,
                        hours: parseFloat(e.target.value) || 0
                      }))}
                      placeholder="Enter hours"
                    />
                  </div>
                )}
                
                {selectedElement.formula.includes("RATE") && (
                  <div>
                    <Label htmlFor="rate">Rate</Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      value={configuration.rate || ""}
                      onChange={(e) => setConfiguration(prev => ({
                        ...prev,
                        rate: parseFloat(e.target.value) || 0
                      }))}
                      placeholder="Enter rate"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <div className="text-sm text-gray-600">
              {filteredElements.length} element{filteredElements.length !== 1 ? 's' : ''} available
              {vesselId && " for this vessel"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}