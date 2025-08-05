import React from 'react';
import { Button } from '@/components/ui/button';
import { GridApi } from 'ag-grid-community';
import { agGridUtils } from './AgGridTable';

export interface AgGridTableActionsProps {
  gridApi: GridApi | null;
  className?: string;
  showExportButtons?: boolean;
  showFilterButtons?: boolean;
  showGroupButtons?: boolean;
  showSelectionButtons?: boolean;
  customButtons?: React.ReactNode;
  exportFilename?: string;
}

export const AgGridTableActions: React.FC<AgGridTableActionsProps> = ({
  gridApi,
  className = '',
  showExportButtons = true,
  showFilterButtons = true,
  showGroupButtons = true,
  showSelectionButtons = false,
  customButtons,
  exportFilename = 'data'
}) => {
  if (!gridApi) return null;

  return (
    <div className={`flex gap-2 flex-wrap ${className}`}>
      {showExportButtons && (
        <>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.exportToCsv(gridApi, `${exportFilename}.csv`)}
          >
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.exportToExcel(gridApi, `${exportFilename}.xlsx`)}
          >
            Export Excel
          </Button>
        </>
      )}
      
      {showFilterButtons && (
        <Button 
          variant="outline" 
          className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
          onClick={() => agGridUtils.clearFilters(gridApi)}
        >
          Clear Filters
        </Button>
      )}
      
      {showGroupButtons && (
        <>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.expandAllGroups(gridApi)}
          >
            Expand All
          </Button>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.collapseAllGroups(gridApi)}
          >
            Collapse All
          </Button>
        </>
      )}
      
      {showSelectionButtons && (
        <>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.selectAll(gridApi)}
          >
            Select All
          </Button>
          <Button 
            variant="outline" 
            className="h-8 text-[#8798ad] text-xs border-[#e1e8ed]"
            onClick={() => agGridUtils.deselectAll(gridApi)}
          >
            Deselect All
          </Button>
        </>
      )}
      
      {customButtons}
    </div>
  );
};

export default AgGridTableActions;