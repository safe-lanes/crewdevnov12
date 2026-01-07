import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { useMemo, useRef } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OtherTestData {
  id: number;
  vesselId: string;
  vesselName: string;
  testDateTime: string;
  testType: string;
  reasonForTesting: string;
  description: string;
  initiatedBy: string;
  violations: number;
}

interface OtherTestsTableProps {
  filterType: "vessel" | "fleet" | "addGroup";
  selectedVessels: string[];
  fleetValue: string;
  addGroupValue: string;
  onEdit?: (recordId: number) => void;
}

// Format datetime for display
function formatDateTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return dateTimeStr;
    
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}-${month}-${year}, ${hours}:${minutes}`;
  } catch {
    return dateTimeStr;
  }
}

// Parse alcoholDrugType JSON array to display string
function parseAlcoholDrugType(value: any): string {
  if (!value) return '';
  
  // If already an array, join it
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  // If it's a string, try to parse as JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
      return String(parsed);
    } catch {
      // Not valid JSON - clean up any brackets/quotes and return
      return value
        .replace(/^\[|\]$/g, '')  // Remove surrounding brackets
        .replace(/"/g, '')         // Remove quotes
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .join(', ');
    }
  }
  
  return String(value);
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

// Description cell renderer with truncation and tooltip
const DescriptionCellRenderer = (props: ICellRendererParams) => {
  const value = props.value || '';
  
  if (!value) {
    return <div className="text-[13px]"></div>;
  }
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="text-[13px] truncate cursor-default max-w-full">
          {value}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[400px] whitespace-normal">
        <p>{value}</p>
      </TooltipContent>
    </Tooltip>
  );
};

// Actions cell renderer
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { onEdit } = props.context || {};
  
  const handleEdit = () => {
    if (onEdit && props.data?.id) {
      onEdit(props.data.id);
    }
  };
  
  return (
    <div className="flex items-center justify-center h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-blue-100"
        onClick={handleEdit}
        data-testid={`button-edit-${props.data.id}`}
      >
        <Pencil className="h-4 w-4 text-blue-600" />
      </Button>
    </div>
  );
};

export function OtherTestsTable({
  filterType,
  selectedVessels,
  fleetValue,
  addGroupValue,
  onEdit,
}: OtherTestsTableProps) {
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
    dateTimeTestCompleted?: string;
    alcoholDrugType?: string;
    reasonForTesting?: string;
    description?: string;
    initiatedBy?: string;
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
  const tableData = useMemo<OtherTestData[]>(() => {
    if (!testRecords) return [];
    
    // Filter for other tests
    const otherTests = testRecords.filter(record => record.testType === 'others');
    
    // Transform to table format first
    const transformed = otherTests.map(record => ({
      id: record.id,
      vesselId: record.vesselId,
      vesselName: vesselMap.get(record.vesselId) || record.vesselId,
      testDateTime: formatDateTime(record.dateTimeTestCompleted || ''),
      testType: parseAlcoholDrugType(record.alcoholDrugType),
      reasonForTesting: record.reasonForTesting || '',
      description: record.description || '',
      initiatedBy: record.initiatedBy || '',
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
  const columnDefs = useMemo<ColDef<OtherTestData>[]>(() => [
    {
      headerName: "Vessel",
      field: "vesselName",
      flex: 1,
      minWidth: 120,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Test Date & Time",
      field: "testDateTime",
      flex: 1.2,
      minWidth: 140,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Test Type",
      field: "testType",
      flex: 0.8,
      minWidth: 100,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Reason for Testing",
      field: "reasonForTesting",
      flex: 1.2,
      minWidth: 150,
      cellClass: 'flex items-center text-[13px]',
    },
    {
      headerName: "Description",
      field: "description",
      flex: 1.5,
      minWidth: 200,
      cellRenderer: DescriptionCellRenderer,
      cellClass: 'flex items-center overflow-hidden',
    },
    {
      headerName: "Initiated By",
      field: "initiatedBy",
      flex: 1.2,
      minWidth: 140,
      cellClass: 'flex items-center text-[13px]',
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
      flex: 0.4,
      minWidth: 60,
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
          data-testid="grid-other-tests"
        />
      </div>
    </div>
  );
}
