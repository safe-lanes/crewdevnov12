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
};

/** Shared D&A urgency legend; interactive mode is used by the training matrix. */
export function DueInChips({
  items = defaultItems,
  className = "flex gap-2 items-center mb-4",
  overdueLabel = "O/D",
  selected,
  onToggle,
}: Props) {
  const interactive = Boolean(onToggle && selected);
  return (
    <div className={className}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Due in:</span>
      {items.map((item, index) => {
        const label = item.label === "O/D" ? overdueLabel : item.label;
        const window = item.label === "O/D" ? "Expired" : item.label as DueInWindow;
        const isSelected = selected?.includes(window) ?? false;
        const chipClass = "px-3 py-1 rounded text-sm font-semibold";
        return interactive ? (
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
      })}
    </div>
  );
}
