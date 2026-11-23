import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Table>, "ref"> & {
  frozenColumns: 3 | 4;
};

// Table auto-layout may shrink or expand tracks despite their nominal widths.
// Frozen offsets must follow the rendered tracks, not hard-coded width sums.
export function TrainingMatrixTable({ frozenColumns, className, ...props }: Props) {
  const ref = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    const table = ref.current;
    if (!table) return;
    const headers = Array.from(table.tHead?.rows[0]?.cells || []).slice(0, frozenColumns);
    const measure = () => {
      let left = 0;
      headers.forEach((cell, index) => {
        table.style.setProperty(`--tm-frozen-${index}`, `${left}px`);
        left += cell.getBoundingClientRect().width;
      });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(table);
    headers.forEach(cell => observer?.observe(cell));
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [frozenColumns]);

  return (
    <Table
      {...props}
      ref={ref}
      className={cn(
        // Scope offset overrides to these two matrices, not shared Table styles.
        "[&_tr>:nth-child(1)]:left-[var(--tm-frozen-0)] [&_tr>:nth-child(2)]:left-[var(--tm-frozen-1)] [&_tr>:nth-child(3)]:left-[var(--tm-frozen-2)]",
        frozenColumns === 4 && "[&_tr>:nth-child(4)]:left-[var(--tm-frozen-3)]",
        className,
      )}
    />
  );
}
