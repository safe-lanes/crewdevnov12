/**
 * Portage Bill Workspace
 * Purpose: Vessel/period payroll statement
 */

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColDef, ColGroupDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGridTable';
import AgGridTableActions from '@/components/AgGridTableActions';
import { usePayrollData } from '@/hooks/usePayrollData';
import './PortageBillWorkspace.css';

import { 
  FileText, 
  Download, 
  Share2, 
  Lock, 
  Eye,
  DollarSign,
  Users,
  Calendar,
  Ship,
  Hash,
  Globe,
} from "lucide-react";

interface ConsolidatedCrewData {
  id: string;
  name: string;
  rank: string;
  // Dynamic pay element amounts will be added based on available elements
  [key: string]: any;
}

interface Signature {
  role: string;
  name: string;
  title: string;
  signed: boolean;
  signedDate?: string;
}



// Mock crew list for the vessel - only include crew with valid contract data
const vesselCrewMembers = [
  { id: "2025-05-14", name: "James Wilson", rank: "Captain" },
  { id: "2025-03-12", name: "Sarah Chen", rank: "Chief Engineer" },
  { id: "2025-02-12", name: "Mike Rodriguez", rank: "Second Officer" }
];

const mockSignatures: Signature[] = [
  { role: "Captain", name: "James Wilson", title: "Master", signed: true, signedDate: "2025-01-13" },
  { role: "Chief Engineer", name: "Sarah Chen", title: "Chief Engineer", signed: true, signedDate: "2025-01-13" },
  { role: "Purser", name: "Emma Thompson", title: "Ship's Purser", signed: false },
  { role: "Company Representative", name: "David Kim", title: "Fleet Manager", signed: false }
];

// Currency Renderer for pay elements
const PayElementCurrencyRenderer = (params: ICellRendererParams) => {
  const value = params.value || 0;
  const isEarning = params.colDef?.field?.includes('earning');
  const isDeduction = params.colDef?.field?.includes('deduction');
  
  const color = isEarning ? 'text-green-600' : 
                isDeduction ? 'text-red-600' : 
                'text-blue-600';
  
  // Don't show anything for zero values to keep the table clean
  if (value === 0) return <span className="text-gray-300 text-xs">-</span>;
  
  return (
    <span className={`font-mono ${color} font-medium text-sm`}>
      ${Math.abs(value).toFixed(0)}
    </span>
  );
};

// Total Currency Renderer for summary columns
const TotalCurrencyRenderer = (params: ICellRendererParams) => {
  const value = params.value || 0;
  const field = params.colDef?.field;
  const color = field === 'totalEarnings' ? 'text-green-600' : 
                field === 'totalDeductions' ? 'text-red-600' : 
                'text-blue-600';
  
  return (
    <span className={`font-mono ${color} font-bold`}>
      ${value.toFixed(2)}
    </span>
  );
};

// Actions Renderer  
const ActionsRenderer = (params: ICellRendererParams) => {
  // Don't render actions for pinned (totals) row
  if (params.node.rowPinned) return null;
  
  return (
    <div className="flex items-center justify-center">
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
        <Eye className="w-4 h-4" />
      </Button>
    </div>
  );
};

