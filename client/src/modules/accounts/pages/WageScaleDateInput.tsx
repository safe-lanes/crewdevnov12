import { useLayoutEffect, useState, type ChangeEvent } from "react";
import { FormattedDateInput } from "@/components/ui/formatted-date-input";
import { isIsoDate, monthStart, monthEnd } from "@shared/v2/accounts/wageScaleRevisionDates";

interface Props {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  edge?: "start" | "end";
  min?: string;
  disabled?: boolean;
  savedValue?: string;
  resetKey: string;
  height?: 32 | 36;
  onDraftValidityChange?: (valid: boolean) => void;
  "data-testid"?: string;
}

export default function WageScaleDateInput({
  value, onChange, edge = "start", min, disabled = false, resetKey,
  height = 32, onDraftValidityChange, "data-testid": testId,
}: Props) {
  const [textValid, setTextValid] = useState(true);
  const canonical = !value || (isIsoDate(value) && value === (
    edge === "start" ? monthStart(value.slice(0, 7)) : monthEnd(value.slice(0, 7))
  ));
  const valid = disabled || (textValid && canonical);
  useLayoutEffect(() => {
    onDraftValidityChange?.(valid);
  }, [valid, onDraftValidityChange]);

  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const month = event.target.value;
    let date = "";
    try {
      date = month ? edge === "start" ? monthStart(month) : monthEnd(month) : "";
    } catch {
      setTextValid(false);
      return;
    }
    onChange({
      ...event,
      target: { ...event.target, value: date },
      currentTarget: { ...event.currentTarget, value: date },
    } as ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className={height === 32 ? "w-40" : "w-full"}>
      <FormattedDateInput
        key={resetKey}
        mode="month"
        value={isIsoDate(value) ? value.slice(0, 7) : ""}
        min={min?.slice(0, 7)}
        max="9999-12"
        disabled={disabled}
        onChange={change}
        onDraftValidityChange={setTextValid}
        className={height === 32 ? "h-8 w-40 border-input text-xs" : "w-full border-input"}
        data-testid={testId}
      />
      {!valid && <p role="alert" className="mt-1 text-xs text-red-500">
        Enter a valid permitted month, or clear the field.
      </p>}
    </div>
  );
}
