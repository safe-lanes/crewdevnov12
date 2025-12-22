/**
 * Element Line Row - Individual pay element with edit capabilities
 * Purpose: Renders a single pay element line in read or edit mode
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, AlertCircle } from "lucide-react";
import { PayElementLine, Basis } from "@/types/wage";
import { useWageRun } from "@/store/wageRuns";
import { useToast } from "@/hooks/use-toast";

interface ElementLineRowProps {
  line: PayElementLine;
  crewId: string;
  editable: boolean;
}

export default function ElementLineRow({ line, crewId, editable }: ElementLineRowProps) {
  const { upsertLine, deleteLine, isSaving } = useWageRun();
  const { toast } = useToast();
  const [localLine, setLocalLine] = useState<PayElementLine>(line);
  const [hasChanges, setHasChanges] = useState(false);

  const updateField = (field: keyof PayElementLine, value: any) => {
    const updated = { ...localLine, [field]: value };
    
    // Auto-calculate amount for certain basis types
    if (field === 'hours' || field === 'rate' || field === 'multiplier') {
      if (updated.basis === 'hours' && updated.hours && updated.rate) {
        updated.amount = updated.hours * updated.rate * (updated.multiplier || 1);
      }
    }
    if (field === 'days' || field === 'rate') {
      if (updated.basis === 'days' && updated.days && updated.rate) {
        updated.amount = updated.days * updated.rate;
      }
    }

    setLocalLine(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await upsertLine(crewId, localLine);
      setHasChanges(false);
      toast({
        title: "Element Updated",
        description: `${localLine.name} has been updated successfully`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update pay element",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${line.name}?`)) {
      try {
        await deleteLine(crewId, line.id);
        toast({
          title: "Element Deleted",
          description: `${line.name} has been removed`,
        });
      } catch (error) {
        toast({
          title: "Delete Failed",
          description: "Failed to delete pay element",
          variant: "destructive"
        });
      }
    }
  };

  const renderEditFields = () => {
    const fields = [];

    if (localLine.basis === "hours") {
      fields.push(
        <div key="hours" className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-12">Hours:</label>
          <Input
            type="number"
            value={localLine.hours || 0}
            onChange={e => updateField('hours', parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-sm"
            min={0}
            step={0.25}
          />
        </div>
      );
      fields.push(
        <div key="rate" className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-12">Rate:</label>
          <Input
            type="number"
            value={localLine.rate || 0}
            onChange={e => updateField('rate', parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-sm"
            min={0}
            step={0.01}
          />
        </div>
      );
      fields.push(
        <div key="multiplier" className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-12">Mult:</label>
          <Input
            type="number"
            value={localLine.multiplier || 1}
            onChange={e => updateField('multiplier', parseFloat(e.target.value) || 1)}
            className="w-20 h-8 text-sm"
            min={0}
            step={0.1}
          />
        </div>
      );
    }

    if (localLine.basis === "days") {
      fields.push(
        <div key="days" className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-12">Days:</label>
          <Input
            type="number"
            value={localLine.days || 0}
            onChange={e => updateField('days', parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-sm"
            min={0}
            step={0.5}
          />
        </div>
      );
      fields.push(
        <div key="rate" className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-12">Rate:</label>
          <Input
            type="number"
            value={localLine.rate || 0}
            onChange={e => updateField('rate', parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-sm"
            min={0}
            step={0.01}
          />
        </div>
      );
    }

    if (localLine.basis === "fixed") {
      fields.push(
        <div key="amount" className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-12">Amount:</label>
          <Input
            type="number"
            value={localLine.amount}
            onChange={e => updateField('amount', parseFloat(e.target.value) || 0)}
            className="w-24 h-8 text-sm"
            step={0.01}
          />
        </div>
      );
    }

    if (localLine.basis === "percent") {
      fields.push(
        <div key="rate" className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-12">Rate %:</label>
          <Input
            type="number"
            value={localLine.rate || 0}
            onChange={e => updateField('rate', parseFloat(e.target.value) || 0)}
            className="w-20 h-8 text-sm"
            min={0}
            max={100}
            step={0.1}
          />
        </div>
      );
    }

    return fields;
  };

  const getAmountColor = () => {
    if (line.type === "EARNING") return "text-green-600";
    if (line.type === "DEDUCTION") return "text-red-600";
    return "text-blue-600";
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${
      hasChanges ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
    }`}>
      <div className="flex items-center gap-4 flex-1">
        {/* Element Name and Code */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-900">{line.name}</span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {line.code}
          </span>
          {line.isManual && (
            <AlertCircle className="w-4 h-4 text-amber-500" title="Manual override" />
          )}
        </div>

        {/* Basis Selection - Only in Edit Mode */}
        {editable && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Basis:</label>
            <Select
              value={localLine.basis}
              onValueChange={(value: Basis) => updateField('basis', value)}
            >
              <SelectTrigger className="w-20 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
                <SelectItem value="percent">Percent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Edit Fields - Inline */}
        {editable && (
          <div className="flex items-center gap-2">
            {renderEditFields()}
          </div>
        )}

        {/* Calculation Display - Non-edit mode */}
        {!editable && localLine.basis !== "fixed" && (
          <div className="text-xs text-gray-500">
            {localLine.basis === "hours" && `${localLine.hours || 0}h × $${localLine.rate || 0} × ${localLine.multiplier || 1}`}
            {localLine.basis === "days" && `${localLine.days || 0}d × $${localLine.rate || 0}`}
            {localLine.basis === "percent" && `${localLine.rate || 0}%`}
          </div>
        )}
      </div>

      {/* Amount Display */}
      <div className="text-right">
        <div className={`text-sm font-medium ${getAmountColor()}`}>
          ${Math.abs(localLine.amount).toFixed(2)}
        </div>
      </div>

      {/* Action Buttons */}
      {editable && (
        <div className="flex items-center gap-2 ml-4">
          {hasChanges && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-8 px-3"
            >
              Save
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}