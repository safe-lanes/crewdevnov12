import React, { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { 
  ColDef, 
  GridReadyEvent, 
  GridApi, 
  ICellRendererParams, 
  ModuleRegistry,
  GridOptions
} from 'ag-grid-community';
import { 
  AllEnterpriseModule,
  SetFilterModule,
  MultiFilterModule,
  MenuModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  StatusBarModule,
  SideBarModule,
  RangeSelectionModule,
  RowGroupingModule,
  AggregationModule,
  PivotModule,
  MasterDetailModule,
  ViewportRowModelModule,
  ServerSideRowModelModule,
  InfiniteRowModelModule,
  ExcelExportModule,
  CsvExportModule,
  ClipboardModule,
  AdvancedFilterModule,
  LicenseManager
} from 'ag-grid-enterprise';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// Set AG Grid Enterprise License
if (import.meta.env.VITE_AG_GRID_LICENSE_KEY) {
  LicenseManager.setLicenseKey(import.meta.env.VITE_AG_GRID_LICENSE_KEY);
}

// Register AG Grid Enterprise modules
ModuleRegistry.registerModules([
  AllEnterpriseModule,
  SetFilterModule,
  MultiFilterModule,
  MenuModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  StatusBarModule,
  SideBarModule,
  RangeSelectionModule,
  RowGroupingModule,
  AggregationModule,
  PivotModule,
  MasterDetailModule,
  ViewportRowModelModule,
  ServerSideRowModelModule,
  InfiniteRowModelModule,
  ExcelExportModule,
  CsvExportModule,
  ClipboardModule,
  AdvancedFilterModule
]);

export interface AgGridTableProps {
  rowData: any[];
  columnDefs: ColDef[];
  onGridReady?: (event: GridReadyEvent) => void;
  context?: any;
  height?: string | number;
  width?: string | number;
  className?: string;
  enableExport?: boolean;
  enableSideBar?: boolean;
  enableStatusBar?: boolean;
  enableRowGrouping?: boolean;
  enablePivoting?: boolean;
  enableAdvancedFilter?: boolean;
  rowSelection?: 'single' | 'multiple' | false;
  theme?: 'alpine' | 'balham' | 'material' | 'legacy';
  gridOptions?: Partial<GridOptions>;
  autoHeight?: boolean;
  maxHeight?: string | number;
  minHeight?: string | number;
}

export const AgGridTable: React.FC<AgGridTableProps> = ({
  rowData,
  columnDefs,
  onGridReady,
  context,
  height = '500px',
  width = '100%',
  className = '',
  enableExport = true,
  enableSideBar = true,
  enableStatusBar = true,
  enableRowGrouping = false,
  enablePivoting = true,
  enableAdvancedFilter = false,
  rowSelection = 'single',
  theme = 'alpine',
  gridOptions = {},
  autoHeight = false,
  maxHeight = '600px',
  minHeight = '200px'
}) => {

  // Default column definitions with enterprise features
  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    menuTabs: ['filterMenuTab', 'generalMenuTab', 'columnsMenuTab'],
    floatingFilter: false
  }), []);

  // Side bar configuration
  const sideBar = useMemo(() => {
    if (!enableSideBar) return false;

    return {
      toolPanels: [
        {
          id: 'columns',
          labelDefault: 'Columns',
          labelKey: 'columns',
          iconKey: 'columns',
          toolPanel: 'agColumnsToolPanel',
          toolPanelParams: {
            suppressRowGroups: !enableRowGrouping,
            suppressValues: false,
            suppressPivots: !enablePivoting,
            suppressPivotMode: !enablePivoting,
            suppressColumnFilter: false,
            suppressColumnSelectAll: false,
            suppressColumnExpandAll: false
          }
        },
        {
          id: 'filters',
          labelDefault: 'Filters',
          labelKey: 'filters',
          iconKey: 'filter',
          toolPanel: 'agFiltersToolPanel'
        }
      ],
      defaultToolPanel: 'columns'
    };
  }, [enableSideBar, enableRowGrouping, enablePivoting]);

  // Status bar configuration
  const statusBar = useMemo(() => {
    if (!enableStatusBar) return undefined;

    return {
      statusPanels: [
        {
          statusPanel: 'agTotalAndFilteredRowCountComponent',
          align: 'left' as const
        },
        {
          statusPanel: 'agAggregationComponent',
          align: 'center' as const
        },
        {
          statusPanel: 'agSelectedRowCountComponent',
          align: 'right' as const
        }
      ]
    };
  }, [enableStatusBar]);

  // Row selection configuration
  const rowSelectionConfig = useMemo(() => {
    if (rowSelection === false) return false;

    return {
      mode: rowSelection === 'single' ? 'singleRow' : 'multiRow',
      enableClickSelection: true
    };
  }, [rowSelection]);

  // Default grid options with enterprise features
  const defaultGridOptions: Partial<GridOptions> = useMemo(() => ({
    theme: 'legacy', // Use legacy theme to avoid theming API conflicts
    defaultColDef,
    headerHeight: 50,
    rowHeight: 50,
    suppressHorizontalScroll: false,
    animateRows: true,
    rowSelection: rowSelectionConfig,
    getRowStyle: () => ({ backgroundColor: 'white' }),
    cellSelection: true,
    enableAdvancedFilter,
    sideBar,
    statusBar,
    allowContextMenuWithControlKey: true,
    copyHeadersToClipboard: true,
    copyGroupHeadersToClipboard: true,
    enableCellTextSelection: true,
    enableBrowserTooltips: false,
    tooltipShowDelay: 2000,
    rowGroupPanelShow: 'never',
    pivotPanelShow: enablePivoting ? 'always' : 'never',
    functionsReadOnly: false,
    suppressAggFuncInHeader: false,
    alwaysShowHorizontalScroll: false,
    alwaysShowVerticalScroll: false,
    debug: false
  }), [
    defaultColDef,
    rowSelectionConfig,
    enableAdvancedFilter,
    sideBar,
    statusBar,
    enableRowGrouping,
    enablePivoting
  ]);

  // Calculate dynamic height based on row count and screen size
  const dynamicHeight = useMemo(() => {
    if (!autoHeight) return height;
    
    const headerHeight = 50; // Header row height
    const rowHeight = 50; // Data row height
    const footerHeight = enableStatusBar ? 40 : 0; // Status bar height
    const padding = 4; // Container padding
    
    const calculatedHeight = headerHeight + (rowData.length * rowHeight) + footerHeight + padding;
    
    // Get available screen height (subtract header, margins, etc.)
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const reservedHeight = 200; // Reserve space for header, margins, padding, etc.
    const availableHeight = screenHeight - reservedHeight;
    
    // Convert maxHeight and minHeight to numbers for comparison
    const maxHeightNum = typeof maxHeight === 'string' ? parseInt(maxHeight) : maxHeight;
    const minHeightNum = typeof minHeight === 'string' ? parseInt(minHeight) : minHeight;
    
    // Use the smaller of calculated height, available screen height, or maxHeight
    const effectiveMaxHeight = Math.min(maxHeightNum, availableHeight);
    const constrainedHeight = Math.max(minHeightNum, Math.min(calculatedHeight, effectiveMaxHeight));
    
    return `${constrainedHeight}px`;
  }, [autoHeight, height, rowData.length, enableStatusBar, maxHeight, minHeight]);

  // Merge default options with provided options
  const finalGridOptions = useMemo(() => {
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const reservedHeight = 200;
    const availableHeight = screenHeight - reservedHeight;
    const calculatedHeight = 50 + (rowData.length * 50) + (enableStatusBar ? 40 : 0) + 4;
    
    return {
      ...defaultGridOptions,
      ...gridOptions,
      ...(autoHeight && calculatedHeight > availableHeight && {
        alwaysShowVerticalScroll: true
      })
    };
  }, [defaultGridOptions, gridOptions, autoHeight, rowData.length, enableStatusBar]);

  return (
    <div 
      className={`ag-theme-${theme} bg-white rounded-lg shadow-md overflow-hidden ${className}`} 
      style={{ height: dynamicHeight, width }}
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        onGridReady={onGridReady}
        context={context}
        {...finalGridOptions}
      />
    </div>
  );
};

