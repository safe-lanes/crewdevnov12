import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMonths, differenceInMonths, differenceInDays, parse } from 'date-fns';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { PlannedDateCellEditor } from './PlannedDateCellEditor';
import { usePermissions } from '@/contexts/PermissionsContext';

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
  recordId?: number | string;
}

interface SummaryRowData {
  id?: number;
  daUuid?: string | null;
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
  onEdit?: (testType: 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others', recordId: number | string) => void;
}

const calculateDueInStatus = (nextDueDate: string | undefined): { label: string; color: string; textColor: string } | null => {
  if (!nextDueDate) return null;
  
  try {
    const dueDate = parse(nextDueDate, 'dd-MMM-yyyy', new Date());
    const today = new Date();
    const daysUntilDue = differenceInDays(dueDate, today);
    const monthsUntilDue = differenceInMonths(dueDate, today);
    
    if (daysUntilDue < 0) {
      return { label: 'O/D', color: '#D50A0D', textColor: '#FFFFFF' };
    } else if (monthsUntilDue < 1) {
      return { label: '1M', color: '#F9ECEF', textColor: '#000000' };
    } else if (monthsUntilDue < 2) {
      return { label: '2M', color: '#FFCC00', textColor: '#000000' };
    } else if (monthsUntilDue < 3) {
      return { label: '3M', color: '#FFEEAA', textColor: '#000000' };
    }
    
    return null;
  } catch {
    return null;
  }
};

const TestHistoryCellRenderer = (params: ICellRendererParams) => {
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

const FrequencyCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  if (!params.data?.hasPlanning) {
    return null;
  }

  const frequency = params.value || 12;

  const handleChange = (value: string) => {
    console.log('Frequency changed for', params.data?.testType, 'to', value);
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

const ActionsCellRenderer = (params: ICellRendererParams) => {
  if (!params.colDef || !params.data) return null;
  
  const { onAdd } = params.context || {};
  if (!onAdd) return null;
  
  const handleAdd = () => {
    if (params.data?.testType) {
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

export function SummaryTable_v2({ selectedVessel, onAdd, onEdit }: SummaryTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const { userType } = usePermissions();
  const isShipUser = userType === 'Ship';
  const [showAllHistory, setShowAllHistory] = useState(false);
  const apiBase = '/api/v2/drugs-alcohol/test-records';
  const queryKeyBase = ['v2', 'drugs-alcohol', 'test-records'];
  const updateMethod = 'PATCH';
  const invalidateKey = ['v2', 'drugs-alcohol'];

  const { data: testRecords = [] } = useQuery<Array<{
    id: number;
    vesselId: string;
    testType: string;
    dateTimeTestCompleted?: string;
    alcoholTestDateTime?: string;
    drugTestDateTime?: string;
    placeLocation?: string;
    personnelTested?: string;
    frequencyMonths?: number;
    plannedPort?: string;
    plannedDate?: string;
    plannedComments?: string;
  }>>({
    queryKey: queryKeyBase,
    queryFn: async () => {
      const response = await fetch(apiBase);
      if (!response.ok) throw new Error('Failed to fetch drug alcohol tests');
      return response.json();
    },
  });

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

  const parseTestDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    try {
      if (dateStr.includes('T')) {
        return new Date(dateStr);
      }
      const match = dateStr.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/);
      if (match) {
        return new Date(`${match[1]} ${match[2]} ${match[3]}`);
      }
      return new Date(dateStr);
    } catch {
      return null;
    }
  };

  const summaryData = useMemo<SummaryRowData[]>(() => {
    const testTypes = [
      { type: 'annual', label: 'Annual', hasPlanning: true },
      { type: 'periodic', label: 'Periodic', hasPlanning: true },
      { type: 'monthly', label: 'Monthly', hasPlanning: true },
      { type: 'post-incident', label: 'Post Incident', hasPlanning: false },
      { type: 'others', label: 'Other', hasPlanning: false },
    ];

    const getTestDateField = (record: typeof testRecords[0], testType: string): string | undefined => {
      if (testType === 'post-incident') {
        return record.alcoholTestDateTime;
      }
      return record.dateTimeTestCompleted;
    };

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

      const sortedRecords = [...records].sort((a, b) => {
        const dateA = parseTestDate(getTestDateField(a, type));
        const dateB = parseTestDate(getTestDateField(b, type));
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.getTime() - dateA.getTime();
      });

      const history: TestRecord[] = sortedRecords.map(record => {
        const testDate = parseTestDate(getTestDateField(record, type));
        return {
          date: testDate ? format(testDate, 'dd-MMM-yyyy') : '',
          port: record.placeLocation || '',
          violations: calculateViolations(record.personnelTested),
          recordId: (record as any).daUuid || record.id,
        };
      });

      const lastTest = history[0];
      const secondLastTest = history[1];
      const thirdLastTest = history[2];

      const mostRecentRecord = sortedRecords[0];

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
        daUuid: (mostRecentRecord as any).daUuid || null,
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

  const staticLegend = [
    { label: '3M', color: '#FFEEAA', textColor: '#000000' },
    { label: '2M', color: '#FFCC00', textColor: '#000000' },
    { label: '1M', color: '#F9ECEF', textColor: '#000000' },
    { label: 'O/D', color: '#D50A0D', textColor: '#FFFFFF' },
  ];

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
          
          const status = calculateDueInStatus(params.value);
          
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
      }
    );

    if (!isShipUser) {
      baseCols.push(
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
          cellEditor: PlannedDateCellEditor,
        },
        {
          headerName: 'Comments',
          field: 'plannedComments',
          flex: 1,
          minWidth: 200,
          cellClass: 'flex items-center text-[13px]',
          editable: (params) => params.data?.hasPlanning || false,
        }
      );
    }

    baseCols.push(
      {
        headerName: '',
        width: 120,
        cellRenderer: ActionsCellRenderer,
        sortable: false,
        filter: false,
      }
    );

    return baseCols;
  }, [showAllHistory, isShipUser]);

  return (
    <div className="flex flex-col flex-1 gap-4">
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
              const field = event.colDef.field;
              if (field === 'plannedComments' || field === 'plannedPort' || field === 'plannedDate') {
                try {
                  const recordUuid = event.data.daUuid;
                  if (!recordUuid) {
                    console.error('No record UUID found for planned fields update');
                    return;
                  }
                  const updateData = { [field]: event.newValue };
                  
                  await apiRequest('PATCH', `${apiBase}/${recordUuid}/planned`, updateData);
                  
                  queryClient.invalidateQueries({ queryKey: invalidateKey });
                } catch (error) {
                  console.error('Failed to update test record:', error);
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
