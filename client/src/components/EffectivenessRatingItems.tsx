import type { ReactNode } from "react";
import { SelectItem } from "@/components/ui/select";
import type { EffectivenessOption } from "@shared/appraisal-effectiveness";

interface Props {
  options: readonly EffectivenessOption[] | null;
  children: ReactNode;
}

export function EffectivenessRatingItems({ options, children }: Props) {
  if (options === null) return <>{children}</>;
  return (
    <>
      {options.map(option => (
        <SelectItem key={option.id} value={option.id}>
          {option.label}
        </SelectItem>
      ))}
    </>
  );
}
