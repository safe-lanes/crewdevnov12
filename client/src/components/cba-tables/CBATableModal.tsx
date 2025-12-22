/**
 * CBA Table Modal Component for creating and editing CBA tables
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { 
  Plus,
  Trash2,
  Save,
  DollarSign,
  Calendar,
  User,
  Ship
} from "lucide-react";

interface CBATable {
  id: string;
  name: string;
  type: "basic_wages" | "overtime_rates" | "allowances";
  rank: string;
  yearsAtSea: string;
  currency: string;
  rates: Record<string, number>;
  effectiveDate: string;
  expiryDate?: string;
  version: number;
  status: "active" | "inactive" | "expired";
}

interface CBATableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (table: Partial<CBATable>) => void;
  table: CBATable | null;
  mode: 'create' | 'edit';
}

export function CBATableModal({ isOpen, onClose, onSave, table, mode }: CBATableModalProps) {
  console.log('CBATableModal render - isOpen:', isOpen, 'mode:', mode, 'table:', table);
  const [formData, setFormData] = useState({
    name: "",
    type: "basic_wages" as "basic_wages" | "overtime_rates" | "allowances",
    rank: "",
    yearsAtSea: "",
    currency: "USD",
    effectiveDate: "",
    expiryDate: "",
    status: "active" as "active" | "inactive" | "expired"
  });
  
  const [rates, setRates] = useState<Array<{ position: string; rate: number }>>([
    { position: "", rate: 0 }
  ]);

  useEffect(() => {
    if (table && mode === 'edit') {
      setFormData({
        name: table.name,
        type: table.type,
        rank: table.rank,
        yearsAtSea: table.yearsAtSea,
        currency: table.currency,
        effectiveDate: table.effectiveDate,
        expiryDate: table.expiryDate || "",
        status: table.status
      });
      
      // Convert rates object to array
      const ratesArray = Object.entries(table.rates).map(([position, rate]) => ({
        position,
        rate
      }));
      setRates(ratesArray.length > 0 ? ratesArray : [{ position: "", rate: 0 }]);
    } else {
      // Reset form for create mode
      setFormData({
        name: "",
        type: "basic_wages",
        rank: "",
        yearsAtSea: "",
        currency: "USD",
        effectiveDate: new Date().toISOString().split('T')[0],
        expiryDate: "",
        status: "active"
      });
      setRates([{ position: "", rate: 0 }]);
    }
  }, [table, mode, isOpen]);

  const addRate = () => {
    setRates([...rates, { position: "", rate: 0 }]);
  };

  const removeRate = (index: number) => {
    if (rates.length > 1) {
      setRates(rates.filter((_, i) => i !== index));
    }
  };

  const updateRate = (index: number, field: 'position' | 'rate', value: string | number) => {
    const newRates = [...rates];
    if (field === 'position') {
      newRates[index].position = value as string;
    } else {
      newRates[index].rate = Number(value);
    }
    setRates(newRates);
  };

  const handleSave = () => {
    // Convert rates array back to object
    const ratesObject = rates.reduce((acc, { position, rate }) => {
      if (position.trim() && rate > 0) {
        acc[position] = rate;
      }
      return acc;
    }, {} as Record<string, number>);

    const tableData: Partial<CBATable> = {
      ...formData,
      rates: ratesObject,
      version: table?.version ? table.version + 1 : 1
    };

    if (mode === 'edit' && table) {
      tableData.id = table.id;
    }

    onSave(tableData);
  };

  const getTypeOptions = () => [
    { value: "basic_wages", label: "Basic Wages" },
    { value: "overtime_rates", label: "Overtime Rates" },
    { value: "allowances", label: "Allowances" }
  ];

  const getRankOptions = () => [
    "Officer",
    "Rating", 
    "Senior Officers",
    "Junior Officers",
    "Engine Officers",
    "Deck Officers",
    "All Ranks"
  ];

  const getYearsAtSeaOptions = () => [
    "0-2",
    "3-5", 
    "6-10",
    "11-15",
    "16-20",
    "20+",
    "All"
  ];

  const getCurrencyOptions = () => [
    "USD",
    "EUR",
    "GBP",
    "SGD",
    "NOK",
    "DKK"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {mode === 'create' ? 'Create New CBA Table' : 'Edit CBA Table'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Table Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Officers Basic Wages 2025"
              />
            </div>
            
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => 
                setFormData({ ...formData, type: value as typeof formData.type })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTypeOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rank and Experience */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="rank" className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Rank Category
              </Label>
              <Select value={formData.rank} onValueChange={(value) => 
                setFormData({ ...formData, rank: value })
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select rank category" />
                </SelectTrigger>
                <SelectContent>
                  {getRankOptions().map(rank => (
                    <SelectItem key={rank} value={rank}>
                      {rank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="yearsAtSea">Years at Sea</Label>
              <Select value={formData.yearsAtSea} onValueChange={(value) => 
                setFormData({ ...formData, yearsAtSea: value })
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select experience range" />
                </SelectTrigger>
                <SelectContent>
                  {getYearsAtSeaOptions().map(years => (
                    <SelectItem key={years} value={years}>
                      {years}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => 
                setFormData({ ...formData, currency: value })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getCurrencyOptions().map(currency => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Effective Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="effectiveDate" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Effective Date
              </Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
            </div>
          </div>

          {/* Rates Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-medium">Position Rates</Label>
              <Button onClick={addRate} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Position
              </Button>
            </div>

            <div className="space-y-3">
              {rates.map((rate, index) => (
                <div key={index} className="grid grid-cols-3 gap-3 p-3 border rounded-lg">
                  <div>
                    <Label className="text-sm">Position/Rank</Label>
                    <Input
                      value={rate.position}
                      onChange={(e) => updateRate(index, 'position', e.target.value)}
                      placeholder="e.g., Captain, Chief Officer"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm">Rate ({formData.currency})</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rate.rate}
                      onChange={(e) => updateRate(index, 'rate', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="flex items-end">
                    {rates.length > 1 && (
                      <Button 
                        onClick={() => removeRate(index)} 
                        size="sm" 
                        variant="outline"
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => 
              setFormData({ ...formData, status: value as typeof formData.status })
            }>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">
                  <Badge variant="default">Active</Badge>
                </SelectItem>
                <SelectItem value="inactive">
                  <Badge variant="secondary">Inactive</Badge>
                </SelectItem>
                <SelectItem value="expired">
                  <Badge variant="destructive">Expired</Badge>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.rank || rates.every(r => !r.position || !r.rate)}>
              <Save className="h-4 w-4 mr-2" />
              {mode === 'create' ? 'Create Table' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}