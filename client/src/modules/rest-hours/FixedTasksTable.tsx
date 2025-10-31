import { useState, useEffect, useMemo, Fragment } from 'react';
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

  // Fetch crew members assigned to this vessel
  const { data: allCrewMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/crew-members'],
    enabled: !!vesselId,
  });

  // Fetch available ranks to get sortOrder
  const { data: availableRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/available-ranks'],
  });

  // Create a map of rank name to sortOrder for sorting
  const rankOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    availableRanks.forEach((rank: any) => {
      map.set(rank.name, rank.sortOrder || 0);
    });
    return map;
  }, [availableRanks]);

  const vesselCrewMembers = useMemo(() => {
    const filtered = allCrewMembers.filter((crew: any) => crew.presentVessel === vesselId);
    // Sort by rank order
    return filtered.sort((a: any, b: any) => {
      // Strip suffix from rank name (e.g., "3rd Officer_1" -> "3rd Officer")
      const aRankBase = a.presentRank?.split('_')[0] || a.presentRank;
      const bRankBase = b.presentRank?.split('_')[0] || b.presentRank;
      const aOrder = rankOrderMap.get(aRankBase) ?? 999;
      const bOrder = rankOrderMap.get(bRankBase) ?? 999;
      return aOrder - bOrder;
    });
  }, [allCrewMembers, vesselId, rankOrderMap]);

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

  // Create stable dependency values to avoid infinite loops
  const crewMemberIds = useMemo(() => {
    return vesselCrewMembers.map(c => c.id).join(',');
  }, [vesselCrewMembers]);

  const existingTaskIds = useMemo(() => {
    return existingTasks.map(t => `${t.crewMemberId}-${t.id}`).join(',');
  }, [existingTasks]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewMemberIds, existingTaskIds, vesselId, monthYear]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = crewTasks.map(async (task) => {
        const data = {
          crewMemberId: task.crewMemberId,
          vesselId,
          rank: task.rank,
          name: task.crewName,
          monthYear,
          seaHours: JSON.stringify(task.seaHours),
          portHours: JSON.stringify(task.portHours),
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

  // Handle cell edit with keyboard input
  const handleCellEdit = (crewIndex: number, type: 'sea' | 'port', cellIndex: number, value: string) => {
    setCrewTasks((prev) => {
      const updated = [...prev];
      const current = updated[crewIndex];
      
      // Allow only 'w', 'd', or empty
      const normalizedValue = value.toLowerCase();
      if (normalizedValue === 'w' || normalizedValue === 'd' || normalizedValue === '') {
        if (type === 'sea') {
          current.seaHours = [...current.seaHours];
          current.seaHours[cellIndex] = normalizedValue;
        } else {
          current.portHours = [...current.portHours];
          current.portHours[cellIndex] = normalizedValue;
        }
      }

      return updated;
    });
  };

  // Get cell background color (matching RH Recording form plan view)
  const getCellBackgroundColor = (value: string): string => {
    if (value === 'w' || value === 'd') return '#E5E7EB'; // Grey for all work (matching plan view)
    return 'white'; // White for rest
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

      {/* Hourly view - showing 24 hours with 2 half-hour cells each */}
      <div className="overflow-x-auto overflow-y-auto border rounded-lg max-h-[600px]">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border px-2 py-1 text-left sticky left-0 bg-gray-100 dark:bg-gray-800 z-30 w-20">
                Rank
              </th>
              <th className="border px-2 py-1 text-left sticky left-20 bg-gray-100 dark:bg-gray-800 z-30 w-32">
                Name
              </th>
              <th className="border px-2 py-1 text-center w-16 bg-gray-100 dark:bg-gray-800">
                Watch/<br/>Duty
              </th>
              {/* Hours 00-23 (each spans 2 half-hour columns) */}
              {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                <th 
                  key={hour} 
                  colSpan={2}
                  className="border px-1 py-1 text-left bg-gray-100 dark:bg-gray-800"
                  data-testid={`header-hour-${hour}`}
                >
                  {String(hour).padStart(2, '0')}
                </th>
              ))}
              <th className="border px-2 py-1 text-center bg-gray-100 dark:bg-gray-800">
                Total<br/>Rest Hrs
              </th>
            </tr>
          </thead>
          <tbody>
            {crewTasks.map((crew, crewIndex) => (
              <Fragment key={crew.crewMemberId}>
                {/* Sea row */}
                <tr key={`${crew.crewMemberId}-sea`} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td 
                    className="border px-2 py-1 sticky left-0 bg-white dark:bg-gray-950 w-20"
                    rowSpan={2}
                  >
                    {crew.rank}
                  </td>
                  <td 
                    className="border px-2 py-1 sticky left-20 bg-white dark:bg-gray-950 font-medium w-32"
                    rowSpan={2}
                  >
                    {crew.crewName}
                  </td>
                  <td className="border px-2 py-1 text-center text-blue-600 font-semibold w-16">Sea</td>
                  {/* 48 Half-Hour Columns (matching RH Recording Form structure) */}
                  {crew.seaHours.map((cellValue, cellIndex) => {
                    const isSecondHalf = cellIndex % 2 === 1;
                    
                    return (
                      <td
                        key={cellIndex}
                        className={`border-t border-b border-l text-center ${isSecondHalf ? 'border-r' : ''}`}
                        style={{
                          padding: '2px',
                          backgroundColor: getCellBackgroundColor(cellValue),
                          borderRightWidth: isSecondHalf ? '1px' : '0.5px',
                          borderRightColor: isSecondHalf ? '#d1d5db' : '#e5e7eb',
                          borderRightStyle: 'solid',
                          minWidth: '15px',
                          width: '15px',
                        }}
                      >
                        <div
                          contentEditable={isEditMode}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const value = e.currentTarget.textContent || '';
                            handleCellEdit(crewIndex, 'sea', cellIndex, value);
                          }}
                          onKeyDown={(e) => {
                            if (!isEditMode) return;
                            
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                              return;
                            }
                            
                            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                              e.preventDefault();
                              
                              let targetCrew = crewIndex;
                              let targetCell = cellIndex;
                              let targetType: 'sea' | 'port' = 'sea';
                              
                              if (e.key === 'ArrowRight') {
                                targetCell++;
                                if (targetCell >= 48) targetCell = 0;
                              } else if (e.key === 'ArrowLeft') {
                                targetCell--;
                                if (targetCell < 0) targetCell = 47;
                              } else if (e.key === 'ArrowDown') {
                                targetType = 'port';
                              } else if (e.key === 'ArrowUp' && crewIndex > 0) {
                                targetCrew = crewIndex - 1;
                                targetType = 'port';
                              }
                              
                              const targetElement = document.querySelector(
                                `[data-testid="cell-${targetType}-${targetCrew}-${targetCell}"]`
                              ) as HTMLElement;
                              
                              if (targetElement) {
                                targetElement.focus();
                                const selection = window.getSelection();
                                const range = document.createRange();
                                range.selectNodeContents(targetElement);
                                selection?.removeAllRanges();
                                selection?.addRange(range);
                              }
                            }
                          }}
                          className="outline-none cursor-text min-h-[20px]"
                          style={{ width: '100%', minWidth: '15px' }}
                          data-testid={`cell-sea-${crewIndex}-${cellIndex}`}
                        >
                          {cellValue}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border px-2 py-1 text-center font-medium">
                    {calculateRestHours(crew.seaHours).toFixed(1)}
                  </td>
                </tr>
                {/* Port row */}
                <tr key={`${crew.crewMemberId}-port`} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="border px-2 py-1 text-center text-green-600 font-semibold w-16">Port</td>
                  {/* 48 Half-Hour Columns (matching RH Recording Form structure) */}
                  {crew.portHours.map((cellValue, cellIndex) => {
                    const isSecondHalf = cellIndex % 2 === 1;
                    
                    return (
                      <td
                        key={cellIndex}
                        className={`border-t border-b border-l text-center ${isSecondHalf ? 'border-r' : ''}`}
                        style={{
                          padding: '2px',
                          backgroundColor: getCellBackgroundColor(cellValue),
                          borderRightWidth: isSecondHalf ? '1px' : '0.5px',
                          borderRightColor: isSecondHalf ? '#d1d5db' : '#e5e7eb',
                          borderRightStyle: 'solid',
                          minWidth: '15px',
                          width: '15px',
                        }}
                      >
                        <div
                          contentEditable={isEditMode}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const value = e.currentTarget.textContent || '';
                            handleCellEdit(crewIndex, 'port', cellIndex, value);
                          }}
                          onKeyDown={(e) => {
                            if (!isEditMode) return;
                            
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                              return;
                            }
                            
                            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                              e.preventDefault();
                              
                              let targetCrew = crewIndex;
                              let targetCell = cellIndex;
                              let targetType: 'sea' | 'port' = 'port';
                              
                              if (e.key === 'ArrowRight') {
                                targetCell++;
                                if (targetCell >= 48) targetCell = 0;
                              } else if (e.key === 'ArrowLeft') {
                                targetCell--;
                                if (targetCell < 0) targetCell = 47;
                              } else if (e.key === 'ArrowUp') {
                                targetType = 'sea';
                              } else if (e.key === 'ArrowDown' && crewIndex < crewTasks.length - 1) {
                                targetCrew = crewIndex + 1;
                                targetType = 'sea';
                              }
                              
                              const targetElement = document.querySelector(
                                `[data-testid="cell-${targetType}-${targetCrew}-${targetCell}"]`
                              ) as HTMLElement;
                              
                              if (targetElement) {
                                targetElement.focus();
                                const selection = window.getSelection();
                                const range = document.createRange();
                                range.selectNodeContents(targetElement);
                                selection?.removeAllRanges();
                                selection?.addRange(range);
                              }
                            }
                          }}
                          className="outline-none cursor-text min-h-[20px]"
                          style={{ width: '100%', minWidth: '15px' }}
                          data-testid={`cell-port-${crewIndex}-${cellIndex}`}
                        >
                          {cellValue}
                        </div>
                      </td>
                    );
                  })}
                  <td className="border px-2 py-1 text-center font-medium">
                    {calculateRestHours(crew.portHours).toFixed(1)}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border" style={{ backgroundColor: '#E5E7EB' }}></div>
          <span>Watch (w) / Daywork (d)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border" style={{ backgroundColor: 'white' }}></div>
          <span>Rest</span>
        </div>
        <div className="ml-4 text-gray-500">
          This daily template applies to all days in the month | Type 'w' or 'd' in edit mode | Use arrow keys to navigate
        </div>
      </div>
    </div>
  );
};
