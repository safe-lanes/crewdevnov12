/**
 * Crew Payroll Card - Detailed view of individual crew member's payroll
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  User,
  Calendar,
  DollarSign,
  Clock,
  CreditCard,
  FileText,
  Shield,
  Download,
  Calculator,
  Send,
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface CrewPayrollCardProps {
  crewId: string | null;
  payRunId: string | null;
  onNavigate: (view: string, payRunId?: string, crewId?: string) => void;
}

export function CrewPayrollCard({ crewId, payRunId, onNavigate }: CrewPayrollCardProps) {
  const [activeTab, setActiveTab] = useState("paysheet");

  // Mock crew data
  const crewData = {
    id: "CR001",
    name: "John Smith",
    rank: "Captain",
    vessel: "MV Atlantic Explorer",
    contractStart: "2024-06-01",
    contractEnd: "2025-05-31",
    cba: "ITF Standard",
    currency: "USD",
    bankVerified: true,
    allotments: 2,
    photo: null
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('detail', payRunId || undefined)}>
            ← Back to Pay Run
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              Generate Payslip
            </Button>
          </div>
        </div>
      </div>

      {/* Crew Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={crewData.photo || undefined} />
            <AvatarFallback>{crewData.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{crewData.name}</h2>
              <Badge>{crewData.rank}</Badge>
              <Badge variant="outline">{crewData.vessel}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Contract: {crewData.contractStart} to {crewData.contractEnd}
              </div>
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                CBA: {crewData.cba}
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Currency: {crewData.currency}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {crewData.allotments > 0 && (
              <Badge variant="secondary">
                <CreditCard className="h-3 w-3 mr-1" />
                {crewData.allotments} Allotments
              </Badge>
            )}
            {crewData.bankVerified && (
              <Badge variant="secondary" className="text-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Bank Verified
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="paysheet">Paysheet</TabsTrigger>
            <TabsTrigger value="time">Time/OT</TabsTrigger>
            <TabsTrigger value="allotments">Allotments</TabsTrigger>
            <TabsTrigger value="advances">Advances & Bond</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          {/* Paysheet Tab */}
          <TabsContent value="paysheet" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Paysheet Details - January 2025</CardTitle>
                  <Button size="sm">
                    <Calculator className="h-4 w-4 mr-1" />
                    Recalculate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pay Element</TableHead>
                      <TableHead>Days/Hours</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Basic Wage</TableCell>
                      <TableCell>31 days</TableCell>
                      <TableCell>$258.06/day</TableCell>
                      <TableCell className="text-right font-medium">$8,000.00</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Overtime</TableCell>
                      <TableCell>40 hours</TableCell>
                      <TableCell>$30.00/hr</TableCell>
                      <TableCell className="text-right font-medium">$1,200.00</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Leave Pay</TableCell>
                      <TableCell>8.33%</TableCell>
                      <TableCell>$8,000.00</TableCell>
                      <TableCell className="text-right font-medium">$666.40</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Fixed Overtime</TableCell>
                      <TableCell>Fixed</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right font-medium">$500.00</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell colSpan={3} className="font-bold">Gross Earnings</TableCell>
                      <TableCell className="text-right font-bold text-green-600">$10,366.40</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-red-600">Allotments</TableCell>
                      <TableCell>2 recipients</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right font-medium text-red-600">-$4,000.00</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-red-600">Cash Advance</TableCell>
                      <TableCell>1</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right font-medium text-red-600">-$500.00</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium text-red-600">Bond Store</TableCell>
                      <TableCell>Various</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell className="text-right font-medium text-red-600">-$150.00</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2 bg-gray-50">
                      <TableCell colSpan={3} className="font-bold text-lg">Net Pay</TableCell>
                      <TableCell className="text-right font-bold text-lg text-blue-600">$5,716.40</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time/OT Tab */}
          <TabsContent value="time" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Time & Overtime Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Regular Hours</p>
                            <p className="text-2xl font-bold">176</p>
                          </div>
                          <Clock className="h-8 w-8 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Overtime Hours</p>
                            <p className="text-2xl font-bold">40</p>
                          </div>
                          <Clock className="h-8 w-8 text-blue-400" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Total Hours</p>
                            <p className="text-2xl font-bold">216</p>
                          </div>
                          <Clock className="h-8 w-8 text-green-400" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Regular</TableHead>
                        <TableHead>OT 1.5x</TableHead>
                        <TableHead>OT 2.0x</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>Jan {i + 1}, 2025</TableCell>
                          <TableCell>8</TableCell>
                          <TableCell>2</TableCell>
                          <TableCell>0</TableCell>
                          <TableCell className="font-medium">10</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other tabs would be implemented similarly */}
          <TabsContent value="allotments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Allotments Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Allotments details will be shown here...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advances" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Advances & Bond Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Advances and bond purchase details will be shown here...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payroll History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Historical payroll records will be shown here...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance & Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Compliance checks and verification status will be shown here...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer Actions */}
      <div className="border-t bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Last modified: Jan 12, 2025 10:30 AM by John Doe
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Calculator className="h-4 w-4 mr-2" />
              Simulate
            </Button>
            <Button variant="outline">
              Apply Changes
            </Button>
            <Button>
              <Send className="h-4 w-4 mr-2" />
              Send to Crew
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}