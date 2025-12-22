/**
 * Payrun Detail Form - Modal dialog for editing payrun details
 * Purpose: Form interface opened from Edit action in Payrun Board
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Calculator, 
  Lock, 
  CheckCircle, 
  CreditCard, 
  FileText, 
  Download,
  Plus,
  Upload,
  Settings,
  AlertTriangle,
  X
} from "lucide-react";
import { useWageRun } from "@/store/wageRuns";
import PayrollDetailsPanel from "@/components/wage/PayrollDetailsPanel";

export type PayrunStatus = "draft" | "validated" | "approved" | "paid" | "posted";

export interface PayrunDetailFormData {
  id: string;
  period: string;
  vessel: string;
  fxPolicy: string;
  template: string;
  lastCalcTimestamp: string;
  status: PayrunStatus;
  isOffCycle: boolean;
  crewCount: number;
  netTotal: number;
  currency: string;
  warnings: number;
  lastUpdatedBy: string;
  updatedDate: string;
}

interface PayrunDetailFormProps {
  isOpen: boolean;
  onClose: () => void;
  payrunData: PayrunDetailFormData | null;
  onSave: (data: PayrunDetailFormData) => void;
}

interface CrewMember {
  id: string;
  name: string;
  rank: string;
  basic: number;
  net: number;
}

// Mock crew members data to match the attached image
const mockCrewMembers: CrewMember[] = [
  { id: "2025-05-14", name: "James Wilson", rank: "Captain", basic: 8500, net: 7374.75 },
  { id: "2025-03-12", name: "Sarah Chen", rank: "Chief Engineer", basic: 7200, net: 6072.15 },
  { id: "2025-02-12", name: "Mike Rodriguez", rank: "Second Officer", basic: 5500, net: 4715.50 }
];

export function PayrunDetailForm({ isOpen, onClose, payrunData, onSave }: PayrunDetailFormProps) {
  const [formData, setFormData] = useState<PayrunDetailFormData | null>(payrunData);
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewMember | null>(null);
  
  const { 
    initialize, 
    selectCrew, 
    selectedCrewId, 
    crewMap,
    setStatus,
    status: storeStatus 
  } = useWageRun();

  // Update formData when payrunData changes
  useEffect(() => {
    setFormData(payrunData);
    if (payrunData) {
      initialize(payrunData.id, payrunData.status);
      setStatus(payrunData.status);
    }
  }, [payrunData, initialize, setStatus]);



  if (!formData) {
    console.log('No form data, returning null');
    return null;
  }

  const getStatusBadge = (status: PayrunStatus) => {
    const variants = {
      draft: { variant: "secondary" as const, label: "Draft", icon: <FileText className="w-3 h-3" /> },
      validated: { variant: "default" as const, label: "Validated", icon: <CheckCircle className="w-3 h-3" /> },
      approved: { variant: "default" as const, label: "Approved", icon: <CheckCircle className="w-3 h-3" /> },
      paid: { variant: "default" as const, label: "Paid", icon: <CreditCard className="w-3 h-3" /> },
      posted: { variant: "outline" as const, label: "Posted (Locked)", icon: <Lock className="w-3 h-3" /> }
    };
    
    const config = variants[status] || variants.draft;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const handleSave = () => {
    if (formData) {
      onSave(formData);
      onClose();
    }
  };

  const handleRecalculate = () => {
    console.log("Recalculating payrun...");
    // TODO: Implement full payrun recalculation
  };

  const handleLock = () => {
    if (formData) {
      const newStatus = "validated";
      setFormData({ ...formData, status: newStatus });
      setStatus(newStatus);
    }
  };

  const handleApprove = () => {
    if (formData) {
      const newStatus = "approved";
      setFormData({ ...formData, status: newStatus });
      setStatus(newStatus);
    }
  };

  const handlePay = () => {
    if (formData) {
      const newStatus = "paid";
      setFormData({ ...formData, status: newStatus });
      setStatus(newStatus);
    }
  };

  const handlePost = () => {
    if (formData) {
      const newStatus = "posted";
      setFormData({ ...formData, status: newStatus });
      setStatus(newStatus);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  {formData.id}
                </DialogTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span><strong>Period:</strong> {formData.period}</span>
                  <span><strong>Vessel:</strong> {formData.vessel}</span>
                  <span><strong>FX Policy:</strong> {formData.fxPolicy}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Template:</span>
                <Badge variant="outline">{formData.template}</Badge>
                <span className="text-sm text-gray-600">Last Calc:</span>
                <span className="text-sm font-medium">{formData.lastCalcTimestamp}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(formData.status)}
              {formData.isOffCycle && (
                <Badge variant="destructive" className="text-xs">Off-cycle</Badge>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">
            Manage payroll details for {formData.vessel} - {formData.period}
          </DialogDescription>
        </DialogHeader>

        {/* Action Bar - matching the attached image */}
        <div className="border-b border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Pay Element
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="w-4 h-4" />
                Import Hours
              </Button>
              <Button variant="outline" size="sm">
                Mass Update
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>{formData.crewCount} crew members</span>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Column Picker
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area - Main Layout matching the attached image */}
        <div className="flex flex-1 min-h-0">
          {/* Crew List - Left Panel */}
          <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
            <div className="p-4">
              <div className="space-y-2">
                {mockCrewMembers.map((member) => {
                  const crewData = crewMap[member.id];
                  const netPay = crewData?.totals?.net ?? member.net;
                  
                  return (
                    <div 
                      key={member.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCrewId === member.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedCrewMember(member);
                        selectCrew(member.id);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-600">({member.rank})</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">Basic: <span className="font-medium">${member.basic.toLocaleString()}</span></div>
                          <div className="text-sm">Net: <span className="font-medium">${netPay.toLocaleString()}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detail Panel - Right Side */}
          <div className="flex-1 bg-gray-50 overflow-y-auto">
            {selectedCrewId ? (
              <PayrollDetailsPanel crewId={selectedCrewId} />
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No crew member selected</h3>
                <p className="text-gray-600">Select a crew member from the list to view and edit payroll details</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Button onClick={handleRecalculate} className="gap-1" disabled={formData.status === "posted"}>
                <Calculator className="w-4 h-4" />
                Recalculate
              </Button>
              {getStatusBadge(formData.status)}
              <Button onClick={handleLock} variant="outline" className="gap-1" disabled={formData.status !== "draft"}>
                <Lock className="w-4 h-4" />
                Lock
              </Button>
              <Button onClick={handleApprove} variant="outline" className="gap-1" disabled={formData.status !== "validated"}>
                <CheckCircle className="w-4 h-4" />
                Approve
              </Button>
              <Button onClick={handlePay} variant="outline" className="gap-1" disabled={formData.status !== "approved"}>
                <CreditCard className="w-4 h-4" />
                Pay
              </Button>
              <Button onClick={handlePost} variant="outline" className="gap-1" disabled={formData.status !== "paid"}>
                <FileText className="w-4 h-4" />
                Post
              </Button>
              <Button variant="outline" className="gap-1">
                <Download className="w-4 h-4" />
                Export Portage Bill
              </Button>
              <Button variant="outline" className="gap-1">
                <Download className="w-4 h-4" />
                Export Journals
              </Button>
            </div>
            <Button variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}