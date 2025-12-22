/**
 * Payroll Grid Component
 * AG Grid implementation for crew payroll data
 */

import React, { useState, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, GridReadyEvent, SelectionChangedEvent } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Upload } from "lucide-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface PayrollGridProps {
  selectedCrewId: string | null;
  onCrewSelect: (crewId: string) => void;
}

// Mock crew payroll data
const mockPayrollData = [
  {
    id: "CREW001",
    name: "James Wilson",
    rank: "Captain",
    contractCurrency: "USD",
    basic: 8500.00,
    overtime: 1200.50,
    allowances: 850.00,
    deductions: -450.75,
    employerContrib: 1275.00,
    netUSD: 11374.75,
    netEUR: 10547.32,
    varianceVsLast: 125.50,
    flags: ["BONUS"]
  },
  {
    id: "CREW002", 
    name: "Sarah Chen",
    rank: "Chief Engineer",
    contractCurrency: "EUR",
    basic: 7200.00,
    overtime: 890.25,
    allowances: 650.00,
    deductions: -320.50,
    employerContrib: 1080.00,
    netUSD: 9672.15,
    netEUR: 8499.75,
    varianceVsLast: -45.25,
    flags: []
  },
  {
    id: "CREW003",
    name: "Mike Rodriguez", 
    rank: "Second Officer",
    contractCurrency: "USD",
    basic: 5500.00,
    overtime: 650.75,
    allowances: 420.00,
    deductions: -280.25,
    employerContrib: 825.00,
    netUSD: 7115.50,
    netEUR: 6598.23,
    varianceVsLast: 78.90,
    flags: ["OVERTIME_ALERT"]
  }
];

// Custom cell renderers
const CurrencyRenderer = (params: any) => {
  return <span className="font-mono">${params.value?.toFixed(2) || '0.00'}</span>;
};

const DualCurrencyRenderer = (params: any) => {
  const { netUSD, netEUR } = params.data;
  return (
    <div className="text-sm">
      <div className="font-mono">${netUSD?.toFixed(2) || '0.00'}</div>
      <div className="font-mono text-gray-500">€{netEUR?.toFixed(2) || '0.00'}</div>
    </div>
  );
};

const VarianceRenderer = (params: any) => {
  const value = params.value || 0;
  const isPositive = value >= 0;
  return (
    <span className={`font-mono ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? '+' : ''}{value.toFixed(2)}
    </span>
  );
};

const FlagsRenderer = (params: any) => {
  const flags = params.value || [];
  return (
    <div className="flex gap-1">
      {flags.map((flag: string, index: number) => (
        <Badge key={index} variant="outline" className="text-xs">
          {flag}
        </Badge>
      ))}
    </div>
  );
};

export function PayrollGrid({ selectedCrewId, onCrewSelect }: PayrollGridProps) {
  const [gridApi, setGridApi] = useState<any>(null);

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: "Crew",
      field: "name",
      width: 180,
      pinned: "left",
      checkboxSelection: true,
      headerCheckboxSelection: true,
      cellClass: "font-medium"
    },
    {
      headerName: "Rank", 
      field: "rank",
      width: 140
    },
    {
      headerName: "Contract Currency",
      field: "contractCurrency", 
      width: 120,
      cellClass: "text-center font-mono"
    },
    {
      headerName: "Basic",
      field: "basic",
      width: 120,
      cellRenderer: CurrencyRenderer,
      type: "numericColumn"
    },
    {
      headerName: "Overtime",
      field: "overtime", 
      width: 120,
      cellRenderer: CurrencyRenderer,
      type: "numericColumn"
    },
    {
      headerName: "Allowances",
      field: "allowances",
      width: 120, 
      cellRenderer: CurrencyRenderer,
      type: "numericColumn"
    },
    {
      headerName: "Deductions",
      field: "deductions",
      width: 120,
      cellRenderer: CurrencyRenderer,
      type: "numericColumn",
      cellClass: "text-red-600"
    },
    {
      headerName: "Employer Contrib",
      field: "employerContrib",
      width: 130,
      cellRenderer: CurrencyRenderer, 
      type: "numericColumn"
    },
    {
      headerName: "Net (Dual Currency)",
      field: "net",
      width: 160,
      cellRenderer: DualCurrencyRenderer,
      sortable: false,
      valueFormatter: () => "" // Prevent object data type warning
    },
    {
      headerName: "Variance vs Last",
      field: "varianceVsLast",
      width: 130,
      cellRenderer: VarianceRenderer,
      type: "numericColumn"
    },
    {
      headerName: "Flags",
      field: "flags", 
      width: 150,
      cellRenderer: FlagsRenderer,
      sortable: false
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true
  }), []);

  const onGridReady = (params: GridReadyEvent) => {
    setGridApi(params.api);
  };

  const onSelectionChanged = (event: SelectionChangedEvent) => {
    const selectedRows = event.api.getSelectedRows();
    if (selectedRows.length > 0) {
      onCrewSelect(selectedRows[0].id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Grid Actions */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            Add Pay Element
          </Button>
          <Button variant="outline" size="sm" className="gap-1">
            <Upload className="w-4 h-4" />
            Import Hours
          </Button>
          <Button variant="outline" size="sm">
            Mass Update
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {mockPayrollData.length} crew members
          </span>
          <Button variant="outline" size="sm" className="gap-1">
            <Settings className="w-4 h-4" />
            Column Picker
          </Button>
        </div>
      </div>

      {/* AG Grid */}
      <div className="flex-1 ag-theme-alpine">
        <AgGridReact
          rowData={mockPayrollData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          suppressRowClickSelection={false}
          enableRangeSelection={true}
          onGridReady={onGridReady}
          onSelectionChanged={onSelectionChanged}
          enableCellTextSelection={true}
          suppressMenuHide={true}
          animateRows={true}
          pagination={false}
          getRowId={(params) => params.data.id}
          theme="legacy"
        />
      </div>
    </div>
  );
}