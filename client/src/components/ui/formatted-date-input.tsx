import * as React from "react";
import { cn } from "../../lib/utils";
import { CalendarDays } from "lucide-react";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { useNavigation, type CaptionProps } from "react-day-picker";

interface FormattedDateInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTH_INDEX = new Map(MONTHS.map((month, index) => [month.toLowerCase(), index + 1]));

/**
 * Format the canonical YYYY-MM-DD value without constructing a Date. This
 * avoids UTC/local timezone shifts for date-only values.
 */
export function formatIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";

  const [, year, monthText, dayText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isRealDate(Number(year), month, day)) return "";

  return `${dayText}-${MONTHS[month - 1]}-${year}`;
}

/**
 * Parse DD-MM-YYYY, DD-MMM-YYYY, DD/MM/YYYY or DD/MMM/YYYY into the application's canonical
 * YYYY-MM-DD value. Parsing is explicit so impossible dates are rejected
 * instead of being rolled into the following month by the Date constructor.
 */
export function parseManualDate(value: string): string | null {
  const match = /^(\d{1,2})([-/])([A-Za-z]{3}|\d{1,2})\2(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const monthToken = match[3];
  const month = /^\d+$/.test(monthToken)
    ? Number(monthToken)
    : MONTH_INDEX.get(monthToken.toLowerCase());
  const year = Number(match[4]);

  if (!month || !isRealDate(year, month, day)) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(0);
  candidate.setUTCFullYear(year, month - 1, day);
  candidate.setUTCHours(0, 0, 0, 0);
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

function makeCalendarDate(year: number, month: number, day = 1): Date {
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}
function readCalendarDate(value: string): Date | undefined {
  if (!formatIsoDate(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return makeCalendarDate(year, month - 1, day);
}
function calendarDateValue(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function DateCalendarCaption({ displayMonth, id }: CaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useNavigation();
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
  const [yearDraft, setYearDraft] = React.useState(String(year));
  React.useEffect(() => {
    setYearDraft(String(year));
  }, [year]);
  return (
    <div id={id} className="flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="Previous month"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="h-8 w-8 rounded border disabled:opacity-50"
      >
        ‹
      </button>
      <select
        aria-label="Calendar month"
        value={month}
        onChange={(event) =>
          goToMonth(makeCalendarDate(year, Number(event.target.value)))
        }
        className="h-8 rounded border bg-background px-1 text-sm"
      >
        {MONTHS.map((name, index) => (
          <option key={name} value={index}>
            {name}
          </option>
        ))}
      </select>
      <input
        type="number"
        aria-label="Calendar year"
        min={1}
        max={9999}
        value={yearDraft}
        onChange={(event) => {
          const text = event.target.value;
          setYearDraft(text);
          const nextYear = Number(text);
          if (
            /^\d{1,4}$/.test(text) &&
            nextYear >= 1 &&
            nextYear <= 9999
          ) {
            goToMonth(makeCalendarDate(nextYear, month));
          }
        }}
        onBlur={() => setYearDraft(String(year))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-20 rounded border bg-background px-2 text-sm"
      />
      <button
        type="button"
        aria-label="Next month"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="h-8 w-8 rounded border disabled:opacity-50"
      >
        ›
      </button>
    </div>
  );
}

const FormattedDateInput = React.forwardRef<HTMLDivElement, FormattedDateInputProps>(
  ({ value, onChange, onBlur, className, min, max, placeholder, disabled = false, "data-testid": dataTestId }, ref) => {
    const calendarInputRef = React.useRef<HTMLInputElement>(null);
    const [calendarOpen, setCalendarOpen] = React.useState(false);
    const [calendarMonth, setCalendarMonth] = React.useState(
      () => readCalendarDate(value) ?? new Date(),
    );
    const [draft, setDraft] = React.useState(() => formatIsoDate(value));
    const [isInvalid, setIsInvalid] = React.useState(false);
    const lastCanonicalValueRef = React.useRef(value);
    const valueRef = React.useRef(value);
    const openingCalendarRef = React.useRef(false);
    const calendarChangedRef = React.useRef(false);
    const errorId = React.useId();
    const classes = className?.split(/\s+/).filter(Boolean) ?? [];
    const isWidthClass = (name: string) => /(^|:)!?(?:w|min-w|max-w)-/.test(name);
    const widthClasses = classes.filter(isWidthClass).join(" ");
    const controlClasses = classes.filter((name) => !isWidthClass(name)).join(" ");

    const isDraftInvalid = (text: string): boolean => {
      if (!text.trim()) return false;
      const canonicalValue = parseManualDate(text);
      return !canonicalValue
        || Boolean(min && canonicalValue < min)
        || Boolean(max && canonicalValue > max);
    };

    React.useEffect(() => {
      const isOwnChange = value === lastCanonicalValueRef.current;
      valueRef.current = value;
      lastCanonicalValueRef.current = value;
      setDraft(formatIsoDate(value));
      setIsInvalid((wasInvalid) =>
        isOwnChange && wasInvalid && isDraftInvalid(formatIsoDate(value)),
      );
    }, [value]);

    React.useEffect(() => {
      if (disabled) {
        setCalendarOpen(false);
        openingCalendarRef.current = false;
        calendarChangedRef.current = false;
      }
    }, [disabled]);

    const emitCanonicalChange = (
      canonicalValue: string,
      sourceEvent: React.ChangeEvent<HTMLInputElement>,
    ) => {
      lastCanonicalValueRef.current = canonicalValue;
      const input = sourceEvent.currentTarget;
      const displayValue = input.value;
      input.value = canonicalValue;
      onChange(sourceEvent);
      input.value = displayValue;
    };

    const handleManualChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextDraft = event.target.value;
      setDraft(nextDraft);
      setIsInvalid((wasInvalid) => wasInvalid && isDraftInvalid(nextDraft));

      if (!nextDraft.trim()) {
        emitCanonicalChange("", event);
        return;
      }

      const canonicalValue = parseManualDate(nextDraft);
      if (!canonicalValue) return;

      setDraft(formatIsoDate(canonicalValue));
      emitCanonicalChange(canonicalValue, event);
    };

    const handleManualBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      if (openingCalendarRef.current) return;

      const canonicalValue = parseManualDate(draft);
      setIsInvalid(isDraftInvalid(draft));

      if (canonicalValue) {
        setDraft(formatIsoDate(
          valueRef.current === canonicalValue ? canonicalValue : valueRef.current,
        ));
      } else if (!draft.trim()) {
        setDraft(formatIsoDate(valueRef.current));
      }

      if (onBlur) {
        const input = event.currentTarget;
        const displayValue = input.value;
        input.value = canonicalValue ?? lastCanonicalValueRef.current;
        onBlur(event);
        input.value = displayValue;
      }
    };

    const handleCalendarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      calendarChangedRef.current = true;
      setDraft(formatIsoDate(event.target.value));
      setIsInvalid(false);
      lastCanonicalValueRef.current = event.target.value;
      onChange(event);
    };

    const handleCalendarBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      openingCalendarRef.current = false;
      if (!calendarChangedRef.current && isDraftInvalid(draft)) {
        setIsInvalid(true);
      } else {
        setDraft(formatIsoDate(valueRef.current));
      }
      calendarChangedRef.current = false;
      if (onBlur) {
        const input = event.currentTarget;
        const controlledValue = input.value;
        input.value = lastCanonicalValueRef.current;
        onBlur(event);
        input.value = controlledValue;
      }
    };

    const handleCalendarOpenChange = (nextOpen: boolean) => {
      if (nextOpen && disabled) return;
      if (nextOpen) {
        calendarChangedRef.current = false;
        openingCalendarRef.current = true;
        setCalendarMonth(readCalendarDate(valueRef.current) ?? new Date());
      } else {
        openingCalendarRef.current = false;
        if (!calendarChangedRef.current) {
          setIsInvalid(isDraftInvalid(draft));
        }
        calendarChangedRef.current = false;
      }
      setCalendarOpen(nextOpen);
    };
    const isCalendarDayDisabled = (day: Date): boolean => {
      const nextValue = calendarDateValue(day);
      return (
        disabled ||
        Boolean(min && nextValue < min) ||
        Boolean(max && nextValue > max)
      );
    };
    const handleCalendarSelect = (day: Date | undefined) => {
      if (!day || isCalendarDayDisabled(day)) return;
      const input = calendarInputRef.current;
      if (!input) return;
      const nextValue = calendarDateValue(day);
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      if (!nativeValueSetter) return;
      input.focus({ preventScroll: true });
      // Reset React's tracked value without emitting an empty date.
      // This also allows explicitly selecting the existing date again.
      input.value = "";
      nativeValueSetter.call(input, nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      openingCalendarRef.current = false;
      setCalendarOpen(false);
    };

    const handleCalendarChangeAndBlur = (event: React.ChangeEvent<HTMLInputElement>) => {
      handleCalendarChange(event);
      calendarInputRef.current?.blur();
    };

    return (
      <div className={cn("flex w-full min-w-[5.5rem] flex-col", widthClasses)}>
      <div
        ref={ref}
        className={cn(
          "relative flex items-center h-9 w-full rounded-md border bg-transparent text-sm shadow-sm min-w-0",
          "focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-60",
          controlClasses,
          isInvalid && "border-red-500"
        )}
      >
        <input
          type="text"
          value={draft}
          onChange={handleManualChange}
          onBlur={handleManualBlur}
          disabled={disabled}
          placeholder={placeholder || "DD-MMM-YYYY or DD-MM-YYYY"}
          inputMode="text"
          autoComplete="off"
          aria-label="Date"
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? errorId : undefined}
          data-testid={dataTestId ? `${dataTestId}-manual` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 py-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <Popover
          open={calendarOpen}
          onOpenChange={handleCalendarOpenChange}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={() => {
                openingCalendarRef.current = true;
              }}
              disabled={disabled}
              aria-label="Choose date from calendar"
              className="flex h-full w-9 flex-shrink-0 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto p-0"
            onFocusOutside={(event) => {
              if (
                event.detail.originalEvent.target === calendarInputRef.current
              ) {
                event.preventDefault();
              }
            }}
          >
            <Calendar
              mode="single"
              required
              selected={readCalendarDate(value)}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelect={handleCalendarSelect}
              disabled={isCalendarDayDisabled}
              fromDate={makeCalendarDate(1, 0, 1)}
              toDate={makeCalendarDate(9999, 11, 31)}
              components={{ Caption: DateCalendarCaption }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <input
          ref={calendarInputRef}
          type="date"
          value={value}
          onChange={handleCalendarChangeAndBlur}
          onBlur={handleCalendarBlur}
          min={min}
          max={max}
          disabled={disabled}
          data-testid={dataTestId}
          aria-label="Calendar date value"
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          tabIndex={-1}
        />
      </div>
      {isInvalid && (
        <p id={errorId} role="alert" className="mt-1 text-xs leading-4 text-red-500">
          Incorrect date/date format
        </p>
      )}
      </div>
    );
  }
);
FormattedDateInput.displayName = "FormattedDateInput";

export { FormattedDateInput };
