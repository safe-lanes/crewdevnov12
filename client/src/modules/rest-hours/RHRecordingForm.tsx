import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import type { RestHoursDailyRecord, FixedTask } from '@shared/schema';
import { filterViolations } from './violationFilters';

interface RHRecordingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  rank: string;
  monthValue: string; // Format: "2025-10" (YYYY-MM)
}

interface ViolationDiagnostic {
  code: number;
  windowStart: string; // e.g., "Oct 4, 18:00" or "Multiple windows" (for backward compatibility)
  reason: string; // e.g., "Rest periods: 6h, 3h, 2h. Top 2 (6h + 3h = 9h) < 10h required"
  violatingRanges?: Array<{ startCell: number; endCell: number; startDay: number; monthName?: string }>; // For multi-range violations
}

// Violation code descriptions mapping
const VIOLATION_CODE_DESCRIPTIONS: Record<number, string> = {
  1: "Minimum 10 hours of rest in any 24 hour period",
  2: "Minimum hours of rest in any 7 day period = 77",
  3: "Hours of rest may be divided into no more than two periods, one of which shall be at least six hours in length",
  4: "Interval between rest periods not to exceed 14 hours",
  5: "ILO Work - Maximum 14 hours of work in any 24 hour period",
  6: "ILO Work - Maximum 72 hours of work in any 7 day period",
  7: "OPA - Maximum 15 hours of work in any 24 hour period",
  8: "OPA - Maximum 36 hours of work in 72 hours",
};

interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[]; // 48 entries (2 per hour for 00:00-23:30), values: "w", "d", "a", "" (blank = rest)
  isPlan: boolean;
  comments: string;
  violations: number[];
  violationDiagnostics?: ViolationDiagnostic[]; // Detailed info about why violations occurred
  hoursOfRest24hr: number; // Calendar day: 00:00-24:00
  hoursOfWork24hr: number;
  hoursOfRest48hr: number;
  hoursOfWork48hr: number;
  hoursOfRest7day: number;
  hoursOfWork7day: number;
  hoursOfRest96hr: number;
  hoursOfWork96hr: number;
  // "Any period" rolling window calculations (for regulatory compliance)
  anyPeriodRest24hr: number;  // Minimum rest hours in ANY 24-hour window
  anyPeriodRest7day: number;  // Minimum rest hours in ANY 7-day window
  anyPeriodWork24hr: number;  // Maximum work hours in ANY 24-hour window
  anyPeriodWork7day: number;  // Maximum work hours in ANY 7-day window
}

