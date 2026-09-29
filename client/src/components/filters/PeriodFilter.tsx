import { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormattedDateInput,
  parseManualDate,
} from '@/components/ui/formatted-date-input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import type { MonthDraft } from '@/components/ui/formatted-month-input';

// Parse a native date input value ('yyyy-MM-dd') into a local Date (no timezone shift).
function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

type FilterMode = 'year' | 'year-quarter' | 'year-month' | 'date-range';

export interface PeriodFilterValue {
  mode: FilterMode;
  year?: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number; // 1-12
  dateFrom?: Date;
  dateTo?: Date;
}

interface PeriodFilterProps {
  value?: PeriodFilterValue;
  onChange: (value: PeriodFilterValue) => void;
  className?: string;
  rangeMode?: 'date' | 'month';
  useSharedMonthSelector?: boolean;
  placeholder?: string;
}

export const PeriodFilter = ({ value, onChange, className, rangeMode = 'date', useSharedMonthSelector = false, placeholder }: PeriodFilterProps) => {
  const [open, setOpen] = useState(false);
  const fullDateRangeRef = useRef<HTMLDivElement>(null);
  const [dateRangeError, setDateRangeError] = useState<string | null>(null);
  const monthFromRef = useRef<HTMLInputElement>(null);
  const monthToRef = useRef<HTMLInputElement>(null);
  const monthRangeRef = useRef<HTMLDivElement>(null);
  const monthDrafts = useRef<{ from?: MonthDraft; to?: MonthDraft }>({});

  useEffect(() => {
    if (useSharedMonthSelector) monthDrafts.current = {};
  }, [value, useSharedMonthSelector]);
  const [mode, setMode] = useState<'year-period' | 'date-range'>(
    value?.mode === 'date-range' ? 'date-range' : 'year-period'
  );
  
  // Current year and month for defaults
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  // Last 4 years, current year at leftmost
  const years = useMemo(() => {
    return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  }, [currentYear]);

  const quarters = [1, 2, 3, 4] as const;
  const months = [
    { value: 1, label: 'JAN' },
    { value: 2, label: 'FEB' },
    { value: 3, label: 'MAR' },
    { value: 4, label: 'APR' },
    { value: 5, label: 'MAY' },
    { value: 6, label: 'JUN' },
    { value: 7, label: 'JUL' },
    { value: 8, label: 'AUG' },
    { value: 9, label: 'SEP' },
    { value: 10, label: 'OCT' },
    { value: 11, label: 'NOV' },
    { value: 12, label: 'DEC' },
  ];

  // Local state for selections
  const [selectedYear, setSelectedYear] = useState(value?.year || currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4 | null>(value?.quarter || null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(value?.month || currentMonth);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(value?.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(value?.dateTo);

  // Sync internal state when value prop changes (e.g., after Clear button)
  useEffect(() => {
    if (value) {
      setMode(value.mode === 'date-range' ? 'date-range' : 'year-period');
      setSelectedYear(value.year || currentYear);
      setSelectedQuarter(value.quarter || null);
      setSelectedMonth(value.month || null);
      setDateFrom(value.dateFrom);
      setDateTo(value.dateTo);
    } else {
      // Reset to defaults when value is undefined/null
      setMode('year-period');
      setSelectedYear(currentYear);
      setSelectedQuarter(null);
      setSelectedMonth(currentMonth);
      setDateFrom(undefined);
      setDateTo(undefined);
      if (useSharedMonthSelector) monthDrafts.current = {};
    }
  }, [value, currentYear, currentMonth, useSharedMonthSelector]);

  useEffect(() => {
    setDateRangeError(null);
  }, [open, mode, rangeMode, value]);

  const handleQuarterClick = (quarter: 1 | 2 | 3 | 4) => {
    if (selectedQuarter === quarter) {
      setSelectedQuarter(null);
    } else {
      setSelectedQuarter(quarter);
      setSelectedMonth(null);
    }
  };

  const handleMonthClick = (month: number) => {
    if (selectedMonth === month) {
      setSelectedMonth(null);
    } else {
      setSelectedMonth(month);
      setSelectedQuarter(null);
    }
  };

  const handleApply = () => {
    if (mode === 'date-range' && rangeMode === 'month' && useSharedMonthSelector) {
      const inputs = monthRangeRef.current?.querySelectorAll<HTMLInputElement>('input[data-month-valid]');
      if (!inputs || inputs.length !== 2) {
        setDateRangeError('Unable to check the months. Please close and reopen the filter.');
        return;
      }
      const invalidInput = Array.from(inputs).find((input) => input.dataset.monthValid === 'false');
      if (invalidInput) {
        setDateRangeError('Correct the invalid month before applying.');
        invalidInput.focus();
        return;
      }
    }
    if (mode === 'date-range' && rangeMode === 'date') {
      const inputs =
        fullDateRangeRef.current?.querySelectorAll<HTMLInputElement>(
          'input[type="text"]',
        );
      if (!inputs || inputs.length !== 2) {
        setDateRangeError(
          'Unable to check the dates. Please close and reopen the filter.',
        );
        return;
      }
      const invalidInput = Array.from(inputs).find(
        (input) =>
          input.value.trim() !== '' &&
          parseManualDate(input.value) === null,
      );
      if (invalidInput) {
        setDateRangeError('Correct the invalid date before applying.');
        invalidInput.focus();
        return;
      }
    }
    setDateRangeError(null);
    if (mode === 'year-period') {
      if (selectedQuarter !== null) {
        onChange({
          mode: 'year-quarter',
          year: selectedYear,
          quarter: selectedQuarter,
        });
      } else if (selectedMonth !== null) {
        onChange({
          mode: 'year-month',
          year: selectedYear,
          month: selectedMonth,
        });
      } else {
        onChange({
          mode: 'year',
          year: selectedYear,
        });
      }
    } else {
      onChange({
        mode: 'date-range',
        dateFrom,
        dateTo,
      });
    }
    setOpen(false);
  };

  // Generate display text for the trigger button
  const getDisplayText = () => {
    if (!value) {
      if (placeholder) return placeholder;
      return `${months[currentMonth - 1].label}-${currentYear}`;
    }

    if (value.mode === 'year' && value.year) {
      return `${value.year}`;
    }

    if (value.mode === 'year-quarter' && value.year && value.quarter) {
      return `Q${value.quarter}-${value.year}`;
    }
    
    if (value.mode === 'year-month' && value.year && value.month) {
      return `${months[value.month - 1].label}-${value.year}`;
    }
    
    if (value.mode === 'date-range' && value.dateFrom && value.dateTo) {
      return `${format(value.dateFrom, 'dd/MM/yy')} - ${format(value.dateTo, 'dd/MM/yy')}`;
    }

    if (placeholder) return placeholder;
    return `${months[currentMonth - 1].label}-${currentYear}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 ${placeholder ? 'w-48' : 'w-40'} justify-between text-xs text-[#0f172a] bg-white dark:bg-neutral-900 border-gray-300 dark:border-gray-600 ${className}`}
          data-testid="period-filter-trigger"
        >
          <span>{getDisplayText()}</span>
          <Calendar className="h-3 w-3 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-4" align="start" data-testid="period-filter-content">
        <div className="space-y-4">
          {/* Mode Selection */}
          <RadioGroup value={mode} onValueChange={(val) => setMode(val as 'year-period' | 'date-range')}>
            <div className="flex items-center space-x-2 mb-2">
              <RadioGroupItem value="year-period" id="mode-year-period" data-testid="radio-year-period" />
              <Label htmlFor="mode-year-period" className="text-sm font-normal cursor-pointer">
                Year + Quarter/Month
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="date-range" id="mode-date-range" data-testid="radio-date-range" />
              <Label htmlFor="mode-date-range" className="text-sm font-normal cursor-pointer">
                {rangeMode === 'month' ? 'Month Range' : 'Date Range'}
              </Label>
            </div>
          </RadioGroup>

          {/* Year + Quarter/Month Mode */}
          {mode === 'year-period' && (
            <div className="space-y-4">
              {/* Year Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Year</Label>
                <div className="grid grid-cols-4 gap-2">
                  {years.map((year) => (
                    <Button
                      key={year}
                      variant={selectedYear === year ? 'default' : 'outline'}
                      className="h-9 text-sm"
                      onClick={() => setSelectedYear(year)}
                      data-testid={`year-button-${year}`}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quarter Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Quarter</Label>
                <div className="grid grid-cols-4 gap-2">
                  {quarters.map((quarter) => (
                    <Button
                      key={quarter}
                      variant={selectedQuarter === quarter ? 'default' : 'outline'}
                      className="h-9 text-sm"
                      onClick={() => handleQuarterClick(quarter)}
                      data-testid={`quarter-button-${quarter}`}
                    >
                      Q{quarter}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Month Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Month</Label>
                <div className="grid grid-cols-6 gap-2">
                  {months.map((month) => (
                    <Button
                      key={month.value}
                      variant={selectedMonth === month.value ? 'default' : 'outline'}
                      className="h-9 text-xs"
                      onClick={() => handleMonthClick(month.value)}
                      data-testid={`month-button-${month.label}`}
                    >
                      {month.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Date Range Mode */}
          {mode === 'date-range' && rangeMode === 'month' && useSharedMonthSelector && (
            <div ref={monthRangeRef} onChangeCapture={() => setDateRangeError(null)}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">From Month</Label>
                  <FormattedDateInput
                    mode="month"
                    value={dateFrom ? format(dateFrom, 'yyyy-MM') : ''}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setDateFrom(y && m ? new Date(y, m - 1, 1) : undefined);
                    }}
                    initialMonthDraft={monthDrafts.current.from}
                    onMonthDraftChange={(draft) => { monthDrafts.current.from = draft; }}
                    placeholder="MMM-YYYY"
                    className="h-9 text-xs"
                    data-testid="month-from-trigger"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">To Month</Label>
                  <FormattedDateInput
                    mode="month"
                    value={dateTo ? format(dateTo, 'yyyy-MM') : ''}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setDateTo(y && m ? new Date(y, m, 0) : undefined);
                    }}
                    initialMonthDraft={monthDrafts.current.to}
                    onMonthDraftChange={(draft) => { monthDrafts.current.to = draft; }}
                    placeholder="MMM-YYYY"
                    className="h-9 text-xs"
                    data-testid="month-to-trigger"
                  />
                </div>
              </div>
              {dateRangeError && (
                <p role="alert" className="mt-2 text-xs text-red-500">{dateRangeError}</p>
              )}
            </div>
          )}

          {mode === 'date-range' && rangeMode === 'month' && !useSharedMonthSelector && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">From Month</Label>
                <div
                  className="relative flex items-center h-9 w-full rounded-md border px-3 text-xs cursor-pointer bg-white dark:bg-neutral-900"
                  onClick={() => {
                    try {
                      monthFromRef.current?.showPicker?.();
                    } catch {
                      // showPicker() can throw inside cross-origin iframes (Replit preview) — safe to ignore
                    }
                  }}
                >
                  <span className={`flex-1 select-none ${dateFrom ? '' : 'text-muted-foreground'}`}>
                    {dateFrom ? format(dateFrom, 'MMM-yyyy') : 'MMM-YYYY'}
                  </span>
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground ml-2" />
                  <Input
                    ref={monthFromRef}
                    type="month"
                    value={dateFrom ? format(dateFrom, 'yyyy-MM') : ''}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setDateFrom(y && m ? new Date(y, m - 1, 1) : undefined);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    data-testid="month-from-trigger"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-gray-600 dark:text-gray-400">To Month</Label>
                <div
                  className="relative flex items-center h-9 w-full rounded-md border px-3 text-xs cursor-pointer bg-white dark:bg-neutral-900"
                  onClick={() => {
                    try {
                      monthToRef.current?.showPicker?.();
                    } catch {
                      // showPicker() can throw inside cross-origin iframes (Replit preview) — safe to ignore
                    }
                  }}
                >
                  <span className={`flex-1 select-none ${dateTo ? '' : 'text-muted-foreground'}`}>
                    {dateTo ? format(dateTo, 'MMM-yyyy') : 'MMM-YYYY'}
                  </span>
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground ml-2" />
                  <Input
                    ref={monthToRef}
                    type="month"
                    value={dateTo ? format(dateTo, 'yyyy-MM') : ''}
                    onChange={(e) => {
                      const [y, m] = e.target.value.split('-').map(Number);
                      setDateTo(y && m ? new Date(y, m, 0) : undefined);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    data-testid="month-to-trigger"
                  />
                </div>
              </div>
            </div>
          )}

          {mode === 'date-range' && rangeMode === 'date' && (
            <div
              ref={fullDateRangeRef}
              onChangeCapture={() => setDateRangeError(null)}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">
                    Date From
                  </Label>
                  <FormattedDateInput
                    value={dateFrom ? format(dateFrom, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setDateFrom(parseDateInput(e.target.value))}
                    placeholder="DD-MMM-YYYY"
                    className="h-9 text-xs"
                    data-testid="date-from-trigger"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600 dark:text-gray-400">
                    Date To
                  </Label>
                  <FormattedDateInput
                    value={dateTo ? format(dateTo, 'yyyy-MM-dd') : ''}
                    onChange={(e) => setDateTo(parseDateInput(e.target.value))}
                    placeholder="DD-MMM-YYYY"
                    className="h-9 text-xs"
                    data-testid="date-to-trigger"
                  />
                </div>
              </div>
              {dateRangeError && (
                <p role="alert" className="mt-2 text-xs text-red-500">
                  {dateRangeError}
                </p>
              )}
            </div>
          )}

          {/* Apply Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleApply}
              className="bg-[#1e40af] hover:bg-[#1e3a8a] text-white px-8"
              data-testid="button-apply-period-filter"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
