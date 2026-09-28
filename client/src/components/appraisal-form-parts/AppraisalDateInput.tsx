import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { formatIsoDate, parseManualDate } from "../ui/formatted-date-input";
interface AppraisalDateInputProps {
  value: string | null | undefined;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  min?: string;
  rejectBeforeMin?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  tabIndex?: number;
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
  "data-testid"?: string;
}
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Use the unchanged shared helpers for ordinary dates. Do not add a year cap.
function nativeDate(value: string): boolean {
  const input = document.createElement("input");
  input.type = "date";
  input.value = value;
  return !!value && input.value === value;
}
function formatDate(value: string): string {
  const ordinary = formatIsoDate(value);
  if (ordinary) return ordinary;
  const match = /^(\d{5,})-(\d{2})-(\d{2})$/.exec(value);
  return match && nativeDate(value)
    ? `${match[3]}-${months[Number(match[2]) - 1]}-${match[1]}`
    : "";
}
function parseDate(text: string): string | null {
  const ordinary = parseManualDate(text);
  if (ordinary) return ordinary;
  const match = /^(\d{1,2})([-/])([A-Za-z]{3}|\d{1,2})\2(\d{5,})$/.exec(text.trim());
  if (!match) return null;
  const month = /^\d+$/.test(match[3])
    ? Number(match[3])
    : months.findIndex(
        item => item.toLowerCase() === match[3].toLowerCase(),
      ) + 1;
  if (!month) return null;
  const result = `${match[4]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return nativeDate(result) ? result : null;
}
export const AppraisalDateInput = React.forwardRef<
  HTMLInputElement,
  AppraisalDateInputProps
>(
  (
    {
      value: rawValue,
      onChange,
      onBlur,
      min,
      rejectBeforeMin = false,
      readOnly = false,
      disabled = false,
      tabIndex,
      id,
      name,
      className,
      "aria-label": label,
      "aria-describedby": describedBy,
      "aria-invalid": fieldInvalid,
      "data-testid": testId,
    },
    ref,
  ) => {
    const value = rawValue ?? "";
    const [draft, setDraft] = React.useState(() => formatDate(value));
    const [showError, setShowError] = React.useState(false);
    const pickerRef = React.useRef<HTMLInputElement>(null);
    const ownValue = React.useRef<string | undefined>(undefined);
    const valueRef = React.useRef(value);
    const openingPicker = React.useRef(false);
    const errorId = React.useId();
    const invalid = !!draft.trim() && !parseDate(draft);
    const locked = (input: HTMLInputElement) =>
      readOnly ||
      disabled ||
      input.matches(":disabled") ||
      !!input.closest("fieldset[disabled]");
    React.useLayoutEffect(() => {
      valueRef.current = value;
      if (pickerRef.current) {
        pickerRef.current.value = value;
      }
      if (ownValue.current !== value) {
        setDraft(formatDate(value));
        setShowError(false);
      }
      ownValue.current = undefined;
    }, [value]);
    const emit = (
      next: string,
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      ownValue.current = next;
      const input = event.currentTarget;
      const display = input.value;
      input.value = next;
      try {
        onChange(event);
      } finally {
        input.value = display;
      }
    };
    const notifyBlur = (
      event: React.FocusEvent<HTMLInputElement>,
    ) => {
      if (!onBlur) return;
      const input = event.currentTarget;
      const pending = input.value;
      // Do not update React's change tracker while reporting the accepted value.
      // A native calendar may still dispatch its change event after this blur.
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setValue.call(input, valueRef.current);
      try {
        onBlur(event);
      } finally {
        setValue.call(input, pending);
      }
    };
    const handlePickerChange = (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const input = event.currentTarget;
      const next = input.value;
      if (locked(input)) {
        input.value = valueRef.current;
        return;
      }
      const beforeMin =
        next &&
        min &&
        nativeDate(min) &&
        Number(next.replace(/-/g, "")) < Number(min.replace(/-/g, ""));
      if (
        next &&
        (
          !formatDate(next) ||
          beforeMin ||
          (rejectBeforeMin && min && next < min)
        )
      ) {
        input.value = valueRef.current;
        openingPicker.current = false;
        input.blur();
        return;
      }
      setDraft(formatDate(next));
      setShowError(false);
      ownValue.current = next;
      onChange(event);
      input.blur();
    };
    // Keep exceptional saved values on their original native rendering path.
    if (value && !formatDate(value)) {
      return (
        <Input
          ref={ref}
          type="date"
          value={value}
          id={id}
          name={name}
          min={min}
          readOnly={readOnly}
          disabled={disabled}
          tabIndex={tabIndex}
          className={className}
          aria-label={label}
          aria-describedby={describedBy}
          aria-invalid={fieldInvalid}
          data-testid={testId}
          onChange={event => {
            if (!locked(event.currentTarget)) {
              onChange(event);
            }
          }}
          onBlur={onBlur}
        />
      );
    }
    const classes = className?.split(/\s+/).filter(Boolean) ?? [];
    const isWidth = (item: string) =>
      /(^|:)!?(?:w|min-w|max-w)-/.test(item);
    return (
      <div
        className={cn(
          "flex w-full min-w-[5.5rem] flex-col",
          classes.filter(isWidth),
        )}
      >
        <div
          className={cn(
            "relative flex items-center h-9 w-full rounded-md border bg-transparent text-sm shadow-sm min-w-0",
            "focus-within:ring-1 focus-within:ring-ring",
            disabled && "cursor-not-allowed opacity-60",
            classes.filter(item => !isWidth(item)),
            showError && invalid && "border-red-500",
          )}
        >
          <input
            ref={ref}
            type="text"
            id={id}
            name={name}
            value={draft}
            readOnly={readOnly}
            disabled={disabled}
            tabIndex={tabIndex}
            placeholder="DD-MMM-YYYY or DD-MM-YYYY"
            inputMode="text"
            autoComplete="off"
            aria-label={label ?? (id ? undefined : "Date")}
            aria-invalid={fieldInvalid || (showError && invalid)}
            aria-describedby={
              [
                describedBy,
                showError && invalid ? errorId : undefined,
              ].filter(Boolean).join(" ") || undefined
            }
            data-testid={testId ? `${testId}-manual` : undefined}
            className="h-full min-w-0 flex-1 bg-transparent px-3 py-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onChange={event => {
              if (locked(event.currentTarget)) return;
              const text = event.target.value;
              const next = parseDate(text);
              if (
                next &&
                rejectBeforeMin &&
                min &&
                next < min
              ) {
                setDraft(formatDate(valueRef.current));
                setShowError(false);
                return;
              }
              setDraft(next ? formatDate(next) : text);
              setShowError(
                wasShown => wasShown && !!text.trim() && !next,
              );
              emit(next ?? "", event);
            }}
            onBlur={event => {
              if (openingPicker.current) return;
              setShowError(invalid);
              notifyBlur(event);
            }}
          />
          <style>{`
            .appraisal-date-picker::-webkit-calendar-picker-indicator {
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
          <div className="relative flex h-full w-9 flex-shrink-0 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted focus-within:ring-1 focus-within:ring-ring">
            <CalendarDays
              className="pointer-events-none h-3.5 w-3.5"
              aria-hidden="true"
            />
            <input
              ref={pickerRef}
              type="date"
              defaultValue={value}
              min={min}
              readOnly={readOnly}
              disabled={disabled || readOnly}
              aria-label="Choose date from calendar"
              data-testid={testId}
              className="appraisal-date-picker absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              onPointerDown={event => {
                if (locked(event.currentTarget)) return;
                event.currentTarget.value = valueRef.current;
                openingPicker.current = true;
              }}
              onFocus={() => {
                openingPicker.current = true;
              }}
              onInputCapture={event => event.stopPropagation()}
              onChange={handlePickerChange}
              onBlur={event => {
                openingPicker.current = false;
                // Keep a pending selection available for its later change event.
                notifyBlur(event);
              }}
            />
          </div>
        </div>
        {showError && invalid && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-xs leading-4 text-red-500"
          >
            Incorrect date/date format
          </p>
        )}
      </div>
    );
  },
);
AppraisalDateInput.displayName = "AppraisalDateInput";
