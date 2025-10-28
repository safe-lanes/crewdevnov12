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
  crewMemberId,
  crewMemberName,
  vesselId,
  rank,
  monthValue,
}: RHRecordingFormProps): JSX.Element => {
  const { toast } = useToast();
  const { getVesselName } = useVesselLookup();
  
  // Form state
  const [showPlanning, setShowPlanning] = useState(false);
  const [opaMode, setOpaMode] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [formId, setFormId] = useState<number | null>(null);

  // Format month for display (e.g., "2024, Mar")
  const monthDisplay = useMemo(() => {
    if (!monthValue) return '';
    const [year, month] = monthValue.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleString('en-US', { month: 'short' });
    return `${year}, ${monthName}`;
  }, [monthValue]);

  // Get vessel name
  const vesselName = getVesselName(vesselId);

  // Initialize daily records for the month - reset when crew/vessel/month changes or modal opens
  useEffect(() => {
    if (!monthValue || !open) return;
    
    // Reset all form state to clean slate
    setFormId(null);
    setShowPlanning(false);
    setOpaMode(false);
    
    const [year, month] = monthValue.split('-');
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
  }, [monthValue, crewMemberId, vesselId, open]);

  // Fetch existing record if available
  const { data: existingRecord, isError } = useQuery<RestHoursDailyRecord>({
    queryKey: ['/api/rest-hours-daily-records/by-key', crewMemberId, vesselId, monthValue],
    queryFn: async () => {
      const response = await fetch(`/api/rest-hours-daily-records/by-key/${crewMemberId}/${vesselId}/${monthValue}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No existing record found
        }
        throw new Error('Failed to fetch rest hours record');
      }
      return response.json();
    },
    enabled: open && !!crewMemberId && !!vesselId && !!monthValue,
    retry: false,
    gcTime: 0, // Don't cache - each crew's data must be fresh to prevent data leakage
    staleTime: 0, // Always fetch fresh data
  });

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
        setDailyRecords(parsedRecords);
      } catch (error) {
        console.error('Failed to parse daily records:', error);
      }
    } else if (isError || existingRecord === undefined) {
      // No record found (404) or query error - state remains clean from initialization
      // This explicitly ensures no stale data leaks between crew members
      console.log('No existing record found - using clean initialized state');
    }
  }, [existingRecord, isError, open]);

  // Save mutation
  const saveMutation = useMutation<RestHoursDailyRecord, Error, any>({
    mutationFn: async (data: any) => {
      if (formId) {
        return apiRequest('PUT', `/api/rest-hours-daily-records/${formId}`, data);
      } else {
        return apiRequest('POST', '/api/rest-hours-daily-records', data);
      }
    },
    onSuccess: (data) => {
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
      crewMemberId,
      vesselId,
      rank,
      name: crewMemberName,
      monthYear: monthValue,
      dailyRecords: JSON.stringify(dailyRecords),
      showPlanning,
      opaMode,
    };
    
    saveMutation.mutate(payload);
  };

  const handleClear = () => {
    // Reset to initial state
    const [year, month] = monthValue.split('-');
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
  const calculateAnyPeriod24hr = (records: DailyRecord[], dayIndex: number) => {
    // Build a continuous array of all cells from previous day + current day
    // This gives us 96 cells to work with (48 from previous day + 48 from current day)
    const allCells: string[] = [];
    
    // Add previous day's cells (or assume rest if no previous day)
    if (dayIndex > 0) {
      allCells.push(...records[dayIndex - 1].hours);
    } else {
      // Before the first recorded day, assume all rest
      allCells.push(...Array(48).fill(''));
    }
    
    // Add current day's cells
    allCells.push(...records[dayIndex].hours);
    
    // Check all 48 possible 24-hour windows (each starting at a different half-hour)
    let minRest = 24;  // Minimum rest hours found
    let maxWork = 0;   // Maximum work hours found
    
    for (let startCell = 0; startCell < 48; startCell++) {
      // Window is 48 cells (24 hours) starting from startCell
      const windowCells = allCells.slice(startCell, startCell + 48);
      
      // Count rest cells in this window
      const restCells = windowCells.filter(c => c === '').length;
      const restHours = restCells / 2; // Each cell = 0.5 hours
      const workHours = 24 - restHours;
      
      minRest = Math.min(minRest, restHours);
      maxWork = Math.max(maxWork, workHours);
    }
    
    return {
      anyPeriodRest24hr: minRest,
      anyPeriodWork24hr: maxWork,
    };
  };

  // Helper: Calculate "any period" 7-day window metrics
  const calculateAnyPeriod7day = (records: DailyRecord[], dayIndex: number) => {
    // We need to check all possible 7-day windows ending at or before the current day
    // For simplicity, we'll check windows ending at the current day starting from different days
    
    let minRest = 168;  // Minimum rest hours in any 7-day period
    let maxWork = 0;    // Maximum work hours in any 7-day period
    
    // Check windows of different starting points (up to 7 days back)
    for (let windowStart = Math.max(0, dayIndex - 6); windowStart <= dayIndex; windowStart++) {
      const windowEnd = Math.min(windowStart + 6, dayIndex);
      const windowDays = windowEnd - windowStart + 1;
      
      let restHours = 0;
      for (let i = windowStart; i <= windowEnd; i++) {
        restHours += calculateHoursOfRest24hr(records[i].hours);
      }
      
      // If window is less than 7 days (early in the month), assume rest for missing days
      const missingDays = 7 - windowDays;
      restHours += missingDays * 24;
      
      const workHours = (windowDays * 24) - restHours + (missingDays * 0); // Missing days count as 0 work
      
      minRest = Math.min(minRest, restHours);
      maxWork = Math.max(maxWork, workHours);
    }
    
    return {
      anyPeriodRest7day: minRest,
      anyPeriodWork7day: maxWork,
    };
  };

  // Helper: Detect violations
  const detectViolations = (record: DailyRecord, isOpaMode: boolean): number[] => {
    const violations: number[] = [];
    
    // Rule [1]: Minimum 10 hours rest in any 24hr
    if (record.hoursOfRest24hr < 10) {
      violations.push(1);
    }
    
    // Rule [2]: Minimum 77 hours rest in 7 days
    if (record.hoursOfRest7day < 77) {
      violations.push(2);
    }
    
    // Rule [5]: Maximum 14 hours work in 24hr
    if (record.hoursOfWork24hr > 14) {
      violations.push(5);
    }
    
    // Rule [6]: Maximum 72 hours work in 7 days
    if (record.hoursOfWork7day > 72) {
      violations.push(6);
    }
    
    // Rule [7] (OPA only): Maximum 15 hours work in 24hr
    if (isOpaMode && record.hoursOfWork24hr > 15) {
      violations.push(7);
    }
    
    // Rule [8] (OPA only): Maximum 36 hours work in 72hr
    if (isOpaMode && record.hoursOfWork96hr > 36) {
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
          newRecords[i] = {
            ...newRecords[i],
            ...metrics,
          };
          
          // Detect violations
          newRecords[i].violations = detectViolations(newRecords[i], opaMode);
        }
      }
      
      return newRecords;
    });
  }, [opaMode]);

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
            <DialogTitle className="text-lg font-semibold">
              RH Recording Form
            </DialogTitle>
            <div className="flex items-center gap-4">
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
            <Input
              value={monthDisplay}
              readOnly
              className="h-8 w-32 text-xs bg-gray-50"
              data-testid="input-period"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#4f5863]">Vessel</Label>
            <Input
              value={vesselName}
              readOnly
              className="h-8 w-48 text-xs bg-gray-50"
              data-testid="input-vessel"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-[#4f5863]">Rank, Name</Label>
            <Input
              value={`${rank}, ${crewMemberName}`}
              readOnly
              className="h-8 w-64 text-xs bg-gray-50"
              data-testid="input-rank-name"
            />
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
              <tr>
                <th className="border border-gray-300 p-0.5 min-w-[60px]" style={{ padding: '2px' }}>
                  Plan/Rec
                </th>
                <th className="border border-gray-300 p-0.5 min-w-[50px]" style={{ padding: '2px' }}>
                  Date
                </th>
                <th className="border border-gray-300 p-0.5 min-w-[50px]" style={{ padding: '2px' }}>
                  Day
                </th>
                {Array.from({ length: 24 }, (_, i) => (
                  <th key={i} colSpan={2} className="border border-gray-300 p-0.5 min-w-[40px]" style={{ padding: '2px' }}>
                    {i.toString().padStart(2, '0')}
                  </th>
                ))}
                <th className="border border-gray-300 p-0.5 min-w-[80px]" style={{ padding: '2px' }}>
                  Hours of Rest in 24hr period
                </th>
                <th className="border border-gray-300 p-0.5 min-w-[80px]" style={{ padding: '2px' }}>
                  Violations
                </th>
                <th className="border border-gray-300 p-0.5 min-w-[150px]" style={{ padding: '2px' }}>
                  Comments
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
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
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
                          data-testid={`cell-hour-${dayIndex}-${hourIndex}`}
                        >
                          {hour}
                        </div>
                      </td>
                    );
                  })}
                  
                  {/* Hours of Rest */}
                  <td className="border border-gray-300 text-center" style={{ padding: '2px' }}>
                    {record.hoursOfRest24hr}
                  </td>
                  
                  {/* Violations */}
                  <td className="border border-gray-300 text-center text-red-600 font-semibold" style={{ padding: '2px' }}>
                    {record.violations.length > 0 ? `[${record.violations.join(', ')}]` : ''}
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
