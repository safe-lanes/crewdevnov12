import React, { useState, useMemo, useCallback } from 'react';
import { FilterIcon, PlusIcon, PaperclipIcon, EditIcon, Trash2Icon } from 'lucide-react';
import { ColDef, GridReadyEvent, GridApi, ICellRendererParams } from 'ag-grid-community';
import MainLayout from '../../components/main/MainLayout';
import RecruitmentSideBar from './RecruitmentSideBar';
import { RecruitmentApplicationForm } from './RecruitmentApplicationForm';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Interface for recruitment candidate data
interface RecruitmentCandidate {
  id: string;
  fileNo: string;
  firstName: string;
  middleName: string;
  familyName: string;
  dob: string;
  nationality: string;
  rankAppliedFor: string;
  presentRank: string;
  vesselType: string;
  status: string;
}

// Sample recruitment candidate data with all statuses
const sampleRecruitmentData: RecruitmentCandidate[] = [
  // In Progress entries
  {
    id: "2025-03-14",
    fileNo: "2025-05-14",
    firstName: "James",
    middleName: "Michael",
    familyName: "Smith",
    dob: "1985-06-15",
    nationality: "British",
    rankAppliedFor: "Captain",
    presentRank: "First Officer",
    vesselType: "Oil Tanker",
    status: "Applied"
  },
  {
    id: "2025-03-12",
    fileNo: "2025-03-12",
    firstName: "Anna",
    middleName: "Marie",
    familyName: "Johnson",
    dob: "1990-11-22",
    nationality: "British",
    rankAppliedFor: "Chief Engineer",
    presentRank: "Second Engineer",
    vesselType: "LPG Tanker",
    status: "Screening"
  },
  {
    id: "2025-02-12",
    fileNo: "2025-02-12",
    firstName: "David",
    middleName: "Lee",
    familyName: "Brown",
    dob: "1980-02-10",
    nationality: "Indian",
    rankAppliedFor: "Able Seaman",
    presentRank: "Deck Cadet",
    vesselType: "Container",
    status: "For Approval"
  },
  // Recruited entries
  {
    id: "2024-12-15",
    fileNo: "2024-12-15",
    firstName: "Michael",
    middleName: "Robert",
    familyName: "Thompson",
    dob: "1988-03-20",
    nationality: "British",
    rankAppliedFor: "Second Officer",
    presentRank: "Third Officer",
    vesselType: "Container",
    status: "Recruited"
  },
  {
    id: "2024-11-08",
    fileNo: "2024-11-08",
    firstName: "Sarah",
    middleName: "Elizabeth",
    familyName: "Wilson",
    dob: "1987-09-12",
    nationality: "Indian",
    rankAppliedFor: "Third Engineer",
    presentRank: "Fourth Engineer",
    vesselType: "Bulk",
    status: "Recruited"
  },
  {
    id: "2024-10-22",
    fileNo: "2024-10-22",
    firstName: "Carlos",
    middleName: "Antonio",
    familyName: "Rodriguez",
    dob: "1991-01-30",
    nationality: "Philippines",
    rankAppliedFor: "Bosun",
    presentRank: "AB",
    vesselType: "Oil Tanker",
    status: "Recruited"
  },
  // Waitlisted entries
  {
    id: "2025-01-18",
    fileNo: "2025-01-18",
    firstName: "Lisa",
    middleName: "Anne",
    familyName: "Anderson",
    dob: "1989-07-25",
    nationality: "Romanian",
    rankAppliedFor: "Cook",
    presentRank: "Assistant Cook",
    vesselType: "General Cargo",
    status: "Waitlisted"
  },
  {
    id: "2025-01-05",
    fileNo: "2025-01-05",
    firstName: "Ahmed",
    middleName: "Hassan",
    familyName: "Ali",
    dob: "1986-11-14",
    nationality: "Indian",
    rankAppliedFor: "Chief Mate",
    presentRank: "Second Mate",
    vesselType: "Container",
    status: "Waitlisted"
  },
  // Rejected entries
  {
    id: "2025-02-01",
    fileNo: "2025-02-01",
    firstName: "Peter",
    middleName: "James",
    familyName: "Clarke",
    dob: "1983-05-17",
    nationality: "British",
    rankAppliedFor: "Captain",
    presentRank: "Chief Officer",
    vesselType: "LPG Tanker",
    status: "Rejected"
  },
  {
    id: "2025-01-20",
    fileNo: "2025-01-20",
    firstName: "Maria",
    middleName: "Santos",
    familyName: "Garcia",
    dob: "1992-12-03",
    nationality: "Philippines",
    rankAppliedFor: "Second Engineer",
    presentRank: "Third Engineer",
    vesselType: "Bulk",
    status: "Rejected"
  }
];

