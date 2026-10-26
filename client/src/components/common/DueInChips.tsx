import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type DueInWindow = "3M" | "2M" | "1M" | "Expired";

const defaultItems = [
  { label: "3M", color: "#FFEEAA", textColor: "#000000" },
  { label: "2M", color: "#FFCC00", textColor: "#000000" },
  { label: "1M", color: "#F9ECEF", textColor: "#000000" },
  { label: "O/D", color: "#D50A0D", textColor: "#FFFFFF" },
];

type Item = { label: string; color: string; textColor: string };
type Props = {
  items?: Item[];
  className?: string;
  overdueLabel?: string;
  selected?: DueInWindow[];
  onToggle?: (window: DueInWindow) => void;
  compact?: boolean;
  helperText?: string;
};

/** Shared D&A urgency legend; interactive mode is used by the training matrix. */
export function DueInChips({
  items = defaultItems,
  className = "flex gap-2 items-center mb-4",
  overdueLabel = "O/D",
  selected,
  onToggle,
  compact = false,
  helperText,
}: Props) {
  const interactive = Boolean(onToggle && selected);
  return (
    <div className={`${className} ${compact ? "text-[11px]" : ""}`}>
      {compact && helperText ? (
        <TooltipProvider delayDuration={150}>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button type="button" className="font-semibold text-slate-700 underline decoration-dotted underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700">
                  Due in:
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{helperText}</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64 text-xs" role="status">{helperText}</PopoverContent>
        </Popover>
        </TooltipProvider>
      ) : (
        <span className={`${compact ? "font-semibold text-slate-700" : "text-sm font-medium text-gray-700 dark:text-gray-300"}`}>Due in:</span>
      )}
      {items.map((item, index) => {
        const label = item.label === "O/D" ? overdueLabel : item.label;
        const window = item.label === "O/D" ? "Expired" : item.label as DueInWindow;
        const isSelected = selected?.includes(window) ?? false;
        const chipClass = compact
          ? "rounded px-2 py-1 text-[11px] font-semibold leading-normal"
          : "px-3 py-1 rounded text-sm font-semibold";
        const chip = interactive ? (
          <button
            key={`${label}-${index}`}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle?.(window)}
            className={`${chipClass} ${isSelected ? "ring-2 ring-slate-700 ring-offset-1" : ""} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700`}
            style={{ backgroundColor: item.color, color: item.textColor }}
          >
            {label}
          </button>
        ) : (
          <div
            key={`${label}-${index}`}
            className={chipClass}
            style={{ backgroundColor: item.color, color: item.textColor }}
          >
            {label}
          </div>
        );
        if (compact && interactive && item.label === "O/D") {
          return (
            <TooltipProvider key={`${label}-${index}`} delayDuration={150}>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>{chip}</PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Overdue — expired as of today</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-auto text-xs" role="status">Overdue — expired as of today</PopoverContent>
            </Popover>
            </TooltipProvider>
          );
        }
        return chip;
      })}
    </div>
  );
}
