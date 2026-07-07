import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { ArrowLeft, Pencil, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import SectionTitleComponents from '@/components/Section/SectionTitleComponents';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useViewport } from '@/hooks/useViewport';

type DACategory = 'annual' | 'periodic' | 'monthly' | 'post-incident' | 'others';

interface HistoryTableProps {
  onOpenRecord: (t: DACategory, vesselId?: string, recordUuid?: string) => void;
}

interface DARecord {
  id: number;
  daUuid?: string;
  vesselId: string;
  testType: string;
  status?: string;
  dateTimeTestCompleted?: string;
  alcoholDrugType?: any;
  reasonForTesting?: string;
  description?: string;
  initiatedBy?: string;
  personnelTested?: any;
  incidentTitle?: string;
  incidentDateTime?: string;
  alcoholTestDateTime?: string;
  drugTestDateTime?: string;
}

const CATS: { key: DACategory; label: string }[] = [
  { key: 'annual', label: 'Annual' },
  { key: 'periodic', label: 'Periodic' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'post-incident', label: 'Post Incident' },
  { key: 'others', label: 'Others' },
];

const TITLES: Record<DACategory, string> = {
  annual: 'Annual DA Test Records',
  periodic: 'Periodic DA Test Records',
  monthly: 'Monthly DA Test Records',
  'post-incident': 'Post Incident DA Test Records',
  others: 'Other DA Test Records',
};

const ALL_VESSELS = '__all__';

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

