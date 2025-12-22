/**
 * Allotments Manager Workspace
 * Purpose: Manage multi beneficiary payouts
 */

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGridTable';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Users, 
  Heart, 
  DollarSign, 
  Percent,
  Edit,
  Copy,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Ship,
  Filter,
  Download,
  Plus,
  Trash2,
  CreditCard
} from "lucide-react";

interface Allotment {
  id: string;
  crewId: string;
  crewName: string;
  rank: string;
  beneficiaryName: string;
  relationship: string;
  allotmentType: "percentage" | "fixed";
  value: number;
  currency: string;
  bankName: string;
  accountNumber: string;
  priority: number;
  validFrom: string;
  validTo: string;
  status: "active" | "pending" | "expired";
  kycComplete: boolean;
  bankVerified: boolean;
}

interface BeneficiaryDetails {
  name: string;
  relationship: string;
  dateOfBirth: string;
  nationality: string;
  idNumber: string;
  address: string;
  bankName: string;
  accountNumber: string;
  swiftCode: string;
  iban: string;
  routingNumber: string;
}

// Mock allotments data
const mockAllotments: Allotment[] = [
  {
    id: "ALT001",
    crewId: "CREW001",
    crewName: "James Wilson",
    rank: "Captain",
    beneficiaryName: "Maria Wilson",
    relationship: "Spouse",
    allotmentType: "percentage",
    value: 60,
    currency: "USD",
    bankName: "Chase Bank",
    accountNumber: "****1234",
    priority: 1,
    validFrom: "2024-01-15",
    validTo: "2024-12-31",
    status: "active",
    kycComplete: true,
    bankVerified: true
  },
  {
    id: "ALT002",
    crewId: "CREW001", 
    crewName: "James Wilson",
    rank: "Captain",
    beneficiaryName: "Education Fund",
    relationship: "Dependent",
    allotmentType: "fixed",
    value: 1000,
    currency: "USD",
    bankName: "Wells Fargo",
    accountNumber: "****5678",
    priority: 2,
    validFrom: "2024-01-15",
    validTo: "2024-12-31",
    status: "active",
    kycComplete: true,
    bankVerified: false
  },
  {
    id: "ALT003",
    crewId: "CREW002",
    crewName: "Sarah Chen",
    rank: "Chief Engineer",
    beneficiaryName: "Li Chen",
    relationship: "Parent",
    allotmentType: "percentage",
    value: 40,
    currency: "USD",
    bankName: "Bank of America",
    accountNumber: "****9012",
    priority: 1,
    validFrom: "2024-02-01",
    validTo: "2024-12-31",
    status: "active",
    kycComplete: false,
    bankVerified: true
  }
];

const mockBeneficiaryDetails: BeneficiaryDetails = {
  name: "Maria Wilson",
  relationship: "Spouse",
  dateOfBirth: "1985-06-15",
  nationality: "US",
  idNumber: "123-45-6789",
  address: "123 Main St, Houston, TX 77001",
  bankName: "Chase Bank",
  accountNumber: "1234567890",
  swiftCode: "CHASUS33",
  iban: "US64CHASUS33123456789",
  routingNumber: "021000021"
};

