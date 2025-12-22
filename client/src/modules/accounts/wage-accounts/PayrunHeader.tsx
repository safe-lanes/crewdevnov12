/**
 * Payrun Header Component
 * Displays run information and action buttons
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  Lock, 
  CheckCircle, 
  CreditCard, 
  FileText, 
  Download,
  AlertTriangle
} from "lucide-react";
import { PayrunData, PayrunStatus } from "./PayrunDetailWorkspace";

interface PayrunHeaderProps {
  payrunData: PayrunData;
  onRecalculate: () => void;
  onLock: () => void;
  onApprove: () => void;
  onPay: () => void;
  onPost: () => void;
  onExportPortage: () => void;
  onExportJournals: () => void;
}

export function PayrunHeader({
  payrunData,
  onRecalculate,
  onLock,
  onApprove,
  onPay,
  onPost,
  onExportPortage,
  onExportJournals
}: PayrunHeaderProps) {
  
  const getStatusBadge = (status: PayrunStatus) => {
    const variants = {
      draft: { variant: "secondary" as const, label: "Draft", icon: <FileText className="w-3 h-3" /> },
      validated: { variant: "default" as const, label: "Validated", icon: <CheckCircle className="w-3 h-3" /> },
      approved: { variant: "default" as const, label: "Approved", icon: <CheckCircle className="w-3 h-3" /> },
      paid: { variant: "default" as const, label: "Paid", icon: <CreditCard className="w-3 h-3" /> },
      posted: { variant: "outline" as const, label: "Posted (Locked)", icon: <Lock className="w-3 h-3" /> }
    };
    
    const config = variants[status];
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const isLocked = payrunData.status === "posted";

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        {/* Left - Run Information */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-gray-900">{payrunData.id}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span><strong>Period:</strong> {payrunData.period}</span>
              <span><strong>Vessel:</strong> {payrunData.vessel}</span>
              <span><strong>FX Policy:</strong> {payrunData.fxPolicy}</span>
            </div>
          </div>
          
          <div className="flex flex-col text-sm">
            <span className="text-gray-600"><strong>Template:</strong> {payrunData.template}</span>
            <span className="text-gray-500">Last calc: {payrunData.lastCalcTimestamp}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusBadge(payrunData.status)}
            {payrunData.isOffCycle && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Off Cycle
              </Badge>
            )}
          </div>
        </div>

        {/* Right - Action Buttons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRecalculate}
            disabled={isLocked}
            className="gap-1"
          >
            <Calculator className="w-4 h-4" />
            Recalculate
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onLock}
            disabled={isLocked || payrunData.status === "draft"}
            className="gap-1"
          >
            <Lock className="w-4 h-4" />
            Lock
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onApprove}
            disabled={isLocked || payrunData.status !== "validated"}
            className="gap-1"
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onPay}
            disabled={isLocked || payrunData.status !== "approved"}
            className="gap-1"
          >
            <CreditCard className="w-4 h-4" />
            Pay
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onPost}
            disabled={isLocked || payrunData.status !== "paid"}
            className="gap-1"
          >
            <FileText className="w-4 h-4" />
            Post
          </Button>
          
          <div className="h-6 w-px bg-gray-300 mx-1" />
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onExportPortage}
            className="gap-1"
          >
            <Download className="w-4 h-4" />
            Export Portage Bill
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onExportJournals}
            className="gap-1"
          >
            <Download className="w-4 h-4" />
            Export Journals
          </Button>
        </div>
      </div>
    </div>
  );
}