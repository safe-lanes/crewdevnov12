/**
 * Pay Element Modal - Comprehensive formula builder
 * Purpose: Create and edit pay elements with formula builder functionality
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Calculator,
  Plus,
  Info,
  Copy,
  X,
  DollarSign
} from "lucide-react";

interface PayElement {
  payElementId: string;
  payElementCode: string;
  payElementName: string;
  type: 'earning' | 'deduction';
  category: string;
  formula: string;
  rounding: string;
  value: number | string;
  applicable: boolean;
  isCustom?: boolean;
  reflectInContract?: boolean;
}

interface PayElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (element: PayElement) => void;
  element?: PayElement | null;
  mode: 'create' | 'edit';
}

// Available Variables for formula builder
const AVAILABLE_VARIABLES = [
  { code: 'BASIC_WAGE', name: 'Crew member\'s basic salary', example: 'BASIC_WAGE' },
  { code: 'DAYS_WORKED', name: 'Number of days worked in period', example: 'DAYS_WORKED' },
  { code: 'OT_HOURS', name: 'Overtime hours', example: 'OT_HOURS' },
  { code: 'OT_RATE', name: 'Overtime rate multiplier', example: 'OT_RATE' },
  { code: 'GROSS_PAY', name: 'Total gross earnings', example: 'GROSS_PAY' },
  { code: 'RANK', name: 'Crew member\'s rank', example: 'RANK' },
  { code: 'NATIONALITY', name: 'Crew member\'s nationality', example: 'NATIONALITY' },
  { code: 'CONTRACT_TYPE', name: 'Type of contract', example: 'CONTRACT_TYPE' },
  { code: 'VESSEL_TYPE', name: 'Type of vessel', example: 'VESSEL_TYPE' }
];

// CBA Table References
const CBA_TABLE_REFERENCES = [
  { code: 'CBA_TABLE_BASIC_WAGE', name: 'Basic wage from CBA table', example: 'CBA_TABLE_BASIC_WAGE' },
  { code: 'CBA_TABLE_OT_RATE', name: 'Overtime rate from CBA table', example: 'CBA_TABLE_OT_RATE' },
  { code: 'CBA_TABLE_ALLOWANCE', name: 'Allowance from CBA table', example: 'CBA_TABLE_ALLOWANCE' }
];

// Common Formula Examples
const COMMON_FORMULAS = [
  { name: 'Basic Pay Proration', formula: 'CBA_TABLE_BASIC_WAGE * DAYS_WORKED / 30', description: 'Basic pay prorated by days worked' },
  { name: 'Overtime Premium', formula: 'BASIC_WAGE * 1.5 * OT_HOURS', description: 'Overtime at 1.5x basic rate' },
  { name: 'Tax Calculation', formula: 'GROSS_PAY * 0.15', description: 'Tax at 15% of gross pay' },
  { name: 'Conditional Logic', formula: 'IF(RANK = "Captain", 1000, 500)', description: 'Conditional payment based on rank' },
  { name: 'No Formula', formula: 'No Formula', description: 'Leave blank or enter "No Formula"' }
];

// Mathematical Functions
const MATH_FUNCTIONS = [
  { name: '+', description: 'Addition', example: 'A + B' },
  { name: '-', description: 'Subtraction', example: 'A - B' },
  { name: '*', description: 'Multiplication', example: 'A * B' },
  { name: '/', description: 'Division', example: 'A / B' },
  { name: 'IF()', description: 'Conditional logic', example: 'IF(condition, true_value, false_value)' },
  { name: 'MAX()', description: 'Maximum value', example: 'MAX(A, B)' },
  { name: 'MIN()', description: 'Minimum value', example: 'MIN(A, B)' },
  { name: 'ROUND()', description: 'Round to nearest', example: 'ROUND(value, decimals)' }
];

export const PayElementModal: React.FC<PayElementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  element,
  mode
}) => {
  const [formData, setFormData] = useState<PayElement>({
    payElementId: '',
    payElementCode: '',
    payElementName: '',
    type: 'earning',
    category: 'Fixed',
    formula: '',
    rounding: 'Round Nearest Cent',
    value: 0,
    applicable: true,
    isCustom: true,
    reflectInContract: true
  });

  const [showFormulaBuilder, setShowFormulaBuilder] = useState(false);
  const [formulaInput, setFormulaInput] = useState('');

  // Initialize form data when element changes
  useEffect(() => {
    if (element && mode === 'edit') {
      setFormData({
        ...element,
        payElementId: element.payElementId || `CUSTOM-${Date.now()}`
      });
      setFormulaInput(element.formula || '');
    } else if (mode === 'create') {
      setFormData({
        payElementId: `CUSTOM-${Date.now()}`,
        payElementCode: '',
        payElementName: '',
        type: 'earning',
        category: 'Fixed',
        formula: '',
        rounding: 'Round Nearest Cent',
        value: 0,
        applicable: true,
        isCustom: true,
        reflectInContract: true
      });
      setFormulaInput('');
    }
  }, [element, mode, isOpen]);

  // Update form data
  const updateFormData = (field: keyof PayElement, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Insert variable or function into formula
  const insertIntoFormula = (text: string) => {
    setFormulaInput(prev => prev + (prev ? ' ' : '') + text);
    updateFormData('formula', formulaInput + (formulaInput ? ' ' : '') + text);
  };

  // Handle formula change
  const handleFormulaChange = (value: string) => {
    setFormulaInput(value);
    updateFormData('formula', value);
  };

  // Handle save
  const handleSave = () => {
    console.log('💾 PayElementModal handleSave called');
    console.log('💾 Form validation - name:', formData.payElementName, 'code:', formData.payElementCode);
    
    if (!formData.payElementName || !formData.payElementCode) {
      console.log('❌ Form validation failed - missing required fields');
      return;
    }

    const elementToSave = {
      ...formData,
      payElementCode: formData.payElementCode || formData.payElementName.toUpperCase().replace(/\s+/g, '_'),
      formula: formulaInput || 'No Formula'
    };

    console.log('💾 About to call onSave with element:', elementToSave);
    onSave(elementToSave);
    console.log('💾 onSave called, now calling onClose');
    onClose();
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowFormulaBuilder(false);
      setFormulaInput('');
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            {mode === 'create' ? 'Add Pay Element' : 'Edit Pay Element'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Create a new pay element with formula configuration and rules'
              : 'Update the pay element configuration and rules'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel - Basic Configuration */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.payElementName}
                onChange={(e) => updateFormData('payElementName', e.target.value)}
                placeholder="Enter pay element name"
              />
            </div>

            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.payElementCode}
                onChange={(e) => updateFormData('payElementCode', e.target.value)}
                placeholder="Enter pay element code"
              />
            </div>

            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => updateFormData('type', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Earning</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => updateFormData('category', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fixed">Fixed</SelectItem>
                  <SelectItem value="Variable">Variable</SelectItem>
                  <SelectItem value="Variable Pay">Variable Pay</SelectItem>
                  <SelectItem value="Statutory">Statutory</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="reflectInContract">Reflect in Contract</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Controls whether this element appears in Contract Data
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Pay Run Only</span>
                  <Switch
                    checked={formData.reflectInContract !== false}
                    onCheckedChange={(checked) => updateFormData('reflectInContract', checked)}
                    className={formData.reflectInContract !== false ? 'data-[state=checked]:bg-blue-600' : ''}
                  />
                  <span className="text-sm text-gray-500">Contract + Pay Run</span>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="formula">Formula</Label>
              <div className="space-y-2">
                <Textarea
                  id="formula"
                  value={formulaInput}
                  onChange={(e) => handleFormulaChange(e.target.value)}
                  placeholder="Enter formula or select from examples below"
                  rows={3}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFormulaBuilder(!showFormulaBuilder)}
                  className="w-full"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  {showFormulaBuilder ? 'Hide' : 'Show'} Formula Builder
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="rounding">Rounding</Label>
              <Select value={formData.rounding} onValueChange={(value) => updateFormData('rounding', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Round Nearest Cent">Round Nearest Cent</SelectItem>
                  <SelectItem value="Round Up Cent">Round Up Cent</SelectItem>
                  <SelectItem value="Round Down Cent">Round Down Cent</SelectItem>
                  <SelectItem value="No Rounding">No Rounding</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="status">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  Available for selection in payroll
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Inactive</span>
                  <Switch
                    checked={formData.applicable}
                    onCheckedChange={(checked) => updateFormData('applicable', checked)}
                    className={formData.applicable ? 'data-[state=checked]:bg-green-600' : ''}
                  />
                  <span className="text-sm text-gray-500">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Formula Builder */}
          {showFormulaBuilder && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Formula Builder
                </h4>
                <p className="text-sm text-blue-700 mb-4">
                  Click on variables, functions, or examples to build your formula. Use mathematical operators and functions to create complex calculations.
                </p>

                {/* Available Variables */}
                <div className="mb-6">
                  <h5 className="font-medium text-sm mb-2">Available Variables:</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_VARIABLES.map((variable) => (
                      <Button
                        key={variable.code}
                        variant="outline"
                        size="sm"
                        onClick={() => insertIntoFormula(variable.code)}
                        className="text-left justify-start h-auto p-2"
                        title={variable.name}
                      >
                        <span className="font-mono text-xs text-blue-600">{variable.code}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* CBA Table References */}
                <div className="mb-6">
                  <h5 className="font-medium text-sm mb-2">CBA Table References:</h5>
                  <div className="space-y-1">
                    {CBA_TABLE_REFERENCES.map((ref) => (
                      <Button
                        key={ref.code}
                        variant="outline"
                        size="sm"
                        onClick={() => insertIntoFormula(ref.code)}
                        className="w-full text-left justify-start h-auto p-2"
                        title={ref.name}
                      >
                        <span className="font-mono text-xs text-green-600">{ref.code}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Mathematical Functions */}
                <div className="mb-6">
                  <h5 className="font-medium text-sm mb-2">Mathematical Functions:</h5>
                  <div className="grid grid-cols-4 gap-2">
                    {MATH_FUNCTIONS.map((func) => (
                      <Button
                        key={func.name}
                        variant="outline"
                        size="sm"
                        onClick={() => insertIntoFormula(func.name)}
                        className="text-center h-auto p-2"
                        title={func.description}
                      >
                        <span className="font-mono text-xs text-purple-600">{func.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Common Formula Examples */}
                <div>
                  <h5 className="font-medium text-sm mb-2">Common Formula Examples:</h5>
                  <div className="space-y-2">
                    {COMMON_FORMULAS.map((example, index) => (
                      <div key={index} className="border rounded p-2 bg-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{example.name}</div>
                            <div className="text-xs text-gray-600">{example.description}</div>
                            <div className="font-mono text-xs text-gray-800 mt-1">{example.formula}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFormulaChange(example.formula)}
                            className="ml-2"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!formData.payElementName || !formData.payElementCode}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {mode === 'create' ? 'Add Element' : 'Update Element'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};