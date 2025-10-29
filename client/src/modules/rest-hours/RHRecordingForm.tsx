import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useVesselLookup } from '@/hooks/useVesselLookup';
import type { RestHoursDailyRecord } from '@shared/schema';

interface RHRecordingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  rank: string;
  monthValue: string; // Format: "2025-10" (YYYY-MM)
}

interface DailyRecord {
  day: number;
  dayOfWeek: string;
  hours: string[]; // 48 entries (2 per hour for 00:00-23:30), values: "w", "d", "a", "" (blank = rest)
  isPlan: boolean;
  comments: string;
  violations: number[];
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
  const [showPlanning, setShowPlanning] = useState(false);
  const [opaMode, setOpaMode] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [previousMonthRecords, setPreviousMonthRecords] = useState<DailyRecord[]>([]);
  const [formId, setFormId] = useState<number | null>(null);
  
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

  // Initialize daily records for the month - reset when crew/vessel/month changes or modal opens
  useEffect(() => {
    if (!selectedPeriod || !open) return;
    
    // Reset all form state to clean slate
    setFormId(null);
    setShowPlanning(false);
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

  // Load previous month's records for cross-month calculations
  useEffect(() => {
    if (!open || !previousMonthRecord) {
      setPreviousMonthRecords([]);
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

  // Load existing record data or explicitly maintain clean state
  useEffect(() => {
    if (!open) return; // Skip if modal is closed
    
    if (existingRecord) {
      // Existing record found - load it
      setFormId(existingRecord.id);
      setShowPlanning(existingRecord.showPlanning || false);
      setOpaMode(existingRecord.opaMode || false);
      
      try {
        const parsedRecords = JSON.parse(existingRecord.dailyRecords);
        // Ensure all records have the any-period fields (for backward compatibility)
        // and recalculate them to ensure accuracy
        const updatedRecords = parsedRecords.map((record: DailyRecord, index: number) => {
          // Calculate any-period metrics for this record
          const anyPeriod24 = calculateAnyPeriod24hr(parsedRecords, index, previousMonthRecords);
          const anyPeriod7day = calculateAnyPeriod7day(parsedRecords, index, previousMonthRecords);
          
          return {
            ...record,
            anyPeriodRest24hr: anyPeriod24.anyPeriodRest24hr,
            anyPeriodRest7day: anyPeriod7day.anyPeriodRest7day,
            anyPeriodWork24hr: anyPeriod24.anyPeriodWork24hr,
            anyPeriodWork7day: anyPeriod7day.anyPeriodWork7day,
          };
        });
        
        // Recalculate violations for all records to ensure new rules are applied
        const recordsWithViolations = updatedRecords.map((record: DailyRecord, index: number) => ({
          ...record,
          violations: detectViolations(record, updatedRecords, index, previousMonthRecords),
        }));
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
        const anyPeriod24 = calculateAnyPeriod24hr(prevRecords, index, previousMonthRecords);
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
      return updatedRecords.map((record, index) => ({
        ...record,
        violations: detectViolations(record, updatedRecords, index, previousMonthRecords),
      }));
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
    setShowPlanning(false);
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

  // Helper: Calculate "any period" 24-hour window metrics (rolling window starting at each half-hour)
  const calculateAnyPeriod24hr = (records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []) => {
    // Build a continuous array of all cells from previous day + current day + next day
    // This gives us 144 cells to work with (48 × 3 days)
    // We need next day to check windows starting late in current day that extend 24 hours forward
    const allCells: string[] = [];
    
    // Add previous day's cells
    if (dayIndex > 0) {
      // Previous day exists in current month
      allCells.push(...records[dayIndex - 1].hours);
    } else {
      // Current day is the first day of the month - use previous month's last day
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
    
    // Add next day's cells
    if (dayIndex + 1 < records.length) {
      // Next day exists in current month
      allCells.push(...records[dayIndex + 1].hours);
    } else {
      // Current day is the last day of the month - assume rest for next day
      // (we don't fetch next month's data for forward-looking windows)
      allCells.push(...Array(48).fill(''));
    }
    
    // Current day occupies cells 48-95 (after previous day's 48 cells)
    // Check all 24-hour windows that overlap with the current day
    // A window starting at cell S overlaps current day if:
    //   - It ends at or after cell 48: S + 47 >= 48, so S >= 1
    //   - It starts at or before cell 95: S <= 95
    // Therefore, check windows starting from cell 1 to cell 95
    let minRest = 24;  // Minimum rest hours found
    let maxWork = 0;   // Maximum work hours found
    
    for (let startCell = 1; startCell <= 95; startCell++) {
      // Window is 48 cells (24 hours) starting from startCell
      const windowCells = allCells.slice(startCell, startCell + 48);
      
      // Only process if we have a full 48-cell window
      if (windowCells.length === 48) {
        // Count rest cells in this window
        const restCells = windowCells.filter(c => c === '').length;
        const restHours = restCells / 2; // Each cell = 0.5 hours
        const workHours = 24 - restHours;
        
        minRest = Math.min(minRest, restHours);
        maxWork = Math.max(maxWork, workHours);
      }
    }
    
    return {
      anyPeriodRest24hr: minRest,
      anyPeriodWork24hr: maxWork,
    };
  };

  // Helper: Calculate "any period" 7-day window metrics
  const calculateAnyPeriod7day = (records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []) => {
    // We need to check all possible 7-day windows that include the current day
    // This includes windows that may span across month boundaries
    
    let minRest = 168;  // Minimum rest hours in any 7-day period
    let maxWork = 0;    // Maximum work hours in any 7-day period
    
    // Check all possible 7-day windows ending on or after the current day
    // Window can start up to 6 days before current day
    const daysNeededBefore = 6;
    const daysAvailableInCurrentMonth = dayIndex; // days 0 to dayIndex-1
    const daysNeededFromPrevMonth = Math.max(0, daysNeededBefore - daysAvailableInCurrentMonth);
    
    // For each possible 7-day window that includes current day
    for (let offset = 0; offset <= 6; offset++) {
      // Window ends at dayIndex + offset (if exists)
      const windowEnd = dayIndex + offset;
      if (windowEnd >= records.length) continue; // Window would extend beyond current month
      
      // Window starts 6 days before window end
      const windowStart = windowEnd - 6;
      
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
        
        // Add days from current month (starting from day 0)
        for (let i = 0; i <= windowEnd; i++) {
          restHours += calculateHoursOfRest24hr(records[i].hours);
        }
      } else {
        // Window is entirely within current month
        for (let i = windowStart; i <= windowEnd; i++) {
          restHours += calculateHoursOfRest24hr(records[i].hours);
        }
      }
      
      // If we have missing days (no data available), assume rest
      restHours += missingDays * 24;
      
      // Work hours = Total 7-day hours (168) minus rest hours
      const workHours = 168 - restHours;
      
      minRest = Math.min(minRest, restHours);
      maxWork = Math.max(maxWork, workHours);
    }
    
    return {
      anyPeriodRest7day: minRest,
      anyPeriodWork7day: maxWork,
    };
  };

  // Helper: Calculate "any period" 72-hour window metrics (for OPA Code 8)
  const calculateAnyPeriod72hr = (records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []) => {
    // Build a continuous array of cells from previous 3 days + current day + next 3 days
    // This gives us 336 cells to work with (48 × 7 days)
    // We need 3 future days to check windows starting late in current day that extend 72 hours forward
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
    
    // Add next 3 days' cells (or assume rest if they don't exist)
    // We need 3 future days to check windows starting late in current day
    for (let i = 1; i <= 3; i++) {
      const futureIndex = dayIndex + i;
      if (futureIndex < records.length) {
        allCells.push(...records[futureIndex].hours);
      } else {
        // Days after the end of the month = assume rest
        allCells.push(...Array(48).fill(''));
      }
    }
    
    // Check all 72-hour windows (144 cells = 72 hours) that OVERLAP the current day
    // Current day occupies cells 144-191 (after 3 prior days)
    // A window starting at cell S (ending at S+143) overlaps current day if:
    //   - It ends at or after cell 144: S + 143 >= 144, so S >= 1
    //   - It starts at or before cell 191: S <= 191
    // Therefore, check windows starting from cell 1 to cell 191
    let maxWork = 0;  // Maximum work hours found in any overlapping 72-hour window
    
    const currentDayStart = 144;  // Current day starts at cell 144 (after 3 days × 48 cells)
    const currentDayEnd = 191;    // Current day ends at cell 191
    
    for (let startCell = 1; startCell <= currentDayEnd; startCell++) {
      // Window is 144 cells (72 hours) starting from startCell
      const windowCells = allCells.slice(startCell, startCell + 144);
      
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

  // Helper: Check if any 24-hour window violates Code 4 (interval between rest periods)
  // Code 4: Interval between rest periods must not exceed 14 hours
  const checkViolationCode4 = (records: DailyRecord[], dayIndex: number): boolean => {
    // Build a continuous array of all cells from previous day + current day
    const allCells: string[] = [];
    
    // Add previous day's cells (or assume rest if no previous day)
    if (dayIndex > 0) {
      allCells.push(...records[dayIndex - 1].hours);
    } else {
      allCells.push(...Array(48).fill(''));
    }
    
    // Add current day's cells
    allCells.push(...records[dayIndex].hours);
    
    // Check all 49 possible 24-hour windows
    for (let startCell = 0; startCell <= 48; startCell++) {
      const windowCells = allCells.slice(startCell, startCell + 48);
      
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

  // Helper: Check if any 24-hour window violates Code 3 (rest period distribution)
  // Code 3: Rest periods must be no more than 2, and at least one must be ≥6 hours
  const checkViolationCode3 = (records: DailyRecord[], dayIndex: number): boolean => {
    // Build a continuous array of all cells from previous day + current day
    const allCells: string[] = [];
    
    // Add previous day's cells (or assume rest if no previous day)
    if (dayIndex > 0) {
      allCells.push(...records[dayIndex - 1].hours);
    } else {
      allCells.push(...Array(48).fill(''));
    }
    
    // Add current day's cells
    allCells.push(...records[dayIndex].hours);
    
    // Check all 49 possible 24-hour windows
    for (let startCell = 0; startCell <= 48; startCell++) {
      const windowCells = allCells.slice(startCell, startCell + 48);
      
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
      
      // Check violation conditions
      // The rule requires at least one rest period ≥6 hours (12 cells)
      
      if (restPeriods.length === 0) {
        // No rest periods at all - violation!
        return true;
      }
      
      if (restPeriods.length === 1) {
        // Only 1 rest period - check if it's ≥6 hours (12 cells)
        if (restPeriods[0] < 12) {
          // Single rest period is too short - violation!
          return true;
        }
      }
      
      if (restPeriods.length === 2) {
        // Exactly 2 periods - check if at least one is ≥6 hours (12 cells)
        const hasLongPeriod = restPeriods.some(period => period >= 12);
        if (!hasLongPeriod) {
          // Neither period is ≥6 hours - violation!
          return true;
        }
      }
      
      if (restPeriods.length > 2) {
        // More than 2 rest periods - violation!
        return true;
      }
    }
    
    // No violation found in any window
    return false;
  };

  // Helper: Detect violations
  // NOTE: Using "any period" values for regulatory compliance as per ILO/MLC requirements
  // NOTE: All 8 violation codes are ALWAYS calculated. Codes 7 & 8 (OPA-specific) are filtered in the UI display.
  const detectViolations = (record: DailyRecord, records: DailyRecord[], dayIndex: number, prevMonthRecords: DailyRecord[] = []): number[] => {
    const violations: number[] = [];
    
    // Rule [1]: Minimum 10 hours rest in ANY 24hr period
    if (record.anyPeriodRest24hr < 10) {
      violations.push(1);
    }
    
    // Rule [2]: Minimum 77 hours rest in ANY 7-day period
    if (record.anyPeriodRest7day < 77) {
      violations.push(2);
    }
    
    // Rule [3]: Rest periods must be no more than 2, and at least one must be ≥6 hours
    if (checkViolationCode3(records, dayIndex)) {
      violations.push(3);
    }
    
    // Rule [4]: Interval between rest periods must not exceed 14 hours
    if (checkViolationCode4(records, dayIndex)) {
      violations.push(4);
    }
    
    // Rule [5]: Maximum 14 hours work in ANY 24hr period
    if (record.anyPeriodWork24hr > 14) {
      violations.push(5);
    }
    
    // Rule [6]: Maximum 72 hours work in ANY 7-day period
    if (record.anyPeriodWork7day > 72) {
      violations.push(6);
    }
    
    // Rule [7]: Maximum 15 hours work in ANY 24hr period (OPA-specific, filtered in UI)
    if (record.anyPeriodWork24hr > 15) {
      violations.push(7);
    }
    
    // Rule [8]: Maximum 36 hours work in ANY 72hr period (OPA-specific, filtered in UI)
    const maxWork72hr = calculateAnyPeriod72hr(records, dayIndex, prevMonthRecords);
    if (maxWork72hr > 36) {
      violations.push(8);
    }
    
    return violations;
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
        
        // Recalculate 24hr metrics
        record.hoursOfRest24hr = calculateHoursOfRest24hr(record.hours);
        record.hoursOfWork24hr = calculateHoursOfWork24hr(record.hours);
        
        newRecords[dayIndex] = record;
        
        // Recalculate rolling metrics for all affected days
        for (let i = dayIndex; i < newRecords.length && i < dayIndex + 7; i++) {
          const metrics = calculateRollingMetrics(newRecords, i);
          const anyPeriod24hr = calculateAnyPeriod24hr(newRecords, i, previousMonthRecords);
          const anyPeriod7day = calculateAnyPeriod7day(newRecords, i, previousMonthRecords);
          
          newRecords[i] = {
            ...newRecords[i],
            ...metrics,
            ...anyPeriod24hr,
            ...anyPeriod7day,
          };
          
          // Detect violations
          newRecords[i].violations = detectViolations(newRecords[i], newRecords, i, previousMonthRecords);
        }
      }
      
      return newRecords;
    });
  }, [previousMonthRecords]);

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
    if (isPlan && value !== '') {
      return '#E5E7EB'; // Grey for plan
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

          <div className="flex items-center gap-2 ml-auto">
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
                  <th key={i} rowSpan={2} colSpan={2} className="border border-gray-300 p-0.5 min-w-[40px]" style={{ padding: '2px' }}>
                    {i.toString().padStart(2, '0')}
                  </th>
                ))}
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[80px]" style={{ padding: '2px' }}>
                  Hours of Rest in 24hr period
                </th>
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[80px]" style={{ padding: '2px' }}>
                  Violations
                </th>
                <th rowSpan={2} className="border border-gray-300 p-0.5 min-w-[150px]" style={{ padding: '2px' }}>
                  Comments
                </th>
                <th colSpan={2} className="border border-gray-300 p-0.5 bg-blue-50" style={{ padding: '2px' }}>
                  Hours of Rest in any
                </th>
                <th colSpan={2} className="border border-gray-300 p-0.5 bg-blue-50" style={{ padding: '2px' }}>
                  Hours of Work in any
                </th>
              </tr>
              {/* Header Row 2 */}
              <tr>
                <th className="border border-gray-300 p-0.5 min-w-[70px] bg-blue-50" style={{ padding: '2px' }}>
                  24 Hr Period
                </th>
                <th className="border border-gray-300 p-0.5 min-w-[60px] bg-blue-50" style={{ padding: '2px' }}>
                  7 days
                </th>
                <th className="border border-gray-300 p-0.5 min-w-[60px] bg-blue-50" style={{ padding: '2px' }}>
                  24 Hr Period
                </th>
                <th className="border border-gray-300 p-0.5 min-w-[60px] bg-blue-50" style={{ padding: '2px' }}>
                  7 days
                </th>
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
                          className="outline-none cursor-text min-h-[20px]"
                          style={{ width: '100%', minWidth: '15px' }}
                          data-testid={`cell-hour-${dayIndex}-${hourIndex}`}
                        >
                          {hour}
                        </div>
                      </td>
                    );
                  })}
                  
                  {/* Hours of Rest (Calendar Day) */}
                  <td className="border border-gray-300 text-center" style={{ padding: '2px' }}>
                    {record.hoursOfRest24hr}
                  </td>
                  
                  {/* Violations */}
                  <td className="border border-gray-300 text-center text-red-600 font-semibold" style={{ padding: '2px' }}>
                    {(() => {
                      const visibleViolations = record.violations.filter(v => opaMode || (v !== 7 && v !== 8));
                      return visibleViolations.length > 0 ? `[${visibleViolations.join(', ')}]` : '';
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
                  
                  {/* Any Period: Rest in 24hr */}
                  <td 
                    className="border border-gray-300 text-center bg-blue-50" 
                    style={{ 
                      padding: '2px',
                      color: record.anyPeriodRest24hr < 10 ? 'red' : 'inherit',
                      fontWeight: record.anyPeriodRest24hr < 10 ? 'bold' : 'normal'
                    }}
                  >
                    {record.anyPeriodRest24hr.toFixed(1)}
                  </td>
                  
                  {/* Any Period: Rest in 7 days */}
                  <td 
                    className="border border-gray-300 text-center bg-blue-50" 
                    style={{ 
                      padding: '2px',
                      color: record.anyPeriodRest7day < 77 ? 'red' : 'inherit',
                      fontWeight: record.anyPeriodRest7day < 77 ? 'bold' : 'normal'
                    }}
                  >
                    {record.anyPeriodRest7day.toFixed(1)}
                  </td>
                  
                  {/* Any Period: Work in 24hr */}
                  <td 
                    className="border border-gray-300 text-center bg-blue-50" 
                    style={{ 
                      padding: '2px',
                      color: record.anyPeriodWork24hr > 14 ? 'red' : 'inherit',
                      fontWeight: record.anyPeriodWork24hr > 14 ? 'bold' : 'normal'
                    }}
                  >
                    {record.anyPeriodWork24hr.toFixed(1)}
                  </td>
                  
                  {/* Any Period: Work in 7 days */}
                  <td 
                    className="border border-gray-300 text-center bg-blue-50" 
                    style={{ 
                      padding: '2px',
                      color: record.anyPeriodWork7day > 72 ? 'red' : 'inherit',
                      fontWeight: record.anyPeriodWork7day > 72 ? 'bold' : 'normal'
                    }}
                  >
                    {record.anyPeriodWork7day.toFixed(1)}
                  </td>
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
