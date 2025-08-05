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
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
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

  const handleModuleChange = (moduleId: string) => {
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
  };

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

  const handleEditClick = (crewMember: CrewAppraisalData) => {
    setSelectedCrewMember(crewMember);
    setShowAppraisalForm(true);
  };

  const handleCloseForm = () => {
    setShowAppraisalForm(false);
    setSelectedCrewMember(null);
  };

  // Helper function to get rating color based on value
  const getRatingColor = (rating: string): string => {
    const numRating = parseFloat(rating);
    if (numRating >= 4.0) return "bg-[#c3f2cb] text-[#286e34]"; // Green
    if (numRating >= 3.0) return "bg-[#ffeaa7] text-[#814c02]"; // Yellow
    if (numRating >= 2.0) return "bg-[#f9ecef] text-[#811f1a]"; // Light Pink
    return "bg-red-600 text-white"; // Dark Red
  };

  // Combine crew member and appraisal data
  const allCrewData: CrewAppraisalData[] = crewMembers.map((crewMember) => {
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
  });

  // Filter crew data based on filter state
  const crewData = allCrewData.filter((crew) => {
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
  });

  if (isLoadingCrew || isLoadingAppraisals) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading crew appraisals...</div>
      </div>
    );
  }





  const handleEditClickCallback = useCallback((data: CrewAppraisalData) => {
    handleEditClick(data);
  }, []);

  // Column definitions for AG Grid
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Crew ID',
      field: 'id',
      width: 100,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Name',
      field: 'fullName',
      width: 180,
      valueGetter: (params) => `${params.data.name.first} ${params.data.name.middle} ${params.data.name.last}`,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Rank',
      field: 'rank',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Vessel',
      field: 'vessel',
      width: 140,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Vessel Type',
      field: 'vesselType',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Sign-On',
      field: 'signOn',
      width: 110,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Appraisal Type',
      field: 'appraisalType',
      width: 130,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Appraisal Date',
      field: 'appraisalDate',
      width: 120,
      cellStyle: { fontSize: '13px', color: '#4f5863' }
    },
    {
      headerName: 'Competence Rating',
      field: 'competenceRating.value',
      width: 140,
      cellRenderer: RatingCellRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Behavioral Rating',
      field: 'behavioralRating.value',
      width: 140,
      cellRenderer: RatingCellRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Overall Rating',
      field: 'overallRating.value',
      width: 130,
      cellRenderer: RatingCellRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
    },
    {
      headerName: 'Actions',
      field: 'actions',
      width: 100,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
    }
  ], []);

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
  };

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

            {/* User Profile */}
            <div className="absolute top-2.5 right-[38px]">
              <img
                className="w-[38px] h-[37px]"
                alt="User"
                src="/figmaAssets/group-3.png"
              />
            </div>
          </div>
        </header>

        {/* Left sidebar */}
        <aside className="w-[67px] absolute left-0 top-[66px] h-[calc(100vh-66px)]">
          {/* Light blue section with icon and "All" text */}
          <div className="w-full h-[79px] flex flex-col items-center justify-center bg-[#52baf3]">
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="white"/>
                <path d="M19 15L19.74 17.74L22 18L19.74 18.26L19 21L18.26 18.26L16 18L18.26 17.74L19 15Z" fill="white"/>
                <path d="M5 6L5.5 7.5L7 8L5.5 8.5L5 10L4.5 8.5L3 8L4.5 7.5L5 6Z" fill="white"/>
              </svg>
            </div>
            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica]">
              All
            </div>
          </div>

          {/* Dark blue section */}
          <div className="w-full h-[calc(100%-79px)] bg-[#16569e]">
          </div>
        </aside>

        {/* Main content */}
        <main className="absolute top-[67px] left-[67px] w-[calc(100%-67px)] h-[calc(100%-67px)]">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-['Mulish',Helvetica] font-bold text-black text-[22px] ml-[19px] mr-[19px]">
                Crew Appraisals
              </h1>
              <Button
                variant="outline"
                className="h-10 border-[#e1e8ed] text-[#16569e] flex items-center gap-2 ml-[19px] mr-[19px]"
                onClick={() => setShowFilters(!showFilters)}
              >
                <FilterIcon className="w-4 h-4" />
                <span className="text-sm">Filters</span>
              </Button>
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="flex justify-between items-center gap-2 mb-6 ml-4 mr-4">
                <div className="flex gap-2">
                  <div className="relative w-[180px]">
                    <Input
                      className="h-8 pl-10 text-[#8798ad] text-xs"
                      placeholder="Search Name"
                      value={filters.searchName}
                      onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
                    />
                    <SearchIcon className="w-4 h-4 absolute left-3 top-2 text-[#8798ad]" />
                  </div>

                  <Select value={filters.rank} onValueChange={(value) => setFilters(prev => ({ ...prev, rank: value }))}>
                    <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs">
                      <SelectValue placeholder="Rank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Master">Master</SelectItem>
                      <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                      <SelectItem value="Chief Mate">Chief Mate</SelectItem>
                      <SelectItem value="Able Seaman">Able Seaman</SelectItem>
                      <SelectItem value="Electrician">Electrician</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.vessel} onValueChange={(value) => setFilters(prev => ({ ...prev, vessel: value }))}>
                    <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs">
                      <SelectValue placeholder="Vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MV Atlantic Star">MV Atlantic Star</SelectItem>
                      <SelectItem value="MV Pacific Dawn">MV Pacific Dawn</SelectItem>
                      <SelectItem value="MV Northern Light">MV Northern Light</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                    <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs">
                      <SelectValue placeholder="Vessel type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Oil Tanker">Oil Tanker</SelectItem>
                      <SelectItem value="LPG Tanker">LPG Tanker</SelectItem>
                      <SelectItem value="Container">Container</SelectItem>
                      <SelectItem value="Bulk">Bulk</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                    <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs">
                      <SelectValue placeholder="Nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="British">British</SelectItem>
                      <SelectItem value="Indian">Indian</SelectItem>
                      <SelectItem value="Philippines">Philippines</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.appraisalType} onValueChange={(value) => setFilters(prev => ({ ...prev, appraisalType: value }))}>
                    <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs">
                      <SelectValue placeholder="Appraisal Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="End of Contract">End of Contract</SelectItem>
                      <SelectItem value="Mid Term">Mid Term</SelectItem>
                      <SelectItem value="Special">Special</SelectItem>
                      <SelectItem value="Probation">Probation</SelectItem>
                      <SelectItem value="Appraiser SCOT">Appraiser SCOT</SelectItem>
                      <SelectItem value="Not Started">Not Started</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.rating} onValueChange={(value) => setFilters(prev => ({ ...prev, rating: value }))}>
                    <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs">
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



            {/* AG Grid Table */}
            <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
              <CardContent className="p-4 bg-[#f7fafc]">
                <div className="ag-theme-alpine bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '500px', width: '100%' }}>
                  <AgGridReact
                    rowData={crewData}
                    columnDefs={columnDefs}
                    onGridReady={onGridReady}
                    context={{ handleEditClick: handleEditClickCallback }}
                    defaultColDef={{
                      sortable: true,
                      filter: true,
                      resizable: true
                    }}
                    headerHeight={50}
                    rowHeight={50}
                    suppressHorizontalScroll={false}
                    suppressRowClickSelection={true}
                    animateRows={true}
                    rowSelection="single"
                    getRowStyle={() => ({ backgroundColor: 'white' })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            <div className="mt-4 text-xs font-normal font-['Mulish',Helvetica] text-black">
              {crewData.length > 0 ? `1 to ${crewData.length} of ${crewData.length}` : "0 to 0 of 0"}
            </div>
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