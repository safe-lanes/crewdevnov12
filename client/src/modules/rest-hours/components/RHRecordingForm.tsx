import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Lock } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { generateRestHoursPDF } from '@/lib/generateRestHoursPDF';
import { queryClient } from '@/lib/queryClient';
import { restHoursApiV2 } from '../api/restHoursApiV2';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useRankNormalization, addRankAliasesToMap } from '@/hooks/useRankNormalization';
import { useV2Vessels } from '../hooks/useRestHoursV2Data';
import type { RestHoursDailyRecord, FixedTask, VesselDateLineAdjustment, DateLineAdjustmentItem, VariableTask } from '@shared/schema';
import { filterViolations } from '../violationFilters';
import {
  buildTimeline,
  buildPrefixSums,
  calculateMinRestInAny24HourPeriod,
  calculateMinRestInAny7DayPeriod,
  calculateMaxWorkInAny72HourPeriod,
  calculateRestIn24HWorkAnchored,
  detectViolations as detectTimelineViolations,
  groupViolationsByDay,
  groupViolationObjectsByDay,
  prependPreviousMonthTimeline,
  analyzeRestPeriodsWithRanges,
  checkCode4ViolationWithRange,
  calculateMajorityDayFor24HourWindow,
  sortViolationCodes,
  MAJORITY_DAY_ASSIGNMENT,
  TWENTY_FOUR_HOUR_VIOLATION_CODES,
  type DateLineAdjustment,
  type TimelineSlot,
  type Violation as TimelineViolation,
} from '../timelineCalculations';
import type { ExtendedDailyRecord, ViolationDiagnostic } from '../types';
import { createBlankDailyRecord } from '../types';

interface RHRecordingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  rank: string;
  monthValue: string; // Format: "2025-10" (YYYY-MM)
  signOnDate?: string | null;  // YYYY-MM-DD — day the crew joined this month (if applicable)
  signOffDate?: string | null; // YYYY-MM-DD — day the crew departed this month (if applicable)
  isLocked?: boolean;
}

const VIOLATION_CODE_DESCRIPTIONS: Record<string, string> = {
  'A': "Minimum 10 hours of rest in any 24 hour period",
  'C': "Minimum hours of rest in any 7 day period = 77",
  'EF': "Hours of rest may be divided into no more than two periods, one of which shall be at least six hours in length",
  'G': "Interval between rest periods not to exceed 14 hours",
  'B': "ILO Work - Maximum 14 hours of work in any 24 hour period",
  'D': "ILO Work - Maximum 72 hours of work in any 7 day period",
  'I': "OPA - Maximum 15 hours of work in any 24 hour period",
  'H': "OPA - Maximum 36 hours of work in 72 hours",
};

// Helper: Check if a crew member is involved in a variable task
const isCrewMemberInTask = (task: VariableTask, crewMemberId: string): boolean => {
  if (!task.crewInvolvedDetails) return false;
  try {
    const details = JSON.parse(task.crewInvolvedDetails);
    if (details.crew && Array.isArray(details.crew)) {
      return details.crew.some((c: { id: string }) => c.id === crewMemberId);
    }
  } catch {
    return false;
  }
  return false;
};

// Helper: Parse variable task date/time and return day number and half-hour cell indices
// startDateTime format: "01/12/2025 17:00" (DD/MM/YYYY HH:mm)
// Returns: { day: number, startCell: number, endCell: number } for each day the task spans
interface VariableTaskCells {
  day: number;
  startCell: number;
  endCell: number;
}

