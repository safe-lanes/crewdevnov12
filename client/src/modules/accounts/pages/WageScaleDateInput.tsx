import { useLayoutEffect, useRef, useState, type ChangeEvent, type ComponentPropsWithoutRef, type FocusEventHandler } from "react";
import { Input } from "@/components/ui/input";
import { FormattedDateInput, formatIsoDate } from "@/components/ui/formatted-date-input";

type Props = Pick<
  Extract<ComponentPropsWithoutRef<typeof FormattedDateInput>, { mode?: "date" }>,
  "value" | "onChange" | "min" | "disabled" | "onDraftValidityChange" | "data-testid"
> & {
  savedValue: string;
  resetKey: string;
  height?: 32 | 36;
};

export default function WageScaleDateInput({
  min, savedValue, resetKey, height = 32, onDraftValidityChange, ...props
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousReset = useRef(resetKey);
  const unsupportedSavedValue = Boolean(savedValue && !formatIsoDate(savedValue));
  const [nativeSession, setNativeSession] = useState(unsupportedSavedValue);
  if (unsupportedSavedValue && !nativeSession) setNativeSession(true);
  const [nativeBadInput, setNativeBadInput] = useState(false);
  const [nativeError, setNativeError] = useState(false);
  const nativeValid = !nativeBadInput &&
    (!props.value || props.value === savedValue || Boolean(formatIsoDate(props.value)));

  useLayoutEffect(() => {
    if (nativeSession) onDraftValidityChange?.(nativeValid);
  }, [nativeSession, nativeValid, onDraftValidityChange]);
  useLayoutEffect(() => {
    if (nativeSession) return;
    const calendar = containerRef.current?.querySelector<HTMLInputElement>('input[type="date"]');
    if (calendar) calendar.min = min || "0001-01-01";
  }, [min, nativeSession]);
  useLayoutEffect(() => {
    if (previousReset.current === resetKey) return;
    previousReset.current = resetKey;
    setNativeBadInput(false);
    setNativeError(false);
    // Reload both drafts when either saved date changes, without remounting or losing focus.
    const manual = containerRef.current?.querySelector<HTMLInputElement>('input[type="text"]');
    const display = formatIsoDate(savedValue);
    if (manual && manual.value !== display) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(manual, display);
      manual.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, [resetKey, savedValue]);

  const handleBlurCapture: FocusEventHandler<HTMLDivElement> = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "date" || input.matches(":disabled")) return;
    if (nativeSession) {
      setNativeBadInput(input.validity.badInput);
      setNativeError(input.validity.badInput ||
        Boolean(input.value && input.value !== savedValue && !formatIsoDate(input.value)));
      if (input.value !== props.value) input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (!input.validity.valid || input.value === props.value) return;
    if (input.value !== "" && !formatIsoDate(input.value)) return;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const handleNativeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const badInput = event.target.validity.badInput;
    setNativeBadInput(badInput);
    setNativeError((shown) => shown && (badInput ||
      Boolean(event.target.value && event.target.value !== savedValue && !formatIsoDate(event.target.value))));
    props.onChange(event);
  };

  return (
    <div
      ref={containerRef}
      className={height === 32 ? "w-40" : "w-full"}
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }}
      onBlurCapture={handleBlurCapture}
    >
      <div aria-hidden="true" style={{ gridArea: "1 / 1", paddingTop: height, visibility: "hidden", pointerEvents: "none" }}>
        <p className="mt-1 text-xs leading-4">Incorrect date/date format</p>
      </div>
      <div style={{ gridArea: "1 / 1", minWidth: 0 }}>
        {nativeSession ? (
          <>
            <Input {...props} type="date" min={min}
              className={height === 32 ? "h-8 w-40 text-xs" : undefined}
              onChange={handleNativeChange} />
            {nativeError && <p role="alert" className="mt-1 text-xs leading-4 text-red-500">Incorrect date/date format</p>}
          </>
        ) : (
          <FormattedDateInput
            {...props}
            mode="date"
            className={height === 32 ? "h-8 w-40 min-w-0 border-input text-xs" : "min-w-0 border-input text-base md:text-sm"}
            acceptCalendarInputEvents
            retainInvalidDraftOnBlur
            onDraftValidityChange={onDraftValidityChange}
          />
        )}
      </div>
    </div>
  );
}
