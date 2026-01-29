import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Popover as DatePopover, PopoverContent as DatePopoverContent, PopoverTrigger as DatePopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { addMonths, differenceInDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useVesselLookup } from '@/hooks/useVesselLookup';
import { useRankNormalization } from '@/hooks/useRankNormalization';
import { useCrewByRankV2, useCreateDraftV2, useUpdateDraftV2, useCreateEntryV2, mapV2CrewToLegacyFormat } from './hooks/useRotationV2';
import type { RotationDraftV2, RotationCrewV2 } from './api/rotationApiV2';

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

interface NewPlanDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editPlan?: RotationDraftV2 | null;
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

interface AssignmentV2 {
  id?: string;
  vessel: string;
  vesselUuid?: string;
  vesselName?: string;
  rank: string;
  rankId?: string;
  crewUuid: string;
  crewName: string;
  joiningDate: string;
  contractPeriod: number;
}

function CrewColumnV2({ 
  rank, 
  onCrewSelect, 
  assignments,
}: { 
  rank: string; 
  onCrewSelect: (crew: { id: string; name: string; rank: string }) => void;
  assignments: AssignmentV2[];
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

  const { normalizeRank } = useRankNormalization();
  const normalizedRank = normalizeRank(rank);

  const { data: crewMembersV2 = [], isLoading } = useCrewByRankV2(normalizedRank);

  const crewMembers = useMemo(() => {
    return crewMembersV2.map(mapV2CrewToLegacyFormat);
  }, [crewMembersV2]);

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'availabilityDate') return value !== null;
    return Array.isArray(value) && value.length > 0;
  });

  const filteredCrewMembers = useMemo(() => {
    return crewMembers.filter(crew => {
      if (filters.pools.length > 0 && !filters.pools.includes(crew.pool || '')) return false;
      if (filters.nationalities.length > 0 && !filters.nationalities.includes(crew.nationality || '')) return false;
      
      if (filters.availabilityDate) {
        if (!crew.nextAvailability) return true;
        try {
          const crewAvailabilityDate = new Date(crew.nextAvailability);
          if (crewAvailabilityDate > filters.availabilityDate) return false;
        } catch {
          // pass
        }
      }
      
      return true;
    });
  }, [crewMembers, filters]);

  const getCrewAssignmentCount = (crewId: string) => {
    const vesselCount = new Set(
      assignments
        .filter(a => a.crewUuid === crewId)
        .map(a => a.vessel)
    ).size;
    return vesselCount;
  };

  const getCrewNameColor = (crewId: string) => {
    const count = getCrewAssignmentCount(crewId);
    if (count >= 2) return 'text-[#814C02]';
    if (count === 1) return 'text-blue-600';
    return '';
  };

  if (isLoading) {
    return (
      <div className="w-64 flex-shrink-0">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-t font-semibold">
          {rank}
        </div>
        <div className="p-4 text-center text-gray-500 text-sm">Loading crew...</div>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 flex-shrink-0">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-t font-semibold flex items-center gap-2">
          <Checkbox data-testid={`checkbox-select-all-v2-${rank}`} />
          <span className="flex-1">{rank}</span>
          <button
            onClick={() => setFilterDialogOpen(true)}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${hasActiveFilters ? 'text-blue-600' : 'text-gray-600'}`}
            data-testid={`button-filter-v2-${rank}`}
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
                  data-testid={`checkbox-crew-v2-${crew.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCrewSelect({ id: crew.id, name: crew.name, rank: crew.rank });
                  }}
                />
                <div className="flex-1">
                  <div className={`font-medium text-sm ${getCrewNameColor(crew.id)}`}>
                    {crew.name}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xs text-gray-500 mt-1 cursor-help">
                          {crew.nextAvailability ? formatAvailabilityDate(crew.nextAvailability) : '—'}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="text-xs">
                          <span className="font-medium">Next Availability:</span> {crew.nextAvailability ? formatAvailabilityDate(crew.nextAvailability) : '—'}
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
    </>
  );
}

