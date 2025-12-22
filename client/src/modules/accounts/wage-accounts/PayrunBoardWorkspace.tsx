/**
 * Payrun Board Workspace - AG Grid tabular format for large fleets
 * Purpose: Manage and monitor all payroll runs in a scalable table format
 */

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PayrunDetailForm, PayrunDetailFormData } from "./PayrunDetailForm";
import { ValidationCenterModal } from "./ValidationCenterModal";

import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGridTable';
import AgGridTableActions from '@/components/AgGridTableActions';
import { 
  Calendar,
  Ship,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
  TrendingUp,
  Clock,
  Eye,
  Edit,
  Play,
  RotateCcw as HistoryIcon,
  Shield,
  Bell,
  Plus
} from "lucide-react";

export type PayrunStatus = "draft" | "validated" | "approved" | "paid" | "posted";

export interface PayrunRowData {
  vessel: string;
  period: string;
  status: PayrunStatus;
  crewCount: number;
  netTotal: number;
  currency: string;
  warnings: number;
  lastUpdatedBy: string;
  updatedDate: string;
  isOffCycle?: boolean;
}



// Status Badge Renderer
const StatusBadgeRenderer = (params: ICellRendererParams) => {
  const status = params.value;
  const variants = {
    draft: { label: "Draft", color: "bg-gray-100 text-gray-800" },
    validated: { label: "Validated", color: "bg-blue-100 text-blue-800" },
    approved: { label: "Approved", color: "bg-green-100 text-green-800" },
    paid: { label: "Paid", color: "bg-purple-100 text-purple-800" },
    posted: { label: "Posted", color: "bg-orange-100 text-orange-800" }
  };
  
  const config = variants[status as keyof typeof variants] || variants.draft;
  
  return (
    <Badge className={`rounded-md px-2.5 py-1 font-bold min-w-[48px] text-center ${config.color}`}>
      {config.label}
    </Badge>
  );
};

// Currency Renderer
const CurrencyRenderer = (params: ICellRendererParams) => {
  const { value, data } = params;
  const currency = data.currency || 'USD';
  return (
    <div className="font-mono text-right" style={{ fontSize: '13px', color: '#4f5863' }}>
      {currency} {value?.toLocaleString() || '0'}
    </div>
  );
};

// Interactive Warnings Renderer - clickable to open validation center
const WarningsRenderer = (params: ICellRendererParams) => {
  const warnings = params.value || 0;
  if (warnings === 0) {
    return <span className="text-gray-400" style={{ fontSize: '13px', color: '#4f5863' }}>—</span>;
  }

  const handleOpenValidation = () => {
    const payrunId = params.data.vessel + '-' + params.data.period;
    // Access the parent component's handleOpenValidation function
    if (params.context && params.context.handleOpenValidation) {
      params.context.handleOpenValidation(payrunId);
    }
  };

  return (
    <div 
      className="flex items-center gap-1 text-amber-600 cursor-pointer hover:text-amber-700 hover:bg-amber-50 rounded px-1 py-0.5 transition-colors" 
      style={{ fontSize: '13px' }}
      onClick={handleOpenValidation}
      title="Click to open Validation Center"
    >
      <AlertTriangle className="w-4 h-4" />
      <span className="font-medium">{warnings}</span>
    </div>
  );
};



// Mock data for demonstration
const mockPayrunData: PayrunRowData[] = [
  {
    vessel: "MV Atlantic Explorer",
    period: "Jan 01 - Jan 31, 2025",
    status: "validated",
    crewCount: 24,
    netTotal: 125000,
    currency: "USD",
    warnings: 2,
    lastUpdatedBy: "John Smith",
    updatedDate: "Jan 12, 04:00",
    isOffCycle: false
  },
  {
    vessel: "MV Pacific Voyager",
    period: "Jan 01 - Jan 31, 2025",
    status: "draft",
    crewCount: 18,
    netTotal: 95000,
    currency: "USD",
    warnings: 5,
    lastUpdatedBy: "Mary Johnson",
    updatedDate: "Jan 11, 04:00",
    isOffCycle: false
  },
  {
    vessel: "MV Northern Star",
    period: "Jan 01 - Jan 31, 2025",
    status: "approved",
    crewCount: 22,
    netTotal: 115000,
    currency: "USD",
    warnings: 0,
    lastUpdatedBy: "Sarah Chen",
    updatedDate: "Jan 10, 03:30",
    isOffCycle: false
  },
  {
    vessel: "MV Southern Cross",
    period: "Jan 01 - Jan 31, 2025",
    status: "paid",
    crewCount: 20,
    netTotal: 108000,
    currency: "EUR",
    warnings: 1,
    lastUpdatedBy: "Mike Rodriguez",
    updatedDate: "Jan 09, 05:15",
    isOffCycle: false
  },
  {
    vessel: "MV Eastern Dawn",
    period: "Jan 01 - Jan 31, 2025",
    status: "posted",
    crewCount: 26,
    netTotal: 135000,
    currency: "USD",
    warnings: 0,
    lastUpdatedBy: "Lisa Wang",
    updatedDate: "Jan 08, 02:45",
    isOffCycle: false
  },
  {
    vessel: "MV Western Wind",
    period: "Jan 15 - Jan 31, 2025",
    status: "draft",
    crewCount: 15,
    netTotal: 62000,
    currency: "GBP",
    warnings: 3,
    lastUpdatedBy: "Tom Wilson",
    updatedDate: "Jan 15, 06:00",
    isOffCycle: true
  }
];

