import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { VariableTask, InsertVariableTask } from '@shared/schema';

interface VariableTaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertVariableTask, isDraft: boolean) => void;
  editData?: VariableTask | null;
  vesselId: string;
  periodValue: string;
  crewMembers?: any[];
}

const formSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  finishDate: z.string().min(1, 'Finish date is required'),
  finishTime: z.string().min(1, 'Finish time is required'),
  recordType: z.enum(['task', 'port-call']),
  statusType: z.enum(['planned', 'completed']),
  selectedTasks: z.array(z.string()).optional(),
  otherTask: z.string().optional(),
  crewGroups: z.array(z.string()).optional(),
  deckCrews: z.array(z.string()).optional(),
  engineCrews: z.array(z.string()).optional(),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const PREDEFINED_TASKS = [
  { id: '1', label: 'Task 1: Hot work' },
  { id: '2', label: 'Task 2: Arrival/Departure Port' },
  { id: '3', label: 'Task 3: Safety Drill' },
  { id: '4', label: 'Task 4: Maintenance' },
  { id: '5', label: 'Task 5: Cargo Operations' },
  { id: '6', label: 'Task 6: Bunkering' },
  { id: '7', label: 'Task 7: Tank Cleaning' },
  { id: '8', label: 'Task 8: Survey/Inspection' },
  { id: '9', label: 'Task 9: Emergency Response' },
  { id: '10', label: 'Task 10: Training' },
  { id: '11', label: 'Task 11: Navigation Watch' },
];

const CREW_GROUPS = [
  { id: 'all-crew', label: 'All Crew' },
  { id: 'deck-officers', label: 'Deck Officers' },
  { id: 'engine-officers', label: 'Engine Officers' },
  { id: 'deck-crew', label: 'Deck Crew' },
  { id: 'engine-crew', label: 'Engine Crew' },
  { id: 'catering', label: 'Catering' },
];

