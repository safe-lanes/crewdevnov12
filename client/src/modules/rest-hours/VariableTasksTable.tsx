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
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { VariableTaskForm } from './VariableTaskForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { VariableTask, InsertVariableTask } from '@shared/schema';

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

interface VariableTasksTableProps {
  vesselId: string;
  periodValue: string;
}

export const VariableTasksTable = ({ vesselId, periodValue }: VariableTasksTableProps) => {
  const { toast } = useToast();
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<VariableTask | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const itemsPerPage = 10;

  const { data: allTasks = [], isLoading } = useQuery<VariableTask[]>({
    queryKey: ['/api/variable-tasks'],
  });

  const tasks = useMemo(() => {
    if (!vesselId || !periodValue) return [];
    return allTasks.filter(task => 
      task.vesselId === vesselId && task.periodValue === periodValue
    );
  }, [allTasks, vesselId, periodValue]);

  const { data: crewMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/crew-members'],
  });

  const vesselCrewMembers = useMemo(() => {
    if (!vesselId || !crewMembers) return [];
    return crewMembers.filter(crew => crew.presentVessel === vesselId);
  }, [crewMembers, vesselId]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertVariableTask) => {
      return apiRequest('/api/variable-tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/variable-tasks'] });
      toast({
        title: 'Success',
        description: 'Variable task created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create variable task',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertVariableTask> }) => {
      return apiRequest(`/api/variable-tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/variable-tasks'] });
      toast({
        title: 'Success',
        description: 'Variable task updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update variable task',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/variable-tasks/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/variable-tasks'] });
      toast({
        title: 'Success',
        description: 'Variable task deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete variable task',
        variant: 'destructive',
      });
    },
  });

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

  const handleEdit = (task: VariableTask) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleDelete = (id: number) => {
    setTaskToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (taskToDelete !== null) {
      deleteMutation.mutate(taskToDelete);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const handleFormSubmit = (data: InsertVariableTask, isDraft: boolean) => {
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end mb-4">
        <Button
          onClick={handleAddTask}
          disabled={!vesselId || !periodValue}
          className="h-8 text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          onClick={() => handleEdit(task)}
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

      {/* Variable Task Form Modal */}
      <VariableTaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleFormSubmit}
        editData={editingTask}
        vesselId={vesselId}
        periodValue={periodValue}
        crewMembers={vesselCrewMembers}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the variable task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
