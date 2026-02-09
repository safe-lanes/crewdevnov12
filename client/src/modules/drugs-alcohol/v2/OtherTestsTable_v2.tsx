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
  onEdit?: (recordId: number | string) => void;
}

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

function parseAlcoholDrugType(value: any): string {
  if (!value) return '';
  
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
      return String(parsed);
    } catch {
      return value
        .replace(/^\[|\]$/g, '')
        .replace(/"/g, '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
        .join(', ');
    }
  }
  
  return String(value);
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

const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { onEdit } = props.context || {};
  
  const handleEdit = () => {
    const recordId = props.data?.daUuid || props.data?.id;
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
        data-testid={`button-edit-${props.data?.daUuid || props.data.id}`}
      >
        <Pencil className="h-4 w-4 text-blue-600" />
      </Button>
    </div>
  );
};

export function OtherTestsTable_v2({
  filterType,
  selectedVessels,
  fleetValue,
  addGroupValue,
  onEdit,
}: OtherTestsTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const apiBase = '/api/v2/drugs-alcohol/test-records';
  const queryKeyBase = ['v2', 'drugs-alcohol', 'test-records'];
  
  const { data: vessels } = useQuery<Array<{ entryId: string; name: string }>>({
    queryKey: ['/api/masters/014/data'],
  });
  
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
    queryKey: queryKeyBase,
    queryFn: async () => {
      const response = await fetch(apiBase);
      if (!response.ok) throw new Error('Failed to fetch drug alcohol tests');
      return response.json();
    },
  });
  
  const vesselMap = useMemo(() => {
    if (!vessels) return new Map();
    return new Map(vessels.map(v => [v.entryId, v.name]));
  }, [vessels]);
  
  const tableData = useMemo<OtherTestData[]>(() => {
    if (!testRecords) return [];
    
    const otherTests = testRecords.filter(record => record.testType === 'others');
    
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
