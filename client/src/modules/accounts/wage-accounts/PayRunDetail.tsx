/**
 * Pay Run Detail - 3-pane layout for detailed pay run management
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Calculator,
  Lock,
  Check,
  DollarSign,
  FileText,
  AlertCircle,
  ChevronRight,
  Settings,
  Download,
  Upload,
  RefreshCw,
  Eye
} from "lucide-react";
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface PayRunDetailProps {
  payRunId: string | null;
  onNavigate: (view: string, payRunId?: string, crewId?: string) => void;
}

export function PayRunDetail({ payRunId, onNavigate }: PayRunDetailProps) {
  const [selectedCrew, setSelectedCrew] = useState<any>(null);
  const [gridApi, setGridApi] = useState<any>(null);

  // Column definitions for AG Grid
  const columnDefs = [
    { 
      field: 'crew',
      headerName: 'Crew',
      pinned: 'left',
      width: 150,
      cellRenderer: (params: any) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{params.value}</span>
        </div>
      )
    },
    { field: 'rank', headerName: 'Rank', width: 120 },
    { field: 'basic', headerName: 'Basic', width: 100, valueFormatter: (params: any) => `$${params.value}` },
    { field: 'overtime', headerName: 'Overtime', width: 100, valueFormatter: (params: any) => `$${params.value}` },
    { field: 'leave', headerName: 'Leave', width: 100, valueFormatter: (params: any) => `$${params.value}` },
    { field: 'bonus', headerName: 'Bonus', width: 100, valueFormatter: (params: any) => `$${params.value}` },
    { field: 'deductions', headerName: 'Deductions', width: 100, valueFormatter: (params: any) => `$${params.value}` },
    { field: 'net', headerName: 'Net', width: 120, valueFormatter: (params: any) => `$${params.value}`,
      cellClass: 'font-bold' },
    { field: 'variance', headerName: 'Variance', width: 100, 
      cellRenderer: (params: any) => {
        const variance = params.value;
        const color = variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-gray-600';
        return <span className={color}>{variance > 0 ? '+' : ''}{variance}%</span>;
      }
    },
    { field: 'flags', headerName: 'Flags', width: 100,
      cellRenderer: (params: any) => {
        if (params.value > 0) {
          return <Badge variant="outline" className="text-yellow-600">{params.value} issues</Badge>;
        }
        return null;
      }
    }
  ];

  // Mock data
  const rowData = [
    { crew: 'John Smith', rank: 'Captain', basic: 8000, overtime: 1200, leave: 500, bonus: 1000, deductions: 800, net: 9900, variance: 2.5, flags: 0 },
    { crew: 'Mary Johnson', rank: 'Chief Engineer', basic: 7000, overtime: 800, leave: 400, bonus: 500, deductions: 600, net: 8100, variance: -1.2, flags: 1 },
    { crew: 'Robert Chen', rank: '2nd Officer', basic: 5000, overtime: 600, leave: 300, bonus: 0, deductions: 400, net: 5500, variance: 0, flags: 0 },
    { crew: 'Sarah Wilson', rank: '3rd Engineer', basic: 4500, overtime: 500, leave: 250, bonus: 0, deductions: 350, net: 4900, variance: 1.8, flags: 2 },
  ];

  const onGridReady = (params: any) => {
    setGridApi(params.api);
  };

  const onRowClicked = (event: any) => {
    setSelectedCrew(event.data);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => onNavigate('board')}>
              ← Back
            </Button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Pay Run Detail</h2>
              <Badge variant="outline">January 2025</Badge>
              <Badge>MV Atlantic Explorer</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="usd">
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
                <SelectItem value="gbp">GBP</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="template1">
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template1">Standard Template</SelectItem>
                <SelectItem value="template2">Senior Officers</SelectItem>
                <SelectItem value="template3">Junior Officers</SelectItem>
              </SelectContent>
            </Select>
            <div className="border-l pl-2 flex gap-1">
              <Button size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-1" />
                Recalculate
              </Button>
              <Button size="sm" variant="outline">
                <Lock className="h-4 w-4 mr-1" />
                Lock
              </Button>
              <Button size="sm" variant="outline" className="text-green-600">
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
              <Button size="sm" variant="outline" className="text-blue-600">
                <DollarSign className="h-4 w-4 mr-1" />
                Pay
              </Button>
              <Button size="sm" variant="outline">
                <FileText className="h-4 w-4 mr-1" />
                Post
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Crew Grid */}
        <div className="flex-1 p-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Crew Payroll Lines</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                  </Button>
                  <Button size="sm" variant="outline">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="h-4 w-4 mr-1" />
                    Columns
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[calc(100%-80px)]">
              <div className="ag-theme-alpine h-full">
                <AgGridReact
                  columnDefs={columnDefs}
                  rowData={rowData}
                  onGridReady={onGridReady}
                  onRowClicked={onRowClicked}
                  rowSelection="single"
                  animateRows={true}
                  defaultColDef={{
                    sortable: true,
                    resizable: true,
                    filter: true,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inspector Panel */}
        <div className="w-[400px] border-l bg-gray-50 p-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Inspector Panel</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="breakdown">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
                  <TabsTrigger value="rules">Rules</TabsTrigger>
                  <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                <TabsContent value="breakdown" className="mt-4">
                  {selectedCrew ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-white rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{selectedCrew.crew}</span>
                          <Badge>{selectedCrew.rank}</Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Basic Wage:</span>
                            <span className="font-medium">${selectedCrew.basic}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Overtime:</span>
                            <span className="font-medium">${selectedCrew.overtime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Leave Pay:</span>
                            <span className="font-medium">${selectedCrew.leave}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Bonus:</span>
                            <span className="font-medium">${selectedCrew.bonus}</span>
                          </div>
                          <div className="flex justify-between text-red-600">
                            <span>Deductions:</span>
                            <span className="font-medium">-${selectedCrew.deductions}</span>
                          </div>
                          <div className="pt-2 border-t flex justify-between font-bold">
                            <span>Net Pay:</span>
                            <span className="text-green-600">${selectedCrew.net}</span>
                          </div>
                        </div>
                      </div>

                      <Button 
                        className="w-full mt-4" 
                        onClick={() => onNavigate('crew-card', payRunId || undefined, selectedCrew?.crew)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Payroll Card
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      Select a crew member to view details
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="rules" className="mt-4">
                  <div className="space-y-2">
                    <div className="p-2 bg-white rounded border">
                      <div className="text-sm font-medium">CBA: ITF Standard</div>
                      <div className="text-xs text-gray-600">Applied to all crew</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-sm font-medium">OT Rate: 1.5x</div>
                      <div className="text-xs text-gray-600">Over 40 hours/week</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-sm font-medium">Leave: 8.33%</div>
                      <div className="text-xs text-gray-600">Annual leave accrual</div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="exceptions" className="mt-4">
                  <div className="space-y-2">
                    {selectedCrew?.flags > 0 ? (
                      <>
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="flex items-center gap-2 text-yellow-700">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Missing time entries</span>
                          </div>
                          <div className="text-xs text-yellow-600 mt-1">
                            3 days without recorded hours
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        No exceptions found
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <div className="space-y-2">
                    <div className="p-2 bg-white rounded border">
                      <div className="text-xs text-gray-500">Jan 10, 2025 10:30 AM</div>
                      <div className="text-sm">Pay run created</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-xs text-gray-500">Jan 11, 2025 2:15 PM</div>
                      <div className="text-sm">Calculations updated</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-xs text-gray-500">Jan 12, 2025 9:00 AM</div>
                      <div className="text-sm">Validation completed</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}