/**
 * Vessel Group Modal
 * Purpose: Create and manage vessel groups for customized pay elements configuration
 */

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Ship, Users, Check } from "lucide-react";

interface Vessel {
  id: string;
  name: string;
  type: string;
}

interface VesselGroup {
  id: string;
  name: string;
  vesselIds: string[];
}

interface VesselGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (group: Omit<VesselGroup, 'id'>) => void;
}

const mockVessels: Vessel[] = [
  { id: "mv-atlantic-star", name: "MV Atlantic Star", type: "Cargo" },
  { id: "mv-atlantic-explorer", name: "MV Atlantic Explorer", type: "Cargo" },
  { id: "mv-pacific-voyager", name: "MV Pacific Voyager", type: "Tanker" },
  { id: "mv-northern-star", name: "MV Northern Star", type: "Container" },
  { id: "mv-southern-cross", name: "MV Southern Cross", type: "Bulk Carrier" },
  { id: "mv-eastern-dawn", name: "MV Eastern Dawn", type: "Cargo" },
  { id: "mv-western-wind", name: "MV Western Wind", type: "Tanker" },
  { id: "mv-ocean-breeze", name: "MV Ocean Breeze", type: "Container" },
];

export function VesselGroupModal({ open, onOpenChange, onSave }: VesselGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ groupName?: string; vessels?: string }>({});

  const handleVesselToggle = (vesselId: string) => {
    setSelectedVessels(prev => 
      prev.includes(vesselId) 
        ? prev.filter(id => id !== vesselId)
        : [...prev, vesselId]
    );
    // Clear vessels error when user selects vessels
    if (errors.vessels) {
      setErrors(prev => ({ ...prev, vessels: undefined }));
    }
  };

  const handleSave = () => {
    const newErrors: { groupName?: string; vessels?: string } = {};
    
    if (!groupName.trim()) {
      newErrors.groupName = "Group name is required";
    }
    
    if (selectedVessels.length === 0) {
      newErrors.vessels = "Please select at least one vessel";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: groupName.trim(),
      vesselIds: selectedVessels
    });

    // Reset form
    setGroupName("");
    setSelectedVessels([]);
    setErrors({});
    onOpenChange(false);
  };

  const handleCancel = () => {
    setGroupName("");
    setSelectedVessels([]);
    setErrors({});
    onOpenChange(false);
  };

  const handleGroupNameChange = (value: string) => {
    setGroupName(value);
    // Clear error when user types
    if (errors.groupName) {
      setErrors(prev => ({ ...prev, groupName: undefined }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Create Vessel Group
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-6">
          {/* Group Name Input */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="Enter group name (e.g., Atlantic Fleet, Tanker Group)"
              value={groupName}
              onChange={(e) => handleGroupNameChange(e.target.value)}
              className={errors.groupName ? "border-red-500" : ""}
            />
            {errors.groupName && (
              <p className="text-sm text-red-600">{errors.groupName}</p>
            )}
          </div>

          {/* Vessel Selection */}
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Vessels</Label>
              <div className="text-sm text-gray-500">
                {selectedVessels.length} of {mockVessels.length} selected
              </div>
            </div>
            
            {errors.vessels && (
              <p className="text-sm text-red-600">{errors.vessels}</p>
            )}

            <Card className="flex-1 overflow-hidden">
              <CardContent className="p-4 h-full overflow-auto">
                <div className="space-y-3">
                  {mockVessels.map((vessel) => {
                    const isSelected = selectedVessels.includes(vessel.id);
                    return (
                      <div
                        key={vessel.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected 
                            ? "bg-blue-50 border-blue-200" 
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                        onClick={() => handleVesselToggle(vessel.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleVesselToggle(vessel.id)}
                        />
                        <Ship className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{vessel.name}</div>
                          <div className="text-sm text-gray-500">{vessel.type}</div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Create Group
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}