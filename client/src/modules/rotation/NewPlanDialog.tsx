import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover as DatePopover, PopoverContent as DatePopoverContent, PopoverTrigger as DatePopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { addMonths, differenceInDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVesselLookup } from '@/hooks/useVesselLookup';

// Format date as DD-MMM-YY (e.g., "15 Dec 25")
function formatAvailabilityDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  } catch {
    return dateString || '—';
  }
}

interface RotationPlan {
  id: number;
  draftId: string;
  lastEdited: string;
  vessels: string; // JSON array
  crew: string;
  planFromDate: string;
  planToDate: string;
  createdBy: string;
  planStatus: string;
  assignments: string | null; // JSON array
}

interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlan?: RotationPlan | null; // Optional plan to edit
}

interface CrewMember {
  id: string;
  name: string;
  rank: string;
  pool?: string;
  crewPool?: string;
  manningAgent?: string;
  shipType?: string;
  nationality?: string;
  travelStatus?: string;
  higherCert?: string;
  performance?: string;
  nextAvailability?: string | null;
  experience: {
    company: number;
    rank: number;
    tankers: number;
    oow: number;
    endorsements: string;
  };
}

interface CrewFilters {
  pools: string[];
  manningAgents: string[];
  shipTypes: string[];
  nationalities: string[];
  timeInCompany: string[];
  timeInRank: string[];
  timeInTankers: string[];
  travelStatus: string[];
  higherCert: string[];
  performance: string[];
  availabilityDate: Date | null;
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

// Deployed crew assignment from vessel_planning - used for global conflict detection
interface DeployedCrewAssignment {
  crewMemberId: string | null;
  relieverCrewId: string | null;
  vesselId: string;
  signOnDate: string | null;
  reliefDue: string | null;
  relieverSignOnDate: string | null;
  contractPeriodMonths: number | null; // Used to calculate reliever's end date
}

interface Assignment {
  id?: string; // Unique identifier for each assignment
  vessel: string;
  vesselId?: string;
  vesselName?: string;
  rank: string;
  rankId?: string;
  crewId: string;
  crewName: string;
  joiningDate: string;
  contractPeriod: number;
}

// Crew Filter Dialog Component
function CrewFilterDialog({
  open,
  onOpenChange,
  rank,
  filters,
  onFiltersChange,
  availableOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rank: string;
  filters: CrewFilters;
  onFiltersChange: (filters: CrewFilters) => void;
  availableOptions: {
    pools: string[];
    manningAgents: string[];
    shipTypes: string[];
    nationalities: string[];
    timeInCompanyOptions: string[];
    timeInRankOptions: string[];
    timeInTankersOptions: string[];
    travelStatuses: string[];
    higherCerts: string[];
    performances: string[];
  };
}) {
  const [localFilters, setLocalFilters] = useState<CrewFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters, open]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const emptyFilters: CrewFilters = {
      pools: [],
      manningAgents: [],
      shipTypes: [],
      nationalities: [],
      timeInCompany: [],
      timeInRank: [],
      timeInTankers: [],
      travelStatus: [],
      higherCert: [],
      performance: [],
      availabilityDate: null,
    };
    setLocalFilters(emptyFilters);
  };

  type ArrayFilterKeys = Exclude<keyof CrewFilters, 'availabilityDate'>;
  
  const toggleFilter = (category: ArrayFilterKeys, value: string) => {
    setLocalFilters(prev => {
      const current = prev[category];
      const updated = current.includes(value)
        ? current.filter((v: string) => v !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const FilterSection = ({ title, options, category }: { title: string; options: string[]; category: ArrayFilterKeys }) => {
    const selectedCount = localFilters[category].length;
    const hasSelection = selectedCount > 0;
    const displayValue = selectedCount === 1 
      ? localFilters[category][0] 
      : selectedCount > 1 
        ? "Multiple Selection" 
        : title;
    
    return (
    <div className="mb-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-between relative",
              hasSelection ? "text-foreground pt-5 h-auto min-h-9" : "text-gray-500"
            )}
            data-testid={`filter-${category}`}
          >
            {hasSelection && (
              <span className="absolute top-1 left-3 text-[10px] text-muted-foreground">
                {title}
              </span>
            )}
            <span className={cn("truncate", hasSelection && "text-sm")}>{displayValue}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2" align="start">
          <div className="max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-2">No options available</div>
            ) : (
              options.map((option) => (
                <div
                  key={option}
                  className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <Checkbox
                    checked={localFilters[category].includes(option)}
                    onCheckedChange={() => toggleFilter(category, option)}
                    data-testid={`checkbox-filter-${category}-${option}`}
                  />
                  <label
                    className="text-sm cursor-pointer flex-1"
                    onClick={() => toggleFilter(category, option)}
                  >
                    {option}
                  </label>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filter {rank}</DialogTitle>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          <FilterSection title="Pool" options={availableOptions.pools} category="pools" />
          <FilterSection title="Manning Agent" options={availableOptions.manningAgents} category="manningAgents" />
          <FilterSection title="Ship Type" options={availableOptions.shipTypes} category="shipTypes" />
          <FilterSection title="Nationality" options={availableOptions.nationalities} category="nationalities" />
          <FilterSection title="Time in Company" options={availableOptions.timeInCompanyOptions} category="timeInCompany" />
          <FilterSection title="Time in Rank" options={availableOptions.timeInRankOptions} category="timeInRank" />
          <FilterSection title="Time in Tankers" options={availableOptions.timeInTankersOptions} category="timeInTankers" />
          {/* Temporarily hidden filters
          <FilterSection title="Travel Status" options={availableOptions.travelStatuses} category="travelStatus" />
          <FilterSection title="Higher Cert." options={availableOptions.higherCerts} category="higherCert" />
          <FilterSection title="Performance" options={availableOptions.performances} category="performance" />
          */}
          
          <div className="mb-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-between",
                    localFilters.availabilityDate ? "text-black dark:text-white" : "text-gray-500"
                  )}
                  data-testid="filter-availabilityDate"
                >
                  <span>
                    {localFilters.availabilityDate 
                      ? `Available by: ${format(localFilters.availabilityDate, 'dd-MMM-yyyy')}`
                      : "Availability Date"
                    }
                  </span>
                  <CalendarIcon className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-2 border-b">
                  <p className="text-sm text-gray-500">Show crew available on or before this date</p>
                </div>
                <Calendar
                  mode="single"
                  selected={localFilters.availabilityDate || undefined}
                  onSelect={(date) => setLocalFilters(prev => ({ ...prev, availabilityDate: date || null }))}
                  initialFocus
                />
                {localFilters.availabilityDate && (
                  <div className="p-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-red-500 hover:text-red-600"
                      onClick={() => setLocalFilters(prev => ({ ...prev, availabilityDate: null }))}
                    >
                      Clear Date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            data-testid="button-reset-filters"
          >
            Reset
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-filters"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-apply-filters"
            >
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to check if two date ranges overlap
function dateRangesOverlap(
  start1: Date, end1: Date | null,
  start2: Date, end2: Date | null
): boolean {
  // If either end date is null, treat as far future (ongoing assignment)
  const effectiveEnd1 = end1 || new Date('2100-12-31');
  const effectiveEnd2 = end2 || new Date('2100-12-31');
  
  // Ranges overlap if one starts before the other ends and vice versa
  return start1 <= effectiveEnd2 && start2 <= effectiveEnd1;
}

// Crew Column Component - displays available crew for a specific rank
function CrewColumn({ 
  rank, 
  onCrewSelect, 
  assignments,
  currentlyDeployedCrewIds,
  allDeployedAssignments,
  planDateRange,
  selectedVessels
}: { 
  rank: string; 
  onCrewSelect: (crew: { id: string; name: string; rank: string }) => void;
  assignments: Assignment[];
  currentlyDeployedCrewIds: Set<string>;
  allDeployedAssignments: DeployedCrewAssignment[];
  planDateRange: { start: Date; end: Date };
  selectedVessels: string[];
}) {
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState<CrewFilters>({
    pools: [],
    manningAgents: [],
    shipTypes: [],
    nationalities: [],
    timeInCompany: [],
    timeInRank: [],
    timeInTankers: [],
    travelStatus: [],
    higherCert: [],
    performance: [],
    availabilityDate: null,
  });

  // Get vessel lookup for translating vessel IDs to names
  const { getVesselName } = useVesselLookup();

  const { data: crewMembers = [], isLoading } = useQuery<CrewMember[]>({
    queryKey: [`/api/crew-members/by-rank/${rank}`],
  });

  // Fetch Manning Agents from Master 021
  const { data: manningAgentsData } = useQuery<any[]>({
    queryKey: ['/api/masters/021/data'],
  });

  // Fetch Crew Pools from Master 022
  const { data: crewPoolsData } = useQuery<any[]>({
    queryKey: ['/api/masters/022/data'],
  });

  // Extract unique values for filter options
  const availableOptions = useMemo(() => {
    // Use Crew Pools from Master 022 instead of extracting from crew data
    const pools = (crewPoolsData || [])
      .filter((pool: any) => pool.name && !pool.isDeleted)
      .map((pool: any) => pool.name)
      .sort() as string[];
    
    // Use Manning Agents from Master 021 instead of extracting from crew data
    const manningAgents = (manningAgentsData || [])
      .filter((agent: any) => agent.name && !agent.isDeleted)
      .map((agent: any) => agent.country ? `${agent.name} (${agent.country})` : agent.name)
      .sort() as string[];
    
    const shipTypes = Array.from(new Set(crewMembers.map(c => c.shipType).filter(Boolean))).sort() as string[];
    const nationalities = Array.from(new Set(crewMembers.map(c => c.nationality).filter(Boolean))).sort() as string[];
    const travelStatuses = Array.from(new Set(crewMembers.map(c => c.travelStatus).filter(Boolean))).sort() as string[];
    const higherCerts = Array.from(new Set(crewMembers.map(c => c.higherCert).filter(Boolean))).sort() as string[];
    const performances = Array.from(new Set(crewMembers.map(c => c.performance).filter(Boolean))).sort() as string[];
    
    // Create time range options
    const timeInCompanyOptions = ['0-1 years', '1-3 years', '3-5 years', '5-10 years', '10+ years'];
    const timeInRankOptions = ['0-1 years', '1-3 years', '3-5 years', '5+ years'];
    const timeInTankersOptions = ['0-1 years', '1-3 years', '3-5 years', '5+ years'];
    
    return {
      pools,
      manningAgents,
      shipTypes,
      nationalities,
      timeInCompanyOptions,
      timeInRankOptions,
      timeInTankersOptions,
      travelStatuses,
      higherCerts,
      performances,
    };
  }, [crewMembers, manningAgentsData, crewPoolsData]);

  // Apply filters to crew members
  const filteredCrewMembers = useMemo(() => {
    return crewMembers.filter(crew => {
      // Pool filter - check both pool and crewPool fields for compatibility
      if (filters.pools.length > 0 && !filters.pools.includes(crew.crewPool || crew.pool || '')) return false;
      
      // Manning agent filter - compare agent names (filter options are "Name (Country)" format)
      if (filters.manningAgents.length > 0) {
        const crewAgent = crew.manningAgent || '';
        // Check if any selected filter matches the crew's manning agent
        // Filter format is "Name (Country)", crew data might just be the name
        const matches = filters.manningAgents.some(filterAgent => {
          // Extract just the name from "Name (Country)" format if present
          const agentName = filterAgent.replace(/\s*\([^)]*\)$/, '');
          return crewAgent === filterAgent || crewAgent === agentName;
        });
        if (!matches) return false;
      }
      
      // Ship type filter
      if (filters.shipTypes.length > 0 && !filters.shipTypes.includes(crew.shipType || '')) return false;
      
      // Nationality filter
      if (filters.nationalities.length > 0 && !filters.nationalities.includes(crew.nationality || '')) return false;
      
      // Travel status filter
      if (filters.travelStatus.length > 0 && !filters.travelStatus.includes(crew.travelStatus || '')) return false;
      
      // Higher cert filter
      if (filters.higherCert.length > 0 && !filters.higherCert.includes(crew.higherCert || '')) return false;
      
      // Performance filter
      if (filters.performance.length > 0 && !filters.performance.includes(crew.performance || '')) return false;
      
      // Time in company filter
      if (filters.timeInCompany.length > 0) {
        const timeInCompany = crew.experience.company;
        const matchesRange = filters.timeInCompany.some(range => {
          if (range === '0-1 years') return timeInCompany >= 0 && timeInCompany <= 1;
          if (range === '1-3 years') return timeInCompany > 1 && timeInCompany <= 3;
          if (range === '3-5 years') return timeInCompany > 3 && timeInCompany <= 5;
          if (range === '5-10 years') return timeInCompany > 5 && timeInCompany <= 10;
          if (range === '10+ years') return timeInCompany > 10;
          return false;
        });
        if (!matchesRange) return false;
      }
      
      // Time in rank filter
      if (filters.timeInRank.length > 0) {
        const timeInRank = crew.experience.rank;
        const matchesRange = filters.timeInRank.some(range => {
          if (range === '0-1 years') return timeInRank >= 0 && timeInRank <= 1;
          if (range === '1-3 years') return timeInRank > 1 && timeInRank <= 3;
          if (range === '3-5 years') return timeInRank > 3 && timeInRank <= 5;
          if (range === '5+ years') return timeInRank > 5;
          return false;
        });
        if (!matchesRange) return false;
      }
      
      // Time in tankers filter
      if (filters.timeInTankers.length > 0) {
        const timeInTankers = crew.experience.tankers;
        const matchesRange = filters.timeInTankers.some(range => {
          if (range === '0-1 years') return timeInTankers >= 0 && timeInTankers <= 1;
          if (range === '1-3 years') return timeInTankers > 1 && timeInTankers <= 3;
          if (range === '3-5 years') return timeInTankers > 3 && timeInTankers <= 5;
          if (range === '5+ years') return timeInTankers > 5;
          return false;
        });
        if (!matchesRange) return false;
      }
      
      // Availability date filter - show crew available on or before selected date
      if (filters.availabilityDate) {
        // If crew has no nextAvailability date set, they are considered available immediately
        if (!crew.nextAvailability) {
          // Crew with no availability date set is treated as available now
          return true;
        }
        
        try {
          const crewAvailabilityDate = new Date(crew.nextAvailability);
          const filterDate = filters.availabilityDate;
          
          // Only include crew whose availability date is on or before the filter date
          if (crewAvailabilityDate > filterDate) {
            return false;
          }
        } catch {
          // If date parsing fails, include the crew member
        }
      }
      
      return true;
    });
  }, [crewMembers, filters]);

  // Get count of vessels crew is assigned to
  const getCrewAssignmentCount = (crewId: string) => {
    const vesselCount = new Set(
      assignments
        .filter(a => a.crewId === crewId)
        .map(a => a.vessel)
    ).size;
    return vesselCount;
  };
  
  // Get color based on deployment status and assignment count
  // Priority: Red (deployed on overlapping period) > Brown (2+ vessels) > Blue (1 vessel) > Default
  const getCrewNameColor = (crewId: string) => {
    // First priority: Check if crew has an overlapping deployment on ANY vessel
    // This checks all vessels, not just the selected ones for planning
    const hasOverlappingDeployment = allDeployedAssignments.some(assignment => {
      // Check if this crew member is the primary crew or reliever
      const isThisCrew = assignment.crewMemberId === crewId || assignment.relieverCrewId === crewId;
      if (!isThisCrew) return false;
      
      // Skip assignments on the currently selected vessels (we're replacing them)
      if (selectedVessels.includes(assignment.vesselId)) return false;
      
      // Determine the assignment date range for this crew member
      let assignmentStart: Date | null = null;
      let assignmentEnd: Date | null = null;
      
      if (assignment.crewMemberId === crewId) {
        // Primary crew - uses signOnDate and reliefDue
        assignmentStart = assignment.signOnDate ? new Date(assignment.signOnDate) : null;
        assignmentEnd = assignment.reliefDue ? new Date(assignment.reliefDue) : null;
      } else if (assignment.relieverCrewId === crewId) {
        // Reliever - uses relieverSignOnDate and calculates end date from contractPeriodMonths
        assignmentStart = assignment.relieverSignOnDate ? new Date(assignment.relieverSignOnDate) : null;
        // Calculate reliever end date using contractPeriodMonths (defaulting to 6 months only if not available)
        if (assignmentStart) {
          const contractMonths = assignment.contractPeriodMonths || 6; // Use actual contract period or 6-month default
          assignmentEnd = new Date(assignmentStart);
          assignmentEnd.setMonth(assignmentEnd.getMonth() + contractMonths);
        }
      }
      
      // If we don't have a start date, we can't determine overlap - be conservative and show as available
      if (!assignmentStart) return false;
      
      // Check if this assignment overlaps with the plan date range
      return dateRangesOverlap(planDateRange.start, planDateRange.end, assignmentStart, assignmentEnd);
    });
    
    if (hasOverlappingDeployment) {
      return 'text-red-600'; // Red for crew with overlapping deployment on another vessel
    }
    
    // Second priority: Check if crew is deployed on the currently selected vessels
    if (currentlyDeployedCrewIds.has(crewId)) {
      return 'text-red-600'; // Red for currently deployed crew on selected vessels
    }
    
    // Third priority: Check draft assignments
    const count = getCrewAssignmentCount(crewId);
    if (count >= 2) return 'text-[#814C02]'; // Brown for 2+ vessels in draft
    if (count === 1) return 'text-blue-600'; // Blue for 1 vessel in draft
    
    return ''; // Default color for no assignments
  };

  // Get vessel name(s) for crew that are red (deployed) or blue (already planned)
  // Returns the vessel names to display in tooltip on hover
  const getCrewVesselInfo = (crewId: string): string | null => {
    const vesselNames: string[] = [];

    // Check for overlapping deployments on other vessels (red color reason)
    allDeployedAssignments.forEach(assignment => {
      const isThisCrew = assignment.crewMemberId === crewId || assignment.relieverCrewId === crewId;
      if (!isThisCrew) return;
      
      // Skip assignments on currently selected vessels
      if (selectedVessels.includes(assignment.vesselId)) return;
      
      // Check date overlap
      let assignmentStart: Date | null = null;
      let assignmentEnd: Date | null = null;
      
      if (assignment.crewMemberId === crewId) {
        assignmentStart = assignment.signOnDate ? new Date(assignment.signOnDate) : null;
        assignmentEnd = assignment.reliefDue ? new Date(assignment.reliefDue) : null;
      } else if (assignment.relieverCrewId === crewId) {
        assignmentStart = assignment.relieverSignOnDate ? new Date(assignment.relieverSignOnDate) : null;
        if (assignmentStart) {
          const contractMonths = assignment.contractPeriodMonths || 6;
          assignmentEnd = new Date(assignmentStart);
          assignmentEnd.setMonth(assignmentEnd.getMonth() + contractMonths);
        }
      }
      
      if (!assignmentStart) return;
      
      if (dateRangesOverlap(planDateRange.start, planDateRange.end, assignmentStart, assignmentEnd)) {
        const vesselName = getVesselName(assignment.vesselId);
        if (vesselName && !vesselNames.includes(vesselName)) {
          vesselNames.push(vesselName);
        }
      }
    });

    // If we found overlapping deployments, return those vessels (red - currently deployed)
    if (vesselNames.length > 0) {
      return vesselNames.join(', ');
    }

    // Check draft assignments (blue color reason)
    const draftVessels = new Set(
      assignments
        .filter(a => a.crewId === crewId)
        .map(a => a.vessel)
    );
    
    if (draftVessels.size > 0) {
      return Array.from(draftVessels).join(', ');
    }

    return null;
  };
  
  // Check if any filters are active
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'availabilityDate') {
      return value !== null;
    }
    return Array.isArray(value) && value.length > 0;
  });

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
    <>
      <div className="w-64 flex-shrink-0">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-t font-semibold flex items-center gap-2">
          <Checkbox data-testid={`checkbox-select-all-${rank}`} />
          <span className="flex-1">{rank}</span>
          <button
            onClick={() => setFilterDialogOpen(true)}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${hasActiveFilters ? 'text-blue-600' : 'text-gray-600'}`}
            data-testid={`button-filter-${rank}`}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>
        <div className="border-t">
          {filteredCrewMembers.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {hasActiveFilters ? 'No crew match the filters' : 'No crew available'}
            </div>
          ) : (
            filteredCrewMembers.map((crew) => (
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
                  {(() => {
                    const nameColor = getCrewNameColor(crew.id);
                    const vesselInfo = getCrewVesselInfo(crew.id);
                    // Show tooltip for red (deployed), blue (1 vessel planned), and brown (2+ vessels planned)
                    const hasColoredStatus = nameColor === 'text-red-600' || nameColor === 'text-blue-600' || nameColor === 'text-[#814C02]';
                    const showVesselTooltip = vesselInfo && hasColoredStatus;
                    
                    if (showVesselTooltip) {
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`font-medium text-sm cursor-help ${nameColor}`}>
                                {crew.name}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <div className="text-xs">
                                <span className="font-medium">Vessel: </span>{vesselInfo}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    }
                    
                    return (
                      <div className={`font-medium text-sm ${nameColor}`}>
                        {crew.name}
                      </div>
                    );
                  })()}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xs text-gray-500 mt-1 cursor-help">
                          {crew.experience.company} / {crew.experience.rank} / {crew.experience.tankers} / {crew.experience.oow} / {crew.experience.endorsements}{crew.nextAvailability ? ` / ${formatAvailabilityDate(crew.nextAvailability)}` : ' / —'}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="text-xs space-y-1">
                          <div><span className="font-medium">Company (Yrs):</span> {crew.experience.company}</div>
                          <div><span className="font-medium">Rank (Yrs):</span> {crew.experience.rank}</div>
                          <div><span className="font-medium">Tankers (Yrs):</span> {crew.experience.tankers}</div>
                          <div><span className="font-medium">OOW (Yrs):</span> {crew.experience.oow}</div>
                          <div><span className="font-medium">Endorsements:</span> {crew.experience.endorsements || '—'}</div>
                          <div><span className="font-medium">Next Availability:</span> {crew.nextAvailability ? formatAvailabilityDate(crew.nextAvailability) : '—'}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      <CrewFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        rank={rank}
        filters={filters}
        onFiltersChange={setFilters}
        availableOptions={availableOptions}
      />
    </>
  );
}

// Date Period Dialog - for selecting joining date and contract period
function DatePeriodDialog({
  open,
  onOpenChange,
  onApply,
  onUnassign,
  crewName,
  crewId,
  vesselName,
  rank,
  assignments = [],
  initialValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (joiningDate: Date, contractPeriod: number) => void;
  onUnassign: () => void;
  crewName: string;
  crewId: string;
  vesselName: string;
  rank: string;
  assignments?: Assignment[];
  initialValues?: { joiningDate: string; contractPeriod: number };
}) {
  const [joiningDate, setJoiningDate] = useState<Date>();
  const [contractPeriod, setContractPeriod] = useState<string>('');
  const [unassignChecked, setUnassignChecked] = useState(false);

  // Check if crew is already assigned to this vessel and rank
  const isAlreadyAssigned = useMemo(() => {
    return assignments.some(a => 
      a.crewId === crewId && 
      a.vessel === vesselName && 
      a.rank === rank
    );
  }, [assignments, crewId, vesselName, rank]);

  // Pre-populate form when editing (initialValues provided)
  useEffect(() => {
    if (open && initialValues) {
      setJoiningDate(new Date(initialValues.joiningDate));
      setContractPeriod(initialValues.contractPeriod.toString());
    } else if (!open) {
      // Reset form when dialog closes
      setJoiningDate(undefined);
      setContractPeriod('');
      setUnassignChecked(false);
    }
  }, [open, initialValues]);

  const handleApply = () => {
    // Priority: If unassign is checked, unassign regardless of other fields
    if (unassignChecked) {
      onUnassign();
      onOpenChange(false);
      // Reset
      setJoiningDate(undefined);
      setContractPeriod('');
      setUnassignChecked(false);
      return;
    }

    // Otherwise, validate and create assignment
    if (!joiningDate || !contractPeriod) {
      return;
    }
    onApply(joiningDate, parseInt(contractPeriod));
    onOpenChange(false);
    // Reset
    setJoiningDate(undefined);
    setContractPeriod('');
    setUnassignChecked(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset
    setJoiningDate(undefined);
    setContractPeriod('');
    setUnassignChecked(false);
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <SelectItem key={month} value={String(month)}>
                    {month} {month === 1 ? 'Month' : 'Months'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unassign Checkbox */}
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="unassign-checkbox"
              checked={unassignChecked}
              onCheckedChange={(checked) => setUnassignChecked(checked as boolean)}
              disabled={!isAlreadyAssigned}
              data-testid="checkbox-unassign"
            />
            <label
              htmlFor="unassign-checkbox"
              className={cn(
                "text-sm font-medium cursor-pointer",
                isAlreadyAssigned ? "text-red-600" : "text-gray-400"
              )}
            >
              Unassign from vessel
            </label>
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
            disabled={!unassignChecked && (!joiningDate || !contractPeriod)}
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
  queryRanks,
  displayRanks,
  selectedVessel,
  onVesselSelect,
  onAssignmentClick,
  dateRange,
  assignments = []
}: { 
  vessels: string[]; 
  queryRanks: string[];
  displayRanks: string[];
  selectedVessel: string;
  onVesselSelect: (vessel: string) => void;
  onAssignmentClick?: (assignment: Assignment) => void;
  dateRange: { start: Date; end: Date };
  assignments?: Assignment[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Use vessel lookup hook for translating vessel names to IDs
  const { getVesselIds } = useVesselLookup();
  
  // Use custom date range from props
  const today = useMemo(() => new Date(), []);
  const startDate = dateRange.start;
  const endDate = dateRange.end;
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
  // Build query params for fetching existing crew - translate vessel names to IDs
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.append('filterType', 'vessel');
    const vesselIds = getVesselIds(vessels);
    vesselIds.forEach(id => params.append('vessels', id));
    queryRanks.forEach(r => params.append('rank', r));
    return params;
  }, [vessels, queryRanks, getVesselIds]);
  
  // Fetch existing crew for selected vessels and ALL ranks (including base ranks)
  const { data: existingCrew = [] } = useQuery<ExistingCrew[]>({
    queryKey: ['/api/rotation/due-crew', queryParams.toString()],
    queryFn: () => fetch(`/api/rotation/due-crew?${queryParams.toString()}`).then(res => res.json()),
    enabled: vessels.length > 0 && queryRanks.length > 0,
  });
  
  // Build rank mapping: map base ranks to their variants for crew assignment
  const rankMapping = useMemo(() => {
    const mapping = new Map<string, string[]>();
    
    displayRanks.forEach(rank => {
      if (rank.includes('_')) {
        // This is a variant, extract base rank
        const baseRank = rank.substring(0, rank.lastIndexOf('_'));
        if (!mapping.has(baseRank)) {
          mapping.set(baseRank, []);
        }
        mapping.get(baseRank)!.push(rank);
      }
    });
    
    return mapping;
  }, [displayRanks]);
  
  // Group data by vessel and display rank (with smart mapping from base ranks to variants)
  const groupedData = useMemo(() => {
    const groups: { [key: string]: { [key: string]: { existing: ExistingCrew[], assignments: Assignment[] } } } = {};
    
    vessels.forEach(vessel => {
      groups[vessel] = {};
      displayRanks.forEach(rank => {
        groups[vessel][rank] = {
          existing: [],
          assignments: assignments.filter(a => a.vessel === vessel && a.rank === rank),
        };
      });
    });
    
    // Distribute existing crew to appropriate display ranks
    existingCrew.forEach(crew => {
      const vessel = crew.vessel;
      const crewRank = crew.rank;
      
      // Check if this rank is in displayRanks
      if (displayRanks.includes(crewRank)) {
        // Direct match - add to this rank
        if (groups[vessel]?.[crewRank]) {
          groups[vessel][crewRank].existing.push(crew);
        }
      } else if (rankMapping.has(crewRank)) {
        // This is a base rank that has variants - distribute to first variant
        const variants = rankMapping.get(crewRank)!;
        if (variants.length > 0 && groups[vessel]?.[variants[0]]) {
          groups[vessel][variants[0]].existing.push(crew);
        }
      }
    });
    
    return groups;
  }, [vessels, displayRanks, existingCrew, assignments, rankMapping]);
  
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
    
    // Safety check: ensure vessels and displayRanks are defined arrays
    if (!Array.isArray(vessels) || !Array.isArray(displayRanks)) return;
    
    const width = canvasSize.width;
    const height = canvasSize.height;
    const vesselHeaderHeight = 48;
    const monthHeaderHeight = 32;
    const rowHeight = 40;
    const rankColumnWidth = 100; // Fixed width for rank column
    const timelineStartX = rankColumnWidth; // Timeline starts after rank column
    const timelineWidth = width - rankColumnWidth;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    let yOffset = 0;
    
    // Draw each vessel section
    vessels.forEach((vessel, vesselIdx) => {
      // Draw vessel header (full width)
      ctx.fillStyle = '#52baf3';
      ctx.fillRect(0, yOffset, width, vesselHeaderHeight);
      
      // Draw radio button (left side)
      ctx.beginPath();
      ctx.arc(20, yOffset + 24, 8, 0, 2 * Math.PI);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw vessel name (with adequate spacing after radio button)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(vessel, 50, yOffset + 30);
      
      if (selectedVessel === vessel) {
        ctx.beginPath();
        ctx.arc(20, yOffset + 24, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
      
      yOffset += vesselHeaderHeight;
      
      // Draw header row (rank column + month headers)
      // Rank column header
      ctx.fillStyle = '#52baf3';
      ctx.fillRect(0, yOffset, rankColumnWidth, monthHeaderHeight);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Rank', rankColumnWidth / 2, yOffset + 20);
      
      // Month headers (in timeline area)
      ctx.fillStyle = '#52baf3';
      ctx.fillRect(timelineStartX, yOffset, timelineWidth, monthHeaderHeight);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      
      months.forEach((month) => {
        // Calculate X position based on actual day offset from startDate
        const monthStart = month.date > startDate ? month.date : startDate;
        const monthEnd = endOfMonth(month.date) < endDate ? endOfMonth(month.date) : endDate;
        
        // Skip months completely outside the visible range
        if (monthEnd < startDate || monthStart > endDate) return;
        
        const monthStartX = timelineStartX + ((differenceInDays(monthStart, startDate) / totalDays) * timelineWidth);
        const monthEndX = timelineStartX + ((differenceInDays(monthEnd, startDate) / totalDays) * timelineWidth);
        const x = (monthStartX + monthEndX) / 2; // Center of month within visible range
        
        if (x >= timelineStartX && x <= width) {
          ctx.fillText(month.label, x, yOffset + 20);
        }
      });
      
      yOffset += monthHeaderHeight;
      
      // Draw rank rows
      displayRanks.forEach((rank, rankIdx) => {
        const rowData = groupedData[vessel]?.[rank];
        if (!rowData) return;
        
        const y = yOffset;
        
        // Draw row background (full width)
        ctx.fillStyle = rankIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
        ctx.fillRect(0, y, width, rowHeight);
        
        // Draw rank column background with border
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, y, rankColumnWidth, rowHeight);
        
        // Draw rank label (centered in rank column)
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(rank, rankColumnWidth / 2, y + 25);
        
        // Draw vertical separator line between rank and timeline
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rankColumnWidth - 0.5, y);
        ctx.lineTo(rankColumnWidth - 0.5, y + rowHeight);
        ctx.stroke();
        
        // Draw existing crew bars (top half) - in timeline area only
        const topBarY = y + 5;
        const topBarHeight = 15;
        
        rowData.existing.forEach(crew => {
          const contractStart = new Date(crew.contractStartDate);
          const contractEnd = new Date(crew.contractEndDate);
          const rangeEnd = new Date(crew.rangeEndDate);
          
          const greenStart = Math.max(timelineStartX, timelineStartX + ((differenceInDays(contractStart, startDate) / totalDays) * timelineWidth));
          const greenEnd = Math.max(timelineStartX, timelineStartX + ((differenceInDays(contractEnd, startDate) / totalDays) * timelineWidth));
          const yellowEnd = Math.max(timelineStartX, timelineStartX + ((differenceInDays(rangeEnd, startDate) / totalDays) * timelineWidth));
          
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
            const todayX = timelineStartX + ((differenceInDays(today, startDate) / totalDays) * timelineWidth);
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
        
        // Draw new assignment bars (bottom half) - in timeline area only
        const bottomBarY = y + 20;
        const bottomBarHeight = 15;
        
        rowData.assignments.forEach(assignment => {
          const joiningDate = new Date(assignment.joiningDate);
          const contractEndDate = addMonths(joiningDate, assignment.contractPeriod);
          
          const blueStart = Math.max(timelineStartX, timelineStartX + ((differenceInDays(joiningDate, startDate) / totalDays) * timelineWidth));
          const blueEnd = Math.max(timelineStartX, timelineStartX + ((differenceInDays(contractEndDate, startDate) / totalDays) * timelineWidth));
          
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
    
    // Draw "today" vertical line (only in timeline area)
    const todayX = timelineStartX + ((differenceInDays(today, startDate) / totalDays) * timelineWidth);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, 0);
    ctx.lineTo(todayX, yOffset);
    ctx.stroke();
    
  }, [vessels, displayRanks, groupedData, selectedVessel, months, today, startDate, endDate, totalDays, canvasSize]);
  
  // Handle canvas click for vessel selection and assignment editing
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const vesselHeaderHeight = 48;
    const monthHeaderHeight = 32;
    const rowHeight = 40;
    const rankColumnWidth = 100;
    const timelineStartX = rankColumnWidth;
    const timelineWidth = canvasSize.width - rankColumnWidth;
    
    let yOffset = 0;
    
    // Check each vessel section
    for (const vessel of vessels) {
      const headerStart = yOffset;
      const headerEnd = yOffset + vesselHeaderHeight;
      
      // Check if clicked on vessel header
      if (y >= headerStart && y < headerEnd) {
        onVesselSelect(vessel);
        return;
      }
      
      yOffset += vesselHeaderHeight + monthHeaderHeight;
      
      // Check if clicked on an assignment bar in any rank row
      for (let rankIdx = 0; rankIdx < displayRanks.length; rankIdx++) {
        const rank = displayRanks[rankIdx];
        const rowY = yOffset + (rankIdx * rowHeight);
        const bottomBarY = rowY + 20;
        const bottomBarHeight = 15;
        
        // Check if click is within the assignment bar Y range
        if (y >= bottomBarY && y <= bottomBarY + bottomBarHeight && x >= timelineStartX) {
          // Find assignments for this vessel/rank
          const rowData = groupedData[vessel]?.[rank];
          if (rowData?.assignments) {
            // Check each assignment to see if click is within its X range
            for (const assignment of rowData.assignments) {
              const joiningDate = new Date(assignment.joiningDate);
              const contractEndDate = addMonths(joiningDate, assignment.contractPeriod);
              
              const blueStart = Math.max(timelineStartX, timelineStartX + ((differenceInDays(joiningDate, startDate) / totalDays) * timelineWidth));
              const blueEnd = Math.max(timelineStartX, timelineStartX + ((differenceInDays(contractEndDate, startDate) / totalDays) * timelineWidth));
              
              if (x >= blueStart && x <= blueEnd) {
                // Clicked on this assignment bar
                if (onAssignmentClick) {
                  onAssignmentClick(assignment);
                }
                return;
              }
            }
          }
        }
      }
      
      yOffset += displayRanks.length * rowHeight;
    }
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

export function NewPlanDialog({ open, onOpenChange, editPlan }: NewPlanDialogProps) {
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]); // Base ranks selected in dropdown
  const [selectedRoleVariantsState, setSelectedRoleVariantsState] = useState<string[]>([]); // Specific role variants selected
  const [hasManualVariants, setHasManualVariants] = useState(false); // Track if user manually modified variants
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<{ id: string; name: string; rank: string } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const prevSelectedVesselsRef = useRef<string[]>([]);
  const isInitialLoadRef = useRef(false);
  
  // Track saved plan ID for new plans - allows subsequent saves to use PATCH instead of POST
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  
  // Reset savedPlanId when dialog closes to prevent stale state
  useEffect(() => {
    if (!open) {
      setSavedPlanId(null);
    }
  }, [open]);
  
  // Date range state - default is Today - 2 months to Today + 5 months
  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: addMonths(today, -2),
    end: addMonths(today, 5)
  });
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  
  const { toast } = useToast();
  
  // Vessel lookup hook for name↔ID translation
  const { getVesselIds } = useVesselLookup();

  // Fetch vessels from master data
  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<any[]>({
    queryKey: ['/api/masters/014/data'],
  });

  // Fetch company ranks
  const { data: companyRanks = [], isLoading: ranksLoading } = useQuery<any[]>({
    queryKey: ['/api/company-ranks'],
  });

  // Get deduplicated base ranks for dropdown display
  const baseRanks = useMemo(() => {
    const uniqueRanks = new Map<string, any>();
    companyRanks.forEach((rank: any) => {
      if (!uniqueRanks.has(rank.rank)) {
        uniqueRanks.set(rank.rank, rank);
      }
    });
    return Array.from(uniqueRanks.values());
  }, [companyRanks]);

  // Get all role variants for selected base ranks
  const autoSelectedRoleVariants = useMemo(() => {
    const variants: string[] = [];
    const selectedBaseRanks = new Set(selectedRanks);
    
    // First pass: check if any selected rank has role variants
    const ranksWithVariants = new Set<string>();
    companyRanks.forEach((rank: any) => {
      if (selectedBaseRanks.has(rank.rank) && rank.role && rank.role !== rank.rank) {
        ranksWithVariants.add(rank.rank);
      }
    });
    
    // Second pass: add role variants or base rank (only if no variants exist)
    companyRanks.forEach((rank: any) => {
      if (selectedBaseRanks.has(rank.rank)) {
        if (rank.role && rank.role !== rank.rank) {
          // This is a role variant - add it
          variants.push(rank.role);
        } else if (!ranksWithVariants.has(rank.rank)) {
          // This is a base rank with no variants - add the base rank
          variants.push(rank.rank);
        }
        // Skip base ranks that have variants
      }
    });
    
    return variants;
  }, [companyRanks, selectedRanks]);

  // Use manually managed state if user has modified it, otherwise use auto-computed variants
  const selectedRoleVariants = hasManualVariants 
    ? selectedRoleVariantsState 
    : autoSelectedRoleVariants;

  // Filter out base ranks when their role variants exist (for timeline display only)
  const timelineRoleVariants = useMemo(() => {
    // Find base ranks that have role variants
    const baseRanksWithVariants = new Set<string>();
    
    selectedRoleVariants.forEach(roleVariant => {
      // Check if this is a role variant (has underscore suffix like "3rd Officer_1")
      if (roleVariant.includes('_')) {
        const baseRank = roleVariant.substring(0, roleVariant.lastIndexOf('_'));
        baseRanksWithVariants.add(baseRank);
      }
    });
    
    // Filter out base ranks that have variants
    return selectedRoleVariants.filter(roleVariant => {
      // Keep role variants (with underscore)
      if (roleVariant.includes('_')) return true;
      // Keep base ranks only if they don't have variants
      return !baseRanksWithVariants.has(roleVariant);
    });
  }, [selectedRoleVariants]);

  // Sync selectedRoleVariantsState with autoSelectedRoleVariants when base ranks change (unless manually modified)
  useEffect(() => {
    if (!isInitialLoadRef.current && !hasManualVariants) {
      setSelectedRoleVariantsState(autoSelectedRoleVariants);
    }
  }, [autoSelectedRoleVariants, hasManualVariants]);

  // Fetch existing crew data to identify currently deployed crew
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.append('filterType', 'vessel');
    // Translate vessel names to IDs for API call
    const vesselIds = getVesselIds(selectedVessels);
    vesselIds.forEach(id => params.append('vessels', id));
    selectedRoleVariants.forEach(r => params.append('rank', r));
    return params;
  }, [selectedVessels, selectedRoleVariants, getVesselIds]);

  const { data: existingCrew = [] } = useQuery<ExistingCrew[]>({
    queryKey: ['/api/rotation/due-crew', queryParams.toString()],
    queryFn: () => fetch(`/api/rotation/due-crew?${queryParams.toString()}`).then(res => res.json()),
    enabled: selectedVessels.length > 0 && selectedRanks.length > 0,
  });

  // Fetch ALL vessel planning data to check for global assignment conflicts
  // This checks crew assignments across ALL vessels, not just selected ones
  const { data: allVesselPlanning = [] } = useQuery<DeployedCrewAssignment[]>({
    queryKey: ['/api/vessel-planning'],
  });

  // Create Set of currently deployed crew IDs for O(1) lookup
  const currentlyDeployedCrewIds = useMemo(() => {
    return new Set(existingCrew.map(crew => crew.id));
  }, [existingCrew]);

  // Get vessel IDs for the selected vessels (for conflict detection)
  const selectedVesselIds = useMemo(() => {
    return getVesselIds(selectedVessels);
  }, [selectedVessels, getVesselIds]);

  // Determine if we're updating an existing plan (either from prop or from previous save)
  const existingPlanId = editPlan?.id ?? savedPlanId;
  
  // Save rotation plan mutation (handles both create and update)
  // Note: Dialog stays open after save - user can continue editing or close manually
  // Returns parsed JSON so it can be used by both onSuccess and mutateAsync callers
  const saveRotationPlanMutation = useMutation({
    mutationFn: async (planData: any) => {
      let response;
      if (existingPlanId) {
        // Update existing plan using PATCH
        response = await apiRequest('PATCH', `/api/rotation-plans/${existingPlanId}`, planData);
      } else {
        // Create new plan using POST
        response = await apiRequest('POST', '/api/rotation-plans', planData);
      }
      // Parse and return the JSON so it's not consumed twice
      return await response.json();
    },
    onSuccess: (savedPlan) => {
      // Invalidate and refetch rotation plans to update the table
      queryClient.invalidateQueries({ queryKey: ['/api/rotation-plans'] });
      
      // Capture the plan ID from new saves so subsequent saves use PATCH
      if (!existingPlanId && savedPlan?.id) {
        setSavedPlanId(savedPlan.id);
      }
      
      toast({
        title: "Success",
        description: existingPlanId ? "Rotation plan updated successfully" : "Rotation plan saved as draft successfully",
      });
      // Dialog stays open - do NOT close or reset form here
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || (existingPlanId ? "Failed to update rotation plan" : "Failed to save rotation plan"),
        variant: "destructive",
      });
    },
  });

  // Propose rotation plan mutation
  const proposePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      return await apiRequest('POST', `/api/rotation-plans/${planId}/propose`, {
        proposedBy: 'Current User' // Backend will use this value for now
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rotation-plans'] });
      toast({
        title: "Success",
        description: "Rotation plan proposed for approval successfully",
      });
      onOpenChange(false);
      setSelectedVessels([]);
      setSelectedRanks([]);
      setSelectedRoleVariantsState([]);
      setHasManualVariants(false);
      setSelectedVessel('');
      setAssignments([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to propose rotation plan",
        variant: "destructive",
      });
    },
  });

  // Pre-populate form when editing an existing plan
  useEffect(() => {
    if (open) {
      isInitialLoadRef.current = true;
      
      if (editPlan) {
        try {
          // Parse vessels from JSON
          const vessels = JSON.parse(editPlan.vessels);
          setSelectedVessels(Array.isArray(vessels) ? vessels : []);
          
          // Parse role variants from crew field (comma-separated)
          const roleVariants = editPlan.crew.split(',').map(r => r.trim());
          
          // Find which base ranks have variants in the saved data
          const baseRanksWithVariants = new Set<string>();
          roleVariants.forEach((variant: string) => {
            if (variant.includes('_')) {
              const baseRank = variant.substring(0, variant.lastIndexOf('_'));
              baseRanksWithVariants.add(baseRank);
            }
          });
          
          // Filter out base ranks from roleVariants if their variants exist
          const filteredRoleVariants = roleVariants.filter((variant: string) => {
            // Keep if it's a variant (has underscore)
            if (variant.includes('_')) return true;
            // Keep base rank only if it has no variants
            return !baseRanksWithVariants.has(variant);
          });
          
          // Derive base ranks from filtered role variants by matching against companyRanks
          const baseRanksSet = new Set<string>();
          filteredRoleVariants.forEach((variant: string) => {
            const matchingRank = companyRanks.find((r: any) => 
              (r.role && r.role === variant) || r.rank === variant
            );
            if (matchingRank) {
              baseRanksSet.add(matchingRank.rank);
            }
          });
          
          setSelectedRanks(Array.from(baseRanksSet));
          setSelectedRoleVariantsState(filteredRoleVariants);
          setHasManualVariants(true); // Mark as manually set from saved data
          
          // Parse assignments from JSON and ensure each has a unique ID
          const savedAssignments = editPlan.assignments ? JSON.parse(editPlan.assignments) : [];
          const assignmentsWithIds = savedAssignments.map((a: Assignment) => ({
            ...a,
            id: a.id || `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }));
          setAssignments(assignmentsWithIds);
        } catch (error) {
          console.error('Failed to parse edit plan data:', error);
          toast({
            title: "Error",
            description: "Failed to load plan data",
            variant: "destructive",
          });
        }
      } else {
        // Reset form when creating new plan
        setSelectedVessels([]);
        setSelectedRanks([]);
        setSelectedRoleVariantsState([]);
        setHasManualVariants(false);
        setSelectedVessel('');
        setAssignments([]);
        setSavedPlanId(null); // Reset saved plan ID for new plans
      }
      
      // Clear the flag after initial load
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 100);
    }
  }, [editPlan, open, toast, companyRanks]);

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
    // Reset manual override when toggling base ranks
    setHasManualVariants(false);
  };

  // Auto-select first vessel when vessels are selected or reset if current vessel is deselected
  useEffect(() => {
    // Skip auto-selection during initial dialog load to preserve manual selections
    if (isInitialLoadRef.current) {
      prevSelectedVesselsRef.current = selectedVessels;
      return;
    }
    
    const prevVessels = prevSelectedVesselsRef.current;
    
    if (selectedVessels.length > 0) {
      // Check if the currently selected vessel was actually removed
      const wasRemoved = selectedVessel && prevVessels.includes(selectedVessel) && !selectedVessels.includes(selectedVessel);
      
      // Only update if:
      // 1. No vessel is currently selected, OR
      // 2. The selected vessel was explicitly removed from the list
      if (!selectedVessel || wasRemoved) {
        setSelectedVessel(selectedVessels[0]);
      }
      // Otherwise, preserve the manual selection even if the array order changes
    } else {
      // If no vessels are selected, clear the selected vessel
      setSelectedVessel('');
    }
    
    // Update ref for next render
    prevSelectedVesselsRef.current = selectedVessels;
  }, [selectedVessels]); // Only depend on selectedVessels to avoid interference with manual radio button selection

  const handleCrewSelect = (crew: { id: string; name: string; rank: string }) => {
    if (!selectedVessel) {
      toast({
        title: "No vessel selected",
        description: "Please select a vessel first by clicking on a vessel header in the timeline",
        variant: "destructive",
      });
      return;
    }
    setSelectedCrew(crew);
    setEditingAssignment(null); // Clear editing mode
    setDateDialogOpen(true);
  };

  const handleAssignmentClick = (assignment: Assignment) => {
    // Set the vessel for context
    setSelectedVessel(assignment.vessel);
    // Set crew info from the assignment
    setSelectedCrew({
      id: assignment.crewId,
      name: assignment.crewName,
      rank: assignment.rank
    });
    // Set editing mode
    setEditingAssignment(assignment);
    // Open the dialog
    setDateDialogOpen(true);
  };

  const handleAssignmentApply = (joiningDate: Date, contractPeriod: number) => {
    if (!selectedCrew || !selectedVessel) return;

    // Find vessel and rank objects to get their IDs
    const vesselObj = vessels.find((v: any) => v.name === selectedVessel || v.vessel === selectedVessel);
    const rankObj = companyRanks.find((r: any) => r.rank === selectedCrew.rank);

    // Validate that we have proper IDs - fail if not available
    // Use entryId first as it contains the actual vessel ID (VSL-003), not the numeric entry ID
    const vesselId = vesselObj?.entryId || vesselObj?.id;
    const rankId = rankObj?.id;

    if (!vesselId || !rankId) {
      toast({
        title: "Error",
        description: `Missing vessel or rank ID. Vessel: ${selectedVessel}, Rank: ${selectedCrew.rank}`,
        variant: "destructive",
      });
      return;
    }

    if (editingAssignment) {
      // Update existing assignment using unique ID
      setAssignments(prev => prev.map(a => {
        // Match by unique assignment ID to ensure we update the exact assignment
        if (a.id === editingAssignment.id) {
          return {
            ...a,
            joiningDate: joiningDate.toISOString(),
            contractPeriod,
          };
        }
        return a;
      }));
      
      toast({
        title: "Success",
        description: `Assignment for ${selectedCrew.name} updated successfully`,
      });
    } else {
      // Create new assignment with unique ID
      const newAssignment: Assignment = {
        id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
        vessel: selectedVessel,
        vesselId: vesselId,
        vesselName: selectedVessel,
        rank: selectedCrew.rank,
        rankId: rankId,
        crewId: selectedCrew.id,
        crewName: selectedCrew.name,
        joiningDate: joiningDate.toISOString(),
        contractPeriod,
      };

      setAssignments(prev => [...prev, newAssignment]);
    }
    
    // Clear editing state
    setEditingAssignment(null);
  };

  const handleUnassign = () => {
    if (!selectedCrew || !selectedVessel) return;

    if (editingAssignment) {
      // Remove specific assignment by ID when editing
      setAssignments(prev => prev.filter(a => a.id !== editingAssignment.id));
    } else {
      // Remove assignment matching crew, vessel, and rank (for backward compatibility)
      setAssignments(prev => 
        prev.filter(a => !(
          a.crewId === selectedCrew.id && 
          a.vessel === selectedVessel && 
          a.rank === selectedCrew.rank
        ))
      );
    }

    // Show toast confirmation
    toast({
      title: "Success",
      description: `${selectedCrew.name} unassigned from ${selectedVessel}`,
    });
    
    // Clear editing state
    setEditingAssignment(null);
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

    // Calculate plan date range from assignments
    const joiningDates = assignments.map(a => new Date(a.joiningDate));
    const planFromDate = new Date(Math.min(...joiningDates.map(d => d.getTime())));
    
    // Calculate planToDate as the latest contract end date
    const contractEndDates = assignments.map(a => {
      const joiningDate = new Date(a.joiningDate);
      return addMonths(joiningDate, a.contractPeriod);
    });
    const planToDate = new Date(Math.max(...contractEndDates.map(d => d.getTime())));

    // Format crew roles as comma-separated string (use role variants)
    const crewRoles = Array.from(new Set(selectedRoleVariants)).join(', ');

    // Prepare plan data
    const planData: any = {
      vessels: JSON.stringify(selectedVessels),
      crew: crewRoles,
      planFromDate: format(planFromDate, 'yyyy-MM-dd'),
      planToDate: format(planToDate, 'yyyy-MM-dd'),
      assignments: JSON.stringify(assignments),
    };

    // Only include these fields when creating a new plan (no editPlan AND no savedPlanId)
    if (!existingPlanId) {
      planData.draftId = `DRAFT-${Date.now()}`;
      planData.lastEdited = new Date().toISOString();
      planData.createdBy = 'Current User'; // TODO: Get from auth context
      planData.planStatus = 'In Draft';
    }

    saveRotationPlanMutation.mutate(planData);
  };

  const handlePropose = async () => {
    // Validate form data first (same validations as save)
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

    // Calculate plan date range from assignments
    const joiningDates = assignments.map(a => new Date(a.joiningDate));
    const planFromDate = new Date(Math.min(...joiningDates.map(d => d.getTime())));
    
    // Calculate planToDate as the latest contract end date
    const contractEndDates = assignments.map(a => {
      const joiningDate = new Date(a.joiningDate);
      return addMonths(joiningDate, a.contractPeriod);
    });
    const planToDate = new Date(Math.max(...contractEndDates.map(d => d.getTime())));

    // Format crew roles as comma-separated string (use role variants)
    const crewRoles = Array.from(new Set(selectedRoleVariants)).join(', ');

    // Prepare plan data
    const planData: any = {
      vessels: JSON.stringify(selectedVessels),
      crew: crewRoles,
      planFromDate: format(planFromDate, 'yyyy-MM-dd'),
      planToDate: format(planToDate, 'yyyy-MM-dd'),
      assignments: JSON.stringify(assignments),
    };

    // Only include these fields when creating a new plan (no editPlan AND no savedPlanId)
    if (!existingPlanId) {
      planData.draftId = `DRAFT-${Date.now()}`;
      planData.lastEdited = new Date().toISOString();
      planData.createdBy = 'Current User';
      planData.planStatus = 'In Draft';
    }

    try {
      // First save the plan - mutateAsync returns the parsed JSON (not Response)
      const savedPlan = await saveRotationPlanMutation.mutateAsync(planData);
      
      // Get the plan ID - either from existing plan or from the newly saved plan
      // For existing plans, use existingPlanId; for new plans, use the ID from the save response
      const planId = existingPlanId ?? savedPlan?.id;

      if (!planId) {
        toast({
          title: "Error",
          description: "Failed to get plan ID after save",
          variant: "destructive",
        });
        return;
      }

      // Then propose the saved plan
      proposePlanMutation.mutate(planId);
    } catch (error: any) {
      // Save failed - error toast is already shown by the mutation's onError
      console.error('Save failed before propose:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-2xl font-bold">
              {editPlan ? "Edit Rotation Plan" : "New Rotation Plan"}
            </DialogTitle>
            <div className="flex gap-2 mr-8">
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
                disabled={saveRotationPlanMutation.isPending}
                data-testid="button-save"
              >
                {saveRotationPlanMutation.isPending ? "Saving..." : (editPlan ? "Update" : "Save")}
              </Button>
              <Button
                onClick={handlePropose}
                className="bg-green-600 hover:bg-green-700"
                disabled={saveRotationPlanMutation.isPending || proposePlanMutation.isPending}
                data-testid="button-propose"
              >
                {saveRotationPlanMutation.isPending ? "Saving..." : (proposePlanMutation.isPending ? "Proposing..." : "Propose")}
              </Button>
            </div>
          </div>

          {/* Filter dropdowns - now part of the header */}
          <div className="flex gap-4 flex-wrap items-center">
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
                {baseRanks.map((rank: any) => (
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

          {/* Display selected role variants with remove buttons */}
          {selectedRoleVariants.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap ml-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">Selected roles:</span>
              {selectedRoleVariants.map((variant) => (
                <div
                  key={variant}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded-md text-sm"
                  data-testid={`chip-role-${variant}`}
                >
                  <span>{variant}</span>
                  <button
                    onClick={() => {
                      setSelectedRoleVariantsState(prev => prev.filter(v => v !== variant));
                      setHasManualVariants(true); // Mark as manually modified
                    }}
                    className="ml-1 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    data-testid={`button-remove-role-${variant}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Date Range filter */}
          <Popover open={dateRangeDialogOpen} onOpenChange={setDateRangeDialogOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-64 justify-between"
                data-testid="select-date-range"
              >
                <span className="truncate flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(dateRange.start, 'dd-MMM-yyyy')} - {format(dateRange.end, 'dd-MMM-yyyy')}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Calendar
                    mode="single"
                    selected={dateRange.start}
                    onSelect={(date) => date && setDateRange({ ...dateRange, start: date })}
                    disabled={(date) => date > dateRange.end}
                    data-testid="calendar-start-date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Calendar
                    mode="single"
                    selected={dateRange.end}
                    onSelect={(date) => date && setDateRange({ ...dateRange, end: date })}
                    disabled={(date) => date < dateRange.start}
                    data-testid="calendar-end-date"
                  />
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setDateRange({
                        start: addMonths(today, -2),
                        end: addMonths(today, 5)
                      });
                    }}
                    data-testid="button-reset-date-range"
                  >
                    Reset to Default
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setDateRangeDialogOpen(false)}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-apply-date-range"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          </div>
        </DialogHeader>

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
                    currentlyDeployedCrewIds={currentlyDeployedCrewIds}
                    allDeployedAssignments={allVesselPlanning}
                    planDateRange={dateRange}
                    selectedVessels={selectedVesselIds}
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
                queryRanks={selectedRoleVariants}
                displayRanks={timelineRoleVariants}
                selectedVessel={selectedVessel}
                onVesselSelect={setSelectedVessel}
                onAssignmentClick={handleAssignmentClick}
                dateRange={dateRange}
                assignments={assignments}
              />
            )}
          </div>
        </div>
      </DialogContent>

      {/* Date Period Dialog for crew assignment */}
      <DatePeriodDialog
        open={dateDialogOpen}
        onOpenChange={(open) => {
          setDateDialogOpen(open);
          if (!open) {
            // Clear editing state when dialog closes
            setEditingAssignment(null);
          }
        }}
        onApply={handleAssignmentApply}
        onUnassign={handleUnassign}
        crewName={selectedCrew?.name || ''}
        crewId={selectedCrew?.id || ''}
        vesselName={selectedVessel}
        rank={selectedCrew?.rank || ''}
        assignments={assignments}
        initialValues={editingAssignment ? {
          joiningDate: editingAssignment.joiningDate,
          contractPeriod: editingAssignment.contractPeriod
        } : undefined}
      />
    </Dialog>
  );
}