export function PortageBillWorkspace() {
  const [dualCurrency, setDualCurrency] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isDraft, setIsDraft] = useState(true);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  
  // Filter states
  const [selectedVessel, setSelectedVessel] = useState("mv-atlantic-star");
  const [selectedMonth, setSelectedMonth] = useState("2025-01");
  
  // Get payroll data for all crew members - using the same hook call structure always
  const { data: payrollData1, isLoading: isLoading1 } = usePayrollData("2025-05-14");
  const { data: payrollData2, isLoading: isLoading2 } = usePayrollData("2025-03-12");
  const { data: payrollData3, isLoading: isLoading3 } = usePayrollData("2025-02-12");

  // Create crew data array
  const crewPayrollData = [
    { crew: { id: "2025-05-14", name: "James Wilson", rank: "Captain" }, payrollData: payrollData1, isLoading: isLoading1 },
    { crew: { id: "2025-03-12", name: "Sarah Chen", rank: "Chief Engineer" }, payrollData: payrollData2, isLoading: isLoading2 },
    { crew: { id: "2025-02-12", name: "Mike Rodriguez", rank: "Second Officer" }, payrollData: payrollData3, isLoading: isLoading3 }
  ];

  // Filter out crew members without data for now
  const validCrewData = crewPayrollData.filter(item => item.payrollData);

  // Extract all unique pay elements using name+code as the unique key
  const allPayElements = useMemo(() => {
    const earnings = new Map<string, { id: string; name: string; code: string }>();
    const deductions = new Map<string, { id: string; name: string; code: string }>();
    
    validCrewData.forEach(({ crew, payrollData }) => {
      if (!payrollData) return;
      
      payrollData.elements.earnings.forEach(element => {
        // Use name+code as unique key since these represent the same logical pay element
        const uniqueKey = `${element.name}_${element.code}`;
        if (!earnings.has(uniqueKey)) {
          earnings.set(uniqueKey, { 
            id: uniqueKey, 
            name: element.name, 
            code: element.code 
          });
        }
      });
      
      payrollData.elements.deductions.forEach(element => {
        // Use name+code as unique key since these represent the same logical pay element
        const uniqueKey = `${element.name}_${element.code}`;
        if (!deductions.has(uniqueKey)) {
          deductions.set(uniqueKey, { 
            id: uniqueKey, 
            name: element.name, 
            code: element.code 
          });
        }
      });
    });
    
    return {
      earnings: Array.from(earnings.values()),
      deductions: Array.from(deductions.values())
    };
  }, [validCrewData]);

  // Transform crew data into consolidated format
  const consolidatedData = useMemo<ConsolidatedCrewData[]>(() => {
    return validCrewData.map(({ crew, payrollData }) => {
      const row: ConsolidatedCrewData = {
        id: crew.id,
        name: crew.name,
        rank: crew.rank,
        totalEarnings: 0,
        totalDeductions: 0,
        netPay: 0
      };

      if (payrollData) {
        // Add earnings using name+code as unique key
        payrollData.elements.earnings.forEach(element => {
          const uniqueKey = `${element.name}_${element.code}`;
          row[`earning_${uniqueKey}`] = Number(element.value) || 0;
        });
        
        // Add deductions using name+code as unique key
        payrollData.elements.deductions.forEach(element => {
          const uniqueKey = `${element.name}_${element.code}`;
          row[`deduction_${uniqueKey}`] = Number(element.value) || 0;
        });

        // Calculate totals
        row.totalEarnings = Number(payrollData.totals.grossEarnings) || 0;
        row.totalDeductions = Number(payrollData.totals.totalDeductions) || 0;
        row.netPay = Number(payrollData.totals.netPay) || 0;
      }

      return row;
    });
  }, [validCrewData]);

  const totalEarnings = consolidatedData.reduce((sum, crew) => sum + crew.totalEarnings, 0);
  const totalDeductions = consolidatedData.reduce((sum, crew) => sum + crew.totalDeductions, 0);
  const totalNet = consolidatedData.reduce((sum, crew) => sum + crew.netPay, 0);
  const totalCrew = consolidatedData.length;

  // AG Grid setup
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Prepare totals row for pinned bottom
  const totalsRowData = useMemo(() => {
    const totalsRow: any = {
      id: 'totals',
      name: `TOTAL (${totalCrew} crew)`,
      rank: '',
      totalEarnings,
      totalDeductions,
      netPay: totalNet,
      actions: ''
    };

    // Add totals for each pay element
    allPayElements.earnings.forEach(element => {
      const total = consolidatedData.reduce((sum, crew) => sum + (crew[`earning_${element.id}`] || 0), 0);
      totalsRow[`earning_${element.id}`] = total;
    });

    allPayElements.deductions.forEach(element => {
      const total = consolidatedData.reduce((sum, crew) => sum + (crew[`deduction_${element.id}`] || 0), 0);
      totalsRow[`deduction_${element.id}`] = total;
    });

    return [totalsRow];
  }, [totalCrew, totalEarnings, totalDeductions, totalNet, allPayElements, consolidatedData]);

  // Column definitions with grouped headers
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const columns: (ColDef | ColGroupDef)[] = [];

    // Crew info columns
    columns.push({
      headerName: "Name",
      field: "name",
      width: 150,
      cellClass: (params: any) => params.node.rowPinned ? "font-bold bg-gray-100" : "font-medium",
      pinned: 'left'
    });

    columns.push({
      headerName: "Rank", 
      field: "rank",
      width: 120,
      cellClass: (params: any) => params.node.rowPinned ? "bg-gray-100" : "text-gray-600 text-sm",
      pinned: 'left'
    });

    // Earnings group
    if (allPayElements.earnings.length > 0) {
      const earningsChildren: ColDef[] = allPayElements.earnings.map(element => ({
        headerName: element.name,
        field: `earning_${element.id}`,
        flex: 1,
        minWidth: 120,
        cellRenderer: PayElementCurrencyRenderer,
        headerClass: "text-center",
        cellClass: (params: any) => params.node.rowPinned ? "text-center bg-gray-100" : "text-center",
        headerTooltip: `${element.name} (${element.code})`
      }));

      columns.push({
        headerName: "Earnings",
        headerClass: "ag-header-earnings",
        children: earningsChildren
      });
    }

    // Deductions group
    if (allPayElements.deductions.length > 0) {
      const deductionsChildren: ColDef[] = allPayElements.deductions.map(element => ({
        headerName: element.name,
        field: `deduction_${element.id}`,
        flex: 1,
        minWidth: 120,
        cellRenderer: PayElementCurrencyRenderer,
        headerClass: "text-center",
        cellClass: (params: any) => params.node.rowPinned ? "text-center bg-gray-100" : "text-center",
        headerTooltip: `${element.name} (${element.code})`
      }));

      columns.push({
        headerName: "Deductions",
        headerClass: "ag-header-deductions",
        children: deductionsChildren
      });
    }

    // Summary columns
    columns.push({
      headerName: "Net (USD)",
      field: "netPay",
      width: 120,
      cellRenderer: TotalCurrencyRenderer,
      headerClass: "text-right",
      cellClass: (params: any) => params.node.rowPinned ? "text-right bg-gray-100 font-bold" : "text-right",
      pinned: 'right'
    });

    columns.push({
      headerName: "Actions",
      field: "actions",
      width: 80,
      cellRenderer: ActionsRenderer,
      headerClass: "text-center",
      cellClass: (params: any) => params.node.rowPinned ? "text-center bg-gray-100" : "text-center",
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    });

    return columns;
  }, [allPayElements]);

  const handleExportPDF = () => {
    console.log("Exporting PDF");
  };

  const handleExportXLSX = () => {
    console.log("Exporting XLSX");
  };

  const handleLock = () => {
    setIsLocked(true);
    setIsDraft(false);
    console.log("Locking portage bill with version hash");
  };

  const handleShare = () => {
    console.log("Sharing to vessel");
  };



  // Get display values for selected filters
  const getVesselName = (value: string) => {
    const vessels = {
      "mv-atlantic-star": "MV Atlantic Star",
      "mv-atlantic-explorer": "MV Atlantic Explorer", 
      "mv-pacific-voyager": "MV Pacific Voyager",
      "mv-northern-star": "MV Northern Star",
      "mv-southern-cross": "MV Southern Cross",
      "mv-eastern-dawn": "MV Eastern Dawn",
      "mv-western-wind": "MV Western Wind"
    };
    return vessels[value as keyof typeof vessels] || "MV Atlantic Star";
  };

  const getMonthName = (value: string) => {
    const months = {
      "2025-01": "January 2025",
      "2024-12": "December 2024", 
      "2024-11": "November 2024",
      "2024-10": "October 2024",
      "2024-09": "September 2024",
      "2024-08": "August 2024"
    };
    return months[value as keyof typeof months] || "January 2025";
  };

  const versionHash = "PB-2025-001-v1.2.3-a7b8c9d";

  return (
    <div className="h-full flex flex-col bg-gray-50 relative">
      {/* Draft Watermark */}
      {isDraft && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="text-gray-200 text-9xl font-bold transform rotate-45 opacity-10">
            DRAFT
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 relative z-20">
        <div className="flex items-center justify-between">
          {/* Left - Document Info */}
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">Portage Bill</h1>
              {isDraft ? (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="w-3 h-3" />
                  Draft
                </Badge>
              ) : (
                <Badge variant="default" className="gap-1">
                  <Lock className="w-3 h-3" />
                  Locked
                </Badge>
              )}
            </div>
            
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-4">

            {/* Actions */}
            <Button variant="outline" onClick={handleExportPDF} className="gap-1">
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleExportXLSX} className="gap-1">
              <Download className="w-4 h-4" />
              Export XLSX
            </Button>
            
            {!isLocked && (
              <Button variant="outline" onClick={handleLock} className="gap-1">
                <Lock className="w-4 h-4" />
                Lock
              </Button>
            )}
            
            <Button onClick={handleShare} className="gap-1">
              <Share2 className="w-4 h-4" />
              Share to Vessel
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-4">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mv-atlantic-star">MV Atlantic Star</SelectItem>
              <SelectItem value="mv-atlantic-explorer">MV Atlantic Explorer</SelectItem>
              <SelectItem value="mv-pacific-voyager">MV Pacific Voyager</SelectItem>
              <SelectItem value="mv-northern-star">MV Northern Star</SelectItem>
              <SelectItem value="mv-southern-cross">MV Southern Cross</SelectItem>
              <SelectItem value="mv-eastern-dawn">MV Eastern Dawn</SelectItem>
              <SelectItem value="mv-western-wind">MV Western Wind</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-01">January 2025</SelectItem>
              <SelectItem value="2024-12">December 2024</SelectItem>
              <SelectItem value="2024-11">November 2024</SelectItem>
              <SelectItem value="2024-10">October 2024</SelectItem>
              <SelectItem value="2024-09">September 2024</SelectItem>
              <SelectItem value="2024-08">August 2024</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto relative z-20">
        <div className="px-6 py-0">
          <Card>
            <CardContent className="p-0">
              <AgGridTable
                rowData={consolidatedData}
                columnDefs={columnDefs}
                onGridReady={onGridReady}
                suppressRowClickSelection={true}
                animateRows={true}
                autoHeight={false}
                enableSideBar={false}
                enableStatusBar={false}
                className="ag-theme-alpine portage-bill-consolidated"
                gridOptions={{
                  getRowId: (params: any) => params.data.id,
                  headerHeight: 40,
                  groupHeaderHeight: 40,
                  rowHeight: 45,
                  pinnedBottomRowData: totalsRowData,
                  defaultColDef: {
                    sortable: true,
                    filter: false,
                    resizable: true
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>


    </div>
  );
}