function DatePeriodDialogV2({
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
  assignments?: AssignmentV2[];
  initialValues?: { joiningDate: string; contractPeriod: number };
}) {
  const [joiningDate, setJoiningDate] = useState<Date>();
  const [contractPeriod, setContractPeriod] = useState<string>('');
  const [unassignChecked, setUnassignChecked] = useState(false);

  const isAlreadyAssigned = useMemo(() => {
    return assignments.some(a => 
      a.crewUuid === crewId && 
      a.vessel === vesselName && 
      a.rank === rank
    );
  }, [assignments, crewId, vesselName, rank]);

  useEffect(() => {
    if (open && initialValues) {
      setJoiningDate(new Date(initialValues.joiningDate));
      setContractPeriod(initialValues.contractPeriod.toString());
    } else if (!open) {
      setJoiningDate(undefined);
      setContractPeriod('');
      setUnassignChecked(false);
    }
  }, [open, initialValues]);

  const handleApply = () => {
    if (unassignChecked) {
      onUnassign();
      onOpenChange(false);
      setJoiningDate(undefined);
      setContractPeriod('');
      setUnassignChecked(false);
      return;
    }

    if (!joiningDate || !contractPeriod) {
      return;
    }
    onApply(joiningDate, parseInt(contractPeriod));
    onOpenChange(false);
    setJoiningDate(undefined);
    setContractPeriod('');
    setUnassignChecked(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
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
                  data-testid="button-joining-date-v2"
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
                  data-testid="calendar-joining-date-v2"
                />
              </DatePopoverContent>
            </DatePopover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Contract Period (Months)</label>
            <Select value={contractPeriod} onValueChange={setContractPeriod}>
              <SelectTrigger className="w-full" data-testid="select-contract-period-v2">
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

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="unassign-checkbox-v2"
              checked={unassignChecked}
              onCheckedChange={(checked) => setUnassignChecked(checked as boolean)}
              disabled={!isAlreadyAssigned}
              data-testid="checkbox-unassign-v2"
            />
            <label
              htmlFor="unassign-checkbox-v2"
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
            data-testid="button-cancel-assignment-v2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!unassignChecked && (!joiningDate || !contractPeriod)}
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-apply-assignment-v2"
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NewPlanDialog_v2({ open, onOpenChange, editPlan }: NewPlanDialogV2Props) {
  const { toast } = useToast();
  const { getVesselIds, getVesselId } = useVesselLookup();
  
  const createDraftMutation = useCreateDraftV2();
  const updateDraftMutation = useUpdateDraftV2();
  const createEntryMutation = useCreateEntryV2();

  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: addMonths(today, -2),
    end: addMonths(today, 5)
  });

  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [assignments, setAssignments] = useState<AssignmentV2[]>([]);

  const [datePeriodDialogOpen, setDatePeriodDialogOpen] = useState(false);
  const [selectedCrewForAssignment, setSelectedCrewForAssignment] = useState<{
    crew: { id: string; name: string; rank: string };
    vessel: string;
    rank: string;
  } | null>(null);

  const { data: vessels = [] } = useQuery({
    queryKey: ['/api/external/vessels'],
  });

  const { data: companyRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/company-ranks'],
    select: (data: any[]) => {
      return data.filter((rank: any) => !rank.isRoleRow && !rank.is_role_row);
    }
  });

  useEffect(() => {
    if (editPlan) {
      setDateRange({
        start: new Date(editPlan.planFromDate),
        end: new Date(editPlan.planToDate),
      });
    }
  }, [editPlan]);

  const handleCrewSelect = (crew: { id: string; name: string; rank: string }) => {
    if (!selectedVessel) {
      toast({
        title: "Select a vessel",
        description: "Please select a vessel first by clicking on the vessel header",
        variant: "destructive",
      });
      return;
    }

    setSelectedCrewForAssignment({
      crew,
      vessel: selectedVessel,
      rank: crew.rank,
    });
    setDatePeriodDialogOpen(true);
  };

  const handleApplyAssignment = (joiningDate: Date, contractPeriod: number) => {
    if (!selectedCrewForAssignment) return;

    const { crew, vessel, rank } = selectedCrewForAssignment;
    const vesselUuid = getVesselId(vessel) || vessel;

    const existingIndex = assignments.findIndex(
      a => a.crewUuid === crew.id && a.vessel === vessel && a.rank === rank
    );

    if (existingIndex >= 0) {
      const updated = [...assignments];
      updated[existingIndex] = {
        ...updated[existingIndex],
        joiningDate: format(joiningDate, 'yyyy-MM-dd'),
        contractPeriod,
      };
      setAssignments(updated);
    } else {
      setAssignments([
        ...assignments,
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          vessel,
          vesselUuid,
          rank,
          crewUuid: crew.id,
          crewName: crew.name,
          joiningDate: format(joiningDate, 'yyyy-MM-dd'),
          contractPeriod,
        },
      ]);
    }

    setSelectedCrewForAssignment(null);
  };

  const handleUnassign = () => {
    if (!selectedCrewForAssignment) return;

    const { crew, vessel, rank } = selectedCrewForAssignment;
    setAssignments(
      assignments.filter(
        a => !(a.crewUuid === crew.id && a.vessel === vessel && a.rank === rank)
      )
    );
    setSelectedCrewForAssignment(null);
  };

  const handleSaveDraft = async () => {
    try {
      const crewUserId = localStorage.getItem('crewUserId') || 'unknown';
      
      if (editPlan) {
        await updateDraftMutation.mutateAsync({
          draftUuid: editPlan.draftUuid,
          data: {
            planFromDate: format(dateRange.start, 'yyyy-MM-dd'),
            planToDate: format(dateRange.end, 'yyyy-MM-dd'),
            lastEdited: new Date().toISOString(),
          },
        });
      } else {
        const draft = await createDraftMutation.mutateAsync({
          planFromDate: format(dateRange.start, 'yyyy-MM-dd'),
          planToDate: format(dateRange.end, 'yyyy-MM-dd'),
          createdByUuid: crewUserId,
        });

        for (const assignment of assignments) {
          await createEntryMutation.mutateAsync({
            draftUuid: draft.draftUuid,
            vesselUuid: assignment.vesselUuid || assignment.vessel,
            rank: assignment.rank,
            crewUuid: assignment.crewUuid,
            signOnDate: assignment.joiningDate,
            contractPeriod: assignment.contractPeriod,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/v2/rotation'] });
      toast({
        title: "Success",
        description: editPlan ? "Draft updated successfully" : "Draft saved successfully",
      });
      onOpenChange(false);
      setAssignments([]);
      setSelectedVessels([]);
      setSelectedRanks([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setAssignments([]);
    setSelectedVessels([]);
    setSelectedRanks([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editPlan ? 'Edit Rotation Plan V2' : 'New Rotation Plan V2'}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Vessels</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" data-testid="select-vessels-v2">
                        {selectedVessels.length === 0 ? "Select vessels" : `${selectedVessels.length} selected`}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-2" align="start">
                      <div className="max-h-60 overflow-y-auto">
                        {(vessels as any[]).map((vessel: any) => (
                          <div key={vessel.vesselId || vessel.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                            <Checkbox
                              checked={selectedVessels.includes(vessel.name || vessel.vessel)}
                              onCheckedChange={() => {
                                const name = vessel.name || vessel.vessel;
                                setSelectedVessels(prev =>
                                  prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
                                );
                                if (!selectedVessel && !selectedVessels.includes(name)) {
                                  setSelectedVessel(name);
                                }
                              }}
                              data-testid={`checkbox-vessel-v2-${vessel.vesselId || vessel.id}`}
                            />
                            <label className="text-sm cursor-pointer flex-1">{vessel.name || vessel.vessel}</label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Ranks</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" data-testid="select-ranks-v2">
                        {selectedRanks.length === 0 ? "Select ranks" : `${selectedRanks.length} selected`}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-2" align="start">
                      <div className="max-h-60 overflow-y-auto">
                        {companyRanks.map((rank: any) => (
                          <div key={rank.id || rank.rank} className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                            <Checkbox
                              checked={selectedRanks.includes(rank.rank)}
                              onCheckedChange={() => {
                                setSelectedRanks(prev =>
                                  prev.includes(rank.rank) ? prev.filter(r => r !== rank.rank) : [...prev, rank.rank]
                                );
                              }}
                              data-testid={`checkbox-rank-v2-${rank.rank}`}
                            />
                            <label className="text-sm cursor-pointer flex-1">{rank.rank}</label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Date Range</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between" data-testid="select-date-range-v2">
                        {format(dateRange.start, 'dd-MMM-yy')} - {format(dateRange.end, 'dd-MMM-yy')}
                        <CalendarIcon className="h-4 w-4 opacity-50" />
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
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">End Date</label>
                          <Calendar
                            mode="single"
                            selected={dateRange.end}
                            onSelect={(date) => date && setDateRange({ ...dateRange, end: date })}
                            disabled={(date) => date < dateRange.start}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {selectedVessels.length > 0 && selectedRanks.length > 0 && (
                <div className="border rounded-lg p-4">
                  <div className="mb-4">
                    <label className="text-sm font-medium">Selected Vessel: </label>
                    <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                      <SelectTrigger className="w-[200px] inline-flex ml-2" data-testid="select-active-vessel-v2">
                        <SelectValue placeholder="Select vessel" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedVessels.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {selectedRanks.map((rank) => (
                      <CrewColumnV2
                        key={rank}
                        rank={rank}
                        onCrewSelect={handleCrewSelect}
                        assignments={assignments}
                      />
                    ))}
                  </div>
                </div>
              )}

              {assignments.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">Planned Assignments ({assignments.length})</h3>
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">
                          <strong>{a.vessel}</strong> - {a.rank}: {a.crewName} ({format(new Date(a.joiningDate), 'dd-MMM-yy')}, {a.contractPeriod}M)
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssignments(assignments.filter(x => x.id !== a.id))}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} data-testid="button-cancel-plan-v2">
              Cancel
            </Button>
            <Button
              onClick={handleSaveDraft}
              disabled={createDraftMutation.isPending || updateDraftMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-save-draft-v2"
            >
              {createDraftMutation.isPending || updateDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DatePeriodDialogV2
        open={datePeriodDialogOpen}
        onOpenChange={setDatePeriodDialogOpen}
        onApply={handleApplyAssignment}
        onUnassign={handleUnassign}
        crewName={selectedCrewForAssignment?.crew.name || ''}
        crewId={selectedCrewForAssignment?.crew.id || ''}
        vesselName={selectedCrewForAssignment?.vessel || ''}
        rank={selectedCrewForAssignment?.rank || ''}
        assignments={assignments}
      />
    </>
  );
}

export default NewPlanDialog_v2;
