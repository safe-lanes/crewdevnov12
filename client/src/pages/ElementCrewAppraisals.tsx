import {
  EditIcon,
  EyeIcon,
  FilterIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGridTable';
import AgGridTableActions from '@/components/AgGridTableActions';
import { AppraisalForm } from "./AppraisalForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrewMember, AppraisalResult } from "@shared/schema";
import { ModuleNavigator } from "@/components/ModuleNavigator";

// Interface for combined crew member and appraisal data
interface CrewAppraisalData {
  id: string;
  name: { first: string; middle: string; last: string };
  rank: string;
  nationality: string;
  vessel: string;
  vesselType: string;
  signOn: string;
  appraisalType: string;
  appraisalDate: string;
  competenceRating: { value: string; color: string };
  behavioralRating: { value: string; color: string };
  overallRating: { value: string; color: string };
  appraisalId?: number;
}

// Rating badge component - moved outside component to avoid hooks issues
const RatingBadge = ({ value, color }: { value: string; color: string }) => {
  const numValue = parseFloat(value);
  const formattedValue = numValue.toFixed(1);
  let bgColor = '';
  let textColor = '';

  if (numValue >= 4.0) {
    bgColor = 'bg-[#c3f2cb]';
    textColor = 'text-[#286e34]';
  } else if (numValue >= 3.0) {
    bgColor = 'bg-[#ffeaa7]';
    textColor = 'text-[#814c02]';
  } else if (numValue >= 2.0) {
    bgColor = 'bg-[#f9ecef]';
    textColor = 'text-[#811f1a]';
  } else {
    bgColor = 'bg-red-600';
    textColor = 'text-white';
  }

  return (
    <Badge className={`rounded-md px-2.5 py-1 font-bold ${bgColor} ${textColor} min-w-[48px] text-center`}>
      {formattedValue}
    </Badge>
  );
};

// Cell renderers moved outside component to avoid hooks issues
const RatingCellRenderer = (params: ICellRendererParams) => {
  if (params.value === "N/A") {
    return <Badge className="rounded-md px-2.5 py-1 font-bold bg-gray-400 text-white min-w-[48px] text-center">N/A</Badge>;
  }
  return <RatingBadge value={params.value} color={params.data.competenceRating.color} />;
};

const ActionsCellRenderer = (params: ICellRendererParams & { context: { handleEditClick: (data: CrewAppraisalData) => void } }) => {
  return (
    <div className="flex gap-2 justify-center">
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <EyeIcon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => params.context.handleEditClick(params.data)}
      >
        <EditIcon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <Trash2Icon className="h-[18px] w-[18px] text-gray-500" />
      </Button>
    </div>
  );
};

