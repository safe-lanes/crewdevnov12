import * as React from "react";
import { cn } from "../../lib/utils";
import { CalendarDays } from "lucide-react";

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

const FormattedDateInput = React.forwardRef<HTMLDivElement, FormattedDateInputProps>(
  ({ value, onChange, onBlur, className, min, max, placeholder, disabled = false, "data-testid": dataTestId }, ref) => {
    const calendarInputRef = React.useRef<HTMLInputElement>(null);
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

    const openCalendar = () => {
      if (disabled) return;
      calendarChangedRef.current = false;
      openingCalendarRef.current = true;
      calendarInputRef.current?.focus();
      try {
        if (typeof calendarInputRef.current?.showPicker === "function") {
          calendarInputRef.current.showPicker();
        } else {
          calendarInputRef.current?.click();
        }
      } catch {
        // showPicker() can throw a SecurityError inside cross-origin iframes.
        calendarInputRef.current?.click();
      }
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
        <button
          type="button"
          onMouseDown={() => {
            openingCalendarRef.current = true;
          }}
          onClick={openCalendar}
          disabled={disabled}
          aria-label="Choose date from calendar"
          className="flex h-full w-9 flex-shrink-0 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed"
        >
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
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
