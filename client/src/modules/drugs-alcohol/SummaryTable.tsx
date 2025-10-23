import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Edit, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMonths, differenceInMonths, differenceInDays } from 'date-fns';

// History Header Component (matches Annual table)
const HistoryHeaderComponent = (props: any) => {
  const { showAllHistory, setShowAllHistory } = props.context;

  return (
    <div
      className="flex items-center justify-center h-full cursor-pointer hover:opacity-80"
      onClick={() => setShowAllHistory(!showAllHistory)}
      data-testid="button-history-toggle"
    >
      <span className="text-white font-semibold">
        {showAllHistory ? 'History <' : 'History >'}
      </span>
    </div>
  );
};

interface TestRecord {
  date: string;
  port: string;
  violations: number;
}

interface SummaryRowData {
  testType: string;
  testTypeLabel: string;
  lastTest?: TestRecord;
  secondLastTest?: TestRecord;
  thirdLastTest?: TestRecord;
  frequencyMonths?: number;
  nextDueDate?: string;
  plannedPort?: string;
  plannedDate?: string;
  plannedComments?: string;
  hasPlanning: boolean;
}

interface SummaryTableProps {
  selectedVessel: string;
}

// Calculate "Due In" status and color
const calculateDueInStatus = (nextDueDate: string | undefined): { label: string; color: string; textColor: string } | null => {
  if (!nextDueDate) return null;
  
  try {
    const dueDate = new Date(nextDueDate);
    const today = new Date();
    const daysUntilDue = differenceInDays(dueDate, today);
    const monthsUntilDue = differenceInMonths(dueDate, today);
    
    if (daysUntilDue < 0) {
      return { label: 'O/D', color: '#E54E60', textColor: '#FFFFFF' }; // Red - Overdue
    } else if (monthsUntilDue < 1) {
      return { label: '1M', color: '#FEF3C7', textColor: '#B91C1C' }; // Light red with dark red text
    } else if (monthsUntilDue < 2) {
      return { label: '2M', color: '#FDE68A', textColor: '#92400E' }; // Yellow
    } else if (monthsUntilDue < 3) {
      return { label: '3M', color: '#FCD34D', textColor: '#78350F' }; // Darker yellow
    }
    
    return null; // More than 3 months - no badge needed
  } catch {
    return null;
  }
};

// Test History Cell Renderer (reused from Annual)
const TestHistoryCellRenderer = (params: ICellRendererParams) => {
  const testData = params.value as TestRecord | undefined;

  if (!testData || !testData.date) {
    return <div className="flex items-center h-full text-gray-400 text-xs">No data</div>;
  }

  const violations = testData.violations || 0;
  const violationText = violations === 1 ? '1 Violation' : `${violations} Violation`;
  const violationColor = violations > 0 ? '#E54E60' : '#22C55E';

  return (
    <div className="flex flex-col justify-center h-full py-1 px-2">
      <div className="text-xs text-gray-700 font-medium">{testData.date}</div>
      <div className="text-xs text-gray-600 mt-0.5">{testData.port}</div>
      <div
        className="text-xs font-medium mt-0.5"
        style={{ color: violationColor }}
      >
        {violationText}
      </div>
    </div>
  );
};