// Export functions for common AG Grid operations
export const agGridUtils = {
  exportToCsv: (gridApi: GridApi, filename = 'data.csv') => {
    gridApi.exportDataAsCsv({ fileName: filename });
  },

  exportToExcel: (gridApi: GridApi, filename = 'data.xlsx') => {
    gridApi.exportDataAsExcel({ fileName: filename });
  },

  clearFilters: (gridApi: GridApi) => {
    gridApi.setFilterModel(null);
  },

  resetColumns: (gridApi: GridApi) => {
    gridApi.resetColumnState();
  },

  expandAllGroups: (gridApi: GridApi) => {
    // Check if there are any row groups first
    const rowGroupCols = gridApi.getRowGroupColumns();
    if (rowGroupCols && rowGroupCols.length > 0) {
      gridApi.expandAll();
    } else {
      console.warn('No row groups found. Drag a column to the row group panel to create groups first.');
    }
  },

  collapseAllGroups: (gridApi: GridApi) => {
    // Check if there are any row groups first
    const rowGroupCols = gridApi.getRowGroupColumns();
    if (rowGroupCols && rowGroupCols.length > 0) {
      gridApi.collapseAll();
    } else {
      console.warn('No row groups found. Drag a column to the row group panel to create groups first.');
    }
  },

  hasRowGroups: (gridApi: GridApi) => {
    const rowGroupCols = gridApi.getRowGroupColumns();
    return rowGroupCols && rowGroupCols.length > 0;
  },

  getSelectedRows: (gridApi: GridApi) => {
    return gridApi.getSelectedRows();
  },

  selectAll: (gridApi: GridApi) => {
    gridApi.selectAll();
  },

  deselectAll: (gridApi: GridApi) => {
    gridApi.deselectAll();
  }
};

export default AgGridTable;