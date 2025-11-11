import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostIncidentTestData {
  id: number;
  vesselId: string;
  vesselName: string;
  incidentTitle: string;
  incidentDateTime: string;
  alcoholTestDateTime: string;
  alcoholTestPeriod: string;
  drugTestDateTime: string;
  drugTestPeriod: string;
  violations: number;
}

interface PostIncidentTestTableProps {
  filterType: "vessel" | "fleet" | "addGroup";
  selectedVessels: string[];
  fleetValue: string;
  addGroupValue: string;
  onAdd?: () => void;
}

// Calculate time difference in hours between two datetime strings
// Format: "31 May 2023 - 1010 Hours"
function calculateHoursDifference(incidentDateTime: string, testDateTime: string): string {
  try {
    // Parse the datetime string format: "31 May 2023 - 1010 Hours"
    const parseDateTime = (dtStr: string): Date => {
      const [datePart, timePart] = dtStr.split(' - ');
      const [day, month, year] = datePart.split(' ');
      const hours = timePart.replace(' Hours', '');
      
      const monthMap: { [key: string]: number } = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const monthNum = monthMap[month];
      const hour = parseInt(hours.substring(0, 2));
      const minute = parseInt(hours.substring(2));
      
      return new Date(parseInt(year), monthNum, parseInt(day), hour, minute);
    };
    
    const incidentDate = parseDateTime(incidentDateTime);
    const testDate = parseDateTime(testDateTime);
    
    const diffMs = testDate.getTime() - incidentDate.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    return `${diffHours} Hours`;
  } catch (error) {
    return 'N/A';
  }
}

// Violations cell renderer with color coding
const ViolationsCellRenderer = (props: ICellRendererParams) => {
  const value = props.value || 0;
  let colorClass = "text-green-600 dark:text-green-400";
  
  if (value === 1) {
    colorClass = "text-orange-600 dark:text-orange-400";
  } else if (value >= 2) {
    colorClass = "text-red-600 dark:text-red-400";
  }
  
  return (
    <div className={`font-semibold ${colorClass}`}>
      {value}
    </div>
  );
};

// Actions cell renderer
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { onAdd } = props.context || {};
  
  const handleAdd = () => {
    if (onAdd) {
      onAdd();
    }
  };
  
  return (
    <div className="flex items-center justify-center h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-green-100"
        onClick={handleAdd}
        data-testid={`button-add-${props.data.id}`}
      >
        <Plus className="h-4 w-4 text-green-600" />
      </Button>
    </div>
  );
};

export function PostIncidentTestTable({
  filterType,
  selectedVessels,
  fleetValue,
  addGroupValue,
  onAdd,
}: PostIncidentTestTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  
  // Fetch vessel master data for name mapping
  const { data: vessels } = useQuery<Array<{ entryId: string; name: string }>>({
    queryKey: ['/api/masters/014/data'],
  });
  
  // Fetch drug alcohol test records
  const { data: testRecords } = useQuery<Array<{
    id: number;
    vesselId: string;
    testType: string;
    incidentTitle?: string;
    incidentDateTime?: string;
    alcoholTestDateTime?: string;
    drugTestDateTime?: string;
    violations?: number;
  }>>({
    queryKey: ['/api/drug-alcohol-tests'],
  });
  
  // Create vessel ID to name mapping
  const vesselMap = useMemo(() => {
    if (!vessels) return new Map();
    return new Map(vessels.map(v => [v.entryId, v.name]));
  }, [vessels]);
  
  // Transform and filter data
  const tableData = useMemo<PostIncidentTestData[]>(() => {
    if (!testRecords) return [];
    
    // Filter for post-incident tests
    const postIncidentTests = testRecords.filter(record => record.testType === 'post-incident');
    
    // Transform to table format with calculated periods first
    const transformed = postIncidentTests.map(record => ({
      id: record.id,
      vesselId: record.vesselId,
      vesselName: vesselMap.get(record.vesselId) || record.vesselId,
      incidentTitle: record.incidentTitle || '',
      incidentDateTime: record.incidentDateTime || '',
      alcoholTestDateTime: record.alcoholTestDateTime || '',
      alcoholTestPeriod: record.incidentDateTime && record.alcoholTestDateTime
        ? calculateHoursDifference(record.incidentDateTime, record.alcoholTestDateTime)
        : 'N/A',
      drugTestDateTime: record.drugTestDateTime || '',
      drugTestPeriod: record.incidentDateTime && record.drugTestDateTime
        ? calculateHoursDifference(record.incidentDateTime, record.drugTestDateTime)
        : 'N/A',
      violations: record.violations || 0,
    }));
    
    // Apply vessel/fleet filtering on transformed data
    if (filterType === "vessel") {
      // If no vessels selected, show all
      if (selectedVessels.length === 0) return transformed;
      // Otherwise, show only selected vessels (selectedVessels contains vessel names)
      return transformed.filter(record => selectedVessels.includes(record.vesselName));
    } else if (filterType === "fleet") {
      // Fleet filtering (placeholder - would need fleet group data)
      return transformed;
    } else if (filterType === "addGroup") {
      // Additional group filtering (placeholder - would need group data)
      return transformed;
    }
    
    return transformed;
  }, [testRecords, vesselMap, filterType, selectedVessels, fleetValue, addGroupValue]);
  
  // Column definitions
  const columnDefs = useMemo<ColDef<PostIncidentTestData>[]>(() => [
    {
      headerName: "Vessel",
      field: "vesselName",
      flex: 1,
      minWidth: 120,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Incident Title",
      field: "incidentTitle",
      flex: 1.5,
      minWidth: 180,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Incident Date & Time",
      field: "incidentDateTime",
      flex: 1.2,
      minWidth: 150,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Alcohol test Date & Time",
      field: "alcoholTestDateTime",
      flex: 1.2,
      minWidth: 150,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Alcohol Test Period",
      field: "alcoholTestPeriod",
      flex: 0.8,
      minWidth: 100,
      cellClass: 'flex items-center text-[13px] font-medium',
    },
    {
      headerName: "Drug test Date & Time",
      field: "drugTestDateTime",
      flex: 1.2,
      minWidth: 150,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Drug Test Period",
      field: "drugTestPeriod",
      flex: 0.8,
      minWidth: 100,
      cellClass: 'flex items-center text-[13px] font-medium',
    },
    {
      headerName: "Violations",
      field: "violations",
      flex: 0.6,
      minWidth: 80,
      cellRenderer: ViolationsCellRenderer,
      cellClass: 'flex items-center justify-center text-[13px]',
    },
    {
      headerName: "",
      flex: 0.8,
      minWidth: 120,
      cellRenderer: ActionsCellRenderer,
      cellClass: 'flex items-center justify-center',
      sortable: false,
      filter: false,
    },
  ], []);
  
  return (
    <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      <div className="ag-theme-alpine dark:ag-theme-alpine-dark h-full">
        <AgGridReact
          ref={gridRef}
          rowData={tableData}
          columnDefs={columnDefs}
          gridOptions={{ theme: 'legacy' }}
          domLayout="normal"
          headerHeight={40}
          rowHeight={50}
          suppressCellFocus={true}
          suppressRowHoverHighlight={false}
          enableCellTextSelection={true}
          context={{ onAdd }}
          data-testid="grid-post-incident-tests"
        />
      </div>
    </div>
  );
}