export function AllotmentsManagerWorkspace() {
  const [selectedCrew, setSelectedCrew] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedVessel, setSelectedVessel] = useState("mv-atlantic-star");
  const [selectedMonth, setSelectedMonth] = useState("2025-01");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAllotment, setSelectedAllotment] = useState<Allotment | null>(null);
  const [beneficiaryDetails, setBeneficiaryDetails] = useState<BeneficiaryDetails>(mockBeneficiaryDetails);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const filteredAllotments = mockAllotments.filter(allotment => {
    const crewMatch = selectedCrew === "all" || allotment.crewId === selectedCrew;
    const statusMatch = selectedStatus === "all" || allotment.status === selectedStatus;
    return crewMatch && statusMatch;
  });

  const uniqueCrew = Array.from(new Set(mockAllotments.map(a => ({ id: a.crewId, name: a.crewName }))));

  const handleEditBeneficiary = (allotment: Allotment) => {
    setSelectedAllotment(allotment);
    setIsDrawerOpen(true);
  };

  const handleCopyFromTemplate = () => {
    console.log("Copying from template");
  };

  const handleValidateBanks = () => {
    console.log("Validating bank details");
  };

  const handleGenerateRemittance = () => {
    console.log("Generating remittance previews");
  };

  const calculateTotalPercentage = (crewId: string) => {
    return mockAllotments
      .filter(a => a.crewId === crewId && a.allotmentType === "percentage")
      .reduce((sum, a) => sum + a.value, 0);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: { variant: "default" as const, label: "Active" },
      pending: { variant: "secondary" as const, label: "Pending" },
      expired: { variant: "destructive" as const, label: "Expired" }
    };
    const config = variants[status as keyof typeof variants];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getValidationStatus = (allotment: Allotment) => {
    const issues = [];
    if (!allotment.kycComplete) issues.push("KYC Incomplete");
    if (!allotment.bankVerified) issues.push("Bank Unverified");
    
    const totalPercentage = calculateTotalPercentage(allotment.crewId);
    if (allotment.allotmentType === "percentage" && totalPercentage > 100) {
      issues.push("Exceeds 100%");
    }
    
    return issues;
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

  // AG Grid Cell Renderers
  const CrewNameRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    const totalPercentage = calculateTotalPercentage(allotment.crewId);
    
    return (
      <div>
        <div className="font-medium">{allotment.crewName}</div>
        {allotment.allotmentType === "percentage" && totalPercentage > 100 && (
          <div className="text-xs text-red-600 mt-1">
            Total: {totalPercentage}%
          </div>
        )}
      </div>
    );
  };

  const RankRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return (
      <div className="text-sm text-gray-600">{allotment.rank}</div>
    );
  };

  const BeneficiaryRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return (
      <div>
        <div className="font-medium">{allotment.beneficiaryName}</div>
        <div className="text-sm text-gray-500">{allotment.relationship}</div>
      </div>
    );
  };

  const TypeRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return allotment.allotmentType === "percentage" ? (
      <Badge variant="outline" className="gap-1">
        <Percent className="w-3 h-3" />
        %
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1">
        <DollarSign className="w-3 h-3" />
        Fixed
      </Badge>
    );
  };

  const ValueRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return (
      <span className="font-mono">
        {allotment.allotmentType === "percentage" 
          ? `${allotment.value}%` 
          : `${allotment.value.toLocaleString()}`
        }
      </span>
    );
  };

  const BankRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return (
      <div>
        <div className="font-medium text-sm">{allotment.bankName}</div>
        <div className="text-xs text-gray-500">{allotment.accountNumber}</div>
      </div>
    );
  };

  const PriorityRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return <Badge variant="outline">{allotment.priority}</Badge>;
  };

  const ValidPeriodRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return (
      <div className="text-sm">
        <div>{allotment.validFrom}</div>
        <div className="text-gray-500">to {allotment.validTo}</div>
      </div>
    );
  };

  const StatusRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    const validationIssues = getValidationStatus(allotment);
    
    return (
      <div className="space-y-1">
        {getStatusBadge(allotment.status)}
        {validationIssues.length > 0 && (
          <div className="flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3 text-orange-500" />
            <span className="text-xs text-orange-600">
              {validationIssues.length} issue{validationIssues.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    );
  };

  const ActionsRenderer = (params: ICellRendererParams) => {
    const allotment = params.data;
    return (
      <div className="flex items-center justify-center gap-1">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => handleEditBeneficiary(allotment)}
          className="gap-1"
        >
          <Edit className="w-3 h-3" />
          Edit
        </Button>
      </div>
    );
  };

  // AG Grid setup
  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Column definitions
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "Name",
      field: "crewName",
      flex: 1.2,
      minWidth: 120,
      cellRenderer: CrewNameRenderer,
      pinned: 'left'
    },
    {
      headerName: "Rank",
      field: "rank",
      flex: 0.8,
      minWidth: 100,
      cellRenderer: RankRenderer,
      pinned: 'left'
    },
    {
      headerName: "Beneficiary",
      field: "beneficiaryName", 
      flex: 1.2,
      minWidth: 120,
      cellRenderer: BeneficiaryRenderer
    },
    {
      headerName: "Type",
      field: "allotmentType",
      flex: 0.6,
      minWidth: 80,
      cellRenderer: TypeRenderer,
      headerClass: "text-center",
      cellClass: "text-center"
    },
    {
      headerName: "Value",
      field: "value",
      flex: 0.8,
      minWidth: 100,
      cellRenderer: ValueRenderer,
      headerClass: "text-center",
      cellClass: "text-center"
    },
    {
      headerName: "Currency",
      field: "currency",
      flex: 0.6,
      minWidth: 70,
      headerClass: "text-center",
      cellClass: "text-center"
    },
    {
      headerName: "Bank",
      field: "bankName",
      flex: 1.2,
      minWidth: 120,
      cellRenderer: BankRenderer
    },
    {
      headerName: "Priority",
      field: "priority",
      flex: 0.6,
      minWidth: 70,
      cellRenderer: PriorityRenderer,
      headerClass: "text-center",
      cellClass: "text-center"
    },
    {
      headerName: "Valid Period",
      field: "validFrom",
      flex: 1,
      minWidth: 110,
      cellRenderer: ValidPeriodRenderer,
      headerClass: "text-center",
      cellClass: "text-center"
    },
    {
      headerName: "Status",
      field: "status",
      flex: 0.8,
      minWidth: 100,
      cellRenderer: StatusRenderer,
      headerClass: "text-center",
      cellClass: "text-center"
    },
    {
      headerName: "Actions",
      field: "actions",
      flex: 0.6,
      minWidth: 80,
      cellRenderer: ActionsRenderer,
      headerClass: "text-center",
      cellClass: "text-center",
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], []);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          {/* Left - Title and Info */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Allotments Manager</h1>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCopyFromTemplate} className="gap-1">
              <Copy className="w-4 h-4" />
              Copy from Template
            </Button>
            <Button variant="outline" onClick={handleValidateBanks} className="gap-1">
              <CheckCircle className="w-4 h-4" />
              Validate Banks
            </Button>
            <Button onClick={handleGenerateRemittance} className="gap-1">
              <Download className="w-4 h-4" />
              Generate Remittance
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

          <Filter className="w-4 h-4 text-gray-500" />

          <Select value={selectedCrew} onValueChange={setSelectedCrew}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Crew" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Crew</SelectItem>
              {uniqueCrew.map(crew => (
                <SelectItem key={crew.id} value={crew.id}>{crew.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto relative z-20 px-6 py-0">
        <div className="flex items-center justify-end mb-4">
          <Badge variant="outline">{filteredAllotments.length} allotments</Badge>
        </div>
        
        <AgGridTable
          rowData={filteredAllotments}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          suppressRowClickSelection={true}
          animateRows={true}
          autoHeight={false}
          enableSideBar={false}
          enableStatusBar={false}
          className="ag-theme-alpine allotments-manager"
          gridOptions={{
            getRowId: (params: any) => params.data.id,
            headerHeight: 40,
            rowHeight: 48,
            defaultColDef: {
              sortable: true,
              filter: true,
              resizable: true
            },
            noRowsOverlayComponent: () => (
              <div className="text-center py-12 text-gray-500">
                <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No allotments found</p>
                <p className="text-sm">Adjust your filters or add new allotments</p>
              </div>
            )
          }}
        />
      </div>

      {/* Edit Beneficiary Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle>Edit Beneficiary Details</SheetTitle>
            <SheetDescription>
              Update KYC information, bank details, and relationship data
            </SheetDescription>
          </SheetHeader>
          
          {selectedAllotment && (
            <div className="mt-6 space-y-6">
              {/* Allotment Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Allotment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-600">Crew:</span>
                      <div className="font-medium">{selectedAllotment.crewName}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Beneficiary:</span>
                      <div className="font-medium">{selectedAllotment.beneficiaryName}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <div className="font-medium">
                        {selectedAllotment.allotmentType === "percentage" 
                          ? `${selectedAllotment.value}%` 
                          : `${selectedAllotment.currency} ${selectedAllotment.value.toLocaleString()}`
                        }
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Priority:</span>
                      <div className="font-medium">{selectedAllotment.priority}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KYC Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    KYC Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Full Name</Label>
                      <Input 
                        value={beneficiaryDetails.name}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Relationship</Label>
                      <Select value={beneficiaryDetails.relationship}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Spouse">Spouse</SelectItem>
                          <SelectItem value="Parent">Parent</SelectItem>
                          <SelectItem value="Child">Child</SelectItem>
                          <SelectItem value="Sibling">Sibling</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Date of Birth</Label>
                      <Input 
                        type="date"
                        value={beneficiaryDetails.dateOfBirth}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, dateOfBirth: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nationality</Label>
                      <Input 
                        value={beneficiaryDetails.nationality}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, nationality: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">ID Number</Label>
                      <Input 
                        value={beneficiaryDetails.idNumber}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, idNumber: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Address</Label>
                    <Input 
                      value={beneficiaryDetails.address}
                      onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, address: e.target.value})}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Bank Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Bank Name</Label>
                      <Input 
                        value={beneficiaryDetails.bankName}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, bankName: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Account Number</Label>
                      <Input 
                        value={beneficiaryDetails.accountNumber}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, accountNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">SWIFT Code</Label>
                      <Input 
                        value={beneficiaryDetails.swiftCode}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, swiftCode: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">IBAN</Label>
                      <Input 
                        value={beneficiaryDetails.iban}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, iban: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Routing Number</Label>
                      <Input 
                        value={beneficiaryDetails.routingNumber}
                        onChange={(e) => setBeneficiaryDetails({...beneficiaryDetails, routingNumber: e.target.value})}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Validation Status */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Validation Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">KYC Complete</span>
                      <div className="flex items-center gap-2">
                        {selectedAllotment.kycComplete ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="text-sm">
                          {selectedAllotment.kycComplete ? "Complete" : "Incomplete"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Bank Verified</span>
                      <div className="flex items-center gap-2">
                        {selectedAllotment.bankVerified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="text-sm">
                          {selectedAllotment.bankVerified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Percentage Total</span>
                      <div className="flex items-center gap-2">
                        {calculateTotalPercentage(selectedAllotment.crewId) <= 100 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-sm font-mono">
                          {calculateTotalPercentage(selectedAllotment.crewId)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-4">
                <Button onClick={() => setIsDrawerOpen(false)} className="flex-1">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsDrawerOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}