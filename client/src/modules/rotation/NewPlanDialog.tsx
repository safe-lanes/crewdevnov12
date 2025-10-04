import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover as DatePopover, PopoverContent as DatePopoverContent, PopoverTrigger as DatePopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { addMonths, differenceInDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CrewMember {
  id: string;
  name: string;
  rank: string;
  experience: {
    company: number;
    rank: number;
    tankers: number;
    oow: number;
    endorsements: string;
  };
}

interface ExistingCrew {
  id: string;
  vessel: string;
  rank: string;
  name: string;
  contractStartDate: string;
  contractEndDate: string;
  rangeEndDate: string;
}

interface Assignment {
  vessel: string;
  rank: string;
  crewId: string;
  crewName: string;
  joiningDate: string;
  contractPeriod: number;
}

// Crew Column Component - displays available crew for a specific rank
function CrewColumn({ 
  rank, 
  onCrewSelect, 
  assignments 
}: { 
  rank: string; 
  onCrewSelect: (crew: { id: string; name: string; rank: string }) => void;
  assignments: Assignment[];
}) {
  const { data: crewMembers = [], isLoading } = useQuery<CrewMember[]>({
    queryKey: [`/api/crew-members/by-rank/${rank}`],
  });

  // Check if crew is assigned to multiple vessels
  const isMultiVesselAssignment = (crewId: string) => {
    const vesselCount = new Set(
      assignments
        .filter(a => a.crewId === crewId)
        .map(a => a.vessel)
    ).size;
    return vesselCount > 1;
  };

  if (isLoading) {
    return (
      <div className="w-64">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-t font-semibold flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-400 rounded" />
          <span>{rank}</span>
        </div>
        <div className="p-4 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0">
      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-t font-semibold flex items-center gap-2">
        <Checkbox data-testid={`checkbox-select-all-${rank}`} />
        <span>{rank}</span>
      </div>
      <div className="border-t">
        {crewMembers.map((crew) => (
          <div
            key={crew.id}
            className="p-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 flex items-start gap-2 cursor-pointer"
            onClick={() => onCrewSelect({ id: crew.id, name: crew.name, rank: crew.rank })}
          >
            <Checkbox 
              data-testid={`checkbox-crew-${crew.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onCrewSelect({ id: crew.id, name: crew.name, rank: crew.rank });
              }}
            />
            <div className="flex-1">
              <div className={`font-medium text-sm ${isMultiVesselAssignment(crew.id) ? 'text-red-600' : ''}`}>
                {crew.name.split(' ')[0]} {crew.name.split(' ').slice(-1)[0].charAt(0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {crew.experience.company} / {crew.experience.rank} / {crew.experience.tankers} / {crew.experience.oow} / {crew.experience.endorsements}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Date Period Dialog - for selecting joining date and contract period
function DatePeriodDialog({
  open,
  onOpenChange,
  onApply,
  crewName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (joiningDate: Date, contractPeriod: number) => void;
  crewName: string;
}) {
  const [joiningDate, setJoiningDate] = useState<Date>();
  const [contractPeriod, setContractPeriod] = useState<string>('');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setJoiningDate(undefined);
      setContractPeriod('');
    }
  }, [open]);

  const handleApply = () => {
    if (!joiningDate || !contractPeriod) {
      return;
    }
    onApply(joiningDate, parseInt(contractPeriod));
    onOpenChange(false);
    // Reset
    setJoiningDate(undefined);
    setContractPeriod('');
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset
    setJoiningDate(undefined);
    setContractPeriod('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {crewName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Joining Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Joining Date</label>
            <DatePopover>
              <DatePopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !joiningDate && "text-muted-foreground"
                  )}
                  data-testid="button-joining-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {joiningDate ? format(joiningDate, "PPP") : "Pick a date"}
                </Button>
              </DatePopoverTrigger>
              <DatePopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={joiningDate}
                  onSelect={setJoiningDate}
                  initialFocus
                  data-testid="calendar-joining-date"
                />
              </DatePopoverContent>
            </DatePopover>
          </div>

          {/* Contract Period */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Contract Period (Months)</label>
            <Select value={contractPeriod} onValueChange={setContractPeriod}>
              <SelectTrigger className="w-full" data-testid="select-contract-period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="9">9 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="button-cancel-assignment"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!joiningDate || !contractPeriod}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-apply-assignment"
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Vessel Timeline Component - shows existing crew (top) and new assignments (bottom)
function VesselTimelineView({ 
  vessels, 
  ranks, 
  selectedVessel,
  onVesselSelect,
  assignments = []
}: { 
  vessels: string[]; 
  ranks: string[]; 
  selectedVessel: string;
  onVesselSelect: (vessel: string) => void;
  assignments?: Assignment[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Calculate 7-month window (2 months before today + today + 5 months after today)
  const today = useMemo(() => new Date(), []);
  const startDate = useMemo(() => addMonths(today, -2), [today]);
  const endDate = useMemo(() => addMonths(today, 5), [today]);
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
  // Fetch existing crew for selected vessels and ranks
  const queryParams = new URLSearchParams();
  queryParams.append('filterType', 'vessel');
  vessels.forEach(v => queryParams.append('vessels', v));
  ranks.forEach(r => queryParams.append('rank', r));
  
  const { data: existingCrew = [] } = useQuery<ExistingCrew[]>({
    queryKey: ['/api/rotation/due-crew', queryParams.toString()],
    queryFn: () => fetch(`/api/rotation/due-crew?${queryParams.toString()}`).then(res => res.json()),
    enabled: vessels.length > 0 && ranks.length > 0,
  });
  
  // Group data by vessel and rank
  const groupedData = useMemo(() => {
    const groups: { [key: string]: { [key: string]: { existing: ExistingCrew[], assignments: Assignment[] } } } = {};
    
    vessels.forEach(vessel => {
      groups[vessel] = {};
      ranks.forEach(rank => {
        groups[vessel][rank] = {
          existing: existingCrew.filter(c => c.vessel === vessel && c.rank === rank),
          assignments: assignments.filter(a => a.vessel === vessel && a.rank === rank),
        };
      });
    });
    
    return groups;
  }, [vessels, ranks, existingCrew, assignments]);
  
  // Resize canvas to match container
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);
  
  // Generate month headers
  const months = useMemo(() => {
    const result = [];
    let current = startOfMonth(startDate);
    while (current <= endOfMonth(endDate)) {
      result.push({
        label: format(current, 'MMM'),
        date: current,
      });
      current = addMonths(current, 1);
    }
    return result;
  }, [startDate, endDate]);
  
  // Draw timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvasSize.width;
    const height = canvasSize.height;
    const vesselHeaderHeight = 48;
    const monthHeaderHeight = 32;
    const rowHeight = 40;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    let yOffset = 0;
    
    // Draw each vessel section
    vessels.forEach((vessel, vesselIdx) => {
      // Draw vessel header
      ctx.fillStyle = '#52baf3';
      ctx.fillRect(0, yOffset, width, vesselHeaderHeight);
      
      // Draw vessel name with radio button
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(vessel, 40, yOffset + 30);
      
      // Draw radio button
      ctx.beginPath();
      ctx.arc(20, yOffset + 24, 8, 0, 2 * Math.PI);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      if (selectedVessel === vessel) {
        ctx.beginPath();
        ctx.arc(20, yOffset + 24, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
      
      yOffset += vesselHeaderHeight;
      
      // Draw month headers
      ctx.fillStyle = '#52baf3';
      ctx.fillRect(0, yOffset, width, monthHeaderHeight);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      
      months.forEach((month) => {
        // Calculate X position based on actual day offset from startDate
        const monthStart = month.date > startDate ? month.date : startDate;
        const monthEnd = endOfMonth(month.date) < endDate ? endOfMonth(month.date) : endDate;
        
        // Skip months completely outside the visible range
        if (monthEnd < startDate || monthStart > endDate) return;
        
        const monthStartX = ((differenceInDays(monthStart, startDate) / totalDays) * width);
        const monthEndX = ((differenceInDays(monthEnd, startDate) / totalDays) * width);
        const x = (monthStartX + monthEndX) / 2; // Center of month within visible range
        
        if (x >= 0 && x <= width) {
          ctx.fillText(month.label, x, yOffset + 20);
        }
      });
      
      yOffset += monthHeaderHeight;
      
      // Draw rank rows
      ranks.forEach((rank, rankIdx) => {
        const rowData = groupedData[vessel]?.[rank];
        if (!rowData) return;
        
        const y = yOffset;
        
        // Draw row background
        ctx.fillStyle = rankIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
        ctx.fillRect(0, y, width, rowHeight);
        
        // Draw rank label (left aligned)
        ctx.fillStyle = '#4f5863';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(rank, 10, y + 25);
        
        // Draw existing crew bars (top half)
        const topBarY = y + 5;
        const topBarHeight = 15;
        
        rowData.existing.forEach(crew => {
          const contractStart = new Date(crew.contractStartDate);
          const contractEnd = new Date(crew.contractEndDate);
          const rangeEnd = new Date(crew.rangeEndDate);
          
          const greenStart = Math.max(0, ((differenceInDays(contractStart, startDate) / totalDays) * width));
          const greenEnd = Math.max(0, ((differenceInDays(contractEnd, startDate) / totalDays) * width));
          const yellowEnd = Math.max(0, ((differenceInDays(rangeEnd, startDate) / totalDays) * width));
          
          // Draw green bar
          if (greenEnd > greenStart) {
            ctx.fillStyle = 'rgba(2, 169, 33, 0.5)';
            ctx.fillRect(greenStart, topBarY, greenEnd - greenStart, topBarHeight);
          }
          
          // Draw yellow bar
          if (yellowEnd > greenEnd) {
            ctx.fillStyle = 'rgba(241, 205, 29, 0.5)';
            ctx.fillRect(greenEnd, topBarY, yellowEnd - greenEnd, topBarHeight);
          }
          
          // Draw pink bar (overdue)
          if (rangeEnd < today) {
            const todayX = ((differenceInDays(today, startDate) / totalDays) * width);
            const pinkStart = yellowEnd;
            const pinkEnd = todayX;
            if (pinkEnd > pinkStart) {
              ctx.fillStyle = 'rgba(229, 78, 96, 0.5)';
              ctx.fillRect(pinkStart, topBarY, pinkEnd - pinkStart, topBarHeight);
            }
          }
          
          // Draw crew name on the bar
          ctx.fillStyle = '#1f2937';
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(crew.name, greenStart + 4, topBarY + 11);
        });
        
        // Draw new assignment bars (bottom half)
        const bottomBarY = y + 20;
        const bottomBarHeight = 15;
        
        rowData.assignments.forEach(assignment => {
          const joiningDate = new Date(assignment.joiningDate);
          const contractEndDate = addMonths(joiningDate, assignment.contractPeriod);
          
          const blueStart = Math.max(0, ((differenceInDays(joiningDate, startDate) / totalDays) * width));
          const blueEnd = Math.max(0, ((differenceInDays(contractEndDate, startDate) / totalDays) * width));
          
          if (blueEnd > blueStart) {
            ctx.fillStyle = 'rgba(82, 186, 243, 0.7)';
            ctx.fillRect(blueStart, bottomBarY, blueEnd - blueStart, bottomBarHeight);
            
            // Draw crew name on the bar
            ctx.fillStyle = 'white';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(assignment.crewName, blueStart + 4, bottomBarY + 11);
          }
        });
        
        // Draw row divider
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + rowHeight - 0.5);
        ctx.lineTo(width, y + rowHeight - 0.5);
        ctx.stroke();
        
        yOffset += rowHeight;
      });
    });
    
    // Draw "today" vertical line
    const todayX = ((differenceInDays(today, startDate) / totalDays) * width);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, 0);
    ctx.lineTo(todayX, yOffset);
    ctx.stroke();
    
  }, [vessels, ranks, groupedData, selectedVessel, months, today, startDate, endDate, totalDays, canvasSize]);
  
  // Handle canvas click for vessel selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const vesselHeaderHeight = 48;
    const monthHeaderHeight = 32;
    const rowHeight = 40;
    
    let yOffset = 0;
    
    vessels.forEach((vessel) => {
      if (y >= yOffset && y < yOffset + vesselHeaderHeight) {
        onVesselSelect(vessel);
        return;
      }
      yOffset += vesselHeaderHeight + monthHeaderHeight + (ranks.length * rowHeight);
    });
  };
  
  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block cursor-pointer"
        onClick={handleCanvasClick}
        data-testid="canvas-vessel-timeline"
      />
    </div>
  );
}

export function NewPlanDialog({ open, onOpenChange }: NewPlanDialogProps) {
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<{ id: string; name: string; rank: string } | null>(null);
  const { toast } = useToast();

  // Fetch vessels from master data
  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<any[]>({
    queryKey: ['/api/masters/014/data'],
  });

  // Fetch company ranks
  const { data: companyRanks = [], isLoading: ranksLoading } = useQuery<any[]>({
    queryKey: ['/api/company-ranks'],
  });

  // Save rotation plan mutation
  const saveRotationPlanMutation = useMutation({
    mutationFn: async (planData: any) => {
      return await apiRequest('/api/rotation-plans', {
        method: 'POST',
        body: JSON.stringify(planData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Rotation plan saved as draft successfully",
      });
      onOpenChange(false);
      // Reset form
      setSelectedVessels([]);
      setSelectedRanks([]);
      setSelectedVessel('');
      setAssignments([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save rotation plan",
        variant: "destructive",
      });
    },
  });

  const toggleVessel = (vesselName: string) => {
    setSelectedVessels(prev =>
      prev.includes(vesselName)
        ? prev.filter(v => v !== vesselName)
        : [...prev, vesselName]
    );
  };

  const toggleRank = (rank: string) => {
    setSelectedRanks(prev =>
      prev.includes(rank)
        ? prev.filter(r => r !== rank)
        : [...prev, rank]
    );
  };

  // Auto-select first vessel when vessels are selected
  useEffect(() => {
    if (selectedVessels.length > 0 && !selectedVessels.includes(selectedVessel)) {
      setSelectedVessel(selectedVessels[0]);
    }
  }, [selectedVessels, selectedVessel]);

  const handleCrewSelect = (crew: { id: string; name: string; rank: string }) => {
    if (!selectedVessel) {
      alert('Please select a vessel first by clicking on a vessel header in the timeline');
      return;
    }
    setSelectedCrew(crew);
    setDateDialogOpen(true);
  };

  const handleAssignmentApply = (joiningDate: Date, contractPeriod: number) => {
    if (!selectedCrew || !selectedVessel) return;

    const newAssignment: Assignment = {
      vessel: selectedVessel,
      rank: selectedCrew.rank,
      crewId: selectedCrew.id,
      crewName: selectedCrew.name,
      joiningDate: joiningDate.toISOString(),
      contractPeriod,
    };

    setAssignments(prev => [...prev, newAssignment]);
  };

  const handleBack = () => {
    onOpenChange(false);
  };

  const handleSave = () => {
    if (selectedVessels.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one vessel",
        variant: "destructive",
      });
      return;
    }

    if (selectedRanks.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one rank",
        variant: "destructive",
      });
      return;
    }

    if (assignments.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please create at least one crew assignment",
        variant: "destructive",
      });
      return;
    }

    // Generate unique draft ID using timestamp
    const draftId = `DRAFT-${Date.now()}`;
    
    // Calculate plan date range from assignments
    const joiningDates = assignments.map(a => new Date(a.joiningDate));
    const planFromDate = new Date(Math.min(...joiningDates.map(d => d.getTime())));
    
    // Calculate planToDate as the latest contract end date
    const contractEndDates = assignments.map(a => {
      const joiningDate = new Date(a.joiningDate);
      return addMonths(joiningDate, a.contractPeriod);
    });
    const planToDate = new Date(Math.max(...contractEndDates.map(d => d.getTime())));

    // Format crew roles as comma-separated string
    const crewRoles = [...new Set(selectedRanks)].join(', ');

    // Prepare plan data
    const planData = {
      draftId,
      lastEdited: new Date().toISOString(),
      vessels: JSON.stringify(selectedVessels),
      crew: crewRoles,
      planFromDate: format(planFromDate, 'yyyy-MM-dd'),
      planToDate: format(planToDate, 'yyyy-MM-dd'),
      createdBy: 'Current User', // TODO: Get from auth context
      planStatus: 'In Draft',
      assignments: JSON.stringify(assignments),
    };

    saveRotationPlanMutation.mutate(planData);
  };

  const handlePropose = () => {
    // TODO: Implement propose (pending approval)
    console.log('Propose for approval');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold">New Rotation Plan</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-gray-300"
                data-testid="button-back"
              >
                &lt; Back
              </Button>
              <Button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-save"
              >
                Save
              </Button>
              <Button
                onClick={handlePropose}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-propose"
              >
                Propose
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filter dropdowns */}
        <div className="px-6 pb-4 flex gap-4">
          {/* Vessels multi-select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-48 justify-between"
                disabled={vesselsLoading}
                data-testid="select-vessels"
              >
                <span className="truncate">
                  {selectedVessels.length > 0
                    ? `${selectedVessels.length} vessel${selectedVessels.length > 1 ? 's' : ''} selected`
                    : vesselsLoading ? "Loading..." : "Vessels"
                  }
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
              <div className="max-h-60 overflow-y-auto">
                {vessels.map((vessel: any) => (
                  <div
                    key={vessel.id}
                    className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  >
                    <Checkbox
                      checked={selectedVessels.includes(vessel.name)}
                      onCheckedChange={() => toggleVessel(vessel.name)}
                      data-testid={`checkbox-vessel-${vessel.id}`}
                    />
                    <label
                      className="text-sm cursor-pointer flex-1"
                      onClick={() => toggleVessel(vessel.name)}
                    >
                      {vessel.name}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Ranks multi-select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-48 justify-between"
                disabled={ranksLoading}
                data-testid="select-ranks"
              >
                <span className="truncate">
                  {selectedRanks.length > 0
                    ? `${selectedRanks.length} rank${selectedRanks.length > 1 ? 's' : ''} selected`
                    : ranksLoading ? "Loading..." : "Ranks"
                  }
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
              <div className="max-h-60 overflow-y-auto">
                {companyRanks.map((rank: any) => (
                  <div
                    key={rank.id}
                    className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  >
                    <Checkbox
                      checked={selectedRanks.includes(rank.rank)}
                      onCheckedChange={() => toggleRank(rank.rank)}
                      data-testid={`checkbox-rank-${rank.id}`}
                    />
                    <label
                      className="text-sm cursor-pointer flex-1"
                      onClick={() => toggleRank(rank.rank)}
                    >
                      {rank.rank}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Main content area - split into left (crew) and right (vessels/timeline) sections */}
        <div className="flex-1 px-6 pb-6 overflow-hidden flex gap-4">
          {/* Left Section - Available Crew */}
          <div className="w-1/3 border rounded-lg bg-white dark:bg-gray-900 overflow-auto">
            {selectedRanks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select ranks to view available crew</p>
              </div>
            ) : (
              <div className="flex gap-4 p-4" style={{ minWidth: `${selectedRanks.length * 280}px` }}>
                {selectedRanks.map(rank => (
                  <CrewColumn 
                    key={rank} 
                    rank={rank} 
                    onCrewSelect={handleCrewSelect}
                    assignments={assignments}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Section - Vessel Timeline */}
          <div className="flex-1 border rounded-lg bg-white dark:bg-gray-900 overflow-hidden">
            {selectedVessels.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select vessels to begin planning</p>
              </div>
            ) : selectedRanks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select ranks to view timeline</p>
              </div>
            ) : (
              <VesselTimelineView
                vessels={selectedVessels}
                ranks={selectedRanks}
                selectedVessel={selectedVessel}
                onVesselSelect={setSelectedVessel}
                assignments={assignments}
              />
            )}
          </div>
        </div>
      </DialogContent>

      {/* Date Period Dialog for crew assignment */}
      <DatePeriodDialog
        open={dateDialogOpen}
        onOpenChange={setDateDialogOpen}
        onApply={handleAssignmentApply}
        crewName={selectedCrew?.name || ''}
      />
    </Dialog>
  );
}
