import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMonths, differenceInMonths, differenceInDays, parse } from 'date-fns';
import { queryClient, apiRequest } from '@/lib/queryClient';

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
  recordId?: number;
}

interface SummaryRowData {
  id?: number;
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
  onAdd?: (testType: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others') => void;
  onEdit?: (testType: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others', recordId: number) => void;
}

// Calculate "Due In" status and color
const calculateDueInStatus = (nextDueDate: string | undefined): { label: string; color: string; textColor: string } | null => {
  if (!nextDueDate) return null;
  
  try {
    // Parse the date string safely using date-fns parse (format: "dd-MMM-yyyy")
    const dueDate = parse(nextDueDate, 'dd-MMM-yyyy', new Date());
    const today = new Date();
    const daysUntilDue = differenceInDays(dueDate, today);
    const monthsUntilDue = differenceInMonths(dueDate, today);
    
    if (daysUntilDue < 0) {
      return { label: 'O/D', color: '#D50A0D', textColor: '#FFFFFF' }; // Red - Overdue
    } else if (monthsUntilDue < 1) {
      return { label: '1M', color: '#F9ECEF', textColor: '#000000' }; // Light pink/cream
    } else if (monthsUntilDue < 2) {
      return { label: '2M', color: '#FFCC00', textColor: '#000000' }; // Yellow
    } else if (monthsUntilDue < 3) {
      return { label: '3M', color: '#FFEEAA', textColor: '#000000' }; // Light yellow/cream
    }
    
    return null; // More than 3 months - no badge needed
  } catch {
    return null;
  }
};

// Test History Cell Renderer (reused from Annual)
const TestHistoryCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  const testData = params.value as TestRecord | undefined;
  const { onEdit } = params.context || {};

  if (!testData || !testData.date) {
    return <div className="flex items-center h-full text-gray-400 text-xs">No data</div>;
  }

  const violations = testData.violations || 0;
  const violationText = violations === 1 ? '1 Violation' : `${violations} Violation`;
  const violationColor = violations > 0 ? '#E54E60' : '#22C55E';

  const handleClick = () => {
    if (onEdit && testData.recordId && params.data?.testType) {
      onEdit(params.data.testType as 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others', testData.recordId);
    }
  };

  return (
    <div 
      className="flex flex-col justify-center h-full py-1 px-2 cursor-pointer hover:bg-blue-50 rounded transition-colors"
      onClick={handleClick}
      data-testid={`history-cell-${testData.recordId}`}
    >
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
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
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
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  const { onAdd } = params.context || {};
  
  const handleAdd = () => {
    if (onAdd && params.data?.testType) {
      onAdd(params.data.testType);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
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

export function SummaryTable({ selectedVessel, onAdd, onEdit }: SummaryTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Fetch all test records
  const { data: testRecords = [] } = useQuery<Array<{
    id: number;
    vesselId: string;
    testType: string;
    dateTimeTestCompleted?: string;
    placeLocation?: string;
    personnelTested?: string;
    frequencyMonths?: number;
    plannedPort?: string;
    plannedDate?: string;
    plannedComments?: string;
  }>>({
    queryKey: ['/api/drug-alcohol-tests'],
  });

  // Helper function to calculate violations from personnelTested
  const calculateViolations = (personnelTestedStr?: string): number => {
    if (!personnelTestedStr) return 0;
    try {
      const personnel = JSON.parse(personnelTestedStr);
      if (!Array.isArray(personnel)) return 0;
      return personnel.filter((p: any) => p.alcoholViolation || p.drugViolation).length;
    } catch {
      return 0;
    }
  };

  // Helper function to parse date from various formats
  const parseTestDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    try {
      // Handle ISO format (2025-12-20T18:30)
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      }
      // Handle "31 May 2023 - 1010 Hours" format
      const match = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/);
      if (match) {
        return new Date(`${match[1]} ${match[2]} ${match[3]}`);
      }
      return new Date(dateStr);
    } catch {
      return null;
    }
  };

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
      // Get all records for this vessel and test type
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

      // Sort records by date (most recent first) to build history
      const sortedRecords = [...records].sort((a, b) => {
        const dateA = parseTestDate(a.dateTimeTestCompleted);
        const dateB = parseTestDate(b.dateTimeTestCompleted);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });

      // Build test history from actual records
      const history: TestRecord[] = sortedRecords.map(record => {
        const testDate = parseTestDate(record.dateTimeTestCompleted);
        return {
          date: testDate ? format(testDate, 'dd-MMM-yyyy') : '',
          port: record.placeLocation || '',
          violations: calculateViolations(record.personnelTested),
          recordId: record.id,
        };
      });

      const lastTest = history[0];
      const secondLastTest = history[1];
      const thirdLastTest = history[2];

      // Get the most recent record for frequency and planning info
      const mostRecentRecord = sortedRecords[0];

      // Calculate next due date from the last test date
      let nextDueDate: string | undefined;
      if (hasPlanning && lastTest?.date && mostRecentRecord.frequencyMonths) {
        try {
          const lastDate = parse(lastTest.date, 'dd-MMM-yyyy', new Date());
          const nextDue = addMonths(lastDate, mostRecentRecord.frequencyMonths);
          nextDueDate = format(nextDue, 'dd-MMM-yyyy');
        } catch {
          nextDueDate = undefined;
        }
      }

      return {
        id: mostRecentRecord.id,
        testType: type,
        testTypeLabel: label,
        lastTest,
        secondLastTest,
        thirdLastTest,
        frequencyMonths: mostRecentRecord.frequencyMonths,
        nextDueDate,
        plannedPort: mostRecentRecord.plannedPort,
        plannedDate: mostRecentRecord.plannedDate,
        plannedComments: mostRecentRecord.plannedComments,
        hasPlanning,
      };
    });
  }, [testRecords, selectedVessel]);

  // Static legend for "Due in:" labels (always shows all 4 in descending order)
  const staticLegend = [
    { label: '3M', color: '#FFEEAA', textColor: '#000000' },
    { label: '2M', color: '#FFCC00', textColor: '#000000' },
    { label: '1M', color: '#F9ECEF', textColor: '#000000' },
    { label: 'O/D', color: '#D50A0D', textColor: '#FFFFFF' },
  ];

  // Column definitions
  const columnDefs = useMemo<ColDef<SummaryRowData>[]>(() => {
    const baseCols: ColDef<SummaryRowData>[] = [
      {
        headerName: '',
        field: 'testTypeLabel',
        width: 120,
        cellClass: 'flex items-center text-[13px] font-medium',
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
        headerName: 'Next Due',
        field: 'nextDueDate',
        width: 120,
        cellClass: 'flex items-center justify-center',
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) return null;
          
          // Calculate color based on urgency
          const status = calculateDueInStatus(params.value);
          
          // Only apply color coding if date falls within urgency period (<3 months or overdue)
          // Dates >3 months away have no background color
          if (status) {
            return (
              <div 
                className="text-xs font-semibold px-2 py-1 rounded"
                style={{ backgroundColor: status.color, color: status.textColor }}
              >
                {params.value}
              </div>
            );
          }
          
          // No color coding for dates >3 months away
          return (
            <div className="text-xs font-semibold text-gray-700">
              {params.value}
            </div>
          );
        },
      },
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
        flex: 1,
        minWidth: 200,
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
      {/* Static Due In Legend */}
      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Due in:</span>
        {staticLegend.map((item, index) => (
          <div
            key={index}
            className="px-3 py-1 rounded text-sm font-semibold"
            style={{ backgroundColor: item.color, color: item.textColor }}
          >
            {item.label}
          </div>
        ))}
      </div>

      {/* AG Grid Table */}
      <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <div className="ag-theme-alpine dark:ag-theme-alpine-dark h-full">
          <AgGridReact
            ref={gridRef}
            rowData={summaryData}
            columnDefs={columnDefs}
            gridOptions={{ theme: 'legacy' }}
            domLayout="autoHeight"
            headerHeight={40}
            rowHeight={70}
            suppressCellFocus={true}
            suppressRowHoverHighlight={false}
            enableCellTextSelection={true}
            context={{
              showAllHistory,
              setShowAllHistory,
              onAdd,
              onEdit,
            }}
            onCellValueChanged={async (event: CellValueChangedEvent) => {
              // Only handle changes to plannedComments, plannedPort, or plannedDate
              const field = event.colDef.field;
              if (field === 'plannedComments' || field === 'plannedPort' || field === 'plannedDate') {
                try {
                  const recordId = event.data.id;
                  if (!recordId) {
                    console.error('No record ID found for update');
                    return;
                  }
                  const updateData = { [field]: event.newValue };
                  
                  await apiRequest('PUT', `/api/drug-alcohol-tests/${recordId}`, updateData);
                  
                  // Invalidate cache to refresh data
                  queryClient.invalidateQueries({ queryKey: ['/api/drug-alcohol-tests'] });
                } catch (error) {
                  console.error('Failed to update test record:', error);
                  // Optionally show error toast to user
                }
              }
            }}
            data-testid="grid-summary"
          />
        </div>
      </div>
    </div>
  );
}