export const VariableTaskForm = ({
  open,
  onOpenChange,
  onSubmit,
  editData,
  vesselId,
  periodValue,
  crewMembers = []
}: VariableTaskFormProps): JSX.Element => {
  const { toast } = useToast();
  const [showOtherTask, setShowOtherTask] = useState(false);

  // Fetch all crew members
  const { data: allCrewMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/crew-members'],
    enabled: open,
  });

  // Fetch company ranks with designation flags
  const { data: companyRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/company-ranks'],
    enabled: open,
  });

  // Filter crew members by vessel
  const vesselCrewMembers = useMemo(() => {
    return allCrewMembers.filter((crew: any) => crew.presentVessel === vesselId);
  }, [allCrewMembers, vesselId]);

  // Build rank designation lookup map
  // Use role if it exists (for multi-position ranks like "3rd Officer_1"), otherwise use rank name
  const rankDesignationMap = useMemo(() => {
    const map = new Map<string, any>();
    companyRanks.forEach((rank: any) => {
      const key = rank.role || rank.rank;
      map.set(key, rank);
    });
    return map;
  }, [companyRanks]);

  // Categorize crew into departments based on rank designation flags
  const categorizedCrew = useMemo(() => {
    const deckCateringCrew: Array<{ id: string; rank: string; name: string; rankData: any }> = [];
    const engineCrew: Array<{ id: string; rank: string; name: string; rankData: any }> = [];

    vesselCrewMembers.forEach((crew: any) => {
      const rankData = rankDesignationMap.get(crew.presentRank);
      if (!rankData) return;

      const crewItem = {
        id: crew.id || crew.employeeId,
        rank: crew.presentRank,
        name: `${crew.firstName || ''} ${crew.lastName || ''}`.trim(),
        rankData,
      };

      // Check if rank belongs to Deck & Catering Dept
      if (rankData.deckOfficer || rankData.deckRating || rankData.cateringRating) {
        deckCateringCrew.push(crewItem);
      }
      // Check if rank belongs to Engine Dept
      else if (rankData.engOfficer || rankData.engineRating) {
        engineCrew.push(crewItem);
      }
    });

    return { deckCateringCrew, engineCrew };
  }, [vesselCrewMembers, rankDesignationMap]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: '',
      startTime: '',
      finishDate: '',
      finishTime: '',
      recordType: 'task',
      statusType: 'planned',
      selectedTasks: [],
      otherTask: '',
      crewGroups: [],
      deckCrews: [],
      engineCrews: [],
      comments: '',
    },
  });

  const recordType = form.watch('recordType');
  const statusType = form.watch('statusType');
  const selectedTasks = form.watch('selectedTasks') || [];

  // Helper function to get crew IDs for a specific group
  const getCrewIdsForGroup = (groupId: string): string[] => {
    switch (groupId) {
      case 'all-crew':
        // All crew from both departments
        return [
          ...categorizedCrew.deckCateringCrew.map(c => c.id),
          ...categorizedCrew.engineCrew.map(c => c.id)
        ];
      
      case 'deck-officers':
        // Deck officers only (deckOfficer flag)
        return categorizedCrew.deckCateringCrew
          .filter(c => c.rankData.deckOfficer)
          .map(c => c.id);
      
      case 'engine-officers':
        // Engine officers only (engOfficer flag)
        return categorizedCrew.engineCrew
          .filter(c => c.rankData.engOfficer)
          .map(c => c.id);
      
      case 'deck-crew':
        // Deck crew/ratings only (deckRating flag)
        return categorizedCrew.deckCateringCrew
          .filter(c => c.rankData.deckRating)
          .map(c => c.id);
      
      case 'engine-crew':
        // Engine crew/ratings only (engineRating flag)
        return categorizedCrew.engineCrew
          .filter(c => c.rankData.engineRating)
          .map(c => c.id);
      
      case 'catering':
        // Catering staff only (cateringRating flag)
        return categorizedCrew.deckCateringCrew
          .filter(c => c.rankData.cateringRating)
          .map(c => c.id);
      
      default:
        return [];
    }
  };

  // Handle group checkbox changes
  const handleGroupCheckboxChange = (groupId: string, checked: boolean) => {
    const groupCrewIds = getCrewIdsForGroup(groupId);
    
    // Separate into deck and engine crew
    const deckIds = groupCrewIds.filter(id => 
      categorizedCrew.deckCateringCrew.some(c => c.id === id)
    );
    const engineIds = groupCrewIds.filter(id => 
      categorizedCrew.engineCrew.some(c => c.id === id)
    );
    
    if (checked) {
      // Add crew IDs to respective form fields
      const currentDeckCrews = form.getValues('deckCrews') || [];
      const currentEngineCrews = form.getValues('engineCrews') || [];
      
      form.setValue('deckCrews', Array.from(new Set([...currentDeckCrews, ...deckIds])));
      form.setValue('engineCrews', Array.from(new Set([...currentEngineCrews, ...engineIds])));
    } else {
      // Remove crew IDs from respective form fields
      const currentDeckCrews = form.getValues('deckCrews') || [];
      const currentEngineCrews = form.getValues('engineCrews') || [];
      
      form.setValue('deckCrews', currentDeckCrews.filter(id => !deckIds.includes(id)));
      form.setValue('engineCrews', currentEngineCrews.filter(id => !engineIds.includes(id)));
    }
  };

  useEffect(() => {
    if (editData) {
      const startDT = editData.startDateTime.split(' / ');
      const finishDT = editData.finishDateTime.split(' / ');
      
      const startDate = startDT[0] ? formatDateForInput(startDT[0]) : '';
      const startTime = startDT[1] || '';
      const finishDate = finishDT[0] ? formatDateForInput(finishDT[0]) : '';
      const finishTime = finishDT[1] || '';

      let parsedTasks: string[] = [];
      try {
        parsedTasks = JSON.parse(editData.selectedTasks || '[]');
      } catch (e) {
        parsedTasks = [];
      }

      let parsedCrewDetails: any = {};
      try {
        parsedCrewDetails = JSON.parse(editData.crewInvolvedDetails || '{}');
      } catch (e) {
        parsedCrewDetails = {};
      }

      // Extract deck and engine crew IDs from the crew array (new format)
      // or fall back to the old format if crew array doesn't exist
      let deckCrewIds: string[] = [];
      let engineCrewIds: string[] = [];
      
      if (parsedCrewDetails.crew && Array.isArray(parsedCrewDetails.crew)) {
        // New format: crew is an array of { id, rank, name, department }
        deckCrewIds = parsedCrewDetails.crew
          .filter((c: any) => c.department === 'Deck & Catering')
          .map((c: any) => c.id);
        engineCrewIds = parsedCrewDetails.crew
          .filter((c: any) => c.department === 'Engine')
          .map((c: any) => c.id);
      } else {
        // Old format fallback
        deckCrewIds = parsedCrewDetails.deckCrews || [];
        engineCrewIds = parsedCrewDetails.engineCrews || [];
      }

      form.reset({
        startDate,
        startTime,
        finishDate,
        finishTime,
        recordType: editData.recordType as "task" | "port-call",
        statusType: editData.statusType as "planned" | "completed",
        selectedTasks: parsedTasks,
        otherTask: editData.otherTask || '',
        crewGroups: parsedCrewDetails.groups || [],
        deckCrews: deckCrewIds,
        engineCrews: engineCrewIds,
        comments: editData.comments || '',
      });

      if (editData.otherTask) {
        setShowOtherTask(true);
      }
    } else {
      form.reset({
        startDate: '',
        startTime: '',
        finishDate: '',
        finishTime: '',
        recordType: 'task',
        statusType: 'planned',
        selectedTasks: [],
        otherTask: '',
        crewGroups: [],
        deckCrews: [],
        engineCrews: [],
        comments: '',
      });
      setShowOtherTask(false);
    }
  }, [editData, form]);

  const formatDateForInput = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return '';
      
      const day = parts[0];
      const monthMap: Record<string, string> = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      const month = monthMap[parts[1]] || '01';
      const year = parts[2];
      
      return `${year}-${month}-${day.padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const formatDateForDisplay = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '';
    }
  };

  const deckCrewMembers = useMemo(() => {
    return crewMembers.filter(crew => 
      crew.department === 'Deck' || crew.department === 'Catering'
    );
  }, [crewMembers]);

  const engineCrewMembers = useMemo(() => {
    return crewMembers.filter(crew => crew.department === 'Engine');
  }, [crewMembers]);

  const handleFormSubmit = (values: FormValues, isDraft: boolean) => {
    const startDateTime = `${formatDateForDisplay(values.startDate)} / ${values.startTime}`;
    const finishDateTime = `${formatDateForDisplay(values.finishDate)} / ${values.finishTime}`;
    
    const startDateTimeSort = `${values.startDate}T${values.startTime}:00`;
    const finishDateTimeSort = `${values.finishDate}T${values.finishTime}:00`;

    const taskLabel = values.selectedTasks && values.selectedTasks.length > 0
      ? PREDEFINED_TASKS.find(t => t.id === values.selectedTasks![0])?.label.split(': ')[1] || 'Task'
      : recordType === 'port-call' 
        ? statusType === 'planned' ? 'Planned Port Call' : 'Completed Port Call'
        : 'Task';

    const statusLabel = statusType === 'planned' ? 'Planned' : 'Completed';

    // Build detailed crew member array with id, rank, name, department
    const selectedDeckCrewDetails = (values.deckCrews || []).map(crewId => {
      const crewMember = categorizedCrew.deckCateringCrew.find(c => c.id === crewId);
      return crewMember ? {
        id: crewMember.id,
        rank: crewMember.rank,
        name: crewMember.name,
        department: 'Deck & Catering'
      } : null;
    }).filter(Boolean);

    const selectedEngineCrewDetails = (values.engineCrews || []).map(crewId => {
      const crewMember = categorizedCrew.engineCrew.find(c => c.id === crewId);
      return crewMember ? {
        id: crewMember.id,
        rank: crewMember.rank,
        name: crewMember.name,
        department: 'Engine'
      } : null;
    }).filter(Boolean);

    const allSelectedCrewDetails = [...selectedDeckCrewDetails, ...selectedEngineCrewDetails];

    const crewInvolvedDetails = {
      groups: values.crewGroups || [],
      crew: allSelectedCrewDetails,
      deckCrewCount: selectedDeckCrewDetails.length,
      engineCrewCount: selectedEngineCrewDetails.length,
    };

    const totalCrew = allSelectedCrewDetails.length;

    const insertData: InsertVariableTask = {
      startDateTime,
      finishDateTime,
      startDateTimeSort,
      finishDateTimeSort,
      task: taskLabel,
      status: statusLabel,
      crewInvolved: totalCrew,
      remarks: values.comments || '',
      periodValue,
      vesselId: vesselId ? String(vesselId) : null,
      isDraft,
      recordType: values.recordType,
      statusType: values.statusType,
      selectedTasks: JSON.stringify(values.selectedTasks || []),
      otherTask: values.otherTask || null,
      crewInvolvedDetails: JSON.stringify(crewInvolvedDetails),
      comments: values.comments || null,
    };

    onSubmit(insertData, isDraft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {editData ? 'Edit Variable Task' : 'Add Variable Task'}
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            data-testid="button-close-form"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-6">
            {/* Date & Time Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Date & Time</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-start-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="finishDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Finish Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-finish-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="finishTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Finish Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-finish-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Record Type Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Record Type</h3>
              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="recordType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task / Port Call</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="task" id="task" data-testid="radio-task" />
                            <Label htmlFor="task">Task Record</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="port-call" id="port-call" data-testid="radio-port-call" />
                            <Label htmlFor="port-call">Port Call Record</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="statusType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="planned" id="planned" data-testid="radio-planned" />
                            <Label htmlFor="planned">Planned</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="completed" id="completed" data-testid="radio-completed" />
                            <Label htmlFor="completed">Completed</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Task(s) Involved Section - Only show for task records */}
            {recordType === 'task' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Task(s) Involved</h3>
                <FormField
                  control={form.control}
                  name="selectedTasks"
                  render={() => (
                    <FormItem>
                      <div className="grid grid-cols-2 gap-2">
                        {PREDEFINED_TASKS.map((task) => (
                          <FormField
                            key={task.id}
                            control={form.control}
                            name="selectedTasks"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={task.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(task.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), task.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== task.id
                                              )
                                            );
                                      }}
                                      data-testid={`checkbox-task-${task.id}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    {task.label}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Other Task */}
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    checked={showOtherTask}
                    onCheckedChange={(checked) => {
                      setShowOtherTask(checked as boolean);
                      if (!checked) {
                        form.setValue('otherTask', '');
                      }
                    }}
                    data-testid="checkbox-other-task"
                  />
                  <Label>Other (specify)</Label>
                </div>
                {showOtherTask && (
                  <FormField
                    control={form.control}
                    name="otherTask"
                    render={({ field }) => (
                      <FormItem className="ml-6">
                        <FormControl>
                          <Input
                            placeholder="Enter task description"
                            {...field}
                            data-testid="input-other-task"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {/* Crew Involved Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Crew Involved</h3>
              <div className="grid grid-cols-3 gap-4">
                {/* Groups Column */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Groups</Label>
                  <FormField
                    control={form.control}
                    name="crewGroups"
                    render={() => (
                      <FormItem>
                        <div className="space-y-2">
                          {CREW_GROUPS.map((group) => (
                            <FormField
                              key={group.id}
                              control={form.control}
                              name="crewGroups"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={group.id}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(group.id)}
                                        onCheckedChange={(checked) => {
                                          // Update the group selection
                                          const newValue = checked
                                            ? [...(field.value || []), group.id]
                                            : field.value?.filter((value) => value !== group.id);
                                          field.onChange(newValue);
                                          
                                          // Auto-select/deselect corresponding individual crew members
                                          handleGroupCheckboxChange(group.id, checked as boolean);
                                        }}
                                        data-testid={`checkbox-group-${group.id}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {group.label}
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Deck & Catering Dept Column */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Deck & Catering Dept.</Label>
                  <FormField
                    control={form.control}
                    name="deckCrews"
                    render={() => (
                      <FormItem>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {categorizedCrew.deckCateringCrew.length === 0 ? (
                            <p className="text-sm text-gray-500">No crew members available</p>
                          ) : (
                            categorizedCrew.deckCateringCrew.map((crew) => (
                              <FormField
                                key={crew.id}
                                control={form.control}
                                name="deckCrews"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={crew.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(crew.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...(field.value || []), crew.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== crew.id
                                                  )
                                                );
                                          }}
                                          data-testid={`checkbox-deck-crew-${crew.id}`}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {crew.rank} - {crew.name}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Engine Dept Column */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Engine Dept.</Label>
                  <FormField
                    control={form.control}
                    name="engineCrews"
                    render={() => (
                      <FormItem>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {categorizedCrew.engineCrew.length === 0 ? (
                            <p className="text-sm text-gray-500">No crew members available</p>
                          ) : (
                            categorizedCrew.engineCrew.map((crew) => (
                              <FormField
                                key={crew.id}
                                control={form.control}
                                name="engineCrews"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={crew.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(crew.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...(field.value || []), crew.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== crew.id
                                                  )
                                                );
                                          }}
                                          data-testid={`checkbox-engine-crew-${crew.id}`}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {crew.rank} - {crew.name}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Comments Section */}
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any additional comments..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="textarea-comments"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                onClick={() => form.handleSubmit((values) => handleFormSubmit(values, true))()}
                className="bg-[#16569e] hover:bg-[#0f4078] text-white"
                data-testid="button-save-draft"
              >
                Save (Draft)
              </Button>
              <Button
                type="button"
                onClick={() => form.handleSubmit((values) => handleFormSubmit(values, false))()}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-submit"
              >
                Submit
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
