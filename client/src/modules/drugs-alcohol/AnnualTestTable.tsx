import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColDef, ColGroupDef, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGrid/AgGridTable';
import { Edit, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addMonths } from 'date-fns';

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

const HistoryHeaderComponent = (props: any) => {
  const { showAllHistory, setShowAllHistory } = props.context;

  return (
    <div className="flex items-center justify-center gap-2 h-full">
      <Checkbox
        checked={showAllHistory}
        onCheckedChange={setShowAllHistory}
        className="h-4 w-4"
      />
      <span className="text-white font-semibold">History +</span>
    </div>
  );
};

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

const NextDueCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return null;

  try {
    const date = new Date(params.value);
    const formattedDate = format(date, 'dd MMMM yyyy');

    return (
      <div className="flex items-center h-full">
        <span
          className="px-3 py-1 rounded text-xs font-medium"
          style={{ backgroundColor: '#F1CD1D', color: '#000' }}
        >
          {formattedDate}
        </span>
      </div>
    );
  } catch {
    return <span>{params.value}</span>;
  }
};

const FrequencyCellRenderer = (params: ICellRendererParams) => {
  const [frequency, setFrequency] = useState(params.value || 12);

  const handleChange = (value: string) => {
    const months = parseInt(value);
    setFrequency(months);
  };

  return (
    <div className="flex items-center h-full">
      <Select value={frequency.toString()} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="12">(+12) Months</SelectItem>
          <SelectItem value="6">(+6) Months</SelectItem>
          <SelectItem value="3">(+3) Months</SelectItem>
          <SelectItem value="1">(+1) Month</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

const ActionsCellRenderer = (params: ICellRendererParams) => {
  const handleEdit = () => {
    console.log('Edit test record:', params.data);
  };

  const handleAdd = () => {
    console.log('Add test plan:', params.data);
  };

  return (
    <div className="flex items-center justify-center gap-2 h-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-gray-100"
        onClick={handleEdit}
        data-testid={`button-edit-${params.data.id}`}
      >
        <Edit className="h-4 w-4 text-gray-600" />
      </Button>
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
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);

  const { data: testRecords = [], isLoading: testsLoading } = useDrugAlcoholTests({
    filterType,
    selectedVessels,
    fleetValue,
    addGroupValue,
  });

  const { data: vesselLookup = {}, isLoading: vesselsLoading } = useVessels();

  const tableData: AnnualTestData[] = useMemo(() => {
    const annualTests = testRecords.filter((record: any) => record.testType === 'annual');

    // Apply vessel filtering based on filterType
    const filteredTests = annualTests.filter((record: any) => {
      const vesselName = vesselLookup[record.vesselId] || record.vesselId;
      
      if (filterType === 'vessel') {
        // If no vessels selected, show all
        if (selectedVessels.length === 0) return true;
        // Otherwise, show only selected vessels
        return selectedVessels.includes(vesselName);
      } else if (filterType === 'fleet') {
        // Fleet filtering (placeholder - would need fleet group data)
        return true;
      } else if (filterType === 'addGroup') {
        // Additional group filtering (placeholder - would need group data)
        return true;
      }
      
      return true;
    });

    return filteredTests.map((record: any) => {
      let testHistory: TestRecord[] = [];
      try {
        testHistory = record.testHistory ? JSON.parse(record.testHistory) : [];
      } catch (e) {
        testHistory = [];
      }

      const lastTest = testHistory[0];
      const nextDue = lastTest?.date 
        ? format(addMonths(new Date(lastTest.date), record.frequencyMonths || 12), 'yyyy-MM-dd')
        : '';

      return {
        id: record.id,
        vesselId: record.vesselId,
        vesselName: vesselLookup[record.vesselId] || record.vesselId,
        testHistory: testHistory.slice(0, 3),
        frequencyMonths: record.frequencyMonths || 12,
        nextDue,
        plannedPort: record.plannedPort || '',
        plannedDate: record.plannedDate || '',
        plannedComments: record.plannedComments || '',
      };
    });
  }, [testRecords, vesselLookup, filterType, selectedVessels, fleetValue, addGroupValue]);

  const columnDefs: (ColDef | ColGroupDef)[] = useMemo(() => {
    const columns: (ColDef | ColGroupDef)[] = [
      {
        headerName: 'Vessel',
        field: 'vesselName',
        width: 150,
        pinned: 'left',
        cellStyle: { fontSize: '13px', color: '#4f5863' },
        sortable: true,
        resizable: false,
      }
    ];

    const historyColumns: ColDef[] = [
      {
        headerName: 'Last',
        field: 'testHistory[0]',
        width: 150,
        cellRenderer: TestHistoryCellRenderer,
        valueGetter: (params: any) => params.data?.testHistory?.[0],
      }
    ];

    if (showAllHistory) {
      historyColumns.push(
        {
          headerName: '2nd Last',
          field: 'testHistory[1]',
          width: 150,
          cellRenderer: TestHistoryCellRenderer,
          valueGetter: (params: any) => params.data?.testHistory?.[1],
        },
        {
          headerName: '3rd Last',
          field: 'testHistory[2]',
          width: 150,
          cellRenderer: TestHistoryCellRenderer,
          valueGetter: (params: any) => params.data?.testHistory?.[2],
        }
      );
    }

    columns.push({
      headerName: 'History +',
      headerComponent: HistoryHeaderComponent,
      children: historyColumns,
    });

    columns.push(
      {
        headerName: 'Next Due',
        field: 'nextDue',
        width: 180,
        cellRenderer: NextDueCellRenderer,
        cellStyle: { fontSize: '12px' },
      },
      {
        headerName: 'Frequency',
        field: 'frequencyMonths',
        width: 150,
        cellRenderer: FrequencyCellRenderer,
      }
    );

    columns.push({
      headerName: 'Test Plan',
      children: [
        {
          headerName: 'Port',
          field: 'plannedPort',
          width: 120,
          cellStyle: { fontSize: '12px', color: '#4f5863' },
          editable: true,
        },
        {
          headerName: 'Date',
          field: 'plannedDate',
          width: 120,
          cellStyle: { fontSize: '12px', color: '#4f5863' },
          editable: true,
        },
        {
          headerName: 'Comments',
          field: 'plannedComments',
          width: 150,
          cellStyle: { fontSize: '12px', color: '#4f5863' },
          editable: true,
        },
        {
          headerName: 'Actions',
          field: 'actions',
          width: 100,
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
    }),
    [showAllHistory]
  );

  if (testsLoading || vesselsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: 'calc(100vh - 250px)' }}>
      <AgGridTable
        rowData={tableData}
        columnDefs={columnDefs}
        context={context}
        height="100%"
        loading={testsLoading || vesselsLoading}
        enableSideBar={false}
        enableStatusBar={false}
        rowSelection={false}
        gridOptions={{
          headerHeight: 48,
          rowHeight: 70,
          suppressHorizontalScroll: false,
          getRowStyle: () => ({ backgroundColor: 'white' }),
        }}
      />
      <style>{`
        .ag-header-cell,
        .ag-header-group-cell {
          background-color: #52baf3 !important;
          color: white !important;
          font-weight: 600 !important;
        }
        
        .ag-header-cell-label {
          justify-content: center !important;
        }
      `}</style>
    </div>
  );
};
