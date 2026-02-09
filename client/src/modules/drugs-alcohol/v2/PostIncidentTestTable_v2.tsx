import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { useMemo, useRef } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostIncidentTestData {
  id: number;
  daUuid: string | null;
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
  onEdit?: (recordId: number | string) => void;
}

function calculateHoursDifference(incidentDateTime: string, testDateTime: string): string {
  try {
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
    
    const diffMs = Math.abs(testDate.getTime() - incidentDate.getTime());
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours === 0) {
      return `${diffMinutes}m`;
    }
    return `${diffHours}h ${diffMinutes}m`;
  } catch {
    return 'N/A';
  }
}

function calculateViolations(personnelTested: any): number {
  if (!personnelTested) return 0;
  try {
    const personnel = typeof personnelTested === 'string' ? JSON.parse(personnelTested) : personnelTested;
    if (!Array.isArray(personnel)) return 0;
    return personnel.filter((p: any) => p.alcoholViolation === true || p.drugViolation === true).length;
  } catch {
    return 0;
  }
}

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

const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { onEdit } = props.context || {};
  
  const handleEdit = () => {
    const recordId = props.data?.daUuid;
    if (onEdit && recordId) {
      onEdit(recordId);
    }
  };
  
  return (
    <div className="flex items-center justify-center h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-blue-100"
        onClick={handleEdit}
        data-testid={`button-edit-${props.data?.daUuid || props.data?.id}`}
      >
        <Pencil className="h-4 w-4 text-blue-600" />
      </Button>
    </div>
  );
};

export function PostIncidentTestTable_v2({
  filterType,
  selectedVessels,
  fleetValue,
  addGroupValue,
  onEdit,
}: PostIncidentTestTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const apiBase = '/api/v2/drugs-alcohol/test-records';
  const queryKeyBase = ['v2', 'drugs-alcohol', 'test-records'];
  
  const { data: vessels } = useQuery<Array<{ vesselUuid: string; vessel: string }>>({
    queryKey: ['/api/v2/vessel/list'],
  });
  
  const { data: testRecords } = useQuery<Array<{
    id: number;
    daUuid?: string;
    vesselId: string;
    testType: string;
    incidentTitle?: string;
    incidentDateTime?: string;
    alcoholTestDateTime?: string;
    drugTestDateTime?: string;
    personnelTested?: any[];
    violations?: number;
  }>>({
    queryKey: queryKeyBase,
    queryFn: async () => {
      const response = await fetch(apiBase);
      if (!response.ok) throw new Error('Failed to fetch drug alcohol tests');
      return response.json();
    },
  });
  
  const vesselMap = useMemo(() => {
    if (!vessels) return new Map<string, string>();
    return new Map(vessels.map(v => [v.vesselUuid, v.vessel]));
  }, [vessels]);
  
  const tableData = useMemo<PostIncidentTestData[]>(() => {
    if (!testRecords) return [];
    
    const postIncidentTests = testRecords.filter(record => record.testType === 'post-incident');
    
    const transformed = postIncidentTests.map(record => ({
      id: record.id,
      daUuid: record.daUuid || null,
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
      violations: record.violations ?? calculateViolations(record.personnelTested) ?? 0,
    }));
    
    if (filterType === "vessel") {
      if (selectedVessels.length === 0) return transformed;
      return transformed.filter(record => selectedVessels.includes(record.vesselName));
    } else if (filterType === "fleet") {
      return transformed;
    } else if (filterType === "addGroup") {
      return transformed;
    }
    
    return transformed;
  }, [testRecords, vesselMap, filterType, selectedVessels, fleetValue, addGroupValue]);
  
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
          context={{ onEdit }}
          data-testid="grid-post-incident-tests"
        />
      </div>
    </div>
  );
}
