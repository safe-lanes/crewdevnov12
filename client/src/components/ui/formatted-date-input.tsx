import * as React from "react";
import { cn } from "../../lib/utils";
import { formatDate } from "../../utils/format";

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

const FormattedDateInput = React.forwardRef<HTMLInputElement, FormattedDateInputProps>(
  ({ value, onChange, onBlur, className, min, max, placeholder, "data-testid": dataTestId }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const formatted = value ? formatDate(value) : "";

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          min={min}
          max={max}
          data-testid={dataTestId}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
        />
        {formatted && (
          <div
            className={cn(
              "absolute inset-0 flex items-center px-3 pointer-events-none bg-white rounded-md text-base md:text-sm",
              className
            )}
            style={{ paddingRight: '2rem' }}
          >
            {formatted}
          </div>
        )}
      </div>
    );
  }
);
FormattedDateInput.displayName = "FormattedDateInput";

export { FormattedDateInput };