// Frequency Cell Renderer
const FrequencyCellRenderer = (params: ICellRendererParams) => {
  if (!params.data?.hasPlanning) {
    return null; // No frequency dropdown for Post Incident/Other
  }

  const frequency = params.value || 12;

  const handleChange = (value: string) => {
    console.log('Frequency changed for', params.data?.testType, 'to', value);
    // TODO: Update frequency via API
  };

  const getLabel = (months: number) => {
    if (months === 12) return '(+12) Months';
    if (months === 6) return '(+6) Months';
    if (months === 3) return '(+3) Months';
    if (months === 1) return '(+1) Months';
    return `(+${months}) M`;
  };

  return (
    <div className="flex items-center justify-center h-full">
      <Select value={frequency.toString()} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="12">(+12) Months</SelectItem>
          <SelectItem value="6">(+6) Months</SelectItem>
          <SelectItem value="3">(+3) Months</SelectItem>
          <SelectItem value="1">(+1) Months</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

// Actions Cell Renderer
const ActionsCellRenderer = (params: ICellRendererParams) => {
  const hasPlanning = params.data?.hasPlanning;

  const handleEdit = () => {
    console.log('Edit clicked for', params.data?.testType);
  };

  const handleDelete = () => {
    console.log('Delete clicked for', params.data?.testType);
  };

  const handleAdd = () => {
    console.log('Add clicked for', params.data?.testType);
  };

  return (
    <div className="flex gap-1 items-center justify-center h-full">
      {hasPlanning && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={handleEdit}
          data-testid={`button-edit-${params.data?.testType}`}
        >
          <Edit className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleDelete}
        data-testid={`button-delete-${params.data?.testType}`}
      >
        <Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-green-100"
        onClick={handleAdd}
        data-testid={`button-add-${params.data?.testType}`}
      >
        <Plus className="h-4 w-4 text-green-600" />
      </Button>
    </div>
  );
};

export function SummaryTable({ selectedVessel }: SummaryTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Fetch all test records
  const { data: testRecords = [] } = useQuery<Array<{
    id: number;
    vesselId: string;
    testType: string;
    testHistory?: string;
    frequencyMonths?: number;
    plannedPort?: string;
    plannedDate?: string;
    plannedComments?: string;
    testDateTime?: string;
    incidentDateTime?: string;
  }>>({
    queryKey: ['/api/drug-alcohol-tests'],
  });

  // Aggregate data by test type for the selected vessel
  const summaryData = useMemo<SummaryRowData[]>(() => {
    const testTypes = [
      { type: 'annual', label: 'Annual', hasPlanning: true },
      { type: 'periodic', label: 'Periodic', hasPlanning: true },
      { type: 'monthly', label: 'Monthly', hasPlanning: true },
      { type: 'post-incident', label: 'Post Incident', hasPlanning: false },
      { type: 'others', label: 'Other', hasPlanning: false },
    ];

    return testTypes.map(({ type, label, hasPlanning }) => {
      const records = testRecords.filter(
        r => r.testType === type && r.vesselId === selectedVessel
      );

      if (records.length === 0) {
        return {
          testType: type,
          testTypeLabel: label,
          hasPlanning,
        };
      }

      // Get the first record (assuming one record per vessel per test type for scheduled tests)
      const record = records[0];
      
      // Parse test history
      let history: TestRecord[] = [];
      if (record.testHistory) {
        try {
          history = JSON.parse(record.testHistory);
        } catch {
          history = [];
        }
      }

      const lastTest = history[0];
      const secondLastTest = history[1];
      const thirdLastTest = history[2];

      // Calculate next due date
      let nextDueDate: string | undefined;
      if (hasPlanning && lastTest?.date && record.frequencyMonths) {
        try {
          const lastDate = new Date(lastTest.date);
          const nextDue = addMonths(lastDate, record.frequencyMonths);
          nextDueDate = format(nextDue, 'dd MMM yyyy');
        } catch {
          nextDueDate = undefined;
        }
      }

      return {
        testType: type,
        testTypeLabel: label,
        lastTest,
        secondLastTest,
        thirdLastTest,
        frequencyMonths: record.frequencyMonths,
        nextDueDate,
        plannedPort: record.plannedPort,
        plannedDate: record.plannedDate,
        plannedComments: record.plannedComments,
        hasPlanning,
      };
    });
  }, [testRecords, selectedVessel]);

  // Calculate due in badges
  const dueInBadges = useMemo(() => {
    const badges = summaryData
      .filter(row => row.hasPlanning && row.nextDueDate)
      .map(row => calculateDueInStatus(row.nextDueDate))
      .filter(badge => badge !== null);

    return badges as Array<{ label: string; color: string; textColor: string }>;
  }, [summaryData]);

  // Column definitions
  const columnDefs = useMemo<ColDef<SummaryRowData>[]>(() => {
    const baseCols: ColDef<SummaryRowData>[] = [
      {
        headerName: '',
        field: 'testTypeLabel',
        width: 120,
        cellClass: 'flex items-center text-[13px] font-medium',
        pinned: 'left',
      },
      {
        headerName: 'Last',
        field: 'lastTest',
        width: 140,
        cellRenderer: TestHistoryCellRenderer,
        headerComponent: HistoryHeaderComponent,
      },
    ];

    if (showAllHistory) {
      baseCols.push(
        {
          headerName: '2nd Last',
          field: 'secondLastTest',
          width: 140,
          cellRenderer: TestHistoryCellRenderer,
        },
        {
          headerName: '3rd Last',
          field: 'thirdLastTest',
          width: 140,
          cellRenderer: TestHistoryCellRenderer,
        }
      );
    }

    baseCols.push(
      {
        headerName: 'Next Due Interval',
        field: 'frequencyMonths',
        width: 160,
        cellRenderer: FrequencyCellRenderer,
      },
      {
        headerName: 'Port',
        field: 'plannedPort',
        width: 120,
        cellClass: 'flex items-center text-[13px]',
        editable: (params) => params.data?.hasPlanning || false,
      },
      {
        headerName: 'Date',
        field: 'plannedDate',
        width: 120,
        cellClass: 'flex items-center text-[13px]',
        editable: (params) => params.data?.hasPlanning || false,
      },
      {
        headerName: 'Comments',
        field: 'plannedComments',
        width: 200,
        cellClass: 'flex items-center text-[13px]',
        editable: (params) => params.data?.hasPlanning || false,
      },
      {
        headerName: '',
        width: 120,
        cellRenderer: ActionsCellRenderer,
        sortable: false,
        filter: false,
      }
    );

    return baseCols;
  }, [showAllHistory]);

  return (
    <div className="flex flex-col flex-1 gap-4">
      {/* Due In Badges */}
      {dueInBadges.length > 0 && (
        <div className="flex gap-2 items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Due in:</span>
          {dueInBadges.map((badge, index) => (
            <div
              key={index}
              className="px-3 py-1 rounded text-sm font-semibold"
              style={{ backgroundColor: badge.color, color: badge.textColor }}
            >
              {badge.label}
            </div>
          ))}
        </div>
      )}

      {/* AG Grid Table */}
      <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <div className="ag-theme-alpine dark:ag-theme-alpine-dark h-full">
          <AgGridReact
            ref={gridRef}
            rowData={summaryData}
            columnDefs={columnDefs}
            domLayout="autoHeight"
            headerHeight={40}
            rowHeight={70}
            suppressCellFocus={true}
            suppressRowHoverHighlight={false}
            enableCellTextSelection={true}
            context={{
              showAllHistory,
              setShowAllHistory,
            }}
            data-testid="grid-summary"
          />
        </div>
      </div>
    </div>
  );
}
