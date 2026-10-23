import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "../../lib/utils";

export interface MonthDraft { text: string; manual: boolean; }

interface MonthOnlyInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  initialMonthDraft?: MonthDraft;
  onMonthDraftChange?: (draft: MonthDraft) => void;
  "data-testid"?: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(value: string): string {
  // Keep native-picker years longer than four digits displayable, as before.
  const match = /^(\d{4,})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? `${MONTH_NAMES[Number(match[2]) - 1]}-${match[1]}` : "";
}

function parseMonth(text: string): string | null {
  const match = /^([A-Za-z]{3,4}|\d{2})[-/](\d{4})$/.exec(text.trim());
  if (!match || Number(match[2]) === 0) return null;
  const token = match[1].toLowerCase();
  const month = /^\d{2}$/.test(token)
    ? Number(token)
    : token === "sept" ? 9 : MONTH_NAMES.findIndex((name) => name.toLowerCase() === token) + 1;
  if (month < 1 || month > 12) return null;
  return `${match[2]}-${String(month).padStart(2, "0")}`;
}

// Only the explicit month mode uses this implementation. Day and datetime
// parsing, formatting, events, and styles are intentionally not shared here.
export const MonthOnlyInput = React.forwardRef<HTMLDivElement, MonthOnlyInputProps>(
  ({ value, onChange, className, placeholder = "MMM-YYYY", disabled = false,
     initialMonthDraft, onMonthDraftChange, "data-testid": testId }, ref) => {
    const [draft, setDraft] = React.useState(() => initialMonthDraft?.text ?? formatMonth(value));
    const [manual, setManual] = React.useState(initialMonthDraft?.manual ?? false);
    const previousValue = React.useRef(value);
    const pickerRef = React.useRef<HTMLInputElement>(null);
    // An unchanged accepted picker value is valid even for a legacy year that
    // cannot be entered through the new four-digit manual formats.
    const valid = !draft.trim() || parseMonth(draft) !== null || (!manual && draft === formatMonth(value));

    React.useLayoutEffect(() => { onMonthDraftChange?.({ text: draft, manual }); }, [draft, manual, onMonthDraftChange]);
    React.useEffect(() => {
      if (previousValue.current !== value) {
        previousValue.current = value;
        setDraft(formatMonth(value));
        setManual(false);
      }
    }, [value]);

    const emit = (canonical: string, event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const visible = input.value;
      input.value = canonical;
      try { onChange(event); } finally { input.value = visible; }
    };
    const acceptPicker = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const next = event.currentTarget.value;
      setDraft(formatMonth(next));
      setManual(false);
      onChange(event);
    };
    const classes = className?.split(/\s+/).filter(Boolean) ?? [];
    const isWidth = (name: string) => /(^|:)!?(?:w|min-w|max-w)-/.test(name);

    return (
      <div className={cn("flex w-full min-w-[5.5rem] flex-col", classes.filter(isWidth).join(" "))}>
        <div
          ref={ref}
          className={cn(
            "relative flex items-center h-9 w-full rounded-md border bg-white dark:bg-neutral-900 text-sm shadow-sm min-w-0 focus-within:ring-1 focus-within:ring-ring",
            classes.filter((name) => !isWidth(name)).join(" "),
            disabled && "cursor-not-allowed opacity-60",
            !valid && "border-red-500",
          )}
        >
          <input
            type="text"
            value={draft}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            inputMode="text"
            aria-label="Month"
            aria-invalid={!valid}
            data-month-valid={valid ? "true" : "false"}
            data-testid={testId ? `${testId}-manual` : undefined}
            className="h-full min-w-0 flex-1 bg-transparent px-3 py-1 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onChange={(event) => {
              if (disabled) return;
              const text = event.currentTarget.value;
              setDraft(text);
              setManual(true);
              if (!text.trim()) {
                setDraft("");
                emit("", event);
                return;
              }
              const canonical = parseMonth(text);
              if (canonical) {
                setDraft(formatMonth(canonical));
                emit(canonical, event);
              }
            }}
          />
          <div
            className="relative flex h-full w-9 flex-shrink-0 items-center justify-center text-muted-foreground"
            onClick={() => {
              if (disabled) return;
              try { pickerRef.current?.showPicker?.(); } catch {
                // Preserve the native picker's existing iframe/browser limitation.
              }
            }}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <input
              ref={pickerRef}
              type="month"
              // A bad draft must not prevent selecting the previous month again.
              value={valid ? value : ""}
              disabled={disabled}
              aria-label="Choose month"
              data-testid={testId}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              onInput={(event) => acceptPicker(event as React.ChangeEvent<HTMLInputElement>)}
              onChange={(event) => {
                if (event.nativeEvent.type !== "input") acceptPicker(event);
              }}
            />
          </div>
        </div>
      </div>
    );
  },
);
MonthOnlyInput.displayName = "MonthOnlyInput";