export const RHRecordingForm = ({
  open,
  onOpenChange,
  crewMemberId: initialCrewMemberId,
  crewMemberName: initialCrewMemberName,
  vesselId: initialVesselId,
  rank: initialRank,
  monthValue: initialMonthValue,
}: RHRecordingFormProps): JSX.Element => {
  const { toast } = useToast();
  const { vessels, getVesselName } = useVesselLookup();
  
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
  const [formId, setFormId] = useState<number | null>(null);
  
  // Violation highlighting state
  const [hoveredViolation, setHoveredViolation] = useState<{ dayIndex: number; code: number } | null>(null);
  
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
  
  // Fetch crew members for dropdown
  const { data: allCrewMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/crew-members'],
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
  
  // Filter crew members by selected vessel
  const filteredCrewMembers = useMemo(() => {
    if (!selectedVesselId) return allCrewMembers;
    return allCrewMembers.filter((cm: any) => cm.presentVessel === selectedVesselId);
  }, [allCrewMembers, selectedVesselId]);
  
  // Get selected crew member details
  const selectedCrewMember = useMemo(() => {
    return filteredCrewMembers.find((cm: any) => cm.id === selectedCrewMemberId);
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
      setSelectedVesselId(initialVesselId);
      setSelectedCrewMemberId(initialCrewMemberId);
    }
  }, [open, initialMonthValue, initialVesselId, initialCrewMemberId]);
  
  // Reset crew member selection when vessel changes (to first crew on that vessel)
  useEffect(() => {
    if (!open) return;
    
    // Skip if this is the initial load
    if (selectedVesselId === initialVesselId && selectedCrewMemberId === initialCrewMemberId) {
      return;
    }
    
    // When vessel changes, select the first crew member on that vessel
    if (filteredCrewMembers.length > 0) {
      setSelectedCrewMemberId(filteredCrewMembers[0].id);
    }
  }, [selectedVesselId, filteredCrewMembers, open]);

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
    
    const [year, month] = selectedPeriod.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const records: DailyRecord[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(parseInt(year), parseInt(month) - 1, day);
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
      
      records.push({
        day,
        dayOfWeek,
        hours: Array(48).fill(''), // Initialize with empty strings (rest) - 2 cells per hour
        isPlan: false,
        comments: '',
        violations: [],
        hoursOfRest24hr: 24,
        hoursOfWork24hr: 0,
        hoursOfRest48hr: 48,
        hoursOfWork48hr: 0,
        hoursOfRest7day: 168,
        hoursOfWork7day: 0,
        hoursOfRest96hr: 96,
        hoursOfWork96hr: 0,
        anyPeriodRest24hr: 24,
        anyPeriodRest7day: 168,
        anyPeriodWork24hr: 0,
        anyPeriodWork7day: 0,
      });
    }
    
    setDailyRecords(records);
  }, [selectedPeriod, selectedCrewMemberId, selectedVesselId, open]);

  // Fetch existing record if available
  const { data: existingRecord, isError } = useQuery<RestHoursDailyRecord>({
    queryKey: ['/api/rest-hours-daily-records/by-key', selectedCrewMemberId, selectedVesselId, selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/rest-hours-daily-records/by-key/${selectedCrewMemberId}/${selectedVesselId}/${selectedPeriod}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No existing record found
        }
        throw new Error('Failed to fetch rest hours record');
      }
      return response.json();
    },
    enabled: open && !!selectedCrewMemberId && !!selectedVesselId && !!selectedPeriod,
    retry: false,
    gcTime: 0, // Don't cache - each crew's data must be fresh to prevent data leakage
    staleTime: 0, // Always fetch fresh data
  });

  // Fetch previous month's record for cross-month rolling window calculations
  const { data: previousMonthRecord } = useQuery<RestHoursDailyRecord>({
    queryKey: ['/api/rest-hours-daily-records/by-key', selectedCrewMemberId, selectedVesselId, previousMonthPeriod],
    queryFn: async () => {
      if (!previousMonthPeriod) return null;
      const response = await fetch(`/api/rest-hours-daily-records/by-key/${selectedCrewMemberId}/${selectedVesselId}/${previousMonthPeriod}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No previous month record found
        }
        throw new Error('Failed to fetch previous month record');
      }
      return response.json();
    },
    enabled: open && !!selectedCrewMemberId && !!selectedVesselId && !!previousMonthPeriod,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

  // Fetch fixed tasks for this crew member to auto-populate plan data
  const { data: fixedTask } = useQuery<FixedTask>({
    queryKey: ['/api/fixed-tasks/by-key', selectedCrewMemberId, selectedVesselId, selectedPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/fixed-tasks/by-key/${selectedCrewMemberId}/${selectedVesselId}/${selectedPeriod}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No fixed tasks found
        }
        throw new Error('Failed to fetch fixed tasks');
      }
      return response.json();
    },
    enabled: open && !!selectedCrewMemberId && !!selectedVesselId && !!selectedPeriod,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });

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

  // Apply fixed tasks template to daily records when available (for new forms)
  useEffect(() => {
    if (!open || !fixedTask || existingRecord) return;
    
    // Only apply fixed tasks if there's no existing record
    // Use seaHours as the template (assuming vessel is at sea by default)
    // TODO: Add vessel condition state to switch between seaHours/portHours
    const template = fixedTask.seaHours;
    
    if (!Array.isArray(template) || template.length !== 48) return;
    
    setDailyRecords(prevRecords => {
      return prevRecords.map(record => {
        const newHours = [...template];
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
  }, [fixedTask, open, existingRecord]);

  // Load existing record data or explicitly maintain clean state
  useEffect(() => {
    if (!open) return; // Skip if modal is closed
    
    if (existingRecord) {
      // Existing record found - load it
      setFormId(existingRecord.id);
      setShowPlanning(existingRecord.showPlanning ?? true);
      setOpaMode(existingRecord.opaMode || false);
      
      try {
        const parsedRecords = JSON.parse(existingRecord.dailyRecords);
        // Ensure all records have the any-period fields (for backward compatibility)
        // and recalculate them to ensure accuracy
        const updatedRecords = parsedRecords.map((record: DailyRecord, index: number) => {
          // Calculate 24hr metrics if missing (backward compatibility)
          const restHours = record.hours ? record.hours.filter((h: string) => h === '').length / 2 : 24;
          const workHours = 24 - restHours;
          
          // Calculate any-period metrics for this record
          const anyPeriod24 = calculateAnyPeriod24hr(parsedRecords, index, selectedPeriod, previousMonthRecords);
          const anyPeriod7day = calculateAnyPeriod7day(parsedRecords, index, previousMonthRecords);
          
          return {
            ...record,
            hoursOfRest24hr: record.hoursOfRest24hr ?? restHours,
            hoursOfWork24hr: record.hoursOfWork24hr ?? workHours,
            anyPeriodRest24hr: anyPeriod24.anyPeriodRest24hr,
            anyPeriodRest7day: anyPeriod7day.anyPeriodRest7day,
            anyPeriodWork24hr: anyPeriod24.anyPeriodWork24hr,
            anyPeriodWork7day: anyPeriod7day.anyPeriodWork7day,
          };
        });
        
        // Recalculate violations for all records to ensure new rules are applied
        const recordsWithViolations = updatedRecords.map((record: DailyRecord, index: number) => {
          const { violations, diagnostics } = detectViolations(record, updatedRecords, index, previousMonthRecords);
          return {
            ...record,
            violations,
            violationDiagnostics: diagnostics,
          };
        });
        setDailyRecords(recordsWithViolations);
      } catch (error) {
        console.error('Failed to parse daily records:', error);
      }
    } else if (isError || existingRecord === undefined) {
      // No record found (404) or query error - state remains clean from initialization
      // This explicitly ensures no stale data leaks between crew members
      console.log('No existing record found - using clean initialized state');
    }
  }, [existingRecord, isError, open, previousMonthRecords]);

  // Recalculate all metrics when previousMonthRecords changes
  // This handles both new forms and existing forms when cross-month data loads
  useEffect(() => {
    if (!open || !previousMonthRecords || previousMonthRecords.length === 0) return;
    
    // Only recalculate if we have dailyRecords already set
    // (either from initialization or from loading existing record)
    if (dailyRecords.length === 0) return;
    
    setDailyRecords(prevRecords => {
      // Recalculate all any-period metrics and violations for all days
      const updatedRecords = prevRecords.map((record, index) => {
        const anyPeriod24 = calculateAnyPeriod24hr(prevRecords, index, selectedPeriod, previousMonthRecords);
        const anyPeriod7day = calculateAnyPeriod7day(prevRecords, index, previousMonthRecords);
        
        return {
          ...record,
          anyPeriodRest24hr: anyPeriod24.anyPeriodRest24hr,
          anyPeriodRest7day: anyPeriod7day.anyPeriodRest7day,
          anyPeriodWork24hr: anyPeriod24.anyPeriodWork24hr,
          anyPeriodWork7day: anyPeriod7day.anyPeriodWork7day,
        };
      });
      
      // Recalculate violations with updated metrics
      return updatedRecords.map((record, index) => {
        const { violations, diagnostics } = detectViolations(record, updatedRecords, index, previousMonthRecords);
        return {
          ...record,
          violations,
          violationDiagnostics: diagnostics,
        };
      });
    });
  }, [previousMonthRecords, open]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (formId) {
        return apiRequest('PUT', `/api/rest-hours-daily-records/${formId}`, data);
      } else {
        return apiRequest('POST', '/api/rest-hours-daily-records', data);
      }
    },
    onSuccess: (data: any) => {
      setFormId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/rest-hours-daily-records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rest-hours-crew-records'] });
      toast({
        title: 'Success',
        description: 'Rest hours record saved successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save rest hours record',
        variant: 'destructive',
      });
      console.error('Save error:', error);
    },
  });

  const handleSave = () => {
    const payload = {
      crewMemberId: selectedCrewMemberId,
      vesselId: selectedVesselId,
      rank,
      name: crewMemberName,
      monthYear: selectedPeriod,
      dailyRecords: JSON.stringify(dailyRecords),
      showPlanning,
      opaMode,
    };
    
    saveMutation.mutate(payload);
  };

  const handleClear = () => {
    // Reset to initial state
    const [year, month] = selectedPeriod.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const records: DailyRecord[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(parseInt(year), parseInt(month) - 1, day);
      const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
      
      records.push({
        day,
        dayOfWeek,
        hours: Array(48).fill(''), // 2 cells per hour for half-hour divisions
        isPlan: false,
        comments: '',
        violations: [],
        hoursOfRest24hr: 24,
        hoursOfWork24hr: 0,
        hoursOfRest48hr: 48,
        hoursOfWork48hr: 0,
        hoursOfRest7day: 168,
        hoursOfWork7day: 0,
        hoursOfRest96hr: 96,
        hoursOfWork96hr: 0,
        anyPeriodRest24hr: 24,
        anyPeriodRest7day: 168,
        anyPeriodWork24hr: 0,
        anyPeriodWork7day: 0,
      });
    }
    
    setDailyRecords(records);
    setRecordMode('Rec');
    setShowPlanning(true);
    setOpaMode(false);
  };

  // Helper: Calculate hours of rest in 24hr period
  // Note: Each cell represents 30 minutes (0.5 hours), so divide count by 2
  const calculateHoursOfRest24hr = (hours: string[]): number => {
    return hours.filter(h => h === '').length / 2;
  };

  // Helper: Calculate hours of work in 24hr period
  const calculateHoursOfWork24hr = (hours: string[]): number => {
    return 24 - calculateHoursOfRest24hr(hours);
  };

  // Helper: Calculate rolling metrics (48hr, 7day, 96hr windows)
  const calculateRollingMetrics = (records: DailyRecord[], dayIndex: number) => {
    const currentRecord = records[dayIndex];
    
    // Calculate 48hr window (current day + previous day)
    let hoursOfRest48hr = calculateHoursOfRest24hr(currentRecord.hours);
    let hoursOfWork48hr = calculateHoursOfWork24hr(currentRecord.hours);
    if (dayIndex > 0) {
      hoursOfRest48hr += calculateHoursOfRest24hr(records[dayIndex - 1].hours);
      hoursOfWork48hr += calculateHoursOfWork24hr(records[dayIndex - 1].hours);
    } else {
      hoursOfRest48hr += 24;
    }
    
    // Calculate 7-day window (current day + previous 6 days)
    let hoursOfRest7day = 0;
    let hoursOfWork7day = 0;
    for (let i = 0; i < 7; i++) {
      const index = dayIndex - i;
      if (index >= 0) {
        hoursOfRest7day += calculateHoursOfRest24hr(records[index].hours);
        hoursOfWork7day += calculateHoursOfWork24hr(records[index].hours);
      } else {
        hoursOfRest7day += 24;
      }
    }
    
    // Calculate 96hr window (4 days)
    let hoursOfRest96hr = 0;
    let hoursOfWork96hr = 0;
    for (let i = 0; i < 4; i++) {
      const index = dayIndex - i;
      if (index >= 0) {
        hoursOfRest96hr += calculateHoursOfRest24hr(records[index].hours);
        hoursOfWork96hr += calculateHoursOfWork24hr(records[index].hours);
      } else {
        hoursOfRest96hr += 24;
      }
    }
    
    return {
      hoursOfRest48hr,
      hoursOfWork48hr,
      hoursOfRest7day,
      hoursOfWork7day,
      hoursOfRest96hr,
      hoursOfWork96hr,
    };
  };

  // Helper: Calculate "any period" 24-hour window metrics (backward-looking windows only)
  // For each half-hour in the current day, check the 24-hour window ending at that point
  const calculateAnyPeriod24hr = (records: DailyRecord[], dayIndex: number, monthYear: string, prevMonthRecords: DailyRecord[] = []) => {
    // Build a continuous array of cells from previous day + current day
    // This gives us 96 cells to work with (48 × 2 days)
    const allCells: string[] = [];
    
    // Track previous day info for window start calculations
    let prevDayNumber = 0;
    let prevMonthName = '';
    
    // Add previous day's cells
    if (dayIndex > 0) {
      // Previous day exists in current month
      allCells.push(...records[dayIndex - 1].hours);
      prevDayNumber = records[dayIndex - 1].day;
    } else {
      // Current day is the first day of the month - use previous month's last day
      if (prevMonthRecords.length > 0) {
        const lastDayOfPrevMonth = prevMonthRecords[prevMonthRecords.length - 1];
        allCells.push(...lastDayOfPrevMonth.hours);
        prevDayNumber = lastDayOfPrevMonth.day;
        // Calculate previous month name from monthYear parameter
        const [year, month] = monthYear.split('-');
        const currentMonth = parseInt(month);
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? parseInt(year) - 1 : parseInt(year);
        prevMonthName = new Date(prevYear, prevMonth - 1).toLocaleString('en-US', { month: 'short' });
      } else {
        // No previous month data - assume rest
        allCells.push(...Array(48).fill(''));
      }
    }
    
    // Add current day's cells
    allCells.push(...records[dayIndex].hours);
    
    // Current day occupies cells 48-95 (after previous day's 48 cells)
    // For each half-hour in current day (cells 48-95), check the 24-hour window ending at that point
    // Window ending at cell E starts at cell E-47 (48 cells total including E)
    let minRest = 24;  // Minimum rest hours found
    let maxWork = 0;   // Maximum work hours found
    const violatingRestWindows: { startCell: number; restHours: number }[] = [];
    const violatingWorkWindows: { startCell: number; workHours: number }[] = [];
    
    for (let endCell = 48; endCell <= 95; endCell++) {
      // Window ends at endCell and starts 47 cells before (48 cells total)
      const startCell = endCell - 47;
      const windowCells = allCells.slice(startCell, endCell + 1);
      
      // Only process if we have a full 48-cell window
      if (windowCells.length === 48) {
        // Count rest cells in this window
        const restCells = windowCells.filter(c => c === '').length;
        const restHours = restCells / 2; // Each cell = 0.5 hours
        const workHours = 24 - restHours;
        
        // Track violating windows
        if (restHours < 10) {
          violatingRestWindows.push({ startCell, restHours });
        }
        if (workHours > 14) {
          violatingWorkWindows.push({ startCell, workHours });
        }
        
        minRest = Math.min(minRest, restHours);
        maxWork = Math.max(maxWork, workHours);
      }
    }
    
    return {
      anyPeriodRest24hr: minRest,
      anyPeriodWork24hr: maxWork,
      violatingRestWindows,
      violatingWorkWindows,
      prevDayNumber,
      prevMonthName,
    };
  };

  // Helper: Calculate "any period" 7-day window metrics (backward-looking only)
  // Check only the 7-day window ending on the current day
  const calculateAnyPeriod7day = (records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []) => {
    // Window ends on current day, starts 6 days before
    const windowStart = dayIndex - 6;
    
    let restHours = 0;
    let missingDays = 0;
    
    // Collect data from previous month if window extends before current month
    if (windowStart < 0) {
      const daysFromPrevMonth = Math.abs(windowStart);
      if (prevMonthRecords.length > 0) {
        // Get the last N days from previous month
        for (let i = 0; i < daysFromPrevMonth; i++) {
          const prevMonthIndex = prevMonthRecords.length - daysFromPrevMonth + i;
          if (prevMonthIndex >= 0 && prevMonthIndex < prevMonthRecords.length) {
            restHours += calculateHoursOfRest24hr(prevMonthRecords[prevMonthIndex].hours);
          } else {
            missingDays++;
          }
        }
      } else {
        // No previous month data - assume rest
        missingDays += daysFromPrevMonth;
      }
      
      // Add days from current month (from day 0 to current day)
      for (let i = 0; i <= dayIndex; i++) {
        restHours += calculateHoursOfRest24hr(records[i].hours);
      }
    } else {
      // Window is entirely within current month
      for (let i = windowStart; i <= dayIndex; i++) {
        restHours += calculateHoursOfRest24hr(records[i].hours);
      }
    }
    
    // If we have missing days (no data available), assume rest
    restHours += missingDays * 24;
    
    // Work hours = Total 7-day hours (168) minus rest hours
    const workHours = 168 - restHours;
    
    return {
      anyPeriodRest7day: restHours,
      anyPeriodWork7day: workHours,
    };
  };

  // Helper: Calculate "any period" 72-hour window metrics (for OPA Code 8) - backward-looking only
  // For each half-hour in the current day, check the 72-hour window ending at that point
  const calculateAnyPeriod72hr = (records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []) => {
    // Build a continuous array of cells from previous 3 days + current day
    // This gives us 192 cells to work with (48 × 4 days)
    const allCells: string[] = [];
    
    // Add previous 3 days' cells (or use previous month data if days don't exist in current month)
    for (let i = 3; i >= 1; i--) {
      const index = dayIndex - i;
      if (index >= 0) {
        allCells.push(...records[index].hours);
      } else {
        // Day is before current month start - try to get from previous month
        const prevMonthIndex = prevMonthRecords.length + index; // index is negative, so this calculates correctly
        if (prevMonthRecords.length > 0 && prevMonthIndex >= 0 && prevMonthIndex < prevMonthRecords.length) {
          allCells.push(...prevMonthRecords[prevMonthIndex].hours);
        } else {
          // No previous month data available - assume rest
          allCells.push(...Array(48).fill(''));
        }
      }
    }
    
    // Add current day's cells
    allCells.push(...records[dayIndex].hours);
    
    // Current day occupies cells 144-191 (after 3 prior days × 48 cells each)
    // For each half-hour in current day (cells 144-191), check the 72-hour window ending at that point
    // Window ending at cell E starts at cell E-143 (144 cells total including E)
    let maxWork = 0;  // Maximum work hours found in any backward-looking 72-hour window
    
    for (let endCell = 144; endCell <= 191; endCell++) {
      // Window ends at endCell and starts 143 cells before (144 cells total)
      const startCell = endCell - 143;
      const windowCells = allCells.slice(startCell, endCell + 1);
      
      // Only process if we have a full 144-cell window
      if (windowCells.length === 144) {
        // Count work cells in this window
        const workCells = windowCells.filter(c => c !== '').length;
        const workHours = workCells / 2; // Each cell = 0.5 hours
        
        maxWork = Math.max(maxWork, workHours);
      }
    }
    
    return maxWork;
  };

  // Helper: Check if any 24-hour window violates Code 4 (interval between rest periods) - backward-looking only
  // Code 4: Interval between rest periods must not exceed 14 hours
  const checkViolationCode4 = (records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []): boolean => {
    // Build a continuous array of all cells from previous day + current day
    const allCells: string[] = [];
    
    // Add previous day's cells
    if (dayIndex > 0) {
      allCells.push(...records[dayIndex - 1].hours);
    } else {
      // Current day is first day of month - use previous month's last day
      if (prevMonthRecords.length > 0) {
        const lastDayOfPrevMonth = prevMonthRecords[prevMonthRecords.length - 1];
        allCells.push(...lastDayOfPrevMonth.hours);
      } else {
        // No previous month data - assume rest
        allCells.push(...Array(48).fill(''));
      }
    }
    
    // Add current day's cells
    allCells.push(...records[dayIndex].hours);
    
    // Current day occupies cells 48-95
    // For each half-hour in current day, check the 24-hour window ending at that point
    for (let endCell = 48; endCell <= 95; endCell++) {
      const startCell = endCell - 47;
      const windowCells = allCells.slice(startCell, endCell + 1);
      
      // Find all rest periods and the gaps between them
      let currentWorkGap = 0;
      let inRestPeriod = false;
      
      for (let i = 0; i < windowCells.length; i++) {
        const isRest = windowCells[i] === '';
        
        if (isRest) {
          // Currently in rest
          if (!inRestPeriod) {
            // Just entered a rest period - check if previous work gap exceeded 14 hours
            if (currentWorkGap > 28) { // 28 cells = 14 hours
              return true; // Violation found!
            }
            currentWorkGap = 0;
            inRestPeriod = true;
          }
        } else {
          // Currently working (w, d, or a)
          if (inRestPeriod) {
            // Just exited a rest period
            inRestPeriod = false;
          }
          currentWorkGap++;
        }
      }
      
      // Check if window ended with a work gap that exceeded 14 hours
      if (currentWorkGap > 28) {
        return true; // Violation found!
      }
    }
    
    // No violation found in any window
    return false;
  };

  // Helper: Check if any 24-hour window violates Code 3 (rest period distribution) - backward-looking only
  // Code 3: The two largest rest periods must sum to ≥10 hours, and at least one must be ≥6 hours
  // Returns diagnostic info if violation found, null otherwise
  const checkViolationCode3 = (records: DailyRecord[], dayIndex: number, selectedPeriod: string, prevMonthRecords: DailyRecord[] = []): ViolationDiagnostic | null => {
    // Build a continuous array of all cells from previous day + current day
    const allCells: string[] = [];
    const currentDay = records[dayIndex].day;
    
    // Add previous day's cells
    if (dayIndex > 0) {
      allCells.push(...records[dayIndex - 1].hours);
    } else {
      // Current day is first day of month - use previous month's last day
      if (prevMonthRecords.length > 0) {
        const lastDayOfPrevMonth = prevMonthRecords[prevMonthRecords.length - 1];
        allCells.push(...lastDayOfPrevMonth.hours);
      } else {
        // No previous month data - assume rest
        allCells.push(...Array(48).fill(''));
      }
    }
    
    // Add current day's cells
    allCells.push(...records[dayIndex].hours);
    
    // Current day occupies cells 48-95
    // For each half-hour in current day, check the 24-hour window ending at that point
    // Window ending at cell E starts at cell E-47 (48 cells total including E)
    for (let endCell = 48; endCell <= 95; endCell++) {
      const startCell = endCell - 47;
      const windowCells = allCells.slice(startCell, endCell + 1);
      
      // Identify continuous rest periods in this window
      const restPeriods: number[] = []; // Each element is the length of a rest period in cells
      let currentPeriodLength = 0;
      
      for (let i = 0; i < windowCells.length; i++) {
        if (windowCells[i] === '') {
          // Rest cell - extend current period
          currentPeriodLength++;
        } else {
          // Work cell - end current period if it exists
          if (currentPeriodLength > 0) {
            restPeriods.push(currentPeriodLength);
            currentPeriodLength = 0;
          }
        }
      }
      
      // Don't forget the last period if window ends with rest
      if (currentPeriodLength > 0) {
        restPeriods.push(currentPeriodLength);
      }
      
      // Calculate window start time
      // allCells = [prev day 48 cells (0-47)] + [current day 48 cells (48-95)]
      // If startCell < 48, window starts in previous day
      // If startCell >= 48, window starts in current day
      const [year, month] = selectedPeriod.split('-').map(Number);
      
      let windowStart: string;
      let windowStartHour: number;
      let windowStartMin: number;
      
      if (startCell < 48) {
        // Window starts in previous day
        windowStartHour = Math.floor(startCell / 2);
        windowStartMin = (startCell % 2) * 30;
        
        if (dayIndex > 0) {
          // Previous day is in the same month
          const prevDay = records[dayIndex - 1].day;
          const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'short' });
          windowStart = `${monthName} ${prevDay}, ${String(windowStartHour).padStart(2, '0')}:${String(windowStartMin).padStart(2, '0')}`;
        } else {
          // Previous day is in the previous month - use prevMonthRecords
          if (prevMonthRecords.length > 0) {
            const lastDayOfPrevMonth = prevMonthRecords[prevMonthRecords.length - 1].day;
            // Calculate previous month name
            const prevMonthDate = new Date(year, month - 2); // month-2 because month is 1-indexed
            const prevMonthName = prevMonthDate.toLocaleString('en-US', { month: 'short' });
            windowStart = `${prevMonthName} ${lastDayOfPrevMonth}, ${String(windowStartHour).padStart(2, '0')}:${String(windowStartMin).padStart(2, '0')}`;
          } else {
            // Fallback: show as "Previous month"
            windowStart = `Previous month, ${String(windowStartHour).padStart(2, '0')}:${String(windowStartMin).padStart(2, '0')}`;
          }
        }
      } else {
        // Window starts in current day
        const currentDayCell = startCell - 48;
        windowStartHour = Math.floor(currentDayCell / 2);
        windowStartMin = (currentDayCell % 2) * 30;
        const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'short' });
        windowStart = `${monthName} ${currentDay}, ${String(windowStartHour).padStart(2, '0')}:${String(windowStartMin).padStart(2, '0')}`;
      }
      
      // Check violation conditions
      // The rule: The two largest rest periods must sum to ≥10 hours (20 cells)
      // AND at least one of those two must be ≥6 hours (12 cells)
      
      if (restPeriods.length === 0) {
        // No rest periods at all - violation!
        return {
          code: 3,
          windowStart,
          reason: `No rest periods found in this 24-hour window`
        };
      }
      
      // Sort rest periods by duration (descending - largest first)
      const sortedPeriods = [...restPeriods].sort((a, b) => b - a);
      const periodsInHours = sortedPeriods.map(p => (p / 2).toFixed(1));
      
      if (restPeriods.length === 1) {
        // Single rest period - it must be ≥10 hours (20 cells) to satisfy the requirement
        const singlePeriod = sortedPeriods[0];
        if (singlePeriod < 20) {
          // Single period is less than 10 hours - violation!
          return {
            code: 3,
            windowStart,
            reason: `Single rest period: ${periodsInHours[0]}h (< 10h required)`
          };
        }
      } else {
        // Multiple rest periods - check the two largest
        const largest = sortedPeriods[0];
        const secondLargest = sortedPeriods[1];
        
        // Check if the two largest periods satisfy the requirements
        const sumOfTopTwo = largest + secondLargest;
        const hasLongPeriod = largest >= 12 || secondLargest >= 12;
        
        if (sumOfTopTwo < 20 || !hasLongPeriod) {
          // Violation: Either the top 2 periods don't sum to ≥10 hours (20 cells)
          // OR neither of the top 2 is ≥6 hours (12 cells)
          const sumHours = (sumOfTopTwo / 2).toFixed(1);
          const topTwoHours = [periodsInHours[0], periodsInHours[1]].join('h + ') + 'h';
          
          let reason = `Rest periods: ${periodsInHours.join('h, ')}h. Top 2: ${topTwoHours} = ${sumHours}h`;
          if (sumOfTopTwo < 20) {
            reason += ' (< 10h required)';
          } else {
            reason += ' (neither ≥ 6h required)';
          }
          
          return {
            code: 3,
            windowStart,
            reason
          };
        }
      }
    }
    
    // No violation found in any window
    return null;
  };

  // Helper: Format window start string from violating range
  const formatWindowStart = (range: { startCell: number; startDay: number; monthName?: string }, record: DailyRecord, monthYear: string): string => {
    const hour = Math.floor(range.startCell / 2);
    const minute = (range.startCell % 2) * 30;
    
    const monthName = range.monthName || new Date(parseInt(monthYear.split('-')[0]), parseInt(monthYear.split('-')[1]) - 1).toLocaleString('en-US', { month: 'short' });
    
    return `${monthName} ${range.startDay}, ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Helper: Detect violations
  // NOTE: Using "any period" values for regulatory compliance as per ILO/MLC requirements
  // NOTE: All 8 violation codes are ALWAYS calculated. Codes 7 & 8 (OPA-specific) are filtered in the UI display.
  const detectViolations = (record: DailyRecord, records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []): { violations: number[]; diagnostics: ViolationDiagnostic[] } => {
    const violations: number[] = [];
    const diagnostics: ViolationDiagnostic[] = [];
    
    // Get 24hr calculation with violating windows
    const anyPeriod24Data = calculateAnyPeriod24hr(records, dayIndex, selectedPeriod, prevMonthRecords);
    
    // Rule [1]: Minimum 10 hours rest in ANY 24hr period
    if (record.anyPeriodRest24hr < 10 && anyPeriod24Data.violatingRestWindows.length > 0) {
      violations.push(1);
      
      // Convert violating windows to ranges
      const violatingRanges = anyPeriod24Data.violatingRestWindows.map(w => {
        // startCell is in the combined array (0-95), need to convert to day context
        // Cells 0-47 are from previous day, 48-95 are from current day
        const isStartInPrevDay = w.startCell < 48;
        const endCell = w.startCell + 47; // 24-hour window
        
        return {
          startCell: isStartInPrevDay ? w.startCell : w.startCell - 48,
          endCell: endCell >= 48 ? endCell - 48 : 47,
          startDay: isStartInPrevDay ? anyPeriod24Data.prevDayNumber : record.day,
          monthName: isStartInPrevDay ? anyPeriod24Data.prevMonthName : undefined,
        };
      });
      
      diagnostics.push({
        code: 1,
        windowStart: violatingRanges.length === 1 
          ? formatWindowStart(violatingRanges[0], record, selectedPeriod)
          : 'Multiple windows',
        reason: `Minimum rest in any 24hr period: ${record.anyPeriodRest24hr.toFixed(1)}h (< 10h required)`,
        violatingRanges,
      });
    }
    
    // Rule [2]: Minimum 77 hours rest in ANY 7-day period
    if (record.anyPeriodRest7day < 77) {
      violations.push(2);
      diagnostics.push({
        code: 2,
        windowStart: 'Various windows',
        reason: `Minimum rest in any 7-day period: ${record.anyPeriodRest7day.toFixed(1)}h (< 77h required)`
      });
    }
    
    // Rule [3]: The two largest rest periods must sum to ≥10 hours, and at least one must be ≥6 hours
    const code3Diagnostic = checkViolationCode3(records, dayIndex, selectedPeriod, prevMonthRecords);
    if (code3Diagnostic) {
      violations.push(3);
      diagnostics.push(code3Diagnostic);
    }
    
    // Rule [4]: Interval between rest periods must not exceed 14 hours
    if (checkViolationCode4(records, dayIndex, prevMonthRecords)) {
      violations.push(4);
      diagnostics.push({
        code: 4,
        windowStart: 'Various windows',
        reason: 'Work interval between rest periods exceeds 14 hours'
      });
    }
    
    // Rule [5]: Maximum 14 hours work in ANY 24hr period
    if (record.anyPeriodWork24hr > 14 && anyPeriod24Data.violatingWorkWindows.length > 0) {
      violations.push(5);
      
      // Convert violating windows to ranges
      const violatingRanges = anyPeriod24Data.violatingWorkWindows.map(w => {
        const isStartInPrevDay = w.startCell < 48;
        const endCell = w.startCell + 47;
        
        return {
          startCell: isStartInPrevDay ? w.startCell : w.startCell - 48,
          endCell: endCell >= 48 ? endCell - 48 : 47,
          startDay: isStartInPrevDay ? anyPeriod24Data.prevDayNumber : record.day,
          monthName: isStartInPrevDay ? anyPeriod24Data.prevMonthName : undefined,
        };
      });
      
      diagnostics.push({
        code: 5,
        windowStart: violatingRanges.length === 1 
          ? formatWindowStart(violatingRanges[0], record, selectedPeriod)
          : 'Multiple windows',
        reason: `Maximum work in any 24hr period: ${record.anyPeriodWork24hr.toFixed(1)}h (> 14h limit)`,
        violatingRanges,
      });
    }
    
    // Rule [6]: Maximum 72 hours work in ANY 7-day period
    if (record.anyPeriodWork7day > 72) {
      violations.push(6);
      diagnostics.push({
        code: 6,
        windowStart: 'Various windows',
        reason: `Maximum work in any 7-day period: ${record.anyPeriodWork7day.toFixed(1)}h (> 72h limit)`
      });
    }
    
    // Rule [7]: Maximum 15 hours work in ANY 24hr period (OPA-specific, filtered in UI)
    if (record.anyPeriodWork24hr > 15) {
      violations.push(7);
      
      // Find all windows that violate the 15-hour OPA limit
      const violating15hrWindows = anyPeriod24Data.violatingWorkWindows.filter(w => w.workHours > 15);
      
      if (violating15hrWindows.length > 0) {
        const violatingRanges = violating15hrWindows.map(w => {
          const isStartInPrevDay = w.startCell < 48;
          const endCell = w.startCell + 47;
          
          return {
            startCell: isStartInPrevDay ? w.startCell : w.startCell - 48,
            endCell: endCell >= 48 ? endCell - 48 : 47,
            startDay: isStartInPrevDay ? anyPeriod24Data.prevDayNumber : record.day,
            monthName: isStartInPrevDay ? anyPeriod24Data.prevMonthName : undefined,
          };
        });
        
        diagnostics.push({
          code: 7,
          windowStart: violatingRanges.length === 1 
            ? formatWindowStart(violatingRanges[0], record, selectedPeriod)
            : 'Multiple windows',
          reason: `Maximum work in any 24hr period: ${record.anyPeriodWork24hr.toFixed(1)}h (> 15h OPA limit)`,
          violatingRanges,
        });
      } else {
        diagnostics.push({
          code: 7,
          windowStart: 'Various windows',
          reason: `Maximum work in any 24hr period: ${record.anyPeriodWork24hr.toFixed(1)}h (> 15h OPA limit)`
        });
      }
    }
    
    // Rule [8]: Maximum 36 hours work in ANY 72hr period (OPA-specific, filtered in UI)
    const maxWork72hr = calculateAnyPeriod72hr(records, dayIndex, prevMonthRecords);
    if (maxWork72hr > 36) {
      violations.push(8);
      diagnostics.push({
        code: 8,
        windowStart: 'Various windows',
        reason: `Maximum work in any 72hr period: ${maxWork72hr.toFixed(1)}h (> 36h OPA limit)`
      });
    }
    
    return { violations, diagnostics };
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
        
        // Recalculate 24hr metrics
        record.hoursOfRest24hr = calculateHoursOfRest24hr(record.hours);
        record.hoursOfWork24hr = calculateHoursOfWork24hr(record.hours);
        
        newRecords[dayIndex] = record;
        
        // Recalculate rolling metrics for all affected days
        for (let i = dayIndex; i < newRecords.length && i < dayIndex + 7; i++) {
          const metrics = calculateRollingMetrics(newRecords, i);
          const anyPeriod24hr = calculateAnyPeriod24hr(newRecords, i, selectedPeriod, previousMonthRecords);
          const anyPeriod7day = calculateAnyPeriod7day(newRecords, i, previousMonthRecords);
          
          newRecords[i] = {
            ...newRecords[i],
            ...metrics,
            ...anyPeriod24hr,
            ...anyPeriod7day,
          };
          
          // Detect violations
          const { violations, diagnostics } = detectViolations(newRecords[i], newRecords, i, previousMonthRecords);
          newRecords[i].violations = violations;
          newRecords[i].violationDiagnostics = diagnostics;
        }
      }
      
      return newRecords;
    });
  }, [previousMonthRecords, selectedPeriod, recordMode]);

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
    if (diagnostic.windowStart === 'Various windows' || diagnostic.windowStart === 'Multiple windows') return false;
    
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <DialogTitle className="text-lg font-semibold text-center flex-1">
              RH Recording Form
            </DialogTitle>
            <div className="flex-1 flex items-center justify-end gap-4">
              <span className="text-base font-medium text-[#4a90e2]">{monthDisplay}</span>
              <Button
                variant="outline"
                onClick={handleClear}
                className="h-8 px-3 text-xs"
                data-testid="button-clear-form"
              >
                Clear
              </Button>
            </div>
          </div>
        </DialogHeader>

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
              onValueChange={setSelectedVesselId}
            >
              <SelectTrigger className="h-8 w-48 text-xs" data-testid="select-vessel">
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
                  <SelectItem key={cm.id} value={cm.id}>
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

          <div className="flex items-center gap-1 ml-4">
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
              {dailyRecords.map((record, dayIndex) => (
                <tr key={dayIndex}>
                  {/* Plan/Rec Button */}
                  <td className="border border-gray-300 text-center" style={{ padding: '2px' }}>
                    <button
                      onClick={() => handleTogglePlanRec(dayIndex)}
                      className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                      data-testid={`button-plan-rec-${dayIndex}`}
                    >
                      {record.isPlan ? 'Plan' : 'Rec'}
                    </button>
                  </td>
                  
                  {/* Date */}
                  <td className="border border-gray-300 text-center" style={{ padding: '2px' }}>
                    {record.day}
                  </td>
                  
                  {/* Day of Week */}
                  <td className="border border-gray-300 text-center" style={{ padding: '2px' }}>
                    {record.dayOfWeek}
                  </td>
                  
                  {/* 48 Half-Hour Columns (2 cells per hour) */}
                  {record.hours.map((hour, hourIndex) => {
                    const isSecondHalf = hourIndex % 2 === 1;
                    const borderRight = isSecondHalf ? 'border-gray-300' : 'border-gray-200';
                    const isHighlighted = shouldHighlightCell(dayIndex, hourIndex);
                    
                    return (
                      <td
                        key={hourIndex}
                        className={`border-t border-b border-l text-center ${isSecondHalf ? 'border-r' : ''}`}
                        style={{
                          padding: '2px',
                          backgroundColor: getCellColor(record.isPlan, hour),
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
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const value = e.currentTarget.textContent || '';
                            handleHourCellEdit(dayIndex, hourIndex, value);
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
                              
                              let targetDay = dayIndex;
                              let targetHour = hourIndex;
                              
                              if (e.key === 'ArrowRight') {
                                targetHour++;
                                if (targetHour >= 48) {
                                  targetHour = 0;
                                  targetDay++;
                                }
                              } else if (e.key === 'ArrowLeft') {
                                targetHour--;
                                if (targetHour < 0) {
                                  targetHour = 47;
                                  targetDay--;
                                }
                              } else if (e.key === 'ArrowDown') {
                                targetDay++;
                              } else if (e.key === 'ArrowUp') {
                                targetDay--;
                              }
                              
                              // Check if target is valid
                              if (targetDay >= 0 && targetDay < dailyRecords.length) {
                                const targetCell = document.querySelector(
                                  `[data-testid="cell-hour-${targetDay}-${targetHour}"]`
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
                          data-testid={`cell-hour-${dayIndex}-${hourIndex}`}
                        >
                          {(showPlanning || !record.isPlan) ? hour : ''}
                        </div>
                      </td>
                    );
                  })}
                  
                  {/* Hours of Rest (Calendar Day) */}
                  <td className={`border border-gray-300 text-center ${record.isPlan ? 'font-light text-gray-400' : ''}`} style={{ padding: '2px' }}>
                    {record.hoursOfRest24hr}
                  </td>
                  
                  {/* Violations */}
                  <td className={`border border-gray-300 text-center font-semibold ${record.isPlan ? 'text-gray-500' : 'text-red-600'}`} style={{ padding: '2px' }}>
                    {(() => {
                      // Hide predicted violations (from plan rows) when Show Planning is unchecked
                      if (record.isPlan && !showPlanning) return '';
                      
                      const visibleViolations = filterViolations(record.violations, complianceMode, opaMode);
                      const visibleDiagnostics = record.violationDiagnostics?.filter(d => visibleViolations.includes(d.code)) || [];
                      
                      if (visibleViolations.length === 0) return '';
                      
                      // If no diagnostics available, just show the codes
                      if (visibleDiagnostics.length === 0) {
                        return `[${visibleViolations.join(', ')}]`;
                      }
                      
                      // Show individual codes with hover functionality for highlighting
                      return (
                        <span className="flex flex-wrap gap-0.5 justify-center">
                          [
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
                                      onMouseEnter={() => setHoveredViolation({ dayIndex, code })}
                                      onMouseLeave={() => setHoveredViolation(null)}
                                    >
                                      {code}{idx < visibleViolations.length - 1 ? ', ' : ''}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md">
                                    <div className="text-sm space-y-1">
                                      <div>{VIOLATION_CODE_DESCRIPTIONS[diagnostic.code]}</div>
                                      <div className="text-xs text-gray-600">{diagnostic.reason}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                          ]
                        </span>
                      );
                    })()}
                  </td>
                  
                  {/* Comments */}
                  <td className="border border-gray-300" style={{ padding: '2px' }}>
                    <input
                      type="text"
                      value={record.comments}
                      onChange={(e) => handleCommentsChange(dayIndex, e.target.value)}
                      className="w-full outline-none bg-transparent px-1"
                      data-testid={`input-comments-${dayIndex}`}
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
                        {record.anyPeriodRest24hr.toFixed(1)}
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
                        {record.anyPeriodRest7day.toFixed(1)}
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
                        {record.anyPeriodWork24hr.toFixed(1)}
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
                        {record.anyPeriodWork7day.toFixed(1)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            data-testid="button-save"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
