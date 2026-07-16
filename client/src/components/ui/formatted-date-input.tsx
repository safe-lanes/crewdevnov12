import * as React from "react";
import { cn } from "../../lib/utils";
import { formatDate } from "../../utils/format";
import { CalendarDays } from "lucide-react";

interface FormattedDateInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  className?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  "data-testid"?: string;
}

const FormattedDateInput = React.forwardRef<HTMLDivElement, FormattedDateInputProps>(
  ({ value, onChange, onBlur, className, min, max, placeholder, "data-testid": dataTestId }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const formatted = value ? formatDate(value) : "";

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex items-center h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm cursor-pointer whitespace-nowrap min-w-[5.5rem]",
          className
        )}
        onClick={() => {
          try {
            inputRef.current?.showPicker?.();
          } catch {
            // showPicker() throws a SecurityError inside cross-origin iframes
            // (e.g. the Replit preview). The overlaid native date input still
            // opens on click, so this guard is safe to ignore.
          }
        }}
      >
        <span className={cn("flex-1 select-none", !formatted && "text-muted-foreground")}>
          {formatted || placeholder || "dd-mm-yyyy"}
        </span>
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 ml-1" />
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          min={min}
          max={max}
          data-testid={dataTestId}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          tabIndex={-1}
        />
      </div>
    );
  }
);
FormattedDateInput.displayName = "FormattedDateInput";

export { FormattedDateInput };