const parseVariableTaskToCells = (task: VariableTask, monthYear: string): VariableTaskCells[] => {
  const results: VariableTaskCells[] = [];
  
  try {
    const monthMap: Record<string, number> = {
      'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
      'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12,
    };

    const parseDateTime = (dateTimeStr: string): { day: number; month: number; year: number; hour: number; minute: number } | null => {
      const v1Match = dateTimeStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
      if (v1Match) {
        return {
          day: parseInt(v1Match[1], 10),
          month: parseInt(v1Match[2], 10),
          year: parseInt(v1Match[3], 10),
          hour: parseInt(v1Match[4], 10),
          minute: parseInt(v1Match[5], 10),
        };
      }
      const v2Match = dateTimeStr.match(/^(\d{2})-(\w{3})-(\d{4})\s*\/\s*(\d{2}):(\d{2})$/);
      if (v2Match) {
        const monthNum = monthMap[v2Match[2]];
        if (!monthNum) return null;
        return {
          day: parseInt(v2Match[1], 10),
          month: monthNum,
          year: parseInt(v2Match[3], 10),
          hour: parseInt(v2Match[4], 10),
          minute: parseInt(v2Match[5], 10),
        };
      }
      if ((task as any).startDateTimeSort || (task as any).finishDateTimeSort) {
        const sortField = dateTimeStr === task.startDateTime ? (task as any).startDateTimeSort : (task as any).finishDateTimeSort;
        if (sortField) {
          const isoMatch = sortField.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
          if (isoMatch) {
            return {
              day: parseInt(isoMatch[3], 10),
              month: parseInt(isoMatch[2], 10),
              year: parseInt(isoMatch[1], 10),
              hour: parseInt(isoMatch[4], 10),
              minute: parseInt(isoMatch[5], 10),
            };
          }
        }
      }
      return null;
    };
    
    const start = parseDateTime(task.startDateTime);
    const finish = parseDateTime(task.finishDateTime);
    
    if (!start || !finish) return results;
    
    // Extract month/year from the form's monthYear (format: "YYYY-MM")
    const [targetYear, targetMonth] = monthYear.split('-').map(Number);
    
    // Convert time to half-hour cell index (0-47)
    // Cell 0 = 00:00-00:30, Cell 1 = 00:30-01:00, ..., Cell 47 = 23:30-24:00
    const timeToCell = (hour: number, minute: number): number => {
      return hour * 2 + (minute >= 30 ? 1 : 0);
    };
    
    // Create date objects for comparison
    const startDate = new Date(start.year, start.month - 1, start.day);
    const finishDate = new Date(finish.year, finish.month - 1, finish.day);
    const targetMonthStart = new Date(targetYear, targetMonth - 1, 1);
    const targetMonthEnd = new Date(targetYear, targetMonth, 0); // Last day of target month
    
    // Check if task overlaps with target month at all
    if (finishDate < targetMonthStart || startDate > targetMonthEnd) {
      return results; // Task doesn't overlap with target month
    }
    
    // Single day task in target month
    if (start.day === finish.day && start.month === finish.month && start.year === finish.year) {
      if (start.month === targetMonth && start.year === targetYear) {
        const startCell = timeToCell(start.hour, start.minute);
        let endCell = timeToCell(finish.hour, finish.minute);
        if (finish.minute === 0 && endCell > 0) {
          endCell = endCell - 1;
        }
        if (startCell <= endCell) {
          results.push({ day: start.day, startCell, endCell });
        }
      }
      return results;
    }
    
    // Multi-day task - iterate through each day
    let currentDate = new Date(startDate);
    
    while (currentDate <= finishDate) {
      const currentDay = currentDate.getDate();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Only process days in the target month
      if (currentMonth === targetMonth && currentYear === targetYear) {
        const isFirstDay = currentDate.getTime() === startDate.getTime();
        const isLastDay = currentDate.getTime() === finishDate.getTime();
        
        let startCell = 0;
        let endCell = 47;
        
        if (isFirstDay) {
          startCell = timeToCell(start.hour, start.minute);
        }
        
        if (isLastDay) {
          endCell = timeToCell(finish.hour, finish.minute);
          if (finish.minute === 0 && endCell > 0) {
            endCell = endCell - 1;
          }
        }
        
        if (startCell <= endCell && endCell >= 0) {
          results.push({ day: currentDay, startCell, endCell });
        }
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (e) {
    console.error('Failed to parse variable task time range:', e);
  }
  
  return results;
};

// Using ExtendedDailyRecord from shared types
type DailyRecord = ExtendedDailyRecord;

interface DisplayRow {
  baseIndex: number;        // Index into dailyRecords array
  record: DailyRecord;      // Reference to the actual record
  dayLabel: string;         // Day number with marker (e.g., "9" or "9*" or "9**")
  dayOfWeekLabel: string;   // Day of week label
  marker?: 'advanced' | 'retarded';  // Type of adjustment
  occurrence: 'primary' | 'duplicate';  // For retarded days
  isDisabled: boolean;      // True for Advanced days (no input allowed)
}

export const RHRecordingForm = ({
  open,
  onOpenChange,
  crewMemberId: initialCrewMemberId,
  crewMemberName: initialCrewMemberName,
  vesselId: initialVesselId,
  rank: initialRank,
  monthValue: initialMonthValue,
  signOnDate,
  signOffDate,
  isLocked = false,
}: RHRecordingFormProps): JSX.Element => {
  const { toast } = useToast();
  const { userType, myVessels } = usePermissions();
  const isShipUser = userType === 'Ship';
  const { vessels: v2Vessels, getVesselName } = useV2Vessels();
  const { getCanonicalRankName } = useRankNormalization();
  
  const vessels = useMemo(() => v2Vessels.map(v => ({
    id: v.id,
    entryId: v.vesselUuid ?? '',
    name: v.vessel ?? '',
    vesselType: v.vesselType ?? '',
    imoNumber: v.imoNumber ?? '',
  })), [v2Vessels]);
  
  // Dropdown selections state
  const [selectedPeriod, setSelectedPeriod] = useState(initialMonthValue);
  const [selectedVesselId, setSelectedVesselId] = useState(initialVesselId);
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState(initialCrewMemberId);
  
  // Form state
  const [recordMode, setRecordMode] = useState<'Rec' | 'Plan'>('Rec');
  const [showPlanning, setShowPlanning] = useState(true);
  const [complianceMode, setComplianceMode] = useState<'Rest' | 'Work'>('Rest');
  const [opaMode, setOpaMode] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [previousMonthRecords, setPreviousMonthRecords] = useState<DailyRecord[]>([]);
  const [formId, setFormId] = useState<string | null>(null);
  
  // Track if user has made changes that need auto-save
  const [isDirty, setIsDirty] = useState(false);
  
  // Ref to track if template has been applied (prevents re-running on recordMode changes)
  const templateAppliedRef = useRef(false);
  
  // Ref to track last applied violations hash (prevents infinite loop with timeline effect)
  const lastViolationsHashRef = useRef<string>('');
  
  // Violation highlighting state
  const [hoveredViolation, setHoveredViolation] = useState<{ dayIndex: number; code: string } | null>(null);
  
  // Calculate previous month period string
  const previousMonthPeriod = useMemo(() => {
    if (!selectedPeriod) return null;
    const [year, month] = selectedPeriod.split('-').map(Number);
    const date = new Date(year, month - 1, 1); // Current month
    date.setMonth(date.getMonth() - 1); // Go back 1 month
    const prevYear = date.getFullYear();
    const prevMonth = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  }, [selectedPeriod]);
  
  // Fetch crew members from V2 API (crew_members_v2 table)
  const { data: allCrewMembers = [] } = useQuery<any[]>({
    queryKey: ['v2', 'rest-hours', 'masters', 'crew-members'],
    queryFn: () => restHoursApiV2.masters.getCrewMembers(),
    enabled: open,
  });
  
  // Generate period options (last 12 months)
  const periodOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const value = `${year}-${month}`;
      const monthName = date.toLocaleString('en-US', { month: 'short' });
      const label = `${year}, ${monthName}`;
      options.push({ value, label });
    }
    
    return options;
  }, []);
  
  const { data: availableRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/v2/admin/available-ranks'],
    enabled: open,
  });

  const { data: vesselRanks = [] } = useQuery<any[]>({
    queryKey: ['/api/v2/admin/vessel-revisions/ranks', selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return [];
      const res = await fetch(`/api/v2/admin/vessel-revisions/ranks/${selectedVesselId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!selectedVesselId,
  });

  const rankOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    availableRanks.forEach((rank: any) => {
      addRankAliasesToMap(map, rank.name, rank.sortOrder || 0);
    });
    vesselRanks.forEach((rank: any) => {
      const sortOrder = rank.sortOrder;
      if (sortOrder === undefined) return;
      if (rank.rank) {
        addRankAliasesToMap(map, rank.rank, sortOrder);
      }
      if (rank.role && rank.role !== rank.rank) {
        map.set(rank.role, sortOrder);
      }
      if (rank.role && rank.role.includes('_')) {
        const baseRank = rank.role.split('_')[0];
        if (!map.has(baseRank)) {
          map.set(baseRank, sortOrder);
        }
      }
    });
    return map;
  }, [availableRanks, vesselRanks]);

  const getRankSortOrder = useCallback((rankName: string | null | undefined): number => {
    if (!rankName) return 999999;
    const exact = rankOrderMap.get(rankName);
    if (exact !== undefined) return exact;
    const baseRank = rankName.split('_')[0];
    const base = rankOrderMap.get(baseRank);
    if (base !== undefined) return base;
    const canonical = getCanonicalRankName(rankName);
    const canonicalOrder = rankOrderMap.get(canonical);
    if (canonicalOrder !== undefined) return canonicalOrder;
    return 999999;
  }, [rankOrderMap, getCanonicalRankName]);

  const filteredCrewMembers = useMemo(() => {
    const filtered = selectedVesselId
      ? allCrewMembers.filter((cm: any) => cm.presentVessel === selectedVesselId)
      : allCrewMembers;
    return [...filtered].sort((a: any, b: any) => {
      const aOrder = getRankSortOrder(a.presentRank);
      const bOrder = getRankSortOrder(b.presentRank);
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aSuffix = a.presentRank?.includes('_') ? parseInt(a.presentRank.split('_')[1]) || 0 : 0;
      const bSuffix = b.presentRank?.includes('_') ? parseInt(b.presentRank.split('_')[1]) || 0 : 0;
      return aSuffix - bSuffix;
    });
  }, [allCrewMembers, selectedVesselId, getRankSortOrder]);
  
  // Get selected crew member details (match by empNo/crewMemberId which is A-format like A000042)
  const selectedCrewMember = useMemo(() => {
    return filteredCrewMembers.find((cm: any) => cm.crewMemberId === selectedCrewMemberId || cm.empNo === selectedCrewMemberId);
  }, [filteredCrewMembers, selectedCrewMemberId]);
  
  // Derived values from selections
  const crewMemberName = selectedCrewMember?.firstName + (selectedCrewMember?.middleName ? ' ' + selectedCrewMember.middleName : '') + ' ' + selectedCrewMember?.familyName || initialCrewMemberName;
  const rank = selectedCrewMember?.presentRank || initialRank;
  const vesselName = getVesselName(selectedVesselId);

  // Format month for display (e.g., "2024, Mar")
  const monthDisplay = useMemo(() => {
    if (!selectedPeriod) return '';
    const [year, month] = selectedPeriod.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleString('en-US', { month: 'short' });
    return `${year}, ${monthName}`;
  }, [selectedPeriod]);
  
  // Update selections when initial props change (when modal opens with new values)
  useEffect(() => {
    if (open) {
      setSelectedPeriod(initialMonthValue);
      if (!isShipUser) {
        setSelectedVesselId(initialVesselId);
      }
      setSelectedCrewMemberId(initialCrewMemberId);
    }
  }, [open, initialMonthValue, initialVesselId, initialCrewMemberId, isShipUser]);

  useEffect(() => {
    if (isShipUser && open && myVessels.length > 0 && vessels.length > 0) {
      const myVesselName = myVessels[0].vessel;
      const matched = vessels.find(v => v.name === myVesselName);
      if (matched?.entryId) {
        setSelectedVesselId(matched.entryId);
        const crewOnVessel = allCrewMembers.filter((cm: any) => cm.presentVessel === matched.entryId);
        if (crewOnVessel.length > 0) {
          const sorted = [...crewOnVessel].sort((a: any, b: any) => {
            const aOrder = getRankSortOrder(a.presentRank);
            const bOrder = getRankSortOrder(b.presentRank);
            if (aOrder !== bOrder) return aOrder - bOrder;
            const aSuffix = a.presentRank?.includes('_') ? parseInt(a.presentRank.split('_')[1]) || 0 : 0;
            const bSuffix = b.presentRank?.includes('_') ? parseInt(b.presentRank.split('_')[1]) || 0 : 0;
            return aSuffix - bSuffix;
          });
          setSelectedCrewMemberId(sorted[0].crewMemberId || sorted[0].empNo);
        }
      }
    }
  }, [isShipUser, open, myVessels, vessels, allCrewMembers, getRankSortOrder]);

  useEffect(() => {
    if (!open || filteredCrewMembers.length === 0) return;
    const isValid = filteredCrewMembers.some((cm: any) => cm.crewMemberId === selectedCrewMemberId || cm.empNo === selectedCrewMemberId);
    if (!isValid) {
      setSelectedCrewMemberId(filteredCrewMembers[0].crewMemberId || filteredCrewMembers[0].empNo);
    }
  }, [open, filteredCrewMembers, selectedCrewMemberId]);
  

  // Auto-check "Show Planning" when switching to Plan mode
  useEffect(() => {
    if (recordMode === 'Plan') {
      setShowPlanning(true);
    }
  }, [recordMode]);

  // Initialize daily records for the month - reset when crew/vessel/month changes or modal opens
  useEffect(() => {
    if (!selectedPeriod || !open) return;
    
    // Reset all form state to clean slate
    setFormId(null);
    setRecordMode('Rec');
    setShowPlanning(true);
    setOpaMode(false);
    setIsDirty(false); // Reset dirty flag on form initialization
    
    // Reset template applied flag so template can be re-applied for new crew/vessel/month
    templateAppliedRef.current = false;
    
    // Reset violations hash so violations can be re-applied for new crew/vessel/month
    lastViolationsHashRef.current = '';
    
    const [year, month] = selectedPeriod.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const records: DailyRecord[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(parseInt(year), parseInt(month) - 1, day);
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
      
      records.push(createBlankDailyRecord(day, dayOfWeek, 'primary'));
    }
    
    setDailyRecords(records);
  }, [selectedPeriod, selectedCrewMemberId, selectedVesselId, open]);

  // Fetch existing record if available
  // V1 pattern: /api/rest-hours-daily-records/by-key/:crewMemberId/:vesselId/:monthYear
  const { data: existingRecord, isError } = useQuery<RestHoursDailyRecord>({
    queryKey: ['v2', 'rest-hours', 'daily-records', 'by-key', selectedCrewMemberId, selectedVesselId, selectedPeriod],
    queryFn: async () => {
      try {
        return await restHoursApiV2.dailyRecords.getByKey(selectedCrewMemberId, selectedVesselId, selectedPeriod);
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null; // No existing record found
        }
        throw error;
      }
    },
    enabled: open && !!selectedCrewMemberId && !!selectedVesselId && !!selectedPeriod,
    retry: false,
    gcTime: 0, // Don't cache - each crew's data must be fresh to prevent data leakage
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch previous month's record for cross-month rolling window calculations
  // V1 pattern: /api/rest-hours-daily-records/by-key/:crewMemberId/:vesselId/:monthYear
  const { data: previousMonthRecord } = useQuery<RestHoursDailyRecord>({
    queryKey: ['v2', 'rest-hours', 'daily-records', 'by-key', selectedCrewMemberId, selectedVesselId, previousMonthPeriod],
    queryFn: async () => {
      if (!previousMonthPeriod) return null;
      try {
        return await restHoursApiV2.dailyRecords.getByKey(selectedCrewMemberId, selectedVesselId, previousMonthPeriod);
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null; // No previous month record found
        }
        throw error;
      }
    },
    enabled: open && !!selectedCrewMemberId && !!selectedVesselId && !!previousMonthPeriod,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

  // Fetch fixed tasks for this crew member to auto-populate plan data
  // API order: crewMemberId, vesselId, monthYear (matches backend route)
  const { data: fixedTask } = useQuery<FixedTask>({
    queryKey: ['v2', 'rest-hours', 'fixed-tasks', 'by-key', selectedCrewMemberId, selectedVesselId, selectedPeriod],
    queryFn: async () => {
      try {
        return await restHoursApiV2.fixedTasks.getByKey(selectedCrewMemberId, selectedVesselId, selectedPeriod);
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null; // No fixed tasks found
        }
        throw error;
      }
    },
    enabled: open && !!selectedCrewMemberId && !!selectedVesselId && !!selectedPeriod,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

  // Fetch variable tasks for the vessel/period to overlay onto crew records
  const { data: variableTasks = [] } = useQuery<VariableTask[]>({
    queryKey: ['v2', 'rest-hours', 'variable-tasks', selectedVesselId, selectedPeriod],
    queryFn: async () => {
      if (!selectedVesselId || !selectedPeriod) return [];
      return await restHoursApiV2.variableTasks.getAll({ vesselUuid: selectedVesselId, date: selectedPeriod });
    },
    enabled: open && !!selectedVesselId && !!selectedPeriod,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

  // Filter variable tasks to only those involving the selected crew member
  const crewVariableTasks = useMemo(() => {
    if (!selectedCrewMemberId || !variableTasks.length) return [];
    return variableTasks.filter(task => isCrewMemberInTask(task, selectedCrewMemberId));
  }, [variableTasks, selectedCrewMemberId]);

  // Fetch date line adjustments for the selected vessel and month
  // V1 pattern: /api/vessel-dateline-adjustments/:vesselId/:monthValue
  const { data: dateLineAdjustment } = useQuery<VesselDateLineAdjustment | null>({
    queryKey: ['v2', 'rest-hours', 'dateline-adjustments', selectedVesselId, selectedPeriod],
    queryFn: async () => {
      if (!selectedVesselId || !selectedPeriod) return null;
      try {
        const adjustments = await restHoursApiV2.datelineAdjustments.getAll({ vesselId: selectedVesselId, monthValue: selectedPeriod });
        // Filter for the specific period
        const periodAdjustment = adjustments.find((a: any) => a.monthYear === selectedPeriod || a.period === selectedPeriod);
        return periodAdjustment || null;
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null;
        }
        throw error;
      }
    },
    enabled: open && !!selectedVesselId && !!selectedPeriod,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

  // Fetch previous month's date line adjustments for cross-month rolling windows
  // V1 pattern: /api/vessel-dateline-adjustments/:vesselId/:monthValue
  const { data: previousMonthDateLineAdjustment } = useQuery<VesselDateLineAdjustment | null>({
    queryKey: ['v2', 'rest-hours', 'dateline-adjustments', selectedVesselId, previousMonthPeriod],
    queryFn: async () => {
      if (!selectedVesselId || !previousMonthPeriod) return null;
      try {
        const adjustments = await restHoursApiV2.datelineAdjustments.getAll({ vesselId: selectedVesselId, monthValue: previousMonthPeriod });
        // Filter for the specific period
        const periodAdjustment = adjustments.find((a: any) => a.monthYear === previousMonthPeriod || a.period === previousMonthPeriod);
        return periodAdjustment || null;
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('not found')) {
          return null;
        }
        throw error;
      }
    },
    enabled: open && !!selectedVesselId && !!previousMonthPeriod,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

  // Parse date line adjustments into format for timeline calculations
  const parsedDateLineAdjustments = useMemo((): DateLineAdjustment[] => {
    if (!dateLineAdjustment) return [];
    try {
      const adjustments = JSON.parse(dateLineAdjustment.adjustments) as DateLineAdjustmentItem[];
      if (Array.isArray(adjustments)) {
        return adjustments.map(adj => ({
          day: adj.day,
          type: adj.type,
        }));
      }
    } catch (e) {
      console.error('Failed to parse date line adjustments:', e);
    }
    return [];
  }, [dateLineAdjustment]);

  // Parse previous month's date line adjustments for cross-month rolling windows
  const parsedPreviousMonthDateLineAdjustments = useMemo((): DateLineAdjustment[] => {
    if (!previousMonthDateLineAdjustment) return [];
    try {
      const adjustments = JSON.parse(previousMonthDateLineAdjustment.adjustments) as DateLineAdjustmentItem[];
      if (Array.isArray(adjustments)) {
        return adjustments.map(adj => ({
          day: adj.day,
          type: adj.type,
        }));
      }
    } catch (e) {
      console.error('Failed to parse previous month date line adjustments:', e);
    }
    return [];
  }, [previousMonthDateLineAdjustment]);

  // Apply retarded day logic to initialized records when adjustments are loaded (for new forms)
  // Use ref to track if we've already applied this logic to prevent infinite loops
  const retardedDaysAppliedRef = useRef(false);
  const lastAdjustmentsHashRef = useRef<string>('');
  
  useEffect(() => {
    if (!open || existingRecord) {
      retardedDaysAppliedRef.current = false;
      lastAdjustmentsHashRef.current = '';
      return;
    }
    
    if (dailyRecords.length === 0 || parsedDateLineAdjustments.length === 0) return;
    
    // Create a hash of adjustments to detect when they change
    const adjustmentsHash = JSON.stringify(parsedDateLineAdjustments.map(a => `${a.day}-${a.type}`));
    
    // Reset the applied flag if adjustments have changed
    if (lastAdjustmentsHashRef.current !== adjustmentsHash) {
      retardedDaysAppliedRef.current = false;
      lastAdjustmentsHashRef.current = adjustmentsHash;
    }
    
    // Check if we need to add duplicate records for retarded days
    const retardedDays = parsedDateLineAdjustments
      .filter(adj => adj.type === 'retarded')
      .map(adj => adj.day);
    
    if (retardedDays.length === 0) {
      retardedDaysAppliedRef.current = true;
      return;
    }
    
    // Check if any retarded day is missing its duplicate record
    const needsUpdate = retardedDays.some(day => {
      const duplicateExists = dailyRecords.some(
        r => r.day === day && r.occurrence === 'duplicate'
      );
      return !duplicateExists;
    });
    
    // If duplicates are missing, reset the flag and apply the logic
    // This handles cases like handleClear() where records are reset but adjustments remain
    if (needsUpdate) {
      retardedDaysAppliedRef.current = false;
    }
    
    // Skip if already applied AND no update needed
    if (retardedDaysAppliedRef.current) return;
    
    // Apply the logic if needed
    if (needsUpdate) {
      const updatedRecords = ensureRetardedDayRecords(dailyRecords, parsedDateLineAdjustments);
      setDailyRecords(updatedRecords);
    }
    
    retardedDaysAppliedRef.current = true;
  }, [parsedDateLineAdjustments, open, existingRecord, dailyRecords]);

  // Helper function: Ensure retarded days have TWO separate records
  const ensureRetardedDayRecords = (
    records: DailyRecord[],
    adjustments: DateLineAdjustment[]
  ): DailyRecord[] => {
    if (adjustments.length === 0) return records;
    
    const retardedDays = new Set(
      adjustments.filter(adj => adj.type === 'retarded').map(adj => adj.day)
    );
    
    if (retardedDays.size === 0) return records;
    
    const result: DailyRecord[] = [];
    
    for (const record of records) {
      // Always add the primary record (normalize if needed)
      const primaryRecord = {
        ...record,
        entryId: record.entryId || `day-${record.day}-primary`,
        occurrence: (record.occurrence || 'primary') as 'primary' | 'duplicate',
      };
      result.push(primaryRecord);
      
      // If this is a retarded day, check if we need to add a duplicate record
      if (retardedDays.has(record.day)) {
        // Check if duplicate already exists in the input records
        const existingDuplicate = records.find(
          r => r.day === record.day && r.occurrence === 'duplicate'
        );
        
        if (!existingDuplicate) {
          // Create a new blank duplicate record
          const duplicateRecord = createBlankDailyRecord(record.day, record.dayOfWeek, 'duplicate');
          result.push(duplicateRecord);
        }
        // If duplicate exists, it will be added in its own iteration
      }
    }
    
    return result;
  };

  // Load previous month's records for cross-month calculations
  useEffect(() => {
    if (!open) return;
    
    if (!previousMonthRecord) {
      // Don't set to empty array yet - wait for query to complete
      return;
    }
    
    try {
      const parsedRecords = JSON.parse(previousMonthRecord.dailyRecords);
      setPreviousMonthRecords(parsedRecords);
    } catch (error) {
      console.error('Failed to parse previous month records:', error);
      setPreviousMonthRecords([]);
    }
  }, [previousMonthRecord, open]);

  // Compute variable task cells map for overlay onto daily records
  // Note: This is computed as a derived value rather than an effect to avoid infinite loops
  const variableTaskCellsMap = useMemo(() => {
    if (!selectedPeriod || crewVariableTasks.length === 0) return new Map<number, VariableTaskCells[]>();
    
    const cellsMap = new Map<number, VariableTaskCells[]>();
    for (const task of crewVariableTasks) {
      const cells = parseVariableTaskToCells(task, selectedPeriod);
      for (const cell of cells) {
        const existing = cellsMap.get(cell.day) || [];
        existing.push(cell);
        cellsMap.set(cell.day, existing);
      }
    }
    return cellsMap;
  }, [crewVariableTasks, selectedPeriod]);

  // Apply fixed tasks template and variable tasks overlay to daily records when available (for new forms)
  // Note: isPlan is set to true (Plan mode) since new records default to planning mode
  useEffect(() => {
    if (!open || existingRecord) return;
    
    // Only apply if we have fixed task template or variable tasks
    const hasFixedTask = fixedTask && Array.isArray(fixedTask.seaHours) && fixedTask.seaHours.length === 48;
    const hasVariableTasks = variableTaskCellsMap.size > 0;
    
    if (!hasFixedTask && !hasVariableTasks) return;
    
    // Use seaHours as the template (assuming vessel is at sea by default)
    const seaHoursArray = Array.isArray(fixedTask?.seaHours) ? (fixedTask.seaHours as string[]) : [];
    const template: string[] = hasFixedTask ? seaHoursArray.slice() : Array(48).fill('');
    
    setDailyRecords(prevRecords => {
      return prevRecords.map(record => {
        const newHours = [...template];
        
        const dayCells = variableTaskCellsMap.get(record.day);
        if (dayCells && dayCells.length > 0) {
          for (const cellRange of dayCells) {
            for (let i = cellRange.startCell; i <= cellRange.endCell && i < 48; i++) {
              newHours[i] = 'a';
            }
          }
        }
        
        const restHours = newHours.filter(h => h === '').length / 2;
        const workHours = 24 - restHours;
        return {
          ...record,
          hours: newHours,
          isPlan: true,
          hoursOfRest24hr: restHours,
          hoursOfWork24hr: workHours,
        };
      });
    });
  }, [fixedTask, open, existingRecord, variableTaskCellsMap]);

  // Load existing record data or explicitly maintain clean state
  useEffect(() => {
    if (!open) return; // Skip if modal is closed
    
    if (existingRecord) {
      // Existing record found - load it
      setFormId((existingRecord as any).rhDailyUuid || (existingRecord as any).rh_daily_uuid);
      setShowPlanning(true); // Always show planning by default
      setOpaMode(existingRecord.opaMode || false);
      
      lastViolationsHashRef.current = '';
      
      try {
        const parsedRecords = JSON.parse(existingRecord.dailyRecords);
        
        const hasLatestFixedTask = fixedTask && Array.isArray(fixedTask.seaHours) && fixedTask.seaHours.length === 48;
        const latestTemplate: string[] = hasLatestFixedTask ? (fixedTask.seaHours as unknown as string[]).slice() : [];
        
        const updatedRecords = parsedRecords.map((record: DailyRecord) => {
          let hours = record.hours;
          
          if (record.isPlan) {
            if (hasLatestFixedTask) {
              hours = [...latestTemplate];
            }
            
            const dayCells = variableTaskCellsMap.get(record.day);
            if (dayCells && dayCells.length > 0) {
              if (!hours || hours.length === 0) {
                hours = Array(48).fill('');
              } else {
                hours = [...hours];
              }
              for (const cellRange of dayCells) {
                for (let i = cellRange.startCell; i <= cellRange.endCell && i < 48; i++) {
                  hours[i] = 'a';
                }
              }
            }
          }
          
          const restHours = hours ? hours.filter((h: string) => h === '').length / 2 : 24;
          const workHours = 24 - restHours;
          
          return {
            ...record,
            hours,
            entryId: record.entryId || `day-${record.day}-primary`,
            occurrence: (record.occurrence || 'primary') as 'primary' | 'duplicate',
            hoursOfRest24hr: restHours,
            hoursOfWork24hr: workHours,
            anyPeriodRest24hr: 24,
            anyPeriodRest7day: 168,
            anyPeriodWork24hr: 0,
            anyPeriodWork7day: 0,
            violations: [],
            violationDiagnostics: [],
          };
        });
        
        const recordsWithRetarded = ensureRetardedDayRecords(updatedRecords, parsedDateLineAdjustments);
        setDailyRecords(recordsWithRetarded);
      } catch (error) {
        console.error('Failed to parse daily records:', error);
      }
    } else if (isError || existingRecord === undefined) {
      console.log('No existing record found - using clean initialized state');
    }
  }, [existingRecord, isError, open, parsedDateLineAdjustments, fixedTask, variableTaskCellsMap]);

  // Helper function to compute violatingRanges for hover highlighting
  const computeViolatingRanges = (
    violation: TimelineViolation,
    timeline: TimelineSlot[],
    codeNum: number
  ): Array<{ startCell: number; endCell: number; startDay: number }> => {
    let slotsToHighlight: TimelineSlot[] = [];
    
    // Determine which slots based on violation code
    switch (codeNum) {
      case 1: // Min 10h rest in 24h
      case 5: // Max 14h work in 24h
      case 7: // OPA Max 15h work in 24h
        const start24 = Math.max(0, violation.slotIndex - 47);
        slotsToHighlight = timeline.slice(start24, violation.slotIndex + 1);
        break;
        
      case 2: // Min 77h rest in 168h
      case 6: // Max 72h work in 168h
        const start168 = Math.max(0, violation.slotIndex - 335);
        slotsToHighlight = timeline.slice(start168, violation.slotIndex + 1);
        break;
        
      case 8: // OPA Max 36h work in 72h
        const start72 = Math.max(0, violation.slotIndex - 143);
        slotsToHighlight = timeline.slice(start72, violation.slotIndex + 1);
        break;
        
      case 3: // Rest period distribution
        // Highlight the complete 24-hour rolling window (same as Code 1)
        const start24Code3 = Math.max(0, violation.slotIndex - 47);
        slotsToHighlight = timeline.slice(start24Code3, violation.slotIndex + 1);
        break;
        
      case 4: // Work gap >14h - show full 24-hour window like codes 1 and 3
        const start24Code4 = Math.max(0, violation.slotIndex - 47);
        slotsToHighlight = timeline.slice(start24Code4, violation.slotIndex + 1);
        break;
    }
    
    // Group slots by day and convert to ranges
    // Filter to only current month (days >= 1) since previous-month days aren't rendered
    const dayRanges = new Map<number, { minCell: number; maxCell: number }>();
    
    for (const slot of slotsToHighlight) {
      // Skip previous month slots - they're not visible in current month view
      if (slot.sourceDay < 1) continue;
      
      const existing = dayRanges.get(slot.sourceDay);
      if (!existing) {
        dayRanges.set(slot.sourceDay, {
          minCell: slot.halfHourIndex,
          maxCell: slot.halfHourIndex
        });
      } else {
        existing.minCell = Math.min(existing.minCell, slot.halfHourIndex);
        existing.maxCell = Math.max(existing.maxCell, slot.halfHourIndex);
      }
    }
    
    // Convert map to array format
    const result: Array<{ startCell: number; endCell: number; startDay: number }> = [];
    Array.from(dayRanges.entries()).forEach(([day, range]) => {
      result.push({
        startDay: day,
        startCell: range.minCell,
        endCell: range.maxCell
      });
    });
    
    return result;
  };

  // Timeline-based violation detection using rolling windows
  // This memoization builds the timeline ONCE and calculates all violations efficiently
  const timelineData = useMemo(() => {
    const emptyResult = {
      violationMap: new Map<number, { violations: string[]; diagnostics: ViolationDiagnostic[]; metrics: any }>(),
      timeline: [] as TimelineSlot[],
      violations: [] as TimelineViolation[],
    };
    
    if (dailyRecords.length === 0) return emptyResult;
    
    // Convert DailyRecord[] to the format expected by timelineCalculations
    const timelineRecords = dailyRecords.map(r => ({
      entryId: r.entryId,
      day: r.day,
      dayOfWeek: r.dayOfWeek,
      occurrence: r.occurrence,
      hours: r.hours,
      isPlan: r.isPlan,
      comments: r.comments,
      violations: [],
    }));
    
    const prevMonthTimelineRecords = previousMonthRecords.map(r => ({
      entryId: r.entryId,
      day: r.day,
      dayOfWeek: r.dayOfWeek,
      occurrence: r.occurrence,
      hours: r.hours,
      isPlan: r.isPlan,
      comments: r.comments,
      violations: [],
    }));
    
    // Build timeline for current month
    const currentTimeline = buildTimeline(timelineRecords, parsedDateLineAdjustments);
    
    // Prepend previous month data for cross-month windows (need 168 hours = 336 half-hour slots)
    const fullTimeline = prevMonthTimelineRecords.length > 0
      ? prependPreviousMonthTimeline(currentTimeline, prevMonthTimelineRecords, parsedPreviousMonthDateLineAdjustments, 336)
      : currentTimeline;
    
    // Build prefix sums for efficient window calculations
    const { cumulativeRest, cumulativeWork } = buildPrefixSums(fullTimeline);
    
    // Detect violations across entire timeline
    const allViolations = detectTimelineViolations(
      fullTimeline,
      cumulativeRest,
      cumulativeWork,
      complianceMode,
      opaMode
    );
    
    // Group violations by source day (for violation codes)
    const violationsByDay = groupViolationsByDay(allViolations);
    
    // Group violations with objects (for diagnostics with proper majorityDay)
    const violationObjectsByDay = groupViolationObjectsByDay(allViolations);
    
    // Build result map with violations and metrics for each day
    const resultMap = new Map<number, { violations: string[]; diagnostics: ViolationDiagnostic[]; metrics: any }>();

    // Pre-build a map of dayIndex → array indices in fullTimeline (primary occurrence only).
    // Skip prepended previous-month slots (slotIndex < 0) to avoid sourceDay collisions
    // (e.g., Nov Day 30 matching Dec Day 30 by day number). The work-anchored window
    // still looks back into prepended data correctly via prefix sums.
    const dayIndexToArrayIndices = new Map<number, number[]>();
    for (let i = 0; i < fullTimeline.length; i++) {
      const slot = fullTimeline[i];
      if (slot.occurrence !== 'primary') continue;
      if (slot.slotIndex < 0) continue;
      const dIdx = dailyRecords.findIndex(r => r.day === slot.sourceDay);
      if (dIdx === -1) continue;
      if (!dayIndexToArrayIndices.has(dIdx)) dayIndexToArrayIndices.set(dIdx, []);
      dayIndexToArrayIndices.get(dIdx)!.push(i);
    }
    
    for (let dayIndex = 0; dayIndex < dailyRecords.length; dayIndex++) {
      const record = dailyRecords[dayIndex];
      
      // All violation codes are now re-derived from per-day metrics below
      const violationNumbers: string[] = [];
      const diagnostics: ViolationDiagnostic[] = [];
      
      // Calculate metrics from timeline for this day
      const dayArrayIndices: number[] = dayIndexToArrayIndices.get(dayIndex) || [];
      const lastArrayIndex = dayArrayIndices.length > 0 ? dayArrayIndices[dayArrayIndices.length - 1] : -1;

      let metrics = {
        anyPeriodRest24hr: 24,
        anyPeriodRest7day: 168,
        anyPeriodWork24hr: 0,
        anyPeriodWork7day: 0,
      };
      
      let worstWindowEndSlot: number | null = null;
      
      if (lastArrayIndex >= 47) {
        const anchored = calculateRestIn24HWorkAnchored(
          dayArrayIndices,
          dayArrayIndices,
          fullTimeline,
          cumulativeWork,
          cumulativeRest
        );

        const rest7day = calculateMinRestInAny7DayPeriod(dayArrayIndices, cumulativeRest);
        
        metrics = {
          anyPeriodRest24hr: anchored.rest,
          anyPeriodRest7day: rest7day,
          anyPeriodWork24hr: 24 - anchored.rest,
          anyPeriodWork7day: 168 - rest7day,
        };
        worstWindowEndSlot = anchored.worstWindowEndSlot;
      }

      // Helper: build highlighting ranges from the worst-case 24h window
      const buildViolatingRanges = (): Array<{ startCell: number; endCell: number; startDay: number }> => {
        if (worstWindowEndSlot === null) return [];
        const winStart = Math.max(0, worstWindowEndSlot - 47);
        const slotsInWindow = fullTimeline.slice(winStart, worstWindowEndSlot + 1);
        const dayRanges = new Map<number, { minCell: number; maxCell: number }>();
        for (const slot of slotsInWindow) {
          if (slot.sourceDay < 1) continue;
          const existing = dayRanges.get(slot.sourceDay);
          if (!existing) {
            dayRanges.set(slot.sourceDay, { minCell: slot.halfHourIndex, maxCell: slot.halfHourIndex });
          } else {
            existing.minCell = Math.min(existing.minCell, slot.halfHourIndex);
            existing.maxCell = Math.max(existing.maxCell, slot.halfHourIndex);
          }
        }
        return Array.from(dayRanges.entries()).map(([day, range]) => ({
          startDay: day,
          startCell: range.minCell,
          endCell: range.maxCell,
        }));
      };

      // Derive Violation A (Rest mode: min 10h rest in 24h) from the work-anchored metric
      if (metrics.anyPeriodRest24hr < 10) {
        violationNumbers.push('A');
        diagnostics.push({
          code: 'A',
          windowStart: 'Timeline window',
          reason: `Minimum 10 hours rest in 24-hour period: ${metrics.anyPeriodRest24hr.toFixed(1)}h (< 10h required)`,
          violatingRanges: buildViolatingRanges(),
          majorityDay: record.day,
        });
      }

      // Derive Violation B (Work mode: max 14h work in 24h) from the same work-anchored metric
      if (metrics.anyPeriodWork24hr > 14) {
        violationNumbers.push('B');
        diagnostics.push({
          code: 'B',
          windowStart: 'Timeline window',
          reason: `Maximum 14 hours work in 24-hour period: ${metrics.anyPeriodWork24hr.toFixed(1)}h (> 14h limit)`,
          violatingRanges: buildViolatingRanges(),
          majorityDay: record.day,
        });
      }

      // Derive Violation 3 from the same work-anchored window as Violation 1
      // Only when Violation 1 is present (rest < 10h), check rest period structure
      if (metrics.anyPeriodRest24hr < 10 && worstWindowEndSlot !== null) {
        const windowStartSlot = Math.max(0, worstWindowEndSlot - 47);
        const { lengths: restPeriods } = analyzeRestPeriodsWithRanges(fullTimeline, worstWindowEndSlot);
        const sorted = [...restPeriods].sort((a, b) => b - a);
        const largest = sorted[0] || 0;
        const secondLargest = sorted[1] || 0;
        const largestHours = largest * 0.5;
        const totalHours = (largest + secondLargest) * 0.5;

        if (largestHours < 6 || totalHours < 10) {
          violationNumbers.push('EF');
          const numPeriods = restPeriods.length;
          const allPeriodsHours = sorted.map(p => (p * 0.5).toFixed(1)).join('h, ') + 'h';
          let reason = '';
          if (numPeriods === 0) {
            reason = `No rest periods found in worst 24h window`;
          } else if (numPeriods === 1) {
            reason = `1 rest period: ${largestHours.toFixed(1)}h (need ≥6h and ≥10h total for single period)`;
          } else {
            reason = `${numPeriods} rest periods: ${allPeriodsHours}. Top 2: ${largestHours.toFixed(1)}h + ${(secondLargest * 0.5).toFixed(1)}h = ${totalHours.toFixed(1)}h (need ≥6h longest, ≥10h total)`;
          }
          diagnostics.push({
            code: 'EF',
            windowStart: 'Timeline window',
            reason,
            violatingRanges: buildViolatingRanges(),
            majorityDay: record.day,
          });
        }
      }

      // Derive Violation C (Rest mode: min 77h rest in 7 days) from the rolling 7-day metric
      if (metrics.anyPeriodRest7day < 77) {
        violationNumbers.push('C');
        diagnostics.push({
          code: 'C',
          windowStart: 'Timeline window',
          reason: `Minimum 77 hours rest in 7-day period: ${metrics.anyPeriodRest7day.toFixed(1)}h (< 77h required)`,
          violatingRanges: [],
          majorityDay: record.day,
        });
      }

      // Derive Violation G (Work interval > 14h between rest periods) from the work-anchored window
      if (worstWindowEndSlot !== null) {
        const code4Result = checkCode4ViolationWithRange(fullTimeline, worstWindowEndSlot);
        if (code4Result.hasViolation) {
          violationNumbers.push('G');
          let code4Ranges: Array<{ startCell: number; endCell: number; startDay: number }> = [];
          if (code4Result.violatingRange) {
            const gapSlots = fullTimeline.slice(code4Result.violatingRange.startSlot, code4Result.violatingRange.endSlot + 1);
            const gapDayRanges = new Map<number, { minCell: number; maxCell: number }>();
            for (const slot of gapSlots) {
              if (slot.sourceDay < 1) continue;
              const existing = gapDayRanges.get(slot.sourceDay);
              if (!existing) {
                gapDayRanges.set(slot.sourceDay, { minCell: slot.halfHourIndex, maxCell: slot.halfHourIndex });
              } else {
                existing.minCell = Math.min(existing.minCell, slot.halfHourIndex);
                existing.maxCell = Math.max(existing.maxCell, slot.halfHourIndex);
              }
            }
            code4Ranges = Array.from(gapDayRanges.entries()).map(([day, range]) => ({
              startDay: day,
              startCell: range.minCell,
              endCell: range.maxCell,
            }));
          }
          const gapHours = code4Result.violatingRange
            ? ((code4Result.violatingRange.endSlot - code4Result.violatingRange.startSlot + 1) * 0.5).toFixed(1)
            : '?';
          diagnostics.push({
            code: 'G',
            windowStart: 'Timeline window',
            reason: `Work interval between rest periods exceeds 14 hours: ${gapHours}h continuous work`,
            violatingRanges: code4Ranges,
            majorityDay: record.day,
          });
        }
      }

      // Derive Violation D (Work mode: max 72h work in 7 days) from the rolling 7-day metric
      if (metrics.anyPeriodWork7day > 72) {
        violationNumbers.push('D');
        diagnostics.push({
          code: 'D',
          windowStart: 'Timeline window',
          reason: `Maximum 72 hours work in 7-day period: ${metrics.anyPeriodWork7day.toFixed(1)}h (> 72h limit)`,
          violatingRanges: [],
          majorityDay: record.day,
        });
      }

      // Derive Violation I (OPA: max 15h work in 24h) from the work-anchored metric
      if (opaMode && metrics.anyPeriodWork24hr > 15) {
        violationNumbers.push('I');
        diagnostics.push({
          code: 'I',
          windowStart: 'Timeline window',
          reason: `OPA 90: Maximum 15 hours work in 24-hour period: ${metrics.anyPeriodWork24hr.toFixed(1)}h (> 15h limit)`,
          violatingRanges: buildViolatingRanges(),
          majorityDay: record.day,
        });
      }

      // Derive Violation H (OPA: max 36h work in 72h) from rolling 72-hour metric
      if (opaMode) {
        const work72h = calculateMaxWorkInAny72HourPeriod(dayArrayIndices, cumulativeWork);
        if (work72h > 36) {
          violationNumbers.push('H');
          diagnostics.push({
            code: 'H',
            windowStart: 'Timeline window',
            reason: `OPA 90: Maximum 36 hours work in 72-hour period: ${work72h.toFixed(1)}h (> 36h limit)`,
            violatingRanges: [],
            majorityDay: record.day,
          });
        }
      }

      // Sort violation codes for consistent display
      const sortedViolations = sortViolationCodes(violationNumbers);
      
      resultMap.set(dayIndex, {
        violations: sortedViolations,
        diagnostics,
        metrics,
      });
    }
    
    return {
      violationMap: resultMap,
      timeline: fullTimeline,
      violations: allViolations,
    };
  }, [dailyRecords, previousMonthRecords, parsedDateLineAdjustments, parsedPreviousMonthDateLineAdjustments, complianceMode, opaMode]);
  
  // Extract for easier access
  const timelineViolations = timelineData.violationMap;

  // Apply timeline violations to dailyRecords only when violations actually change
  // Uses hash comparison to prevent infinite loop (timelineViolations depends on dailyRecords)
  useEffect(() => {
    if (timelineViolations.size === 0 || dailyRecords.length === 0) return;
    
    // Create a hash of the violations to detect actual changes
    const violationsHash = JSON.stringify(
      Array.from(timelineViolations.entries()).map(([idx, data]) => 
        `${idx}:${data.violations.join(',')}:${data.metrics.anyPeriodRest24hr}:${data.metrics.anyPeriodRest7day}`
      )
    );
    
    // Skip if violations haven't actually changed
    if (lastViolationsHashRef.current === violationsHash) return;
    lastViolationsHashRef.current = violationsHash;
    
    setDailyRecords(prevRecords => {
      return prevRecords.map((record, dayIndex) => {
        const violationData = timelineViolations.get(dayIndex);
        if (!violationData) return record;
        
        return {
          ...record,
          violations: violationData.violations,
          violationDiagnostics: violationData.diagnostics,
          anyPeriodRest24hr: violationData.metrics.anyPeriodRest24hr,
          anyPeriodRest7day: violationData.metrics.anyPeriodRest7day,
          anyPeriodWork24hr: violationData.metrics.anyPeriodWork24hr,
          anyPeriodWork7day: violationData.metrics.anyPeriodWork7day,
        };
      });
    });
  }, [timelineViolations]);

  // Ref to track if close should happen after save
  const closeAfterSaveRef = useRef(false);
  
  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (formId) {
        return await restHoursApiV2.dailyRecords.update(String(formId), data);
      } else {
        return await restHoursApiV2.dailyRecords.create(data);
      }
    },
    onSuccess: (data: any) => {
      setFormId(data.rhDailyUuid || data.rh_daily_uuid);
      setIsDirty(false); // Reset dirty flag after successful save
      queryClient.invalidateQueries({ queryKey: ['v2', 'rest-hours', 'daily-records'] });
      queryClient.invalidateQueries({ queryKey: ['v2', 'rest-hours', 'crew-records'] });
      
      // Check if we should close the dialog after auto-save
      if (closeAfterSaveRef.current) {
        closeAfterSaveRef.current = false;
        onOpenChange(false);
        toast({
          title: 'Auto-saved',
          description: 'Rest hours record saved automatically',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Rest hours record saved successfully',
        });
      }
    },
    onError: (error) => {
      closeAfterSaveRef.current = false;
      toast({
        title: 'Error',
        description: 'Failed to save rest hours record',
        variant: 'destructive',
      });
      console.error('Save error:', error);
    },
  });

  const handleSave = () => {
    // Merge the latest violations from timelineViolations into dailyRecords before saving
    // This ensures violations calculated client-side are persisted to the database
    const recordsWithViolations = dailyRecords.map((record, dayIndex) => {
      const violationData = timelineViolations.get(dayIndex);
      if (violationData) {
        return {
          ...record,
          violations: violationData.violations,
          violationDiagnostics: violationData.diagnostics,
          anyPeriodRest24hr: violationData.metrics.anyPeriodRest24hr,
          anyPeriodRest7day: violationData.metrics.anyPeriodRest7day,
          anyPeriodWork24hr: violationData.metrics.anyPeriodWork24hr,
          anyPeriodWork7day: violationData.metrics.anyPeriodWork7day,
        };
      }
      return record;
    });
    
    const payload = {
      crewMemberId: selectedCrewMemberId,
      vesselId: selectedVesselId,
      rank,
      name: crewMemberName,
      monthYear: selectedPeriod,
      dailyRecords: JSON.stringify(recordsWithViolations),
      showPlanning,
      opaMode,
    };
    
    saveMutation.mutate(payload);
  };
  
  // Handler: Request dialog close with auto-save
  // Automatically saves any unsaved changes before closing to prevent data loss
  const handleRequestClose = useCallback(() => {
    // Prevent double-submit if save is already in progress
    if (saveMutation.isPending) {
      return;
    }
    
    // If there are unsaved changes, auto-save before closing
    if (isDirty && dailyRecords.length > 0 && selectedCrewMemberId && selectedVesselId) {
      closeAfterSaveRef.current = true;
      
      // Merge the latest violations before saving
      const recordsWithViolations = dailyRecords.map((record, dayIndex) => {
        const violationData = timelineViolations.get(dayIndex);
        if (violationData) {
          return {
            ...record,
            violations: violationData.violations,
            violationDiagnostics: violationData.diagnostics,
            anyPeriodRest24hr: violationData.metrics.anyPeriodRest24hr,
            anyPeriodRest7day: violationData.metrics.anyPeriodRest7day,
            anyPeriodWork24hr: violationData.metrics.anyPeriodWork24hr,
            anyPeriodWork7day: violationData.metrics.anyPeriodWork7day,
          };
        }
        return record;
      });
      
      const payload = {
        crewMemberId: selectedCrewMemberId,
        vesselId: selectedVesselId,
        rank,
        name: crewMemberName,
        monthYear: selectedPeriod,
        dailyRecords: JSON.stringify(recordsWithViolations),
        showPlanning,
        opaMode,
      };
      
      saveMutation.mutate(payload);
    } else {
      // No unsaved changes, just close
      onOpenChange(false);
    }
  }, [isDirty, dailyRecords, timelineViolations, selectedCrewMemberId, selectedVesselId, rank, crewMemberName, selectedPeriod, showPlanning, opaMode, saveMutation, onOpenChange]);
  
  // Handle Dialog's onOpenChange - intercept close requests to trigger auto-save
  const handleDialogOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      // Opening the dialog - pass through
      onOpenChange(true);
    } else {
      // Closing the dialog - trigger auto-save flow
      handleRequestClose();
    }
  }, [onOpenChange, handleRequestClose]);

  const handleClear = () => {
    // Reset to initial state
    const [year, month] = selectedPeriod.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const records: DailyRecord[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(parseInt(year), parseInt(month) - 1, day);
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
      
      records.push(createBlankDailyRecord(day, dayOfWeek, 'primary'));
    }
    
    setDailyRecords(records);
    setRecordMode('Rec');
    setShowPlanning(true);
    setOpaMode(false);
    setIsDirty(true); // Mark as dirty since Clear is a user action that changes data
    
    // Reset template applied flag to allow reapplication of fixed/variable task templates
    templateAppliedRef.current = false;
  };

  // Handle Export button click - generate PDF
  const handleExport = async () => {
    try {
      // Get vessel data from the vessels list (cast to any to access additional API fields)
      const selectedVessel = vessels.find((v: any) => v.entryId === selectedVesselId) as any;
      const vesselName = selectedVessel?.name || '';
      const imoNumber = selectedVessel?.description || selectedVessel?.imoNumber || '';
      const flagOfShip = selectedVessel?.countryName || selectedVessel?.country || selectedVessel?.flagState || '';
      
      // Get crew member data
      const selectedCrewMember = filteredCrewMembers.find((cm: any) => cm.crewMemberId === selectedCrewMemberId || cm.empNo === selectedCrewMemberId);
      const fileNo = selectedCrewMember?.crewMemberId || selectedCrewMember?.empNo || '';
      const firstName = selectedCrewMember?.firstName || '';
      const middleName = selectedCrewMember?.middleName || '';
      const familyName = selectedCrewMember?.familyName || '';
      const fullName = `${firstName}${middleName ? ' ' + middleName : ''} ${familyName}`.toUpperCase();
      const seafarerFullName = `${rank}-${fullName}`;
      
      // Determine if watchkeeper based on rank (officers typically are)
      const watchkeeperRanks = ['Master', 'Chief Officer', 'Second Officer', 'Third Officer', 'Chief Engineer', 'Second Engineer', 'Third Engineer', 'Fourth Engineer', 'Electrical Officer'];
      const watchkeeper = watchkeeperRanks.some(r => rank.toLowerCase().includes(r.toLowerCase()));
      
      // Format month/year display (e.g., "Dec-2025")
      const [year, month] = selectedPeriod.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthYearDisplay = `${monthNames[parseInt(month) - 1]}-${year}`;
      
      await generateRestHoursPDF({
        vesselName,
        crewMemberName,
        rank,
        monthYear: monthYearDisplay,
        records: dailyRecords,
        imoNumber,
        flagOfShip,
        watchkeeper,
        seafarerFullName,
      });
      
      toast({
        title: "Export Successful",
        description: "Rest Hour Record PDF has been downloaded.",
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Compute the inclusive range of days [from, to] that are applicable for this crew member.
  // Days outside this range must be greyed out and uneditable.
  const applicableDayRange = useMemo(() => {
    if (!selectedPeriod) return { from: 1, to: 31 };
    const [year, month] = selectedPeriod.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = `${selectedPeriod}-01`;
    const lastDay = `${selectedPeriod}-${String(daysInMonth).padStart(2, '0')}`;

    let from = 1;
    let to = daysInMonth;

    if (signOnDate && signOnDate >= firstDay && signOnDate <= lastDay) {
      from = parseInt(signOnDate.split('-')[2], 10);
    }
    if (signOffDate && signOffDate >= firstDay && signOffDate <= lastDay) {
      to = parseInt(signOffDate.split('-')[2], 10);
    }

    return { from, to };
  }, [selectedPeriod, signOnDate, signOffDate]);

  // Generate display rows - now 1:1 mapping since retarded days have separate records
  const displayRows = useMemo(() => {
    const rows: DisplayRow[] = [];
    
    // Parse date line adjustments
    let adjustmentsMap = new Map<number, 'advanced' | 'retarded'>();
    if (dateLineAdjustment) {
      try {
        const adjustments = JSON.parse(dateLineAdjustment.adjustments) as DateLineAdjustmentItem[];
        if (Array.isArray(adjustments)) {
          adjustments.forEach(adj => {
            adjustmentsMap.set(adj.day, adj.type);
          });
        }
      } catch (e) {
        console.error('Failed to parse date line adjustments:', e);
      }
    }
    
    // Simple 1:1 mapping: each record becomes one display row
    dailyRecords.forEach((record, baseIndex) => {
      const adjustmentType = adjustmentsMap.get(record.day);
      const isAdvanced = adjustmentType === 'advanced';
      const isRetarded = adjustmentType === 'retarded' && record.occurrence === 'duplicate';
      const isOutOfRange = record.day < applicableDayRange.from || record.day > applicableDayRange.to;
      
      rows.push({
        baseIndex,
        record,
        dayLabel: `${record.day}`,
        dayOfWeekLabel: record.dayOfWeek,
        marker: isAdvanced ? 'advanced' : isRetarded ? 'retarded' : undefined,
        occurrence: record.occurrence,
        isDisabled: isAdvanced || isOutOfRange,
      });
    });
    
    return rows;
  }, [dailyRecords, dateLineAdjustment, applicableDayRange]);

  // Check if any date line adjustments exist
  const hasDateLineAdjustments = useMemo(() => {
    if (!dateLineAdjustment) return false;
    try {
      const adjustments = JSON.parse(dateLineAdjustment.adjustments) as DateLineAdjustmentItem[];
      return Array.isArray(adjustments) && adjustments.length > 0;
    } catch (e) {
      return false;
    }
  }, [dateLineAdjustment]);

  // Helper: Calculate hours of rest in 24hr period
  // Note: Each cell represents 30 minutes (0.5 hours), so divide count by 2
  const calculateHoursOfRest24hr = (hours: string[]): number => {
    return hours.filter(h => h === '').length / 2;
  };

  // Helper: Calculate hours of work in 24hr period
  const calculateHoursOfWork24hr = (hours: string[]): number => {
    return 24 - calculateHoursOfRest24hr(hours);
  };

  // Handler: Toggle Plan/Rec
  const handleTogglePlanRec = useCallback((dayIndex: number) => {
    setDailyRecords(prevRecords => {
      const newRecords = [...prevRecords];
      const record = { ...newRecords[dayIndex] };
      
      record.isPlan = !record.isPlan;
      
      // If switching from Plan to Rec, keep the hours as-is (they're already set)
      // The colors will change based on isPlan flag
      
      newRecords[dayIndex] = record;
      return newRecords;
    });
    setIsDirty(true);
  }, []);

  // Handler: Edit hour cell
  const handleHourCellEdit = useCallback((dayIndex: number, hourIndex: number, value: string) => {
    setDailyRecords(prevRecords => {
      const newRecords = [...prevRecords];
      const record = { ...newRecords[dayIndex] };
      
      // Update the hour value (allow only 'w', 'd', 'a', or empty)
      const normalizedValue = value.toLowerCase();
      if (normalizedValue === 'w' || normalizedValue === 'd' || normalizedValue === 'a' || normalizedValue === '') {
        record.hours = [...record.hours];
        record.hours[hourIndex] = normalizedValue;
        
        // Set isPlan based on the current recordMode toggle
        record.isPlan = (recordMode === 'Plan');
        
        // Recalculate basic 24hr metrics
        const restHours = record.hours.filter(h => h === '').length / 2;
        record.hoursOfRest24hr = restHours;
        record.hoursOfWork24hr = 24 - restHours;
        
        newRecords[dayIndex] = record;
        
        // All other metrics and violations will be automatically recalculated
        // by the timelineViolations memo when dailyRecords changes
      }
      
      return newRecords;
    });
    setIsDirty(true);
  }, [recordMode]);

  // Handler: Edit comments
  const handleCommentsChange = useCallback((dayIndex: number, comments: string) => {
    setDailyRecords(prevRecords => {
      const newRecords = [...prevRecords];
      newRecords[dayIndex] = {
        ...newRecords[dayIndex],
        comments,
      };
      return newRecords;
    });
    setIsDirty(true);
  }, []);

  // Get cell background color based on isPlan and value
  const getCellColor = (isPlan: boolean, value: string): string => {
    if (isPlan && value !== '' && showPlanning) {
      return '#E5E7EB'; // Grey for plan (only when showPlanning is true)
    }
    if (!isPlan) {
      if (value === 'w' || value === 'd') {
        return '#D4EDDA'; // Green for work/duty
      }
      if (value === 'a') {
        return '#CCE5FF'; // Blue for anchor watch
      }
    }
    return 'white'; // Rest (blank)
  };
  
  // Helper: Determine if a cell should be highlighted based on hovered violation
  const shouldHighlightCell = (dayIndex: number, cellIndex: number): boolean => {
    if (!hoveredViolation) return false;
    
    const record = dailyRecords[dayIndex];
    if (!record) return false;
    
    // Get the diagnostic for the hovered violation from the hovered row
    const hoveredRecord = dailyRecords[hoveredViolation.dayIndex];
    if (!hoveredRecord?.violationDiagnostics) return false;
    
    const diagnostic = hoveredRecord.violationDiagnostics.find(d => d.code === hoveredViolation.code);
    if (!diagnostic) return false;
    
    // If there are specific violating ranges, use them
    if (diagnostic.violatingRanges && diagnostic.violatingRanges.length > 0) {
      // Check if any range applies to this cell
      return diagnostic.violatingRanges.some(range => {
        // Check if this range is for the current day
        if (range.startDay === record.day) {
          // Check if cell is within this range
          return cellIndex >= range.startCell && cellIndex <= range.endCell;
        }
        return false;
      });
    }
    
    // Fallback to old logic for Code 3 and other violations without violatingRanges
    if (!diagnostic.windowStart || diagnostic.windowStart === 'Various windows' || diagnostic.windowStart === 'Multiple windows') return false;
    if (typeof diagnostic.windowStart !== 'string') return false;
    
    // Parse the windowStart for backward compatibility
    const match = diagnostic.windowStart.match(/(\w+)\s+(\d+),\s+(\d+):(\d+)/);
    if (!match) return false;
    
    const [, , windowStartDay, windowStartHour, windowStartMin] = match;
    const startDay = parseInt(windowStartDay);
    const startHour = parseInt(windowStartHour);
    const startMin = parseInt(windowStartMin);
    const startCellInDay = startHour * 2 + (startMin === 30 ? 1 : 0);
    
    const currentDay = record.day;
    
    // Check if this is the row with the hovered violation
    if (hoveredViolation.dayIndex === dayIndex) {
      if (startDay === currentDay) {
        // Window starts on current day - highlight from start cell to end of day
        return cellIndex >= startCellInDay;
      } else {
        // Window starts on previous day - highlight from beginning to end of 24hr window
        return cellIndex <= startCellInDay;
      }
    }
    
    // Also check if this is the previous day of the hovered violation (for cross-day windows)
    if (hoveredViolation.dayIndex - 1 === dayIndex) {
      // If the window starts on this previous day, highlight from start cell to end of day
      if (startDay === currentDay) {
        return cellIndex >= startCellInDay;
      }
    }
    
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <DialogTitle className="text-lg font-semibold text-center flex-1">
              RH Recording Form
            </DialogTitle>
            <DialogDescription className="sr-only">
              Rest hours recording form for daily work and rest hour tracking
            </DialogDescription>
            <div className="flex-1 flex items-center justify-end gap-4">
              <span className="text-base font-medium text-[#4a90e2]">{monthDisplay}</span>
              <Button 
                variant="outline" 
                size="sm"
                className="items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-white border-gray-300 text-gray-700 shadow-sm hover:bg-gray-50 h-8 rounded-md px-3 text-xs hidden sm:flex"
                data-testid="button-export-rh"
                onClick={handleExport}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export
              </Button>
              {!isLocked && (
                <Button
                  variant="outline"
                  onClick={handleClear}
                  className="h-8 px-3 text-xs"
                  data-testid="button-clear-form"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLocked && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
            <Lock className="h-4 w-4 flex-shrink-0 text-red-500" />
            <span>This record is locked and cannot be edited.</span>
          </div>
        )}

        {/* Filter Controls */}
        <div className="flex items-center gap-4 py-3 border-b">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#4f5863]">Period</Label>
            <Select
              value={selectedPeriod}
              onValueChange={setSelectedPeriod}
            >
              <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#4f5863]">Vessel</Label>
            <Select
              value={selectedVesselId}
              onValueChange={(newVesselId) => {
                setSelectedVesselId(newVesselId);
                const crewOnNewVessel = allCrewMembers.filter((cm: any) => cm.presentVessel === newVesselId);
                if (crewOnNewVessel.length > 0) {
                  const sorted = [...crewOnNewVessel].sort((a: any, b: any) => {
                    const aOrder = getRankSortOrder(a.presentRank);
                    const bOrder = getRankSortOrder(b.presentRank);
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    const aSuffix = a.presentRank?.includes('_') ? parseInt(a.presentRank.split('_')[1]) || 0 : 0;
                    const bSuffix = b.presentRank?.includes('_') ? parseInt(b.presentRank.split('_')[1]) || 0 : 0;
                    return aSuffix - bSuffix;
                  });
                  setSelectedCrewMemberId(sorted[0].crewMemberId || sorted[0].empNo);
                }
              }}
              disabled={isShipUser}
            >
              <SelectTrigger className="h-8 w-48 text-xs" disabled={isShipUser} data-testid="select-vessel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vessels.map((vessel: any) => (
                  <SelectItem key={vessel.entryId} value={vessel.entryId}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#4f5863]">Rank, Name</Label>
            <Select
              value={selectedCrewMemberId}
              onValueChange={setSelectedCrewMemberId}
            >
              <SelectTrigger className="h-8 w-64 text-xs" data-testid="select-crew-member">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredCrewMembers.map((cm: any) => (
                  <SelectItem key={cm.crewMemberId || cm.empNo} value={cm.crewMemberId || cm.empNo}>
                    {cm.presentRank}, {cm.firstName}{cm.middleName ? ' ' + cm.middleName : ''} {cm.familyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-[#4f5863]">Rec.</span>
            <button
              onClick={() => setRecordMode(prev => prev === 'Rec' ? 'Plan' : 'Rec')}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                recordMode === 'Plan' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              data-testid="toggle-record-mode"
              type="button"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  recordMode === 'Plan' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs text-[#4f5863]">Plan</span>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="show-planning"
              checked={showPlanning}
              onCheckedChange={(checked) => setShowPlanning(checked as boolean)}
              data-testid="checkbox-show-planning"
            />
            <Label htmlFor="show-planning" className="text-xs cursor-pointer">
              Show Planning
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="opa"
              checked={opaMode}
              onCheckedChange={(checked) => setOpaMode(checked as boolean)}
              data-testid="checkbox-opa"
            />
            <Label htmlFor="opa" className="text-xs cursor-pointer">
              OPA
            </Label>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-[#4f5863]">Rest</span>
            <button
              onClick={() => setComplianceMode(prev => prev === 'Rest' ? 'Work' : 'Rest')}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                complianceMode === 'Work' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              data-testid="toggle-compliance-mode"
              type="button"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  complianceMode === 'Work' ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-xs text-[#4f5863]">Work</span>
          </div>
        </div>

        {/* Rest Hours Table */}
        <div className="mt-4 overflow-auto max-h-[60vh] border rounded-md">
          <table className="w-full border-collapse" style={{ fontSize: '13px' }}>
            <thead className="sticky top-0 bg-gray-100 z-10">
              {/* Header Row 1 */}
              <tr>
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[60px]" style={{ padding: '2px' }}>
                  Plan/Rec
                </th>
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[50px]" style={{ padding: '2px' }}>
                  Date
                </th>
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[50px]" style={{ padding: '2px' }}>
                  Day
                </th>
                {Array.from({ length: 24 }, (_, i) => (
                  <th key={i} rowSpan={2} colSpan={2} className="border border-gray-300 p-0.5 min-w-[40px] text-left" style={{ padding: '2px' }}>
                    {i.toString().padStart(2, '0')}
                  </th>
                ))}
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[60px]" style={{ padding: '2px' }}>
                  RH in 24 Hr
                </th>
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[80px]" style={{ padding: '2px' }}>
                  Violations
                </th>
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[220px]" style={{ padding: '2px' }}>
                  Comments
                </th>
                {complianceMode === 'Rest' && (
                  <th colSpan={2} className="border border-gray-300 p-0.5 bg-blue-50" style={{ padding: '2px' }}>
                    Hours of Rest in any
                  </th>
                )}
                {complianceMode === 'Work' && (
                  <th colSpan={2} className="border border-gray-300 p-0.5 bg-blue-50" style={{ padding: '2px' }}>
                    Hours of Work in any
                  </th>
                )}
              </tr>
              {/* Header Row 2 */}
              <tr>
                {complianceMode === 'Rest' && (
                  <>
                    <th className="border border-gray-300 p-0.5 min-w-[70px] bg-blue-50" style={{ padding: '2px' }}>
                      24 Hr Period
                    </th>
                    <th className="border border-gray-300 p-0.5 min-w-[60px] bg-blue-50" style={{ padding: '2px' }}>
                      7 days
                    </th>
                  </>
                )}
                {complianceMode === 'Work' && (
                  <>
                    <th className="border border-gray-300 p-0.5 min-w-[60px] bg-blue-50" style={{ padding: '2px' }}>
                      24 Hr Period
                    </th>
                    <th className="border border-gray-300 p-0.5 min-w-[60px] bg-blue-50" style={{ padding: '2px' }}>
                      7 days
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, displayIndex) => {
                const { baseIndex, record, dayLabel, dayOfWeekLabel, marker, occurrence, isDisabled } = row;
                const isNonEditable = isDisabled || isLocked;
                
                // Determine styling based on marker and occurrence
                const isAdvanced = marker === 'advanced';
                const isRetardedDuplicate = marker === 'retarded' && occurrence === 'duplicate';
                
                const dateCellColor = isAdvanced ? 'text-red-600 font-semibold' : 
                                     isRetardedDuplicate ? 'text-green-600 font-semibold' : '';
                const dayMarker = isAdvanced ? ' *' : isRetardedDuplicate ? ' **' : '';
                const rowBgColor = isDisabled ? 'bg-gray-100' : isRetardedDuplicate ? 'bg-green-50' : '';
                const occurrenceSuffix = occurrence === 'duplicate' ? '-duplicate' : '';
                
                return (
                  <tr key={`${record.day}-${occurrence}`} className={rowBgColor}>
                    {/* Plan/Rec Button */}
                    <td className="border border-gray-300 text-center" style={{ padding: '2px' }}>
                      <button
                        onClick={() => !isNonEditable && handleTogglePlanRec(baseIndex)}
                        className={`px-2 py-1 text-xs rounded ${isDisabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200'}`}
                        disabled={isNonEditable}
                        data-testid={`button-plan-rec-${record.day}${occurrenceSuffix}`}
                      >
                        {record.isPlan ? 'Plan' : 'Rec'}
                      </button>
                    </td>
                    
                    {/* Date */}
                    <td className={`border border-gray-300 text-center ${dateCellColor}`} style={{ padding: '2px' }}>
                      {dayLabel}{dayMarker}
                    </td>
                    
                    {/* Day of Week */}
                    <td className={`border border-gray-300 text-center ${dateCellColor}`} style={{ padding: '2px' }}>
                      {dayOfWeekLabel}
                    </td>
                  
                  {/* 48 Half-Hour Columns (2 cells per hour) */}
                  {record.hours.map((hour, hourIndex) => {
                    const isSecondHalf = hourIndex % 2 === 1;
                    const borderRight = isSecondHalf ? 'border-gray-300' : 'border-gray-200';
                    const isHighlighted = shouldHighlightCell(baseIndex, hourIndex);
                    
                    return (
                      <td
                        key={hourIndex}
                        className={`border-t border-b border-l text-center ${isSecondHalf ? 'border-r' : ''}`}
                        style={{
                          padding: '2px',
                          backgroundColor: isDisabled ? '#F3F4F6' : getCellColor(record.isPlan, hour),
                          borderRightWidth: isSecondHalf ? '1px' : '0.5px',
                          borderRightColor: isSecondHalf ? '#d1d5db' : '#e5e7eb',
                          borderRightStyle: 'solid',
                          minWidth: '15px',
                          width: '15px',
                          outline: isHighlighted ? '2px solid #ef4444' : 'none',
                          outlineOffset: '-2px',
                          zIndex: isHighlighted ? 10 : 'auto',
                          position: 'relative',
                        }}
                      >
                        <div
                          key={`${baseIndex}-${hourIndex}-${hour}`}
                          contentEditable={!isNonEditable}
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            if (isNonEditable) return;
                            const value = e.currentTarget.textContent || '';
                            handleHourCellEdit(baseIndex, hourIndex, value);
                          }}
                          onKeyDown={(e) => {
                            // Handle Enter key
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                              return;
                            }
                            
                            // Handle arrow key navigation
                            if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                              e.preventDefault();
                              
                              let targetDisplayIndex = displayIndex;
                              let targetHour = hourIndex;
                              
                              if (e.key === 'ArrowRight') {
                                targetHour++;
                                if (targetHour >= 48) {
                                  targetHour = 0;
                                  targetDisplayIndex++;
                                }
                              } else if (e.key === 'ArrowLeft') {
                                targetHour--;
                                if (targetHour < 0) {
                                  targetHour = 47;
                                  targetDisplayIndex--;
                                }
                              } else if (e.key === 'ArrowDown') {
                                targetDisplayIndex++;
                              } else if (e.key === 'ArrowUp') {
                                targetDisplayIndex--;
                              }
                              
                              // Check if target is valid
                              if (targetDisplayIndex >= 0 && targetDisplayIndex < displayRows.length) {
                                const targetRow = displayRows[targetDisplayIndex];
                                const targetOccurrenceSuffix = targetRow.occurrence === 'duplicate' ? '-duplicate' : '';
                                const targetCell = document.querySelector(
                                  `[data-testid="cell-hour-${targetRow.record.day}${targetOccurrenceSuffix}-${targetHour}"]`
                                ) as HTMLElement;
                                
                                if (targetCell) {
                                  targetCell.focus();
                                  // Select all text in the cell for easy overwriting
                                  const selection = window.getSelection();
                                  const range = document.createRange();
                                  range.selectNodeContents(targetCell);
                                  selection?.removeAllRanges();
                                  selection?.addRange(range);
                                }
                              }
                              return;
                            }
                            
                            // Allow only w, d, a, backspace, delete
                            if (
                              e.key.length === 1 &&
                              !['w', 'd', 'a', 'W', 'D', 'A'].includes(e.key)
                            ) {
                              e.preventDefault();
                            }
                          }}
                          className={`outline-none cursor-text min-h-[20px] ${record.isPlan ? 'font-light text-gray-400' : ''}`}
                          style={{ width: '100%', minWidth: '15px' }}
                          data-testid={`cell-hour-${record.day}${occurrenceSuffix}-${hourIndex}`}
                        >
                          {isDisabled ? '' : (showPlanning || !record.isPlan) ? hour : ''}
                        </div>
                      </td>
                    );
                  })}
                  
                  {/* Hours of Rest (Calendar Day) */}
                  <td className={`border border-gray-300 text-center ${record.isPlan ? 'font-light text-gray-400' : ''}`} style={{ padding: '2px' }}>
                    {isDisabled ? '' : record.hoursOfRest24hr}
                  </td>
                  
                  {/* Violations */}
                  <td className={`border border-gray-300 text-center font-semibold ${record.isPlan ? 'text-gray-500' : 'text-red-600'}`} style={{ padding: '2px' }}>
                    {(() => {
                      if (isDisabled) return '';
                      // Hide predicted violations (from plan rows) when Show Planning is unchecked
                      if (record.isPlan && !showPlanning) return '';
                      
                      const visibleViolations = filterViolations(record.violations, complianceMode, opaMode);
                      const visibleDiagnostics = record.violationDiagnostics?.filter(d => visibleViolations.includes(d.code)) || [];
                      
                      if (visibleViolations.length === 0) return '';
                      
                      // If no diagnostics available, just show the codes
                      if (visibleDiagnostics.length === 0) {
                        return visibleViolations.join(', ');
                      }
                      
                      // Show individual codes with hover functionality for highlighting
                      return (
                        <span className="flex flex-wrap gap-0.5 justify-center">
                          {visibleViolations.map((code, idx) => {
                            const diagnostic = visibleDiagnostics.find(d => d.code === code);
                            
                            if (!diagnostic) {
                              return <span key={code}>{code}{idx < visibleViolations.length - 1 ? ', ' : ''}</span>;
                            }
                            
                            return (
                              <TooltipProvider key={code}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className={`cursor-help underline decoration-dotted px-0.5 rounded ${record.isPlan ? 'hover:bg-gray-200' : 'hover:bg-red-100'}`}
                                      onMouseEnter={() => setHoveredViolation({ dayIndex: baseIndex, code })}
                                      onMouseLeave={() => setHoveredViolation(null)}
                                    >
                                      {code}{idx < visibleViolations.length - 1 ? ', ' : ''}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent 
                                    side="right" 
                                    align="start" 
                                    sideOffset={8}
                                    avoidCollisions={false}
                                    className="max-w-[220px] text-[11px] z-50"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="leading-snug">{VIOLATION_CODE_DESCRIPTIONS[diagnostic.code]}</div>
                                      <div className="text-gray-600 leading-snug">{diagnostic.reason}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </span>
                      );
                    })()}
                  </td>
                  
                  {/* Comments */}
                  <td className="border border-gray-300" style={{ padding: '2px' }}>
                    <input
                      type="text"
                      value={record.comments}
                      onChange={(e) => !isNonEditable && handleCommentsChange(baseIndex, e.target.value)}
                      className={`w-full outline-none bg-transparent px-1 ${isDisabled ? 'cursor-not-allowed' : ''}`}
                      disabled={isNonEditable}
                      data-testid={`input-comments-${record.day}${occurrenceSuffix}`}
                    />
                  </td>
                  
                  {complianceMode === 'Rest' && (
                    <>
                      {/* Any Period: Rest in 24hr */}
                      <td 
                        className={`border border-gray-300 text-center bg-blue-50 ${record.isPlan ? 'font-light text-gray-400' : ''}`}
                        style={{ 
                          padding: '2px',
                          color: record.isPlan ? undefined : (record.anyPeriodRest24hr < 10 ? 'red' : 'inherit'),
                          fontWeight: record.isPlan ? 300 : (record.anyPeriodRest24hr < 10 ? 'bold' : 'normal')
                        }}
                      >
                        {isDisabled ? '' : record.anyPeriodRest24hr.toFixed(1)}
                      </td>
                      
                      {/* Any Period: Rest in 7 days */}
                      <td 
                        className={`border border-gray-300 text-center bg-blue-50 ${record.isPlan ? 'font-light text-gray-400' : ''}`}
                        style={{ 
                          padding: '2px',
                          color: record.isPlan ? undefined : (record.anyPeriodRest7day < 77 ? 'red' : 'inherit'),
                          fontWeight: record.isPlan ? 300 : (record.anyPeriodRest7day < 77 ? 'bold' : 'normal')
                        }}
                      >
                        {isDisabled ? '' : record.anyPeriodRest7day.toFixed(1)}
                      </td>
                    </>
                  )}
                  
                  {complianceMode === 'Work' && (
                    <>
                      {/* Any Period: Work in 24hr */}
                      <td 
                        className={`border border-gray-300 text-center bg-blue-50 ${record.isPlan ? 'font-light text-gray-400' : ''}`}
                        style={{ 
                          padding: '2px',
                          color: record.isPlan ? undefined : (record.anyPeriodWork24hr > 14 ? 'red' : 'inherit'),
                          fontWeight: record.isPlan ? 300 : (record.anyPeriodWork24hr > 14 ? 'bold' : 'normal')
                        }}
                      >
                        {isDisabled ? '' : record.anyPeriodWork24hr.toFixed(1)}
                      </td>
                      
                      {/* Any Period: Work in 7 days */}
                      <td 
                        className={`border border-gray-300 text-center bg-blue-50 ${record.isPlan ? 'font-light text-gray-400' : ''}`}
                        style={{ 
                          padding: '2px',
                          color: record.isPlan ? undefined : (record.anyPeriodWork7day > 72 ? 'red' : 'inherit'),
                          fontWeight: record.isPlan ? 300 : (record.anyPeriodWork7day > 72 ? 'bold' : 'normal')
                        }}
                      >
                        {isDisabled ? '' : record.anyPeriodWork7day.toFixed(1)}
                      </td>
                    </>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Date Line Adjustments Legend */}
        {hasDateLineAdjustments && (
          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200 text-xs">
            <div className="font-semibold mb-1">International Date Line Adjustments:</div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1">
                <span className="text-red-600 font-semibold">*</span>
                <span>Day Advanced (Skipped)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-green-600 font-semibold">**</span>
                <span>Day Retarded (Repeated)</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleRequestClose}
            disabled={saveMutation.isPending}
            data-testid="button-cancel"
          >
            {saveMutation.isPending ? 'Saving...' : 'Close'}
          </Button>
          {!isLocked && (
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
