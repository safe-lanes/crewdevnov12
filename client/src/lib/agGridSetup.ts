import { ModuleRegistry } from 'ag-grid-community';
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

let isInitialized = false;

export function initializeAgGrid() {
  if (isInitialized) return;
  
  const licenseKey = import.meta.env.VITE_AG_GRID_LICENSE_KEY || import.meta.env.AG_GRID_LICENSE_KEY;
  if (licenseKey) {
    LicenseManager.setLicenseKey(licenseKey);
  } else {
    console.warn('AG Grid Enterprise license key not found. Please set VITE_AG_GRID_LICENSE_KEY environment variable.');
  }

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
  
  isInitialized = true;
}

initializeAgGrid();
