import * as React from "react";
import { cn } from "../../lib/utils";
import { CalendarDays } from "lucide-react";
import { Input } from "./input";

interface FormattedDateInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  retainInvalidDraftOnBlur?: boolean;
  /**
   * Restore a saved visible draft when the input mounts.
   * Use a new key for an explicit draft reset.
   */
  initialDraft?: string;
  /** Report visible text, including incomplete or invalid text. */
  onDraftChange?: (draft: string) => void;
  /** Report visible-text validity separately from the accepted date. */
  onDraftValidityChange?: (isValid: boolean) => void;
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

const DateOnlyInput = React.forwardRef<HTMLDivElement, FormattedDateInputProps>(
  ({ value, onChange, onBlur, className, min, max, placeholder, disabled = false, retainInvalidDraftOnBlur = false, initialDraft, onDraftChange, onDraftValidityChange, "data-testid": dataTestId }, ref) => {
    const calendarInputRef = React.useRef<HTMLInputElement>(null);
    const [draft, setDraft] = React.useState(
      () => initialDraft ?? formatIsoDate(value),
    );
    const previousControlledValueRef = React.useRef(value);
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

    const isVisibleDraftValid = !isDraftInvalid(draft);
    React.useLayoutEffect(() => {
      onDraftChange?.(draft);
    }, [draft, onDraftChange]);
    React.useLayoutEffect(() => {
      onDraftValidityChange?.(isVisibleDraftValid);
    }, [isVisibleDraftValid, onDraftValidityChange]);

    React.useEffect(() => {
      const valueChanged = previousControlledValueRef.current !== value;
      previousControlledValueRef.current = value;
      const isOwnChange = value === lastCanonicalValueRef.current;
      valueRef.current = value;
      lastCanonicalValueRef.current = value;
      // Preserve a saved draft when this input remounts.
      // An actual accepted-value change still synchronises normally.
      if (initialDraft !== undefined && !valueChanged) {
        setIsInvalid(isDraftInvalid(draft));
        return;
      }
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
      const invalidDraft = isDraftInvalid(draft);
      setIsInvalid(invalidDraft);
      if (retainInvalidDraftOnBlur && invalidDraft) return;

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
      if (!calendarChangedRef.current) {
        event.currentTarget.value = valueRef.current;
      }
      openingCalendarRef.current = false;
      const invalidDraft =
        !calendarChangedRef.current && isDraftInvalid(draft);
      if (invalidDraft) {
        setIsInvalid(true);
      } else {
        setDraft(formatIsoDate(valueRef.current));
      }
      calendarChangedRef.current = false;
      if (retainInvalidDraftOnBlur && invalidDraft) return;
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

    const handleCalendarChangeAndBlur = (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const nextValue = event.currentTarget.value;
      if (
        disabled ||
        (nextValue !== "" && (
          !formatIsoDate(nextValue) ||
          Boolean(min && nextValue < min) ||
          Boolean(max && nextValue > max)
        ))
      ) {
        event.currentTarget.value = valueRef.current;
        openingCalendarRef.current = false;
        calendarChangedRef.current = false;
        calendarInputRef.current?.blur();
        return;
      }
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
          onInputCapture={(event) => event.stopPropagation()}
          onChange={handleCalendarChangeAndBlur}
          onBlur={handleCalendarBlur}
          min={min || "0001-01-01"}
          max={max || "9999-12-31"}
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
DateOnlyInput.displayName = "DateOnlyInput";

interface NativeDateTimeInputProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof Input>,
    "type" | "value" | "onChange" | "step"
  > {
  mode: "datetime";
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  inputRef?: React.Ref<HTMLInputElement>;
  "data-testid"?: string;
}

// NEW typed entries: date + HH:mm, with optional AM/PM. No seconds.
export function parseManualDateTime(text: string): string | null {
  const match = /^(\S+)\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(text.trim());
  if (!match) return null;
  const date = parseManualDate(match[1]);
  let hour = Number(match[2]);
  const minute = Number(match[3]);
  const period = match[4]?.toUpperCase();
  if (!date || minute > 59) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (period === "PM" ? 12 : 0);
  } else if (hour > 23) return null;
  return `${date}T${String(hour).padStart(2, "0")}:${match[3]}`;
}

// Read existing local ISO values without changing precision or timezone.
function localDateTimeParts(value: string) {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/.exec(value);
  if (!match || !formatIsoDate(match[1]) ||
      Number(match[2]) > 23 || Number(match[3]) > 59 ||
      (match[4] !== undefined && Number(match[4]) > 59)) return null;
  return match;
}

export function formatIsoDateTime(value: string): string {
  const match = localDateTimeParts(value);
  if (!match) return value; // Preserve unrecognised legacy text, too.
  const hour = Number(match[2]);
  const seconds = match[4] === undefined ? "" : `:${match[4]}${match[5] ?? ""}`;
  return `${formatIsoDate(match[1])} ${String(hour % 12 || 12).padStart(2, "0")}:${match[3]}${seconds} ${hour >= 12 ? "PM" : "AM"}`;
}

function pickerMinute(value: string): string {
  return localDateTimeParts(value) ? value.slice(0, 16) : "";
}

function comparisonKey(value: string): string | null {
  const parts = localDateTimeParts(value);
  if (!parts) return null;
  const fraction = (parts[5]?.slice(1) ?? "").replace(/0+$/, "") || "0";
  return `${value.slice(0, 16)}:${parts[4] ?? "00"}.${fraction}`;
}

function withinDateTimeBounds(
  value: string, min?: string | number, max?: string | number,
): boolean {
  if (!value) return true;
  const key = comparisonKey(value);
  if (!key) return false;
  const lower = min === undefined ? null : comparisonKey(String(min));
  const upper = max === undefined ? null : comparisonKey(String(max));
  return !(lower && key < lower) && !(upper && key > upper);
}

const DateTimeInput = React.forwardRef<HTMLDivElement, NativeDateTimeInputProps>(
  ({
    mode, inputRef, value, onChange, onBlur, className,
    disabled = false, readOnly = false, min, max, placeholder,
    "data-testid": dataTestId, ...inputProps
  }, ref) => {
    const manualRef = React.useRef<HTMLInputElement>(null);
    const ownValue = React.useRef<string | undefined>(undefined);
    const [original, setOriginal] = React.useState(value);
    const [draft, setDraft] = React.useState(() => formatIsoDateTime(value));
    const [edited, setEdited] = React.useState(false);
    const [pickerInvalid, setPickerInvalid] = React.useState(false);
    const [showError, setShowError] = React.useState(false);
    const errorId = React.useId();
    React.useImperativeHandle(inputRef, () => manualRef.current!);

    React.useLayoutEffect(() => {
      if (value !== ownValue.current) {
        setOriginal(value);
        setDraft(formatIsoDateTime(value));
        setEdited(false);
        setPickerInvalid(false);
        setShowError(false);
      }
      ownValue.current = undefined;
    }, [value]);

    // Returning to an exact existing display restores its exact raw value.
    // This is NOT permission to enter arbitrary new seconds values.
    const resolveDraft = (text: string): string | null => {
      if (text === formatIsoDateTime(original)) return original;
      if (text === formatIsoDateTime(value)) return value;
      return text.trim() === "" ? "" : parseManualDateTime(text);
    };
    const acceptable = (next: string | null): next is string =>
      next !== null &&
      (next === original || withinDateTimeBounds(next, min, max));
    const canonical = resolveDraft(draft);
    const invalid = edited && (pickerInvalid || !acceptable(canonical));
    const classes = className?.split(/\s+/).filter(Boolean) ?? [];
    const isWidthClass = (name: string) => /(^|:)!?(?:w|min-w|max-w)-/.test(name);
    const widthClasses = classes.filter(isWidthClass).join(" ");
    const controlClasses = classes.filter(name => !isWidthClass(name)).join(" ");

    const emit = (next: string, event: React.ChangeEvent<HTMLInputElement>) => {
      ownValue.current = next;
      // A native datetime input can sanitise legacy fractional precision.
      // Forward canonical values through the TEXT input, never through it.
      const input = manualRef.current!;
      const display = input.value;
      input.value = next;
      const forwarded = Object.assign(Object.create(event), {
        target: input, currentTarget: input,
      }) as React.ChangeEvent<HTMLInputElement>;
      try { onChange(forwarded); } finally { input.value = display; }
    };
    const notifyBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      const input = manualRef.current!;
      const display = input.value;
      input.value = value; // Never turn a blur into a precision conversion.
      const forwarded = Object.assign(Object.create(event), {
        target: input, currentTarget: input,
      }) as React.FocusEvent<HTMLInputElement>;
      try { onBlur?.(forwarded); } finally { input.value = display; }
    };

    return (
      <div
        className={cn("flex w-full min-w-[5.5rem] flex-col", widthClasses)}
        data-datetime-field={inputProps.name}
        data-datetime-edited={edited ? "true" : undefined}
        data-datetime-invalid={invalid ? "true" : undefined}
        data-datetime-canonical={canonical ?? undefined}
      >
        <style>{`
          .formatted-datetime-native::-webkit-calendar-picker-indicator {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            opacity: 0;
            cursor: pointer;
          }
        `}</style>
        <div
          ref={ref}
          className={cn(
            "relative flex items-center h-9 w-full rounded-md border bg-transparent text-sm shadow-sm min-w-0",
            "focus-within:ring-1 focus-within:ring-ring",
            disabled && "cursor-not-allowed opacity-60",
            controlClasses,
            showError && invalid && "border-red-500",
          )}
        >
          <input
            {...inputProps}
            ref={manualRef}
            type="text"
            value={draft}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder ?? "DD-MMM-YYYY or DD-MM-YYYY --:-- --"}
            inputMode="text"
            autoComplete="off"
            aria-invalid={(showError && invalid) || inputProps["aria-invalid"]}
            aria-describedby={[
              inputProps["aria-describedby"],
              showError && invalid ? errorId : undefined,
            ].filter(Boolean).join(" ") || undefined}
            data-testid={dataTestId}
            className="h-full min-w-0 flex-1 bg-transparent px-3 py-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onChange={event => {
              if (disabled || readOnly || event.currentTarget.matches(":disabled")) return;
              const text = event.currentTarget.value;
              setDraft(text);
              setEdited(true);
              setPickerInvalid(false);
              const next = resolveDraft(text);
              if (acceptable(next)) emit(next, event);
            }}
            onBlur={event => {
              setShowError(true);
              if (edited && !invalid && canonical !== null) {
                setDraft(formatIsoDateTime(canonical));
              }
              notifyBlur(event);
            }}
          />
          <div className="relative flex h-full w-9 flex-shrink-0 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted focus-within:ring-1 focus-within:ring-ring">
            <CalendarDays className="pointer-events-none h-3.5 w-3.5" aria-hidden="true" />
            <input
              className="formatted-datetime-native absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              type="datetime-local"
              value={pickerMinute(value)}
              step={60}
              disabled={disabled || readOnly}
              aria-label="Choose date and time from calendar"
              data-testid={dataTestId ? `${dataTestId}-picker` : undefined}
              onInputCapture={event => event.stopPropagation()}
              onChange={event => {
                if (disabled || readOnly || event.currentTarget.matches(":disabled")) return;
                setEdited(true);
                if (!event.currentTarget.validity.valid) {
                  setPickerInvalid(true);
                  setShowError(true);
                  return;
                }
                setPickerInvalid(false);
                const selected = event.currentTarget.value;
                let next = selected;
                const previousMinute = pickerMinute(value);
                if (selected && previousMinute &&
                    selected.slice(11) === previousMinute.slice(11)) {
                  // Same hour/minute: retain the exact existing seconds suffix.
                  next = selected + value.slice(16);
                }
                setDraft(formatIsoDateTime(next));
                setShowError(!acceptable(next));
                if (acceptable(next)) emit(next, event);
                // Do not blur: selecting date must not interrupt time selection.
              }}
              onBlur={notifyBlur}
            />
          </div>
        </div>
        {showError && invalid && (
          <p id={errorId} role="alert" className="mt-1 text-xs leading-4 text-red-500">
            Enter a valid date and time using hours and minutes, or clear the field.
          </p>
        )}
      </div>
    );
  },
);
DateTimeInput.displayName = "DateTimeInput";

type DateSelectorProps =
  | (FormattedDateInputProps & { mode?: "date" })
  | NativeDateTimeInputProps;

const FormattedDateInput = React.forwardRef<HTMLDivElement, DateSelectorProps>(
  (props, ref) => props.mode === "datetime"
    ? <DateTimeInput {...props} ref={ref} />
    : <DateOnlyInput {...props} ref={ref} />,
);
FormattedDateInput.displayName = "FormattedDateInput";
export { FormattedDateInput };
