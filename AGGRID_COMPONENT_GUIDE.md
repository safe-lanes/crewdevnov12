# AG Grid Enterprise Component Guide

This guide explains how to use the reusable AG Grid Enterprise components across the project.

## Components Overview

### 1. AgGridTable Component
**Location**: `client/src/components/AgGridTable.tsx`

A fully-featured AG Grid Enterprise wrapper with all enterprise features pre-configured.

#### Features
- ✅ AG Grid Enterprise with license key integration
- ✅ Advanced filtering (Set, Multi, Text, Number, Date filters)
- ✅ Floating filters on all columns
- ✅ Row grouping and aggregation
- ✅ Pivoting capabilities
- ✅ Side panel with Columns and Filters tools
- ✅ Status bar with row counts and aggregation info
- ✅ Excel and CSV export functionality
- ✅ Cell selection and range selection
- ✅ Context menu support
- ✅ Clipboard operations
- ✅ Customizable theme support

#### Basic Usage

```tsx
import AgGridTable from '@/components/AgGridTable';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';

// Define your column definitions
const columnDefs: ColDef[] = [
  {
    headerName: 'Name',
    field: 'name',
    filter: 'agTextColumnFilter',
    floatingFilter: true,
    enableRowGroup: true
  },
  {
    headerName: 'Age',
    field: 'age',
    filter: 'agNumberColumnFilter',
    floatingFilter: true,
    enableValue: true,
    aggFunc: 'avg'
  }
];

// Your component
const MyComponent = () => {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  
  const onGridReady = (event: GridReadyEvent) => {
    setGridApi(event.api);
  };

  return (
    <AgGridTable
      rowData={myData}
      columnDefs={columnDefs}
      onGridReady={onGridReady}
      height="500px"
      enableExport={true}
      enableSideBar={true}
      enableStatusBar={true}
      rowSelection="single"
    />
  );
};
```

#### Props Interface

```tsx
interface AgGridTableProps {
  rowData: any[];                    // Required: Your data array
  columnDefs: ColDef[];             // Required: Column definitions
  onGridReady?: (event: GridReadyEvent) => void;
  context?: any;                    // Context passed to cell renderers
  height?: string | number;         // Default: '500px'
  width?: string | number;          // Default: '100%'
  className?: string;               // Additional CSS classes
  enableExport?: boolean;           // Default: true
  enableSideBar?: boolean;          // Default: true
  enableStatusBar?: boolean;        // Default: true
  enableRowGrouping?: boolean;      // Default: true
  enablePivoting?: boolean;         // Default: true
  enableAdvancedFilter?: boolean;   // Default: false
  rowSelection?: 'single' | 'multiple' | false; // Default: 'single'
  theme?: 'alpine' | 'balham' | 'material' | 'legacy'; // Default: 'alpine'
  gridOptions?: Partial<GridOptions>; // Override any grid options
}
```

### 2. AgGridTableActions Component
**Location**: `client/src/components/AgGridTableActions.tsx`

Pre-built action buttons for common AG Grid operations.

#### Usage

```tsx
import AgGridTableActions from '@/components/AgGridTableActions';

<AgGridTableActions 
  gridApi={gridApi}
  exportFilename="my-data"
  showExportButtons={true}
  showFilterButtons={true}
  showGroupButtons={true}
  showSelectionButtons={false}
/>
```

#### Available Actions
- **Export Buttons**: CSV and Excel export
- **Filter Buttons**: Clear all filters
- **Group Buttons**: Expand/Collapse all groups
- **Selection Buttons**: Select/Deselect all rows

## Column Definition Examples

### Basic Column with Enterprise Features
```tsx
{
  headerName: 'Employee Name',
  field: 'name',
  width: 200,
  filter: 'agTextColumnFilter',    // Text filter
  floatingFilter: true,            // Show floating filter
  sortable: true,
  resizable: true,
  enableRowGroup: true,            // Enable row grouping
  pinned: 'left'                   // Pin to left
}
```

