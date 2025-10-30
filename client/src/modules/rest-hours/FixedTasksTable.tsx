import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Plus, Save, Edit2 } from 'lucide-react';
import type { FixedTask } from '@shared/schema';

interface FixedTasksTableProps {
  vesselId: string;
  monthYear: string; // Format: "2025-10"
}

interface CrewTaskData {
  crewMemberId: string;
  crewName: string;
  rank: string;
  seaHours: string[]; // 48 entries (daily template)
  portHours: string[]; // 48 entries (daily template)
  taskId?: number;
}

export const FixedTasksTable = ({ vesselId, monthYear }: FixedTasksTableProps): JSX.Element => {
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [crewTasks, setCrewTasks] = useState<CrewTaskData[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  // Calculate days in month
  const daysInMonth = useMemo(() => {
    if (!monthYear) return 31;
    const [year, month] = monthYear.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  }, [monthYear]);

  // Fetch crew members assigned to this vessel
  const { data: allCrewMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/crew-members'],
    enabled: !!vesselId,
  });

  const vesselCrewMembers = useMemo(() => {
    return allCrewMembers.filter((crew: any) => crew.presentVessel === vesselId);
  }, [allCrewMembers, vesselId]);

  // Fetch existing fixed tasks for this vessel and month
  const { data: existingTasks = [] } = useQuery<FixedTask[]>({
    queryKey: ['/api/fixed-tasks', vesselId, monthYear],
    queryFn: async () => {
      if (!vesselId || !monthYear) return [];
      const response = await fetch(`/api/fixed-tasks?vesselId=${vesselId}&monthYear=${monthYear}`);
      if (!response.ok) throw new Error('Failed to fetch fixed tasks');
      return response.json();
    },
    enabled: !!vesselId && !!monthYear,
  });

  // Initialize crew tasks from existing data or create empty
  useEffect(() => {
    if (vesselCrewMembers.length === 0) {
      setCrewTasks([]);
      return;
    }

    const tasks: CrewTaskData[] = vesselCrewMembers.map((crew: any) => {
      const existingTask = existingTasks.find((t: FixedTask) => t.crewMemberId === crew.id);
      
      return {
        crewMemberId: crew.id,
        crewName: `${crew.firstName} ${crew.familyName || ''}`.trim(),
        rank: crew.presentRank || '',
        seaHours: Array.isArray(existingTask?.seaHours) ? existingTask.seaHours : Array(48).fill(''),
        portHours: Array.isArray(existingTask?.portHours) ? existingTask.portHours : Array(48).fill(''),
        taskId: existingTask?.id,
      };
    });

    setCrewTasks(tasks);
  }, [vesselCrewMembers, existingTasks]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = crewTasks.map(async (task) => {
        const data = {
          crewMemberId: task.crewMemberId,
          vesselId,
          monthYear,
          seaHours: task.seaHours,
          portHours: task.portHours,
        };

        if (task.taskId) {
          // Update existing
          const response = await fetch(`/api/fixed-tasks/${task.taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Failed to update task');
          return response.json();
        } else {
          // Create new
          const response = await fetch('/api/fixed-tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (!response.ok) throw new Error('Failed to create task');
          return response.json();
        }
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-tasks'] });
      setIsEditMode(false);
      toast({
        title: 'Success',
        description: 'Fixed tasks saved successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save fixed tasks',
        variant: 'destructive',
      });
      console.error('Save error:', error);
    },
  });

  const handleCellClick = (crewIndex: number, type: 'sea' | 'port', cellIndex: number) => {
    if (!isEditMode) return;

    setCrewTasks((prev) => {
      const updated = [...prev];
      const current = updated[crewIndex];
      const hours = type === 'sea' ? [...current.seaHours] : [...current.portHours];
      
      // cellIndex is 0-47 for the daily template
      const templateIndex = cellIndex % 48;
      
      // Cycle through: '' -> 'w' -> 'd' -> ''
      const currentValue = hours[templateIndex];
      if (currentValue === '') {
        hours[templateIndex] = 'w';
      } else if (currentValue === 'w') {
        hours[templateIndex] = 'd';
      } else {
        hours[templateIndex] = '';
      }

      if (type === 'sea') {
        current.seaHours = hours;
      } else {
        current.portHours = hours;
      }

      return updated;
    });
  };

  const toggleDayExpansion = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const getCellColor = (value: string) => {
    if (value === 'w') return 'bg-blue-500';
    if (value === 'd') return 'bg-orange-500';
    return 'bg-white dark:bg-gray-800';
  };

  const handleNewMonth = async () => {
    // Get previous month
    const [year, month] = monthYear.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1); // -2 because month is 1-indexed
    const prevYear = prevDate.getFullYear();
    const prevMonth = (prevDate.getMonth() + 1).toString().padStart(2, '0');
    const prevMonthYear = `${prevYear}-${prevMonth}`;

    try {
      // Fetch previous month's tasks
      const response = await fetch(`/api/fixed-tasks?vesselId=${vesselId}&monthYear=${prevMonthYear}`);
      if (response.ok) {
        const prevTasks: FixedTask[] = await response.json();
        
        // Copy previous month's data to current crew tasks
        setCrewTasks((prev) => {
          return prev.map((task) => {
            const prevTask = prevTasks.find((t: FixedTask) => t.crewMemberId === task.crewMemberId);
            if (prevTask) {
              return {
                ...task,
                seaHours: Array.isArray(prevTask.seaHours) ? Array.from(prevTask.seaHours) : [],
                portHours: Array.isArray(prevTask.portHours) ? Array.from(prevTask.portHours) : [],
              };
            }
            return task;
          });
        });
        
        setIsEditMode(true);
        toast({
          title: 'Previous month copied',
          description: 'Data from previous month loaded for editing',
        });
      } else {
        toast({
          title: 'No previous data',
          description: 'No fixed tasks found for previous month',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load previous month:', error);
      toast({
        title: 'Error',
        description: 'Failed to load previous month data',
        variant: 'destructive',
      });
    }
  };

  const calculateRestHours = (hours: string[]) => {
    const workHours = hours.filter(h => h === 'w' || h === 'd').length * 0.5;
    return 24 - workHours;
  };

  if (!vesselId || !monthYear) {
    return (
      <div className="text-gray-600 p-6">
        Please select a vessel and period to view fixed tasks.
      </div>
    );
  }

  if (vesselCrewMembers.length === 0) {
    return (
      <div className="text-gray-600 p-6">
        No crew members assigned to this vessel.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action buttons */}
      <div className="flex gap-2 justify-end">
        {!isEditMode ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(true)}
              className="gap-2"
              data-testid="button-edit"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewMonth}
              className="gap-2"
              data-testid="button-new-month"
            >
              <Plus className="h-4 w-4" />
              +New Month
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        )}
      </div>

      {/* Simplified view - showing total rest hours per day */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border px-2 py-1 text-left sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">
                Crew Member
              </th>
              <th className="border px-2 py-1 text-left">Rank</th>
              <th className="border px-2 py-1 text-left">Condition</th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                <th 
                  key={day} 
                  className="border px-1 py-1 text-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => toggleDayExpansion(day)}
                  data-testid={`header-day-${day}`}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crewTasks.map((crew, crewIndex) => (
              <>
                {/* Sea row */}
                <tr key={`${crew.crewMemberId}-sea`} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td 
                    className="border px-2 py-1 sticky left-0 bg-white dark:bg-gray-950 font-medium"
                    rowSpan={2}
                  >
                    {crew.crewName}
                  </td>
                  <td className="border px-2 py-1" rowSpan={2}>
                    {crew.rank}
                  </td>
                  <td className="border px-2 py-1 text-blue-600 font-semibold">Sea</td>
                  {Array.from({ length: daysInMonth }, (_, dayIdx) => {
                    const dayNum = dayIdx + 1;
                    const restHours = calculateRestHours(crew.seaHours);
                    const isExpanded = expandedDays.has(dayNum);

                    return (
                      <td 
                        key={dayNum} 
                        className="border px-1 py-1 text-center"
                        data-testid={`cell-sea-${crewIndex}-day-${dayNum}`}
                      >
                        {!isExpanded ? (
                          <div className="text-xs">{restHours.toFixed(1)}h</div>
                        ) : (
                          <div className="grid grid-cols-4 gap-0.5">
                            {crew.seaHours.map((hour, cellIdx) => (
                              <div
                                key={cellIdx}
                                className={`w-3 h-3 border ${getCellColor(hour)} ${isEditMode ? 'cursor-pointer hover:opacity-70' : ''}`}
                                onClick={() => handleCellClick(crewIndex, 'sea', cellIdx)}
                                title={`${Math.floor(cellIdx / 2)}:${cellIdx % 2 === 0 ? '00' : '30'}`}
                                data-testid={`cell-sea-${crewIndex}-day-${dayNum}-hour-${cellIdx}`}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {/* Port row */}
                <tr key={`${crew.crewMemberId}-port`} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="border px-2 py-1 text-green-600 font-semibold">Port</td>
                  {Array.from({ length: daysInMonth }, (_, dayIdx) => {
                    const dayNum = dayIdx + 1;
                    const restHours = calculateRestHours(crew.portHours);
                    const isExpanded = expandedDays.has(dayNum);

                    return (
                      <td 
                        key={dayNum} 
                        className="border px-1 py-1 text-center"
                        data-testid={`cell-port-${crewIndex}-day-${dayNum}`}
                      >
                        {!isExpanded ? (
                          <div className="text-xs">{restHours.toFixed(1)}h</div>
                        ) : (
                          <div className="grid grid-cols-4 gap-0.5">
                            {crew.portHours.map((hour, cellIdx) => (
                              <div
                                key={cellIdx}
                                className={`w-3 h-3 border ${getCellColor(hour)} ${isEditMode ? 'cursor-pointer hover:opacity-70' : ''}`}
                                onClick={() => handleCellClick(crewIndex, 'port', cellIdx)}
                                title={`${Math.floor(cellIdx / 2)}:${cellIdx % 2 === 0 ? '00' : '30'}`}
                                data-testid={`cell-port-${crewIndex}-day-${dayNum}-hour-${cellIdx}`}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 border"></div>
          <span>Watch (w)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-orange-500 border"></div>
          <span>Duty (d)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white dark:bg-gray-800 border"></div>
          <span>Rest</span>
        </div>
        <div className="ml-4 text-gray-500">
          Click day header to expand/collapse | Click cells in edit mode to cycle: Rest → Watch → Duty
        </div>
      </div>
    </div>
  );
};
