/**
 * Consolidated Portage Bill Component
 * Displays payroll data in AG Grid with grouped headers for Earnings and Deductions
 */

import React, { useState, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePayrollData } from '@/hooks/usePayrollData';
import { Edit, Save, X, ExternalLink } from 'lucide-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import './ConsolidatedPortageBill.css';

interface ConsolidatedPortageBillProps {
  crewMemberId: string;
}

export const ConsolidatedPortageBill: React.FC<ConsolidatedPortageBillProps> = ({
  crewMemberId
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const {
    data,
    isLoading,
    error,
    updateElementValue,
    savePayrollData,
    resetEditableValues,
    hasUnsavedChanges
  } = usePayrollData(crewMemberId);

  // Transform data for AG Grid with section headers
  const rowData = useMemo(() => {
    if (!data) return [];
    
    const rows: any[] = [];
    let serialNumber = 1;

    // Add earnings section header
    if (data.elements.earnings.length > 0) {
      rows.push({
        id: 'earnings-header',
        serialNumber: '',
        payElement: '+ Earnings (' + data.elements.earnings.length + ')',
        code: '',
        category: '',
        formula: '',
        amount: Number(data.totals.grossEarnings) || 0,
        active: true,
        source: '',
        type: 'section-header',
        isEditable: false,
        isHeader: true
      });
    }

    // Add earnings
    data.elements.earnings.forEach((element) => {
      rows.push({
        id: element.id,
        serialNumber: serialNumber++,
        payElement: element.name,
        code: element.code,
        category: element.category,
        formula: element.formula,
        amount: Number(element.value) || 0,
        active: element.applicable,
        source: element.source,
        type: 'earning',
        isEditable: element.isEditable,
        originalId: element.originalId
      });
    });

    // Add deductions section header
    if (data.elements.deductions.length > 0) {
      rows.push({
        id: 'deductions-header',
        serialNumber: '',
        payElement: '- Deductions (' + data.elements.deductions.length + ')',
        code: '',
        category: '',
        formula: '',
        amount: Number(data.totals.totalDeductions) || 0,
        active: true,
        source: '',
        type: 'section-header',
        isEditable: false,
        isHeader: true
      });
    }

    // Add deductions  
    data.elements.deductions.forEach((element) => {
      rows.push({
        id: element.id,
        serialNumber: serialNumber++,
        payElement: element.name,
        code: element.code,
        category: element.category,
        formula: element.formula,
        amount: Number(element.value) || 0,
        active: element.applicable,
        source: element.source,
        type: 'deduction',
        isEditable: element.isEditable,
        originalId: element.originalId
      });
    });

    return rows;
  }, [data]);

  // Source badge renderer
  const sourceBadgeRenderer = (params: any) => {
    const sourceColors = {
      inherited: 'bg-blue-100 text-blue-800',
      contract: 'bg-green-100 text-green-800',
      allotment: 'bg-purple-100 text-purple-800',
      advance: 'bg-orange-100 text-orange-800',
      bond: 'bg-yellow-100 text-yellow-800'
    };

    const sourceLabels = {
      inherited: 'Rate Tables',
      contract: 'Contract',
      allotment: 'Allotment',
      advance: 'Advance',
      bond: 'Bond'
    };

    return (
      <Badge 
        variant="outline" 
        className={`text-xs ${sourceColors[params.value as keyof typeof sourceColors] || 'bg-gray-100 text-gray-800'}`}
      >
        {sourceLabels[params.value as keyof typeof sourceLabels] || params.value}
      </Badge>
    );
  };

  // Amount editor renderer
  const amountCellRenderer = (params: any) => {
    if (params.data.isEditable && isEditMode) {
      return (
        <Input
          type="number"
          step="0.01"
          value={params.value || 0}
          onChange={(e) => updateElementValue(params.data.id, parseFloat(e.target.value) || 0)}
          className="text-sm h-8 w-full"
        />
      );
    }
    return `$${(params.value || 0).toFixed(2)}`;
  };

  // Active status renderer
  const activeStatusRenderer = (params: any) => {
    return (
      <div className="flex justify-center">
        <div className={`w-3 h-3 rounded-full ${params.value ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
    );
  };

  // Actions renderer
  const actionsRenderer = (params: any) => {
    if (params.data.source === 'inherited') return null;
    
    const routes = {
      contract: '/accounts/contract-data',
      allotment: '/accounts/wage-accounts/allotments',
      advance: '/accounts/wage-accounts/advances-bond',
      bond: '/accounts/wage-accounts/advances-bond'
    };

    const route = routes[params.data.source as keyof typeof routes];
    if (!route) return null;

    return (
      <Button
        variant="outline"
        size="sm"
        className="h-6 text-xs px-2"
        onClick={() => console.log(`Navigate to ${route} for element ${params.data.id}`)}
      >
        <ExternalLink className="w-3 h-3" />
      </Button>
    );
  };

  // Column definitions - single table format like traditional portage bill
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: 'serialNumber',
      headerName: 'S.No',
      width: 80,
      cellStyle: { textAlign: 'center' }
    },
    {
      field: 'payElement',
      headerName: 'Pay Element',
      width: 200,
      cellRenderer: (params: any) => (
        <div>
          <div className="font-medium text-sm">{params.value}</div>
          <code className="text-xs bg-gray-100 px-1 rounded">{params.data.code}</code>
        </div>
      ),
      filter: true
    },
    {
      field: 'category',
      headerName: 'Category & Formula',
      width: 250,
      cellRenderer: (params: any) => (
        <div>
          <div className="text-sm text-gray-700">{params.value}</div>
          <div className="text-xs text-gray-500 truncate" title={params.data.formula}>
            {params.data.formula}
          </div>
        </div>
      )
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      cellRenderer: amountCellRenderer,
      cellStyle: { textAlign: 'right' },
      type: 'numericColumn'
    },
    {
      field: 'active',
      headerName: 'Active',
      width: 80,
      cellRenderer: activeStatusRenderer,
      cellStyle: { textAlign: 'center' }
    },
    {
      field: 'source',
      headerName: 'Source',
      width: 120,
      cellRenderer: sourceBadgeRenderer,
      cellStyle: { textAlign: 'center' }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      cellRenderer: actionsRenderer,
      cellStyle: { textAlign: 'center' },
      sortable: false
    }
  ], [isEditMode]);

  // Event handlers
  const handleEdit = () => setIsEditMode(true);
  const handleCancel = () => {
    resetEditableValues();
    setIsEditMode(false);
  };
  const handleSave = async () => {
    try {
      await savePayrollData();
      setIsEditMode(false);
    } catch (error) {
      console.error('Failed to save payroll data:', error);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading payroll data...</div>;
  }

  if (error || !data) {
    return <div className="text-center p-8 text-red-600">Failed to load payroll data</div>;
  }

  const isEditable = true; // Allow editing for now - can be enhanced with status check later

  return (
    <div className="h-full overflow-y-auto">
      <Card>
        <CardHeader className="flex flex-col space-y-1.5 p-6 bg-[#ffffff]">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>{data.crewName} - Consolidated Portage Bill</span>
              <Badge variant="outline">{data.crewRank}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {!isEditMode && isEditable && (
                <Button variant="outline" size="sm" onClick={handleEdit} className="gap-2">
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
              )}
              {isEditMode && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSave} 
                    disabled={!hasUnsavedChanges}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6 pt-0 space-y-6 bg-[#ffffff]">
          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ${(Number(data.totals.grossEarnings) || 0).toFixed(2)}
              </div>
              <p className="text-sm text-gray-600">Gross Earnings</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                ${(Number(data.totals.totalDeductions) || 0).toFixed(2)}
              </div>
              <p className="text-sm text-gray-600">Total Deductions</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                ${(Number(data.totals.netPay) || 0).toFixed(2)}
              </div>
              <p className="text-sm text-gray-600">Net Pay</p>
            </div>
          </div>

          {/* AG Grid Table */}
          <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: false
              }}
              suppressMenuHide={true}
              suppressContextMenu={true}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              animateRows={true}
              rowHeight={60}
              headerHeight={40}
              getRowId={(params) => params.data.id}
              rowClassRules={{
                'ag-row-earning': (params) => params.data.type === 'earning',
                'ag-row-deduction': (params) => params.data.type === 'deduction',
                'ag-row-section-header': (params) => params.data.type === 'section-header'
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};