### Numeric Column with Aggregation
```tsx
{
  headerName: 'Salary',
  field: 'salary',
  width: 120,
  filter: 'agNumberColumnFilter',  // Number filter
  floatingFilter: true,
  sortable: true,
  resizable: true,
  enableValue: true,               // Enable as value column
  aggFunc: 'sum',                  // Aggregation function
  valueFormatter: (params) => 
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(params.value)
}
```

### Set Filter Column (Great for Categories)
```tsx
{
  headerName: 'Department',
  field: 'department',
  width: 150,
  filter: 'agSetColumnFilter',     // Set filter (dropdown with checkboxes)
  floatingFilter: true,
  enableRowGroup: true,
  cellStyle: { fontWeight: 'bold' }
}
```

### Date Column
```tsx
{
  headerName: 'Start Date',
  field: 'startDate',
  width: 130,
  filter: 'agDateColumnFilter',    // Date filter
  floatingFilter: true,
  sortable: true,
  valueFormatter: (params) => 
    new Date(params.value).toLocaleDateString()
}
```

### Custom Cell Renderer
```tsx
{
  headerName: 'Status',
  field: 'status',
  width: 100,
  cellRenderer: (params) => {
    const status = params.value;
    const color = status === 'Active' ? 'green' : 'red';
    return `<span style="color: ${color}; font-weight: bold;">${status}</span>`;
  },
  filter: 'agSetColumnFilter',
  floatingFilter: true
}
```

## Utility Functions

The `agGridUtils` object provides common operations:

```tsx
import { agGridUtils } from '@/components/AgGridTable';

// Export data
agGridUtils.exportToCsv(gridApi, 'my-export.csv');
agGridUtils.exportToExcel(gridApi, 'my-export.xlsx');

// Filter operations
agGridUtils.clearFilters(gridApi);

// Column operations
agGridUtils.resetColumns(gridApi);

// Group operations
agGridUtils.expandAllGroups(gridApi);
agGridUtils.collapseAllGroups(gridApi);

// Selection operations
agGridUtils.selectAll(gridApi);
agGridUtils.deselectAll(gridApi);
const selectedRows = agGridUtils.getSelectedRows(gridApi);
```

## Styling

The component uses the existing CSS styling in `client/src/index.css` which includes:
- Blue header background (#52baf3) with white text and icons
- Consistent row styling and hover effects
- Rounded corners and shadows
- White filter icons to match the header theme

## License Configuration

The component automatically configures the AG Grid Enterprise license using the `VITE_AG_GRID_LICENSE_KEY` environment variable. If no license is provided, it runs in trial mode.

## Migration from Regular AG Grid

To migrate existing AG Grid implementations:

1. **Replace imports**:
   ```tsx
   // Old
   import { AgGridReact } from 'ag-grid-react';
   
   // New
   import AgGridTable from '@/components/AgGridTable';
   ```

2. **Update JSX**:
   ```tsx
   // Old
   <AgGridReact
     rowData={data}
     columnDefs={columns}
     // ... many props
   />
   
   // New
   <AgGridTable
     rowData={data}
     columnDefs={columns}
     height="500px"
     enableExport={true}
   />
   ```

3. **Update column definitions** to use enterprise features:
   ```tsx
   // Add enterprise filter types
   filter: 'agSetColumnFilter',
   floatingFilter: true,
   enableRowGroup: true,
   enableValue: true,
   aggFunc: 'sum'
   ```

## Best Practices

1. **Always specify filter types** for better UX
2. **Use floating filters** for quick filtering
3. **Enable row grouping** on categorical columns
4. **Use set filters** for columns with limited unique values
5. **Configure aggregation** on numeric columns
6. **Pin important columns** to left or right
7. **Use the actions component** for consistent UI
8. **Leverage the utility functions** for common operations

## Example Implementation

See `client/src/pages/ElementCrewAppraisals.tsx` for a complete implementation example showing how to integrate the reusable component with:
- Complex column definitions
- Custom cell renderers
- Action buttons integration
- Grid API management
- Data filtering and search