export const ElementCrewAppraisals = (): JSX.Element => {
  const [location, navigate] = useLocation();
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewAppraisalData | null>(null);
  const [showAppraisalForm, setShowAppraisalForm] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    searchName: "",
    rank: "",
    vessel: "",
    vesselType: "",
    nationality: "",
    appraisalType: "",
    rating: ""
  });

  // Fetch crew members and appraisal results
  const { data: crewMembers = [], isLoading: isLoadingCrew } = useQuery<CrewMember[]>({
    queryKey: ["/api/crew-members"],
    queryFn: async () => {
      const response = await fetch("/api/crew-members");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  const { data: appraisalResults = [], isLoading: isLoadingAppraisals } = useQuery<AppraisalResult[]>({
    queryKey: ["/api/appraisals"],
    queryFn: async () => {
      const response = await fetch("/api/appraisals");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
  });

  const handleEditClick = useCallback((crewMember: CrewAppraisalData) => {
    setSelectedCrewMember(crewMember);
    setShowAppraisalForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowAppraisalForm(false);
    setSelectedCrewMember(null);
  }, []);

  const handleModuleChange = useCallback((moduleId: string) => {
    switch (moduleId) {
      case "crewing":
        navigate("/");
        break;
      case "technical-pms":
        navigate("/technical-pms");
        break;
      default:
        navigate("/");
    }
  }, [navigate]);

  // Helper function to get rating color based on value
  const getRatingColor = useCallback((rating: string): string => {
    const numRating = parseFloat(rating);
    if (numRating >= 4.0) return "bg-[#c3f2cb] text-[#286e34]"; // Green
    if (numRating >= 3.0) return "bg-[#ffeaa7] text-[#814c02]"; // Yellow
    if (numRating >= 2.0) return "bg-[#f9ecef] text-[#811f1a]"; // Light Pink
    return "bg-red-600 text-white"; // Dark Red
  }, []);

  // Combine crew member and appraisal data
  const allCrewData: CrewAppraisalData[] = useMemo(() => 
    crewMembers.map((crewMember) => {
      const appraisal = appraisalResults.find(ar => ar.crewMemberId === crewMember.id);

      return {
        id: crewMember.id,
        name: {
          first: crewMember.firstName,
          middle: crewMember.middleName || "",
          last: crewMember.lastName || "",
        },
        rank: crewMember.rank,
        nationality: crewMember.nationality,
        vessel: crewMember.vessel,
        vesselType: crewMember.vesselType,
        signOn: crewMember.signOnDate,
        appraisalType: appraisal?.appraisalType || "Not Started",
        appraisalDate: appraisal?.appraisalDate || "N/A",
        competenceRating: {
          value: appraisal?.competenceRating || "N/A",
          color: appraisal?.competenceRating ? getRatingColor(appraisal.competenceRating) : "bg-gray-400 text-white",
        },
        behavioralRating: {
          value: appraisal?.behavioralRating || "N/A",
          color: appraisal?.behavioralRating ? getRatingColor(appraisal.behavioralRating) : "bg-gray-400 text-white",
        },
        overallRating: {
          value: appraisal?.overallRating || "N/A",
          color: appraisal?.overallRating ? getRatingColor(appraisal.overallRating) : "bg-gray-400 text-white",
        },
        appraisalId: appraisal?.id,
      };
    }), [crewMembers, appraisalResults, getRatingColor]);

  // Filter crew data based on filter state
  const crewData = useMemo(() => 
    allCrewData.filter((crew) => {
      const fullName = `${crew.name.first} ${crew.name.middle} ${crew.name.last}`.toLowerCase();

      // Name search filter
      if (filters.searchName && !fullName.includes(filters.searchName.toLowerCase())) {
        return false;
      }

      // Rank filter
      if (filters.rank && crew.rank.toLowerCase() !== filters.rank.toLowerCase()) {
        return false;
      }

      // Vessel filter
      if (filters.vessel && crew.vessel.toLowerCase() !== filters.vessel.toLowerCase()) {
        return false;
      }

      // Vessel type filter
      if (filters.vesselType && crew.vesselType.toLowerCase() !== filters.vesselType.toLowerCase()) {
        return false;
      }

      // Nationality filter
      if (filters.nationality && crew.nationality.toLowerCase() !== filters.nationality.toLowerCase()) {
        return false;
      }

      // Appraisal type filter
      if (filters.appraisalType && crew.appraisalType.toLowerCase() !== filters.appraisalType.toLowerCase()) {
        return false;
      }

      // Rating filter
      if (filters.rating && crew.overallRating.value !== "N/A") {
        const rating = parseFloat(crew.overallRating.value);
        if (filters.rating === "high" && rating < 4.0) return false;
        if (filters.rating === "medium" && (rating < 3.0 || rating >= 4.0)) return false;
        if (filters.rating === "low" && rating >= 3.0) return false;
      }

      return true;
    }), [allCrewData, filters]);

  // Column definitions for AG Grid with Enterprise features
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Crew ID',
      field: 'id',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left'
    },
    {
      headerName: 'Name',
      field: 'fullName',
      width: 180,
      valueGetter: (params) => `${params.data.name.first} ${params.data.name.middle} ${params.data.name.last}`,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left'
    },
    {
      headerName: 'Rank',
      field: 'rank',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Vessel',
      field: 'vessel',
      width: 140,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Vessel Type',
      field: 'vesselType',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Sign-On',
      field: 'signOn',
      width: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Appraisal Type',
      field: 'appraisalType',
      width: 130,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Appraisal Date',
      field: 'appraisalDate',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Competence Rating',
      field: 'competenceRating.value',
      width: 140,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg'
    },
    {
      headerName: 'Behavioral Rating',
      field: 'behavioralRating.value',
      width: 140,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg'
    },
    {
      headerName: 'Overall Rating',
      field: 'overallRating.value',
      width: 130,
      cellRenderer: RatingCellRenderer,
      cellClass: 'flex items-center justify-center',
      filter: 'agNumberColumnFilter',
      sortable: true,
      resizable: true,
      enableValue: true,
      aggFunc: 'avg'
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 100,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center',
      pinned: 'right',
      lockPosition: true
    }
  ], []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  // Early return after all hooks
  if (isLoadingCrew || isLoadingAppraisals) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading crew appraisals...</div>
      </div>
    );
  }

  return (
    <div className="bg-transparent flex flex-row justify-center w-full">
      <div className="overflow-hidden bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%] w-[1440px] h-[900px] relative">
        {/* Header */}
        <header className="w-full h-[67px] bg-[#E8E8E8] border-b-2 border-[#5DADE2]">
          <div className="flex items-center h-full">
            {/* Logo */}
            <div className="flex items-center ml-4">
              <img
                className="w-14 h-10"
                alt="Logo"
                src="/figmaAssets/group-2.png"
              />
            </div>

            {/* Navigation Menu */}
            <nav className="flex ml-8">
              {/* Module Navigator */}
              <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#E8E8E8] border-r border-gray-300">
                <ModuleNavigator 
                  currentModule="crewing" 
                  onModuleChange={handleModuleChange}
                />
              </div>

              {/* Crewing Section */}
              <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#E8E8E8] border-r border-gray-300">
                <div className="w-6 h-6 mb-1">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" rx="1" fill="#6B7280"/>
                    <rect x="14" y="3" width="7" height="7" rx="1" fill="#6B7280"/>
                    <rect x="3" y="14" width="7" height="7" rx="1" fill="#6B7280"/>
                    <rect x="14" y="14" width="7" height="7" rx="1" fill="#6B7280"/>
                  </svg>
                </div>
                <div className="text-[#4f5863] text-[10px] font-normal font-['Mulish',Helvetica]">
                  Crewing
                </div>
              </div>

              {/* Appraisals Section (Active) */}
              <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#5DADE2] border-r border-gray-300">
                <div className="w-6 h-6 mb-1">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white"/>
                    <path d="M14 2V8H20" fill="white"/>
                    <path d="M16 11H8V13H16V11Z" fill="#5DADE2"/>
                    <path d="M16 15H8V17H16V15Z" fill="#5DADE2"/>
                  </svg>
                </div>
                <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica]">
                  Appraisals
                </div>
              </div>

              {/* Admin Section */}
              <Link href="/admin">
                <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#E8E8E8] cursor-pointer hover:bg-gray-300">
                  <div className="w-6 h-6 mb-1">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 1L15.09 8.26L23 9L17 14.74L18.18 22.02L12 19L5.82 22.02L7 14.74L1 9L8.91 8.26L12 1Z" fill="#6B7280"/>
                    </svg>
                  </div>
                  <div className="text-[#4f5863] text-[10px] font-normal font-['Mulish',Helvetica]">
                    Admin
                  </div>
                </div>
              </Link>
            </nav>
          </div>
        </header>

        {/* Left Sidebar */}
        <aside className="w-[67px] absolute left-0 top-[67px] h-[calc(100vh-67px)]">
          {/* All Section (Active) */}
          <div className="w-full h-[79px] flex flex-col items-center justify-center cursor-pointer bg-[#52baf3]">
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" fill="white"/>
              </svg>
            </div>
            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica]">
              All
            </div>
          </div>
          
          {/* Dark blue section for rest of sidebar */}
          <div className="w-full h-[calc(100%-79px)] bg-[#16569e]">
          </div>
        </aside>

        {/* Main Content */}
        <main className="ml-[67px] h-[833px] px-6 py-2 bg-[#f8fafc]">
          <div className="flex flex-col h-full">
            {/* Top section with title and custom filter toggle */}
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-black">Crew Appraisals</h1>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="h-8 w-32 text-[#8798ad] text-xs border-[#e1e8ed]"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <FilterIcon className="h-3 w-3 mr-1" />
                  Toggle Filters
                </Button>
              </div>
            </div>

            {/* Filters Section */}
            {showFilters && (
              <div className="flex flex-wrap gap-4 mb-4 p-4 bg-[#f7fafc] rounded-lg">
                <div className="flex gap-4 flex-wrap">
                  <Input
                    placeholder="Search by name..."
                    className="h-8 w-48 text-[11px]"
                    value={filters.searchName}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                  />

                  <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                    <SelectTrigger className="h-8 w-32 text-[11px]">
                      <SelectValue placeholder="Rank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Captain">Captain</SelectItem>
                      <SelectItem value="Chief Officer">Chief Officer</SelectItem>
                      <SelectItem value="Second Officer">Second Officer</SelectItem>
                      <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                      <SelectItem value="Second Engineer">Second Engineer</SelectItem>
                      <SelectItem value="Third Engineer">Third Engineer</SelectItem>
                      <SelectItem value="Bosun">Bosun</SelectItem>
                      <SelectItem value="AB">AB</SelectItem>
                      <SelectItem value="OS">OS</SelectItem>
                      <SelectItem value="Cook">Cook</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.vessel} onValueChange={(value) => setFilters(prev => ({ ...prev, vessel: value }))}>
                    <SelectTrigger className="h-8 w-32 text-[11px]">
                      <SelectValue placeholder="Vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MV Ocean Star">MV Ocean Star</SelectItem>
                      <SelectItem value="MV Sea Explorer">MV Sea Explorer</SelectItem>
                      <SelectItem value="MV Atlantic Queen">MV Atlantic Queen</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="h-8 w-32 text-[11px]">
                      <SelectValue placeholder="Vessel Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Container">Container</SelectItem>
                      <SelectItem value="Bulk Carrier">Bulk Carrier</SelectItem>
                      <SelectItem value="Tanker">Tanker</SelectItem>
                      <SelectItem value="General Cargo">General Cargo</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="h-8 w-32 text-[11px]">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Philippines">Philippines</SelectItem>
                      <SelectItem value="India">India</SelectItem>
                      <SelectItem value="Ukraine">Ukraine</SelectItem>
                      <SelectItem value="Romania">Romania</SelectItem>
                      <SelectItem value="Poland">Poland</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.appraisalType} onValueChange={(value) => setFilters(prev => ({ ...prev, appraisalType: value }))}>
                    <SelectTrigger className="h-8 w-32 text-[11px]">
                      <SelectValue placeholder="Appraisal Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mid-Contract">Mid-Contract</SelectItem>
                      <SelectItem value="End-Contract">End-Contract</SelectItem>
                      <SelectItem value="Annual">Annual</SelectItem>
                      <SelectItem value="Promotion">Promotion</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.rating} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}>
                    <SelectTrigger className="h-8 w-32 text-[11px]">
                      <SelectValue placeholder="Rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High (4-5)</SelectItem>
                      <SelectItem value="medium">Medium (3-4)</SelectItem>
                      <SelectItem value="low">Low (1-3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button className="h-8 w-20 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]">
                    Apply
                  </Button>

                  <Button
                    variant="outline"
                    className="h-8 w-20 text-[#8798ad] text-xs border-[#e1e8ed]"
                    onClick={() => setFilters({
                      searchName: "",
                      rank: "",
                      vessel: "",
                      vesselType: "",
                      nationality: "",
                      appraisalType: "",
                      rating: ""
                    })}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* AG Grid Enterprise Table with Actions */}
            <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
              <CardContent className="p-4 bg-[#f7fafc]">
                <AgGridTable
                  rowData={crewData}
                  columnDefs={columnDefs}
                  onGridReady={onGridReady}
                  context={{ handleEditClick }}
                  height="650px"
                  width="100%"
                  enableExport={true}
                  enableSideBar={false}
                  enableStatusBar={false}
                  enableRowGrouping={true}
                  enablePivoting={true}
                  enableAdvancedFilter={false}
                  rowSelection="single"
                  theme="alpine"
                />
                
                {/* Custom footer within the table area */}
                <div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
                  <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
                    Rows: {crewData.length > 0 ? crewData.length : 0}
                  </div>
                  <div>
                    <AgGridTableActions 
                      gridApi={gridApi}
                      exportFilename="crew-appraisals"
                      showExportButtons={true}
                      showFilterButtons={true}
                      showGroupButtons={true}
                      showSelectionButtons={false}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>


          </div>
        </main>
      </div>
      {/* Appraisal Form Modal */}
      {showAppraisalForm && selectedCrewMember && (
        <AppraisalForm
          crewMember={selectedCrewMember}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
};