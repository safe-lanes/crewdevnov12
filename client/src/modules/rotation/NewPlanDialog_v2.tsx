import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { useManningAgentsV2, useCrewPoolsV2 } from '@/hooks/v2/useMasterDataV2';

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
  draftUuid: string; // V2 uses UUID as primary identifier
  lastEdited?: string | null;
  vessels?: string; // JSON array (optional for list view)
  crew?: string; // Optional for list view
  planFromDate: string;
  planToDate: string;
  createdByUuid?: string; // V2 uses UUID
  planStatus?: string | null;
  assignments?: string | null; // JSON array (optional)
  // V2 summary fields
  vesselNames?: string;
  crewRanks?: string;
  createdByName?: string;
}

interface NewPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlan?: RotationPlan | null; // Optional plan to edit
}

interface CrewMember {
  crewUuid: string; // V2 uses crewUuid as primary identifier
  fullName: string; // V2 uses fullName instead of name
  presentRank: string; // V2 uses presentRank instead of rank
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
  crewUuid: string; // V2 uses crewUuid
  vessel: string;
  rank: string;
  name: string;
  contractStartDate: string;
  contractEndDate: string;
  rangeEndDate: string;
}

// Deployed crew assignment from vessel_planning_v2 - used for global conflict detection
interface DeployedCrewAssignment {
  crewMemberId: string | null; // V2 uses crewUuid in API
  relieverCrewId: string | null; // V2 uses relieverCrewUuid in API
  vesselUuid: string; // V2 uses vesselUuid consistently
  signOnDate: string | null;
  reliefDue: string | null;
  relieverSignOnDate: string | null;
  contractPeriodMonths: number | null; // Used to calculate reliever's end date
}

