import {
  EditIcon,
  EyeIcon,
  FilterIcon,
  Trash2Icon,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
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
import SectionTitleComponents from "@/components/Section/SectionTitleComponents";
import SideBarComponent from "@/components/Navbar/SideBarComponent";
import MainLayout from "@/components/main/MainLayout";
import HeaderComponent from "@/components/Navbar/HeaderComponent";
import ScompFiltersRow from "@/components/filters/ScompFiltersRow";

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
  const [selectedAdminPage, setSelectedAdminPage] = useState("all");
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

  const handleApplyFilters = useCallback(() => {
    // Apply filters - filters are already applied in the useMemo
    console.log('Filters applied:', filters);
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters({
      searchName: "",
      rank: "",
      vessel: "",
      vesselType: "",
      nationality: "",
      appraisalType: "",
      rating: ""
    });
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
    <>
      {/* SCOMP Header with Toggle Filters Button */}
      <HeaderComponent 
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
      />
      
      {/* SCOMP Sidebar */}
      <SideBarComponent 
        selectedAdminPage={selectedAdminPage} 
        setSelectedAdminPage={setSelectedAdminPage} 
        allowedPages={["all"]} 
      />
      
      {/* SCOMP Filters Row */}
      <ScompFiltersRow
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={handleClearFilters}
        onApplyFilters={handleApplyFilters}
        showFilters={showFilters}
      />
      
      <MainLayout>
        {/* SCOMP Screen Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[#1a202c] font-['Roboto',Helvetica]">
            Crew Appraisals
          </h1>
        </div>

        {/* SCOMP AG Grid Table */}
        <Card className="border-0 shadow-sm bg-white rounded-lg">
          <CardContent className="p-0 bg-white">
            <AgGridTable
              rowData={crewData}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
              context={{ handleEditClick }}
              autoHeight={true}
              maxHeight="500px"
              minHeight="200px"
              width="100%"
              enableExport={true}
              enableSideBar={false}
              enableStatusBar={false}
              enableRowGrouping={true}
              enablePivoting={true}
              enableAdvancedFilter={false}
              rowSelection={false}
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
        {/* Appraisal Form Modal */}
        {showAppraisalForm && selectedCrewMember && (
          <AppraisalForm
            crewMember={selectedCrewMember}
            onClose={handleCloseForm}
          />
        )}
      </MainLayout>
    </>
  );
};