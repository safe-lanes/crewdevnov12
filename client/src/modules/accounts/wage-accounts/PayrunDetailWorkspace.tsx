/**
 * Payrun Detail Workspace - 3-pane layout for payroll management
 * Purpose: One place to calculate, validate, approve, pay, and post
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  History,
  AlertTriangle,
  Info,
  Eye
} from "lucide-react";
export type PayrunStatus = "draft" | "validated" | "approved" | "paid" | "posted";

export interface PayrunData {
  id: string;
  period: string;
  vessel: string;
  fxPolicy: string;
  template: string;
  lastCalcTimestamp: string;
  status: PayrunStatus;
  isOffCycle: boolean;
}

// Inline Header Component
function PayrunHeaderComponent({ payrunData, onRecalculate, onLock, onApprove, onPay, onPost, onExportPortage, onExportJournals }: {
  payrunData: PayrunData;
  onRecalculate: () => void;
  onLock: () => void;
  onApprove: () => void;
  onPay: () => void;
  onPost: () => void;
  onExportPortage: () => void;
  onExportJournals: () => void;
}) {
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

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRecalculate} disabled={isLocked} className="gap-1">
            <Calculator className="w-4 h-4" />
            Recalculate
          </Button>
          <Button variant="outline" size="sm" onClick={onLock} disabled={isLocked || payrunData.status === "draft"} className="gap-1">
            <Lock className="w-4 h-4" />
            Lock
          </Button>
          <Button variant="outline" size="sm" onClick={onApprove} disabled={isLocked || payrunData.status !== "validated"} className="gap-1">
            <CheckCircle className="w-4 h-4" />
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={onPay} disabled={isLocked || payrunData.status !== "approved"} className="gap-1">
            <CreditCard className="w-4 h-4" />
            Pay
          </Button>
          <Button variant="outline" size="sm" onClick={onPost} disabled={isLocked || payrunData.status !== "paid"} className="gap-1">
            <FileText className="w-4 h-4" />
            Post
          </Button>
          <div className="h-6 w-px bg-gray-300 mx-1" />
          <Button variant="outline" size="sm" onClick={onExportPortage} className="gap-1">
            <Download className="w-4 h-4" />
            Export Portage Bill
          </Button>
          <Button variant="outline" size="sm" onClick={onExportJournals} className="gap-1">
            <Download className="w-4 h-4" />
            Export Journals
          </Button>
        </div>
      </div>
    </div>
  );
}

// Simplified Grid Component
function PayrollGridComponent({ selectedCrewId, onCrewSelect }: {
  selectedCrewId: string | null;
  onCrewSelect: (crewId: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            Add Pay Element
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Upload className="w-4 h-4" />
            Import Hours
          </Button>
          <Button variant="outline" size="sm">
            Mass Update
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">3 crew members</span>
          <Button variant="outline" size="sm" className="gap-1">
            <Settings className="w-4 h-4" />
            Column Picker
          </Button>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="space-y-2">
          {[
            { id: "2025-05-14", name: "James Wilson", rank: "Captain", basic: 8500, net: 11374.75 },
            { id: "2025-03-12", name: "Sarah Chen", rank: "Chief Engineer", basic: 7200, net: 9672.15 },
            { id: "2025-02-12", name: "Mike Rodriguez", rank: "Second Officer", basic: 5500, net: 7115.50 }
          ].map((crew) => (
            <div 
              key={crew.id}
              className={`p-3 border rounded cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedCrewId === crew.id ? "bg-blue-50 border-blue-500 ring-1 ring-blue-200" : "border-gray-200"
              }`}
              onClick={() => onCrewSelect(crew.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{crew.name}</span>
                  <span className="text-gray-500 ml-2">({crew.rank})</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">Basic: ${crew.basic.toFixed(2)}</div>
                  <div className="font-mono text-sm">Net: ${crew.net.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Simplified Inspector Panel Component
function InspectorPanelComponent({ selectedCrewId, activeTab, onTabChange }: {
  selectedCrewId: string | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  if (!selectedCrewId) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-gray-500">
          <Info className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">No crew member selected</p>
          <p className="text-sm">Select a crew member from the grid to view details</p>
        </div>
      </div>
    );
  }

  const crewDetails = {
    name: "James Wilson",
    rank: "Captain"
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">{crewDetails.name}</h3>
        <p className="text-sm text-gray-600">{crewDetails.rank}</p>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b bg-white">
          <TabsTrigger value="breakdown" className="text-xs px-2 py-1">Breakdown</TabsTrigger>
          <TabsTrigger value="rules" className="text-xs px-2 py-1">Rules</TabsTrigger>
          <TabsTrigger value="exceptions" className="text-xs px-2 py-1">Exceptions</TabsTrigger>
          <TabsTrigger value="history" className="text-xs px-2 py-1">History</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="breakdown" className="space-y-4 m-0">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Earnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Basic Salary</span>
                  <span className="font-mono">$8,500.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Overtime</span>
                  <span className="font-mono">$1,200.50</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span className="font-mono">$9,700.50</span>
                </div>
              </CardContent>
            </Card>

            <div className="mt-4 pt-4 border-t">
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => console.log('Navigate to crew card for:', selectedCrewId)}
              >
                <Eye className="w-4 h-4 mr-2" />
                View Full Payroll Card
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rules" className="space-y-3 m-0">
            <Card>
              <CardContent className="p-3">
                <div className="text-sm">
                  <div className="font-medium">Basic Salary Rule</div>
                  <div className="text-gray-600">Captain rank = $8,500 monthly</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exceptions" className="space-y-3 m-0">
            <div className="text-center text-gray-500 py-8">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p>No exceptions found</p>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-3 m-0">
            <div className="space-y-3">
              <div className="border-l-2 border-blue-200 pl-3 pb-3">
                <div className="text-sm font-medium">Overtime hours updated</div>
                <div className="text-xs text-gray-500">2025-01-13 15:30</div>
                <div className="text-sm text-gray-700">15.9 hours entered</div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

export function PayrunDetailWorkspace() {
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState("breakdown");

  // Mock payrun data
  const payrunData: PayrunData = {
    id: "PR-2025-001",
    period: "January 2025",
    vessel: "MV Atlantic Star",
    fxPolicy: "USD/EUR Monthly Average",
    template: "Standard Crew Template",
    lastCalcTimestamp: "2025-01-13 15:30:45 UTC",
    status: "validated",
    isOffCycle: false
  };

  const handleCrewSelection = (crewId: string) => {
    setSelectedCrewId(crewId);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header Bar */}
      <PayrunHeaderComponent 
        payrunData={payrunData}
        onRecalculate={() => console.log('Recalculate')}
        onLock={() => console.log('Lock')}
        onApprove={() => console.log('Approve')}
        onPay={() => console.log('Pay')}
        onPost={() => console.log('Post')}
        onExportPortage={() => console.log('Export Portage')}
        onExportJournals={() => console.log('Export Journals')}
      />

      {/* Main Content - 3 Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Grid */}
        <div className="flex-1 border-r border-gray-200">
          <PayrollGridComponent 
            selectedCrewId={selectedCrewId}
            onCrewSelect={handleCrewSelection}
          />
        </div>

        {/* Right Inspector Panel */}
        <div className="w-96 bg-white">
          <InspectorPanelComponent 
            selectedCrewId={selectedCrewId}
            activeTab={inspectorTab}
            onTabChange={setInspectorTab}
          />
        </div>
      </div>
    </div>
  );
}