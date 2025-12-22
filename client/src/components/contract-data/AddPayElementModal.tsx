/**
 * Add Pay Element Modal
 * Modal for adding custom pay elements to contract data
 */

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AddPayElementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (element: any) => void;
  type: 'earning' | 'deduction';
}

export const AddPayElementModal: React.FC<AddPayElementModalProps> = ({
  isOpen,
  onClose,
  onSave,
  type
}) => {
  const [formData, setFormData] = useState({
    payElementName: '',
    payElementCode: '',
    category: 'Custom',
    formula: 'No Formula',
    value: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.payElementName.trim()) {
      return;
    }

    const element = {
      payElementCode: formData.payElementCode || formData.payElementName.toUpperCase().replace(/\s+/g, '_'),
      payElementName: formData.payElementName.trim(),
      category: formData.category,
      type,
      applicable: true,
      formula: formData.formula,
      value: formData.value || null,
      description: formData.description || null
    };

    onSave(element);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      payElementName: '',
      payElementCode: '',
      category: 'Custom',
      formula: 'No Formula',
      value: '',
      description: ''
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Add Custom {type === 'earning' ? 'Earning' : 'Deduction'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="payElementName">Pay Element Name *</Label>
              <Input
                id="payElementName"
                value={formData.payElementName}
                onChange={(e) => setFormData(prev => ({ ...prev, payElementName: e.target.value }))}
                placeholder="Enter pay element name"
                required
              />
            </div>

            <div>
              <Label htmlFor="payElementCode">Pay Element Code</Label>
              <Input
                id="payElementCode"
                value={formData.payElementCode}
                onChange={(e) => setFormData(prev => ({ ...prev, payElementCode: e.target.value }))}
                placeholder="Auto-generated from name if empty"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to auto-generate from element name
              </p>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Custom">Custom</SelectItem>
                  <SelectItem value="Fixed">Fixed</SelectItem>
                  <SelectItem value="Variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="formula">Formula Type</Label>
              <Select value={formData.formula} onValueChange={(value) => setFormData(prev => ({ ...prev, formula: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No Formula">No Formula</SelectItem>
                  <SelectItem value="Yes">Has Formula</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="value">Default Value</Label>
              <Input
                id="value"
                value={formData.value}
                onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Enter default value (optional)"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description (optional)"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">
              Add {type === 'earning' ? 'Earning' : 'Deduction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};