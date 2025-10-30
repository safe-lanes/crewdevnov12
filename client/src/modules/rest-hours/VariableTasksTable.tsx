import { useState, useMemo } from 'react';
import { Pencil, Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { VariableTask } from '@shared/schema';

const mockVariableTasks: VariableTask[] = [
  {
    id: 1,
    startDateTime: '09-Jan-2025 / 14:00',
    finishDateTime: '09-Jan-2025 / 16:00',
    startDateTimeSort: '2025-01-09T14:00:00',
    finishDateTimeSort: '2025-01-09T16:00:00',
    task: 'Hot work',
    status: 'Planned',
    crewInvolved: 5,
    remarks: 'Hot work on Monkey Island',
    periodValue: '2025-10',
    vesselId: null,
  },
  {
    id: 2,
    startDateTime: '08-Jan-2025 / 18:00',
    finishDateTime: '09-Jan-2025 / 21:00',
    startDateTimeSort: '2025-01-08T18:00:00',
    finishDateTimeSort: '2025-01-09T21:00:00',
    task: 'Departure Port',
    status: 'Completed',
    crewInvolved: 20,
    remarks: 'Departure Ulsan',
    periodValue: '2025-10',
    vesselId: null,
  },
  {
    id: 3,
    startDateTime: '10-Jan-2025 / 08:00',
    finishDateTime: '10-Jan-2025 / 12:00',
    startDateTimeSort: '2025-01-10T08:00:00',
    finishDateTimeSort: '2025-01-10T12:00:00',
    task: 'Safety Drill',
    status: 'Planned',
    crewInvolved: 15,
    remarks: 'Fire drill and boat drill',
    periodValue: '2025-10',
    vesselId: null,
  },
  {
    id: 4,
    startDateTime: '11-Jan-2025 / 10:00',
    finishDateTime: '11-Jan-2025 / 14:00',
    startDateTimeSort: '2025-01-11T10:00:00',
    finishDateTimeSort: '2025-01-11T14:00:00',
    task: 'Maintenance',
    status: 'Planned',
    crewInvolved: 8,
    remarks: 'Engine room maintenance',
    periodValue: '2025-10',
    vesselId: null,
  },
  {
    id: 5,
    startDateTime: '12-Jan-2025 / 15:00',
    finishDateTime: '12-Jan-2025 / 18:00',
    startDateTimeSort: '2025-01-12T15:00:00',
    finishDateTimeSort: '2025-01-12T18:00:00',
    task: 'Cargo Operations',
    status: 'Completed',
    crewInvolved: 12,
    remarks: 'Loading cargo at berth 3',
    periodValue: '2025-10',
    vesselId: null,
  },
];

type SortColumn = 'startDateTime' | 'finishDateTime' | 'task' | 'status' | 'crewInvolved' | 'remarks' | null;
type SortDirection = 'asc' | 'desc';

const StatusBadge = ({ status }: { status: string }) => {
  const isPlanned = status === 'Planned';
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
        isPlanned
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-green-100 text-green-800'
      }`}
      data-testid={`status-${status.toLowerCase()}`}
    >
      {status}
    </span>
  );
};

export const VariableTasksTable = () => {
  const [tasks, setTasks] = useState<VariableTask[]>(mockVariableTasks);
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    if (!sortColumn) return tasks;

    return [...tasks].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Use sortable ISO timestamps for date/time columns
      if (sortColumn === 'startDateTime') {
        aValue = a.startDateTimeSort;
        bValue = b.startDateTimeSort;
      } else if (sortColumn === 'finishDateTime') {
        aValue = a.finishDateTimeSort;
        bValue = b.finishDateTimeSort;
      } else {
        aValue = a[sortColumn];
        bValue = b[sortColumn];
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [tasks, sortColumn, sortDirection]);

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTasks.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTasks, currentPage]);

  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage);

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return (
        <span className="ml-1 opacity-0 group-hover:opacity-30">
          <ChevronUp className="h-3 w-3" />
        </span>
      );
    }
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </span>
    );
  };

  const handleEdit = (id: number) => {
    console.log('Edit task:', id);
  };

  const handleDelete = (id: number) => {
    console.log('Delete task:', id);
  };

  const handleAddTask = () => {
    console.log('Add new task');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end mb-4">
        <Button
          onClick={handleAddTask}
          className="h-8 text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          data-testid="button-add-task"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Task
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <ScrollArea className="h-[500px] w-full">
          <Table>
            <TableHeader className="sticky top-0 z-30">
              <TableRow className="bg-[#52baf3] hover:bg-[#52baf3]">
                <TableHead
                  className="text-white text-xs font-normal cursor-pointer group sticky top-0 bg-[#52baf3] shadow-sm"
                  onClick={() => handleSort('startDateTime')}
                  data-testid="header-start-datetime"
                >
                  <div className="flex items-center">
                    Start Date/ Time
                    <SortIndicator column="startDateTime" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-white text-xs font-normal cursor-pointer group sticky top-0 bg-[#52baf3] shadow-sm"
                  onClick={() => handleSort('finishDateTime')}
                  data-testid="header-finish-datetime"
                >
                  <div className="flex items-center">
                    Finish Date/ Time
                    <SortIndicator column="finishDateTime" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-white text-xs font-normal cursor-pointer group sticky top-0 bg-[#52baf3] shadow-sm"
                  onClick={() => handleSort('task')}
                  data-testid="header-task"
                >
                  <div className="flex items-center">
                    Task
                    <SortIndicator column="task" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-white text-xs font-normal cursor-pointer group sticky top-0 bg-[#52baf3] shadow-sm"
                  onClick={() => handleSort('status')}
                  data-testid="header-status"
                >
                  <div className="flex items-center">
                    Status
                    <SortIndicator column="status" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-white text-xs font-normal cursor-pointer group text-center sticky top-0 bg-[#52baf3] shadow-sm"
                  onClick={() => handleSort('crewInvolved')}
                  data-testid="header-crew-involved"
                >
                  <div className="flex items-center justify-center">
                    Crew Involved
                    <SortIndicator column="crewInvolved" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-white text-xs font-normal cursor-pointer group sticky top-0 bg-[#52baf3] shadow-sm"
                  onClick={() => handleSort('remarks')}
                  data-testid="header-remarks"
                >
                  <div className="flex items-center">
                    Remarks
                    <SortIndicator column="remarks" />
                  </div>
                </TableHead>
                <TableHead className="text-white text-xs font-normal text-center sticky top-0 bg-[#52baf3] shadow-sm w-20">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No tasks added yet. Click "+ Add Task" to create a new task.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map((task) => (
                  <TableRow key={task.id} className="bg-white" data-testid={`row-task-${task.id}`}>
                    <TableCell className="py-3 text-sm" data-testid={`text-start-datetime-${task.id}`}>
                      {task.startDateTime}
                    </TableCell>
                    <TableCell className="py-3 text-sm" data-testid={`text-finish-datetime-${task.id}`}>
                      {task.finishDateTime}
                    </TableCell>
                    <TableCell className="py-3 text-sm" data-testid={`text-task-${task.id}`}>
                      {task.task}
                    </TableCell>
                    <TableCell className="py-3" data-testid={`cell-status-${task.id}`}>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className="py-3 text-sm text-center" data-testid={`text-crew-${task.id}`}>
                      {task.crewInvolved}
                    </TableCell>
                    <TableCell className="py-3 text-sm" data-testid={`text-remarks-${task.id}`}>
                      {task.remarks}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(task.id)}
                          className="text-gray-600 hover:text-blue-600 transition-colors"
                          data-testid={`button-edit-${task.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="text-gray-600 hover:text-red-600 transition-colors"
                          data-testid={`button-delete-${task.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, sortedTasks.length)} of {sortedTasks.length} tasks
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-8 text-xs"
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 text-xs ${
                    currentPage === page
                      ? 'bg-[#16569e] hover:bg-[#0f4078] text-white'
                      : 'border-gray-300'
                  }`}
                  data-testid={`button-page-${page}`}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="h-8 text-xs"
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
