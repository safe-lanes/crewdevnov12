import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColDef, ColGroupDef, ICellRendererParams, GridApi, CellValueChangedEvent } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addMonths, differenceInMonths, differenceInDays, parse } from 'date-fns';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface TestRecord {
  date: string;
  port: string;
  violations: number;
}

interface AnnualTestData {
  id: number;
  vesselId: string;
  vesselName: string;
  testHistory: TestRecord[];
  frequencyMonths: number;
  nextDue: string;
  plannedPort: string;
  plannedDate: string;
  plannedComments: string;
}

interface AnnualTestTableProps {
  filterType: "vessel" | "fleet" | "addGroup";
  selectedVessels: string[];
  fleetValue: string;
  addGroupValue: string;
  onAdd?: () => void;
}

const useDrugAlcoholTests = (filters: any) => {
  return useQuery({
    queryKey: ['/api/drug-alcohol-tests', filters],
    queryFn: async () => {
      const response = await fetch('/api/drug-alcohol-tests');
      if (!response.ok) throw new Error('Failed to fetch drug alcohol tests');
      return response.json();
    },
  });
};

const useVessels = () => {
  return useQuery({
    queryKey: ['/api/masters/014/data'],
    queryFn: async () => {
      const response = await fetch('/api/masters/014/data');
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
    select: (data: any[]) => {
      return data
        .filter((vessel: any) => !vessel.isDeleted)
        .reduce((acc: any, vessel: any) => {
          acc[vessel.entryId] = vessel.name || vessel.vessel || 'Unknown Vessel';
          return acc;
        }, {});
    }
  });
};

const useVesselsList = () => {
  return useQuery({
    queryKey: ['/api/masters/014/data'],
    queryFn: async () => {
      const response = await fetch('/api/masters/014/data');
      if (!response.ok) throw new Error('Failed to fetch vessels');
      return response.json();
    },
    select: (data: any[]) => {
      return data
        .filter((vessel: any) => !vessel.isDeleted)
        .map((vessel: any) => ({
          vesselId: vessel.entryId || vessel.vuid || vessel.id,
          vesselName: vessel.name || vessel.vessel || 'Unknown Vessel',
        }));
    }
  });
};

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

const FrequencyHeaderComponent = (params: any) => {
  const context = params.context || {};
  const globalFrequency = context.globalFrequency || 12;
  const setGlobalFrequency = context.setGlobalFrequency;

  const handleChange = (value: string) => {
    const months = parseInt(value);
    if (setGlobalFrequency) {
      setGlobalFrequency(months);
    }
  };

  const getLabel = (months: number) => {
    return `(+${months}) M`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-2">
      <div className="text-white font-semibold mb-1 text-xs">Next Due Interval</div>
      <Select value={globalFrequency.toString()} onValueChange={handleChange}>
        <SelectTrigger className="h-7 w-24 text-xs bg-white border-white">
          <span className="text-xs">{getLabel(globalFrequency)}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="12">(+12) M</SelectItem>
          <SelectItem value="6">(+6) M</SelectItem>
          <SelectItem value="3">(+3) M</SelectItem>
          <SelectItem value="1">(+1) M</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

const TestHistoryCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
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

const NextDueCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  const { globalFrequency, vesselFrequencies } = params.context;
  const vesselId = params.data?.vesselId;

  // Use vessel-specific frequency if set, otherwise use global
  const currentFrequency = vesselFrequencies[vesselId] || globalFrequency;

  if (!params.value) return null;

  try {
    const lastTestDate = params.data?.testHistory?.[0]?.date;
    if (!lastTestDate) {
      return null; // Or some placeholder if no last test date
    }

    const calculatedNextDue = addMonths(new Date(lastTestDate), currentFrequency);
    const formattedDate = format(calculatedNextDue, 'dd-MMM-yyyy');

    // Calculate color based on urgency
    const status = calculateDueInStatus(formattedDate);
    
    // Only apply color coding if date falls within urgency period (<3 months or overdue)
    if (status) {
      return (
        <div className="flex items-center h-full">
          <span
            className="px-3 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: status.color, color: status.textColor }}
          >
            {formattedDate}
          </span>
        </div>
      );
    }
    
    // No color coding for dates >3 months away
    return (
      <div className="flex items-center h-full">
        <span className="text-xs font-medium text-gray-700">
          {formattedDate}
        </span>
      </div>
    );
  } catch {
    return <span>{params.value}</span>;
  }
};

const FrequencyCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  const { globalFrequency, vesselFrequencies, setVesselFrequency } = params.context;
  const vesselId = params.data?.vesselId;

  // Use vessel-specific frequency if set, otherwise use global
  const currentFrequency = vesselFrequencies[vesselId] || globalFrequency;

  const handleChange = (value: string) => {
    const months = parseInt(value);
    setVesselFrequency(vesselId, months);
  };

  // Generate options that are <= global frequency
  const availableOptions = [
    { value: 12, label: '(+12) M' },
    { value: 6, label: '(+6) M' },
    { value: 3, label: '(+3) M' },
    { value: 1, label: '(+1) M' },
  ].filter(option => option.value <= globalFrequency);

  return (
    <div className="flex items-center h-full">
      <Select value={currentFrequency.toString()} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-24 text-xs">
          <SelectValue placeholder={`(+${currentFrequency}) M`} />
        </SelectTrigger>
        <SelectContent>
          {availableOptions.map(option => (
            <SelectItem key={option.value} value={option.value.toString()}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const ActionsCellRenderer = (params: ICellRendererParams) => {
  // Defensive guard for AG Grid initialization
  if (!params.colDef || !params.data) return null;
  
  const { onAdd } = params.context || {};
  
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
        data-testid={`button-add-${params.data.id}`}
      >
        <Plus className="h-4 w-4 text-green-600" />
      </Button>
    </div>
  );
};

export const AnnualTestTable: React.FC<AnnualTestTableProps> = ({
  filterType,
  selectedVessels,
  fleetValue,
  addGroupValue,
  onAdd,
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [globalFrequency, setGlobalFrequency] = useState<number>(12);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [vesselFrequencies, setVesselFrequencies] = useState<Record<string, number>>({});
  const gridApiRef = useRef<GridApi | null>(null);

  // Refresh cells when frequency changes to recalculate Next Due dates
  useEffect(() => {
    if (gridApi) {
      gridApi.refreshCells({ columns: ['nextDue'], force: true });
    }
  }, [globalFrequency, gridApi]);

  // Auto-size columns to fit content
  const autoSizeContentColumns = useCallback(() => {
    if (gridApiRef.current) {
      const columnsToAutoSize = [
        'testHistory[0]',
        'testHistory[1]',
        'testHistory[2]',
        'nextDue',
        'frequencyMonths',
        'plannedPort',
        'plannedDate',
        'actions'
      ];

      setTimeout(() => {
        gridApiRef.current?.autoSizeColumns(columnsToAutoSize, false);
      }, 50);
    }
  }, []);

  // Re-size columns when history toggle changes
  useEffect(() => {
    autoSizeContentColumns();
  }, [showAllHistory, autoSizeContentColumns]);

  // Callback to set vessel-specific frequency
  const setVesselFrequency = useCallback((vesselId: string, frequency: number) => {
    setVesselFrequencies(prev => ({
      ...prev,
      [vesselId]: frequency
    }));
  }, []);

  // When global frequency changes, reset any vessel frequencies that are now invalid (> global)
  const handleGlobalFrequencyChange = useCallback((newGlobal: number) => {
    setGlobalFrequency(newGlobal);
    setVesselFrequencies(prev => {
      const updated: Record<string, number> = {};
      Object.entries(prev).forEach(([vesselId, freq]) => {
        // Only keep vessel overrides that are <= new global
        if (freq <= newGlobal) {
          updated[vesselId] = freq;
        }
        // If freq > newGlobal, it will be removed (defaults back to global)
      });
      return updated;
    });

    // Refresh the frequency column to update dropdowns
    if (gridApiRef.current) {
      setTimeout(() => {
        gridApiRef.current?.refreshCells({
          columns: ['frequencyMonths'],
          force: true
        });
      }, 0);
    }
  }, []);

  const { data: testRecords = [], isLoading: testsLoading } = useDrugAlcoholTests({
    filterType,
    selectedVessels,
    fleetValue,
    addGroupValue,
  });

  const { data: vesselLookup = {}, isLoading: vesselsLoading } = useVessels();
  const { data: vesselsList = [] } = useVesselsList();

  const tableData: AnnualTestData[] = useMemo(() => {
    // Get annual test records indexed by vesselId for quick lookup
    const annualTestsByVessel: Record<string, any> = {};
    const orphanedVesselIds = new Set<string>();
    
    testRecords
      .filter((record: any) => record.testType === 'annual')
      .forEach((record: any) => {
        annualTestsByVessel[record.vesselId] = record;
        // Track vessels that have records but might not be in Master 014
        orphanedVesselIds.add(record.vesselId);
      });

    // Start with all vessels from the master list
    const vesselIdSet = new Set<string>();
    let allVessels = vesselsList.map((vessel: any) => {
      vesselIdSet.add(vessel.vesselId);
      return vessel;
    });

    // Add orphaned vessels (have test records but not in Master 014)
    orphanedVesselIds.forEach((vesselId) => {
      if (!vesselIdSet.has(vesselId)) {
        const record = annualTestsByVessel[vesselId];
        allVessels.push({
          vesselId,
          vesselName: vesselLookup[vesselId] || vesselId,
        });
      }
    });

    // Apply vessel filtering based on filterType
    if (filterType === 'vessel' && selectedVessels.length > 0) {
      allVessels = allVessels.filter((vessel: any) => 
        selectedVessels.includes(vessel.vesselName)
      );
    }
    // Fleet and addGroup filtering can be added here when fleet/group data is available

    // Map all vessels to table data, merging with test records if they exist
    return allVessels.map((vessel: any) => {
      const record = annualTestsByVessel[vessel.vesselId];
      
      let testHistory: TestRecord[] = [];
      if (record) {
        try {
          testHistory = record.testHistory ? JSON.parse(record.testHistory) : [];
        } catch (e) {
          testHistory = [];
        }
      }

      // Calculate initial nextDue based on current frequency (global or vessel-specific)
      const lastTest = testHistory[0];
      const currentFrequency = vesselFrequencies[vessel.vesselId] || (record?.frequencyMonths) || globalFrequency;
      const nextDue = lastTest?.date
        ? format(addMonths(new Date(lastTest.date), currentFrequency), 'yyyy-MM-dd')
        : '';

      return {
        id: record?.id || `vessel-${vessel.vesselId}`,
        vesselId: vessel.vesselId,
        vesselName: vessel.vesselName,
        testHistory: testHistory.slice(0, 3),
        frequencyMonths: record?.frequencyMonths || 12,
        nextDue,
        plannedPort: record?.plannedPort || '',
        plannedDate: record?.plannedDate || '',
        plannedComments: record?.plannedComments || '',
      };
    });
  }, [testRecords, vesselsList, vesselLookup, filterType, selectedVessels, fleetValue, addGroupValue, globalFrequency, vesselFrequencies]);

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    const columns: (ColDef | ColGroupDef)[] = [
      {
        headerName: 'Vessel',
        field: 'vesselName',
        width: 150,
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        sortable: true,
        resizable: false,
      }
    ];

    const historyColumns: ColDef[] = [
      {
        headerName: 'Last',
        field: 'testHistory[0]',
        cellRenderer: TestHistoryCellRenderer,
        valueGetter: (params: any) => params.data?.testHistory?.[0],
      }
    ];

    if (showAllHistory) {
      historyColumns.push(
        {
          headerName: '2nd Last',
          field: 'testHistory[1]',
          cellRenderer: TestHistoryCellRenderer,
          valueGetter: (params: any) => params.data?.testHistory?.[1],
        },
        {
          headerName: '3rd Last',
          field: 'testHistory[2]',
          cellRenderer: TestHistoryCellRenderer,
          valueGetter: (params: any) => params.data?.testHistory?.[2],
        }
      );
    }

    columns.push({
      headerGroupComponent: HistoryHeaderComponent,
      children: historyColumns,
    });

    columns.push(
      {
        headerName: 'Next Due',
        field: 'nextDue',
        cellRenderer: NextDueCellRenderer,
        cellStyle: { fontSize: '12px' },
      },
      {
        headerName: 'Frequency', // Changed from 'frequencyMonths' to 'Frequency' for clarity
        field: 'frequencyMonths', // Still use frequencyMonths for data binding
        cellRenderer: FrequencyCellRenderer,
        headerComponent: FrequencyHeaderComponent, // Moved header component here
      }
    );

    columns.push({
      headerName: 'Test Plan',
      children: [
        {
          headerName: 'Port',
          field: 'plannedPort',
          cellStyle: { fontSize: '12px', color: '#4f5863' },
          editable: true,
        },
        {
          headerName: 'Date',
          field: 'plannedDate',
          cellStyle: { fontSize: '12px', color: '#4f5863' },
          editable: true,
        },
        {
          headerName: 'Comments',
          field: 'plannedComments',
          flex: 1,
          cellStyle: { fontSize: '12px', color: '#4f5863' },
          editable: true,
        },
        {
          headerName: 'Actions',
          field: 'actions',
          cellRenderer: ActionsCellRenderer,
          cellStyle: { padding: 0 },
        },
      ],
    });

    return columns;
  }, [showAllHistory]);

  const context = useMemo(
    () => ({
      showAllHistory,
      setShowAllHistory,
      globalFrequency,
      setGlobalFrequency: handleGlobalFrequencyChange,
      vesselFrequencies,
      setVesselFrequency,
      onAdd,
    }),
    [showAllHistory, globalFrequency, vesselFrequencies, handleGlobalFrequencyChange, setVesselFrequency, onAdd]
  );

  if (testsLoading || vesselsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Static legend for "Due in:" labels
  const staticLegend = [
    { label: '3M', color: '#FFEEAA', textColor: '#000000' },
    { label: '2M', color: '#FFCC00', textColor: '#000000' },
    { label: '1M', color: '#F9ECEF', textColor: '#000000' },
    { label: 'O/D', color: '#D50A0D', textColor: '#FFFFFF' },
  ];

  return (
    <div className="w-full flex flex-col flex-1">
      {/* Static Due In Legend */}
      <div className="flex gap-2 items-center mb-4">
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
      
      <AgGridTable
        rowData={tableData}
        columnDefs={columnDefs}
        context={context}
        loading={testsLoading || vesselsLoading}
        enableSideBar={false}
        enableStatusBar={false}
        rowSelection={false}
        fillAvailableHeight={true}
        bottomPadding={20}
        gridOptions={{
          headerHeight: 48,
          rowHeight: 70,
          suppressHorizontalScroll: false,
          getRowStyle: () => ({ backgroundColor: 'white' }),
          onGridReady: (params) => {
            gridApiRef.current = params.api;
            setGridApi(params.api);
          },
          onFirstDataRendered: () => {
            autoSizeContentColumns();
          },
          onCellValueChanged: async (event: CellValueChangedEvent) => {
            const field = event.colDef.field;
            if (field === 'plannedComments' || field === 'plannedPort' || field === 'plannedDate') {
              try {
                const recordId = event.data.id;
                const updateData = { [field]: event.newValue };
                
                await apiRequest('PUT', `/api/drug-alcohol-tests/${recordId}`, updateData);
                
                queryClient.invalidateQueries({ queryKey: ['/api/drug-alcohol-tests'] });
              } catch (error) {
                console.error('Failed to update test record:', error);
              }
            }
          },
        }}
        className="annual-test-table"
      />
    </div>
  );
};