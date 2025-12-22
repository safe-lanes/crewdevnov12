/**
 * Crew Payroll Card Modal - Full payroll details in a popup
 * Purpose: Show complete payroll breakdown for selected crew member
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  X,
  User, 
  Calendar, 
  Building2, 
  DollarSign, 
  Heart, 
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  TrendingUp,
  FileText,
  Send,
  Edit,
  Save,
  Download,
  Mail,
  Sliders
} from "lucide-react";

interface CrewPayrollCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  crewId: string;
  crewName: string;
  crewRank: string;
}

// Mock crew member data
const getMockCrewMember = (crewId: string, crewName: string, crewRank: string) => ({
  id: crewId,
  name: crewName,
  rank: crewRank,
  photo: "/api/placeholder/80/80",
  contractStart: "2024-01-15",
  contractEnd: "2024-12-31",
  cba: "ITF Standard",
  currency: "USD",
  hasAllotments: true,
  bankVerified: true,
  warnings: []
});

const mockPaysheetData = [
  { id: 1, element: "Basic Salary", amount: 8500.00, editable: false, formula: "Monthly Rate" },
  { id: 2, element: "Overtime", amount: 1200.50, editable: true, formula: "Hours × Rate" },
  { id: 3, element: "Position Allowance", amount: 850.00, editable: false, formula: "Fixed Rate" },
  { id: 4, element: "Tax Withholding", amount: -450.75, editable: false, formula: "15% of Gross" },
  { id: 5, element: "Pension Contribution", amount: 1275.00, editable: false, formula: "15% of Basic" }
];

const mockTimeData = [
  { date: "2025-01-01", regularHours: 8, overtimeHours: 2, nightHours: 0, holidayHours: 0 },
  { date: "2025-01-02", regularHours: 8, overtimeHours: 1.5, nightHours: 0, holidayHours: 0 },
  { date: "2025-01-03", regularHours: 8, overtimeHours: 3, nightHours: 2, holidayHours: 0 }
];

const mockAllotments = [
  { id: 1, beneficiary: "Maria Wilson (Spouse)", percentage: 60, amount: 6000, currency: "USD", priority: 1, effectiveDate: "2024-01-15" },
  { id: 2, beneficiary: "Education Fund", percentage: 10, amount: 1000, currency: "USD", priority: 2, effectiveDate: "2024-01-15" }
];

const mockAdvances = [
  { id: 1, type: "Cash Advance", amount: 500, date: "2025-01-10", status: "Approved", balance: 500 },
  { id: 2, type: "Bond Purchase", amount: 200, date: "2025-01-05", status: "Completed", balance: 0 }
];

export default function CrewPayrollCardModal({ isOpen, onClose, crewId, crewName, crewRank }: CrewPayrollCardModalProps) {
  const [activeTab, setActiveTab] = useState("paysheet");
  const [editingPaysheet, setEditingPaysheet] = useState<number | null>(null);

  if (!isOpen) return null;

  const crewMember = getMockCrewMember(crewId, crewName, crewRank);

  const handleEditPaysheet = (id: number) => {
    setEditingPaysheet(id);
  };

  const handleSavePaysheet = () => {
    setEditingPaysheet(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Left - Crew Profile */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <img 
                  src={crewMember.photo} 
                  alt={crewMember.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
                <div className="absolute -bottom-1 -right-1">
                  {crewMember.bankVerified ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500 bg-white rounded-full" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-orange-500 bg-white rounded-full" />
                  )}
                </div>
              </div>
              
              <div className="space-y-1">
                <h1 className="text-2xl font-bold text-gray-900">{crewMember.name}</h1>
                <p className="text-lg text-gray-600">{crewMember.rank}</p>
                
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{crewMember.contractStart} - {crewMember.contractEnd}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    <span>{crewMember.cba}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    <span>{crewMember.currency}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {crewMember.hasAllotments && (
                    <Badge variant="secondary" className="gap-1">
                      <Heart className="w-3 h-3" />
                      Allotments
                    </Badge>
                  )}
                  {crewMember.bankVerified && (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Bank Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Right - Actions */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-2">
                <Sliders className="w-4 h-4" />
                Simulate
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Generate Payslip
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Send className="w-4 h-4" />
                Send to Crew
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Mail className="w-4 h-4" />
                Mark Delivered
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-6 rounded-none border-b bg-white px-6">
              <TabsTrigger value="paysheet" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Paysheet
              </TabsTrigger>
              <TabsTrigger value="time" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Time/OT
              </TabsTrigger>
              <TabsTrigger value="allotments" className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Allotments
              </TabsTrigger>
              <TabsTrigger value="advances" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Advances & Bond
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Compliance
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-6">
              {/* Paysheet Tab */}
              <TabsContent value="paysheet" className="space-y-6 m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Current Period Paysheet</span>
                      <span className="text-sm font-normal text-gray-500">January 2025</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {mockPaysheetData.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{item.element}</div>
                          <div className="text-sm text-gray-500">{item.formula}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-lg ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.abs(item.amount).toLocaleString()}
                          </span>
                          {item.editable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPaysheet(item.id)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Net Pay</span>
                        <span className="font-mono text-green-600">
                          $11,374.75
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Time/OT Tab */}
              <TabsContent value="time" className="space-y-4 m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Time & Overtime Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {mockTimeData.map((entry, index) => (
                        <div key={index} className="grid grid-cols-5 gap-4 p-3 border rounded-lg">
                          <div>
                            <Label className="text-xs text-gray-500">Date</Label>
                            <div className="font-medium">{entry.date}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Regular</Label>
                            <div className="font-mono">{entry.regularHours}h</div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Overtime</Label>
                            <div className="font-mono text-orange-600">{entry.overtimeHours}h</div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Night</Label>
                            <div className="font-mono text-blue-600">{entry.nightHours}h</div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Holiday</Label>
                            <div className="font-mono text-purple-600">{entry.holidayHours}h</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Allotments Tab */}
              <TabsContent value="allotments" className="space-y-4 m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="w-5 h-5" />
                      Beneficiary Allotments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {mockAllotments.map((allotment) => (
                        <div key={allotment.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-medium">{allotment.beneficiary}</div>
                            <div className="text-sm text-gray-500">Priority {allotment.priority} • Effective {allotment.effectiveDate}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-lg">{allotment.percentage}%</div>
                            <div className="font-mono text-sm text-gray-600">${allotment.amount} {allotment.currency}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Advances & Bond Tab */}
              <TabsContent value="advances" className="space-y-4 m-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Advances & Bond
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {mockAdvances.map((advance) => (
                        <div key={advance.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-medium">{advance.type}</div>
                            <div className="text-sm text-gray-500">{advance.date}</div>
                          </div>
                          <div className="text-right">
                            <Badge variant={advance.status === "Completed" ? "default" : "secondary"}>
                              {advance.status}
                            </Badge>
                            <div className="font-mono text-sm mt-1">Balance: ${advance.balance}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 m-0">
                <div className="text-center py-8">
                  <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Payroll History</h3>
                  <p className="text-gray-600">Previous payroll calculations and changes will appear here</p>
                </div>
              </TabsContent>

              {/* Compliance Tab */}
              <TabsContent value="compliance" className="space-y-4 m-0">
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Compliance Checks</h3>
                  <p className="text-gray-600">Regulatory compliance status and requirements</p>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}