function calculateHoursDifference(incidentDateTime: string, testDateTime: string): string {
  try {
    const parseDateTime = (dtStr: string): Date => {
      const isoDate = new Date(dtStr);
      if (!isNaN(isoDate.getTime())) return isoDate;

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

    if (isNaN(incidentDate.getTime()) || isNaN(testDate.getTime())) return 'N/A';

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

function parseTestDate(dateStr?: string): Date | null {
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
}

const CountCellRenderer = (p: ICellRendererParams) => {
  const n = p.value || 0;
  const { openRecords } = p.context || {};
  if (n === 0) {
    return <span className="text-gray-300 cursor-default">0</span>;
  }
  return (
    <button
      className="text-[#16569e] font-semibold hover:underline"
      onClick={() => openRecords?.(p.colDef!.field as DACategory, p.data.vesselId)}
      data-testid={`count-${p.colDef!.field}-${p.data.vesselId}`}
    >
      {n}
    </button>
  );
};

const ViolationsCellRenderer = (props: ICellRendererParams) => {
  const value = props.value || 0;
  let colorClass = 'text-green-600 dark:text-green-400';

  if (value === 1) {
    colorClass = 'text-orange-600 dark:text-orange-400';
  } else if (value >= 2) {
    colorClass = 'text-red-600 dark:text-red-400';
  }

  return <div className={`font-semibold ${colorClass}`}>{value}</div>;
};

const DescriptionCellRenderer = (props: ICellRendererParams) => {
  const value = props.value || '';

  if (!value) {
    return <div className="text-[13px]"></div>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="text-[13px] truncate cursor-default max-w-full">{value}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[400px] whitespace-normal">
        <p>{value}</p>
      </TooltipContent>
    </Tooltip>
  );
};

const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { onEdit } = props.context || {};
  if (!onEdit) return null;

  const handleEdit = () => {
    const recordId = props.data?.daUuid;
    if (recordId) {
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

export function HistoryTable_v2({ onOpenRecord }: HistoryTableProps) {
  const overviewGridRef = useRef<AgGridReact>(null);
  const recordsGridRef = useRef<AgGridReact>(null);
  const { canEdit, userType, myVessels, permissions } = usePermissions();
  const isShipUser = userType === 'Ship';
  const viewport = useViewport();
  const isPhone = viewport === 'phone';

  const [view, setView] = useState<'overview' | 'records'>('overview');
  const [category, setCategory] = useState<DACategory>('annual');
  const [openedVesselId, setOpenedVesselId] = useState<string>('');
  const [vesselFilter, setVesselFilter] = useState<string>('');
  const [draftVessel, setDraftVessel] = useState<string>(ALL_VESSELS);
  const [recordsVesselFilter, setRecordsVesselFilter] = useState<string>('');
  const [recordsDraftVessel, setRecordsDraftVessel] = useState<string>('');
  const [showFilters, setShowFilters] = useState(true);

  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<Array<{ vesselUuid: string; vessel: string }>>({
    queryKey: ['/api/v2/vessel/list'],
  });

  const { data: testRecords = [] } = useQuery<DARecord[]>({
    queryKey: ['v2', 'drugs-alcohol', 'test-records'],
    queryFn: async () => {
      const r = await fetch('/api/v2/drugs-alcohol/test-records');
      if (!r.ok) throw new Error('Failed to fetch drug alcohol tests');
      return r.json();
    },
  });

  const vesselMap = useMemo(() => new Map(vessels.map((v) => [v.vesselUuid, v.vessel])), [vessels]);

  const submitted = useMemo(() => testRecords.filter((r) => r.status !== 'draft'), [testRecords]);

  const shipUserVesselName = useMemo(() => {
    if (!isShipUser || myVessels.length === 0) return null;
    return myVessels[0].vessel;
  }, [isShipUser, myVessels]);

  useEffect(() => {
    if (isShipUser && myVessels.length > 0 && vessels.length > 0) {
      const myName = myVessels[0].vessel;
      const matched = vessels.find((v) => v.vessel === myName);
      if (matched) {
        setVesselFilter(matched.vesselUuid);
        setDraftVessel(matched.vesselUuid);
        setOpenedVesselId(matched.vesselUuid);
        setRecordsVesselFilter(matched.vesselUuid);
        setRecordsDraftVessel(matched.vesselUuid);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShipUser, myVessels, vessels]);

  const openRecords = (cat: DACategory, vesselId: string) => {
    setCategory(cat);
    setOpenedVesselId(vesselId);
    setRecordsVesselFilter(vesselId);
    setRecordsDraftVessel(vesselId);
    setView('records');
  };

  const handleApply = () => {
    if (view === 'records') {
      setRecordsVesselFilter(recordsDraftVessel === ALL_VESSELS ? '' : recordsDraftVessel);
    } else {
      setVesselFilter(draftVessel === ALL_VESSELS ? '' : draftVessel);
    }
  };

  const handleClear = () => {
    if (view === 'records') {
      setRecordsDraftVessel(openedVesselId);
      setRecordsVesselFilter(openedVesselId);
    } else {
      setDraftVessel(ALL_VESSELS);
      setVesselFilter('');
    }
  };

  const overviewRows = useMemo(() => {
    return vessels
      .filter((v) => (vesselFilter === '' ? true : v.vesselUuid === vesselFilter))
      .map((v) => {
        const recs = submitted.filter((r) => r.vesselId === v.vesselUuid);
        const row: any = { vesselId: v.vesselUuid, vesselName: v.vessel };
        for (const c of CATS) {
          row[c.key] = recs.filter((r) => r.testType === c.key).length;
        }
        return row;
      });
  }, [vessels, submitted, vesselFilter]);

  const overviewColumnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      {
        headerName: 'Vessel',
        field: 'vesselName',
        flex: 1.4,
        minWidth: 160,
        cellClass: 'flex items-center text-[13px]',
      },
    ];
    for (const c of CATS) {
      cols.push({
        headerName: c.label,
        field: c.key,
        flex: 1,
        minWidth: 120,
        cellRenderer: CountCellRenderer,
        cellClass: 'flex items-center text-[13px]',
      });
    }
    return cols;
  }, []);

  const getSortDate = (record: DARecord): Date | null => {
    if (category === 'post-incident') {
      return parseTestDate(record.alcoholTestDateTime);
    }
    return parseTestDate(record.dateTimeTestCompleted);
  };

  const recordRows = useMemo(() => {
    const filtered = submitted.filter(
      (r) => r.testType === category && (recordsVesselFilter === '' ? true : r.vesselId === recordsVesselFilter),
    );

    const sorted = [...filtered].sort((a, b) => {
      const dateA = getSortDate(a);
      const dateB = getSortDate(b);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.getTime() - dateA.getTime();
    });

    return sorted.map((record) => ({
      id: record.id,
      daUuid: record.daUuid || null,
      testDateTime: formatDateTime(record.dateTimeTestCompleted || ''),
      testType: parseAlcoholDrugType(record.alcoholDrugType),
      reasonForTesting: record.reasonForTesting || '',
      description: record.description || '',
      initiatedBy: record.initiatedBy || '',
      violations: calculateViolations(record.personnelTested),
      incidentTitle: record.incidentTitle || '',
      incidentDateTime: record.incidentDateTime || '',
      alcoholTestDateTime: record.alcoholTestDateTime || '',
      alcoholTestPeriod:
        record.incidentDateTime && record.alcoholTestDateTime
          ? calculateHoursDifference(record.incidentDateTime, record.alcoholTestDateTime)
          : 'N/A',
      drugTestDateTime: record.drugTestDateTime || '',
      drugTestPeriod:
        record.incidentDateTime && record.drugTestDateTime
          ? calculateHoursDifference(record.incidentDateTime, record.drugTestDateTime)
          : 'N/A',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, category, recordsVesselFilter]);

  const actionColumn: ColDef = {
    headerName: '',
    flex: 0.4,
    minWidth: 60,
    cellRenderer: ActionsCellRenderer,
    cellClass: 'flex items-center justify-center',
    sortable: false,
    filter: false,
  };

  const recordsColumnDefs = useMemo<ColDef[]>(() => {
    if (category === 'others') {
      return [
        { headerName: 'Test Date & Time', field: 'testDateTime', flex: 1.2, minWidth: 140, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Test Type', field: 'testType', flex: 0.8, minWidth: 100, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Reason for Testing', field: 'reasonForTesting', flex: 1.2, minWidth: 150, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Description', field: 'description', flex: 1.5, minWidth: 200, cellRenderer: DescriptionCellRenderer, cellClass: 'flex items-center overflow-hidden' },
        { headerName: 'Initiated By', field: 'initiatedBy', flex: 1.2, minWidth: 140, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Violations', field: 'violations', flex: 0.6, minWidth: 80, cellRenderer: ViolationsCellRenderer, cellClass: 'flex items-center justify-center text-[13px]' },
        actionColumn,
      ];
    }

    if (category === 'post-incident') {
      return [
        { headerName: 'Incident Title', field: 'incidentTitle', flex: 1.5, minWidth: 180, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Incident Date & Time', field: 'incidentDateTime', flex: 1.2, minWidth: 150, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Alcohol test Date & Time', field: 'alcoholTestDateTime', flex: 1.2, minWidth: 150, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Alcohol Test Period', field: 'alcoholTestPeriod', flex: 0.8, minWidth: 100, cellClass: 'flex items-center text-[13px] font-medium' },
        { headerName: 'Drug test Date & Time', field: 'drugTestDateTime', flex: 1.2, minWidth: 150, cellClass: 'flex items-center text-[13px]' },
        { headerName: 'Drug Test Period', field: 'drugTestPeriod', flex: 0.8, minWidth: 100, cellClass: 'flex items-center text-[13px] font-medium' },
        { headerName: 'Violations', field: 'violations', flex: 0.6, minWidth: 80, cellRenderer: ViolationsCellRenderer, cellClass: 'flex items-center justify-center text-[13px]' },
        actionColumn,
      ];
    }

    return [
      { headerName: 'Test Date & Time', field: 'testDateTime', flex: 1.2, minWidth: 140, cellClass: 'flex items-center text-[13px]' },
      { headerName: 'Test Type', field: 'testType', flex: 0.8, minWidth: 100, cellClass: 'flex items-center text-[13px]' },
      { headerName: 'Initiated By', field: 'initiatedBy', flex: 1.2, minWidth: 140, cellClass: 'flex items-center text-[13px]' },
      { headerName: 'Violations', field: 'violations', flex: 0.6, minWidth: 80, cellRenderer: ViolationsCellRenderer, cellClass: 'flex items-center justify-center text-[13px]' },
      actionColumn,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const canEditHistory = permissions.length === 0 || canEdit('History');
  const recordsContext = useMemo(
    () => ({
      onEdit: canEditHistory ? (recordId: string) => onOpenRecord(category, undefined, recordId) : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEditHistory, category, onOpenRecord],
  );

  const recordsTitle = `${TITLES[category]} - ${
    recordsVesselFilter === '' ? 'All Vessels' : vesselMap.get(recordsVesselFilter) ?? ''
  }`;

  const renderFilterBar = () => {
    if (!showFilters) return null;

    return (
      <div
        className={`flex mb-4 bg-transparent rounded-lg ${isPhone ? 'flex-col gap-3 p-3' : 'flex-wrap gap-4 p-4 pl-0'}`}
        data-testid="filter-container"
      >
        <div className={`flex gap-2 ${isPhone ? 'flex-col' : 'items-center'}`}>
          <Label className="text-xs font-normal text-[#4f5863] dark:text-neutral-300">Vessel</Label>
          {isShipUser ? (
            <span
              className="h-8 flex items-center text-xs font-medium text-[#0f172a] dark:text-white px-3 bg-gray-50 dark:bg-neutral-800 border border-input rounded-md min-w-[120px]"
              data-testid="text-vessel-history-locked"
            >
              {shipUserVesselName || 'No vessel assigned'}
            </span>
          ) : (
            <Select
              value={view === 'records' ? recordsDraftVessel : draftVessel}
              onValueChange={view === 'records' ? setRecordsDraftVessel : setDraftVessel}
              disabled={vesselsLoading}
            >
              <SelectTrigger
                className={`h-8 text-xs bg-white dark:bg-neutral-900 border-input ${isPhone ? 'w-full' : 'w-48'}`}
                data-testid="select-vessel-history"
              >
                <SelectValue placeholder={vesselsLoading ? 'Loading...' : 'Select Vessel'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VESSELS} data-testid="option-vessel-all">
                  All Vessels
                </SelectItem>
                {vessels.map((vessel) => (
                  <SelectItem key={vessel.vesselUuid} value={vessel.vesselUuid} data-testid={`option-vessel-${vessel.vesselUuid}`}>
                    {vessel.vessel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {!isShipUser && (
          <>
            <Button
              variant="default"
              onClick={handleApply}
              className={`h-8 text-[11px] ${isPhone ? 'w-full' : 'w-16'} bg-[#16569e] hover:bg-[#0d4a8f] text-white`}
              data-testid="button-apply-history"
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              className={`h-8 text-[#8798ad] text-[11px] border-[#e1e8ed] ${isPhone ? 'w-full' : 'w-16'}`}
              data-testid="button-clear-history"
            >
              Clear
            </Button>
          </>
        )}
      </div>
    );
  };

  if (view === 'records') {
    return (
      <>
        <SectionTitleComponents title={recordsTitle}>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('overview')}
              className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
              data-testid="button-history-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </SectionTitleComponents>
        {renderFilterBar()}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-t-md overflow-hidden">
            <div className="ag-theme-alpine dark:ag-theme-alpine-dark h-full">
              <AgGridReact
                ref={recordsGridRef}
                rowData={recordRows}
                columnDefs={recordsColumnDefs}
                defaultColDef={{ filter: true }}
                gridOptions={{ theme: 'legacy' }}
                domLayout="normal"
                headerHeight={40}
                rowHeight={50}
                suppressCellFocus={true}
                suppressRowHoverHighlight={false}
                enableCellTextSelection={true}
                context={recordsContext}
                data-testid="grid-history-records"
              />
            </div>
          </div>
          <div className="px-4 py-2 border border-t-0 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-md flex items-center text-xs text-gray-500">
            <div data-testid="text-history-rows">Rows: {recordRows.length}</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SectionTitleComponents title="History">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-8 gap-2 bg-white dark:bg-gray-800 text-[#0f172a] dark:text-white border-gray-300 dark:border-gray-600"
          data-testid="button-toggle-filters"
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </SectionTitleComponents>
      {renderFilterBar()}
      <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <div className="ag-theme-alpine dark:ag-theme-alpine-dark h-full">
          <AgGridReact
            ref={overviewGridRef}
            rowData={overviewRows}
            columnDefs={overviewColumnDefs}
            defaultColDef={{ filter: true }}
            gridOptions={{ theme: 'legacy' }}
            domLayout="normal"
            headerHeight={40}
            rowHeight={50}
            suppressCellFocus={true}
            suppressRowHoverHighlight={false}
            enableCellTextSelection={true}
            context={{ openRecords }}
            data-testid="grid-history-overview"
          />
        </div>
      </div>
    </>
  );
}