interface Assignment {
  id?: string; // Unique identifier for each assignment
  vessel: string;
  vesselUuid?: string; // V2 uses vesselUuid
  vesselName?: string;
  rank: string;
  rankId?: string;
  crewUuid: string; // V2 uses crewUuid
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
          <DialogDescription>Filter crew candidates by pool, manning agent, ship type, nationality, or experience.</DialogDescription>
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
  selectedVesselIds
}: { 
  rank: string; 
  onCrewSelect: (crew: { crewUuid: string; name: string; rank: string }) => void; // V2 uses crewUuid
  assignments: Assignment[];
  currentlyDeployedCrewIds: Set<string>;
  allDeployedAssignments: DeployedCrewAssignment[];
  planDateRange: { start: Date; end: Date };
  selectedVesselIds: string[]; // V2 uses vessel UUIDs
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

  // Normalize rank to strip position suffix (e.g., "3rd Officer_2" -> "3rd Officer")
  // This ensures we fetch all crew with that rank label, not just those assigned to a specific position
  const { normalizeRank } = useRankNormalization();
  const normalizedRank = normalizeRank(rank);

  const { data: crewMembers = [], isLoading } = useQuery<CrewMember[]>({
    queryKey: [`/api/v2/rotation/crew/by-rank/${normalizedRank}`],
  });

  // Fetch Manning Agents from V2 dedicated table
  const { data: manningAgentsData } = useManningAgentsV2();

  // Fetch Crew Pools from V2 dedicated table
  const { data: crewPoolsData } = useCrewPoolsV2();

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
  const getCrewAssignmentCount = (crewUuid: string) => {
    const vesselCount = new Set(
      assignments
        .filter(a => a.crewUuid === crewUuid)
        .map(a => a.vesselUuid) // Use vesselUuid for consistent counting
    ).size;
    return vesselCount;
  };
  
  // Get color based on deployment status and assignment count
  // Priority: Red (deployed on overlapping period) > Brown (2+ vessels) > Blue (1 vessel) > Default
  const getCrewNameColor = (crewUuid: string) => {
    // First priority: Check if crew has an overlapping deployment on ANY vessel
    // This checks all vessels, not just the selected ones for planning
    const hasOverlappingDeployment = allDeployedAssignments.some(assignment => {
      // Check if this crew member is the primary crew or reliever
      const isThisCrew = assignment.crewMemberId === crewUuid || assignment.relieverCrewId === crewUuid;
      if (!isThisCrew) return false;
      
      // Skip assignments on the currently selected vessels (we're replacing them)
      if (selectedVesselIds.includes(assignment.vesselUuid)) return false;
      
      // Determine the assignment date range for this crew member
      let assignmentStart: Date | null = null;
      let assignmentEnd: Date | null = null;
      
      if (assignment.crewMemberId === crewUuid) {
        // Primary crew - uses signOnDate and reliefDue
        assignmentStart = assignment.signOnDate ? new Date(assignment.signOnDate) : null;
        assignmentEnd = assignment.reliefDue ? new Date(assignment.reliefDue) : null;
      } else if (assignment.relieverCrewId === crewUuid) {
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
    if (currentlyDeployedCrewIds.has(crewUuid)) {
      return 'text-red-600'; // Red for currently deployed crew on selected vessels
    }
    
    // Third priority: Check draft assignments
    const count = getCrewAssignmentCount(crewUuid);
    if (count >= 2) return 'text-[#814C02]'; // Brown for 2+ vessels in draft
    if (count === 1) return 'text-blue-600'; // Blue for 1 vessel in draft
    
    return ''; // Default color for no assignments
  };

  // Get vessel name(s) for crew that are red (deployed) or blue (already planned)
  // Returns the vessel names to display in tooltip on hover
  const getCrewVesselInfo = (crewUuid: string): string | null => {
    const vesselNames: string[] = [];

    // Check for overlapping deployments on other vessels (red color reason)
    allDeployedAssignments.forEach(assignment => {
      const isThisCrew = assignment.crewMemberId === crewUuid || assignment.relieverCrewId === crewUuid;
      if (!isThisCrew) return;
      
      // Skip assignments on currently selected vessels
      if (selectedVesselIds.includes(assignment.vesselUuid)) return;
      
      // Check date overlap
      let assignmentStart: Date | null = null;
      let assignmentEnd: Date | null = null;
      
      if (assignment.crewMemberId === crewUuid) {
        assignmentStart = assignment.signOnDate ? new Date(assignment.signOnDate) : null;
        assignmentEnd = assignment.reliefDue ? new Date(assignment.reliefDue) : null;
      } else if (assignment.relieverCrewId === crewUuid) {
        assignmentStart = assignment.relieverSignOnDate ? new Date(assignment.relieverSignOnDate) : null;
        if (assignmentStart) {
          const contractMonths = assignment.contractPeriodMonths || 6;
          assignmentEnd = new Date(assignmentStart);
          assignmentEnd.setMonth(assignmentEnd.getMonth() + contractMonths);
        }
      }
      
      if (!assignmentStart) return;
      
      if (dateRangesOverlap(planDateRange.start, planDateRange.end, assignmentStart, assignmentEnd)) {
        const vesselName = getVesselName(assignment.vesselUuid);
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
        .filter(a => a.crewUuid === crewUuid)
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
                key={crew.crewUuid}
                className="p-3 border-b hover:bg-gray-50 dark:hover:bg-gray-800 flex items-start gap-2 cursor-pointer"
                onClick={() => onCrewSelect({ crewUuid: crew.crewUuid, name: crew.fullName, rank: crew.presentRank })}
              >
                <Checkbox 
                  data-testid={`checkbox-crew-${crew.crewUuid}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCrewSelect({ crewUuid: crew.crewUuid, name: crew.fullName, rank: crew.presentRank });
                  }}
                />
                <div className="flex-1">
                  {(() => {
                    const nameColor = getCrewNameColor(crew.crewUuid);
                    const vesselInfo = getCrewVesselInfo(crew.crewUuid);
                    // Show tooltip for red (deployed), blue (1 vessel planned), and brown (2+ vessels planned)
                    const hasColoredStatus = nameColor === 'text-red-600' || nameColor === 'text-blue-600' || nameColor === 'text-[#814C02]';
                    const showVesselTooltip = vesselInfo && hasColoredStatus;
                    
                    if (showVesselTooltip) {
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`font-medium text-sm cursor-help ${nameColor}`}>
                                {crew.fullName}
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
                        {crew.fullName}
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

// Position Select Dialog - shown when a rank has multiple positions on the selected vessel
function PositionSelectDialog({
  open,
  onOpenChange,
  positions,
  crewName,
  onPositionSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positions: string[];
  crewName: string;
  onPositionSelect: (position: string) => void;
}) {
  const [selectedPosition, setSelectedPosition] = useState<string>('');

  useEffect(() => {
    if (open) {
      setSelectedPosition('');
    }
  }, [open]);

  const formatPositionLabel = (position: string): string => {
    return position.replace(/_/g, ' ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Select Position</DialogTitle>
          <DialogDescription>
            Choose a specific position to assign {crewName} to.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <RadioGroup
            value={selectedPosition}
            onValueChange={setSelectedPosition}
            className="gap-3"
          >
            {positions.map((position) => (
              <div
                key={position}
                className={cn(
                  "flex items-center space-x-3 rounded-md border p-3 cursor-pointer transition-colors",
                  selectedPosition === position ? "border-primary bg-primary/5" : "border-border"
                )}
                onClick={() => setSelectedPosition(position)}
                data-testid={`radio-position-${position}`}
              >
                <RadioGroupItem value={position} id={`pos-${position}`} />
                <label htmlFor={`pos-${position}`} className="text-sm font-medium cursor-pointer flex-1">
                  {formatPositionLabel(position)}
                </label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-position-select"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedPosition) {
                onPositionSelect(selectedPosition);
              }
            }}
            disabled={!selectedPosition}
            data-testid="button-confirm-position-select"
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Date Period Dialog - for selecting joining date and contract period
function DatePeriodDialog({
  open,
  onOpenChange,
  onApply,
  onUnassign,
  crewName,
  crewUuid,
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
  crewUuid: string;
  vesselName: string;
  rank: string;
  assignments?: Assignment[];
  initialValues?: { joiningDate: string; contractPeriod: number };
}) {
  const [joiningDate, setJoiningDate] = useState<Date>();
  const [contractPeriod, setContractPeriod] = useState<string>('');
  const [unassignChecked, setUnassignChecked] = useState(false);

  // Check if crew is already assigned to this vessel and rank
  // Note: vesselName prop now contains the vessel UUID (selectedVessel)
  const isAlreadyAssigned = useMemo(() => {
    return assignments.some(a => 
      a.crewUuid === crewUuid && 
      a.vesselUuid === vesselName && 
      a.rank === rank
    );
  }, [assignments, crewUuid, vesselName, rank]);

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
          <DialogDescription>Set the joining date and contract period for this assignment.</DialogDescription>
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
  assignments = [],
  vesselLookup = []
}: { 
  vessels: string[]; // Now contains UUIDs
  queryRanks: string[];
  displayRanks: string[];
  selectedVessel: string; // UUID
  onVesselSelect: (vessel: string) => void; // vessel is UUID
  onAssignmentClick?: (assignment: Assignment) => void;
  dateRange: { start: Date; end: Date };
  assignments?: Assignment[];
  vesselLookup?: { value: string; name: string }[]; // For UUID to name translation
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  
  // Helper to get vessel name from UUID
  const getVesselNameFromUuid = (uuid: string): string => {
    const vessel = vesselLookup.find(v => v.value === uuid);
    return vessel?.name || uuid;
  };
  
  // Use vessel lookup hook for translating vessel names to IDs (for existing crew fetch)
  const { getVesselIds } = useVesselLookup();
  
  // Use custom date range from props
  const today = useMemo(() => new Date(), []);
  const startDate = dateRange.start;
  const endDate = dateRange.end;
  const totalDays = useMemo(() => differenceInDays(endDate, startDate), [startDate, endDate]);
  
  // Build query params for fetching existing crew - vessels array already contains UUIDs
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.append('filterType', 'vessel');
    // vessels is now an array of UUIDs, use them directly
    vessels.forEach(uuid => params.append('vessels', uuid));
    queryRanks.forEach(r => params.append('rank', r));
    return params;
  }, [vessels, queryRanks]);
  
  // Fetch existing crew for selected vessels and ALL ranks (including base ranks)
  const { data: existingCrew = [] } = useQuery<ExistingCrew[]>({
    queryKey: ['/api/v2/rotation/due-crew', queryParams.toString()],
    queryFn: () => fetch(`/api/v2/rotation/due-crew?${queryParams.toString()}`).then(res => res.json()),
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
  
  // Group data by vessel UUID and display rank (with smart mapping from base ranks to variants)
  const groupedData = useMemo(() => {
    const groups: { [key: string]: { [key: string]: { existing: ExistingCrew[], assignments: Assignment[] } } } = {};
    
    // vessels is now an array of UUIDs
    vessels.forEach(vesselUuid => {
      groups[vesselUuid] = {};
      displayRanks.forEach(rank => {
        groups[vesselUuid][rank] = {
          existing: [],
          // Match assignments by vesselUuid (which is now the UUID)
          assignments: assignments.filter(a => a.vesselUuid === vesselUuid && a.rank === rank),
        };
      });
    });
    
    // Create name-to-UUID lookup from vesselLookup
    const nameToUuidMap = new Map<string, string>();
    vesselLookup.forEach(v => {
      if (v.name && v.value) {
        nameToUuidMap.set(v.name, v.value);
      }
    });
    
    // Distribute existing crew to appropriate display ranks
    // Note: crew.vessel is the vessel name, need to map to UUID
    existingCrew.forEach(crew => {
      const vesselName = crew.vessel;
      const vesselUuid = nameToUuidMap.get(vesselName) || vesselName; // Map name to UUID
      const crewRank = crew.rank;
      
      // Check if this rank is in displayRanks
      if (displayRanks.includes(crewRank)) {
        // Direct match - add to this rank
        if (groups[vesselUuid]?.[crewRank]) {
          groups[vesselUuid][crewRank].existing.push(crew);
        }
      } else if (rankMapping.has(crewRank)) {
        // This is a base rank that has variants - distribute to first variant
        const variants = rankMapping.get(crewRank)!;
        if (variants.length > 0 && groups[vesselUuid]?.[variants[0]]) {
          groups[vesselUuid][variants[0]].existing.push(crew);
        }
      }
    });
    
    return groups;
  }, [vessels, displayRanks, existingCrew, assignments, rankMapping, vesselLookup]);
  
  // Resize canvas width to match container (height is computed from content)
  useEffect(() => {
    const updateCanvasWidth = () => {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.clientWidth);
      }
    };
    
    updateCanvasWidth();
    const observer = new ResizeObserver(updateCanvasWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
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
    if (vessels.length === 0 || canvasWidth <= 0) return;
    
    const width = canvasWidth;
    const vesselHeaderHeight = 48;
    const monthHeaderHeight = 32;
    const rowHeight = 40;
    const rankColumnWidth = 100;
    const timelineStartX = rankColumnWidth;
    const timelineWidth = width - rankColumnWidth;
    const vesselGap = 10;
    const cornerRadius = 8;
    
    // Compute total canvas height from content
    const vesselSectionHeight = vesselHeaderHeight + monthHeaderHeight + (displayRanks.length * rowHeight);
    const totalHeight = (vessels.length * vesselSectionHeight) + ((vessels.length - 1) * vesselGap);
    
    canvas.width = width;
    canvas.height = totalHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, totalHeight);
    
    let yOffset = 0;
    
    // Draw each vessel section
    vessels.forEach((vessel, vesselIdx) => {
      const isSelected = selectedVessel === vessel;
      const headerColor = isSelected ? '#52baf3' : '#b0b8c1';
      const sectionHeight = vesselSectionHeight;
      const sectionStartY = yOffset;
      
      // Clip to rounded rectangle for the entire vessel band
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, yOffset, width, sectionHeight, cornerRadius);
      ctx.clip();
      
      // Draw vessel header (full width)
      ctx.fillStyle = headerColor;
      ctx.fillRect(0, yOffset, width, vesselHeaderHeight);
      
      // Draw radio button (left side)
      ctx.beginPath();
      ctx.arc(20, yOffset + 24, 8, 0, 2 * Math.PI);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw vessel name (with adequate spacing after radio button) - display name, not UUID
      const vesselDisplayName = getVesselNameFromUuid(vessel);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(vesselDisplayName, 50, yOffset + 30);
      
      // vessel is now a UUID, so comparison with selectedVessel (also UUID) works correctly
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(20, yOffset + 24, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
      }
      
      yOffset += vesselHeaderHeight;
      
      // Draw header row (rank column + month headers)
      // Rank column header
      ctx.fillStyle = headerColor;
      ctx.fillRect(0, yOffset, rankColumnWidth, monthHeaderHeight);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Rank', rankColumnWidth / 2, yOffset + 20);
      
      // Month headers (in timeline area)
      ctx.fillStyle = headerColor;
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
      
      const vesselContentStartY = yOffset;
      
      // Draw rank rows
      displayRanks.forEach((rank, rankIdx) => {
        const rowData = groupedData[vessel]?.[rank];
        if (!rowData) return;
        
        const y = yOffset;
        
        // Draw row background (full width)
        ctx.fillStyle = rankIdx % 2 === 0 ? '#ffffff' : '#f9fafb';
        ctx.fillRect(0, y, width, rowHeight);
        
        // Draw rank column background with border
        ctx.fillStyle = isSelected ? '#f3f4f6' : '#ececec';
        ctx.fillRect(0, y, rankColumnWidth, rowHeight);
        
        // Draw rank label (centered in rank column)
        ctx.fillStyle = isSelected ? '#1f2937' : '#9ca3af';
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
      
      if (!isSelected) {
        const contentHeight = yOffset - vesselContentStartY;
        if (contentHeight > 0) {
          ctx.fillStyle = 'rgba(240, 240, 240, 0.45)';
          ctx.fillRect(0, vesselContentStartY, width, contentHeight);
        }
      }
      
      // Restore context (remove rounded clip) and draw subtle border around vessel band
      ctx.restore();
      ctx.strokeStyle = isSelected ? '#52baf3' : '#d1d5db';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(0, sectionStartY, width, sectionHeight, cornerRadius);
      ctx.stroke();
      
      // Add gap between vessels
      if (vesselIdx < vessels.length - 1) {
        yOffset += vesselGap;
      }
    });
    
    // Draw "today" vertical line (only in timeline area)
    const todayX = timelineStartX + ((differenceInDays(today, startDate) / totalDays) * timelineWidth);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(todayX, 0);
    ctx.lineTo(todayX, totalHeight);
    ctx.stroke();
    
  }, [vessels, displayRanks, groupedData, selectedVessel, months, today, startDate, endDate, totalDays, canvasWidth]);
  
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
    const timelineWidth = canvasWidth - rankColumnWidth;
    const vesselGap = 10;
    
    let yOffset = 0;
    
    // Check each vessel section
    for (let vi = 0; vi < vessels.length; vi++) {
      const vessel = vessels[vi];
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
      
      // Account for gap between vessels
      if (vi < vessels.length - 1) {
        yOffset += vesselGap;
      }
    }
  };
  
  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto">
      <canvas
        ref={canvasRef}
        className="block cursor-pointer"
        onClick={handleCanvasClick}
        data-testid="canvas-vessel-timeline"
      />
    </div>
  );
}

export function NewPlanDialog_v2({ open, onOpenChange, editPlan }: NewPlanDialogProps) {
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]); // Base ranks selected in dropdown
  const [selectedRoleVariantsState, setSelectedRoleVariantsState] = useState<string[]>([]); // Specific role variants selected
  const [hasManualVariants, setHasManualVariants] = useState(false); // Track if user manually modified variants
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<{ crewUuid: string; name: string; rank: string } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [positionSelectOpen, setPositionSelectOpen] = useState(false);
  const [pendingPositionOptions, setPendingPositionOptions] = useState<string[]>([]);
  const prevSelectedVesselsRef = useRef<string[]>([]);
  const isInitialLoadRef = useRef(false);
  
  // Track saved plan ID for new plans - allows subsequent saves to use PATCH instead of POST
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  
  // Fetch full draft details when editing (list view only has summary data)
  const { data: fullDraftData } = useQuery<{
    draftUuid: string;
    vessels: Array<{ vesselUuid: string }>;
    ranks: Array<{ rankName: string }>;
    entries: any[];
  }>({
    queryKey: ['/api/v2/rotation', 'drafts', editPlan?.draftUuid],
    queryFn: async () => {
      if (!editPlan?.draftUuid) return null;
      const response = await fetch(`/api/v2/rotation/drafts/${editPlan.draftUuid}`);
      if (!response.ok) throw new Error('Failed to fetch draft details');
      return response.json();
    },
    enabled: !!editPlan?.draftUuid && open,
  });
  
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

  // Fetch vessels from V2 master_vessels table
  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<any[]>({
    queryKey: ['/api/v2/vessel/list'],
    select: (data: any[]) => {
      // Map to expected format used by the component
      return data.map((v: any) => ({
        id: v.id,
        value: v.vesselUuid,
        name: v.vessel,
        vessel: v.vessel,
        vesselType: v.vesselType,
      }));
    }
  });

  // Fetch company ranks
  const { data: companyRanks = [], isLoading: ranksLoading } = useQuery<any[]>({
    queryKey: ['/api/v2/admin/company-ranks'],
  });

  // selectedVessels already contains vessel UUIDs (from vessel list value: v.vesselUuid)
  // The vessel-revisions/ranks API expects vessel UUIDs directly — no translation needed

  // Fetch vessel ranks for ALL selected vessels and combine them
  // Each rank entry includes vesselUuid for per-vessel slot counting
  const { data: vesselSpecificRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/v2/admin/vessel-revisions/ranks', selectedVessels],
    queryFn: async () => {
      if (selectedVessels.length === 0) return [];
      
      // Fetch ranks for each selected vessel and combine, tagging each with vesselUuid
      const allRanks: any[] = [];
      for (const vesselId of selectedVessels) {
        try {
          const response = await fetch(`/api/v2/admin/vessel-revisions/ranks/${vesselId}`);
          if (response.ok) {
            const ranks = await response.json();
            // Tag each rank with its source vesselId for per-vessel slot counting
            const taggedRanks = ranks.map((rank: any) => ({ ...rank, _vesselId: vesselId }));
            allRanks.push(...taggedRanks);
          }
        } catch (error) {
          console.error(`Failed to fetch ranks for vessel ${vesselId}:`, error);
        }
      }
      return allRanks;
    },
    enabled: selectedVessels.length > 0,
  });

  // Build position information from vessel-specific ranks
  // API now provides displayRole which handles the per-vessel slot counting logic:
  // - If a vessel has ONE slot for a rank: displayRole = base Rank Label (e.g., "Fitter")
  // - If a vessel has MULTIPLE slots for a rank: displayRole = suffixed position (e.g., "Fitter_1", "Fitter_2")
  const { vesselValidPositions, vesselBaseRanksWithDirectSlots, perVesselPositions } = useMemo(() => {
    const validPositions = new Set<string>();
    const baseRanksWithDirectSlots = new Set<string>();
    const positionsByVessel = new Map<string, Set<string>>();
    
    // Group ranks by vessel for processing
    const ranksByVessel = new Map<string, any[]>();
    vesselSpecificRanks.forEach((rank: any) => {
      const vesselId = rank._vesselId || 'unknown';
      if (!ranksByVessel.has(vesselId)) {
        ranksByVessel.set(vesselId, []);
      }
      ranksByVessel.get(vesselId)!.push(rank);
    });
    
    // Process each vessel independently, using the API-provided displayRole
    ranksByVessel.forEach((vesselRanks, vesselId) => {
      if (!positionsByVessel.has(vesselId)) {
        positionsByVessel.set(vesselId, new Set<string>());
      }
      const vesselPositionSet = positionsByVessel.get(vesselId)!;
      
      vesselRanks.forEach((rank: any) => {
        // Use displayRole from API (already has per-vessel slot count logic applied)
        const displayPosition = rank.displayRole || rank.role || rank.rank;
        if (displayPosition) {
          validPositions.add(displayPosition);
          vesselPositionSet.add(displayPosition);
          // Track base ranks that have direct slots (no suffix)
          if (!displayPosition.includes('_')) {
            baseRanksWithDirectSlots.add(displayPosition);
          }
        }
      });
    });
    
    return { 
      vesselValidPositions: validPositions, 
      vesselBaseRanksWithDirectSlots: baseRanksWithDirectSlots,
      perVesselPositions: positionsByVessel,
    };
  }, [vesselSpecificRanks]);

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

  // Get all role variants for selected base ranks, filtered by vessel-specific positions
  // Uses Rank Labels (rank field) as source of truth, with suffixed positions only for multi-slot ranks
  // When vessels are selected, only include positions that exist on at least one selected vessel
  const autoSelectedRoleVariants = useMemo(() => {
    const variants: string[] = [];
    const addedPositions = new Set<string>(); // Track what we've added to avoid duplicates
    const selectedBaseRanks = new Set(selectedRanks);
    
    const hasVesselFilter = selectedVessels.length > 0 && vesselValidPositions.size > 0;
    
    selectedBaseRanks.forEach((baseRank: string) => {
      if (hasVesselFilter) {
        // Vessel filter active: only use positions that actually exist on selected vessel(s)
        // Build the union of positions across all selected vessels (not company-wide)
        const vesselFilteredPositions = new Set<string>();
        selectedVessels.forEach((vesselUuid: string) => {
          const vesselPositions = perVesselPositions.get(vesselUuid);
          if (vesselPositions) {
            vesselPositions.forEach((pos: string) => vesselFilteredPositions.add(pos));
          }
        });
        
        vesselFilteredPositions.forEach((position: string) => {
          const isMatch = position === baseRank || 
                         (position.startsWith(baseRank) && position.includes('_'));
          
          if (isMatch && !addedPositions.has(position)) {
            variants.push(position);
            addedPositions.add(position);
          }
        });
      } else {
        // No vessel filter: fall back to company ranks
        const hasCompanyVariants = companyRanks.some((rank: any) => 
          rank.rank === baseRank && rank.role && rank.role !== rank.rank
        );
        
        if (hasCompanyVariants) {
          companyRanks.forEach((rank: any) => {
            if (rank.rank === baseRank && rank.role && rank.role !== rank.rank) {
              if (!addedPositions.has(rank.role)) {
                variants.push(rank.role);
                addedPositions.add(rank.role);
              }
            }
          });
        } else {
          if (!addedPositions.has(baseRank)) {
            variants.push(baseRank);
            addedPositions.add(baseRank);
          }
        }
      }
    });
    
    return variants;
  }, [companyRanks, selectedRanks, selectedVessels, vesselValidPositions, perVesselPositions]);

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

  // No useEffect sync needed: when hasManualVariants is false, selectedRoleVariants
  // already points directly to autoSelectedRoleVariants (line above).
  // When hasManualVariants flips to true, user explicitly sets state via handlers.

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
    queryKey: ['/api/v2/rotation/due-crew', queryParams.toString()],
    queryFn: () => fetch(`/api/v2/rotation/due-crew?${queryParams.toString()}`).then(res => res.json()),
    enabled: selectedVessels.length > 0 && selectedRanks.length > 0,
  });

  // Fetch ALL vessel planning data to check for global assignment conflicts
  // This checks crew assignments across ALL vessels, not just selected ones
  const { data: allVesselPlanning = [] } = useQuery<DeployedCrewAssignment[]>({
    queryKey: ['/api/v2/vessel/planning'],
  });

  // Create Set of currently deployed crew UUIDs for O(1) lookup
  const currentlyDeployedCrewIds = useMemo(() => {
    return new Set(existingCrew.map(crew => crew.crewUuid));
  }, [existingCrew]);

  // Get vessel IDs for the selected vessels (for conflict detection)
  const selectedVesselIds = useMemo(() => {
    return getVesselIds(selectedVessels);
  }, [selectedVessels, getVesselIds]);

  // Determine if we're updating an existing plan (either from prop or from previous save)
  // V2 uses draftUuid instead of numeric id
  const existingDraftUuid = editPlan?.draftUuid ?? savedPlanId;
  
  // Save rotation plan mutation (handles both create and update)
  // Note: Dialog stays open after save - user can continue editing or close manually
  // Returns parsed JSON so it can be used by both onSuccess and mutateAsync callers
  const saveRotationPlanMutation = useMutation({
    mutationFn: async (planData: any) => {
      let response;
      if (existingDraftUuid) {
        // Update existing plan using PATCH - V2 endpoint
        response = await apiRequest('PATCH', `/api/v2/rotation/drafts/${existingDraftUuid}`, planData);
      } else {
        // Create new plan using POST - V2 endpoint
        response = await apiRequest('POST', '/api/v2/rotation/drafts', planData);
      }
      // Parse and return the JSON so it's not consumed twice
      return await response.json();
    },
    onSuccess: (savedPlan) => {
      // Invalidate and refetch rotation plans to update the table
      queryClient.invalidateQueries({ queryKey: ['/api/v2/rotation', 'drafts'] });
      
      // Capture the plan UUID from new saves so subsequent saves use PATCH
      if (!existingDraftUuid && savedPlan?.draftUuid) {
        setSavedPlanId(savedPlan.draftUuid);
      }
      
      toast({
        title: "Success",
        description: existingDraftUuid ? "Rotation plan updated successfully" : "Rotation plan saved as draft successfully",
      });
      // Dialog stays open - do NOT close or reset form here
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || (existingDraftUuid ? "Failed to update rotation plan" : "Failed to save rotation plan"),
        variant: "destructive",
      });
    },
  });

  // Propose rotation plan mutation - V2 endpoint
  const proposePlanMutation = useMutation({
    mutationFn: async (draftUuid: string) => {
      return await apiRequest('POST', `/api/v2/rotation/drafts/${draftUuid}/propose`, {
        proposedBy: 'Current User' // Backend will use this value for now
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v2/rotation', 'drafts'] });
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

  // Pre-populate form when editing an existing plan (use fullDraftData from API)
  useEffect(() => {
    if (open) {
      isInitialLoadRef.current = true;
      
      if (editPlan && fullDraftData) {
        try {
          // Use vessels from full draft data (array of {vesselUuid})
          if (fullDraftData.vessels && fullDraftData.vessels.length > 0) {
            const vesselUuids = fullDraftData.vessels.map(v => v.vesselUuid);
            setSelectedVessels(vesselUuids);
          } else if (editPlan.vessels) {
            // Fallback to legacy JSON format
            const vessels = JSON.parse(editPlan.vessels);
            setSelectedVessels(Array.isArray(vessels) ? vessels : []);
          }
          
          // Use ranks from full draft data (array of {rankName})
          let roleVariants: string[] = [];
          if (fullDraftData.ranks && fullDraftData.ranks.length > 0) {
            roleVariants = fullDraftData.ranks.map(r => r.rankName);
          } else if (editPlan.crew) {
            // Fallback to legacy comma-separated format
            roleVariants = editPlan.crew.split(',').map(r => r.trim());
          }
          
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
          
          // Load assignments from fullDraftData.entries (V2 API) or fallback to editPlan.assignments
          let loadedAssignments: Assignment[] = [];
          
          if (fullDraftData.entries && fullDraftData.entries.length > 0) {
            // Map V2 entries to Assignment format (entries are enriched with crewName/vesselName from API)
            // IMPORTANT: vessel field must use vesselName (for timeline filtering) not vesselUuid
            loadedAssignments = fullDraftData.entries.map((entry: any) => ({
              id: entry.entryUuid || `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              vessel: entry.vesselName || entry.vesselUuid || '', // Use vesselName for timeline matching
              vesselUuid: entry.vesselUuid,
              vesselName: entry.vesselName,
              rank: entry.rank || '',
              rankId: entry.rankId,
              crewUuid: entry.crewUuid || '',
              crewName: entry.crewName || 'Unknown Crew',
              joiningDate: entry.signOnDate || '',
              contractPeriod: entry.contractPeriod || 3,
            }));
          } else if (editPlan.assignments) {
            // Fallback to legacy JSON format
            const savedAssignments = JSON.parse(editPlan.assignments);
            loadedAssignments = savedAssignments.map((a: Assignment) => ({
              ...a,
              id: a.id || `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }));
          }
          
          setAssignments(loadedAssignments);
        } catch (error) {
          console.error('Failed to parse edit plan data:', error);
          toast({
            title: "Error",
            description: "Failed to load plan data",
            variant: "destructive",
          });
        }
      } else if (!editPlan) {
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
  }, [editPlan, fullDraftData, open, toast, companyRanks]);

  // Toggle vessel selection by UUID (vessel.value)
  const toggleVessel = (vesselUuid: string) => {
    setSelectedVessels(prev =>
      prev.includes(vesselUuid)
        ? prev.filter(v => v !== vesselUuid)
        : [...prev, vesselUuid]
    );
  };
  
  // Helper to get vessel name from UUID for display
  const getVesselNameByUuid = (uuid: string): string => {
    const vessel = vessels.find((v: any) => v.value === uuid);
    return vessel?.name || uuid;
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

  const handleCrewSelect = (crew: { crewUuid: string; name: string; rank: string }) => {
    if (!selectedVessel) {
      toast({
        title: "No vessel selected",
        description: "Please select a vessel first by clicking on a vessel header in the timeline",
        variant: "destructive",
      });
      return;
    }
    
    setEditingAssignment(null);
    
    const baseRank = crew.rank;
    const vesselPositions = perVesselPositions.get(selectedVessel);
    
    if (vesselPositions) {
      const matchingPositions = Array.from(vesselPositions).filter(
        (pos: string) => pos.startsWith(baseRank) && pos.includes('_')
      );
      
      if (matchingPositions.length > 1) {
        setSelectedCrew(crew);
        setPendingPositionOptions(matchingPositions.sort());
        setPositionSelectOpen(true);
        return;
      }
      
      if (matchingPositions.length === 1) {
        setSelectedCrew({ ...crew, rank: matchingPositions[0] });
        setDateDialogOpen(true);
        return;
      }
    }
    
    setSelectedCrew(crew);
    setDateDialogOpen(true);
  };
  
  const handlePositionSelected = (position: string) => {
    if (!selectedCrew) return;
    setSelectedCrew({ ...selectedCrew, rank: position });
    setPositionSelectOpen(false);
    setPendingPositionOptions([]);
    setDateDialogOpen(true);
  };

  const handleAssignmentClick = (assignment: Assignment) => {
    // Set the vessel for context - use vesselUuid since selectedVessel is now a UUID
    setSelectedVessel(assignment.vesselUuid || '');
    // Set crew info from the assignment
    setSelectedCrew({
      crewUuid: assignment.crewUuid, // V2 uses crewUuid
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

    // Find vessel by UUID (selectedVessel is now a UUID) and rank objects to get their IDs
    const vesselObj = vessels.find((v: any) => v.value === selectedVessel);
    const baseRank = selectedCrew.rank.includes('_') ? selectedCrew.rank.replace(/_\d+$/, '') : selectedCrew.rank;
    const rankObj = companyRanks.find((r: any) => r.rank === baseRank);

    // Validate that we have proper IDs - fail if not available
    // For V2, use vessel.value which is the UUID
    const vesselId = vesselObj?.value || vesselObj?.id;
    const vesselName = vesselObj?.name || selectedVessel;
    // Use rankId (R002 format) to match vessel revision format, not id (numeric format)
    const rankId = rankObj?.rankId || rankObj?.id;

    if (!vesselId || !rankId) {
      toast({
        title: "Error",
        description: `Missing vessel or rank ID. Vessel: ${vesselName}, Rank: ${selectedCrew.rank}`,
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
        vessel: vesselName,
        vesselUuid: vesselId, // V2 uses vesselUuid (which is vessel.value)
        vesselName: vesselName,
        rank: selectedCrew.rank,
        rankId: rankId,
        crewUuid: selectedCrew.crewUuid, // V2 uses crewUuid
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
    
    // Get vessel name for display (selectedVessel is now a UUID)
    const vesselObj = vessels.find((v: any) => v.value === selectedVessel);
    const vesselDisplayName = vesselObj?.name || selectedVessel;

    if (editingAssignment) {
      // Remove specific assignment by ID when editing
      setAssignments(prev => prev.filter(a => a.id !== editingAssignment.id));
    } else {
      // Remove assignment matching crew, vessel UUID, and rank
      setAssignments(prev => 
        prev.filter(a => !(
          a.crewUuid === selectedCrew.crewUuid && 
          a.vesselUuid === selectedVessel && 
          a.rank === selectedCrew.rank
        ))
      );
    }

    // Show toast confirmation
    toast({
      title: "Success",
      description: `${selectedCrew.name} unassigned from ${vesselDisplayName}`,
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
    if (!existingDraftUuid) {
      planData.lastEdited = new Date().toISOString();
      planData.createdByUuid = localStorage.getItem('crewUserId') || 'unknown';
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
    if (!existingDraftUuid) {
      planData.lastEdited = new Date().toISOString();
      planData.createdByUuid = localStorage.getItem('crewUserId') || 'unknown';
      planData.planStatus = 'In Draft';
    }

    try {
      // First save the plan - mutateAsync returns the parsed JSON (not Response)
      const savedPlan = await saveRotationPlanMutation.mutateAsync(planData);
      
      // Get the draft UUID - either from existing plan or from the newly saved plan
      // For existing plans, use existingDraftUuid; for new plans, use the UUID from the save response
      const draftUuid = existingDraftUuid ?? savedPlan?.draftUuid;

      if (!draftUuid) {
        toast({
          title: "Error",
          description: "Failed to get plan UUID after save",
          variant: "destructive",
        });
        return;
      }

      // Then propose the saved plan using V2 endpoint
      proposePlanMutation.mutate(draftUuid);
    } catch (error: any) {
      // Save failed - error toast is already shown by the mutation's onError
      console.error('Save failed before propose:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogDescription className="sr-only">
            Configure vessels, ranks, and crew assignments for the rotation plan.
          </DialogDescription>
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-2xl font-bold">
              {editPlan ? "Edit Rotation Plan V2" : "New Rotation Plan V2"}
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
                      checked={selectedVessels.includes(vessel.value)}
                      onCheckedChange={() => toggleVessel(vessel.value)}
                      data-testid={`checkbox-vessel-${vessel.id}`}
                    />
                    <label
                      className="text-sm cursor-pointer flex-1"
                      onClick={() => toggleVessel(vessel.value)}
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
                    selectedVesselIds={selectedVesselIds}
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
                vesselLookup={vessels.map((v: any) => ({ value: v.value, name: v.name }))}
              />
            )}
          </div>
        </div>
      </DialogContent>

      {/* Position Select Dialog - shown when rank has multiple positions */}
      <PositionSelectDialog
        open={positionSelectOpen}
        onOpenChange={(open) => {
          setPositionSelectOpen(open);
          if (!open) {
            setPendingPositionOptions([]);
          }
        }}
        positions={pendingPositionOptions}
        crewName={selectedCrew?.name || ''}
        onPositionSelect={handlePositionSelected}
      />

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
        crewUuid={selectedCrew?.crewUuid || ''}
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

export default NewPlanDialog_v2;