export const RecruitmentModule = (): JSX.Element => {
  const [selectedRecruitmentPage, setSelectedRecruitmentPage] = useState("in-progress");
  const [showFilters, setShowFilters] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<RecruitmentCandidate | null>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // Define allowed pages for the recruitment module
  const allowedPages = ["in-progress", "recruited", "waitlist", "rejected"];

  // Filter state
  const [filters, setFilters] = useState({
    searchName: "",
    rankAppliedFor: "",
    vesselType: "",
    nationality: "",
    status: ""
  });

  // Actions cell renderer
  const ActionsCellRenderer = useCallback((params: ICellRendererParams) => {
    const handleAttachmentClick = () => {
      console.log('Attachment clicked for:', params.data.id);
    };

    const handleEditClick = () => {
      console.log('Edit clicked for:', params.data.id);
      setSelectedCandidate(params.data);
      setShowApplicationForm(true);
    };

    const handleDeleteClick = () => {
      console.log('Delete clicked for:', params.data.id);
    };

    return (
      <div className="flex items-center justify-center gap-1 h-full">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleAttachmentClick}
        >
          <PaperclipIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-gray-100"
          onClick={handleEditClick}
        >
          <EditIcon className="h-4 w-4 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-red-100"
          onClick={handleDeleteClick}
        >
          <Trash2Icon className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }, []);

  // Column definitions for AG Grid
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'File No',
      field: 'fileNo',
      flex: 0.8,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true,
      pinned: 'left'
    },
    {
      headerName: 'First Name',
      field: 'firstName',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Middle Name',
      field: 'middleName',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Family Name',
      field: 'familyName',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agTextColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'DOB',
      field: 'dob',
      flex: 0.9,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agDateColumnFilter',
      sortable: true,
      resizable: true
    },
    {
      headerName: 'Nationality',
      field: 'nationality',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Rank Applied for',
      field: 'rankAppliedFor',
      flex: 1.2,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Present Rank',
      field: 'presentRank',
      flex: 1.1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Vessel Type',
      field: 'vesselType',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Status',
      field: 'status',
      flex: 1,
      cellStyle: { fontSize: '13px', color: '#4f5863' },
      filter: 'agSetColumnFilter',
      sortable: true,
      resizable: true,
      enableRowGroup: false
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 0.8,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      cellClass: 'flex items-center justify-center',
      pinned: 'right',
      lockPosition: true
    }
  ], [ActionsCellRenderer]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    params.api.sizeColumnsToFit();
    
    const handleResize = () => {
      setTimeout(() => {
        params.api.sizeColumnsToFit();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Filter the recruitment data based on selected page and filters
  const filteredData = useMemo(() => {
    // First filter by page status
    let pageFilteredData = sampleRecruitmentData;
    
    switch (selectedRecruitmentPage) {
      case "in-progress":
        pageFilteredData = sampleRecruitmentData.filter(candidate => 
          ["Applied", "Screening", "For Approval"].includes(candidate.status)
        );
        break;
      case "recruited":
        pageFilteredData = sampleRecruitmentData.filter(candidate => 
          candidate.status === "Recruited"
        );
        break;
      case "waitlist":
        pageFilteredData = sampleRecruitmentData.filter(candidate => 
          candidate.status === "Waitlisted"
        );
        break;
      case "rejected":
        pageFilteredData = sampleRecruitmentData.filter(candidate => 
          candidate.status === "Rejected"
        );
        break;
    }
    
    // Then apply additional filters
    return pageFilteredData.filter(candidate => {
      const matchesName = filters.searchName === "" || 
        `${candidate.firstName} ${candidate.middleName} ${candidate.familyName}`
          .toLowerCase().includes(filters.searchName.toLowerCase());
      const matchesRank = filters.rankAppliedFor === "" || candidate.rankAppliedFor === filters.rankAppliedFor;
      const matchesVesselType = filters.vesselType === "" || candidate.vesselType === filters.vesselType;
      const matchesNationality = filters.nationality === "" || candidate.nationality === filters.nationality;
      const matchesStatus = filters.status === "" || candidate.status === filters.status;
      
      return matchesName && matchesRank && matchesVesselType && matchesNationality && matchesStatus;
    });
  }, [selectedRecruitmentPage, filters]);

  const getTitle = () => {
    switch (selectedRecruitmentPage) {
      case "in-progress":
        return "In Progress";
      case "recruited":
        return "Recruited";
      case "waitlist":
        return "Waitlist";
      case "rejected":
        return "Rejected";
      default:
        return "In Progress";
    }
  };

  const renderFiltersAndTable = () => {
    const getStatusOptions = () => {
      switch (selectedRecruitmentPage) {
        case "in-progress":
          return [
            <SelectItem key="applied" value="Applied">Applied</SelectItem>,
            <SelectItem key="screening" value="Screening">Screening</SelectItem>,
            <SelectItem key="for-approval" value="For Approval">For Approval</SelectItem>
          ];
        case "recruited":
          return [<SelectItem key="recruited" value="Recruited">Recruited</SelectItem>];
        case "waitlist":
          return [<SelectItem key="waitlisted" value="Waitlisted">Waitlisted</SelectItem>];
        case "rejected":
          return [<SelectItem key="rejected" value="Rejected">Rejected</SelectItem>];
        default:
          return [];
      }
    };

    return (
      <>
        {/* Filters Section */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 mb-4 p-4 pl-0 bg-[#f7fafc] rounded-lg">
            <div className="flex gap-4 flex-wrap">
              <Input
                placeholder="Search Name..."
                className="h-8 w-48 text-xs font-normal text-[#0f172a] placeholder:text-[#8899ae]"
                value={filters.searchName}
                onChange={(e) => setFilters(prev => ({ ...prev, searchName: e.target.value }))}
              />

              <Select value={filters.rankAppliedFor} onValueChange={(value) => setFilters(prev => ({ ...prev, rankAppliedFor: value }))}>
                <SelectTrigger className="h-8 w-40 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Rank Applied for" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Captain">Captain</SelectItem>
                  <SelectItem value="Chief Engineer">Chief Engineer</SelectItem>
                  <SelectItem value="Chief Mate">Chief Mate</SelectItem>
                  <SelectItem value="First Officer">First Officer</SelectItem>
                  <SelectItem value="Second Officer">Second Officer</SelectItem>
                  <SelectItem value="Second Engineer">Second Engineer</SelectItem>
                  <SelectItem value="Third Engineer">Third Engineer</SelectItem>
                  <SelectItem value="Able Seaman">Able Seaman</SelectItem>
                  <SelectItem value="Electrician">Electrician</SelectItem>
                  <SelectItem value="Bosun">Bosun</SelectItem>
                  <SelectItem value="Cook">Cook</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.vesselType} onValueChange={(value) => setFilters(prev => ({ ...prev, vesselType: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Vessel Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Container">Container</SelectItem>
                  <SelectItem value="Bulk">Bulk</SelectItem>
                  <SelectItem value="Oil Tanker">Oil Tanker</SelectItem>
                  <SelectItem value="LPG Tanker">LPG Tanker</SelectItem>
                  <SelectItem value="General Cargo">General Cargo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.nationality} onValueChange={(value) => setFilters(prev => ({ ...prev, nationality: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Nationality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="British">British</SelectItem>
                  <SelectItem value="Indian">Indian</SelectItem>
                  <SelectItem value="Philippines">Philippines</SelectItem>
                  <SelectItem value="Ukrainian">Ukrainian</SelectItem>
                  <SelectItem value="Romanian">Romanian</SelectItem>
                  <SelectItem value="Polish">Polish</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="h-8 w-32 text-xs text-[#0f172a] placeholder:text-[#8899ae]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {getStatusOptions()}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button className="h-8 w-20 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]">
                Apply
              </Button>

              <Button 
                variant="outline" 
                className="h-8 w-16 text-[#8798ad] text-[11px] border-[#e1e8ed]"
                onClick={() => setFilters({ searchName: "", rankAppliedFor: "", vesselType: "", nationality: "", status: "" })}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* AG Grid Table */}
        <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
          <CardContent className="p-4 pl-0 bg-[#f7fafc]">
            <AgGridTable
              rowData={filteredData}
              columnDefs={columnDefs}
              onGridReady={onGridReady}
              autoHeight={true}
              maxHeight="500px"
              minHeight="200px"
              width="100%"
              enableExport={true}
              enableSideBar={true}
              enableStatusBar={false}
              enableRowGrouping={true}
              enablePivoting={true}
              enableAdvancedFilter={false}
              rowSelection={false}
            />
          </CardContent>
        </Card>
      </>
    );
  };

  const renderContent = () => {
    if (["in-progress", "recruited", "waitlist", "rejected"].includes(selectedRecruitmentPage)) {
      return renderFiltersAndTable();
    }
    
    return (
      <div className="p-6 text-center text-gray-600">
        Content for {getTitle()} will be implemented in future iterations.
      </div>
    );
  };

  return (
    <>
      <RecruitmentSideBar 
        selectedRecruitmentPage={selectedRecruitmentPage}
        setSelectedRecruitmentPage={setSelectedRecruitmentPage}
        allowedPages={allowedPages}
      />
      <MainLayout>
        <SectionTitleComponents title={getTitle()}>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 w-32 text-[#8798ad] text-xs border-[#e1e8ed]"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="h-3 w-3 mr-1" />
              Filters
            </Button>
            <Button
              className="h-8 w-32 bg-[#28a745] hover:bg-[#218838] text-xs text-white"
            >
              <PlusIcon className="h-3 w-3 mr-1" />
              New Crew
            </Button>
          </div>
        </SectionTitleComponents>
        {renderContent()}
      </MainLayout>

      {/* Recruitment Application Form Popup */}
      {showApplicationForm && selectedCandidate && (
        <RecruitmentApplicationForm
          candidate={selectedCandidate}
          onClose={() => {
            setShowApplicationForm(false);
            setSelectedCandidate(null);
          }}
        />
      )}
    </>
  );
};