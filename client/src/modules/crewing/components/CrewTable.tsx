/**
 * Reusable crew table component with AG Grid
 */

import React, { useMemo, useCallback } from "react";
import { ColDef, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import AgGridTable from '@/components/AgGridTable';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrewMember, CrewAppraisalData, CrewTableAction } from "../types/crew.types";
import { EditIcon, EyeIcon, Trash2Icon } from "lucide-react";

interface CrewTableProps {
  data: CrewAppraisalData[];
  loading?: boolean;
  onEdit?: (crew: CrewMember) => void;
  onView?: (crew: CrewMember) => void;
  onDelete?: (crew: CrewMember) => void;
  actions?: CrewTableAction[];
  className?: string;
}

// Rating badge component for consistent rating display
const RatingBadge = ({ value, color }: { value: string; color: string }) => {
  const numValue = parseFloat(value);
  const formattedValue = numValue.toFixed(1);
  let bgColor = '';
  let textColor = '';

  if (numValue >= 4.0) {
    bgColor = 'bg-[#c3f2cb]';
    textColor = 'text-[#286e34]';
  } else if (numValue >= 3.0) {
    bgColor = 'bg-[#ffeaa7]';
    textColor = 'text-[#814c02]';
  } else if (numValue >= 2.0) {
    bgColor = 'bg-[#f9ecef]';
    textColor = 'text-[#811f1a]';
  } else {
    bgColor = 'bg-red-600';
    textColor = 'text-white';
  }

  return (
    <Badge className={`rounded-md px-2.5 py-1 font-bold ${bgColor} ${textColor} min-w-[48px] text-center`}>
      {formattedValue}
    </Badge>
  );
};

// Cell renderers
const RatingCellRenderer = (params: ICellRendererParams) => {
  const { value, color } = params.value || { value: '0.0', color: '' };
  return <RatingBadge value={value} color={color} />;
};

const NameCellRenderer = (params: ICellRendererParams) => {
  const crew = params.data as CrewAppraisalData;
  return (
    <div className="font-medium">
      {crew.fullName}
    </div>
  );
};

const ActionsCellRenderer = (params: ICellRendererParams) => {
  const { onEdit, onView, onDelete, actions } = params.context;
  const crew = params.data as CrewMember;

  const defaultActions = [
    ...(onView ? [{
      id: 'view',
      label: 'View',
      icon: EyeIcon,
      onClick: onView,
      variant: 'outline' as const,
    }] : []),
    ...(onEdit ? [{
      id: 'edit',
      label: 'Edit',
      icon: EditIcon,
      onClick: onEdit,
      variant: 'default' as const,
    }] : []),
    ...(onDelete ? [{
      id: 'delete',
      label: 'Delete',
      icon: Trash2Icon,
      onClick: onDelete,
      variant: 'destructive' as const,
    }] : []),
  ];

  const allActions = actions || defaultActions;

  return (
    <div className="flex gap-2">
      {allActions.map((action: CrewTableAction) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            size="sm"
            variant={action.variant || 'outline'}
            onClick={() => action.onClick(crew)}
            className="h-8 w-8 p-0"
          >
            {Icon && <Icon className="h-4 w-4" />}
          </Button>
        );
      })}
    </div>
  );
};

export function CrewTable({ 
  data, 
  loading = false, 
  onEdit, 
  onView, 
  onDelete, 
  actions,
  className 
}: CrewTableProps) {
  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "Name",
      field: "fullName",
      cellRenderer: NameCellRenderer,
      sortable: true,
      filter: true,
      flex: 1,
      minWidth: 200,
    },
    {
      headerName: "Rank",
      field: "rank",
      sortable: true,
      filter: true,
      width: 150,
    },
    {
      headerName: "Nationality",
      field: "nationality",
      sortable: true,
      filter: true,
      width: 130,
    },
    {
      headerName: "Vessel",
      field: "vessel",
      sortable: true,
      filter: true,
      width: 150,
    },
    {
      headerName: "Vessel Type",
      field: "vesselType",
      sortable: true,
      filter: true,
      width: 140,
    },
    {
      headerName: "Sign-On Date",
      field: "signOnDate",
      sortable: true,
      filter: 'agDateColumnFilter',
      width: 130,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return new Date(params.value).toLocaleDateString();
      },
    },
    {
      headerName: "Time on Board",
      field: "timeOnBoard",
      sortable: false,
      width: 130,
    },
    {
      headerName: "Competence",
      field: "competenceRating",
      cellRenderer: RatingCellRenderer,
      sortable: true,
      width: 120,
      comparator: (valueA: any, valueB: any) => {
        const a = parseFloat(valueA?.value || '0');
        const b = parseFloat(valueB?.value || '0');
        return a - b;
      },
    },
    {
      headerName: "Behavioral",
      field: "behavioralRating",
      cellRenderer: RatingCellRenderer,
      sortable: true,
      width: 120,
      comparator: (valueA: any, valueB: any) => {
        const a = parseFloat(valueA?.value || '0');
        const b = parseFloat(valueB?.value || '0');
        return a - b;
      },
    },
    {
      headerName: "Overall",
      field: "overallRating",
      cellRenderer: RatingCellRenderer,
      sortable: true,
      width: 110,
      comparator: (valueA: any, valueB: any) => {
        const a = parseFloat(valueA?.value || '0');
        const b = parseFloat(valueB?.value || '0');
        return a - b;
      },
    },
    {
      headerName: "Actions",
      field: "actions",
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      width: 120,
      pinned: 'right',
    },
  ], []);

  const context = useMemo(() => ({
    onEdit,
    onView,
    onDelete,
    actions,
  }), [onEdit, onView, onDelete, actions]);

  const onGridReady = useCallback((event: GridReadyEvent) => {
    event.api.sizeColumnsToFit();
  }, []);

  return (
    <div className={className}>
      <AgGridTable
        columnDefs={columnDefs}
        rowData={data}
        loading={loading}
        context={context}
        onGridReady={onGridReady}
        pagination={true}
        paginationPageSize={20}
        animateRows={true}
        enableRangeSelection={true}
        enableCharts={true}
        rowSelection="multiple"
        suppressRowClickSelection={true}
      />
    </div>
  );
}