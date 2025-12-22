/**
 * Inspector Panel Component
 * Right-side panel with sticky tabs for crew details
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calculator, 
  AlertTriangle, 
  History, 
  Info,
  Edit,
  Check,
  X
} from "lucide-react";

interface InspectorPanelProps {
  selectedCrewId: string | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Mock data for selected crew member
const mockCrewDetails = {
  CREW001: {
    name: "James Wilson",
    rank: "Captain", 
    breakdown: {
      earnings: [
        { element: "Basic Salary", rate: "8500.00", period: "Monthly", amount: 8500.00 },
        { element: "Overtime", rate: "75.50/hr", period: "15.9 hrs", amount: 1200.50 },
        { element: "Position Allowance", rate: "850.00", period: "Monthly", amount: 850.00 }
      ],
      deductions: [
        { element: "Tax Withholding", rate: "15%", period: "Gross", amount: -450.75 }
      ],
      contributions: [
        { element: "Pension Fund", rate: "15%", period: "Basic", amount: 1275.00 }
      ]
    },
    rules: [
      { condition: "Rank = Captain", rule: "Basic Salary", value: "$8,500" },
      { condition: "Overtime > 10hrs", rule: "OT Rate Premium", value: "1.5x" },
      { condition: "Position Level >= 4", rule: "Position Allowance", value: "$850" }
    ],
    exceptions: [
      { type: "warning", message: "Overtime exceeds normal threshold", action: "approve" }
    ],
    history: [
      { timestamp: "2025-01-13 15:30", action: "Overtime hours updated", user: "Payroll Admin", details: "15.9 hours entered" },
      { timestamp: "2025-01-13 14:20", action: "Basic salary calculated", user: "System", details: "Monthly rate applied" },
      { timestamp: "2025-01-13 14:15", action: "Crew added to payrun", user: "Payroll Admin", details: "January 2025 period" }
    ]
  }
};

export function InspectorPanel({ selectedCrewId, activeTab, onTabChange }: InspectorPanelProps) {
  const crewDetails = selectedCrewId ? mockCrewDetails[selectedCrewId as keyof typeof mockCrewDetails] : null;

  if (!selectedCrewId || !crewDetails) {
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-900">{crewDetails.name}</h3>
        <p className="text-sm text-gray-600">{crewDetails.rank}</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b">
          <TabsTrigger value="breakdown" className="text-xs">Breakdown</TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">Rules</TabsTrigger>
          <TabsTrigger value="exceptions" className="text-xs">Exceptions</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="breakdown" className="p-4 space-y-4 m-0">
            {/* Earnings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Earnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {crewDetails.breakdown.earnings.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium">{item.element}</div>
                      <div className="text-xs text-gray-500">{item.rate} × {item.period}</div>
                    </div>
                    <span className="font-mono">${item.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Total Earnings</span>
                  <span className="font-mono">
                    ${crewDetails.breakdown.earnings.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Deductions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Deductions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {crewDetails.breakdown.deductions.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium">{item.element}</div>
                      <div className="text-xs text-gray-500">{item.rate} × {item.period}</div>
                    </div>
                    <span className="font-mono text-red-600">${item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Employer Contributions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Employer Contributions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {crewDetails.breakdown.contributions.map((item, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <div>
                      <div className="font-medium">{item.element}</div>
                      <div className="text-xs text-gray-500">{item.rate} × {item.period}</div>
                    </div>
                    <span className="font-mono">${item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="p-4 space-y-3 m-0">
            <div className="text-sm text-gray-600 mb-4">
              Rules applied to this crew member's calculation
            </div>
            {crewDetails.rules.map((rule, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Condition: </span>
                      <span className="text-blue-600">{rule.condition}</span>
                    </div>
                    <div>
                      <span className="font-medium">Rule: </span>
                      <span>{rule.rule}</span>
                    </div>
                    <div>
                      <span className="font-medium">Value: </span>
                      <span className="font-mono">{rule.value}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="exceptions" className="p-4 space-y-3 m-0">
            <div className="text-sm text-gray-600 mb-4">
              Issues requiring attention
            </div>
            {crewDetails.exceptions.map((exception, index) => (
              <Card key={index} className="border-orange-200">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{exception.message}</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <Check className="w-3 h-3" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <Edit className="w-3 h-3" />
                          Adjust
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <X className="w-3 h-3" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {crewDetails.exceptions.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No exceptions found</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="p-4 space-y-3 m-0">
            <div className="text-sm text-gray-600 mb-4">
              Audit trail for this crew member
            </div>
            <div className="space-y-3">
              {crewDetails.history.map((entry, index) => (
                <div key={index} className="border-l-2 border-blue-200 pl-3 pb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{entry.action}</span>
                    <Badge variant="outline" className="text-xs">{entry.user}</Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{entry.timestamp}</div>
                  <div className="text-sm text-gray-700 mt-1">{entry.details}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}