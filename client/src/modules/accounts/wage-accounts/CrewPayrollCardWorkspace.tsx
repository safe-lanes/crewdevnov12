/**
 * Crew Payroll Card Workspace
 * Purpose: Deep dive per seafarer within a run
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
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
  X,
  Download,
  Mail,
  Sliders
} from "lucide-react";

interface CrewMember {
  id: string;
  name: string;
  rank: string;
  photo: string;
  contractStart: string;
  contractEnd: string;
  cba: string;
  currency: string;
  hasAllotments: boolean;
  bankVerified: boolean;
  warnings: string[];
}

// Mock crew member data
const mockCrewMember: CrewMember = {
  id: "CREW001",
  name: "James Wilson",
  rank: "Captain",
  photo: "/api/placeholder/80/80",
  contractStart: "2024-01-15",
  contractEnd: "2024-12-31",
  cba: "ITF Standard",
  currency: "USD",
  hasAllotments: true,
  bankVerified: true,
  warnings: []
};

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

export function CrewPayrollCardWorkspace() {
  const [activeTab, setActiveTab] = useState("paysheet");
  const [editingPaysheet, setEditingPaysheet] = useState<number | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [overtimeSimulation, setOvertimeSimulation] = useState([40]);
  const [fxRateSimulation, setFxRateSimulation] = useState([1.0]);

  const crewMember = mockCrewMember;

  const handleEditPaysheet = (id: number) => {
    setEditingPaysheet(id);
  };

  const handleSavePaysheet = () => {
    setEditingPaysheet(null);
    // Real-time recalculation would happen here
  };

  const toggleSimulation = () => {
    setSimulationMode(!simulationMode);
  };

  const applySimulation = () => {
    // Apply simulation changes to the payrun
    setSimulationMode(false);
    console.log("Applying simulation changes");
  };

  const discardSimulation = () => {
    setSimulationMode(false);
    setOvertimeSimulation([40]);
    setFxRateSimulation([1.0]);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
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
              
              <div className="flex items-center gap-2">
                {crewMember.hasAllotments && (
                  <Badge variant="outline" className="gap-1">
                    <Heart className="w-3 h-3" />
                    Allotments
                  </Badge>
                )}
                {crewMember.bankVerified && (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Bank Verified
                  </Badge>
                )}
                {crewMember.warnings.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {crewMember.warnings.length} Warning{crewMember.warnings.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            {simulationMode ? (
              <>
                <Button variant="outline" onClick={discardSimulation} className="gap-1">
                  <X className="w-4 h-4" />
                  Discard
                </Button>
                <Button onClick={applySimulation} className="gap-1">
                  <Save className="w-4 h-4" />
                  Apply to Run
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={toggleSimulation} className="gap-1">
                  <Sliders className="w-4 h-4" />
                  Simulate
                </Button>
                <Button variant="outline" className="gap-1">
                  <Download className="w-4 h-4" />
                  Generate Payslip
                </Button>
                <Button variant="outline" className="gap-1">
                  <Send className="w-4 h-4" />
                  Send to Crew
                </Button>
                <Button variant="outline" className="gap-1">
                  <Mail className="w-4 h-4" />
                  Mark Delivered
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Simulation Controls */}
        {simulationMode && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-3">Simulation Controls</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-blue-700">Overtime Hours: {overtimeSimulation[0]}</Label>
                <Slider
                  value={overtimeSimulation}
                  onValueChange={setOvertimeSimulation}
                  max={80}
                  min={0}
                  step={1}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-sm text-blue-700">FX Rate: {fxRateSimulation[0].toFixed(3)}</Label>
                <Slider
                  value={fxRateSimulation}
                  onValueChange={setFxRateSimulation}
                  max={1.2}
                  min={0.8}
                  step={0.001}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-sm text-blue-700">Rank Change Date</Label>
                <Input type="date" className="mt-2" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-6 rounded-none border-b bg-white">
          <TabsTrigger value="paysheet">Paysheet</TabsTrigger>
          <TabsTrigger value="time">Time/OT</TabsTrigger>
          <TabsTrigger value="allotments">Allotments</TabsTrigger>
          <TabsTrigger value="advances">Advances & Bond</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="paysheet" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Current Period Paysheet</span>
                  <Badge variant="outline">January 2025</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockPaysheetData.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{item.element}</div>
                        <div className="text-sm text-gray-500">{item.formula}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {editingPaysheet === item.id ? (
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              defaultValue={item.amount} 
                              className="w-32"
                              step="0.01"
                            />
                            <Button size="sm" onClick={handleSavePaysheet}>
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingPaysheet(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className={`font-mono text-lg ${item.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              ${Math.abs(item.amount).toFixed(2)}
                            </span>
                            {item.editable && (
                              <Button size="sm" variant="outline" onClick={() => handleEditPaysheet(item.id)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t pt-3 mt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Net Pay</span>
                      <span className="font-mono text-green-600">
                        $11,374.75
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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
                        <div className="font-mono text-green-600">{entry.holidayHours}h</div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Overtime Rates & Multipliers</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>Standard OT: 1.5x ($75.50/hr)</div>
                    <div>Night Premium: +25%</div>
                    <div>Holiday Premium: 2.0x</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allotments" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Allotment Beneficiaries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockAllotments.map((allotment) => (
                    <div key={allotment.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{allotment.beneficiary}</div>
                          <div className="text-sm text-gray-500">
                            Priority #{allotment.priority} • Effective: {allotment.effectiveDate}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg">{allotment.percentage}%</div>
                          <div className="font-mono text-sm text-gray-600">
                            ${allotment.amount.toFixed(2)} {allotment.currency}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <Button variant="outline" className="w-full mt-4">
                  <Users className="w-4 h-4 mr-2" />
                  Add Beneficiary
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advances" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle>Cash Advances & Bond Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockAdvances.map((advance) => (
                    <div key={advance.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{advance.type}</div>
                          <div className="text-sm text-gray-500">{advance.date}</div>
                        </div>
                        <div className="text-right">
                          <Badge variant={advance.status === "Completed" ? "default" : "secondary"}>
                            {advance.status}
                          </Badge>
                          <div className="font-mono mt-1">
                            Amount: ${advance.amount} | Balance: ${advance.balance}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-sm text-yellow-800">
                    <strong>Advance Limits:</strong> Monthly cap $2,000 | Remaining: $1,500
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Payroll History & Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {["December 2024", "November 2024", "October 2024"].map((period, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="font-medium text-sm">{period}</div>
                        <div className="font-mono text-lg mt-1">
                          ${(11000 + Math.random() * 800).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Variance: {index === 0 ? "+$125" : index === 1 ? "-$45" : "+$78"}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Recent Adjustments</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Retro OT adjustment (Dec 2024)</span>
                        <span className="font-mono text-green-600">+$125.50</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax correction (Nov 2024)</span>
                        <span className="font-mono text-red-600">-$45.25</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Compliance & Documentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-medium">Deduction Consent</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Valid until: Dec 31, 2024
                      </div>
                    </div>
                    
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-medium">MLC Statement</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        Generated: Jan 13, 2025
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Required Actions</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <span>Contract expires in 11 months - renewal required</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>All mandatory deductions properly authorized</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download MLC Statement Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}