export function PayrunBoardWorkspace() {
  const [selectedVessel, setSelectedVessel] = useState("all");
  const [selectedPeriod, setPeriodVessel] = useState("current");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showOffCycle, setShowOffCycle] = useState(false);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnseenChanges, setHasUnseenChanges] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPayrun, setSelectedPayrun] = useState<PayrunDetailFormData | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [validationPayrunId, setValidationPayrunId] = useState<string | null>(null);
  




  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    return mockPayrunData.filter(payrun => {
      if (selectedVessel !== "all" && !payrun.vessel.toLowerCase().includes(selectedVessel.toLowerCase())) {
        return false;
      }
      if (selectedStatus !== "all" && payrun.status !== selectedStatus) {
        return false;
      }
      if (!showOffCycle && payrun.isOffCycle) {
        return false;
      }
      return true;
    });
  }, [selectedVessel, selectedStatus, showOffCycle]);

  // Grid ready handler
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Handle validation modal
  const handleOpenValidation = (payrunId: string) => {
    setValidationPayrunId(payrunId);
    setIsValidationModalOpen(true);
  };

  const handleValidationNavigate = (view: string, payRunId?: string, crewId?: string) => {
    console.log('Navigate from validation:', view, payRunId, crewId);
    // Handle navigation as needed
  };



  // Actions Renderer - now inside component scope
  const ActionsRenderer = (params: ICellRendererParams) => {
    const handleView = () => {
      console.log('View payrun:', params.data);
    };

    const handleEdit = () => {
      console.log('Edit payrun:', params.data);
      // Convert row data to PayrunDetailFormData format
      const formData: PayrunDetailFormData = {
        id: params.data.vessel + '-' + params.data.period,
        period: params.data.period,
        vessel: params.data.vessel,
        fxPolicy: "Static Rate",
        template: "Standard Crew",
        lastCalcTimestamp: "Just now",
        status: params.data.status,
        isOffCycle: params.data.isOffCycle,
        crewCount: params.data.crewCount,
        netTotal: params.data.netTotal,
        currency: params.data.currency,
        warnings: params.data.warnings,
        lastUpdatedBy: params.data.lastUpdatedBy,
        updatedDate: params.data.updatedDate
      };
      console.log('Setting form data:', formData);
      setSelectedPayrun(formData);
      setIsFormOpen(true);
      console.log('Modal should open now');
    };

    const handleRun = () => {
      console.log('Run payrun:', params.data);
    };

    const handleValidation = () => {
      const payrunId = params.data.vessel + '-' + params.data.period;
      handleOpenValidation(payrunId);
    };

    return (
      <div className="flex gap-1 justify-center">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleView} title="View Details">
          <Eye className="h-[18px] w-[18px] text-gray-500" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleEdit} title="Edit Payrun">
          <Edit className="h-[18px] w-[18px] text-gray-500" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRun} title="Run Payrun">
          <Play className="h-[18px] w-[18px] text-gray-500" />
        </Button>
      </div>
    );
  };

  // Column definitions - matching Appraisals standard
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "Vessel",
      field: "vessel",
      flex: 2,
      minWidth: 180,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: "left",
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex items-center gap-2">
          <Ship className="w-4 h-4 text-blue-600" />
          <span className="font-medium">{params.value}</span>
          {params.data.isOffCycle && (
            <Badge variant="destructive" className="text-xs">Off-cycle</Badge>
          )}
        </div>
      )
    },
    {
      headerName: "Period",
      field: "period",
      flex: 1.5,
      minWidth: 160,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: "Status",
      field: "status",
      flex: 1,
      minWidth: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      cellRenderer: StatusBadgeRenderer,
      enableRowGroup: false
    },
    {
      headerName: "Crew Count",
      field: "crewCount",
      flex: 0.8,
      minWidth: 90,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4 text-gray-500" />
          <span>{params.value}</span>
        </div>
      )
    },
    {
      headerName: "Net Total",
      field: "netTotal",
      flex: 1.2,
      minWidth: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      cellRenderer: CurrencyRenderer,
    },
    {
      headerName: "Warnings",
      field: "warnings",
      flex: 0.6,
      minWidth: 70,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      cellRenderer: WarningsRenderer,
    },
    {
      headerName: "Last Updated By",
      field: "lastUpdatedBy",
      flex: 1.2,
      minWidth: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: "Updated Date",
      field: "updatedDate",
      flex: 1,
      minWidth: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true,
    },
    {
      headerName: "Actions",
      width: 120,
      maxWidth: 120,
      pinned: "right",
      cellRenderer: ActionsRenderer,
      sortable: false,
      filter: false,
      resizable: false,
    }
  ], [setSelectedPayrun, setIsFormOpen]);

  // Recent Changes data
  const recentChanges = [
    {
      id: "1",
      description: "Contract updated for John Doe",
      vessel: "MV Atlantic Explorer",
      timestamp: "2 hours ago",
      type: "contract",
      color: "text-blue-600"
    },
    {
      id: "2", 
      description: "New CBA rates applied",
      vessel: "All vessels",
      timestamp: "5 hours ago",
      type: "rates",
      color: "text-green-600"
    },
    {
      id: "3",
      description: "FX rates updated",
      vessel: "System-wide",
      timestamp: "1 day ago", 
      type: "fx",
      color: "text-orange-600"
    }
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payrun Board</h1>
            <p className="text-sm text-gray-600 mt-1">Manage and monitor all payroll runs</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Button 
                variant="outline" 
                className="gap-1 relative"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    setHasUnseenChanges(false); // Mark as seen when opened
                  }
                }}
              >
                <Bell className="w-4 h-4" />
                Changes
                {hasUnseenChanges && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                )}
              </Button>
            </div>
            <Button variant="outline" className="gap-1">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button className="gap-1 bg-[#52baf3] hover:bg-[#4ab1ea] text-white">
              <Plus className="w-4 h-4" />
              New Pay Run
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-4">
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              <SelectItem value="atlantic">MV Atlantic Explorer</SelectItem>
              <SelectItem value="pacific">MV Pacific Voyager</SelectItem>
              <SelectItem value="northern">MV Northern Star</SelectItem>
              <SelectItem value="southern">MV Southern Cross</SelectItem>
              <SelectItem value="eastern">MV Eastern Dawn</SelectItem>
              <SelectItem value="western">MV Western Wind</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPeriod} onValueChange={setPeriodVessel}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Current Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="previous">Previous Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="validated">Validated</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="show-off-cycle" 
              checked={showOffCycle}
              onCheckedChange={(checked) => setShowOffCycle(checked as boolean)}
            />
            <Label htmlFor="show-off-cycle" className="text-sm">Show Off-cycle</Label>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {/* Main Data Grid - Full Width */}
        <div className="w-full px-6 py-0">
          <Card className="h-full">
            <CardContent className="p-0 h-full">
              <AgGridTable
                rowData={filteredData}
                columnDefs={columnDefs}
                onGridReady={onGridReady}
                autoHeight={true}
                maxHeight="500px"
                minHeight="200px"
                width="100%"
                enableExport={true}
                enableSideBar={false}
                enableStatusBar={false}
                enableRowGrouping={false}
                enablePivoting={false}
                enableAdvancedFilter={false}
                rowSelection={false}
                theme="alpine"
                pagination={true}
                paginationPageSize={20}
                context={{ handleOpenValidation }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Notification Panel - Overlay */}
        {showNotifications && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-black bg-opacity-10"
              onClick={() => setShowNotifications(false)}
            />
            
            {/* Notification Panel */}
            <div className="fixed top-20 right-6 z-50 w-80">
              <Card className="shadow-xl border border-gray-300 bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HistoryIcon className="w-5 h-5" />
                    Recent Changes Affecting Payroll
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentChanges.map((change) => (
                    <div key={change.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        change.type === 'contract' ? 'bg-blue-500' :
                        change.type === 'rates' ? 'bg-green-500' : 'bg-orange-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{change.description}</p>
                        <p className="text-xs text-gray-600">{change.vessel}</p>
                        <p className="text-xs text-gray-500 mt-1">{change.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Payrun Detail Form Modal */}
      <PayrunDetailForm
        isOpen={isFormOpen}
        onClose={() => {
          console.log('Closing modal');
          setIsFormOpen(false);
        }}
        payrunData={selectedPayrun}
        onSave={(data: PayrunDetailFormData) => {
          console.log('Saving payrun data:', data);
          // Here you would typically update the backend
          // For now, just close the modal
          setIsFormOpen(false);
        }}
      />

      {/* Validation Center Modal */}
      <ValidationCenterModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        payRunId={validationPayrunId}
        onNavigate={handleValidationNavigate}
      />



    </div>
  );
}